// ─── RESULTS MATCHING ───────────────────────────────────────────────────────
//
// Pure, provider-agnostic logic: takes normalized games (see
// resultsProviders.js) plus the scores we already have, and decides what — if
// anything — should be written. No network, no Firestore, no side effects, so
// it can be reasoned about and tested directly.
//
// The safety rule throughout is FAIL CLOSED: a game is only accepted if we can
// positively confirm what competition it belongs to, that it's the current
// season, and that it has usable scores. Anything ambiguous is skipped with a
// reason rather than guessed at — that's what stops an August preseason game
// being written into a regular-season slot.
//
// PLAYOFFS
// ────────
// Postseason games are matched too, but ONLY against playoff slots an admin
// has already filled in, and only on teams. The pools are kept strictly
// apart: a regular-season game can never land in a playoff slot and a playoff
// game can never land in a regular-season one, even though the same two teams
// may well meet in both. That separation is the entire reason the teams-only
// fallback below is safe.

import { REGULAR_SEASON_FIXTURES, PRESEASON_FIXTURES } from "../data/fixtures.js";
import { TEAMS } from "../data/teams.js";

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

// Playoff slots carry no week — the round is decided by which slot an admin
// put the teams in — so this matches on teams alone. A postseason meeting
// between two teams happens at most once, single elimination, so there's
// nothing to disambiguate.
//
// `slots` are resolved placeholders: the fixture id from data/fixtures.js
// merged with the home/away an admin entered. A slot with no teams set is not
// a candidate, which is why a playoff result arriving before the matchup has
// been filled in is skipped rather than guessed at.
export function findPlayoffSlot(game, slots = []) {
  const match = slots.find(
    s => s.home && s.away && s.home === game.homeAbbr && s.away === game.awayAbbr
  );
  return match ? { fixture: match, matchedBy: "playoff_teams" } : { fixture: null, matchedBy: null };
}

// Returns { writes, details, skipped, updatedCount }.
// `writes` is keyed by Firestore field path so the caller can update only the
// specific score keys — never the whole document, and never `specials`.
export function planResultWrites({
  games, currentScores = {}, seasonYear,
  fixtures = REGULAR_SEASON_FIXTURES,
  // Resolved playoff slots: the placeholder id merged with the teams an admin
  // entered. Empty means "no playoff matchups set yet", and every postseason
  // game is then skipped as unmatched — which is correct, and shows up in the
  // fetcher health panel rather than disappearing.
  playoffSlots = [],
  // The preseason schedule — constants, like the regular season.
  preseasonSlots = PRESEASON_FIXTURES,
}) {
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

    // THREE competitions, three pools, three independent positives.
    //
    // Nothing is ever inferred from the absence of another flag. A game is
    // regular-season only if it says so, postseason only if it says so, and
    // preseason only if it says so — and each can then only reach its own
    // pool. That's what makes it impossible for an August friendly to land in
    // a September fixture, or a January rematch in either.
    const isRegular = game.isRegularSeason === true;
    const isPlayoff = game.isPostSeason === true;
    const isPre = game.isPreSeason === true;
    if (!isRegular && !isPlayoff && !isPre) {
      skip("not_scorable_competition", {
        game: label,
        isRegularSeason: game.isRegularSeason,
        isPostSeason: game.isPostSeason,
        isPreSeason: game.isPreSeason,
      });
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
    // Name the offending code rather than letting it fall through to
    // "no_matching_fixture". A provider renaming one team (ESPN has used both
    // JAC and JAX, and LA before LAR) would otherwise drop that team's games
    // for the rest of the season while the run still reported success — the
    // report would say "no matching fixture" and give no clue why.
    const unknown = [game.homeAbbr, game.awayAbbr].filter(a => !TEAMS[a]);
    if (unknown.length) {
      skip("unknown_team_code", { game: label, unknown });
      continue;
    }

    // The two pools never mix. A regular-season game is only ever matched
    // against the schedule, a postseason game only ever against slots an
    // admin has filled in — so a January rematch can't overwrite the
    // September fixture, or the other way round.
    const { fixture, matchedBy } = isRegular ? findFixture(game, fixtures)
      : isPlayoff ? findPlayoffSlot(game, playoffSlots)
      : findPlayoffSlot(game, preseasonSlots);   // same teams-only rule
    if (!fixture) {
      skip(isRegular ? "no_matching_fixture" : isPlayoff ? "no_playoff_slot" : "no_preseason_slot",
        { game: label, week: game.week });
      continue;
    }
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
