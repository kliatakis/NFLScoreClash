// ─── ScoreClash: Preseason Schedule Import ──────────────────────────────────
//
// Reads UPCOMING preseason fixtures from the provider so an admin can set up a
// trial with one button instead of typing sixteen matchups and kickoff times
// from another tab.
//
// Read-only. It touches no Firestore at all — it returns a list, and the
// browser writes the ones the admin confirms through the normal path, so the
// security rules and the change history both still apply.
//
// It exists as a server route for the same reason the results fetch does: the
// browser calling ESPN directly is at the mercy of their CORS headers, which
// are not a thing an undocumented endpoint promises to keep.

import { SEASON } from "../src/data/fixtures.js";
import { TEAMS } from "../src/data/teams.js";
import { espnProvider } from "../src/lib/resultsProviders.js";

const provider = espnProvider;

export default async function handler(req, res) {
  const days = Math.min(Math.max(Number(req.query?.days) || 10, 1), 30);
  // Include games that have already kicked off only if asked — a trial is
  // built from games nobody can have watched yet.
  const includeStarted = req.query?.includeStarted === "true";

  try {
    const { games, fetchedCount } = await provider.fetchRecentGames({ daysBack: 0, daysForward: days });
    const now = Date.now();
    const skipped = {};
    const skip = (reason) => { skipped[reason] = (skipped[reason] || 0) + 1; };

    const usable = [];
    for (const g of games) {
      // Positive confirmation, same rule as the results matcher: preseason
      // means ESPN said preseason, not "didn't say regular season".
      if (g.isPreSeason !== true) { skip("not_preseason"); continue; }
      if (g.seasonYear !== SEASON.year) { skip("wrong_season_year"); continue; }
      if (!g.homeAbbr || !g.awayAbbr) { skip("unmapped_team"); continue; }
      // A code we don't know would produce a slot nobody can render.
      if (!TEAMS[g.homeAbbr] || !TEAMS[g.awayAbbr]) { skip("unknown_team_code"); continue; }
      if (!g.kickoffUTC) { skip("no_kickoff"); continue; }
      const t = new Date(g.kickoffUTC).getTime();
      if (!Number.isFinite(t)) { skip("bad_kickoff"); continue; }
      if (!includeStarted && t <= now) { skip("already_started"); continue; }

      usable.push({
        home: g.homeAbbr,
        away: g.awayAbbr,
        kickoffUTC: new Date(t).toISOString(),
        // ESPN numbers the preseason weeks 1–3 the same way we do. Anything
        // outside that is reported as null and the caller decides.
        preWeek: g.week >= 1 && g.week <= 3 ? g.week : null,
        completed: g.completed === true,
      });
    }

    usable.sort((a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC));

    return res.status(200).json({
      success: true,
      provider: provider.name,
      checked: fetchedCount,
      windowDays: days,
      games: usable,
      skipped,
    });
  } catch (error) {
    return res.status(500).json({ success: false, provider: provider.name, error: error.message });
  }
}
