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
export function calcMatchScore(pick, result, scoring = DEFAULT_SCORING) {
  if (!pick || !result) return 0;
  const { homeScore: ph, awayScore: pa } = pick;
  const { homeScore: rh, awayScore: ra } = result;
  if (ph == null || pa == null || rh == null || ra == null) return 0;
  if (Number(ph) === Number(rh) && Number(pa) === Number(ra)) return scoring.exactPoints;
  const pickOutcome = ph > pa ? "H" : pa > ph ? "A" : "T";
  const realOutcome = rh > ra ? "H" : ra > rh ? "A" : "T";
  return pickOutcome === realOutcome ? scoring.outcomePoints : 0;
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
      const s = calcMatchScore(pick, result, scoring);
      points += s;
      if (pick?.homeScore != null) {
        gamesScored++;
        if (s === scoring.exactPoints) exact++;
        else if (s === scoring.outcomePoints) correct++;
      }
    }

    let specialCorrect = 0;
    for (const type of SPECIAL_PICK_TYPES) {
      const actual = specialResults[type.id];
      const pick = specials[type.id];
      if (actual && pick && actual === pick) {
        points += specialPickPoints(type.kind, scoring);
        specialCorrect++;
      }
    }

    return {
      uid,
      username: user?.username || "Unknown",
      points, exact, correct, gamesScored, specialCorrect,
    };
  }).sort((a, b) =>
    b.points - a.points ||
    b.exact - a.exact ||
    b.specialCorrect - a.specialCorrect ||
    b.correct - a.correct
  );
}

// Attaches movement info (dash / 1 arrow / 2 arrows, up or down) based on the
// league's persisted, shared standingsSnapshot — NOT per-viewer. Returns
// { standings, movementByUid, shouldPersist, newSnapshot, newVersion }.
// The caller persists the new snapshot only when `shouldPersist` is true
// (i.e. the version actually changed) — safe even if multiple viewers do it
// at once, since they'd all compute the same result.
export function calcStandingsWithMovement(league, allUsers, allPredictions, results, specialResults, scoring) {
  const standings = calcStandings(league, allUsers, allPredictions, results, specialResults, scoring);
  const currentVersion = computeResultsVersion(results, specialResults, allPredictions, league.members || []);
  const prevSnapshot = league.standingsSnapshot || null;
  const prevVersion = league.standingsSnapshotVersion || null;

  const currentRanks = {};
  standings.forEach((entry, i) => { currentRanks[entry.uid] = i + 1; });

  const movementByUid = {};
  const versionChanged = currentVersion !== prevVersion;

  standings.forEach((entry, i) => {
    const rank = i + 1;
    const prevRank = prevSnapshot ? prevSnapshot[entry.uid] : null;
    if (!prevSnapshot || prevRank == null || !versionChanged) {
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
    shouldPersist: versionChanged,
    newSnapshot: currentRanks,
    newVersion: currentVersion,
  };
}
