// ─── BACKUP / RESTORE ───────────────────────────────────────────────────────
//
// Everything in this file is PURE: no Firestore, no network, no clock reads
// beyond what's passed in. That's deliberate. Restore is the only feature in
// the app that can destroy a season, so the logic that decides what to write
// is kept where it can be exhaustively tested without a database — see
// tests/scoring.test.mjs. firebase.js does nothing but execute the plan this
// file produces.
//
// What's worth backing up, and what isn't:
//
//   predictions  IRREPLACEABLE. Nobody can re-enter a pick for a game that
//                has already been played, and nor should they be able to.
//   results      Scores can in principle be re-fetched, but the special
//                results and playoff matchups are entered by hand and would
//                be gone for good.
//   leagues      Recreatable, but tedious — names, scoring settings, members.
//   users        Included for reference only. NEVER restored: a user document
//                is writable solely by its owner, so a restore run from one
//                admin's browser cannot write anyone else's profile. They
//                repair themselves next time each person signs in.
//
// Standings are NOT in here because they are never stored — points, ranks and
// badges are all recomputed from predictions + results + the league's scoring
// settings on every render. Restore those two and the tables come back exact.

export const BACKUP_VERSION = 1;
export const BACKUP_APP = "scoreclash";

// Parts a restore can touch. `users` is deliberately absent — see above.
export const RESTORABLE = ["results", "predictions", "leagues"];

// ─── BUILD ──────────────────────────────────────────────────────────────────

export function buildBackup({ users = {}, leagues = [], predictions = {}, results = {}, seasonYear, takenBy = null, now = Date.now() }) {
  const leaguesById = {};
  for (const l of leagues) if (l?.id) leaguesById[l.id] = l;

  const data = {
    // The whole results document, not just scores — `specials` and
    // `playoffFixtures` live alongside and are the hand-entered parts.
    results: {
      scores: results.scores || {},
      specials: results.specials || {},
      playoffFixtures: results.playoffFixtures || {},
    },
    predictions,
    leagues: leaguesById,
    users,
  };

  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    seasonYear,
    takenAt: now,
    takenAtISO: new Date(now).toISOString(),
    takenBy,
    counts: countBackup(data),
    data,
  };
}

export function countBackup(data) {
  const preds = data?.predictions || {};
  let picks = 0, specialPicks = 0;
  for (const p of Object.values(preds)) {
    picks += Object.keys(p?.picks || {}).length;
    specialPicks += Object.keys(p?.specials || {}).length;
  }
  return {
    players: Object.keys(preds).length,
    picks,
    specialPicks,
    scores: Object.keys(data?.results?.scores || {}).length,
    specialResults: Object.keys(data?.results?.specials || {}).length,
    playoffMatchups: Object.keys(data?.results?.playoffFixtures || {}).length,
    leagues: Object.keys(data?.leagues || {}).length,
    users: Object.keys(data?.users || {}).length,
  };
}

// ─── VALIDATE ───────────────────────────────────────────────────────────────
//
// Fails CLOSED. A file that isn't recognisably a ScoreClash backup for this
// exact season is rejected outright rather than partially applied — restoring
// last season's picks over this one would be worse than the outage it was
// meant to fix.
export function validateBackup(raw, { seasonYear, now = Date.now() } = {}) {
  const errors = [], warnings = [];
  const isObj = (x) => x && typeof x === "object" && !Array.isArray(x);

  if (!isObj(raw)) return { ok: false, errors: ["That file isn't a ScoreClash backup."], warnings };
  if (raw.app !== BACKUP_APP) errors.push("That file isn't a ScoreClash backup.");
  if (!Number.isFinite(Number(raw.version))) errors.push("The backup has no version and can't be read safely.");
  else if (Number(raw.version) > BACKUP_VERSION) {
    errors.push(`This backup was written by a newer version of the app (v${raw.version}). Update before restoring it.`);
  }
  if (seasonYear != null && Number(raw.seasonYear) !== Number(seasonYear)) {
    errors.push(`This backup is for the ${raw.seasonYear} season, but the app is running ${seasonYear}.`);
  }
  if (!isObj(raw.data)) errors.push("The backup contains no data.");
  else {
    if (!isObj(raw.data.results)) errors.push("The backup has no results section.");
    if (!isObj(raw.data.predictions)) errors.push("The backup has no predictions section.");
    if (!isObj(raw.data.leagues)) warnings.push("The backup contains no leagues.");
  }
  if (Number(raw.takenAt) > now + 86400000) warnings.push("The backup is dated in the future — check the file is the one you meant.");

  const counts = isObj(raw.data) ? countBackup(raw.data) : null;
  if (counts && counts.players === 0 && counts.scores === 0) {
    warnings.push("This backup is empty — it has no picks and no results.");
  }
  return { ok: errors.length === 0, errors, warnings, counts };
}

// ─── PLAN ───────────────────────────────────────────────────────────────────
//
// Works out exactly what would be written, and returns it WITHOUT writing
// anything. The UI shows this before asking for confirmation, so nothing is
// ever a surprise.
//
// mode:
//   "merge"    only fills gaps. Never deletes, never overwrites a value that
//              already exists. This is the right shape for the usual disaster
//              (something wiped data) and is safe to run twice.
//   "replace"  restores the backup exactly, discarding anything created since.
//              For genuine corruption, where "what's there now" is the problem.
export function planRestore(backup, current, { mode = "merge", parts = RESTORABLE } = {}) {
  const want = new Set(parts.filter(p => RESTORABLE.includes(p)));
  const b = backup?.data || {};
  const plan = {
    mode,
    results: null,                 // { type, doc } | null
    predictions: [],               // [{ uid, type, doc }]
    leagues: [],                   // [{ id, type, doc }]
    summary: {
      scoresAdded: 0, scoresOverwritten: 0,
      specialResultsAdded: 0, playoffMatchupsAdded: 0,
      picksAdded: 0, picksOverwritten: 0, specialPicksAdded: 0,
      playersTouched: 0, leaguesCreated: 0, leaguesUpdated: 0,
    },
  };

  // ── results ──────────────────────────────────────────────────────────────
  if (want.has("results")) {
    const from = b.results || {};
    const to = {
      scores: current?.results?.scores || {},
      specials: current?.results?.specials || {},
      playoffFixtures: current?.results?.playoffFixtures || {},
    };
    if (mode === "replace") {
      plan.results = { type: "set", doc: {
        scores: from.scores || {}, specials: from.specials || {}, playoffFixtures: from.playoffFixtures || {},
      } };
      plan.summary.scoresAdded = Object.keys(from.scores || {}).length;
      plan.summary.scoresOverwritten = Object.keys(to.scores).length;
      plan.summary.specialResultsAdded = Object.keys(from.specials || {}).length;
      plan.summary.playoffMatchupsAdded = Object.keys(from.playoffFixtures || {}).length;
    } else {
      const fields = {};
      for (const [id, val] of Object.entries(from.scores || {})) {
        if (to.scores[id] === undefined) { fields[`scores.${id}`] = val; plan.summary.scoresAdded++; }
      }
      for (const [id, val] of Object.entries(from.specials || {})) {
        if (to.specials[id] === undefined) { fields[`specials.${id}`] = val; plan.summary.specialResultsAdded++; }
      }
      for (const [id, val] of Object.entries(from.playoffFixtures || {})) {
        if (to.playoffFixtures[id] === undefined) { fields[`playoffFixtures.${id}`] = val; plan.summary.playoffMatchupsAdded++; }
      }
      if (Object.keys(fields).length) plan.results = { type: "update", doc: fields };
    }
  }

  // ── predictions ──────────────────────────────────────────────────────────
  if (want.has("predictions")) {
    for (const [uid, backupDoc] of Object.entries(b.predictions || {})) {
      const live = current?.predictions?.[uid] || {};
      if (mode === "replace") {
        plan.predictions.push({ uid, type: "set", doc: {
          picks: backupDoc?.picks || {}, specials: backupDoc?.specials || {},
        } });
        plan.summary.picksAdded += Object.keys(backupDoc?.picks || {}).length;
        plan.summary.picksOverwritten += Object.keys(live.picks || {}).length;
        plan.summary.specialPicksAdded += Object.keys(backupDoc?.specials || {}).length;
        plan.summary.playersTouched++;
        continue;
      }
      const fields = {};
      for (const [id, val] of Object.entries(backupDoc?.picks || {})) {
        if ((live.picks || {})[id] === undefined) { fields[`picks.${id}`] = val; plan.summary.picksAdded++; }
      }
      for (const [id, val] of Object.entries(backupDoc?.specials || {})) {
        if ((live.specials || {})[id] === undefined) { fields[`specials.${id}`] = val; plan.summary.specialPicksAdded++; }
      }
      if (Object.keys(fields).length) {
        plan.predictions.push({ uid, type: "update", doc: fields });
        plan.summary.playersTouched++;
      }
    }
  }

  // ── leagues ──────────────────────────────────────────────────────────────
  //
  // Membership is handled with care. In merge mode a league that still exists
  // has only its name and scoring settings restored — `members` is left
  // completely alone, because someone may have joined since the backup and
  // rolling that back would silently eject them. A league that has been
  // deleted entirely is recreated in full, membership included, since there
  // is nothing live to preserve.
  if (want.has("leagues")) {
    for (const [id, backupLeague] of Object.entries(b.leagues || {})) {
      const live = current?.leagues?.[id];
      if (!live) {
        plan.leagues.push({ id, type: "set", doc: backupLeague });
        plan.summary.leaguesCreated++;
      } else if (mode === "replace") {
        plan.leagues.push({ id, type: "set", doc: backupLeague });
        plan.summary.leaguesUpdated++;
      } else {
        const fields = {};
        if (backupLeague?.name && backupLeague.name !== live.name) fields.name = backupLeague.name;
        if (backupLeague?.settings && JSON.stringify(backupLeague.settings) !== JSON.stringify(live.settings)) {
          fields.settings = backupLeague.settings;
        }
        if (Object.keys(fields).length) {
          plan.leagues.push({ id, type: "update", doc: fields });
          plan.summary.leaguesUpdated++;
        }
      }
    }
  }

  plan.isEmpty =
    !plan.results && plan.predictions.length === 0 && plan.leagues.length === 0;
  return plan;
}

// A one-line, human summary of a plan, for the confirmation step.
export function describePlan(plan) {
  const s = plan.summary;
  const bits = [];
  if (s.scoresAdded) bits.push(`${s.scoresAdded} game result${s.scoresAdded === 1 ? "" : "s"}`);
  if (s.specialResultsAdded) bits.push(`${s.specialResultsAdded} season result${s.specialResultsAdded === 1 ? "" : "s"}`);
  if (s.playoffMatchupsAdded) bits.push(`${s.playoffMatchupsAdded} playoff matchup${s.playoffMatchupsAdded === 1 ? "" : "s"}`);
  if (s.picksAdded) bits.push(`${s.picksAdded} pick${s.picksAdded === 1 ? "" : "s"} across ${s.playersTouched} player${s.playersTouched === 1 ? "" : "s"}`);
  if (s.specialPicksAdded) bits.push(`${s.specialPicksAdded} season pick${s.specialPicksAdded === 1 ? "" : "s"}`);
  if (s.leaguesCreated) bits.push(`${s.leaguesCreated} league${s.leaguesCreated === 1 ? "" : "s"} recreated`);
  if (s.leaguesUpdated) bits.push(`${s.leaguesUpdated} league${s.leaguesUpdated === 1 ? "" : "s"} updated`);
  if (bits.length === 0) return "Nothing to restore — everything in this backup is already present.";
  const overwrite = plan.mode === "replace" && (s.scoresOverwritten || s.picksOverwritten)
    ? ` Replacing will discard ${s.scoresOverwritten} existing result${s.scoresOverwritten === 1 ? "" : "s"} and ${s.picksOverwritten} existing pick${s.picksOverwritten === 1 ? "" : "s"}.`
    : "";
  return `Will restore ${bits.join(", ")}.${overwrite}`;
}

// Filename that sorts chronologically and says what it is at a glance.
export function backupFilename(backup) {
  const d = new Date(backup?.takenAt || Date.now());
  const pad = (n) => String(n).padStart(2, "0");
  return `scoreclash-${backup?.seasonYear || "backup"}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
}
