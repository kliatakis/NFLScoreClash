import { REGULAR_SEASON_FIXTURES, SCORABLE_FIXTURES, SPECIAL_PICK_TYPES } from "../data/fixtures.js";

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
// Serializes an object with its keys in sorted order.
//
// Plain JSON.stringify follows insertion order, which for Firestore data can
// legitimately differ between clients holding identical data — two people
// would then compute different "versions" of the same standings, each
// thinking something had changed, and the movement arrows would rotate for
// no reason. Sorting makes the hash depend only on content.
function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

export function computeResultsVersion(results, specialResults, allPredictions, leagueMembers) {
  const overrideMarkers = [];
  for (const uid of leagueMembers) {
    const picks = (allPredictions[uid] || {}).picks || {};
    for (const fid of Object.keys(picks)) {
      if (picks[fid]?.overriddenAt) overrideMarkers.push(`${uid}:${fid}:${picks[fid].overriddenAt}`);
    }
  }
  overrideMarkers.sort();
  const payload = stableStringify(results) + stableStringify(specialResults) + overrideMarkers.join(",");
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

    // SCORABLE_FIXTURES, not just the regular season — playoff picks count
    // towards the table too. Scoring never needs to know who was playing, so
    // playoff placeholders work here even before their matchups are known.
    for (const fixture of SCORABLE_FIXTURES) {
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

// ─── WEEKLY STANDINGS ───────────────────────────────────────────────────────
//
// A per-week race, deliberately separate from the season table. Once someone
// builds a season lead the cumulative standings stop being a contest for
// everyone else; a weekly leaderboard gives every week its own winner.
//
// Only GAME points count here. The preseason division / conference / Super
// Bowl picks aren't tied to any week — folding them in would hand their whole
// value to whichever week they happened to be decided in.
export function calcWeeklyStandings(league, allUsers, allPredictions, results, scoring, week) {
  const members = league?.members || [];
  const fixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week && results[f.id]);

  return members.map(uid => {
    const picks = (allPredictions[uid] || {}).picks || {};
    let points = 0, exact = 0, correct = 0, played = 0;
    for (const f of fixtures) {
      const result = results[f.id];
      points += calcMatchScore(picks[f.id], result, scoring);
      const kind = classifyPick(picks[f.id], result);
      if (kind) {
        played++;
        if (kind === "exact") exact++;
        else if (kind === "outcome") correct++;
      }
    }
    return { uid, username: allUsers[uid]?.username || "Unknown", points, exact, correct, played, gamesInWeek: fixtures.length };
  }).sort((a, b) => b.points - a.points || b.exact - a.exact || a.username.localeCompare(b.username));
}

// How many weeks each member has topped. Ties share the win — in a friends
// league "we both won that week" is the right answer, not an arbitrary
// tiebreak on something that's meant to be a bit of fun.
export function weeklyWinTally(league, allUsers, allPredictions, results, scoring) {
  const weeks = completedWeeks(results).slice().sort((a, b) => a - b);
  const byUid = {};
  const perWeek = [];

  for (const week of weeks) {
    const table = calcWeeklyStandings(league, allUsers, allPredictions, results, scoring, week);
    const top = table.length ? table[0].points : 0;
    // Nobody scoring anything isn't a win worth recording.
    const winners = top > 0 ? table.filter(r => r.points === top) : [];
    for (const w of winners) byUid[w.uid] = (byUid[w.uid] || 0) + 1;
    perWeek.push({ week, top, winners: winners.map(w => ({ uid: w.uid, username: w.username })) });
  }
  return { byUid, perWeek: perWeek.reverse(), weeks: weeks.slice().reverse() };
}

// ─── HEAD TO HEAD ───────────────────────────────────────────────────────────
//
// Beating one specific person is the most fun part of a friends league, and
// nothing in the app spoke to that. Compares two members across the season and
// — more interestingly — isolates only the games where they actually picked
// DIFFERENTLY, which is where the bragging rights live.
export function headToHead(uidA, uidB, allUsers, allPredictions, results, scoring) {
  const picksA = (allPredictions[uidA] || {}).picks || {};
  const picksB = (allPredictions[uidB] || {}).picks || {};

  let pointsA = 0, pointsB = 0, exactA = 0, exactB = 0, winsA = 0, winsB = 0;
  const differences = [];

  // SCORABLE_FIXTURES so playoff games count here too — otherwise a head to
  // head could disagree with the season table it's supposed to explain.
  for (const f of SCORABLE_FIXTURES) {
    const result = results[f.id];
    if (!result) continue;

    const sA = calcMatchScore(picksA[f.id], result, scoring);
    const sB = calcMatchScore(picksB[f.id], result, scoring);
    pointsA += sA; pointsB += sB;

    const kA = classifyPick(picksA[f.id], result);
    const kB = classifyPick(picksB[f.id], result);
    if (kA === "exact") exactA++;
    if (kB === "exact") exactB++;

    const pa = picksA[f.id], pb = picksB[f.id];

    // Neither of you picked this one — that's not a difference of opinion,
    // it's two people who both sat it out, and listing it would pad the
    // comparison with games nobody engaged with.
    if (!pa && !pb) continue;

    const samePick = pa && pb
      && Number(pa.homeScore) === Number(pb.homeScore)
      && Number(pa.awayScore) === Number(pb.awayScore);
    if (samePick) continue; // identical picks tell you nothing about either

    if (sA > sB) winsA++;
    else if (sB > sA) winsB++;

    differences.push({
      fixture: f,
      result,
      pickA: pa || null, pickB: pb || null,
      kindA: kA, kindB: kB,
      pointsA: sA, pointsB: sB,
      winner: sA > sB ? "a" : sB > sA ? "b" : "tie",
    });
  }

  return {
    usernameA: allUsers[uidA]?.username || "Unknown",
    usernameB: allUsers[uidB]?.username || "Unknown",
    pointsA, pointsB, exactA, exactB, winsA, winsB,
    differences: differences.reverse(), // most recent first
  };
}

// ─── DASHBOARD HIGHLIGHTS ───────────────────────────────────────────────────
// Fun "announcement board" callouts for the most recently completed week —
// not the whole season, so the card stays a fixed, current-feeling size
// instead of growing forever. Three categories:
//   fire   — someone nailed the exact final score (always shown, no threshold)
//   upsets — only a handful of people called the winner correctly
//   clowns — only a handful of people got it wrong (it was "obvious")
//
// "A handful" is a COUNT that scales with league size, not a percentage.
// A percentage rule (this was 5%, then 10%) is mathematically dead for small
// leagues: one person can only be ≤10% once ten people have picked, so
// nothing ever fired for a group of friends. Counts work at every size:
//
//   up to 10 pickers  → 1 person
//   11–19 pickers     → up to 2
//   20 or more        → up to 3
//
// Counted against people who actually picked THAT game, not total league
// membership — otherwise a big league where only four people bothered would
// need two of them, which isn't rare at all.
function calloutLimit(totalPickers) {
  if (totalPickers <= 10) return 1;
  if (totalPickers < 20) return 2;
  return 3;
}

// Below this many league members the board is switched off entirely.
// In a two- or three-person league almost every game is either unanimous
// (nothing to say) or a near-even split, so callouts would be either silent
// or relentless — and "you were the only one who got it wrong" lands very
// differently when "everyone else" means one other person.
const MIN_LEAGUE_SIZE_FOR_HIGHLIGHTS = 5;

// Safety valve, not a normal constraint. Simulating thousands of weeks against
// realistic pick behaviour puts a typical week at roughly 2–4 callouts per
// category, comfortably under this — but the tail reaches 9 or 10, which would
// push the standings well down the page. Capping keeps the card a sane size in
// those rare weeks and does nothing at all the rest of the time. Kept in
// schedule order, so it's the earliest games of the week that survive.
const MAX_CALLOUTS_PER_CATEGORY = 8;

// True once at least one week of the season has been played out in full —
// i.e. every fixture in some week has a result.
//
// Gates the standings podium. Before that point everyone is on zero and the
// "top three" is just whatever order the member list happens to be in, so a
// podium would be actively misleading rather than celebratory. Phrased as
// "any complete week" rather than "week 1 specifically" so it still behaves
// sensibly for a league that starts partway through the season.
export function hasCompletedWeek(results) {
  const byWeek = new Map();
  for (const f of REGULAR_SEASON_FIXTURES) {
    if (!byWeek.has(f.week)) byWeek.set(f.week, []);
    byWeek.get(f.week).push(f);
  }
  for (const fixtures of byWeek.values()) {
    if (fixtures.length > 0 && fixtures.every(f => results[f.id])) return true;
  }
  return false;
}

// Every week that has at least one result in, newest first — powers the week
// picker on the highlights board so past weeks stay reachable instead of
// being lost the moment a new week starts.
export function completedWeeks(results) {
  const weeks = new Set(REGULAR_SEASON_FIXTURES.filter(f => results[f.id]).map(f => f.week));
  return [...weeks].sort((a, b) => b - a);
}

export function computeHighlights(league, allUsers, allPredictions, results, forWeek = null) {
  const members = league?.members || [];
  const empty = { week: null, weeks: [], fire: [], upsets: [], clowns: [], hiddenCount: 0 };

  // Whole board off for small leagues — keyed on league SIZE, unlike the
  // callout thresholds above which key on how many people picked a given game.
  if (members.length < MIN_LEAGUE_SIZE_FOR_HIGHLIGHTS) return empty;

  const weeksWithResults = completedWeeks(results);
  if (weeksWithResults.length === 0) return empty;

  // Default to the most recent week, but honour an explicit choice.
  const week = forWeek != null && weeksWithResults.includes(forWeek) ? forWeek : weeksWithResults[0];
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
    const limit = calloutLimit(total);

    // Beyond being few, the highlighted group must be a genuine MINORITY.
    // Without that, a two-person league splitting 1–1 on a game would fire
    // both an upset (one person right) and a clown (one person wrong) for the
    // same game, every time they disagreed. A 1–1 split isn't an upset — it's
    // a coin flip, and now produces nothing.
    if (correct.length > 0 && correct.length <= limit && correct.length < incorrect.length) {
      upsets.push({ fixture, users: correct.map(p => p.username) });
    }
    if (incorrect.length > 0 && incorrect.length <= limit && incorrect.length < correct.length) {
      clowns.push({ fixture, users: incorrect.map(p => p.username) });
    }
  }

  // Trim to the cap, but report how much was left out rather than silently
  // swallowing it — a week busy enough to hit this is worth acknowledging.
  const hiddenCount =
    Math.max(0, fire.length - MAX_CALLOUTS_PER_CATEGORY) +
    Math.max(0, upsets.length - MAX_CALLOUTS_PER_CATEGORY) +
    Math.max(0, clowns.length - MAX_CALLOUTS_PER_CATEGORY);

  return {
    week,
    weeks: weeksWithResults,
    fire: fire.slice(0, MAX_CALLOUTS_PER_CATEGORY),
    upsets: upsets.slice(0, MAX_CALLOUTS_PER_CATEGORY),
    clowns: clowns.slice(0, MAX_CALLOUTS_PER_CATEGORY),
    hiddenCount,
  };
}
