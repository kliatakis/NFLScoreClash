// ─── PRESEASON IMPORT ───────────────────────────────────────────────────────
//
// Turns a list of fixtures from ESPN into "write these teams into these
// slots". Pure — no network, no Firestore — so the awkward parts (which week,
// which slot, what's already there) can be tested directly.
//
// Rules, in order of importance:
//
//   1. NEVER overwrite a slot that's already set. An admin who typed a game
//      in by hand, or imported once already, must not have it silently
//      replaced by a second press of the button.
//   2. Never add the same matchup twice. The same two teams appearing in two
//      slots in one week would be scored twice and look like a bug.
//   3. Games go into the trial week ESPN reports, not the one on screen.
//      Importing a preseason Week 2 game into the slot labelled Week 1 would
//      make the wipe-by-week button lie about what it's clearing.

import { preseasonFixturesForWeek, PRESEASON_WEEKS, isPreseasonGameReady } from "../data/fixtures.js";

export function planPreseasonImport(games = [], existingSlots = {}, { defaultWeek = 1 } = {}) {
  const writes = [];
  const skipped = [];

  // Which matchups a week already holds, so a repeat press adds nothing.
  const takenByWeek = {};
  for (const w of PRESEASON_WEEKS) {
    takenByWeek[w] = new Set(
      preseasonFixturesForWeek(w)
        .map(f => existingSlots[f.id])
        .filter(m => m && m.home && m.away)
        .map(m => `${m.away}@${m.home}`)
    );
  }

  // Free slots per week, in id order, so imports fill from the top.
  const freeByWeek = {};
  for (const w of PRESEASON_WEEKS) {
    freeByWeek[w] = preseasonFixturesForWeek(w).filter(f => {
      const m = existingSlots[f.id];
      return !(m && (m.home || m.away));   // anything part-filled is left alone
    });
  }

  for (const g of games) {
    if (!g || !g.home || !g.away || !g.kickoffUTC) { skipped.push({ game: g, reason: "incomplete" }); continue; }
    if (g.home === g.away) { skipped.push({ game: g, reason: "same_team_twice" }); continue; }

    const week = PRESEASON_WEEKS.includes(g.preWeek) ? g.preWeek : defaultWeek;
    const key = `${g.away}@${g.home}`;

    if (takenByWeek[week]?.has(key)) { skipped.push({ game: g, week, reason: "already_set" }); continue; }
    const slot = freeByWeek[week]?.shift();
    if (!slot) { skipped.push({ game: g, week, reason: "week_full" }); continue; }

    takenByWeek[week].add(key);
    writes.push({
      fixtureId: slot.id,
      week,
      matchup: { home: g.home, away: g.away, kickoffUTC: g.kickoffUTC },
      label: `${g.away} @ ${g.home}`,
    });
  }

  return { writes, skipped, weeks: [...new Set(writes.map(w => w.week))].sort((a, b) => a - b) };
}

// One line per reason, for the confirmation dialog. Silence about skipped
// games would make a partial import look like a broken one.
export function describeImport(plan) {
  const lines = plan.writes.map(w => `Week ${w.week} · ${w.label}`);
  const reasons = {};
  for (const s of plan.skipped) reasons[s.reason] = (reasons[s.reason] || 0) + 1;
  const notes = Object.entries(reasons).map(([reason, n]) => {
    const words = {
      already_set: "already set up",
      week_full: "no free slot left in that week",
      incomplete: "missing teams or a kickoff time",
      same_team_twice: "the same team on both sides",
    }[reason] || reason.replace(/_/g, " ");
    return `${n} skipped — ${words}`;
  });
  return { lines, notes };
}

// Guard for the caller: a slot that ends up part-filled would open for picks
// and never lock. Every planned write must be complete.
export function importIsSafe(plan) {
  return plan.writes.every(w => isPreseasonGameReady(w.matchup));
}
