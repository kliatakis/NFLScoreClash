// ─── UNDO ───────────────────────────────────────────────────────────────────
//
// Reversing one entry in the change history.
//
// THE RULE THAT MAKES THIS SAFE
// ─────────────────────────────
// An undo only runs if the value on the server is STILL what that entry left
// behind. If anything has touched it since, the undo is refused and says so.
//
// Without that check, undo is a loaded gun. Somebody corrects a score at 10am,
// somebody else corrects it properly at 11am, and an undo of the 10am entry
// would quietly overwrite the 11am value with a number nobody has looked at
// since — a silent regression in the standings that nothing in the app would
// ever surface. Age isn't the test; "has anyone touched it since" is.
//
// UNDO IS NOT A TIME MACHINE
// ──────────────────────────
// It reverses ONE entry, not everything after it. That's why the freshness
// check doubles as the guard against misuse: if you've made three changes to
// the same game, only the newest one can be undone, and only until somebody
// changes it again.
//
// The undo is itself recorded as a new entry. Nothing is ever deleted from the
// log — the security rules forbid it — so history shows the change AND the
// reversal, which is the honest record of what happened.
//
// Pure: no Firestore, no React. The caller reads the current value, asks for a
// plan, and executes it.

// Kinds we can reverse, and what we need to read to check freshness.
//   result   → results.scores[fixtureId]
//   special  → results.specials[typeId]
//   playoff  → results.playoffFixtures[fixtureId]
//   pick     → predictions[uid].picks[fixtureId].winner
//   scoring  → league.settings
//   admins   → league.adminIds
export const UNDO_TARGETS = {
  result_set: "result", result_changed: "result", result_cleared: "result",
  special_set: "special", special_changed: "special", special_cleared: "special",
  playoff_set: "playoff", playoff_changed: "playoff", playoff_cleared: "playoff",
  pick_override: "pick",
  scoring_changed: "scoring",
  admins_changed: "admins",
};

// Deliberately NOT undoable, with the reason shown in the UI. Being explicit
// beats a missing button that looks like an oversight.
export const NOT_UNDOABLE = {
  member_removed:
    "Can't be undone from here — the security rules only let people add themselves to a league. "
    + "Send them the code and they'll be back with all their picks intact.",
  restore:
    "A restore is far too large to reverse one entry at a time. Use the BEFORE-RESTORE backup "
    + "that downloaded automatically when it ran.",
  fetch_results:
    "Auto-fetched scores aren't reversed in bulk — if one is wrong, clear that single game "
    + "in the Results tab.",
};

export function undoTargetOf(entry) {
  return entry && UNDO_TARGETS[entry.kind] ? UNDO_TARGETS[entry.kind] : null;
}

// Whether an entry carries enough detail to be reversed at all. Old entries
// written before a field existed simply don't offer the button.
export function hasUndoDetail(entry) {
  const target = undoTargetOf(entry);
  if (!target) return false;
  const d = entry.detail;
  if (!d || typeof d !== "object") return false;
  if (target === "admins") return typeof d.targetUid === "string" && typeof d.promoted === "boolean";
  return "before" in d || "after" in d;
}

const num = (v) => (v == null || v === "" ? null : Number(v));

// Compares only the fields that identify a value, ignoring bookkeeping like
// `enteredAt` which changes on every write and would make everything look
// stale.
export function sameValue(target, a, b) {
  if (target === "result") {
    if (!a || !b) return !a && !b;
    return num(a.homeScore) === num(b.homeScore) && num(a.awayScore) === num(b.awayScore);
  }
  if (target === "special") return (a || null) === (b || null);
  if (target === "playoff") {
    if (!a || !b) return !a && !b;
    return a.home === b.home && a.away === b.away && (a.kickoffUTC || null) === (b.kickoffUTC || null);
  }
  if (target === "pick") return (a || null) === (b || null);
  if (target === "scoring") {
    const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
    for (const k of keys) if (Number(a?.[k]) !== Number(b?.[k])) return false;
    return true;
  }
  return false;
}

// Works out what undoing this entry would write, or why it can't.
//
// `current` is whatever the caller read for this entry's target, right now:
//   result  → the stored score object (or null)
//   special → the team code string (or null)
//   playoff → the stored matchup object (or null)
//   pick    → the stored winner side (or null)
//   scoring → the league's settings object
//   admins  → the league's adminIds array
export function planUndo(entry, current, { leagueId = null } = {}) {
  const refuse = (reason) => ({ ok: false, reason });

  if (!entry) return refuse("There's nothing to undo.");
  if (NOT_UNDOABLE[entry.kind]) return refuse(NOT_UNDOABLE[entry.kind]);
  const target = undoTargetOf(entry);
  if (!target) return refuse("This kind of change can't be undone.");
  if (!hasUndoDetail(entry)) {
    return refuse("This entry was recorded before undo existed, so it doesn't have enough detail to reverse.");
  }

  const d = entry.detail;

  if (target === "admins") {
    const isAdminNow = Array.isArray(current) && current.includes(d.targetUid);
    // Freshness: the change must still stand. Promoted then still an admin,
    // or demoted then still not one.
    if (isAdminNow !== d.promoted) {
      return refuse("Their admin rights have already changed again since this entry, so there's nothing to reverse.");
    }
    return {
      ok: true,
      action: { type: "admins.set", leagueId, targetUid: d.targetUid, makeAdmin: !d.promoted },
      summary: `${d.promoted ? "Remove" : "Restore"} admin rights for ${entry.detail.username || d.targetUid}`,
    };
  }

  // Everything else is a straight before/after swap.
  if (!sameValue(target, current, d.after)) {
    return refuse(
      "Somebody has changed this since — undoing now would overwrite their change with an older value. "
      + "Undo only works while nothing else has touched it."
    );
  }

  const before = d.before ?? null;

  if (target === "result") {
    return before
      ? {
          ok: true,
          action: { type: "result.set", fixtureId: entry.target, homeScore: num(before.homeScore), awayScore: num(before.awayScore) },
          summary: `Put the score back to ${before.awayScore}–${before.homeScore}`,
        }
      : { ok: true, action: { type: "result.clear", fixtureId: entry.target }, summary: "Clear the score again" };
  }

  if (target === "special") {
    return {
      ok: true,
      action: { type: "special.set", typeId: entry.target, team: before || "" },
      summary: before ? `Put the winner back to ${before}` : "Set it back to not decided",
    };
  }

  if (target === "playoff") {
    return before
      ? {
          ok: true,
          action: { type: "playoff.set", fixtureId: entry.target, matchup: before },
          summary: `Put the matchup back to ${before.away} @ ${before.home}`,
        }
      : { ok: true, action: { type: "playoff.clear", fixtureId: entry.target }, summary: "Clear the matchup again" };
  }

  if (target === "pick") {
    return before
      ? {
          ok: true,
          action: { type: "pick.set", uid: d.targetUid, fixtureId: d.fixtureId, winner: before },
          summary: `Put ${d.username || "their"} pick back`,
        }
      : {
          ok: true,
          action: { type: "pick.clear", uid: d.targetUid, fixtureId: d.fixtureId },
          summary: `Remove the pick again — ${d.username || "they"} hadn't made one`,
        };
  }

  if (target === "scoring") {
    return {
      ok: true,
      action: { type: "scoring.set", leagueId, settings: d.before },
      summary: "Put the scoring values back",
    };
  }

  return refuse("This kind of change can't be undone.");
}
