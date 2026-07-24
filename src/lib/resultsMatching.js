// ─── RESULTS MATCHING ───────────────────────────────────────────────────────
//
// Pure, provider-agnostic logic: takes normalized games (see
// resultsProviders.js) plus the scores we already have, and decides what — if
// anything — should be written. No network, no Firestore, no side effects, so
// it can be reasoned about and tested directly.
//
// The safety rule throughout is FAIL CLOSED: a game is only accepted if we
// can positively confirm it's a completed, regular-season game of the current
// season with usable scores. Anything ambiguous is skipped with a reason
// rather than guessed at — that's what stops an August preseason game or a
// January playoff game (same two teams, different competition) from being
// written into a regular-season fixture's slot.

import { REGULAR_SEASON_FIXTURES } from "../data/fixtures.js";

// Prefers an exact match on teams AND week, falling back to teams-only.
//
// The fallback exists because our stored schedule could disagree with a
// provider on a week number (a flexed game, or a slip in our own data), and
// silently dropping a real result would be worse than accepting it. It's safe
// specifically BECAUSE callers filter out non-regular-season games first —
// the dangerous cross-competition collisions never reach here. Which path
// matched is reported back, so schedule drift is visible instead of silent.
export function findFixture(game, fixtures = REGULAR_SEASON_FIXTURES) {
  const byTeamsAndWeek = fixtures.find(
    f => f.home === game.homeAbbr && f.away === game.awayAbbr && f.week === game.week
  );
  if (byTeamsAndWeek) return { fixture: byTeamsAndWeek, matchedBy: "teams_and_week" };

  const byTeams = fixtures.find(
    f => f.home === game.homeAbbr && f.away === game.awayAbbr
  );
  if (byTeams) return { fixture: byTeams, matchedBy: "teams_only" };

  return { fixture: null, matchedBy: null };
}

// Returns { writes, details, skipped, updatedCount }.
// `writes` is keyed by Firestore field path so the caller can update only the
// specific score keys — never the whole document, and never `specials`.
export function planResultWrites({ games, currentScores = {}, seasonYear, fixtures = REGULAR_SEASON_FIXTURES }) {
  const writes = {};
  const details = [];
  const skipped = {};
  let updatedCount = 0;

  const skip = (reason, info = {}) => {
    skipped[reason] = (skipped[reason] || 0) + 1;
    details.push({ status: reason, ...info });
  };

  for (const game of games) {
    const label = `${game.awayAbbr}@${game.homeAbbr}`;

    if (!game.completed) { skip("not_completed", { game: label }); continue; }

    // isRegularSeason is deliberately three-state — null means the provider
    // didn't tell us, which is treated the same as "no", not as "probably".
    if (game.isRegularSeason !== true) {
      skip("not_regular_season", { game: label, isRegularSeason: game.isRegularSeason });
      continue;
    }
    if (game.seasonYear !== seasonYear) {
      skip("wrong_season_year", { game: label, seasonYear: game.seasonYear, expected: seasonYear });
      continue;
    }
    if (game.homeScore == null || game.awayScore == null) {
      skip("missing_scores", { game: label });
      continue;
    }
    if (!game.homeAbbr || !game.awayAbbr) {
      skip("unmapped_team", { game: label });
      continue;
    }

    const { fixture, matchedBy } = findFixture(game, fixtures);
    if (!fixture) { skip("no_matching_fixture", { game: label, week: game.week }); continue; }
    if (currentScores[fixture.id]) { skip("already_exists", { fixtureId: fixture.id }); continue; }

    writes[`scores.${fixture.id}`] = {
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      enteredAt: Date.now(),
    };
    updatedCount++;
    details.push({
      status: "added",
      fixtureId: fixture.id,
      game: label,
      score: `${game.awayScore}-${game.homeScore}`,
      matchedBy, // "teams_only" => our schedule and the provider disagree on the week
    });
  }

  return { writes, details, skipped, updatedCount };
}
