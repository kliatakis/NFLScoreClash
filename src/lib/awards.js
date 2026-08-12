// ─── SEASON AWARDS ──────────────────────────────────────────────────────────
//
// The closing ceremony. A league that runs from September to February needs
// somewhere for the arguments to land at the end — a table tells you who won,
// but not who called the impossible game in Week 3 or who spent the season
// disagreeing with everybody and being wrong about it.
//
// Two rules keep it honest:
//
//   * An award with no real winner is NOT shown. A season with no ties has no
//     "Tie Whisperer"; an award handed out for zero of something reads as
//     filler and devalues the ones that were earned.
//
//   * Everything is derived from picks and results, like the rest of the app.
//     Nothing here is stored, so it can never disagree with the standings.
//
// Pure. No React, no Firestore.

import {
  calcStandings, calcWeeklyStandings, pickStreaks,
  classifyPick, pickWinner, resultWinner, finishedWeeks, DEFAULT_SCORING,
} from "./scoring.js";
import { REGULAR_SEASON_FIXTURES, SCORABLE_FIXTURES } from "../data/fixtures.js";

const nameOf = (allUsers, uid) => allUsers[uid]?.username || "Unknown";

export function computeSeasonAwards(league, allUsers, allPredictions, results, specialResults = {}, scoring = DEFAULT_SCORING) {
  const members = league?.members || [];
  const awards = [];
  if (members.length === 0) return awards;

  const standings = calcStandings(league, allUsers, allPredictions, results, specialResults, scoring);
  const scored = Object.keys(results).length > 0;
  if (!scored || standings.length === 0) return awards;

  const add = (a) => { if (a && a.winner) awards.push(a); };

  // ── The table itself ─────────────────────────────────────────────────────
  const champ = standings[0];
  add({
    id: "champion", icon: "🏆", label: "Champion", tone: "gold",
    winner: champ.username, detail: `${champ.points} points`,
  });

  if (standings.length > 1) {
    const last = standings[standings.length - 1];
    add({
      id: "spoon", icon: "🚽", label: "The Sacko", tone: "bad",
      winner: last.username, detail: `${last.points} points — somebody had to`,
    });
  }

  // ── Best single week ─────────────────────────────────────────────────────
  {
    let best = null;
    for (const week of finishedWeeks(results)) {
      // Note the argument order: scoring comes BEFORE week in this one.
      for (const row of calcWeeklyStandings(league, allUsers, allPredictions, results, scoring, week)) {
        if (row.played === 0) continue;
        if (!best || row.points > best.points) best = { ...row, week };
      }
    }
    if (best) {
      add({
        id: "best-week", icon: "🎯", label: "Best Week", tone: "good",
        winner: best.username,
        detail: `${best.correct} from ${best.gamesInWeek} in Week ${best.week} · ${best.points} points`,
      });
    }
  }

  // ── Longest correct run ──────────────────────────────────────────────────
  {
    let best = null;
    for (const uid of members) {
      const s = pickStreaks(uid, allPredictions, results);
      if (s.best > 0 && (!best || s.best > best.best)) best = { uid, best: s.best };
    }
    if (best && best.best >= 3) {
      add({
        id: "streak", icon: "🔥", label: "Longest Streak", tone: "good",
        winner: nameOf(allUsers, best.uid), detail: `${best.best} correct picks in a row`,
      });
    }
  }

  // ── Week bonuses ─────────────────────────────────────────────────────────
  {
    const sweeps = standings.filter(s => s.sweepWeeks > 0).sort((a, b) => b.sweepWeeks - a.sweepWeeks);
    if (sweeps.length) {
      add({
        id: "sweeps", icon: "🧹", label: "Most Clean Sweeps", tone: "good",
        winner: sweeps[0].username,
        detail: `${sweeps[0].sweepWeeks} perfect week${sweeps[0].sweepWeeks === 1 ? "" : "s"}`,
      });
    }
    const medals = standings.filter(s => s.medals > 0).sort((a, b) => b.medals - a.medals);
    if (medals.length) {
      add({
        id: "medals", icon: "🏅", label: "Most Weeks Won", tone: "good",
        winner: medals[0].username,
        detail: `top of the pile in ${medals[0].medals} week${medals[0].medals === 1 ? "" : "s"}`,
      });
    }
    const ties = standings.filter(s => s.tiesCalled > 0).sort((a, b) => b.tiesCalled - a.tiesCalled);
    if (ties.length) {
      add({
        id: "ties", icon: "🤝", label: "Tie Whisperer", tone: "gold",
        winner: ties[0].username,
        detail: `called ${ties[0].tiesCalled} tie${ties[0].tiesCalled === 1 ? "" : "s"} — roughly one a season exists`,
      });
    }
  }

  // ── Per-game analysis: the lone right call, the lone wrong one, and who
  //    spent the season disagreeing with everyone. ───────────────────────────
  {
    let bestUpset = null;   // fewest people right, and they were one of them
    let worstMiss = null;   // most people right, and they weren't
    const contrarian = {};  // uid -> picks that went against the majority
    const againstAll = {};  // uid -> picks nobody else agreed with

    for (const f of SCORABLE_FIXTURES) {
      const result = results[f.id];
      if (!result) continue;
      const made = [];
      for (const uid of members) {
        const kind = classifyPick((allPredictions[uid]?.picks || {})[f.id], result);
        if (!kind) continue;
        made.push({ uid, correct: kind === "correct", side: pickWinner((allPredictions[uid]?.picks || {})[f.id]) });
      }
      if (made.length < 2) continue;

      const right = made.filter(m => m.correct);
      const wrong = made.filter(m => !m.correct);

      if (right.length === 1 && wrong.length >= 2) {
        const cand = { uid: right[0].uid, against: wrong.length, fixture: f, result };
        if (!bestUpset || cand.against > bestUpset.against) bestUpset = cand;
      }
      if (wrong.length === 1 && right.length >= 2) {
        const cand = { uid: wrong[0].uid, against: right.length, fixture: f, result };
        if (!worstMiss || cand.against > worstMiss.against) worstMiss = cand;
      }

      // Majority side, for the contrarian count.
      const tally = {};
      for (const m of made) if (m.side) tally[m.side] = (tally[m.side] || 0) + 1;
      const top = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
      if (top) {
        for (const m of made) {
          if (!m.side) continue;
          if (m.side !== top[0]) contrarian[m.uid] = (contrarian[m.uid] || 0) + 1;
          if (tally[m.side] === 1 && made.length >= 3) againstAll[m.uid] = (againstAll[m.uid] || 0) + 1;
        }
      }
    }

    const gameName = (f, r) => {
      const w = resultWinner(r);
      const winner = w === "H" ? f.home : w === "A" ? f.away : "a tie";
      return `${f.away} @ ${f.home} — ${winner}`;
    };

    if (bestUpset) {
      add({
        id: "upset", icon: "🔮", label: "Call of the Season", tone: "gold",
        winner: nameOf(allUsers, bestUpset.uid),
        detail: `the only one to call ${gameName(bestUpset.fixture, bestUpset.result)}, against ${bestUpset.against} others`,
      });
    }
    if (worstMiss) {
      add({
        id: "howler", icon: "🤡", label: "Howler of the Season", tone: "bad",
        winner: nameOf(allUsers, worstMiss.uid),
        detail: `the only one to miss ${gameName(worstMiss.fixture, worstMiss.result)}, while ${worstMiss.against} got it`,
      });
    }

    const mostContrarian = Object.entries(contrarian).sort((a, b) => b[1] - a[1])[0];
    if (mostContrarian && mostContrarian[1] >= 5) {
      add({
        id: "contrarian", icon: "🪃", label: "Against the Grain", tone: "warn",
        winner: nameOf(allUsers, mostContrarian[0]),
        detail: `went against the league ${mostContrarian[1]} times`,
      });
    }
    const loneWolf = Object.entries(againstAll).sort((a, b) => b[1] - a[1])[0];
    if (loneWolf && loneWolf[1] >= 3 && loneWolf[0] !== mostContrarian?.[0]) {
      add({
        id: "lone-wolf", icon: "🐺", label: "Lone Wolf", tone: "warn",
        winner: nameOf(allUsers, loneWolf[0]),
        detail: `${loneWolf[1]} picks nobody else made`,
      });
    }
  }

  // ── Preseason picks ──────────────────────────────────────────────────────
  {
    const best = [...standings].sort((a, b) => (b.specialCorrect || 0) - (a.specialCorrect || 0))[0];
    if (best && (best.specialCorrect || 0) > 0) {
      add({
        id: "oracle", icon: "🔭", label: "The Oracle", tone: "gold",
        winner: best.username,
        detail: `${best.specialCorrect} season pick${best.specialCorrect === 1 ? "" : "s"} right, made back in August`,
      });
    }
  }

  // ── Accuracy, as a counterweight to raw points ───────────────────────────
  {
    const eligible = standings.filter(s => s.gamesScored >= 20);
    const best = [...eligible].sort((a, b) => (b.correct / b.gamesScored) - (a.correct / a.gamesScored))[0];
    if (best && best.username !== champ.username) {
      add({
        id: "accuracy", icon: "🎖️", label: "Best Accuracy", tone: "good",
        winner: best.username,
        detail: `${Math.round((best.correct / best.gamesScored) * 100)}% — more accurate than the champion`,
      });
    }
  }

  return awards;
}

// The Super Bowl being scored is what makes a season over.
export function isSeasonComplete(results) {
  const sb = SCORABLE_FIXTURES.find(f => f.id === "po_sb");
  return !!(sb && results[sb.id]);
}

export function awardsProgress(results) {
  const played = REGULAR_SEASON_FIXTURES.filter(f => results[f.id]).length;
  return { played, total: REGULAR_SEASON_FIXTURES.length };
}
