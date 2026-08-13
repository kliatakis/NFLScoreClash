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
//   3. Weeks are worked out from the KICKOFF DATES, not from ESPN.
//
// ── Why not ESPN's week number ────────────────────────────────────────────
// It was, at first, and it was wrong. ESPN counts the Hall of Fame game as
// preseason week 1, so the first real preseason weekend comes back as week 2,
// the second as week 3, and the third as week 4. Importing put tonight's
// games into the slot labelled "Preseason Week 2", left Week 1 empty, and
// pushed the last weekend off the end of the range entirely.
//
// Grouping by date needs no agreement with the provider about numbering. The
// games sort themselves: a new week starts when a kickoff is more than five
// days after the first game of the current one — real preseason weekends run
// Thursday to Monday, and the gap to the next Thursday is seven.

import { preseasonFixturesForWeek, PRESEASON_WEEKS, isPreseasonGameReady } from "../data/fixtures.js";

const WEEK_GAP_MS = 5 * 24 * 60 * 60 * 1000;

// Splits fixtures into consecutive match weeks purely from their kickoffs.
// Exported for the tests and for the confirmation dialog, which shows the
// date range so an admin can see the grouping is right.
export function groupByMatchWeek(games = []) {
  const sorted = games
    .filter(g => g && g.kickoffUTC && Number.isFinite(new Date(g.kickoffUTC).getTime()))
    .sort((a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC));

  const groups = [];
  for (const g of sorted) {
    const t = new Date(g.kickoffUTC).getTime();
    const current = groups[groups.length - 1];
    if (!current || t - current.startsAt > WEEK_GAP_MS) {
      groups.push({ startsAt: t, endsAt: t, games: [g] });
    } else {
      current.endsAt = Math.max(current.endsAt, t);
      current.games.push(g);
    }
  }
  return groups;
}

export function planPreseasonImport(games = [], existingSlots = {}, { startWeek = 1 } = {}) {
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

  // Anything that can't be grouped at all is rejected up front, so the
  // date-bucketing below only ever sees usable fixtures.
  const usable = [];
  for (const g of games) {
    if (!g || !g.home || !g.away || !g.kickoffUTC) { skipped.push({ game: g, reason: "incomplete" }); continue; }
    if (g.home === g.away) { skipped.push({ game: g, reason: "same_team_twice" }); continue; }
    usable.push(g);
  }

  const groups = groupByMatchWeek(usable);
  const ranges = {};

  groups.forEach((group, i) => {
    const week = startWeek + i;
    // Three trial weeks exist. A fourth batch has nowhere to go, and saying
    // so beats silently dropping it.
    if (!PRESEASON_WEEKS.includes(week)) {
      for (const g of group.games) skipped.push({ game: g, reason: "no_week_left" });
      return;
    }
    ranges[week] = { startsAt: group.startsAt, endsAt: group.endsAt };

    for (const g of group.games) {
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
        kickoffUTC: g.kickoffUTC,
      });
    }
  });

  return {
    writes,
    skipped,
    ranges,
    weeks: [...new Set(writes.map(w => w.week))].sort((a, b) => a - b),
  };
}

// One line per reason, for the confirmation dialog. Silence about skipped
// games would make a partial import look like a broken one.
export function describeImport(plan, timezone) {
  // Grouped under a dated heading per week. The dates are the check: they let
  // an admin see at a glance that tonight's games really are going into
  // Week 1, which is exactly what went wrong when this trusted ESPN's
  // numbering.
  const lines = [];
  for (const week of plan.weeks) {
    const range = plan.ranges?.[week];
    lines.push(`— Preseason Week ${week}${range ? ` · ${describeRange(range, timezone)}` : ""} —`);
    for (const w of plan.writes.filter(x => x.week === week)) lines.push(`   ${w.label}`);
  }

  const reasons = {};
  for (const s of plan.skipped) reasons[s.reason] = (reasons[s.reason] || 0) + 1;
  const notes = Object.entries(reasons).map(([reason, n]) => {
    const words = {
      already_set: "already set up",
      week_full: "no free slot left in that week",
      no_week_left: "beyond the third trial week",
      incomplete: "missing teams or a kickoff time",
      same_team_twice: "the same team on both sides",
    }[reason] || reason.replace(/_/g, " ");
    return `${n} skipped — ${words}`;
  });
  return { lines, notes };
}

function describeRange({ startsAt, endsAt }, timezone) {
  const fmt = (ms) => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        weekday: "short", day: "numeric", month: "short", timeZone: timezone || undefined,
      }).format(new Date(ms));
    } catch { return new Date(ms).toDateString(); }
  };
  const a = fmt(startsAt), b = fmt(endsAt);
  return a === b ? a : `${a} – ${b}`;
}

// Guard for the caller: a slot that ends up part-filled would open for picks
// and never lock. Every planned write must be complete.
export function importIsSafe(plan) {
  return plan.writes.every(w => isPreseasonGameReady(w.matchup));
}
