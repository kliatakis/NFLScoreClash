// ─── GAME-DAY REFRESH ───────────────────────────────────────────────────────
//
// THE PROBLEM THIS SOLVES
// ───────────────────────
// The results cron runs once a day at 06:00 UTC — Vercel's free plan allows
// exactly one scheduled job per day, so it can't run more often.
//
// Sunday's games kick off at 17:00 UTC and the late ones finish around 03:30
// UTC Monday. Those scores therefore don't land until 06:00 UTC Monday. In
// Athens that means the standings sit frozen through the entire Sunday
// evening — the one window when everybody is actually watching and actually
// cares — and only update while everyone's asleep.
//
// So the app refreshes itself: when somebody opens it and a game is in
// progress, it asks the same endpoint the cron uses for the latest scores.
// The person watching the games is the trigger, which is exactly the moment
// fresh scores are worth fetching.
//
// WHY THIS DOESN'T HAMMER ANYTHING
// ────────────────────────────────
//   * It only fires while a game has actually kicked off and has no result.
//     Outside those windows — most of the week — it does nothing at all.
//   * It's throttled through localStorage, so every tab and every reload on a
//     device shares one timer. Five friends refreshing all evening is a few
//     dozen calls, each one ESPN request and at most one small write.
//   * The endpoint never writes anything but real finished scores it has
//     validated, and it will not overwrite a score that already exists.
//
// Pure decision logic; the caller does the fetching.

import { REGULAR_SEASON_FIXTURES, PLAYOFF_FIXTURES, effectiveKickoffUTC } from "../data/fixtures.js";

export const REFRESH_THROTTLE_MS = 5 * 60 * 1000;

// An NFL game runs about three hours. Six covers overtime, a long delay, and
// the gap before ESPN marks it final — after that the daily cron can have it.
export const IN_PROGRESS_WINDOW_MS = 6 * 60 * 60 * 1000;

const STORAGE_KEY = "sc_lastResultsRefresh";

// Games that have started but have no score yet. Playoff slots need the
// admin-set kickoff merged in, since the placeholder itself has no time.
export function gamesInProgress(results = {}, now = Date.now(), playoffMatchups = {}) {
  const all = [
    ...REGULAR_SEASON_FIXTURES,
    ...PLAYOFF_FIXTURES.map(f => ({ ...f, ...(playoffMatchups[f.id] || {}) })),
  ];
  return all.filter(f => {
    if (results[f.id]) return false;
    // effectiveKickoffUTC rather than the raw field: Week 18 has no announced
    // times, and its derived Saturday is close enough to be worth checking.
    const kickoff = effectiveKickoffUTC(f);
    if (!kickoff) return false;
    const t = new Date(kickoff).getTime();
    if (!Number.isFinite(t)) return false;
    return t <= now && now - t <= IN_PROGRESS_WINDOW_MS;
  });
}

export function shouldRefresh({ results = {}, now = Date.now(), lastRefreshAt = null, playoffMatchups = {} } = {}) {
  // A clock that's moved backwards (or a corrupt stored value) must not lock
  // refreshing out forever — treat anything in the future as "no record".
  if (typeof lastRefreshAt === "number" && Number.isFinite(lastRefreshAt)
      && lastRefreshAt <= now && now - lastRefreshAt < REFRESH_THROTTLE_MS) {
    return false;
  }
  return gamesInProgress(results, now, playoffMatchups).length > 0;
}

// localStorage is shared across tabs, which is the point: three open tabs
// shouldn't mean three times the requests. Wrapped because Safari in private
// mode throws on access rather than returning null.
export function readLastRefresh() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const n = raw == null ? null : Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch { return null; }
}

export function writeLastRefresh(now = Date.now()) {
  try { localStorage.setItem(STORAGE_KEY, String(now)); } catch { /* nothing to do */ }
}
