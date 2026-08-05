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
} from "../src/lib/scoring.js";
import { TEAMS, TEAM_CODES, teamsForSpecialPick } from "../src/data/teams.js";

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
console.log(`\n${total - failures}/${total} passed.`);
if (failures) { console.error(`${failures} FAILED`); process.exit(1); }
