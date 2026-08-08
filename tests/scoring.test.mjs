// ScoreClash scoring regression suite.
//
// Plain Node, no test framework — run it with:  npm test
// Exits non-zero if anything fails, so it works as a pre-deploy check.
//
// It imports the REAL source, not a copy, so it fails when the rules change
// underneath it. Everything here is a rule someone could plausibly break by
// accident; several of these assertions exist because that already happened.

import {
  REGULAR_SEASON_FIXTURES, PLAYOFF_FIXTURES, SCORABLE_FIXTURES, SPECIAL_PICK_TYPES,
  effectiveKickoffUTC, isPlayoffMatchupReady,
} from "../src/data/fixtures.js";
import {
  DEFAULT_SCORING, getScoringSettings, pickWinner, resultWinner, classifyPick,
  calcMatchScore, weekAccuracyBadge, calcStandings, calcWeeklyStandings,
  computeWeeklyRecap, computeHighlights, headToHead, weeklyWinTally,
  calcSeasonProgression, explainTiebreak, finishedWeeks, completedWeeks, describeBonuses,
  pickStreaks, liveWeekStatus, pendingPickers,
} from "../src/lib/scoring.js";
import { TEAMS, TEAM_CODES, teamsForSpecialPick } from "../src/data/teams.js";
import { css } from "../src/theme.js";
import {
  buildBackup, validateBackup, planRestore, describePlan, countBackup,
  backupFilename, BACKUP_VERSION, BACKUP_APP,
} from "../src/lib/backup.js";
import { planResultWrites, findFixture } from "../src/lib/resultsMatching.js";
import { espnDateRange } from "../src/lib/resultsProviders.js";

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
t("SCORABLE_FIXTURES = regular season + playoffs",
  SCORABLE_FIXTURES.length === REGULAR_SEASON_FIXTURES.length + PLAYOFF_FIXTURES.length);

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
    completed: true, isRegularSeason: true, seasonYear: 2026, week: real.week,
  };
  const run = (games, currentScores = {}) => planResultWrites({ games, currentScores, seasonYear: 2026 });

  t("a completed regular-season game is written", run([base]).updatedCount === 1);
  t("...to the right fixture", Object.keys(run([base]).writes)[0] === `scores.${real.id}`);

  // Every one of these must be REFUSED. Each is a way a wrong score could end
  // up against a real fixture.
  const refuses = [
    ["a game still in progress", { ...base, completed: false }, "not_completed"],
    ["a preseason game", { ...base, isRegularSeason: false }, "not_regular_season"],
    ["a game whose type is unknown", { ...base, isRegularSeason: null }, "not_regular_season"],
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
  const mixed = run([base, { ...base, completed: false }, { ...base, isRegularSeason: false }]);
  t("a mixed batch writes only the valid game", mixed.updatedCount === 1);
}

// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${total - failures}/${total} passed.`);
if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
