import { REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES } from "../data/fixtures.js";

// ─── SCORING SETTINGS ───────────────────────────────────────────────────────
export const DEFAULT_SCORING = {
  outcomePoints: 1,     // correct winner, wrong score
  exactPoints: 3,       // exact final score
  divisionPoints: 5,    // correct division winner pick
  conferencePoints: 7,  // correct AFC/NFC champion pick
  superbowlPoints: 10,  // correct Super Bowl champion pick
};

export function getScoringSettings(league) {
  const s = league?.settings || {};
  return {
    outcomePoints: Number(s.outcomePoints ?? DEFAULT_SCORING.outcomePoints),
    exactPoints: Number(s.exactPoints ?? DEFAULT_SCORING.exactPoints),
    divisionPoints: Number(s.divisionPoints ?? DEFAULT_SCORING.divisionPoints),
    conferencePoints: Number(s.conferencePoints ?? DEFAULT_SCORING.conferencePoints),
    superbowlPoints: Number(s.superbowlPoints ?? DEFAULT_SCORING.superbowlPoints),
  };
}

export function generateCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

// ─── GAME SCORING ───────────────────────────────────────────────────────────

// What actually happened with one pick, independent of any league's point
// values: "exact" (perfect score), "outcome" (right winner, wrong score),
// "wrong", or null when there's nothing to score yet (no pick, or no result).
//
// This exists as its own function on purpose. Everything used to infer the
// outcome by comparing the POINTS awarded back to the league's settings —
// which breaks the moment two settings share a value. Concretely: a league
// with Correct Winner set to 0 makes a wrong pick (0 points) and a
// correct-winner pick (also 0 points) indistinguishable, so every wrong pick
// got counted in the Outcome column and in prediction accuracy. Classifying
// first and pricing second removes that whole class of bug regardless of what
// point values an admin picks.
export function classifyPick(pick, result) {
  if (!pick || !result) return null;
  const { homeScore: ph, awayScore: pa } = pick;
  const { homeScore: rh, awayScore: ra } = result;
  if (ph == null || pa == null || rh == null || ra == null) return null;
  if (Number(ph) === Number(rh) && Number(pa) === Number(ra)) return "exact";
  const pickOutcome = Number(ph) > Number(pa) ? "H" : Number(pa) > Number(ph) ? "A" : "T";
  const realOutcome = Number(rh) > Number(ra) ? "H" : Number(ra) > Number(rh) ? "A" : "T";
  return pickOutcome === realOutcome ? "outcome" : "wrong";
}

export function calcMatchScore(pick, result, scoring = DEFAULT_SCORING) {
  const kind = classifyPick(pick, result);
  if (kind === "exact") return scoring.exactPoints;
  if (kind === "outcome") return scoring.outcomePoints;
  return 0;
}

function specialPickPoints(kind, scoring) {
  if (kind === "division") return scoring.divisionPoints;
  if (kind === "conference") return scoring.conferencePoints;
  if (kind === "superbowl") return scoring.superbowlPoints;
  return 0;
}

// ─── STABLE HASH (for detecting "did anything scoring-relevant change") ────
function stableHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash.toString(36);
}

// A version marker that changes whenever a result, special result, or an
// admin override of a scored prediction happens — the three things that can
// actually move a league's standings. Used to know when to recompute the
// movement-arrow baseline (shared for every viewer, not per-login).
export function computeResultsVersion(results, specialResults, allPredictions, leagueMembers) {
  const overrideMarkers = [];
  for (const uid of leagueMembers) {
    const picks = (allPredictions[uid] || {}).picks || {};
    for (const fid of Object.keys(picks)) {
      if (picks[fid]?.overriddenAt) overrideMarkers.push(`${uid}:${fid}:${picks[fid].overriddenAt}`);
    }
  }
  overrideMarkers.sort();
  const payload = JSON.stringify(results) + JSON.stringify(specialResults) + overrideMarkers.join(",");
  return stableHash(payload);
}

// ─── LEADERBOARD ────────────────────────────────────────────────────────────
// Computes standings for one league. `allPredictions` is keyed by uid (the
// shared, per-user prediction docs) — NOT per-league, since predictions are
// shared across leagues now; only the scoring settings differ per league.
export function calcStandings(league, allUsers, allPredictions, results, specialResults, scoring) {
  const members = league.members || [];

  return members.map(uid => {
    const user = allUsers[uid];
    const preds = allPredictions[uid] || {};
    const picks = preds.picks || {};
    const specials = preds.specials || {};

    let points = 0, exact = 0, correct = 0, gamesScored = 0;

    for (const fixture of REGULAR_SEASON_FIXTURES) {
      const result = results[fixture.id];
      if (!result) continue;
      const pick = picks[fixture.id];
      points += calcMatchScore(pick, result, scoring);
      // Counted from what the pick actually WAS, not from what it scored —
      // see classifyPick above for why that distinction matters.
      const kind = classifyPick(pick, result);
      if (kind) {
        gamesScored++;
        if (kind === "exact") exact++;
        else if (kind === "outcome") correct++;
      }
    }

    // Broken out per pick-type (not just a lumped `specialCorrect` total) so
    // the tiebreaker order below — Super Bowl, then conference, then
    // division, then exact scores — can compare each level independently.
    let specialCorrect = 0, superbowlCorrect = 0, conferenceCorrect = 0, divisionCorrect = 0;
    for (const type of SPECIAL_PICK_TYPES) {
      const actual = specialResults[type.id];
      const pick = specials[type.id];
      if (actual && pick && actual === pick) {
        points += specialPickPoints(type.kind, scoring);
        specialCorrect++;
        if (type.kind === "superbowl") superbowlCorrect++;
        else if (type.kind === "conference") conferenceCorrect++;
        else if (type.kind === "division") divisionCorrect++;
      }
    }

    return {
      uid,
      username: user?.username || "Unknown",
      points, exact, correct, gamesScored, specialCorrect,
      superbowlCorrect, conferenceCorrect, divisionCorrect,
    };
  }).sort((a, b) =>
    b.points - a.points ||
    b.superbowlCorrect - a.superbowlCorrect ||
    b.conferenceCorrect - a.conferenceCorrect ||
    b.divisionCorrect - a.divisionCorrect ||
    b.exact - a.exact
  );
}

// Explains WHY `a` outranks `b`, for two entries already known to be tied on
// total points — used to show an info icon next to whoever a tiebreaker
// resolved. Returns null if there's nothing (yet) to differentiate them, in
// which case they're a genuine dead tie and no tiebreaker has fired.
export function explainTiebreak(a, b) {
  if (a.points !== b.points) return null;
  if (a.superbowlCorrect !== b.superbowlCorrect) {
    return `Ahead of ${b.username} on tiebreaker #1: correctly picked the Super Bowl winner.`;
  }
  if (a.conferenceCorrect !== b.conferenceCorrect) {
    return `Ahead of ${b.username} on tiebreaker #2: ${a.conferenceCorrect} correct conference pick${a.conferenceCorrect === 1 ? "" : "s"} vs ${b.conferenceCorrect}.`;
  }
  if (a.divisionCorrect !== b.divisionCorrect) {
    return `Ahead of ${b.username} on tiebreaker #3: ${a.divisionCorrect} correct division pick${a.divisionCorrect === 1 ? "" : "s"} vs ${b.divisionCorrect}.`;
  }
  if (a.exact !== b.exact) {
    return `Ahead of ${b.username} on tiebreaker #4: ${a.exact} exact score${a.exact === 1 ? "" : "s"} vs ${b.exact}.`;
  }
  return null;
}

// Attaches movement info (dash / 1 arrow / 2 arrows, up or down) based on the
// league's persisted, shared standings snapshots — NOT per-viewer, NOT
// per-login. Returns { standings, movementByUid, shouldPersist, newSnapshot,
// newVersion, newTrackedSnapshot, newTrackedVersion }.
//
// This tracks TWO generations of standings, not one — that's the whole fix
// for arrows that are supposed to persist until the next result comes in:
//   - standingsSnapshot / standingsSnapshotVersion — the STABLE baseline
//     shown to everyone. Only ever moves forward when a genuinely NEW
//     results version shows up.
//   - standingsTrackedSnapshot / standingsTrackedVersion — internal
//     bookkeeping: "the live state as of the last time anyone looked."
//
// A single-snapshot version of this (an earlier build had one) saves
// current-ranks-as-the-new-baseline the instant it detects a change — which
// means the very next render (after that write round-trips, often under a
// second) finds baseline === current and the arrows collapse back to a flat
// dash for everyone, including the person who just saw them. Tracking two
// generations means the baseline only rotates to "ranks as of the PREVIOUS
// result" — so it stays put, correctly, until the NEXT new result (whether
// entered by an admin or pulled in by the auto-fetch cron) actually arrives.
export function calcStandingsWithMovement(league, allUsers, allPredictions, results, specialResults, scoring) {
  const standings = calcStandings(league, allUsers, allPredictions, results, specialResults, scoring);
  const currentVersion = computeResultsVersion(results, specialResults, allPredictions, league.members || []);

  const currentRanks = {};
  standings.forEach((entry, i) => { currentRanks[entry.uid] = i + 1; });

  let baselineSnapshot = league.standingsSnapshot || null;
  let baselineVersion = league.standingsSnapshotVersion || null;
  const trackedSnapshot = league.standingsTrackedSnapshot || null;
  const trackedVersion = league.standingsTrackedVersion || null;

  let shouldPersist = false;
  let newTrackedSnapshot = trackedSnapshot;
  let newTrackedVersion = trackedVersion;

  if (trackedVersion == null) {
    // Very first computation ever for this league — nothing exists to
    // compare against, so baseline = tracked = current (arrows show "same",
    // correctly, since there's no history yet).
    baselineSnapshot = currentRanks;
    baselineVersion = currentVersion;
    newTrackedSnapshot = currentRanks;
    newTrackedVersion = currentVersion;
    shouldPersist = true;
  } else if (currentVersion !== trackedVersion) {
    // Something changed since we last tracked a live state — rotate.
    // Whatever WAS "tracked" (the live state as of the last view) becomes
    // the new stable display baseline; the brand-new state becomes what
    // we're tracking for the *next* rotation.
    baselineSnapshot = trackedSnapshot;
    baselineVersion = trackedVersion;
    newTrackedSnapshot = currentRanks;
    newTrackedVersion = currentVersion;
    shouldPersist = true;
  }
  // else: currentVersion === trackedVersion — nothing new since last time
  // anyone looked, so baseline stays exactly as already stored. No write.

  const movementByUid = {};
  standings.forEach((entry, i) => {
    const rank = i + 1;
    const prevRank = baselineSnapshot ? baselineSnapshot[entry.uid] : null;
    if (!baselineSnapshot || prevRank == null) {
      movementByUid[entry.uid] = { dir: "same", arrows: 0 };
      return;
    }
    const delta = prevRank - rank; // positive = moved up
    if (delta === 0) movementByUid[entry.uid] = { dir: "same", arrows: 0 };
    else if (delta > 0) movementByUid[entry.uid] = { dir: "up", arrows: delta > 2 ? 2 : 1 };
    else movementByUid[entry.uid] = { dir: "down", arrows: (-delta) > 2 ? 2 : 1 };
  });

  return {
    standings,
    movementByUid,
    shouldPersist,
    newSnapshot: baselineSnapshot,
    newVersion: baselineVersion,
    newTrackedSnapshot,
    newTrackedVersion,
  };
}

// ─── DASHBOARD HIGHLIGHTS ───────────────────────────────────────────────────
// Fun "announcement board" callouts for the most recently completed week —
// not the whole season, so the card stays a fixed, current-feeling size
// instead of growing forever. Three categories:
//   fire   — someone nailed the exact final score (always shown, no threshold)
//   upsets — the correct winner was called by 10% or fewer of the people who
//            made a pick on that game (a real long-shot call)
//   clowns — the correct winner was missed by 10% or fewer of the people who
//            made a pick (i.e. it was "obvious" and almost nobody blew it)
// Both percentage checks are relative to members who actually made a pick on
// that specific game, not the whole league roster (no-picks don't count
// either way).
//
// Note the practical floor this implies: for a single person to be 10% or
// less, at least 10 people must have picked that game. Smaller leagues will
// simply never produce upset/clown callouts (exact-score 🔥 hits have no
// threshold and still fire at any size) — that's the arithmetic of a
// percentage rule, not a bug.
const UPSET_THRESHOLD = 0.10;

export function computeHighlights(league, allUsers, allPredictions, results) {
  const members = league?.members || [];
  const completedWeeks = REGULAR_SEASON_FIXTURES.filter(f => results[f.id]).map(f => f.week);
  if (completedWeeks.length === 0) return { week: null, fire: [], upsets: [], clowns: [] };

  const week = Math.max(...completedWeeks);
  const weekFixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week && results[f.id]);

  const fire = [], upsets = [], clowns = [];

  for (const fixture of weekFixtures) {
    const result = results[fixture.id];

    const made = [];
    for (const uid of members) {
      const pick = (allPredictions[uid]?.picks || {})[fixture.id];
      const kind = classifyPick(pick, result);
      if (!kind) continue; // no pick made — doesn't count either way
      made.push({
        uid,
        username: allUsers[uid]?.username || "Unknown",
        isExact: kind === "exact",
        isCorrect: kind !== "wrong",
      });
    }
    const total = made.length;
    if (total === 0) continue;

    const exactHitters = made.filter(p => p.isExact).map(p => p.username);
    if (exactHitters.length > 0) {
      fire.push({ fixture, users: exactHitters, score: `${result.awayScore}-${result.homeScore}` });
    }

    const correct = made.filter(p => p.isCorrect);
    const incorrect = made.filter(p => !p.isCorrect);
    if (correct.length > 0 && correct.length / total <= UPSET_THRESHOLD) {
      upsets.push({ fixture, users: correct.map(p => p.username) });
    }
    if (incorrect.length > 0 && incorrect.length / total <= UPSET_THRESHOLD) {
      clowns.push({ fixture, users: incorrect.map(p => p.username) });
    }
  }

  return { week, fire, upsets, clowns };
}
