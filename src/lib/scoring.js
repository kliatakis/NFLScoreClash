import { REGULAR_SEASON_FIXTURES, SCORABLE_FIXTURES, SPECIAL_PICK_TYPES } from "../data/fixtures.js";

// ─── SCORING SETTINGS ───────────────────────────────────────────────────────
//
// The game is winner-only: you pick who wins (or a tie), nothing else. Exact
// scoreline prediction was removed deliberately — it was the slowest thing to
// enter and the least skilful thing to get right (calling 24–17 exactly is
// close to a lottery even for people who know football). The week accuracy
// bonuses below replace it with something that rewards judgement instead.
export const DEFAULT_SCORING = {
  correctPoints: 1,     // correct winner on a single game
  // Calling a tie is worth more because ties barely happen — roughly one or
  // two a season across 272 games. Backing one is a real call, not a coin
  // flip, so it pays like a small bonus rather than a normal pick.
  tiePoints: 5,
  // Week accuracy bonuses. Defined by MISSES, not by a fixed score like
  // "15 of 16" — weeks range from 13 to 16 games because of byes, so an
  // absolute target would be unreachable in half the season.
  sweepBonus: 8,        // every game in the week correct
  nearPerfectBonus: 5,  // exactly one miss
  sharpBonus: 3,        // exactly two misses
  divisionPoints: 5,    // correct division winner pick
  conferencePoints: 7,  // correct AFC/NFC champion pick
  superbowlPoints: 10,  // correct Super Bowl champion pick
};

export function getScoringSettings(league) {
  const s = league?.settings || {};
  return {
    // `outcomePoints` is the pre-winner-only name for the same thing; read it
    // as a fallback so leagues created before the change keep their setting.
    correctPoints: Number(s.correctPoints ?? s.outcomePoints ?? DEFAULT_SCORING.correctPoints),
    tiePoints: Number(s.tiePoints ?? DEFAULT_SCORING.tiePoints),
    sweepBonus: Number(s.sweepBonus ?? DEFAULT_SCORING.sweepBonus),
    nearPerfectBonus: Number(s.nearPerfectBonus ?? DEFAULT_SCORING.nearPerfectBonus),
    sharpBonus: Number(s.sharpBonus ?? DEFAULT_SCORING.sharpBonus),
    divisionPoints: Number(s.divisionPoints ?? DEFAULT_SCORING.divisionPoints),
    conferencePoints: Number(s.conferencePoints ?? DEFAULT_SCORING.conferencePoints),
    superbowlPoints: Number(s.superbowlPoints ?? DEFAULT_SCORING.superbowlPoints),
  };
}

// ─── WEEK ACCURACY BADGES ───────────────────────────────────────────────────
// Earned per week, kept for the season. Ordered best-first.
export const WEEK_BADGES = [
  { id: "sweep",   misses: 0, label: "Clean Sweep",  icon: "🧹", bonusKey: "sweepBonus",       blurb: "every game correct" },
  { id: "near",    misses: 1, label: "Near Perfect", icon: "🎯", bonusKey: "nearPerfectBonus", blurb: "one miss" },
  { id: "sharp",   misses: 2, label: "Sharp Week",   icon: "💎", bonusKey: "sharpBonus",       blurb: "two misses" },
];

export function generateCode(len = 6) {
  return Math.random().toString(36).substring(2, 2 + len).toUpperCase();
}

// ─── GAME SCORING ───────────────────────────────────────────────────────────

// Which side a pick backs: "H" home, "A" away, "T" tie, or null if there's no
// pick at all.
//
// Also understands the old scoreline format, so predictions saved before the
// switch to winner-only still resolve to a side instead of silently becoming
// unscoreable. Costs three lines and avoids stranding existing data.
export function pickWinner(pick) {
  if (!pick) return null;
  if (pick.winner === "H" || pick.winner === "A" || pick.winner === "T") return pick.winner;
  const { homeScore: h, awayScore: a } = pick;
  if (h == null || a == null) return null;
  return Number(h) > Number(a) ? "H" : Number(a) > Number(h) ? "A" : "T";
}

export function resultWinner(result) {
  if (!result) return null;
  const { homeScore: h, awayScore: a } = result;
  if (h == null || a == null) return null;
  return Number(h) > Number(a) ? "H" : Number(a) > Number(h) ? "A" : "T";
}

// "correct", "wrong", or null when there's nothing to judge yet.
//
// Deliberately separate from the points it earns. Inferring what happened from
// how many points were awarded breaks the moment two settings share a value —
// a league with Correct Winner set to 0 would make right and wrong picks
// indistinguishable. Classify first, price second.
export function classifyPick(pick, result) {
  const picked = pickWinner(pick);
  const actual = resultWinner(result);
  if (!picked || !actual) return null;
  return picked === actual ? "correct" : "wrong";
}

// Correctly calling a tie pays `tiePoints` instead of `correctPoints`. Priced
// off the RESULT, not the pick, so backing a tie in a game that ended 24–17 is
// simply wrong and pays nothing — there's no partial credit for being brave.
export function calcMatchScore(pick, result, scoring = DEFAULT_SCORING) {
  if (classifyPick(pick, result) !== "correct") return 0;
  return resultWinner(result) === "T"
    ? Number(scoring.tiePoints ?? DEFAULT_SCORING.tiePoints)
    : scoring.correctPoints;
}

// ─── WEEK ACCURACY BONUS ────────────────────────────────────────────────────
//
// Two rules matter here:
//
//  1. Measured in MISSES, not a fixed hit count. Weeks run 13–16 games, so
//     "15 of 16" would be unreachable in the nine short weeks of the season.
//     A clean sweep is every game in THAT week.
//  2. You must have picked the whole week. Otherwise you could pick only the
//     three games you were sure of, go three-for-three, and claim a sweep.
//
// Regular season only — the playoff rounds are 6, 4, 2 and 1 games, and a
// "clean sweep" of a one-game round is meaningless.
export function weekAccuracyBadge(uid, week, allPredictions, results, scoring = DEFAULT_SCORING) {
  // The week has to be FINISHED, not merely started.
  //
  // Judging only the games played so far meant the bonus landed on Thursday
  // night: one game in, you called it, and you were "16 from 16" of what had
  // been played — badge, points, and an announcement-board shoutout. Sunday
  // then took it all away again. Points that appear and vanish mid-week are
  // worse than points that arrive late, so nothing is awarded until every
  // game in the week has a result.
  const fixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week);
  if (fixtures.length === 0 || !fixtures.every(f => results[f.id])) return null;

  const picks = (allPredictions[uid] || {}).picks || {};
  let misses = 0;
  for (const f of fixtures) {
    const kind = classifyPick(picks[f.id], results[f.id]);
    if (kind === null) return null;      // an unpicked game disqualifies the week
    if (kind === "wrong") misses++;
    if (misses > 2) return null;         // beyond the lowest tier, stop early
  }

  const badge = WEEK_BADGES.find(b => b.misses === misses);
  if (!badge) return null;
  return { ...badge, week, points: Number(scoring[badge.bonusKey] ?? 0), games: fixtures.length };
}

// Every accuracy badge a member has earned this season, newest week first.
export function weekAccuracyBadges(uid, allPredictions, results, scoring = DEFAULT_SCORING) {
  return finishedWeeks(results)
    .map(week => weekAccuracyBadge(uid, week, allPredictions, results, scoring))
    .filter(Boolean);
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
export function calcStandings(league, allUsers, allPredictions, results, specialResults, scoring = DEFAULT_SCORING) {
  const members = league.members || [];

  // Weekly wins ("gold medals") feed tiebreaker #4, so the whole tally is
  // computed ONCE here rather than per member — it walks every completed week
  // and would otherwise be recomputed once for each person in the league.
  const medalsByUid = weeklyWinTally(league, allUsers, allPredictions, results, scoring).byUid;

  return members.map(uid => {
    const user = allUsers[uid];
    const preds = allPredictions[uid] || {};
    const picks = preds.picks || {};
    const specials = preds.specials || {};

    let points = 0, correct = 0, gamesScored = 0;

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
        if (kind === "correct") correct++;
      }
    }

    // Week accuracy bonuses (regular season only, full week required).
    const badges = weekAccuracyBadges(uid, allPredictions, results, scoring);
    const bonusPoints = badges.reduce((sum, b) => sum + b.points, 0);
    points += bonusPoints;

    // Broken out per pick-type (not just a lumped `specialCorrect` total) so
    // the tiebreaker order below — Super Bowl, then conference, then
    // division — can compare each level independently.
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
      points, correct, gamesScored, specialCorrect,
      superbowlCorrect, conferenceCorrect, divisionCorrect,
      badges, bonusPoints,
      // Tiebreaker inputs #4–#7, counted here so the sort below stays a plain
      // comparison and the UI can show the same numbers it's being ranked on.
      medals: medalsByUid[uid] || 0,
      sweepWeeks: badges.filter(b => b.id === "sweep").length,
      nearWeeks: badges.filter(b => b.id === "near").length,
      sharpWeeks: badges.filter(b => b.id === "sharp").length,
    };
  }).sort((a, b) =>
    // Tiebreakers run hardest-to-fluke first: one Super Bowl call, then the
    // two conference picks, then the eight division picks, then sustained
    // week-by-week form (medals, then each accuracy tier in turn).
    b.points - a.points ||
    b.superbowlCorrect - a.superbowlCorrect ||
    b.conferenceCorrect - a.conferenceCorrect ||
    b.divisionCorrect - a.divisionCorrect ||
    b.medals - a.medals ||
    b.sweepWeeks - a.sweepWeeks ||
    b.nearWeeks - a.nearWeeks ||
    b.sharpWeeks - a.sharpWeeks ||
    // Last resort, so two players who match on all seven still get a stable
    // order instead of one that flips between renders.
    b.correct - a.correct
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
  if (a.medals !== b.medals) {
    return `Ahead of ${b.username} on tiebreaker #4: won ${a.medals} game week${a.medals === 1 ? "" : "s"} 🏅 vs ${b.medals}.`;
  }
  if (a.sweepWeeks !== b.sweepWeeks) {
    return `Ahead of ${b.username} on tiebreaker #5: ${a.sweepWeeks} Clean Sweep week${a.sweepWeeks === 1 ? "" : "s"} 🧹 vs ${b.sweepWeeks}.`;
  }
  if (a.nearWeeks !== b.nearWeeks) {
    return `Ahead of ${b.username} on tiebreaker #6: ${a.nearWeeks} Near Perfect week${a.nearWeeks === 1 ? "" : "s"} 🎯 vs ${b.nearWeeks}.`;
  }
  if (a.sharpWeeks !== b.sharpWeeks) {
    return `Ahead of ${b.username} on tiebreaker #7: ${a.sharpWeeks} Sharp Week${a.sharpWeeks === 1 ? "" : "s"} 💎 vs ${b.sharpWeeks}.`;
  }
  if (a.correct !== b.correct) {
    return `Ahead of ${b.username} on tiebreaker #8: ${a.correct} correct pick${a.correct === 1 ? "" : "s"} vs ${b.correct}.`;
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
export function calcStandingsWithMovement(league, allUsers, allPredictions, results, specialResults, scoring = DEFAULT_SCORING) {
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
export function calcWeeklyStandings(league, allUsers, allPredictions, results, scoring = DEFAULT_SCORING, week) {
  const members = league?.members || [];
  const fixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week && results[f.id]);

  return members.map(uid => {
    const picks = (allPredictions[uid] || {}).picks || {};
    let points = 0, correct = 0, played = 0;
    for (const f of fixtures) {
      const result = results[f.id];
      points += calcMatchScore(picks[f.id], result, scoring);
      const kind = classifyPick(picks[f.id], result);
      if (kind) {
        played++;
        if (kind === "correct") correct++;
      }
    }
    // The week's accuracy bonus belongs in the week's total — it's earned by
    // this week's picks and nothing else.
    const badge = weekAccuracyBadge(uid, week, allPredictions, results, scoring);
    if (badge) points += badge.points;

    return {
      uid, username: allUsers[uid]?.username || "Unknown",
      points, correct, played, gamesInWeek: fixtures.length, badge,
    };
  }).sort((a, b) => b.points - a.points || b.correct - a.correct || a.username.localeCompare(b.username));
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

// ─── SEASON PROGRESSION ─────────────────────────────────────────────────────
//
// Cumulative points per player, week by week — the shape of the season rather
// than just its current total. A table tells you who's ahead; this shows you
// the surge, the collapse, and the week somebody made their move.
//
// GAME points only, like the weekly race. The season-long division /
// conference / Super Bowl picks aren't tied to a week, so folding them in
// would put an unexplained cliff in everyone's line on whatever date they
// happened to be decided.
export function calcSeasonProgression(league, allUsers, allPredictions, results, scoring) {
  const members = league?.members || [];
  const weeks = completedWeeks(results).slice().sort((a, b) => a - b);
  if (weeks.length === 0) return { weeks: [], series: [], maxPoints: 0 };

  const series = members.map(uid => {
    const picks = (allPredictions[uid] || {}).picks || {};
    let running = 0;
    const points = weeks.map(week => {
      for (const f of REGULAR_SEASON_FIXTURES) {
        if (f.week !== week) continue;
        const result = results[f.id];
        if (!result) continue;
        running += calcMatchScore(picks[f.id], result, scoring);
      }
      return running;
    });
    return { uid, username: allUsers[uid]?.username || "Unknown", points, total: running };
  }).sort((a, b) => b.total - a.total);

  const maxPoints = Math.max(1, ...series.map(s => s.total));
  return { weeks, series, maxPoints };
}

// ─── WEEKLY RECAP ───────────────────────────────────────────────────────────
//
// The story of a week in a handful of facts: who won it, how the field did,
// who moved, and which game caused the most damage.
export function computeWeeklyRecap(league, allUsers, allPredictions, results, scoring = DEFAULT_SCORING, forWeek = null) {
  const weeks = completedWeeks(results);
  if (weeks.length === 0) return null;
  const week = forWeek != null && weeks.includes(forWeek) ? forWeek : weeks[0];

  const table = calcWeeklyStandings(league, allUsers, allPredictions, results, scoring, week);
  if (table.length === 0) return null;

  const topPoints = table[0].points;
  const winners = topPoints > 0 ? table.filter(r => r.points === topPoints) : [];
  // How many people earned any accuracy badge this week — the winner-only
  // replacement for the old "exact scores" headline figure.
  const badgeEarners = table.filter(r => r.badge);
  const sweepCount = table.filter(r => r.badge?.id === "sweep").length;

  // Averaged over people who actually PLAYED that week, not the whole roster.
  // Counting members who never made a pick drags the figure toward zero — in
  // a league where a couple of people drift off, "league average 24" when
  // everyone who played scored 48 is just wrong.
  const played = table.filter(r => r.played > 0);
  const totalPoints = played.reduce((sum, r) => sum + r.points, 0);
  const average = played.length ? Math.round((totalPoints / played.length) * 10) / 10 : 0;

  // Movement is measured on cumulative game points, comparing the standings
  // as they were before this week with how they are after it.
  const progression = calcSeasonProgression(league, allUsers, allPredictions, results, scoring);
  const idx = progression.weeks.indexOf(week);
  const rankAt = (i) => {
    if (i < 0) return null;
    const snapshot = progression.series
      .map(s => ({ uid: s.uid, username: s.username, points: s.points[i] ?? 0 }))
      .sort((a, b) => b.points - a.points);
    const ranks = {};
    snapshot.forEach((s, n) => { ranks[s.uid] = n + 1; });
    return ranks;
  };
  const after = rankAt(idx);
  const before = rankAt(idx - 1);

  let riser = null, faller = null;
  if (before && after) {
    for (const s of progression.series) {
      const delta = (before[s.uid] ?? 0) - (after[s.uid] ?? 0); // + = climbed
      if (delta > 0 && (!riser || delta > riser.delta)) riser = { username: s.username, uid: s.uid, delta };
      if (delta < 0 && (!faller || delta < faller.delta)) faller = { username: s.username, uid: s.uid, delta: -delta };
    }
  }

  // Which games the league found hardest and easiest — measured only among
  // people who actually picked them.
  const members = league?.members || [];
  const games = [];
  for (const f of REGULAR_SEASON_FIXTURES) {
    if (f.week !== week || !results[f.id]) continue;
    let picked = 0, right = 0;
    for (const uid of members) {
      const kind = classifyPick((allPredictions[uid] || {}).picks?.[f.id], results[f.id]);
      if (!kind) continue;
      picked++;
      if (kind !== "wrong") right++;
    }
    if (picked > 0) games.push({ fixture: f, result: results[f.id], picked, right, pct: right / picked });
  }
  games.sort((a, b) => a.pct - b.pct);
  const toughest = games.length ? games[0] : null;
  const easiest = games.length ? games[games.length - 1] : null;

  return {
    week, weeks,
    winners, topPoints, average,
    badgeEarners, sweepCount,
    riser, faller,
    toughest: toughest && toughest.pct < 1 ? toughest : null,   // only if someone missed it
    easiest: easiest && easiest.pct === 1 && games.length > 1 ? easiest : null,
    gamesPlayed: games.length,
    players: table.length,
    playedCount: played.length,   // how many actually entered picks
  };
}

// ─── HEAD TO HEAD ───────────────────────────────────────────────────────────
//
// Beating one specific person is the most fun part of a friends league, and
// nothing in the app spoke to that. Compares two members across the season and
// — more interestingly — isolates only the games where they actually picked
// DIFFERENTLY, which is where the bragging rights live.
export function headToHead(uidA, uidB, allUsers, allPredictions, results, scoring = DEFAULT_SCORING) {
  const picksA = (allPredictions[uidA] || {}).picks || {};
  const picksB = (allPredictions[uidB] || {}).picks || {};

  let pointsA = 0, pointsB = 0, correctA = 0, correctB = 0, winsA = 0, winsB = 0;
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
    if (kA === "correct") correctA++;
    if (kB === "correct") correctB++;

    const pa = picksA[f.id], pb = picksB[f.id];

    // Neither of you picked this one — that's not a difference of opinion,
    // it's two people who both sat it out, and listing it would pad the
    // comparison with games nobody engaged with.
    if (!pa && !pb) continue;

    // Compared by SIDE, not by scoreline. Under winner-only picks the old
    // scoreline comparison was always false, so every game showed up as a
    // "difference" — including ones where you both backed the same team.
    const samePick = pa && pb && pickWinner(pa) === pickWinner(pb);
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
    pointsA, pointsB, correctA, correctB, winsA, winsB,
    differences: differences.reverse(), // most recent first
  };
}

// ─── DASHBOARD HIGHLIGHTS ───────────────────────────────────────────────────
// Fun "announcement board" callouts for the most recently completed week —
// not the whole season, so the card stays a fixed, current-feeling size
// instead of growing forever. Three categories:
//   sweeps — earned a week accuracy badge (replaced the old exact-score 🔥,
//            which no longer exists now the game is winner-only)
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
// Weeks with AT LEAST ONE result — i.e. weeks there's something to show.
// Drives the week selectors, the recap and the highlights board, all of which
// should come alive as soon as the first game is in.
export function completedWeeks(results) {
  const weeks = new Set(REGULAR_SEASON_FIXTURES.filter(f => results[f.id]).map(f => f.week));
  return [...weeks].sort((a, b) => b - a);
}

// Weeks where EVERY game has a result. Stricter, and used only for the week
// accuracy bonuses — see weekAccuracyBadge for why they can't be settled while
// games are still outstanding.
export function finishedWeeks(results) {
  const byWeek = new Map();
  for (const f of REGULAR_SEASON_FIXTURES) {
    if (!byWeek.has(f.week)) byWeek.set(f.week, []);
    byWeek.get(f.week).push(f);
  }
  return [...byWeek.entries()]
    .filter(([, fixtures]) => fixtures.every(f => results[f.id]))
    .map(([week]) => week)
    .sort((a, b) => b - a);
}

export function computeHighlights(league, allUsers, allPredictions, results, forWeek = null, scoring = DEFAULT_SCORING) {
  const members = league?.members || [];
  const empty = { week: null, weeks: [], sweeps: [], upsets: [], clowns: [], hiddenCount: 0 };

  const weeksWithResults = completedWeeks(results);
  if (weeksWithResults.length === 0) return empty;

  // Default to the most recent week, but honour an explicit choice.
  const week = forWeek != null && weeksWithResults.includes(forWeek) ? forWeek : weeksWithResults[0];
  const weekFixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week && results[f.id]);

  // ── Badge shoutouts, grouped by tier ─────────────────────────────────────
  // These are INDIVIDUAL achievements — you either got the week nearly right
  // or you didn't — so unlike the upset/clown callouts they make sense at any
  // league size and aren't gated below. Grouped by tier so three people
  // earning a Sharp Week produce one line, not three.
  const earners = members
    .map(uid => {
      const badge = weekAccuracyBadge(uid, week, allPredictions, results, scoring);
      return badge ? { uid, username: allUsers[uid]?.username || "Unknown", badge } : null;
    })
    .filter(Boolean);

  const sweeps = WEEK_BADGES
    .map(tier => {
      const got = earners.filter(e => e.badge.id === tier.id);
      return got.length ? { badge: got[0].badge, users: got.map(g => g.username) } : null;
    })
    .filter(Boolean);

  const upsets = [], clowns = [];

  // Upset and clown callouts DO need a crowd — "you were the only one who got
  // it wrong" means very little when everyone else is one other person — so
  // only these are gated on league size.
  if (members.length < MIN_LEAGUE_SIZE_FOR_HIGHLIGHTS) {
    return { week, weeks: weeksWithResults, sweeps, upsets, clowns, hiddenCount: 0 };
  }

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
        isCorrect: kind === "correct",
      });
    }
    const total = made.length;
    if (total === 0) continue;

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
    Math.max(0, sweeps.length - MAX_CALLOUTS_PER_CATEGORY) +
    Math.max(0, upsets.length - MAX_CALLOUTS_PER_CATEGORY) +
    Math.max(0, clowns.length - MAX_CALLOUTS_PER_CATEGORY);

  return {
    week,
    weeks: weeksWithResults,
    sweeps: sweeps.slice(0, MAX_CALLOUTS_PER_CATEGORY),
    upsets: upsets.slice(0, MAX_CALLOUTS_PER_CATEGORY),
    clowns: clowns.slice(0, MAX_CALLOUTS_PER_CATEGORY),
    hiddenCount,
  };
}
