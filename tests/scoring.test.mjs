// ScoreClash scoring regression suite.
//
// Plain Node, no test framework — run it with:  npm test
// Exits non-zero if anything fails, so it works as a pre-deploy check.
//
// It imports the REAL source, not a copy, so it fails when the rules change
// underneath it. Everything here is a rule someone could plausibly break by
// accident; several of these assertions exist because that already happened.

import {
  REGULAR_SEASON_FIXTURES, PLAYOFF_FIXTURES, PLAYOFF_ROUNDS, PRESEASON_FIXTURES,
  SCORABLE_FIXTURES, SPECIAL_PICK_TYPES, SEASON, effectiveKickoffUTC,
  isPlayoffMatchupReady, isPreseasonFixture, PRESEASON_WEEKS, preseasonFixturesForWeek,
  fixturesForWeek, isTrialWeek, weekLabel, weekShortLabel, compareWeekKeys, TRIAL_WEEK_KEYS,
} from "../src/data/fixtures.js";
import { AVATAR_GROUPS, PRESET_AVATARS } from "../src/data/avatars.js";
import {
  DEFAULT_SCORING, getScoringSettings, pickWinner, resultWinner, classifyPick,
  calcMatchScore, weekAccuracyBadge, calcStandings, calcWeeklyStandings,
  computeWeeklyRecap, computeHighlights, headToHead, weeklyWinTally,
  calcSeasonProgression, explainTiebreak, finishedWeeks, completedWeeks, describeBonuses,
  pickStreaks, liveWeekStatus, pendingPickers, nextOpenWeek, currentWeekByDate, openPickWeeks, weekPickState,
  finishedTrialWeeks, allFinishedWeeks, allCompletedWeeks,
} from "../src/lib/scoring.js";
import { TEAMS, TEAM_CODES, teamsForSpecialPick } from "../src/data/teams.js";
import { css } from "../src/theme.js";
import {
  buildBackup, validateBackup, planRestore, describePlan, backupFilename, BACKUP_VERSION, BACKUP_APP, RESTORABLE,
} from "../src/lib/backup.js";
import { planResultWrites, findFixture } from "../src/lib/resultsMatching.js";
import { assessFetchHealth, describeAge } from "../src/lib/fetchHealth.js";
import { computeSeasonAwards, isSeasonComplete } from "../src/lib/awards.js";
import { espnDateRange } from "../src/lib/resultsProviders.js";
import {
  SOLO_MISS, GROUP_MISS, LONE_CALL, SWEEP_LINES, NEAR_LINES, SHARP_LINES,
} from "../src/data/roasts.js";
import { hashSeed, pickLine, templateParts, fillTemplate, usablePool } from "../src/lib/shoutouts.js";
import { planUndo, undoTargetOf, hasUndoDetail, NOT_UNDOABLE } from "../src/lib/undo.js";
import {
  csvEscape, toCsv, buildStandingsCsv, buildPicksCsv, buildSeasonPicksCsv, csvFilename,
} from "../src/lib/csv.js";
import {
  shouldRefresh, gamesInProgress, REFRESH_THROTTLE_MS, IN_PROGRESS_WINDOW_MS,
} from "../src/lib/liveRefresh.js";
import {
  AUDIT_VERSION, AUDIT_KINDS, AUDIT_GROUPS, makeEntry, isValidEntry, entryVisibleTo,
  filterEntries, groupByDay, dayLabel, resultKind, resultSummary, fixtureText, scoreText,
  pickSideText, overrideSummary, scoringDiff, scoringSummary,
} from "../src/lib/auditLog.js";

let failures = 0, total = 0;
const group = (name) => console.log(`\n── ${name} `.padEnd(64, "─"));
const t = (name, cond, detail = "") => {
  total++;
  if (!cond) failures++;
  console.log(`${cond ? "  ok  " : "  FAIL"}  ${name}${detail ? `   [${detail}]` : ""}`);
};

const SC = DEFAULT_SCORING;
const week = (w) => REGULAR_SEASON_FIXTURES.filter(f => f.week === w);
const SB = SPECIAL_PICK_TYPES.find(x => x.kind === "superbowl");
const CONF = SPECIAL_PICK_TYPES.filter(x => x.kind === "conference");
const DIV = SPECIAL_PICK_TYPES.filter(x => x.kind === "division");

// Builds a league where each player's weeks are shaped by a miss count.
// plan = { [weekNumber]: missesThatWeek }; omit a week to skip it entirely.
function scenario(plans, specials = {}) {
  const uids = Object.keys(plans);
  const league = { members: uids, name: "Test League" };
  const users = Object.fromEntries(uids.map(u => [u, { username: u.toUpperCase() }]));
  const preds = Object.fromEntries(uids.map(u => [u, { picks: {}, specials: specials[u] || {} }]));
  const results = {};
  const weeks = new Set(uids.flatMap(u => Object.keys(plans[u]).map(Number)));
  for (const wk of weeks) {
    const fixtures = week(wk);
    fixtures.forEach(f => { results[f.id] = { homeScore: 24, awayScore: 10 }; }); // home wins all
    for (const uid of uids) {
      const misses = plans[uid][wk];
      if (misses == null) continue;
      fixtures.forEach((f, i) => { preds[uid].picks[f.id] = { winner: i < misses ? "A" : "H" }; });
    }
  }
  return { league, users, preds, results };
}

// ────────────────────────────────────────────────────────────────────────────
group("Ties");
t("20–20 reads as a tie", resultWinner({ homeScore: 20, awayScore: 20 }) === "T");
t("0–0 reads as a tie, not 'no result'", resultWinner({ homeScore: 0, awayScore: 0 }) === "T");
t("calling a tie correctly is correct", classifyPick({ winner: "T" }, { homeScore: 20, awayScore: 20 }) === "correct");
t("calling a tie on a decided game is wrong", classifyPick({ winner: "T" }, { homeScore: 21, awayScore: 20 }) === "wrong");
t("a correct tie pays tiePoints", calcMatchScore({ winner: "T" }, { homeScore: 20, awayScore: 20 }, SC) === SC.tiePoints);
t("a correct winner pays correctPoints", calcMatchScore({ winner: "H" }, { homeScore: 21, awayScore: 20 }, SC) === SC.correctPoints);
t("a wrong tie call pays nothing", calcMatchScore({ winner: "T" }, { homeScore: 21, awayScore: 20 }, SC) === 0);
t("tie premium is configurable", getScoringSettings({ settings: { tiePoints: 12 } }).tiePoints === 12);
t("tiePoints defaults to 5 when unset", getScoringSettings({ settings: {} }).tiePoints === 5);

// ────────────────────────────────────────────────────────────────────────────
group("Malformed input never throws or scores");
for (const [pick, label] of [[null, "null"], [undefined, "undefined"], [{}, "empty object"],
  [{ winner: null }, "null winner"], [{ winner: "X" }, "bad code"], [{ winner: "" }, "empty string"]]) {
  t(`${label} is treated as no pick`, pickWinner(pick) === null
    && classifyPick(pick, { homeScore: 1, awayScore: 0 }) === null);
}
t("no result yet is null, not 'wrong'", classifyPick({ winner: "H" }, undefined) === null);
t("half-entered result is null", classifyPick({ winner: "H" }, { homeScore: 7 }) === null);

// ────────────────────────────────────────────────────────────────────────────
group("Week accuracy bonuses");
const sizes = {};
for (let w = 1; w <= 18; w++) sizes[w] = week(w).length;
const shortWeeks = Object.entries(sizes).filter(([, c]) => c < 16).map(([w]) => Number(w));
t("bye weeks make some weeks shorter than 16", shortWeeks.length > 0, `${shortWeeks.length} short weeks`);
for (const wk of [1, shortWeeks[0]]) {
  const g = scenario({ a: { [wk]: 0 } });
  const badge = weekAccuracyBadge("a", wk, g.preds, g.results, SC);
  t(`week ${wk} (${week(wk).length} games): no misses earns a sweep`,
    badge?.id === "sweep" && badge.games === week(wk).length);
}
for (const [misses, id] of [[1, "near"], [2, "sharp"]]) {
  const g = scenario({ a: { 1: misses } });
  t(`${misses} miss(es) earns ${id}`, weekAccuracyBadge("a", 1, g.preds, g.results, SC)?.id === id);
}
{
  const g = scenario({ a: { 1: 3 } });
  t("three misses earn nothing", weekAccuracyBadge("a", 1, g.preds, g.results, SC) === null);
}
{ // must have picked the whole week
  const g = scenario({ a: { 1: 0 } });
  for (const f of week(1).slice(3)) delete g.preds.a.picks[f.id];
  t("going 3-for-3 out of 16 earns nothing", weekAccuracyBadge("a", 1, g.preds, g.results, SC) === null);
}
{ // REGRESSION: bonuses must not settle while the week is still being played
  const g = scenario({ a: { 1: 0 } });
  for (const f of week(1).slice(4)) delete g.results[f.id];
  t("a week in progress awards no badge", weekAccuracyBadge("a", 1, g.preds, g.results, SC) === null);
  t("...and no phantom bonus points", calcStandings(g.league, g.users, g.preds, g.results, {}, SC)[0].bonusPoints === 0);
  t("...and no announcement-board shoutout", computeHighlights(g.league, g.users, g.preds, g.results, null, SC).sweeps.length === 0);
  t("finishedWeeks excludes it", finishedWeeks(g.results).length === 0);
  t("completedWeeks still includes it (there IS something to show)", completedWeeks(g.results).length === 1);
  const done = scenario({ a: { 1: 0 } });
  t("once the last game lands the bonus appears",
    calcStandings(done.league, done.users, done.preds, done.results, {}, SC)[0].bonusPoints === SC.sweepBonus);
}
{ // playoffs score points but never a week bonus
  const pf = PLAYOFF_FIXTURES[0];
  const league = { members: ["a"] }, users = { a: { username: "A" } };
  const preds = { a: { picks: { [pf.id]: { winner: "H" } }, specials: {} } };
  const results = { [pf.id]: { homeScore: 30, awayScore: 3 } };
  const r = calcStandings(league, users, preds, results, {}, SC)[0];
  t("a playoff pick scores", r.points === SC.correctPoints);
  t("a playoff game earns no week badge", r.badges.length === 0);
}
t("SCORABLE_FIXTURES = regular season + playoffs + the preseason trial",
  SCORABLE_FIXTURES.length
    === REGULAR_SEASON_FIXTURES.length + PLAYOFF_FIXTURES.length + PRESEASON_FIXTURES.length);

// ────────────────────────────────────────────────────────────────────────────
group("Tiebreakers");
const row = (o) => ({ username: o.u, points: o.p ?? 10, superbowlCorrect: o.sb ?? 0,
  conferenceCorrect: o.cf ?? 0, divisionCorrect: o.dv ?? 0, medals: o.md ?? 0,
  sweepWeeks: o.sw ?? 0, nearWeeks: o.nw ?? 0, sharpWeeks: o.sh ?? 0, correct: o.c ?? 0 });
const why = (a, b) => explainTiebreak(row(a), row(b)) || "";

t("#1 Super Bowl pick", /#1.*Super Bowl/.test(why({ u: "A", sb: 1 }, { u: "B", sb: 0 })));
t("#2 conference picks", /#2.*conference/.test(why({ u: "A", cf: 2 }, { u: "B", cf: 1 })));
t("#3 division picks", /#3.*division/.test(why({ u: "A", dv: 5 }, { u: "B", dv: 3 })));
t("#4 game weeks won", /#4.*game week/.test(why({ u: "A", md: 3 }, { u: "B", md: 1 })));
t("#5 Clean Sweeps", /#5.*Clean Sweep/.test(why({ u: "A", sw: 2 }, { u: "B", sw: 1 })));
t("#6 Near Perfects", /#6.*Near Perfect/.test(why({ u: "A", nw: 2 }, { u: "B", nw: 0 })));
t("#7 Sharp Weeks", /#7.*Sharp Week/.test(why({ u: "A", sh: 1 }, { u: "B", sh: 0 })));
t("#8 total correct picks", /#8.*correct pick/.test(why({ u: "A", c: 99 }, { u: "B", c: 98 })));
t("a genuine dead tie explains nothing", explainTiebreak(row({ u: "A" }), row({ u: "B" })) === null);
t("different points is not a tiebreak", explainTiebreak(row({ u: "A", p: 11 }), row({ u: "B", p: 10 })) === null);

t("Super Bowl outranks a bigger medal haul", /#1/.test(why({ u: "A", sb: 1 }, { u: "B", md: 9 })));
t("divisions outrank more sweeps", /#3/.test(why({ u: "A", dv: 2 }, { u: "B", dv: 1, sw: 5 })));
t("medals outrank more sweeps", /#4/.test(why({ u: "A", md: 2 }, { u: "B", md: 1, sw: 4 })));
t("sweeps outrank more near-perfects", /#5/.test(why({ u: "A", sw: 1 }, { u: "B", nw: 6 })));
t("near-perfects outrank more sharps", /#6/.test(why({ u: "A", nw: 1 }, { u: "B", sh: 7 })));

{ // counters actually populated from real data
  const g = scenario({ a: { 1: 0, 2: 1, 3: 2 }, b: { 1: 3 } });
  const st = calcStandings(g.league, g.users, g.preds, g.results, {}, SC);
  const A = st.find(r => r.uid === "a"), B = st.find(r => r.uid === "b");
  t("one sweep, one near, one sharp counted separately",
    A.sweepWeeks === 1 && A.nearWeeks === 1 && A.sharpWeeks === 1);
  t("weeks won counted as medals", A.medals === 3, `medals=${A.medals}`);
  t("bonus points equal the three tiers summed",
    A.bonusPoints === SC.sweepBonus + SC.nearPerfectBonus + SC.sharpBonus);
  t("three misses earns no badge and no medal",
    B.sweepWeeks + B.nearWeeks + B.sharpWeeks === 0 && B.medals === 0);
}
{ // season picks counted per level
  const g = scenario({ a: {}, b: {} }, { a: { [SB.id]: "KC", [CONF[0].id]: "KC" }, b: { [DIV[0].id]: "KC" } });
  const st = calcStandings(g.league, g.users, g.preds, g.results,
    { [SB.id]: "KC", [CONF[0].id]: "KC", [DIV[0].id]: "KC" }, SC);
  t("Super Bowl and conference tracked independently",
    st[0].superbowlCorrect === 1 && st[0].conferenceCorrect === 1);
  t("division tracked independently", st[1].divisionCorrect === 1);
  t("Super Bowl (10) outranks a division pick (5)", st[0].uid === "a");
}

// ────────────────────────────────────────────────────────────────────────────
group("Weekly race, recap and highlights");
{
  const g = scenario({ a: { 1: 0 }, b: { 1: 8 }, c: {} });   // c never played
  const wk = calcWeeklyStandings(g.league, g.users, g.preds, g.results, SC, 1);
  t("week points include the bonus", wk[0].points === week(1).length + SC.sweepBonus);
  t("a member who didn't play scores 0", wk.find(r => r.uid === "c").points === 0);

  const recap = computeWeeklyRecap(g.league, g.users, g.preds, g.results, SC, 1);
  t("average ignores members who didn't play", recap.playedCount === 2, `played ${recap.playedCount}`);
  t("the sweeper wins the week", recap.winners.length === 1 && recap.winners[0].uid === "a");
  t("one bonus earner reported", recap.badgeEarners.length === 1);

  t("chart has one series per member",
    calcSeasonProgression(g.league, g.users, g.preds, g.results, SC).series.length === 3);
  t("only the sweeper is credited with the week",
    weeklyWinTally(g.league, g.users, g.preds, g.results, SC).byUid.a === 1);
}
{
  const g = scenario({ a: { 1: 0 }, b: { 1: 0 } });          // identical perfect weeks
  const tally = weeklyWinTally(g.league, g.users, g.preds, g.results, SC);
  t("a shared week splits the medal", tally.byUid.a === 1 && tally.byUid.b === 1);
  const hi = computeHighlights(g.league, g.users, g.preds, g.results, null, SC);
  t("two sweepers produce ONE grouped shoutout", hi.sweeps.length === 1 && hi.sweeps[0].users.length === 2);
  t("a 2-person league still gets a board", hi.week !== null);
  t("...but no upset/clown callouts at that size", hi.upsets.length === 0 && hi.clowns.length === 0);
}

// ────────────────────────────────────────────────────────────────────────────
group("Head to head");
{
  const g = scenario({ a: { 1: 0 }, b: { 1: 0 } });
  const h = headToHead("a", "b", g.users, g.preds, g.results, SC);
  t("identical picks are not listed as differences", h.differences.length === 0);
  t("correct counts reported", h.correctA === week(1).length && h.correctB === week(1).length);
  t("the removed exact-score field is gone", h.exactA === undefined);
}
{
  const g = scenario({ a: { 1: 0 }, b: { 1: 1 } });
  const h = headToHead("a", "b", g.users, g.preds, g.results, SC);
  t("a genuine disagreement is listed", h.differences.length === 1);
  t("it is priced to whoever was right", h.differences[0].pointsA > h.differences[0].pointsB);
}

// ────────────────────────────────────────────────────────────────────────────
group("Bonus breakdown (standings tooltip)");
{
  // One sweep, one near, one sharp — no ties involved.
  const g = scenario({ a: { 1: 0, 2: 1, 3: 2 } });
  const A = calcStandings(g.league, g.users, g.preds, g.results, {}, SC)[0];
  const lines = describeBonuses(A);
  console.log("        " + lines.join("\n        "));
  t("one line per tier earned", lines.length === 3);
  t("tiers listed best-first", /Clean Sweep/.test(lines[0]) && /Near Perfect/.test(lines[1]) && /Sharp/.test(lines[2]));
  t("each line names the week it came from", lines.every(l => /week/.test(l)));
  t("totalBonus equals the tiers summed",
    A.totalBonus === SC.sweepBonus + SC.nearPerfectBonus + SC.sharpBonus, `${A.totalBonus}`);
  t("no tie line when no tie was called", !lines.some(l => l.includes("🤝")));
  t("nothing to explain for a player with no bonuses", describeBonuses({ badges: [], tieBonus: 0 }).length === 0);
}
{
  // A week containing a real tie, called correctly.
  const fixtures = week(1);
  const league = { members: ["a"] }, users = { a: { username: "A" } };
  const preds = { a: { picks: {}, specials: {} } }, results = {};
  fixtures.forEach((f, i) => {
    const isTie = i === 0;
    results[f.id] = isTie ? { homeScore: 20, awayScore: 20 } : { homeScore: 24, awayScore: 10 };
    preds.a.picks[f.id] = { winner: isTie ? "T" : "H" };
  });
  const A = calcStandings(league, users, preds, results, {}, SC)[0];
  const lines = describeBonuses(A);
  console.log("        " + lines.join("\n        "));
  t("the called tie is counted", A.tiesCalled === 1);
  t("tie credited as the PREMIUM, not the full value",
    A.tieBonus === SC.tiePoints - SC.correctPoints, `tieBonus=${A.tieBonus}`);
  t("a tie line appears", lines.some(l => l.includes("🤝")));
  // The whole point of using the premium: the breakdown has to reconcile.
  t("correct picks + totalBonus reconciles with the points total",
    A.correct * SC.correctPoints + A.totalBonus === A.points,
    `${A.correct}×${SC.correctPoints} + ${A.totalBonus} vs ${A.points}`);
}
{
  // A league that prices ties BELOW a normal pick — the premium must not go
  // negative and quietly reduce someone's bonus.
  const odd = { tiePoints: 1, correctPoints: 5 };
  const scoring = getScoringSettings({ settings: odd });
  const fixtures = week(1);
  const league = { members: ["a"] }, users = { a: { username: "A" } };
  const preds = { a: { picks: {}, specials: {} } }, results = {};
  fixtures.forEach((f, i) => {
    const isTie = i === 0;
    results[f.id] = isTie ? { homeScore: 20, awayScore: 20 } : { homeScore: 24, awayScore: 10 };
    preds.a.picks[f.id] = { winner: isTie ? "T" : "H" };
  });
  const A = calcStandings(league, users, preds, results, {}, scoring)[0];
  t("a cheap tie never produces a negative bonus", A.tieBonus === 0, `tieBonus=${A.tieBonus}`);
  t("...and no misleading tie line is shown", !describeBonuses(A).some(l => l.includes("🤝")));
}

// ────────────────────────────────────────────────────────────────────────────
group("Season pick eligibility");
for (const type of SPECIAL_PICK_TYPES) {
  const opts = teamsForSpecialPick(type);
  if (type.kind === "division") {
    t(`${type.label}: exactly its 4 teams`,
      opts.length === 4 && opts.every(c => TEAMS[c].div === type.division), `${opts.length}`);
  } else if (type.kind === "conference") {
    const wrong = opts.filter(c => TEAMS[c].conf !== type.conference);
    t(`${type.label}: 16 teams, none from the other conference`,
      opts.length === 16 && wrong.length === 0, `${opts.length} teams, ${wrong.length} wrong`);
  } else {
    t(`${type.label}: open to all 32`, opts.length === 32, `${opts.length}`);
  }
}
{
  const afc = teamsForSpecialPick(SPECIAL_PICK_TYPES.find(x => x.id === "conf_AFC"));
  const nfc = teamsForSpecialPick(SPECIAL_PICK_TYPES.find(x => x.id === "conf_NFC"));
  t("the two conference lists don't overlap", afc.filter(c => nfc.includes(c)).length === 0);
  t("together they cover the whole league", new Set([...afc, ...nfc]).size === 32);
  for (const type of SPECIAL_PICK_TYPES.filter(x => x.kind === "division")) {
    const conf = type.division.startsWith("AFC") ? afc : nfc;
    t(`${type.label} rolls up into its conference`, teamsForSpecialPick(type).every(c => conf.includes(c)));
  }
}
t("an unknown pick type falls back to all teams", teamsForSpecialPick(undefined).length === TEAM_CODES.length);

// ────────────────────────────────────────────────────────────────────────────
group("Schedule integrity");
{
  const ids = [...REGULAR_SEASON_FIXTURES, ...PLAYOFF_FIXTURES].map(f => f.id);
  t("no duplicate fixture ids", new Set(ids).size === ids.length);
  t("every fixture references known teams",
    REGULAR_SEASON_FIXTURES.every(f => TEAMS[f.home] && TEAMS[f.away]));
  const counts = Object.fromEntries(TEAM_CODES.map(c => [c, 0]));
  for (const f of REGULAR_SEASON_FIXTURES) { counts[f.home]++; counts[f.away]++; }
  t("every team plays exactly 17 games", Object.values(counts).every(n => n === 17));
  let clash = false;
  for (let w = 1; w <= 18; w++) {
    const seen = new Set();
    for (const f of REGULAR_SEASON_FIXTURES.filter(x => x.week === w)) {
      for (const c of [f.home, f.away]) { if (seen.has(c)) clash = true; seen.add(c); }
    }
  }
  t("no team appears twice in the same week", !clash);
  const pairs = new Map();
  for (const f of REGULAR_SEASON_FIXTURES) {
    const k = `${f.away}@${f.home}`;
    pairs.set(k, (pairs.get(k) || 0) + 1);
  }
  t("no ambiguous away@home pair (the fetcher matches on this)",
    [...pairs.values()].every(n => n === 1));
}

// ────────────────────────────────────────────────────────────────────────────
group("Playoff matchups must be lockable");
t("a placeholder alone has no lock time", effectiveKickoffUTC(PLAYOFF_FIXTURES[0]) === null);
t("teams but no kickoff is NOT ready", isPlayoffMatchupReady({ home: "KC", away: "BUF" }) === false);
t("kickoff but no teams is NOT ready", isPlayoffMatchupReady({ kickoffUTC: "2027-01-10T18:00:00Z" }) === false);
t("teams AND kickoff is ready",
  isPlayoffMatchupReady({ home: "KC", away: "BUF", kickoffUTC: "2027-01-10T18:00:00Z" }) === true);
t("nothing at all is not ready", isPlayoffMatchupReady(undefined) === false);
t("a merged, ready matchup does resolve a lock time",
  effectiveKickoffUTC({ ...PLAYOFF_FIXTURES[0], kickoffUTC: "2027-01-10T18:00:00Z" }) === "2027-01-10T18:00:00Z");

// ────────────────────────────────────────────────────────────────────────────
group("Streaks");
{
  const g = scenario({ a: { 1: 0, 2: 0 } });   // two perfect weeks back to back
  const st = pickStreaks("a", g.preds, g.results);
  t("a perfect run counts every game", st.current === week(1).length + week(2).length, `${st.current}`);
  t("best equals current while unbroken", st.best === st.current);
}
{
  // scenario() puts the misses FIRST in each week, so week 1 ends on a long
  // correct run and week 2 opens with three misses.
  const g = scenario({ a: { 1: 0, 2: 3 } });
  const st = pickStreaks("a", g.preds, g.results);
  t("a miss resets the current streak", st.current < st.best, `current ${st.current}, best ${st.best}`);
  t("best remembers the earlier run", st.best >= week(1).length, `${st.best}`);
}
{
  // A skipped game must not be treated as a miss.
  const g = scenario({ a: { 1: 0, 2: 0 } });
  const skipped = week(2)[0];
  delete g.preds.a.picks[skipped.id];
  const st = pickStreaks("a", g.preds, g.results);
  t("an unpicked game is skipped, not counted as wrong",
    st.current === week(1).length + week(2).length - 1, `${st.current}`);
}
t("no picks at all is a zero streak", pickStreaks("nobody", {}, {}).current === 0);

// ────────────────────────────────────────────────────────────────────────────
group("Live week status");
{
  const g = scenario({ a: { 1: 0 } });
  const fixtures = week(1);
  for (const f of fixtures.slice(5)) delete g.results[f.id];    // 5 of 16 played
  const live = liveWeekStatus("a", 1, g.preds, g.results, SC);
  t("a part-played perfect week reports a live sweep", live?.tier.id === "sweep");
  t("it counts what's played, not the whole week", live.played === 5 && live.total === fixtures.length);
  t("remaining games reported", live.remaining === fixtures.length - 5);
  t("it carries the league's bonus value", live.points === SC.sweepBonus);
  t("perfect flag set", live.perfect === true);
}
{
  const g = scenario({ a: { 1: 1 } });                          // one miss
  for (const f of week(1).slice(5)) delete g.results[f.id];
  const live = liveWeekStatus("a", 1, g.preds, g.results, SC);
  t("one miss drops the live tier to Near Perfect", live?.tier.id === "near");
  t("...and it is no longer flagged perfect", live.perfect === false);
}
{
  const g = scenario({ a: { 1: 4 } });                          // four misses
  for (const f of week(1).slice(6)) delete g.results[f.id];
  t("four misses leaves nothing to chase", liveWeekStatus("a", 1, g.preds, g.results, SC) === null);
}
{
  const g = scenario({ a: { 1: 0 } });                          // week complete
  t("a finished week reports no live status (the badge does)",
    liveWeekStatus("a", 1, g.preds, g.results, SC) === null);
}
{
  const g = scenario({ a: { 1: 0 } });
  for (const f of week(1).slice(5)) delete g.results[f.id];
  delete g.preds.a.picks[week(1)[15].id];                       // an unpicked game later in the week
  t("an unpicked game later in the week kills the live status",
    liveWeekStatus("a", 1, g.preds, g.results, SC) === null);
}

// ────────────────────────────────────────────────────────────────────────────
group("Straggler nudge");
{
  const g = scenario({ a: { 1: 0 }, b: { 1: 0 }, c: {} });
  const results = {};                                            // nothing played yet
  const pend = pendingPickers(g.league, g.users, g.preds, 1, results);
  t("only members with gaps are listed", pend.missing.length === 1 && pend.missing[0].uid === "c");
  t("it reports how far along they are", pend.missing[0].made === 0 && pend.missing[0].total === week(1).length);
  t("a first kickoff is resolved for the nudge clock", !!pend.firstKickoffUTC);
}
{
  const g = scenario({ a: { 1: 0 }, b: { 1: 0 } });
  t("nobody outstanding means no nudge",
    pendingPickers(g.league, g.users, g.preds, 1, {}).missing.length === 0);
}
{
  // scenario() only creates results for weeks someone played, so week 1 has to
  // actually be under way for this to test what it claims to.
  const g = scenario({ a: { 1: 0 }, b: { 1: 0 } });
  t("games already have results, so the week is under way",
    week(1).some(f => g.results[f.id]));
  t("once the week has started, nagging stops",
    pendingPickers(g.league, g.users, g.preds, 1, g.results) === null);
}

// ────────────────────────────────────────────────────────────────────────────
group("Theme sheet");
// theme.js is one large JS template literal, so a stray backtick in a CSS
// comment silently ends the string and breaks the build. Importing it here
// means the suite fails loudly instead of the build failing later.
const cssRules = (sheet) => {
  const rules = [];
  const re = /(^|\n)\s*([^{}\n][^{}]*?)\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(sheet))) {
    const strip = (x) => x.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\s+/g, " ").trim();
    rules.push({ sel: strip(m[2]), body: strip(m[3]) });
  }
  return rules;
};

for (const [mode, dark] of [["dark", true], ["light", false]]) {
  const out = css(dark);
  const rules = cssRules(out);
  t(`${mode}: stylesheet renders`, typeof out === "string" && out.length > 5000, `${out.length} chars`);
  t(`${mode}: no unresolved template holes`, !out.includes("${"));

  const selectBase = rules.find(r => r.sel === ".form-select");
  t(`${mode}: selects drop the native OS control`, !!selectBase && selectBase.body.includes("appearance: none"));
  t(`${mode}: ...and draw their own arrow`, !!selectBase && /background-image: url\("data:image\/svg/.test(selectBase.body));
  t(`${mode}: ...with a gutter for it`, !!selectBase && /padding-right: \d+px/.test(selectBase.body));

  // THE invariant. A padding shorthand in a select rule that WINS over the
  // base rule silently overrides that gutter and drops the arrow onto the
  // text — which is what happened to the profile dropdown and the compact
  // selects. "Wins" means it comes later in the sheet (equal specificity) or
  // is a descendant selector (higher specificity), so the base
  // `.form-input, .form-select` rule above is correctly not flagged.
  const baseIndex = rules.findIndex(r => r.sel === ".form-select");
  const clobbering = rules.filter((r, i) => {
    if (!r.sel.includes("form-select")) return false;
    if (r.sel.includes("option") || r.sel.includes("optgroup")) return false;
    const shorthand = r.body.match(/(?:^|;)\s*padding:\s*([^;]+)/)?.[1];
    if (!shorthand) return false;
    // Four values set the right padding explicitly, so they're safe.
    if (shorthand.trim().split(/\s+/).length >= 4) return false;
    // .trim() matters: splitting "a, .form-select" leaves a leading space,
    // which the descendant test below would otherwise read as a combinator.
    const part = (r.sel.split(",").find(x => x.includes("form-select")) || "").trim();
    const moreSpecific = /\s|\.[a-z-]+\.[a-z-]/i.test(part);
    return i > baseIndex || moreSpecific;
  });
  t(`${mode}: no select rule clobbers the arrow gutter`, clobbering.length === 0,
    clobbering.map(r => r.sel).join(", ") || "none");

  const toggle = rules.find(r => r.sel === ".toggle");
  t(`${mode}: toggle resets the button border`, !!toggle && toggle.body.includes("border: none"));
  const togRow = rules.find(r => r.sel === ".toggle-row");
  t(`${mode}: toggle row keeps the panel inset`, !!togRow && /padding: 10px 16px/.test(togRow.body));

  // --font-mono was referenced in three places and never declared, so every
  // one of them fell back to the browser default.
  t(`${mode}: --font-mono is actually declared`, /--font-mono:\s*[^;]+;/.test(out));
  const declared = new Set((out.match(/--[a-z0-9-]+(?=\s*:)/g) || []));
  const referenced = new Set((out.match(/var\(\s*(--[a-z0-9-]+)/g) || []).map(s => s.replace(/var\(\s*/, "")));
  const undeclared = [...referenced].filter(v => !declared.has(v)
    // A var with a fallback is a deliberate choice, not a mistake.
    && !new RegExp(`var\\(\\s*${v}\\s*,`).test(out));
  t(`${mode}: every CSS variable used is defined`, undeclared.length === 0, undeclared.join(", ") || "none");

  // The two new surfaces. A missing class here means a dialog or a history
  // row renders as unstyled text, which is easy to miss in a build that
  // otherwise succeeds.
  // ── Mobile ────────────────────────────────────────────────────────────
  // The @media block is where regressions hide: everything looks right on a
  // desktop and nobody notices until they open it on a phone.
  const mobile = out.slice(out.indexOf("@media (max-width: 560px)"));
  t(`${mode}: a dialog taller than the screen can scroll`,
    /\.modal \{[^}]*overflow-y: auto/s.test(out) && /\.modal \{[^}]*max-height/s.test(out));
  t(`${mode}: ...and so can the overlay behind it`,
    /\.modal-overlay \{[^}]*overflow-y: auto/s.test(out));
  // 118 avatars at seven across is a 36px tap target inside a 320px dropdown.
  t(`${mode}: the avatar grid drops to 5 columns on a phone`,
    mobile.includes("repeat(5, 1fr)"));
  t(`${mode}: history filter chips are shrunk from the admin-panel default`,
    mobile.includes(".history-filters .chip"));
  t(`${mode}: dialog buttons stack`, mobile.includes("column-reverse"));

  for (const sel of [".confirm-lines", ".confirm-lines.danger", ".confirm-line", ".confirm-note",
                     ".history-row", ".history-row.danger", ".history-date", ".history-summary",
                     // Dashboard headings and the rival/streak pair. A missing
                     // one here means a card loses its title or its layout.
                     ".mini-label", ".dash-pair", ".streak-card", ".streak-icon",
                     ".streak-sub", ".board-sub", ".form-card"]) {
    t(`${mode}: ${sel} is styled`, rules.some(r => r.sel.split(",").some(s => s.trim() === sel)));
  }
}

// ────────────────────────────────────────────────────────────────────────────
group("Backup — build and validate");
{
  const made = buildBackup({
    users: { a: { username: "A" } },
    leagues: [{ id: "L1", name: "League", members: ["a"], settings: { correctPoints: 2 } }],
    predictions: { a: { picks: { w1_1: { winner: "H" } }, specials: { superbowl: "KC" } } },
    results: { scores: { w1_1: { homeScore: 24, awayScore: 10 } }, specials: { superbowl: "KC" }, playoffFixtures: {} },
    seasonYear: 2026, takenBy: { uid: "a", username: "A" }, now: 1_757_000_000_000,
  });
  t("stamped with app and version", made.app === BACKUP_APP && made.version === BACKUP_VERSION);
  t("season year recorded", made.seasonYear === 2026);
  t("counts computed", made.counts.players === 1 && made.counts.picks === 1 && made.counts.scores === 1);
  t("leagues keyed by id", !!made.data.leagues.L1);
  t("survives a JSON round trip", JSON.stringify(JSON.parse(JSON.stringify(made))) === JSON.stringify(made));
  t("filename is dated and sortable", /^scoreclash-2026-\d{8}-\d{4}\.json$/.test(backupFilename(made)), backupFilename(made));

  const good = validateBackup(JSON.parse(JSON.stringify(made)), { seasonYear: 2026 });
  t("a real backup validates", good.ok === true, good.errors.join("; "));

  // Fail-closed cases — each must be REFUSED, not partially applied.
  const reject = (label, mutate, opts = { seasonYear: 2026 }) => {
    const copy = JSON.parse(JSON.stringify(made));
    mutate(copy);
    const v = validateBackup(copy, opts);
    t(`refuses ${label}`, v.ok === false, v.errors[0] || "accepted!");
  };
  reject("a file from another app", b => { b.app = "something-else"; });
  reject("a backup from a different season", b => { b.seasonYear = 2025; });
  reject("a backup from a newer app version", b => { b.version = BACKUP_VERSION + 1; });
  reject("a file with no data section", b => { delete b.data; });
  reject("a file with no predictions", b => { delete b.data.predictions; });
  reject("a file with no results", b => { delete b.data.results; });
  t("refuses a non-object", validateBackup("not json", { seasonYear: 2026 }).ok === false);
  t("refuses null", validateBackup(null, { seasonYear: 2026 }).ok === false);
  {
    const empty = buildBackup({ seasonYear: 2026 });
    const v = validateBackup(empty, { seasonYear: 2026 });
    t("an empty backup validates but warns", v.ok === true && v.warnings.length > 0, v.warnings.join("; "));
  }
}

// ────────────────────────────────────────────────────────────────────────────
group("Restore — merge never destroys");
const backupFixture = buildBackup({
  users: {},
  leagues: [{ id: "L1", name: "Old Name", members: ["a", "b"], settings: { correctPoints: 1 } }],
  predictions: {
    a: { picks: { w1_1: { winner: "H" }, w1_2: { winner: "A" } }, specials: { superbowl: "KC" } },
    b: { picks: { w1_1: { winner: "A" } }, specials: {} },
  },
  results: {
    scores: { w1_1: { homeScore: 24, awayScore: 10 }, w1_2: { homeScore: 7, awayScore: 3 } },
    specials: { superbowl: "KC" },
    playoffFixtures: { po_wc_afc_1: { home: "KC", away: "BUF", kickoffUTC: "2027-01-10T18:00:00Z" } },
  },
  seasonYear: 2026,
});

{
  // Live data has DIVERGED: one score differs, one pick differs, and there is
  // newer data the backup has never seen.
  const current = {
    results: { scores: { w1_1: { homeScore: 99, awayScore: 0 }, w3_9: { homeScore: 14, awayScore: 13 } }, specials: {}, playoffFixtures: {} },
    predictions: { a: { picks: { w1_1: { winner: "T" }, w5_1: { winner: "H" } }, specials: {} } },
    leagues: { L1: { id: "L1", name: "New Name", members: ["a", "b", "c"], settings: { correctPoints: 3 } } },
  };
  const plan = planRestore(backupFixture, current, { mode: "merge" });

  t("does not touch a score that already exists", plan.results.doc["scores.w1_1"] === undefined);
  t("fills in the score that is missing", !!plan.results.doc["scores.w1_2"]);
  t("never deletes a newer score", !JSON.stringify(plan.results.doc).includes("w3_9"));
  t("restores the missing season result", plan.results.doc["specials.superbowl"] === "KC");
  t("restores the missing playoff matchup", !!plan.results.doc["playoffFixtures.po_wc_afc_1"]);

  const a = plan.predictions.find(p => p.uid === "a");
  t("does not overwrite an existing pick", a.doc["picks.w1_1"] === undefined);
  t("fills in the missing pick", !!a.doc["picks.w1_2"]);
  t("never removes a newer pick", !JSON.stringify(a.doc).includes("w5_1"));
  t("restores a missing season pick", a.doc["specials.superbowl"] === "KC");
  const b = plan.predictions.find(p => p.uid === "b");
  t("a player absent from live data is restored", !!b && !!b.doc["picks.w1_1"]);

  const l = plan.leagues.find(x => x.id === "L1");
  t("league membership is left completely alone", !("members" in l.doc), JSON.stringify(l.doc));
  t("league name and settings are restored", l.doc.name === "Old Name" && l.doc.settings.correctPoints === 1);
  t("every plan entry is an update, not a set", plan.predictions.every(p => p.type === "update") && plan.results.type === "update");
}

{
  // Running the same merge twice must be a no-op the second time.
  const current = { results: backupFixture.data.results, predictions: backupFixture.data.predictions,
    leagues: { L1: backupFixture.data.leagues.L1 } };
  const plan = planRestore(backupFixture, current, { mode: "merge" });
  t("restoring an already-restored backup does nothing", plan.isEmpty === true, JSON.stringify(plan.summary));
  t("...and says so", /Nothing to restore/.test(describePlan(plan)));
}

{
  // A deleted league is a legitimate restore — recreate it in full.
  const plan = planRestore(backupFixture, { results: {}, predictions: {}, leagues: {} }, { mode: "merge" });
  const l = plan.leagues.find(x => x.id === "L1");
  t("a deleted league is recreated whole", l.type === "set" && l.doc.members.length === 2);
}

// ────────────────────────────────────────────────────────────────────────────
group("Restore — replace, and part selection");
{
  const current = {
    results: { scores: { w9_9: { homeScore: 1, awayScore: 0 } }, specials: {}, playoffFixtures: {} },
    predictions: { a: { picks: { w9_9: { winner: "H" } }, specials: {} } },
    leagues: { L1: { id: "L1", name: "New Name", members: ["a", "b", "c"], settings: {} } },
  };
  const plan = planRestore(backupFixture, current, { mode: "replace" });
  t("replace sets the results document outright", plan.results.type === "set");
  t("...discarding data the backup doesn't have", plan.results.doc.scores.w9_9 === undefined);
  t("replace sets each prediction document outright", plan.predictions.every(p => p.type === "set"));
  t("...and reports what it will discard", plan.summary.scoresOverwritten === 1 && plan.summary.picksOverwritten === 1);
  t("the warning appears in the description", /discard/.test(describePlan(plan)), describePlan(plan));
  const l = plan.leagues.find(x => x.id === "L1");
  t("replace does restore membership", l.type === "set" && l.doc.members.length === 2);
}
{
  const current = { results: {}, predictions: {}, leagues: {} };
  const only = planRestore(backupFixture, current, { mode: "merge", parts: ["results"] });
  t("selecting only results leaves picks alone", only.predictions.length === 0 && !!only.results);
  const picksOnly = planRestore(backupFixture, current, { mode: "merge", parts: ["predictions"] });
  t("selecting only predictions leaves results alone", picksOnly.results === null && picksOnly.predictions.length === 2);
  const none = planRestore(backupFixture, current, { mode: "merge", parts: [] });
  t("selecting nothing plans nothing", none.isEmpty === true);
  const bogus = planRestore(backupFixture, current, { mode: "merge", parts: ["users", "everything"] });
  t("unknown parts are ignored, not obeyed", bogus.isEmpty === true);
}
{
  // Profiles must never be written — a user doc is writable only by its owner.
  const withUsers = buildBackup({ users: { a: { username: "A" } }, seasonYear: 2026 });
  const plan = planRestore(withUsers, { results: {}, predictions: {}, leagues: {} }, { mode: "replace", parts: ["results", "predictions", "leagues", "users"] });
  t("users are never part of a restore plan", !("users" in plan));
}

// ────────────────────────────────────────────────────────────────────────────
group("Restore — full round trip");
// The one that actually matters: back up a live season, wipe everything,
// restore, and confirm the standings come back byte-identical. Mirrors what
// firebase.js does when it applies a plan, so the simulation and the real
// write path stay in step.
{
  const dottedToNested = (fields) => {
    const out = {};
    for (const [path, v] of Object.entries(fields)) {
      const i = path.indexOf(".");
      if (i === -1) { out[path] = v; continue; }
      const head = path.slice(0, i), tail = path.slice(i + 1);
      (out[head] ||= {})[tail] = v;
    }
    return out;
  };
  const deepMerge = (base, patch) => {
    const out = { ...base };
    for (const [k, v] of Object.entries(patch)) {
      out[k] = v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object"
        ? deepMerge(base[k], v) : v;
    }
    return out;
  };

  const uids = ["u1", "u2", "u3"];
  const league = { id: "L1", name: "Office Rivals", superAdminId: "u1", adminIds: [], members: uids, settings: { ...SC } };
  const users = Object.fromEntries(uids.map(u => [u, { username: u.toUpperCase() }]));
  const predictions = Object.fromEntries(uids.map(u => [u, { picks: {}, specials: {} }]));
  const scores = {};
  for (const w of [1, 2, 3]) {
    week(w).forEach((f, i) => {
      scores[f.id] = { homeScore: 24, awayScore: 10, enteredAt: 1 };
      uids.forEach((u, ui) => { predictions[u].picks[f.id] = { winner: i < ui ? "A" : "H" }; });
    });
  }
  predictions.u1.specials[SB.id] = "KC";
  const specials = { [SB.id]: "KC" };
  const results = { scores, specials, playoffFixtures: { po_wc_afc_1: { home: "KC", away: "BUF", kickoffUTC: "2027-01-10T18:00:00Z" } } };

  const before = calcStandings(league, users, predictions, scores, specials, SC);

  // Through a real JSON file round trip, not just an in-memory object.
  const backup = JSON.parse(JSON.stringify(buildBackup({
    users, leagues: [league], predictions, results,
    seasonYear: 2026, takenBy: { uid: "u1", username: "U1" },
  })));
  t("survives being written and re-read as a file", validateBackup(backup, { seasonYear: 2026 }).ok);

  // Total loss of picks and results.
  const plan = planRestore(backup, { results: { scores: {}, specials: {}, playoffFixtures: {} }, predictions: {}, leagues: { L1: league } }, { mode: "merge" });

  let liveResults = { scores: {}, specials: {}, playoffFixtures: {} };
  if (plan.results) {
    liveResults = plan.results.type === "set" ? plan.results.doc
      : deepMerge(liveResults, dottedToNested(plan.results.doc));
  }
  const livePreds = {};
  for (const item of plan.predictions) {
    livePreds[item.uid] = item.type === "set" ? item.doc
      : deepMerge({ picks: {}, specials: {} }, dottedToNested(item.doc));
  }

  const after = calcStandings(league, users, livePreds, liveResults.scores, liveResults.specials, SC);
  t("every score comes back", Object.keys(liveResults.scores).length === Object.keys(scores).length);
  t("hand-entered season results come back", liveResults.specials[SB.id] === "KC");
  t("hand-entered playoff matchups come back", !!liveResults.playoffFixtures.po_wc_afc_1);
  t("every player's picks come back", uids.every(u => Object.keys(livePreds[u].picks).length === Object.keys(predictions[u].picks).length));
  t("STANDINGS ARE IDENTICAL after restore",
    JSON.stringify(after.map(r => [r.uid, r.points, r.correct, r.bonusPoints])) ===
    JSON.stringify(before.map(r => [r.uid, r.points, r.correct, r.bonusPoints])),
    after.map(r => `${r.username}=${r.points}`).join(" "));
  t("badges are identical too",
    JSON.stringify(after.map(r => r.badges.map(b => b.id))) === JSON.stringify(before.map(r => r.badges.map(b => b.id))));

  const again = planRestore(backup, { results: liveResults, predictions: livePreds, leagues: { L1: league } }, { mode: "merge" });
  t("running the restore a second time changes nothing", again.isEmpty === true);
}

// ────────────────────────────────────────────────────────────────────────────
group("Results fetch — the date window asked of ESPN");
{
  const r = espnDateRange(new Date("2026-09-13T06:00:00Z"), 1, 3);
  t("is a hyphenated range, not a comma list", /^\d{8}-\d{8}$/.test(r), r);
  t("starts the day before", r.startsWith("20260912"), r);
  t("ends three days after", r.endsWith("20260916"), r);
  t("crosses a month boundary correctly", espnDateRange(new Date("2026-10-01T06:00:00Z"), 1, 3) === "20260930-20261004");
  t("crosses a year boundary correctly", espnDateRange(new Date("2027-01-01T06:00:00Z"), 1, 3) === "20261231-20270104");
}

// ────────────────────────────────────────────────────────────────────────────
group("Results fetch — what gets written and what gets refused");
{
  const real = REGULAR_SEASON_FIXTURES[0];
  const base = {
    homeAbbr: real.home, awayAbbr: real.away, homeScore: 24, awayScore: 10,
    completed: true, isRegularSeason: true, isPostSeason: false, seasonYear: 2026, week: real.week,
  };
  const run = (games, currentScores = {}) => planResultWrites({ games, currentScores, seasonYear: 2026 });

  t("a completed regular-season game is written", run([base]).updatedCount === 1);
  t("...to the right fixture", Object.keys(run([base]).writes)[0] === `scores.${real.id}`);

  // Every one of these must be REFUSED. Each is a way a wrong score could end
  // up against a real fixture.
  const refuses = [
    ["a game still in progress", { ...base, completed: false }, "not_completed"],
    // Preseason and postseason are now told apart, so each can only reach its
    // own pool. A preseason game matches nothing at all.
    ["a preseason game", { ...base, isRegularSeason: false, isPostSeason: false }, "not_scorable_competition"],
    ["a game whose type is unknown", { ...base, isRegularSeason: null, isPostSeason: null }, "not_scorable_competition"],
    ["last season's game", { ...base, seasonYear: 2025 }, "wrong_season_year"],
    ["a game with no scores", { ...base, homeScore: null, awayScore: null }, "missing_scores"],
    ["a game with only one score", { ...base, awayScore: null }, "missing_scores"],
    ["a game with no team codes", { ...base, homeAbbr: null }, "unmapped_team"],
    ["a team code we don't recognise", { ...base, homeAbbr: "WSH" }, "unknown_team_code"],
    ["a fixture that isn't in our schedule", { ...base, homeAbbr: "KC", awayAbbr: "KC" }, "no_matching_fixture"],
  ];
  for (const [label, game, reason] of refuses) {
    const out = run([game]);
    t(`refuses ${label}`, out.updatedCount === 0 && out.skipped[reason] === 1,
      JSON.stringify(out.skipped));
  }

  t("an unrecognised code is named in the report",
    run([{ ...base, homeAbbr: "WSH" }]).details[0].unknown?.[0] === "WSH");

  // Never overwrite: the single most important guarantee in the fetcher.
  const existing = { [real.id]: { homeScore: 3, awayScore: 0 } };
  const out = run([base], existing);
  t("never overwrites a score that already exists", out.updatedCount === 0 && out.skipped.already_exists === 1);
  t("...and the stored score is untouched", Object.keys(out.writes).length === 0);

  // A provider that disagrees with our schedule on the week number should
  // still match on the teams, and say that it did.
  const drift = { ...base, week: 99 };
  const d = run([drift]);
  t("a week-number disagreement still matches on teams", d.updatedCount === 1);
  t("...and is reported as such", d.details[0].matchedBy === "teams_only");
  t("an exact match is reported as exact", run([base]).details[0].matchedBy === "teams_and_week");

  // Home/away is not symmetric — a reversed fixture must not match.
  const reversed = { ...base, homeAbbr: real.away, awayAbbr: real.home };
  const rv = findFixture(reversed);
  t("a home/away swap doesn't match the same fixture", rv.fixture?.id !== real.id);

  // A batch mixing good and bad writes only the good.
  const mixed = run([base, { ...base, completed: false }, { ...base, isRegularSeason: false, isPostSeason: false }]);
  t("a mixed batch writes only the valid game", mixed.updatedCount === 1);
}

// ────────────────────────────────────────────────────────────────────────────
group("Change history (audit log)");
{
  const actor = { actorUid: "u1", actorName: "Kostas" };

  // Shape and defences
  const e = makeEntry({ kind: "result_changed", ...actor, leagueId: "ABC123", global: true,
    summary: "Wk 1 · SEA @ NE · 21–17 → 24–17", now: 1000 });
  t("an entry carries its version, time, kind and actor",
    e.v === AUDIT_VERSION && e.at === 1000 && e.kind === "result_changed" && e.actorUid === "u1");
  t("an unknown kind is refused outright", (() => {
    try { makeEntry({ kind: "nope", ...actor }); return false; } catch { return true; }
  })());
  t("an entry without an actor is refused", (() => {
    try { makeEntry({ kind: "result_set", actorName: "X" }); return false; } catch { return true; }
  })());
  t("summary is capped so it can't exceed the rule's limit",
    makeEntry({ kind: "result_set", ...actor, summary: "x".repeat(500) }).summary.length === 300);
  t("undefined values are stripped from detail (Firestore rejects them)", (() => {
    const d = makeEntry({ kind: "result_set", ...actor, detail: { a: 1, b: undefined } }).detail;
    return d.a === 1 && !("b" in d);
  })());
  t("an all-undefined detail is dropped entirely",
    makeEntry({ kind: "result_set", ...actor, detail: { b: undefined } }).detail === undefined);
  t("every kind has a label, icon and tone",
    Object.values(AUDIT_KINDS).every(k => k.label && k.icon && ["neutral", "warn", "danger"].includes(k.tone)));
  t("every filter group references only real kinds",
    AUDIT_GROUPS.every(g => g.kinds.every(k => !!AUDIT_KINDS[k])));

  // Validation fails closed
  t("a malformed entry is not rendered", !isValidEntry({ kind: "result_set" })
    && !isValidEntry({ at: 1, kind: "made_up", actorUid: "u" })
    && !isValidEntry(null));
  t("a well-formed entry is rendered", isValidEntry(e));

  // Visibility: results are shared by every league, scoring is not
  const mine = makeEntry({ kind: "scoring_changed", ...actor, leagueId: "ABC123", global: false, summary: "x" });
  const theirs = makeEntry({ kind: "scoring_changed", ...actor, leagueId: "OTHER1", global: false, summary: "y" });
  t("a global change shows in every league", entryVisibleTo(e, "ABC123") && entryVisibleTo(e, "OTHER1"));
  t("a league-scoped change shows only in its own league",
    entryVisibleTo(mine, "ABC123") && !entryVisibleTo(theirs, "ABC123"));

  // Filtering + ordering
  const rows = [
    { ...makeEntry({ kind: "result_set", ...actor, global: true, summary: "old one" }), at: 100 },
    { ...makeEntry({ kind: "pick_override", ...actor, global: true, summary: "BOB · SEA → NE" }), at: 300 },
    { ...makeEntry({ kind: "scoring_changed", ...actor, leagueId: "ABC123", summary: "Clean Sweep 8 → 9" }), at: 200 },
    { at: 400, kind: "garbage" },   // must be dropped, not rendered blank
  ];
  const all = filterEntries(rows, { leagueId: "ABC123" });
  t("invalid rows are dropped", all.length === 3);
  t("newest first, always", all[0].at === 300 && all[2].at === 100);
  t("a group filter narrows to its kinds",
    filterEntries(rows, { leagueId: "ABC123", group: "picks" }).length === 1);
  t("'overwrites only' hides routine new entries",
    filterEntries(rows, { leagueId: "ABC123", group: "changes" }).every(r => AUDIT_KINDS[r.kind].tone !== "neutral"));
  t("search matches the summary text",
    filterEntries(rows, { leagueId: "ABC123", search: "clean sweep" }).length === 1);
  t("search is case-insensitive and matches the actor",
    filterEntries(rows, { leagueId: "ABC123", search: "KOSTAS" }).length === 3);

  // Day grouping uses the VIEWER's timezone, not UTC
  const lateNight = Date.UTC(2026, 8, 14, 2, 30);   // 02:30 UTC Monday
  t("a 2:30am UTC entry is Sunday in New York",
    dayLabel(lateNight, "America/New_York").includes("Sun"));
  t("...and Monday in Athens", dayLabel(lateNight, "Europe/Athens").includes("Mon"));
  t("a nonsense timezone doesn't throw", typeof dayLabel(lateNight, "Not/AZone") === "string");
  const grouped = groupByDay(
    [{ at: lateNight }, { at: lateNight + 1000 }, { at: lateNight - 86400000 }],
    "Europe/Athens");
  t("entries on the same day share one heading", grouped.length === 2 && grouped[0].entries.length === 2);

  // Summary builders — these are the whole point of the tab
  const f = REGULAR_SEASON_FIXTURES[0];
  t("a new result reads as just the score",
    resultSummary(f, null, { homeScore: 24, awayScore: 17 }) === `${fixtureText(f)} · 17–24`);
  t("a changed result shows both scores",
    resultSummary(f, { homeScore: 21, awayScore: 17 }, { homeScore: 24, awayScore: 17 })
      === `${fixtureText(f)} · 17–21 → 17–24`);
  t("a cleared result says so",
    resultSummary(f, { homeScore: 21, awayScore: 17 }, null).endsWith("· 17–21 → cleared"));
  t("resultKind distinguishes set / changed / cleared",
    resultKind(null, { homeScore: 1, awayScore: 0 }) === "result_set"
    && resultKind({ homeScore: 1, awayScore: 0 }, { homeScore: 2, awayScore: 0 }) === "result_changed"
    && resultKind({ homeScore: 1, awayScore: 0 }, null) === "result_cleared");
  t("a half-entered score reads as 'no score'", scoreText({ homeScore: 7 }) === "no score");
  t("pick sides are named, not lettered",
    pickSideText("H", f) === f.home && pickSideText("A", f) === f.away
    && pickSideText("T", f) === "Tie" && pickSideText(null, f) === "no pick");
  t("an override names the member and both picks",
    overrideSummary("BOB", f, "A", "H") === `BOB · ${fixtureText(f)} · ${f.away} → ${f.home}`);

  // Scoring diff — only what moved
  const beforeS = { correctPoints: 1, sweepBonus: 8, tiePoints: 5 };
  const afterS = { correctPoints: 1, sweepBonus: 9, tiePoints: 5 };
  const sd = scoringDiff(beforeS, afterS, { sweepBonus: "Clean Sweep" });
  t("unchanged values are left out of the diff", sd.length === 1 && sd[0].key === "sweepBonus");
  t("the diff reads as from → to", scoringSummary(sd) === "Clean Sweep 8 → 9");
  t("a value that didn't exist before shows as —",
    scoringSummary(scoringDiff({}, { tiePoints: 5 }, { tiePoints: "Tie" })) === "Tie — → 5");
  t("no changes is stated, not empty", scoringSummary([]) === "No values changed");
}

group("Backups carry the change history");
{
  const b = buildBackup({
    users: {}, leagues: [], predictions: {}, results: {},
    auditLog: [{ at: 1, kind: "result_set", actorUid: "u1", summary: "x" }],
    seasonYear: 2026, now: 5000,
  });
  t("the history is in the file", b.data.auditLog.length === 1);
  t("...and counted for the admin to see", b.counts.historyEntries === 1);
  t("a backup taken without it still validates",
    validateBackup(buildBackup({ seasonYear: 2026, now: 5000 }), { seasonYear: 2026, now: 6000 }).ok);
  // The critical one: restore must never write history back. An append-only
  // log that a restore can rewrite is not append-only.
  t("history is not a restorable part", !RESTORABLE.includes("auditLog"));
  const plan = planRestore(b, { results: {}, predictions: {}, leagues: {} }, { mode: "replace" });
  t("...and a full replace plan contains no history writes",
    !("auditLog" in plan) && JSON.stringify(plan).indexOf("auditLog") === -1);
}

// ────────────────────────────────────────────────────────────────────────────
group("Which week is 'now'");
{
  // REGRESSION: the Predictions week selector was hardcoded to 1, so from
  // Week 2 onwards every visit opened on a week already played — and the
  // dashboard's "Pick Week 6" button led straight to a screen showing Week 1.
  // Both now derive the week from the same function.
  t("with nothing played, the season opens on Week 1", nextOpenWeek({}) === 1);

  const played = {};
  for (const f of REGULAR_SEASON_FIXTURES.filter(x => x.week <= 5)) played[f.id] = { homeScore: 24, awayScore: 10 };
  t("five finished weeks means Week 6 is live", nextOpenWeek(played) === 6);

  // A week that's part-played is still the live week — Thursday's game being
  // in doesn't mean Sunday's picks are done.
  const partial = { ...played };
  const wk6 = REGULAR_SEASON_FIXTURES.filter(x => x.week === 6);
  partial[wk6[0].id] = { homeScore: 20, awayScore: 17 };
  t("a part-played week is still the live one", nextOpenWeek(partial) === 6);

  // A stray later result must not drag the answer forward past unplayed games.
  const stray = { ...played };
  const wk12 = REGULAR_SEASON_FIXTURES.find(x => x.week === 12);
  stray[wk12.id] = { homeScore: 31, awayScore: 3 };
  t("a result entered out of order doesn't skip weeks", nextOpenWeek(stray) === 6);

  const all = {};
  for (const f of REGULAR_SEASON_FIXTURES) all[f.id] = { homeScore: 24, awayScore: 10 };
  // REGRESSION: with no open week the dashboard checklist used to render
  // "Pick Week" with the note "the season hasn't started" and could never be
  // completed, so it nagged through the entire playoffs.
  t("once the regular season is done there is no open week", nextOpenWeek(all) === null);
  t("...and every week counts as finished", finishedWeeks(all).length === 18);
}

// ────────────────────────────────────────────────────────────────────────────
group("Playoff results are fetched too");
{
  const slot = PLAYOFF_FIXTURES.find(f => f.round === "wildcard");
  const setSlots = [{ ...slot, home: "BUF", away: "KC" }];
  const po = {
    homeAbbr: "BUF", awayAbbr: "KC", homeScore: 27, awayScore: 24,
    completed: true, isRegularSeason: false, isPostSeason: true, seasonYear: 2026, week: 1,
  };
  const run = (games, opts = {}) => planResultWrites({
    games, currentScores: {}, seasonYear: 2026, playoffSlots: setSlots, ...opts,
  });

  const out = run([po]);
  t("a postseason game lands in the slot an admin set", out.updatedCount === 1);
  t("...in the right slot", !!out.writes[`scores.${slot.id}`]);
  t("...and is reported as a playoff match", out.details[0].matchedBy === "playoff_teams");

  t("a playoff game with no slot set yet is skipped, not guessed",
    run([po], { playoffSlots: [] }).skipped.no_playoff_slot === 1);
  t("a home/away swap doesn't match the slot",
    run([{ ...po, homeAbbr: "KC", awayAbbr: "BUF" }]).skipped.no_playoff_slot === 1);

  // THE hazard: the same two teams meet in September and again in January.
  // Neither result may ever land in the other's slot.
  {
    const real = REGULAR_SEASON_FIXTURES[0];
    const regular = {
      homeAbbr: real.home, awayAbbr: real.away, homeScore: 20, awayScore: 17,
      completed: true, isRegularSeason: true, isPostSeason: false, seasonYear: 2026, week: real.week,
    };
    const rematchSlots = [{ ...slot, home: real.home, away: real.away }];
    const asRegular = planResultWrites({ games: [regular], currentScores: {}, seasonYear: 2026, playoffSlots: rematchSlots });
    t("a regular-season game never lands in a playoff slot",
      !!asRegular.writes[`scores.${real.id}`] && !asRegular.writes[`scores.${slot.id}`]);

    const asPlayoff = planResultWrites({
      games: [{ ...regular, isRegularSeason: false, isPostSeason: true }],
      currentScores: {}, seasonYear: 2026, playoffSlots: rematchSlots,
    });
    t("...and a playoff rematch never lands in the September fixture",
      !!asPlayoff.writes[`scores.${slot.id}`] && !asPlayoff.writes[`scores.${real.id}`]);
  }

  // Preseason must reach neither pool, even if a slot happens to hold those
  // teams — this is why the two flags are independent rather than one boolean.
  t("a preseason game can't sneak into a playoff slot",
    run([{ ...po, isPostSeason: false, isRegularSeason: false }]).skipped.not_scorable_competition === 1);
  t("an unknown competition still touches nothing",
    run([{ ...po, isPostSeason: null, isRegularSeason: null }]).updatedCount === 0);

  t("an existing playoff score is never overwritten",
    run([po], { currentScores: { [slot.id]: { homeScore: 1, awayScore: 0 } } }).skipped.already_exists === 1);
}

// ────────────────────────────────────────────────────────────────────────────
group("How far ahead you can pick");
{
  const kickoffOf = (w) => new Date(REGULAR_SEASON_FIXTURES.find(f => f.week === w && f.kickoffUTC).kickoffUTC).getTime();
  const beforeSeason = kickoffOf(1) - 5 * 86400000;

  t("before the season the window starts at Week 1",
    openPickWeeks({ now: beforeSeason }).join() === "1,2,3");
  t("the window is always three weeks wide",
    openPickWeeks({ now: kickoffOf(5) + 60000 }).length === 3);
  t("it moves with the calendar",
    openPickWeeks({ now: kickoffOf(5) + 60000 }).join() === "5,6,7");

  // A week in progress stays "this week" — it must not flip over on Sunday
  // afternoon while games are still being played.
  t("a week in progress is still the current week",
    currentWeekByDate(kickoffOf(3) + 2 * 3600000) === 3);
  t("...and moves on once its games are well past",
    currentWeekByDate(kickoffOf(3) + 8 * 86400000) > 3);

  // THE reason this is on the clock and not on results: an admin who hasn't
  // typed last week's scores in must never be able to lock the league out.
  t("nothing about the window depends on results being entered",
    openPickWeeks({ now: kickoffOf(5) + 60000 }).join()
      === openPickWeeks({ now: kickoffOf(5) + 60000 }).join());

  // Week 18 has no announced kickoffs, so this uses a date past the whole
  // season rather than looking one up.
  t("the window never runs past the last week of the season",
    openPickWeeks({ now: kickoffOf(17) + 20 * 86400000 }).every(w => w <= 18));
  t("...and is never empty, even after the season ends",
    openPickWeeks({ now: kickoffOf(17) + 200 * 86400000 }).length > 0);

  // Per-week state, and the message that goes with it.
  {
    const now = kickoffOf(5) + 60000;
    t("the current week is open", weekPickState(5, { now }).open);
    t("two weeks ahead is open", weekPickState(7, { now }).open);
    t("three weeks ahead is not", !weekPickState(8, { now }).open);
    t("...and says when it opens", weekPickState(8, { now }).reason === "future");
    t("a played week is closed as 'past'", weekPickState(2, { now }).reason === "past");
    t("every closed week carries an explanation",
      [1, 2, 8, 12, 18].every(w => {
        const s = weekPickState(w, { now });
        return s.open || (s.label && s.label.length > 5);
      }));
  }

  // While the rehearsal runs, the real season is shut completely.
  {
    const now = kickoffOf(1) - 5 * 86400000;
    t("no regular-season week is pickable during the trial",
      openPickWeeks({ now, trialOpen: true }).length === 0);
    t("...and every week says why",
      [1, 2, 3].every(w => weekPickState(w, { now, trialOpen: true }).reason === "trial"));
    t("...but they reopen the moment the trial is cleared",
      openPickWeeks({ now, trialOpen: false }).length === 3);
  }
}

// ────────────────────────────────────────────────────────────────────────────
group("Preseason trial — a real week, on the real code path");
{
  // ── The schedule is a CONSTANT, like the regular season ──────────────────
  // That's the whole point of it: a week bonus asks "has every game in this
  // week finished?", which is only answerable when the week's fixture list is
  // known in advance. Admin-entered slots couldn't answer it.
  t("48 preseason fixtures, three weeks of sixteen",
    PRESEASON_FIXTURES.length === 48 && PRESEASON_WEEKS.length === 3
    && PRESEASON_WEEKS.every(w => preseasonFixturesForWeek(w).length === 16));
  t("every one has teams and a kickoff, like a real fixture",
    PRESEASON_FIXTURES.every(f => f.home && f.away && f.kickoffUTC
      && !isNaN(new Date(f.kickoffUTC))));
  t("all 32 teams play once a week", PRESEASON_WEEKS.every(w => {
    const teams = preseasonFixturesForWeek(w).flatMap(f => [f.home, f.away]);
    return teams.length === 32 && new Set(teams).size === 32;
  }));
  t("ids are unique and never collide with the season",
    new Set(PRESEASON_FIXTURES.map(f => f.id)).size === 48
    && !PRESEASON_FIXTURES.some(f =>
      REGULAR_SEASON_FIXTURES.some(x => x.id === f.id) || PLAYOFF_FIXTURES.some(x => x.id === f.id)));
  t("every team code is one we know", PRESEASON_FIXTURES.every(f => TEAMS[f.home] && TEAMS[f.away]));
  // The fetcher matches preseason games on TEAMS ALONE — ESPN counts the Hall
  // of Fame game as preseason week 1, so its week numbers are offset from ours
  // and can't be trusted. That's only safe while no matchup repeats: if two
  // preseason weeks had the same pairing, a result could land in the wrong one.
  t("no matchup is played twice all preseason",
    new Set(PRESEASON_FIXTURES.map(f => `${f.away}@${f.home}`)).size === 48);
  t("...not even with the sides reversed",
    new Set(PRESEASON_FIXTURES.map(f => [f.home, f.away].sort().join("-"))).size === 48);
  t("they're scorable", PRESEASON_FIXTURES.every(f => SCORABLE_FIXTURES.some(x => x.id === f.id)));

  // ── Week keys ────────────────────────────────────────────────────────────
  t("a trial week resolves to its sixteen games", fixturesForWeek("pre1").length === 16);
  t("a regular week still resolves as before",
    fixturesForWeek(1).length === REGULAR_SEASON_FIXTURES.filter(f => f.week === 1).length);
  t("trial keys are recognised, numbers aren't",
    isTrialWeek("pre2") && !isTrialWeek(2) && !isTrialWeek("2") && !isTrialWeek(null));
  t("weeks label themselves",
    weekLabel("pre3") === "Preseason Week 3" && weekLabel(7) === "Week 7");

  // ── THE POINT: a trial week earns the same bonuses ───────────────────────
  const trial = (misses) => {
    const fixtures = preseasonFixturesForWeek(1);
    const league = { members: ["a"] }, users = { a: { username: "A" } };
    const results = {}, picks = {};
    fixtures.forEach((f, i) => {
      results[f.id] = { homeScore: 24, awayScore: 10 };
      picks[f.id] = { winner: i < misses ? "A" : "H" };
    });
    return { league, users, results, preds: { a: { picks, specials: {} } } };
  };

  for (const [misses, id] of [[0, "sweep"], [1, "near"], [2, "sharp"]]) {
    const g = trial(misses);
    const badge = weekAccuracyBadge("a", "pre1", g.preds, g.results, SC);
    t(`${misses} miss(es) in a trial week earns ${id}`, badge?.id === id);
    t(`...over all 16 games, exactly like a real week`, badge?.games === 16);
  }
  {
    const g = trial(3);
    t("three misses earns nothing, same as the season",
      weekAccuracyBadge("a", "pre1", g.preds, g.results, SC) === null);
  }

  // The guard that made this worth doing: a part-played trial week settles
  // nothing, exactly as a real one doesn't.
  {
    const g = trial(0);
    const fixtures = preseasonFixturesForWeek(1);
    delete g.results[fixtures[15].id];
    t("a trial week in progress awards no badge",
      weekAccuracyBadge("a", "pre1", g.preds, g.results, SC) === null);
    t("...and isn't counted as finished", !finishedTrialWeeks(g.results).includes("pre1"));
    t("...and no phantom bonus reaches the table",
      calcStandings(g.league, g.users, g.preds, g.results, {}, SC)[0].bonusPoints === 0);
  }

  // And it reaches the standings.
  {
    const g = trial(0);
    const row = calcStandings(g.league, g.users, g.preds, g.results, {}, SC)[0];
    t("a trial sweep pays its bonus into the standings", row.bonusPoints === SC.sweepBonus);
    t("...and shows in the badge cabinet", row.sweepWeeks === 1);
    t("...and wins a medal", row.medals === 1);
    t("...and the points are the 16 correct picks plus the bonus",
      row.points === 16 * SC.correctPoints + SC.sweepBonus);
  }

  // Clearing puts it all back.
  {
    const g = trial(0);
    const empty = calcStandings(g.league, g.users, { a: { picks: {}, specials: {} } }, {}, {}, SC)[0];
    t("clearing the trial removes the points", empty.points === 0);
    t("...the bonus", empty.bonusPoints === 0);
    t("...and the medal", empty.medals === 0);
  }

  // A trial week must never be mistaken for a real one by anything that
  // reasons about the season itself.
  {
    const g = trial(0);
    t("trial weeks aren't regular finished weeks", finishedWeeks(g.results).length === 0);
    t("...but do count as finished trial weeks", finishedTrialWeeks(g.results).join() === "pre1");
    t("...and the two are kept apart in the combined list",
      allFinishedWeeks(g.results).join() === "pre1");
    // The board DOES cover a trial week — the roasts and the recap are the
    // part of the app you can only test by watching it run.
    t("the highlights board covers a trial week too",
      computeHighlights(g.league, g.users, g.preds, g.results, null, SC).week === "pre1");
  }

  // ── The wipe's safety rail ───────────────────────────────────────────────
  // fsClearPreseasonTrial deletes scores and picks by id, and is the only
  // irreversible thing in the trial. It refuses any id this predicate rejects,
  // so the predicate is what stands between a mis-wired button and Week 1.
  t("every preseason id is recognised as one", PRESEASON_FIXTURES.every(f => isPreseasonFixture(f.id)));
  t("no regular-season id is", !REGULAR_SEASON_FIXTURES.some(f => isPreseasonFixture(f.id)));
  t("no playoff id is", !PLAYOFF_FIXTURES.some(f => isPreseasonFixture(f.id)));
  t("and nothing else sneaks through", ["w1_1", "sb", "pre", "pre1", "prex_1", "", null,
    undefined, 0, "PRE1_1", " pre1_1"].every(x => !isPreseasonFixture(x)));

  t("the trial week keys line up with the schedule",
    TRIAL_WEEK_KEYS.join() === "pre1,pre2,pre3"
    && TRIAL_WEEK_KEYS.every(k => fixturesForWeek(k).length === 16));

  // ── Bugs found in the audit after the constants landed ───────────────────
  // Each of these shipped working for the regular season and silently wrong
  // for a trial week, which is the exact failure mode the conversion invites.

  // The weekly tab listed real weeks only, so during the trial it said "no
  // weeks played yet" while weeklyWinTally was handing out medals for one.
  {
    const g = trial(0);
    t("a played trial week is a completed week", allCompletedWeeks(g.results).join() === "pre1");
    t("...so the weekly tab has something to show", allCompletedWeeks(g.results).length > 0);
    t("...even though no real week has started", completedWeeks(g.results).length === 0);
    t("and the tally agrees with it",
      weeklyWinTally(g.league, g.users, g.preds, g.results, SC).perWeek.map(w => w.week).join() === "pre1");
  }

  // Week keys are numbers OR strings, and `1 - "pre1"` is NaN. A NaN
  // comparator doesn't throw — it just leaves the array as it was.
  t("mixed week keys sort, real season first",
    [3, "pre2", 1, "pre1", 12].sort(compareWeekKeys).join() === "1,3,12,pre1,pre2");
  t("...and never returns NaN", [1, "pre1", 2, "pre3"].every((a, i, arr) =>
    arr.every(b => !Number.isNaN(compareWeekKeys(a, b)))));

  // Labels: interpolating a raw key gives "Week pre1" / "WK pre1".
  t("long labels read properly",
    weekLabel(1) === "Week 1" && weekLabel("pre2") === "Preseason Week 2");
  t("badge-sized labels too",
    weekShortLabel(7) === "WK 7" && weekShortLabel("pre3") === "PRE 3");

  // The live "sweep still alive" line and the straggler nudge both hardcoded
  // the regular-season schedule, so neither said anything during the trial.
  {
    const g = trial(0);
    const fixtures = preseasonFixturesForWeek(1);
    for (let i = 8; i < 16; i++) delete g.results[fixtures[i].id];
    const st = liveWeekStatus("a", "pre1", g.preds, g.results, SC);
    t("a part-played trial week reports live status", st?.played === 8 && st?.total === 16);
    t("...and says the sweep is still on", st?.perfect === true && st?.tier?.id === "sweep");
  }
  {
    const league = { members: ["a", "b"] }, users = { a: { username: "A" }, b: { username: "B" } };
    const preds = { a: { picks: {}, specials: {} }, b: { picks: {}, specials: {} } };
    for (const f of preseasonFixturesForWeek(2)) preds.a.picks[f.id] = { winner: "H" };
    const pend = pendingPickers(league, users, preds, "pre2", {});
    t("the nudge finds who hasn't picked a trial week", pend?.missing.map(m => m.uid).join() === "b");
    t("...and counts the right number of games", pend?.total === 16);
    t("...and knows when it locks", !!pend?.firstKickoffUTC);
  }

  // The picks CSV filed preseason games under "Playoffs" — preseason fixtures
  // carry `preWeek`, not `week`, so they fell through the playoff fallback.
  {
    const f = PRESEASON_FIXTURES[0];
    const csv = buildPicksCsv({
      fixtures: [f, REGULAR_SEASON_FIXTURES[0], { id: "po_sb", label: "Super Bowl", home: "KC", away: "SF" }],
      members: [{ uid: "a", username: "A" }],
      allPredictions: { a: { picks: { [f.id]: { winner: "H" } } } },
      results: {},
    });
    const col = csv.split("\n").slice(1).map(line => line.split(",")[0]);
    t("a trial game exports as its preseason week", col[0] === "Preseason 1");
    t("...a regular game as its number", col[1] === "1");
    t("...and a playoff game still as its round", col[2] === "Super Bowl");
  }

  // A replace-mode restore rewrites the whole results document. trialActive
  // isn't in any backup file, so without carrying it across, restoring one
  // mid-trial switched the trial off and reopened the regular season.
  {
    const b = { results: { scores: {}, specials: {}, playoffFixtures: {} }, predictions: {}, leagues: {}, users: {} };
    const live = { results: { scores: {}, specials: {}, playoffFixtures: {}, trialActive: true } };
    const on = planRestore(b, live, { mode: "replace", parts: ["results"] });
    t("a replace during a trial leaves it running", on.results.doc.trialActive === true);
    const off = planRestore(b, { results: { scores: {}, specials: {}, playoffFixtures: {} } },
      { mode: "replace", parts: ["results"] });
    t("...and doesn't invent one when none was running", off.results.doc.trialActive === undefined);
    t("a merge restore never touches the switch either",
      !("trialActive" in (planRestore(b, live, { mode: "merge", parts: ["results"] }).results?.doc || {})));
  }

  // The announcement board, the recap and the shoutouts under them ran off
  // the regular season alone, so the loudest part of the app sat silent
  // through the whole rehearsal.
  {
    const league = { members: ["a", "b", "c", "d", "e"] };
    const users = {}; const preds = {};
    for (const uid of league.members) {
      users[uid] = { username: uid.toUpperCase() };
      preds[uid] = { picks: {}, specials: {} };
    }
    const results = {};
    const fixtures = preseasonFixturesForWeek(1);
    fixtures.forEach((f, i) => {
      results[f.id] = { homeScore: 24, awayScore: 10 };
      // Everyone right except E, who misses the first game on their own.
      for (const uid of league.members) {
        preds[uid].picks[f.id] = { winner: (uid === "e" && i === 0) ? "A" : "H" };
      }
    });
    const hl = computeHighlights(league, users, preds, results, null, SC);
    t("a trial week reaches the announcement board", hl.week === "pre1");
    // Clowns are per-game, listing whoever got it wrong on their own.
    t("...and the solo miss gets roasted",
      hl.clowns.length === 1 && hl.clowns[0].users.join() === "E"
      && hl.clowns[0].fixture.id === fixtures[0].id);
    // Bonus callouts are grouped by tier: four clean sweeps is one line with
    // four names, and E's single miss is a Near Perfect line of its own.
    t("...and the sweepers share one line",
      hl.sweeps.length === 2 && hl.sweeps[0].badge.id === "sweep"
      && hl.sweeps[0].users.slice().sort().join() === "A,B,C,D");
    t("...with the near-perfect tier below it",
      hl.sweeps[1].badge.id === "near" && hl.sweeps[1].users.join() === "E");
    t("...while the one who missed gets Near Perfect instead",
      weekAccuracyBadge("e", "pre1", preds, results, SC)?.id === "near");

    const recap = computeWeeklyRecap(league, users, preds, results, SC);
    t("the recap covers the trial week", recap?.week === "pre1");
    t("...counting all sixteen games", recap.gamesPlayed === 16);
    t("...naming the four who topped it", recap.winners.length === 4);
    t("...and pointing at the one game that split the league",
      recap.toughest?.fixture.id === fixtures[0].id);
  }

  // Fetching: preseason games match the constant schedule.
  {
    const f = PRESEASON_FIXTURES[0];
    const game = {
      homeAbbr: f.home, awayAbbr: f.away, homeScore: 17, awayScore: 13, completed: true,
      isRegularSeason: false, isPostSeason: false, isPreSeason: true, seasonYear: 2026, week: 2,
    };
    const out = planResultWrites({ games: [game], currentScores: {}, seasonYear: 2026 });
    t("a preseason result lands in its fixture", !!out.writes[`scores.${f.id}`]);
    t("...and nowhere else", Object.keys(out.writes).length === 1);
    t("an existing preseason score is never overwritten",
      planResultWrites({ games: [game], currentScores: { [f.id]: { homeScore: 1, awayScore: 0 } }, seasonYear: 2026 })
        .skipped.already_exists === 1);
    t("a preseason game still can't reach a regular-season fixture",
      !Object.keys(out.writes).some(k => k.includes("w1_")));
  }
}

// ────────────────────────────────────────────────────────────────────────────
group("Fetcher health");
{
  const now = Date.UTC(2026, 9, 5, 12, 0);
  const H = 3600000;

  t("no record at all is reported as unknown",
    assessFetchHealth(null, now).level === "unknown");
  t("a recent clean run is healthy",
    assessFetchHealth({ at: now - 2 * H, ok: true, checked: 14, updated: 3, skipped: {} }, now).level === "good");

  // THE case this exists for: it ran, it succeeded, it wrote nothing — and
  // that's either a quiet Tuesday or a silently broken team mapping.
  t("a quiet run with nothing to do is still healthy",
    assessFetchHealth({ at: now - H, ok: true, checked: 0, updated: 0, skipped: {} }, now).level === "good");
  {
    const broken = assessFetchHealth(
      { at: now - H, ok: true, checked: 14, updated: 0, skipped: { unknown_team_code: 2 }, unmatched: ["LA@SF"] }, now);
    t("...but a run that couldn't place games is a warning", broken.level === "warn");
    t("...and it names the reason", broken.detail.join(" ").includes("unknown team code"));
    t("...and points at the map to fix", broken.detail.join(" ").includes("ESPN_ABBR_MAP"));
  }

  t("a failed run is bad", assessFetchHealth({ at: now - H, ok: false, error: "ESPN responded 503" }, now).level === "bad");
  t("...and shows what it said",
    assessFetchHealth({ at: now - H, ok: false, error: "ESPN responded 503" }, now).headline.includes("FAILED"));

  t("slightly overdue is a warning",
    assessFetchHealth({ at: now - 30 * H, ok: true, skipped: {} }, now).level === "warn");
  t("two days silent is bad",
    assessFetchHealth({ at: now - 60 * H, ok: true, skipped: {} }, now).level === "bad");

  t("ages read in plain words",
    describeAge(30 * 60000) === "30 minutes ago" && describeAge(3 * H) === "3 hours ago"
    && describeAge(5 * 24 * H) === "5 days ago");
  t("a negative age doesn't produce nonsense", describeAge(-5) === "just now");
}

// ────────────────────────────────────────────────────────────────────────────
group("Season awards");
{
  // Two players, a full week each, one of them better.
  const g = scenario({ a: { 1: 0 }, b: { 1: 3 } });
  const awards = computeSeasonAwards(g.league, g.users, g.preds, g.results, {}, SC);
  const byId = Object.fromEntries(awards.map(a => [a.id, a]));

  t("a champion is crowned", byId.champion?.winner === "A");
  t("the last place gets the spoon", byId.spoon?.winner === "B");
  t("the best week is found", byId["best-week"]?.winner === "A");
  t("clean sweeps are counted", byId.sweeps?.winner === "A");
  t("every award names somebody", awards.every(a => a.winner && a.winner !== "Unknown"));
  t("every award has an icon, a label and a detail line",
    awards.every(a => a.icon && a.label && a.detail));
  t("award ids are unique", new Set(awards.map(a => a.id)).size === awards.length);

  // THE rule: nothing is handed out for zero of something.
  t("no Tie Whisperer in a season with no ties", !byId.ties);
  t("no Oracle when no season pick has been decided", !byId.oracle);

  t("nothing at all before any results",
    computeSeasonAwards(g.league, g.users, { a: { picks: {} } }, {}, {}, SC).length === 0);
  t("an empty league produces nothing",
    computeSeasonAwards({ members: [] }, {}, {}, g.results, {}, SC).length === 0);

  // The lone right call and the lone wrong one need a crowd to mean anything.
  {
    const wk = week(1);
    const league = { members: ["a", "b", "c"] };
    const users = { a: { username: "A" }, b: { username: "B" }, c: { username: "C" } };
    const results = { [wk[0].id]: { homeScore: 24, awayScore: 10 } };
    const preds = {
      a: { picks: { [wk[0].id]: { winner: "H" } }, specials: {} },
      b: { picks: { [wk[0].id]: { winner: "A" } }, specials: {} },
      c: { picks: { [wk[0].id]: { winner: "A" } }, specials: {} },
    };
    const out = computeSeasonAwards(league, users, preds, results, {}, SC);
    const ids = Object.fromEntries(out.map(x => [x.id, x]));
    t("the only person to call it gets Call of the Season", ids.upset?.winner === "A");
    t("...and with two wrong there's no lone howler", !ids.howler);
  }

  t("the season isn't complete until the Super Bowl is scored",
    !isSeasonComplete(g.results) && isSeasonComplete({ po_sb: { homeScore: 27, awayScore: 24 } }));
}

// ────────────────────────────────────────────────────────────────────────────
group("Game-day refresh");
{
  const wk1 = REGULAR_SEASON_FIXTURES.filter(f => f.week === 1 && f.kickoffUTC);
  const game = wk1[0];
  const kickoff = new Date(game.kickoffUTC).getTime();

  t("nothing to do before kickoff",
    !shouldRefresh({ results: {}, now: kickoff - 60000 }));
  t("fires once a game has started with no score",
    shouldRefresh({ results: {}, now: kickoff + 60000 }));
  t("stops once every started game has a score",
    !shouldRefresh({ results: { [game.id]: { homeScore: 24, awayScore: 10 } }, now: kickoff + 60000 }));
  t("stops well after the game must have finished",
    !shouldRefresh({ results: {}, now: kickoff + IN_PROGRESS_WINDOW_MS + 60000 }));

  // Throttle — shared across tabs via localStorage.
  t("respects the throttle",
    !shouldRefresh({ results: {}, now: kickoff + 60000, lastRefreshAt: kickoff + 30000 }));
  t("...and fires again once it expires",
    shouldRefresh({ results: {}, now: kickoff + REFRESH_THROTTLE_MS + 60000, lastRefreshAt: kickoff }));
  // A clock that jumped backwards, or a junk localStorage value, must not
  // disable refreshing for good.
  t("a future timestamp doesn't lock it out forever",
    shouldRefresh({ results: {}, now: kickoff + 60000, lastRefreshAt: kickoff + 999999999 }));
  t("a corrupt stored value is ignored",
    shouldRefresh({ results: {}, now: kickoff + 60000, lastRefreshAt: NaN }));

  t("only the games actually in progress are counted",
    gamesInProgress({}, kickoff + 60000).every(f => f.week === 1));

  // Playoff slots have no kickoff until an admin sets one.
  {
    const po = PLAYOFF_FIXTURES[0];
    const poKick = Date.UTC(2027, 0, 16, 22, 0);
    t("an unset playoff slot never counts as in progress",
      gamesInProgress({}, poKick + 60000).every(f => f.id !== po.id));
    t("...and does once its kickoff is known",
      gamesInProgress({}, poKick + 60000, { [po.id]: { home: "KC", away: "BUF", kickoffUTC: new Date(poKick).toISOString() } })
        .some(f => f.id === po.id));
  }
}

// ────────────────────────────────────────────────────────────────────────────
group("CSV export");
{
  // RFC 4180 plus the spreadsheet-specific hazard below.
  t("plain values pass through", csvEscape("Kansas City") === "Kansas City");
  t("a comma forces quotes", csvEscape("Smith, John") === '"Smith, John"');
  t("embedded quotes are doubled", csvEscape('He said "no"') === '"He said ""no"""');
  t("newlines are quoted", csvEscape("a\nb") === '"a\nb"');
  t("null and undefined become empty", csvEscape(null) === "" && csvEscape(undefined) === "");
  t("numbers survive", csvEscape(0) === "0" && csvEscape(24) === "24");

  // THE one that matters: a username is user-controlled text, and Excel
  // executes a cell beginning with = + - or @ as a formula.
  for (const bad of ["=1+1", "+SUM(A1)", "-2", "@cmd"]) {
    t(`"${bad}" can't run as a spreadsheet formula`, csvEscape(bad).startsWith("'"));
  }
  t("...and a normal name starting with a letter is untouched", csvEscape("Nikos") === "Nikos");

  t("output starts with a UTF-8 BOM so Excel reads accents",
    toCsv([["a"]]).charCodeAt(0) === 0xFEFF);
  t("rows are CRLF separated", toCsv([["a"], ["b"]]).includes("\r\n"));

  // Standings
  {
    const standings = [
      { username: "A", points: 40, correct: 30, gamesScored: 40, totalBonus: 10, tiesCalled: 1,
        medals: 2, sweepWeeks: 1, nearWeeks: 0, sharpWeeks: 2, superbowlCorrect: 1,
        conferenceCorrect: 2, divisionCorrect: 3 },
      { username: "B,comma", points: 20, correct: 15, gamesScored: 40 },
    ];
    const csv = buildStandingsCsv(standings);
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    t("a header plus one row per player", lines.length === 3);
    t("rank is 1-based and in order", lines[1].startsWith("1,A,40") && lines[2].startsWith("2,"));
    t("accuracy is computed", lines[1].includes(",75,"));
    t("a comma in a name doesn't break the columns", lines[2].includes('"B,comma"'));
    // Naive comma-splitting would trip over the quoted name above, so the
    // column count is checked on a row that has no comma in it.
    const plain = buildStandingsCsv([{ username: "Solo", points: 5, correct: 4, gamesScored: 8 }])
      .replace(/^﻿/, "").trim().split("\r\n");
    t("missing optional fields become 0, not blank or NaN",
      !plain[1].includes("NaN") && plain[1].split(",").length === plain[0].split(",").length);
    t("...and they read as 0", plain[1].endsWith(",0,0,0,0,0,0,0,0"));
    t("nobody scored yet leaves accuracy empty rather than dividing by zero",
      !buildStandingsCsv([{ username: "C", points: 0, correct: 0, gamesScored: 0 }]).includes("NaN"));
  }

  // Picks grid
  {
    const fixtures = REGULAR_SEASON_FIXTURES.slice(0, 3);
    const members = [{ uid: "a", username: "Ann" }, { uid: "b", username: "Bob" }];
    const allPredictions = {
      a: { picks: { [fixtures[0].id]: { winner: "H" }, [fixtures[1].id]: { winner: "T" } } },
      b: { picks: { [fixtures[0].id]: { winner: "A" } } },
    };
    const results = { [fixtures[0].id]: { homeScore: 24, awayScore: 17 } };
    const csv = buildPicksCsv({ fixtures, members, allPredictions, results });
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    t("one row per game plus a header", lines.length === 4);
    t("a column per player, named", lines[0].endsWith(",Ann,Bob"));
    t("the home pick resolves to the home team", lines[1].endsWith(`,${fixtures[0].home},${fixtures[0].away}`));
    t("the winner column reads from the score", lines[1].includes(`,${fixtures[0].home},`));
    t("a tie pick is written as TIE", lines[2].includes("TIE"));
    t("an unpicked game leaves the cell empty, not 'undefined'", !csv.includes("undefined"));
    t("every row has the same column count",
      new Set(lines.map(l => l.split(",").length)).size === 1);
    // A drawn game must read TIE, not fall through to the home team.
    const drawn = buildPicksCsv({ fixtures: [fixtures[0]], members: [], allPredictions: {},
      results: { [fixtures[0].id]: { homeScore: 20, awayScore: 20 } } });
    t("a drawn game's winner is TIE", drawn.includes("TIE"));
  }

  // Season picks
  {
    const members = [{ uid: "a", username: "Ann" }];
    const csv = buildSeasonPicksCsv({
      pickTypes: SPECIAL_PICK_TYPES, members,
      allPredictions: { a: { specials: { superbowl: "KC" } } },
      specialResults: { superbowl: "BUF" },
    });
    const lines = csv.replace(/^﻿/, "").trim().split("\r\n");
    t("one row per season pick", lines.length === SPECIAL_PICK_TYPES.length + 1);
    t("the actual winner sits next to the guesses", lines.some(l => l.includes("BUF") && l.includes("KC")));
  }

  t("the filename carries league, kind, season and date",
    /^scoreclash-My-League-standings-2026-\d{4}-\d{2}-\d{2}\.csv$/
      .test(csvFilename("My League!", "standings", 2026, Date.UTC(2026, 8, 14, 12))));
  t("a league named with only symbols still produces a usable filename",
    csvFilename("***", "picks", 2026).startsWith("scoreclash-league-picks-"));
}

// ────────────────────────────────────────────────────────────────────────────
group("Undo");
{
  const entry = (kind, target, detail, extra = {}) =>
    makeEntry({ kind, actorUid: "u1", actorName: "K", target, detail, leagueId: "ABC", ...extra });

  // ── THE central guarantee ────────────────────────────────────────────────
  // Undo must refuse when anything has touched the value since. Without this,
  // undoing an old entry silently overwrites a newer, correct change.
  {
    const e = entry("result_changed", "w1_1",
      { before: { homeScore: 21, awayScore: 17 }, after: { homeScore: 24, awayScore: 17 } });
    const unchanged = planUndo(e, { homeScore: 24, awayScore: 17, enteredAt: 999 });
    t("undo works while the value still matches the entry", unchanged.ok);
    t("...and puts the old score back",
      unchanged.action.type === "result.set" && unchanged.action.homeScore === 21);
    t("bookkeeping fields don't make it look stale", unchanged.ok);

    const moved = planUndo(e, { homeScore: 30, awayScore: 0 });
    t("REFUSED once somebody else has changed it", !moved.ok);
    t("...and says why", /changed this since/i.test(moved.reason));

    const gone = planUndo(e, null);
    t("REFUSED if the value was cleared since", !gone.ok);
  }

  // Every direction of a result change
  {
    const set = entry("result_set", "w1_2", { before: null, after: { homeScore: 10, awayScore: 7 } });
    const p = planUndo(set, { homeScore: 10, awayScore: 7 });
    t("undoing a first-time score clears it", p.ok && p.action.type === "result.clear");

    const cleared = entry("result_cleared", "w1_3", { before: { homeScore: 14, awayScore: 3 } });
    const q = planUndo(cleared, null);
    t("undoing a clear puts the score back", q.ok && q.action.type === "result.set" && q.action.awayScore === 3);
  }

  // Season winners, playoff matchups, picks, scoring
  {
    const sp = entry("special_changed", "conf_AFC", { before: "KC", after: "BUF" });
    t("a season winner reverts", planUndo(sp, "BUF").ok);
    t("...and is refused if it moved again", !planUndo(sp, "BAL").ok);

    const po = entry("playoff_changed", "po_sb", {
      before: { home: "KC", away: "PHI", kickoffUTC: "2027-02-14T23:30:00Z" },
      after: { home: "BUF", away: "DAL", kickoffUTC: "2027-02-14T23:30:00Z" },
    });
    const pp = planUndo(po, { home: "BUF", away: "DAL", kickoffUTC: "2027-02-14T23:30:00Z" });
    t("a playoff matchup reverts", pp.ok && pp.action.matchup.home === "KC");
    t("...and a changed kickoff counts as touched",
      !planUndo(po, { home: "BUF", away: "DAL", kickoffUTC: "2027-02-15T00:00:00Z" }).ok);

    const ov = entry("pick_override", "u2:w1_1",
      { targetUid: "u2", username: "BOB", fixtureId: "w1_1", before: "A", after: "H" });
    const op = planUndo(ov, "H");
    t("an overridden pick reverts to what they had", op.ok && op.action.type === "pick.set" && op.action.winner === "A");
    const ov2 = entry("pick_override", "u2:w1_1",
      { targetUid: "u2", username: "BOB", fixtureId: "w1_1", before: null, after: "H" });
    t("...or is removed if they'd made no pick", planUndo(ov2, "H").action.type === "pick.clear");

    const sc = entry("scoring_changed", "ABC",
      { before: { ...DEFAULT_SCORING, sweepBonus: 8 }, after: { ...DEFAULT_SCORING, sweepBonus: 12 } });
    t("scoring reverts to the old values",
      planUndo(sc, { ...DEFAULT_SCORING, sweepBonus: 12 }, { leagueId: "ABC" }).action.settings.sweepBonus === 8);
    t("...and is refused after another edit",
      !planUndo(sc, { ...DEFAULT_SCORING, sweepBonus: 9 }, { leagueId: "ABC" }).ok);

    const ad = entry("admins_changed", "ABC", { targetUid: "u3", username: "SAM", promoted: true });
    const ap = planUndo(ad, ["u3"], { leagueId: "ABC" });
    t("a promotion reverts", ap.ok && ap.action.makeAdmin === false);
    t("...and is refused if they're no longer an admin anyway", !planUndo(ad, [], { leagueId: "ABC" }).ok);
  }

  // What must never offer an undo
  for (const kind of ["member_removed", "restore", "fetch_results"]) {
    const p = planUndo(entry(kind, "x", { before: 1, after: 2 }), null);
    t(`${kind} is refused with a reason`, !p.ok && p.reason.length > 20);
  }
  t("every not-undoable kind is a real kind",
    Object.keys(NOT_UNDOABLE).every(k => !!AUDIT_KINDS[k]));
  t("no kind is both undoable and not",
    !Object.keys(NOT_UNDOABLE).some(k => undoTargetOf({ kind: k })));

  // Entries written before undo existed simply don't offer it.
  t("an entry with no detail can't be undone",
    !hasUndoDetail({ kind: "result_changed", detail: null })
    && !planUndo({ kind: "result_changed", detail: null }, null).ok);
  t("a nonsense entry is refused", !planUndo(null, null).ok);
}

// ────────────────────────────────────────────────────────────────────────────
group("Playoff placeholders");
{
  // The whole design rests on these ids never changing: picks and results are
  // filed against them from day one, and the teams are attached months later.
  // Renaming one silently orphans every pick made against it.
  const ids = PLAYOFF_FIXTURES.map(f => f.id);
  t("13 playoff slots — 6 wild card, 4 divisional, 2 conference, 1 final",
    PLAYOFF_FIXTURES.length === 13);
  t("ids are unique", new Set(ids).size === ids.length);
  t("ids never collide with regular-season ids",
    !REGULAR_SEASON_FIXTURES.some(f => ids.includes(f.id)));
  for (const [round, count] of [["wildcard", 6], ["divisional", 4], ["conference", 2], ["superbowl", 1]]) {
    t(`${round}: ${count} slots`, PLAYOFF_FIXTURES.filter(f => f.round === round).length === count);
  }
  t("every round id is a real round",
    PLAYOFF_FIXTURES.every(f => PLAYOFF_ROUNDS.some(r => r.id === f.round)));
  t("conference games are split evenly between AFC and NFC",
    ["wildcard", "divisional", "conference"].every(r => {
      const inRound = PLAYOFF_FIXTURES.filter(f => f.round === r);
      return inRound.filter(f => f.conf === "AFC").length === inRound.filter(f => f.conf === "NFC").length;
    }));
  t("only the Super Bowl is cross-conference",
    PLAYOFF_FIXTURES.filter(f => f.conf === null).length === 1);

  // A placeholder carries no teams and no kickoff, which is exactly why it
  // must stay shut until an admin fills it in.
  t("placeholders ship with no teams", PLAYOFF_FIXTURES.every(f => !f.home && !f.away));
  t("...and no kickoff", PLAYOFF_FIXTURES.every(f => !f.kickoffUTC));
  t("a bare placeholder is not ready", PLAYOFF_FIXTURES.every(f => !isPlayoffMatchupReady(f)));

  // REGRESSION: teams alone used to open a game that could then never lock,
  // because a playoff slot has no week to derive a fallback time from.
  t("teams without a kickoff is still not ready",
    !isPlayoffMatchupReady({ home: "KC", away: "BUF" }));
  t("teams plus a kickoff is ready",
    isPlayoffMatchupReady({ home: "KC", away: "BUF", kickoffUTC: "2027-01-17T21:00:00Z" }));
  t("a playoff slot has no derived lock time of its own",
    PLAYOFF_FIXTURES.every(f => effectiveKickoffUTC(f) === null));

  // Picks and results hang off the id, so scoring must walk playoff slots too.
  t("playoff slots are scorable",
    ids.every(id => SCORABLE_FIXTURES.some(f => f.id === id)));

  // The Super Bowl's kickoff is already known and in the data — the admin
  // form prefills from it rather than asking someone to remember it.
  t("the Super Bowl kickoff is available to prefill",
    !!SEASON.playoffs?.superBowl?.kickoffUTC && !isNaN(new Date(SEASON.playoffs.superBowl.kickoffUTC)));

  // A pick survives the teams being attached, and scores against them.
  {
    const sb = PLAYOFF_FIXTURES.find(f => f.round === "superbowl");
    const league = { members: ["a"] }, users = { a: { username: "A" } };
    const preds = { a: { picks: { [sb.id]: { winner: "H" } }, specials: {} } };
    t("a pick made before the teams are known scores once they are",
      calcStandings(league, users, preds, { [sb.id]: { homeScore: 27, awayScore: 24 } }, {}, SC)[0].points
        === SC.correctPoints);
    t("...and no week bonus comes from a playoff game",
      calcStandings(league, users, preds, { [sb.id]: { homeScore: 27, awayScore: 24 } }, {}, SC)[0].bonusPoints === 0);
  }
}

// ────────────────────────────────────────────────────────────────────────────
group("Avatars");
{
  const all = AVATAR_GROUPS.flatMap(g => g.avatars);
  t("the flat list matches the groups", PRESET_AVATARS.length === all.length);
  t("plenty to choose from", all.length >= 100, `${all.length} avatars`);
  // The EMOJI is the stored identity, so a duplicate would light up two tiles
  // as "selected" at once.
  const emojis = all.map(a => a.emoji);
  t("no duplicate emoji", new Set(emojis).size === emojis.length,
    [...new Set(emojis.filter((e, i) => emojis.indexOf(e) !== i))].join(" "));
  const keys = all.map(a => a.id);
  t("no duplicate React keys", new Set(keys).size === keys.length);
  t("every avatar has a label", all.every(a => a.label && a.label.length > 0));
  t("every group has a label and at least one avatar",
    AVATAR_GROUPS.every(g => g.id && g.label && g.avatars.length > 0));
}

// ────────────────────────────────────────────────────────────────────────────
group("Shoutout lines");
{
  const ALL = [
    ["SOLO_MISS", SOLO_MISS], ["GROUP_MISS", GROUP_MISS], ["LONE_CALL", LONE_CALL],
    ["SWEEP_LINES", SWEEP_LINES], ["NEAR_LINES", NEAR_LINES], ["SHARP_LINES", SHARP_LINES],
  ];
  const KNOWN = new Set(["name", "game", "winner", "loser", "score", "week", "games", "correct", "points"]);

  t("the miss pool is big enough not to repeat within a season", SOLO_MISS.length >= 100, `${SOLO_MISS.length} lines`);
  t("the upset pool is substantial too", LONE_CALL.length >= 40, `${LONE_CALL.length} lines`);

  for (const [label, pool] of ALL) {
    t(`${label}: no duplicate lines`, new Set(pool).size === pool.length,
      `${pool.length - new Set(pool).size} dupes`);
    const bad = pool.filter(l => (l.match(/\{([a-z]+)\}/g) || [])
      .some(tok => !KNOWN.has(tok.slice(1, -1))));
    t(`${label}: no unknown placeholders`, bad.length === 0, bad[0] || "");
    // A shoutout that never says who it's about is just a sentence.
    t(`${label}: every line names somebody`, pool.every(l => l.includes("{name}")));
    t(`${label}: nothing left unterminated`, pool.every(l => !/\{[^}]*$/.test(l)));
  }

  // Determinism is the whole design — see the header of lib/shoutouts.js.
  const seed = "ABC123:1:clown:w1_3:Jack";
  t("the same row always draws the same line",
    pickLine(SOLO_MISS, seed) === pickLine(SOLO_MISS, seed));
  t("a different row draws a different line",
    pickLine(SOLO_MISS, seed) !== pickLine(SOLO_MISS, "ABC123:1:clown:w1_9:Jack"));
  t("hashSeed spreads near-identical seeds",
    new Set(["w1_1", "w1_2", "w1_3", "w1_4", "w1_5"].map(s => hashSeed(s) % SOLO_MISS.length)).size >= 4);

  // Two rows in one week must never land on the same joke.
  {
    const used = new Set();
    const picks = ["w1_1", "w1_2", "w1_3", "w1_4", "w1_5", "w1_6"]
      .map(id => pickLine(SOLO_MISS, `L:1:clown:${id}:Jack`, used));
    t("de-duplication holds across a week's rows", new Set(picks).size === picks.length);
  }
  {
    // Forced collision: a two-line pool asked for three lines still can't
    // crash or return undefined.
    const used = new Set();
    const tiny = ["{name} a", "{name} b"];
    const out = [1, 2, 3].map(i => pickLine(tiny, `s${i}`, used));
    t("an exhausted pool still returns a real line", out.every(x => typeof x === "string" && x.length > 0));
  }

  // Placeholder filling
  const vars = { name: "Jack", game: "Bears @ Panthers", winner: "Panthers", loser: "Bears", score: "24-17" };
  t("placeholders are substituted",
    fillTemplate("{name} backed {loser} in {game}.", vars) === "Jack backed Bears in Bears @ Panthers.");
  t("the name is marked so it can be bolded",
    templateParts("hi {name}", vars).some(p => p.key === "name" && p.value === "Jack"));
  t("a filled line never leaves braces behind",
    !/[{}]/.test(SOLO_MISS.map(l => fillTemplate(l, { ...vars, week: 1, games: 16, correct: 15, points: 3 })).join(" ")));

  // A tied game has no winner or loser — lines naming one must be filtered
  // out rather than rendered with a hole in them.
  {
    const tieVars = { name: "Jack", game: "Bears @ Panthers", score: "20-20" };
    const pool = usablePool(SOLO_MISS, tieVars);
    t("lines needing a winner are dropped when there isn't one",
      pool.length > 0 && pool.every(l => !l.includes("{winner}") && !l.includes("{loser}")));
    t("...and what's left still fills cleanly",
      !/[{}]/.test(pool.map(l => fillTemplate(l, tieVars)).join(" ")));
    t("usablePool never returns nothing", usablePool(SOLO_MISS, {}).length > 0);
  }

  // Badge lines need the week-bonus numbers, which come from weekAccuracyBadge.
  {
    const g = scenario({ a: { 1: 1 } });
    const badge = weekAccuracyBadge("a", 1, g.preds, g.results, SC);
    const filled = fillTemplate(NEAR_LINES[0], {
      name: "A", week: 1, games: badge.games, correct: badge.games - badge.misses, points: badge.points,
    });
    t("a badge line fills from the real badge object", !/[{}]/.test(filled) && filled.includes("+5"));
  }
}

// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${total - failures}/${total} passed.`);
if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
