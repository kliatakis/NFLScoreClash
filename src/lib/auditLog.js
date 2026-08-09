// Change history — what an admin did, when, and to what.
//
// WHAT THIS IS FOR
// ────────────────
// Everything that decides the standings is editable by an admin: scores,
// season winners, playoff matchups, scoring values, and other people's picks.
// Without a record, "why did I drop two points overnight?" has no answer, and
// an honest mistake looks identical to a thumb on the scale.
//
// WHAT THIS IS NOT
// ────────────────
// It is NOT tamper-proof. Entries are written by the same client that makes
// the change, so anyone with the Firebase console can write whatever they
// like or skip the log entirely. The security rules make entries
// create-only — the app can never edit or delete one after the fact — which
// covers the case this actually exists for: accidents, and settling
// arguments between friends. It does not defend against a determined admin
// with database access. Don't sell it as more than that.
//
// WHAT IS DELIBERATELY NOT LOGGED
// ───────────────────────────────
// Players changing their OWN picks before lock. Six players retapping across
// 272 games is thousands of entries that bury the dozen that matter, and a
// pick before lock affects nobody else — at lock everyone sees everyone's
// picks anyway. An ADMIN changing someone's pick is logged, because that one
// moves points that were already earned.
//
// This module is pure: no Firestore, no React, no clock of its own. Every
// function takes what it needs and returns data, so it can be tested directly.

export const AUDIT_VERSION = 1;

// Tone drives the colour of the row. `warn` = something that already existed
// was altered; `danger` = something was destroyed or points moved between
// people; `neutral` = new information arriving, which is the normal case.
export const AUDIT_KINDS = {
  result_set:      { label: "Result entered",          icon: "🏈", tone: "neutral" },
  result_changed:  { label: "Result changed",          icon: "✏️", tone: "warn" },
  result_cleared:  { label: "Result cleared",          icon: "🗑️", tone: "danger" },

  special_set:     { label: "Season winner set",       icon: "🏆", tone: "neutral" },
  special_changed: { label: "Season winner changed",   icon: "✏️", tone: "warn" },
  special_cleared: { label: "Season winner cleared",   icon: "🗑️", tone: "danger" },

  playoff_set:     { label: "Playoff matchup set",     icon: "📅", tone: "neutral" },
  playoff_changed: { label: "Playoff matchup changed", icon: "✏️", tone: "warn" },
  playoff_cleared: { label: "Playoff matchup cleared", icon: "🗑️", tone: "danger" },

  pick_override:   { label: "Member's pick corrected", icon: "👤", tone: "danger" },
  scoring_changed: { label: "Scoring settings changed", icon: "⚙️", tone: "warn" },

  member_removed:  { label: "Member removed",          icon: "🚪", tone: "danger" },
  admins_changed:  { label: "Admin rights changed",    icon: "🛡️", tone: "warn" },

  fetch_results:   { label: "Auto-fetch wrote results", icon: "📡", tone: "neutral" },
  restore:         { label: "Backup restored",         icon: "♻️", tone: "danger" },
};

export const AUDIT_KIND_IDS = Object.keys(AUDIT_KINDS);

// Coarse buckets for the filter row — fifteen kinds is too many chips.
export const AUDIT_GROUPS = [
  { id: "all",      label: "Everything", kinds: AUDIT_KIND_IDS },
  { id: "results",  label: "Results",    kinds: ["result_set", "result_changed", "result_cleared", "fetch_results"] },
  { id: "season",   label: "Season & playoffs", kinds: ["special_set", "special_changed", "special_cleared", "playoff_set", "playoff_changed", "playoff_cleared"] },
  { id: "picks",    label: "Picks",      kinds: ["pick_override"] },
  { id: "settings", label: "Settings & members", kinds: ["scoring_changed", "member_removed", "admins_changed", "restore"] },
  // The subset a suspicious member would actually want: things that took
  // away or moved something already recorded.
  { id: "changes",  label: "Overwrites only", kinds: AUDIT_KIND_IDS.filter(k => AUDIT_KINDS[k].tone !== "neutral") },
];

const MAX_SUMMARY = 300;

// Builds a stored entry. `now` is injected rather than read from the clock so
// tests are deterministic; callers in the app pass Date.now().
export function makeEntry({
  kind, actorUid, actorName, leagueId = null, global = false,
  target = null, summary = "", detail = null, now = Date.now(),
}) {
  if (!AUDIT_KINDS[kind]) throw new Error(`Unknown audit kind: ${kind}`);
  if (!actorUid) throw new Error("An audit entry needs an actor");
  const entry = {
    v: AUDIT_VERSION,
    at: Number(now),
    kind,
    actorUid,
    actorName: String(actorName || "Unknown").slice(0, 60),
    // Which league the admin was working in. Results, season winners and
    // playoff matchups are stored once for the whole app, so they change the
    // standings in EVERY league — `global` says so, and the History tab shows
    // those to every league rather than only the one they were entered from.
    leagueId: leagueId || null,
    global: !!global,
    summary: String(summary || AUDIT_KINDS[kind].label).slice(0, MAX_SUMMARY),
  };
  if (target) entry.target = String(target);
  // Firestore rejects undefined values anywhere in a document, so strip them
  // rather than letting a missing field abort the whole write.
  if (detail && typeof detail === "object") {
    const clean = {};
    for (const [k, val] of Object.entries(detail)) if (val !== undefined) clean[k] = val;
    if (Object.keys(clean).length) entry.detail = clean;
  }
  return entry;
}

// Fails closed: anything we can't read confidently is hidden rather than
// rendered as a half-blank row implying something happened that didn't.
export function isValidEntry(e) {
  return !!e
    && typeof e === "object"
    && typeof e.at === "number" && Number.isFinite(e.at)
    && typeof e.kind === "string" && !!AUDIT_KINDS[e.kind]
    && typeof e.actorUid === "string" && !!e.actorUid;
}

// An entry belongs to a league if it was made there, or if it changed
// something shared by every league.
export function entryVisibleTo(entry, leagueId) {
  if (!entry) return false;
  if (entry.global) return true;
  return entry.leagueId === leagueId;
}

export function filterEntries(entries, { leagueId = null, group = "all", actorUid = "", search = "" } = {}) {
  const groupDef = AUDIT_GROUPS.find(g => g.id === group) || AUDIT_GROUPS[0];
  const kinds = new Set(groupDef.kinds);
  const needle = String(search || "").trim().toLowerCase();
  return (entries || [])
    .filter(isValidEntry)
    .filter(e => (leagueId == null ? true : entryVisibleTo(e, leagueId)))
    .filter(e => kinds.has(e.kind))
    .filter(e => (actorUid ? e.actorUid === actorUid : true))
    .filter(e => (needle
      ? `${e.summary} ${e.actorName} ${AUDIT_KINDS[e.kind].label}`.toLowerCase().includes(needle)
      : true))
    .sort((a, b) => b.at - a.at);   // newest first, always
}

// Groups into day headings. Uses the viewer's chosen timezone so "Sunday" is
// their Sunday — a 1am UTC kickoff is Saturday night in the US.
export function groupByDay(entries, timezone) {
  const out = [];
  let current = null;
  for (const e of entries) {
    const key = dayKey(e.at, timezone);
    if (!current || current.key !== key) {
      current = { key, label: dayLabel(e.at, timezone), entries: [] };
      out.push(current);
    }
    current.entries.push(e);
  }
  return out;
}

function fmt(ms, options, timezone) {
  try {
    return new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone || undefined })
      .format(new Date(ms));
  } catch {
    // An invalid timezone string would otherwise throw and blank the tab.
    return new Intl.DateTimeFormat("en-GB", options).format(new Date(ms));
  }
}

export function dayKey(ms, timezone) {
  return fmt(ms, { year: "numeric", month: "2-digit", day: "2-digit" }, timezone);
}

export function dayLabel(ms, timezone) {
  return fmt(ms, { weekday: "short", day: "numeric", month: "short", year: "numeric" }, timezone);
}

export function timeLabel(ms, timezone) {
  return fmt(ms, { hour: "2-digit", minute: "2-digit", hour12: false }, timezone);
}

// ── Summary builders ────────────────────────────────────────────────────────
// Every one of these produces the single line shown in the History tab. They
// are deliberately concrete: "Result changed" tells you nothing, while
// "SEA @ NE · 21–17 → 24–17" tells you exactly what to argue about.

export function scoreText(result) {
  if (!result) return "no score";
  const { awayScore, homeScore } = result;
  if (awayScore == null || homeScore == null) return "no score";
  return `${awayScore}–${homeScore}`;
}

// "Wk 4 · SEA @ NE" — matches the away@home order used everywhere else.
export function fixtureText(fixture) {
  if (!fixture) return "Unknown game";
  const where = fixture.week != null ? `Wk ${fixture.week}` : (fixture.roundLabel || fixture.label || "Playoffs");
  const away = fixture.away || "?";
  const home = fixture.home || "?";
  return `${where} · ${away} @ ${home}`;
}

export function resultSummary(fixture, before, after) {
  const game = fixtureText(fixture);
  if (!after) return `${game} · ${scoreText(before)} → cleared`;
  if (!before) return `${game} · ${scoreText(after)}`;
  return `${game} · ${scoreText(before)} → ${scoreText(after)}`;
}

export function resultKind(before, after) {
  if (!after) return "result_cleared";
  return before ? "result_changed" : "result_set";
}

export function pickSideText(side, fixture) {
  if (side === "T") return "Tie";
  if (side === "H") return fixture?.home || "Home";
  if (side === "A") return fixture?.away || "Away";
  return "no pick";
}

export function overrideSummary(username, fixture, beforeSide, afterSide) {
  return `${username} · ${fixtureText(fixture)} · ${pickSideText(beforeSide, fixture)} → ${pickSideText(afterSide, fixture)}`;
}

// Only the values that actually moved. A "changed" entry listing eight
// unchanged settings is worse than no entry at all — it hides the one that
// did change.
export function scoringDiff(before, after, labels = {}) {
  const lines = [];
  for (const key of Object.keys(after || {})) {
    const from = Number(before?.[key]);
    const to = Number(after[key]);
    if (!Number.isFinite(to)) continue;
    if (Number.isFinite(from) && from === to) continue;
    lines.push({ key, label: labels[key] || key, from: Number.isFinite(from) ? from : null, to });
  }
  return lines;
}

export function scoringSummary(diff) {
  if (!diff.length) return "No values changed";
  return diff
    .map(d => `${d.label} ${d.from == null ? "—" : d.from} → ${d.to}`)
    .join(" · ");
}

export function playoffSummary(fixture, before, after) {
  const label = fixture?.label || fixture?.id || "Playoff game";
  const side = (m) => (m?.away && m?.home ? `${m.away} @ ${m.home}` : "not set");
  if (!after) return `${label} · ${side(before)} → cleared`;
  if (!before) return `${label} · ${side(after)}`;
  return `${label} · ${side(before)} → ${side(after)}`;
}

export function specialSummary(typeLabel, before, after) {
  if (!after) return `${typeLabel} · ${before || "not set"} → cleared`;
  if (!before) return `${typeLabel} · ${after}`;
  return `${typeLabel} · ${before} → ${after}`;
}
