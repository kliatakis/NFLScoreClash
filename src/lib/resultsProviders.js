// ─── RESULTS PROVIDERS ──────────────────────────────────────────────────────
//
// One adapter per score source. An adapter's only job is to talk to its
// provider and hand back a NORMALIZED list of games; it owns everything
// provider-specific (URL shape, auth, team-abbreviation quirks, how that
// provider expresses "preseason vs regular season vs playoffs").
//
// Everything that touches our own data — validating, matching to a fixture,
// the never-overwrite rule, the Firestore write — lives in the provider-
// agnostic core (api/fetch-results.js). Swapping to a paid provider later
// means writing one new adapter that returns this same shape, and changing
// nothing else.
//
// ── The normalized shape every adapter must return, one entry per game ──
//   {
//     homeAbbr, awayAbbr   OUR team codes (see data/teams.js), already mapped
//     homeScore, awayScore numbers, or null if not final/unknown
//     completed            true only when the game is actually final
//     isRegularSeason      true | false | null  (null = provider didn't say)
//     seasonYear           number | null
//     week                 number | null
//   }
//
// The three-state `isRegularSeason` matters: the core FAILS CLOSED and skips
// anything it can't positively confirm is a regular-season game of the right
// season, rather than risking a preseason or playoff score being written into
// a regular-season fixture's slot.

// ESPN's abbreviations differ from ours in a few places. Every provider will
// have its own version of this list — which is exactly why it belongs in the
// adapter and not in the shared core.
const ESPN_ABBR_MAP = {
  WSH: "WAS",
  JAC: "JAX",
  LA: "LAR",
};

function espnAbbr(abbr) {
  if (!abbr) return null;
  return ESPN_ABBR_MAP[abbr] || abbr;
}

function toFiniteNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeEspnEvent(event) {
  const comp = event?.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find(c => c.homeAway === "home");
  const away = comp.competitors?.find(c => c.homeAway === "away");
  if (!home || !away) return null;

  // ESPN season types: 1 = preseason, 2 = regular season, 3 = postseason.
  // Anything missing is reported as null (unknown) rather than guessed at.
  //
  // Both flags are reported SEPARATELY rather than as one boolean. Collapsing
  // to "is it the regular season" made preseason and postseason
  // indistinguishable — fine while playoffs were skipped outright, but the
  // moment playoff games became matchable, an August preseason game would
  // have been eligible for a playoff slot. Two independent positives mean
  // each competition can only ever reach its own pool.
  const seasonType = event?.season?.type;
  const isRegularSeason = seasonType == null ? null : seasonType === 2;
  const isPostSeason = seasonType == null ? null : seasonType === 3;
  const isPreSeason = seasonType == null ? null : seasonType === 1;

  return {
    homeAbbr: espnAbbr(home.team?.abbreviation),
    awayAbbr: espnAbbr(away.team?.abbreviation),
    homeScore: toFiniteNumber(home.score),
    awayScore: toFiniteNumber(away.score),
    completed: comp.status?.type?.completed === true,
    isRegularSeason,
    isPostSeason,
    isPreSeason,
    seasonYear: toFiniteNumber(event?.season?.year),
    week: toFiniteNumber(event?.week?.number),
    // Carried through for the schedule importer, which needs a kickoff to
    // set a game up. Scoring ignores it — a result's time doesn't matter.
    kickoffUTC: typeof event?.date === "string" ? event.date : null,
  };
}

// The window to ask ESPN for, as YYYYMMDD-YYYYMMDD.
//
// This used to send a COMMA-SEPARATED list of dates. ESPN's scoreboard
// documents a single date or a hyphenated range; a comma list is not a format
// it advertises, and an unparseable `dates` value makes it quietly fall back
// to the current day rather than erroring. That failure mode is the worst
// kind: the fetch "succeeds", writes whatever it found today, and silently
// misses every game outside it — all season, with nothing to indicate it.
// The range form is unambiguous and covers exactly the same days.
// ONE STAMP PER DAY, NEVER A RANGE.
//
// This has now been wrong twice, in two different ways, and both times the
// symptom was the whole season's auto-fetch silently dying.
//
// First it sent a comma-separated list, which ESPN doesn't parse — it quietly
// fell back to "today" and missed everything else. That was replaced with a
// hyphenated range, `20260919-20260923`, on the understanding that a range was
// the documented form. In September 2026 that started returning HTTP 400 and
// took the fetcher out entirely mid-season.
//
// The single-date form is the only one ever actually observed to work, and it
// is the form ESPN's own site uses. So: ask for each day separately. Five
// small requests a day is nothing, and the failure mode of one bad day is one
// missing day rather than everything.
export function espnDateList(from, daysBack = 1, daysForward = 3) {
  const stamp = (offset) => {
    const d = new Date(from.getTime() + offset * 86400000);
    return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
  };
  const days = [];
  for (let i = -Math.abs(daysBack); i <= Math.abs(daysForward); i++) days.push(stamp(i));
  return days;
}

export const espnProvider = {
  name: "ESPN",

  // ESPN's scoreboard defaults to "today" in the server's local date, so we
  // pass an explicit window — NFL games span Thu/Sun/Mon plus the occasional
  // Wed/Fri/Sat special, and a cron that only ever looked at today would miss
  // anything that finished late relative to the server's clock.
  // `fetchImpl` is injectable purely so the tests can drive this without a
  // network — nothing in the app ever passes it.
  async fetchRecentGames({ daysBack = 1, daysForward = 3, now = new Date(), fetchImpl = fetch } = {}) {
    const days = espnDateList(now, daysBack, daysForward);

    // Each day is fetched on its own and allowed to fail on its own.
    //
    // One request for the whole window meant one bad response lost every day
    // in it. Now a failure costs exactly the day it happened on, and the run
    // reports which days it actually got — so "0 new results" can be told
    // apart from "four of the five days never answered".
    const events = [];
    const seen = new Set();
    const failedDays = [];

    for (const day of days) {
      const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${day}`;
      try {
        const response = await fetchImpl(url);
        if (!response.ok) { failedDays.push(`${day}:${response.status}`); continue; }
        const data = await response.json();
        for (const event of (Array.isArray(data.events) ? data.events : [])) {
          // ESPN buckets by US calendar date, so a late kickoff shows up under
          // two adjacent days. Without this the same game is counted twice and
          // the health panel's "checked N games" quietly overstates itself.
          const id = event?.id ?? JSON.stringify(event?.competitions?.[0]?.competitors ?? event);
          if (seen.has(id)) continue;
          seen.add(id);
          events.push(event);
        }
      } catch (err) {
        failedDays.push(`${day}:${String(err?.message || err).slice(0, 40)}`);
      }
    }

    // Only a total failure is an error. Anything less is a partial result,
    // which is worth keeping — the missing day gets another chance tomorrow,
    // and a score that did land is better than none.
    if (failedDays.length === days.length) {
      throw new Error(`ESPN unreachable for all ${days.length} days (${failedDays.join(", ")})`);
    }

    const games = [];
    for (const event of events) {
      const g = normalizeEspnEvent(event);
      if (g) games.push(g);
    }
    return {
      games,
      fetchedCount: events.length,
      daysRequested: days.length,
      daysFailed: failedDays,
    };
  },
};
