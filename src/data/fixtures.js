// ─── 2026 NFL SEASON DATA ───────────────────────────────────────────────────
//
// Full 18-week regular-season schedule, sourced from the official 2026 NFL
// schedule release (cross-checked against pro-football-reference.com and
// espn.com). kickoffUTC is stored in UTC so the app can render it in any
// timezone (EEST/EET, ET, etc.) — see src/lib/time.js.
//
// A handful of Week 16/17 games are flagged by the NFL as "flex" — the league
// sets their exact date/time closer to kickoff. Week 18's entire slate is
// scheduled TBD for the same reason (division-seeding implications), with all
// 16 games traditionally played the same Sunday. These have kickoffUTC: null
// and a note; update them once the NFL locks the time in-season.
//
// Playoff matchups are intentionally NOT pre-filled (unlike the old World
// Cup app, which hardcoded a full bracket). NFL playoff participants depend
// on actual regular-season results, so PLAYOFF_ROUNDS below only defines the
// round structure — once real seeding is known, update this file directly
// (same workflow as the regular-season schedule) and redeploy, rather than
// maintaining a separate in-app admin entry UI for it.

export const SEASON = {
  year: 2026,
  label: "2026 Season",
  // First game of the season — used to lock preseason picks (division /
  // conference / Super Bowl winners) 15 minutes before kickoff.
  openerKickoffUTC: "2026-09-10T00:20:00Z", // Wed Sep 9, 8:20pm ET = 00:20 UTC next day
  regularSeasonWeeks: 18,
  // Sunday of Week 1. Used ONLY to derive an approximate lock time for
  // fixtures the NFL hasn't scheduled yet (see effectiveKickoffUTC below) —
  // never for display, which always tells the truth ("Date/time TBD").
  week1SundayUTC: "2026-09-13T17:00:00Z",
  // Bye weeks aren't tracked here — nothing in the app reads a per-team bye
  // schedule (each week's fixture list is already just "whoever's playing
  // that week," which implicitly handles byes). Add this back only if a
  // future feature actually needs it.
  playoffs: {
    wildCardStart: "2027-01-16", // Sat, Jan 16, 2027
    superBowl: {
      name: "Super Bowl LXI",
      date: "2027-02-14",
      kickoffUTC: "2027-02-14T23:30:00Z", // 6:30pm ET
      venue: "SoFi Stadium, Los Angeles, CA",
    },
  },
};

// Full 2026 regular-season schedule (272 games across 18 weeks).
export const REGULAR_SEASON_FIXTURES = [
  { id: "w1_1", week: 1, home: "SEA", away: "NE", kickoffUTC: "2026-09-10T00:20:00Z", network: "NBC", note: "Season opener" },
  { id: "w1_2", week: 1, home: "LAR", away: "SF", kickoffUTC: "2026-09-11T00:35:00Z", network: "Amazon Prime" },
  { id: "w1_3", week: 1, home: "CAR", away: "CHI", kickoffUTC: "2026-09-13T17:00:00Z" },
  { id: "w1_4", week: 1, home: "CIN", away: "TB", kickoffUTC: "2026-09-13T17:00:00Z" },
  { id: "w1_5", week: 1, home: "IND", away: "BAL", kickoffUTC: "2026-09-13T17:00:00Z" },
  { id: "w1_6", week: 1, home: "DET", away: "NO", kickoffUTC: "2026-09-13T17:00:00Z" },
  { id: "w1_7", week: 1, home: "HOU", away: "BUF", kickoffUTC: "2026-09-13T17:00:00Z" },
  { id: "w1_8", week: 1, home: "JAX", away: "CLE", kickoffUTC: "2026-09-13T17:00:00Z" },
  { id: "w1_9", week: 1, home: "TEN", away: "NYJ", kickoffUTC: "2026-09-13T17:00:00Z" },
  { id: "w1_10", week: 1, home: "PIT", away: "ATL", kickoffUTC: "2026-09-13T17:00:00Z" },
  { id: "w1_11", week: 1, home: "MIN", away: "GB", kickoffUTC: "2026-09-13T20:25:00Z" },
  { id: "w1_12", week: 1, home: "PHI", away: "WAS", kickoffUTC: "2026-09-13T20:25:00Z" },
  { id: "w1_13", week: 1, home: "LV", away: "MIA", kickoffUTC: "2026-09-13T20:25:00Z" },
  { id: "w1_14", week: 1, home: "LAC", away: "ARI", kickoffUTC: "2026-09-13T20:25:00Z" },
  { id: "w1_15", week: 1, home: "NYG", away: "DAL", kickoffUTC: "2026-09-14T00:20:00Z", network: "NBC" },
  { id: "w1_16", week: 1, home: "KC", away: "DEN", kickoffUTC: "2026-09-15T00:15:00Z", network: "ESPN/ABC" },
  { id: "w2_1", week: 2, home: "BUF", away: "DET", kickoffUTC: "2026-09-18T00:15:00Z", network: "Amazon Prime" },
  { id: "w2_2", week: 2, home: "ATL", away: "CAR", kickoffUTC: "2026-09-20T17:00:00Z" },
  { id: "w2_3", week: 2, home: "CHI", away: "MIN", kickoffUTC: "2026-09-20T17:00:00Z" },
  { id: "w2_4", week: 2, home: "HOU", away: "CIN", kickoffUTC: "2026-09-20T17:00:00Z" },
  { id: "w2_5", week: 2, home: "NE", away: "PIT", kickoffUTC: "2026-09-20T17:00:00Z" },
  { id: "w2_6", week: 2, home: "NYJ", away: "GB", kickoffUTC: "2026-09-20T17:00:00Z" },
  { id: "w2_7", week: 2, home: "TEN", away: "PHI", kickoffUTC: "2026-09-20T17:00:00Z" },
  { id: "w2_8", week: 2, home: "BAL", away: "NO", kickoffUTC: "2026-09-20T17:00:00Z" },
  { id: "w2_9", week: 2, home: "TB", away: "CLE", kickoffUTC: "2026-09-20T17:00:00Z" },
  { id: "w2_10", week: 2, home: "DEN", away: "JAX", kickoffUTC: "2026-09-20T20:05:00Z" },
  { id: "w2_11", week: 2, home: "LAC", away: "LV", kickoffUTC: "2026-09-20T20:05:00Z" },
  { id: "w2_12", week: 2, home: "ARI", away: "SEA", kickoffUTC: "2026-09-20T20:25:00Z" },
  { id: "w2_13", week: 2, home: "DAL", away: "WAS", kickoffUTC: "2026-09-20T20:25:00Z" },
  { id: "w2_14", week: 2, home: "SF", away: "MIA", kickoffUTC: "2026-09-20T20:25:00Z" },
  { id: "w2_15", week: 2, home: "KC", away: "IND", kickoffUTC: "2026-09-21T00:20:00Z", network: "NBC" },
  { id: "w2_16", week: 2, home: "LAR", away: "NYG", kickoffUTC: "2026-09-22T00:15:00Z", network: "ESPN/ABC" },
  { id: "w3_1", week: 3, home: "GB", away: "ATL", kickoffUTC: "2026-09-25T00:15:00Z", network: "Amazon Prime" },
  { id: "w3_2", week: 3, home: "BUF", away: "LAC", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_3", week: 3, home: "CLE", away: "CAR", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_4", week: 3, home: "IND", away: "HOU", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_5", week: 3, home: "DET", away: "NYJ", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_6", week: 3, home: "JAX", away: "NE", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_7", week: 3, home: "MIA", away: "KC", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_8", week: 3, home: "NYG", away: "TEN", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_9", week: 3, home: "PIT", away: "CIN", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_10", week: 3, home: "WAS", away: "SEA", kickoffUTC: "2026-09-27T17:00:00Z" },
  { id: "w3_11", week: 3, home: "SF", away: "ARI", kickoffUTC: "2026-09-27T20:05:00Z" },
  { id: "w3_12", week: 3, home: "TB", away: "MIN", kickoffUTC: "2026-09-27T20:05:00Z" },
  { id: "w3_13", week: 3, home: "DAL", away: "BAL", kickoffUTC: "2026-09-27T20:25:00Z" },
  { id: "w3_14", week: 3, home: "NO", away: "LV", kickoffUTC: "2026-09-27T20:25:00Z" },
  { id: "w3_15", week: 3, home: "DEN", away: "LAR", kickoffUTC: "2026-09-28T00:20:00Z", network: "NBC" },
  { id: "w3_16", week: 3, home: "CHI", away: "PHI", kickoffUTC: "2026-09-29T00:15:00Z", network: "ESPN/ABC" },
  { id: "w4_1", week: 4, home: "CLE", away: "PIT", kickoffUTC: "2026-10-02T00:15:00Z", network: "Amazon Prime" },
  { id: "w4_2", week: 4, home: "WAS", away: "IND", kickoffUTC: "2026-10-04T13:30:00Z" },
  { id: "w4_3", week: 4, home: "BUF", away: "NE", kickoffUTC: "2026-10-04T17:00:00Z" },
  { id: "w4_4", week: 4, home: "CHI", away: "NYJ", kickoffUTC: "2026-10-04T17:00:00Z" },
  { id: "w4_5", week: 4, home: "CIN", away: "JAX", kickoffUTC: "2026-10-04T17:00:00Z" },
  { id: "w4_6", week: 4, home: "HOU", away: "DAL", kickoffUTC: "2026-10-04T17:00:00Z" },
  { id: "w4_7", week: 4, home: "NYG", away: "ARI", kickoffUTC: "2026-10-04T17:00:00Z" },
  { id: "w4_8", week: 4, home: "PHI", away: "LAR", kickoffUTC: "2026-10-04T17:00:00Z" },
  { id: "w4_9", week: 4, home: "BAL", away: "TEN", kickoffUTC: "2026-10-04T17:00:00Z" },
  { id: "w4_10", week: 4, home: "TB", away: "GB", kickoffUTC: "2026-10-04T17:00:00Z" },
  { id: "w4_11", week: 4, home: "MIN", away: "MIA", kickoffUTC: "2026-10-04T20:05:00Z" },
  { id: "w4_12", week: 4, home: "LV", away: "KC", kickoffUTC: "2026-10-04T20:25:00Z" },
  { id: "w4_13", week: 4, home: "SEA", away: "LAC", kickoffUTC: "2026-10-04T20:25:00Z" },
  { id: "w4_14", week: 4, home: "SF", away: "DEN", kickoffUTC: "2026-10-04T20:25:00Z" },
  { id: "w4_15", week: 4, home: "CAR", away: "DET", kickoffUTC: "2026-10-05T00:20:00Z", network: "NBC" },
  { id: "w4_16", week: 4, home: "NO", away: "ATL", kickoffUTC: "2026-10-06T00:15:00Z", network: "ESPN/ABC" },
  { id: "w5_1", week: 5, home: "DAL", away: "TB", kickoffUTC: "2026-10-09T00:15:00Z", network: "Amazon Prime" },
  { id: "w5_2", week: 5, home: "JAX", away: "PHI", kickoffUTC: "2026-10-11T13:30:00Z" },
  { id: "w5_3", week: 5, home: "MIA", away: "CIN", kickoffUTC: "2026-10-11T17:00:00Z" },
  { id: "w5_4", week: 5, home: "NO", away: "MIN", kickoffUTC: "2026-10-11T17:00:00Z" },
  { id: "w5_5", week: 5, home: "NE", away: "LV", kickoffUTC: "2026-10-11T17:00:00Z" },
  { id: "w5_6", week: 5, home: "NYJ", away: "CLE", kickoffUTC: "2026-10-11T17:00:00Z" },
  { id: "w5_7", week: 5, home: "TEN", away: "HOU", kickoffUTC: "2026-10-11T17:00:00Z" },
  { id: "w5_8", week: 5, home: "PIT", away: "IND", kickoffUTC: "2026-10-11T17:00:00Z" },
  { id: "w5_9", week: 5, home: "WAS", away: "NYG", kickoffUTC: "2026-10-11T17:00:00Z" },
  { id: "w5_10", week: 5, home: "LAC", away: "DEN", kickoffUTC: "2026-10-11T20:05:00Z" },
  { id: "w5_11", week: 5, home: "ARI", away: "DET", kickoffUTC: "2026-10-11T20:25:00Z" },
  { id: "w5_12", week: 5, home: "GB", away: "CHI", kickoffUTC: "2026-10-11T20:25:00Z" },
  { id: "w5_13", week: 5, home: "SEA", away: "SF", kickoffUTC: "2026-10-11T20:25:00Z" },
  { id: "w5_14", week: 5, home: "ATL", away: "BAL", kickoffUTC: "2026-10-12T00:20:00Z", network: "NBC" },
  { id: "w5_15", week: 5, home: "LAR", away: "BUF", kickoffUTC: "2026-10-13T00:15:00Z", network: "ESPN/ABC" },
  { id: "w6_1", week: 6, home: "DEN", away: "SEA", kickoffUTC: "2026-10-16T00:15:00Z", network: "Amazon Prime" },
  { id: "w6_2", week: 6, home: "JAX", away: "HOU", kickoffUTC: "2026-10-18T13:30:00Z" },
  { id: "w6_3", week: 6, home: "ATL", away: "CHI", kickoffUTC: "2026-10-18T17:00:00Z" },
  { id: "w6_4", week: 6, home: "CLE", away: "BAL", kickoffUTC: "2026-10-18T17:00:00Z" },
  { id: "w6_5", week: 6, home: "IND", away: "TEN", kickoffUTC: "2026-10-18T17:00:00Z" },
  { id: "w6_6", week: 6, home: "NE", away: "NYJ", kickoffUTC: "2026-10-18T17:00:00Z" },
  { id: "w6_7", week: 6, home: "NYG", away: "NO", kickoffUTC: "2026-10-18T17:00:00Z" },
  { id: "w6_8", week: 6, home: "PHI", away: "CAR", kickoffUTC: "2026-10-18T17:00:00Z" },
  { id: "w6_9", week: 6, home: "TB", away: "PIT", kickoffUTC: "2026-10-18T17:00:00Z" },
  { id: "w6_10", week: 6, home: "LAR", away: "ARI", kickoffUTC: "2026-10-18T20:05:00Z" },
  { id: "w6_11", week: 6, home: "KC", away: "LAC", kickoffUTC: "2026-10-18T20:25:00Z" },
  { id: "w6_12", week: 6, home: "LV", away: "BUF", kickoffUTC: "2026-10-18T20:25:00Z" },
  { id: "w6_13", week: 6, home: "GB", away: "DAL", kickoffUTC: "2026-10-19T00:20:00Z", network: "NBC" },
  { id: "w6_14", week: 6, home: "SF", away: "WAS", kickoffUTC: "2026-10-20T00:15:00Z", network: "ESPN/ABC" },
  { id: "w7_1", week: 7, home: "CHI", away: "NE", kickoffUTC: "2026-10-23T00:15:00Z", network: "Amazon Prime" },
  { id: "w7_2", week: 7, home: "NO", away: "PIT", kickoffUTC: "2026-10-25T13:30:00Z" },
  { id: "w7_3", week: 7, home: "ATL", away: "SF", kickoffUTC: "2026-10-25T17:00:00Z" },
  { id: "w7_4", week: 7, home: "CAR", away: "TB", kickoffUTC: "2026-10-25T17:00:00Z" },
  { id: "w7_5", week: 7, home: "HOU", away: "NYG", kickoffUTC: "2026-10-25T17:00:00Z" },
  { id: "w7_6", week: 7, home: "MIN", away: "IND", kickoffUTC: "2026-10-25T17:00:00Z" },
  { id: "w7_7", week: 7, home: "NYJ", away: "MIA", kickoffUTC: "2026-10-25T17:00:00Z" },
  { id: "w7_8", week: 7, home: "TEN", away: "CLE", kickoffUTC: "2026-10-25T17:00:00Z" },
  { id: "w7_9", week: 7, home: "BAL", away: "CIN", kickoffUTC: "2026-10-25T17:00:00Z" },
  { id: "w7_10", week: 7, home: "ARI", away: "DEN", kickoffUTC: "2026-10-25T20:05:00Z" },
  { id: "w7_11", week: 7, home: "DET", away: "GB", kickoffUTC: "2026-10-25T20:25:00Z" },
  { id: "w7_12", week: 7, home: "LV", away: "LAR", kickoffUTC: "2026-10-25T20:25:00Z" },
  { id: "w7_13", week: 7, home: "SEA", away: "KC", kickoffUTC: "2026-10-26T00:20:00Z", network: "NBC" },
  { id: "w7_14", week: 7, home: "PHI", away: "DAL", kickoffUTC: "2026-10-27T00:15:00Z", network: "ESPN/ABC" },
  { id: "w8_1", week: 8, home: "GB", away: "CAR", kickoffUTC: "2026-10-30T00:15:00Z", network: "Amazon Prime" },
  { id: "w8_2", week: 8, home: "BUF", away: "BAL", kickoffUTC: "2026-11-01T18:00:00Z" },
  { id: "w8_3", week: 8, home: "CIN", away: "TEN", kickoffUTC: "2026-11-01T18:00:00Z" },
  { id: "w8_4", week: 8, home: "DAL", away: "ARI", kickoffUTC: "2026-11-01T18:00:00Z" },
  { id: "w8_5", week: 8, home: "DET", away: "MIN", kickoffUTC: "2026-11-01T18:00:00Z" },
  { id: "w8_6", week: 8, home: "JAX", away: "IND", kickoffUTC: "2026-11-01T18:00:00Z" },
  { id: "w8_7", week: 8, home: "NYJ", away: "LV", kickoffUTC: "2026-11-01T18:00:00Z" },
  { id: "w8_8", week: 8, home: "PIT", away: "CLE", kickoffUTC: "2026-11-01T18:00:00Z" },
  { id: "w8_9", week: 8, home: "TB", away: "ATL", kickoffUTC: "2026-11-01T18:00:00Z" },
  { id: "w8_10", week: 8, home: "LAR", away: "LAC", kickoffUTC: "2026-11-01T21:05:00Z" },
  { id: "w8_11", week: 8, home: "DEN", away: "KC", kickoffUTC: "2026-11-01T21:25:00Z" },
  { id: "w8_12", week: 8, home: "MIA", away: "NE", kickoffUTC: "2026-11-01T21:25:00Z" },
  { id: "w8_13", week: 8, home: "WAS", away: "PHI", kickoffUTC: "2026-11-02T01:20:00Z", network: "NBC" },
  { id: "w8_14", week: 8, home: "SEA", away: "CHI", kickoffUTC: "2026-11-03T01:15:00Z", network: "ESPN/ABC" },
  { id: "w9_1", week: 9, home: "BAL", away: "JAX", kickoffUTC: "2026-11-06T01:15:00Z", network: "Amazon Prime" },
  { id: "w9_2", week: 9, home: "ATL", away: "CIN", kickoffUTC: "2026-11-08T14:30:00Z" },
  { id: "w9_3", week: 9, home: "CAR", away: "DEN", kickoffUTC: "2026-11-08T18:00:00Z" },
  { id: "w9_4", week: 9, home: "IND", away: "DAL", kickoffUTC: "2026-11-08T18:00:00Z" },
  { id: "w9_5", week: 9, home: "KC", away: "NYJ", kickoffUTC: "2026-11-08T18:00:00Z" },
  { id: "w9_6", week: 9, home: "MIA", away: "DET", kickoffUTC: "2026-11-08T18:00:00Z" },
  { id: "w9_7", week: 9, home: "NO", away: "CLE", kickoffUTC: "2026-11-08T18:00:00Z" },
  { id: "w9_8", week: 9, home: "PHI", away: "NYG", kickoffUTC: "2026-11-08T18:00:00Z" },
  { id: "w9_9", week: 9, home: "WAS", away: "LAR", kickoffUTC: "2026-11-08T18:00:00Z" },
  { id: "w9_10", week: 9, home: "LAC", away: "HOU", kickoffUTC: "2026-11-08T21:05:00Z" },
  { id: "w9_11", week: 9, home: "SF", away: "LV", kickoffUTC: "2026-11-08T21:05:00Z" },
  { id: "w9_12", week: 9, home: "NE", away: "GB", kickoffUTC: "2026-11-08T21:25:00Z" },
  { id: "w9_13", week: 9, home: "SEA", away: "ARI", kickoffUTC: "2026-11-08T21:25:00Z" },
  { id: "w9_14", week: 9, home: "CHI", away: "TB", kickoffUTC: "2026-11-09T01:20:00Z", network: "NBC" },
  { id: "w9_15", week: 9, home: "MIN", away: "BUF", kickoffUTC: "2026-11-10T01:15:00Z", network: "ESPN/ABC" },
  { id: "w10_1", week: 10, home: "NYG", away: "WAS", kickoffUTC: "2026-11-13T01:15:00Z", network: "Amazon Prime" },
  { id: "w10_2", week: 10, home: "DET", away: "NE", kickoffUTC: "2026-11-15T14:30:00Z" },
  { id: "w10_3", week: 10, home: "ATL", away: "KC", kickoffUTC: "2026-11-15T18:00:00Z" },
  { id: "w10_4", week: 10, home: "CLE", away: "HOU", kickoffUTC: "2026-11-15T18:00:00Z" },
  { id: "w10_5", week: 10, home: "IND", away: "MIA", kickoffUTC: "2026-11-15T18:00:00Z" },
  { id: "w10_6", week: 10, home: "GB", away: "MIN", kickoffUTC: "2026-11-15T18:00:00Z" },
  { id: "w10_7", week: 10, home: "NO", away: "CAR", kickoffUTC: "2026-11-15T18:00:00Z" },
  { id: "w10_8", week: 10, home: "NYJ", away: "BUF", kickoffUTC: "2026-11-15T18:00:00Z" },
  { id: "w10_9", week: 10, home: "TEN", away: "JAX", kickoffUTC: "2026-11-15T18:00:00Z" },
  { id: "w10_10", week: 10, home: "ARI", away: "LAR", kickoffUTC: "2026-11-15T21:05:00Z" },
  { id: "w10_11", week: 10, home: "LV", away: "SEA", kickoffUTC: "2026-11-15T21:05:00Z" },
  { id: "w10_12", week: 10, home: "DAL", away: "SF", kickoffUTC: "2026-11-15T21:25:00Z" },
  { id: "w10_13", week: 10, home: "CIN", away: "PIT", kickoffUTC: "2026-11-16T01:20:00Z", network: "NBC" },
  { id: "w10_14", week: 10, home: "BAL", away: "LAC", kickoffUTC: "2026-11-17T01:15:00Z", network: "ESPN/ABC" },
  { id: "w11_1", week: 11, home: "HOU", away: "IND", kickoffUTC: "2026-11-20T01:15:00Z", network: "Amazon Prime" },
  { id: "w11_2", week: 11, home: "BUF", away: "MIA", kickoffUTC: "2026-11-22T18:00:00Z" },
  { id: "w11_3", week: 11, home: "CAR", away: "BAL", kickoffUTC: "2026-11-22T18:00:00Z" },
  { id: "w11_4", week: 11, home: "CHI", away: "NO", kickoffUTC: "2026-11-22T18:00:00Z" },
  { id: "w11_5", week: 11, home: "DAL", away: "TEN", kickoffUTC: "2026-11-22T18:00:00Z" },
  { id: "w11_6", week: 11, home: "DET", away: "TB", kickoffUTC: "2026-11-22T18:00:00Z" },
  { id: "w11_7", week: 11, home: "KC", away: "ARI", kickoffUTC: "2026-11-22T18:00:00Z" },
  { id: "w11_8", week: 11, home: "NYG", away: "JAX", kickoffUTC: "2026-11-22T18:00:00Z" },
  { id: "w11_9", week: 11, home: "LAC", away: "NYJ", kickoffUTC: "2026-11-22T21:05:00Z" },
  { id: "w11_10", week: 11, home: "DEN", away: "LV", kickoffUTC: "2026-11-22T21:25:00Z" },
  { id: "w11_11", week: 11, home: "PHI", away: "PIT", kickoffUTC: "2026-11-22T21:25:00Z" },
  { id: "w11_12", week: 11, home: "SF", away: "MIN", kickoffUTC: "2026-11-23T01:20:00Z", network: "NBC" },
  { id: "w11_13", week: 11, home: "WAS", away: "CIN", kickoffUTC: "2026-11-24T01:15:00Z", network: "ESPN/ABC" },
  { id: "w12_1", week: 12, home: "LAR", away: "GB", kickoffUTC: "2026-11-26T01:00:00Z", network: "Amazon Prime" },
  { id: "w12_2", week: 12, home: "DET", away: "CHI", kickoffUTC: "2026-11-26T18:00:00Z", network: "CBS", note: "Thanksgiving" },
  { id: "w12_3", week: 12, home: "DAL", away: "PHI", kickoffUTC: "2026-11-26T21:30:00Z", network: "FOX", note: "Thanksgiving" },
  { id: "w12_4", week: 12, home: "BUF", away: "KC", kickoffUTC: "2026-11-27T01:20:00Z", network: "NBC", note: "Thanksgiving" },
  { id: "w12_5", week: 12, home: "PIT", away: "DEN", kickoffUTC: "2026-11-27T20:00:00Z", network: "Amazon Prime", note: "Black Friday" },
  { id: "w12_6", week: 12, home: "CIN", away: "NO", kickoffUTC: "2026-11-29T18:00:00Z" },
  { id: "w12_7", week: 12, home: "CLE", away: "LV", kickoffUTC: "2026-11-29T18:00:00Z" },
  { id: "w12_8", week: 12, home: "IND", away: "NYG", kickoffUTC: "2026-11-29T18:00:00Z" },
  { id: "w12_9", week: 12, home: "HOU", away: "BAL", kickoffUTC: "2026-11-29T18:00:00Z" },
  { id: "w12_10", week: 12, home: "MIA", away: "NYJ", kickoffUTC: "2026-11-29T18:00:00Z" },
  { id: "w12_11", week: 12, home: "MIN", away: "ATL", kickoffUTC: "2026-11-29T18:00:00Z" },
  { id: "w12_12", week: 12, home: "JAX", away: "TEN", kickoffUTC: "2026-11-29T21:05:00Z" },
  { id: "w12_13", week: 12, home: "ARI", away: "WAS", kickoffUTC: "2026-11-29T21:25:00Z" },
  { id: "w12_14", week: 12, home: "SF", away: "SEA", kickoffUTC: "2026-11-29T21:25:00Z" },
  { id: "w12_15", week: 12, home: "LAC", away: "NE", kickoffUTC: "2026-11-30T01:20:00Z", network: "NBC" },
  { id: "w12_16", week: 12, home: "TB", away: "CAR", kickoffUTC: "2026-12-01T01:15:00Z", network: "ESPN/ABC" },
  { id: "w13_1", week: 13, home: "LAR", away: "KC", kickoffUTC: "2026-12-04T01:15:00Z", network: "Amazon Prime" },
  { id: "w13_2", week: 13, home: "ATL", away: "DET", kickoffUTC: "2026-12-06T18:00:00Z" },
  { id: "w13_3", week: 13, home: "CHI", away: "JAX", kickoffUTC: "2026-12-06T18:00:00Z" },
  { id: "w13_4", week: 13, home: "CLE", away: "CIN", kickoffUTC: "2026-12-06T18:00:00Z" },
  { id: "w13_5", week: 13, home: "NO", away: "GB", kickoffUTC: "2026-12-06T18:00:00Z" },
  { id: "w13_6", week: 13, home: "NYG", away: "SF", kickoffUTC: "2026-12-06T18:00:00Z" },
  { id: "w13_7", week: 13, home: "TEN", away: "WAS", kickoffUTC: "2026-12-06T18:00:00Z" },
  { id: "w13_8", week: 13, home: "TB", away: "LAC", kickoffUTC: "2026-12-06T18:00:00Z" },
  { id: "w13_9", week: 13, home: "ARI", away: "PHI", kickoffUTC: "2026-12-06T21:05:00Z" },
  { id: "w13_10", week: 13, home: "DEN", away: "MIA", kickoffUTC: "2026-12-06T21:05:00Z" },
  { id: "w13_11", week: 13, home: "MIN", away: "CAR", kickoffUTC: "2026-12-06T21:25:00Z" },
  { id: "w13_12", week: 13, home: "NE", away: "BUF", kickoffUTC: "2026-12-06T21:25:00Z" },
  { id: "w13_13", week: 13, home: "PIT", away: "HOU", kickoffUTC: "2026-12-07T01:20:00Z", network: "NBC" },
  { id: "w13_14", week: 13, home: "SEA", away: "DAL", kickoffUTC: "2026-12-08T01:15:00Z", network: "ESPN/ABC" },
  { id: "w14_1", week: 14, home: "NE", away: "MIN", kickoffUTC: "2026-12-11T01:15:00Z", network: "Amazon Prime" },
  { id: "w14_2", week: 14, home: "CLE", away: "ATL", kickoffUTC: "2026-12-13T18:00:00Z", network: "CBS" },
  { id: "w14_3", week: 14, home: "DET", away: "TEN", kickoffUTC: "2026-12-13T18:00:00Z", network: "FOX" },
  { id: "w14_4", week: 14, home: "MIA", away: "CHI", kickoffUTC: "2026-12-13T18:00:00Z", network: "CBS" },
  { id: "w14_5", week: 14, home: "NYJ", away: "DEN", kickoffUTC: "2026-12-13T18:00:00Z", network: "CBS" },
  { id: "w14_6", week: 14, home: "PHI", away: "IND", kickoffUTC: "2026-12-13T18:00:00Z", network: "FOX" },
  { id: "w14_7", week: 14, home: "WAS", away: "HOU", kickoffUTC: "2026-12-13T18:00:00Z", network: "CBS" },
  { id: "w14_8", week: 14, home: "CAR", away: "NO", kickoffUTC: "2026-12-13T18:00:00Z", network: "CBS" },
  { id: "w14_9", week: 14, home: "BAL", away: "TB", kickoffUTC: "2026-12-13T18:00:00Z", network: "FOX" },
  { id: "w14_10", week: 14, home: "LV", away: "LAC", kickoffUTC: "2026-12-13T21:05:00Z", network: "CBS" },
  { id: "w14_11", week: 14, home: "CIN", away: "KC", kickoffUTC: "2026-12-13T21:25:00Z", network: "FOX" },
  { id: "w14_12", week: 14, home: "SF", away: "LAR", kickoffUTC: "2026-12-13T21:25:00Z", network: "FOX" },
  { id: "w14_13", week: 14, home: "SEA", away: "NYG", kickoffUTC: "2026-12-13T21:25:00Z", network: "FOX" },
  { id: "w14_14", week: 14, home: "GB", away: "BUF", kickoffUTC: "2026-12-14T01:20:00Z", network: "NBC" },
  { id: "w14_15", week: 14, home: "JAX", away: "PIT", kickoffUTC: "2026-12-15T01:15:00Z", network: "ESPN", note: "Bye: Dallas, Arizona" },
  { id: "w15_1", week: 15, home: "LAC", away: "SF", kickoffUTC: "2026-12-18T01:15:00Z", network: "Amazon Prime" },
  { id: "w15_2", week: 15, home: "PHI", away: "SEA", kickoffUTC: "2026-12-19T22:00:00Z", network: "FOX" },
  { id: "w15_3", week: 15, home: "BUF", away: "CHI", kickoffUTC: "2026-12-20T01:20:00Z", network: "CBS" },
  { id: "w15_4", week: 15, home: "GB", away: "MIA", kickoffUTC: "2026-12-20T18:00:00Z", network: "FOX" },
  { id: "w15_5", week: 15, home: "TEN", away: "IND", kickoffUTC: "2026-12-20T18:00:00Z", network: "CBS" },
  { id: "w15_6", week: 15, home: "NYG", away: "CLE", kickoffUTC: "2026-12-20T18:00:00Z", network: "CBS" },
  { id: "w15_7", week: 15, home: "PIT", away: "BAL", kickoffUTC: "2026-12-20T18:00:00Z", network: "CBS" },
  { id: "w15_8", week: 15, home: "TB", away: "NO", kickoffUTC: "2026-12-20T18:00:00Z", network: "FOX" },
  { id: "w15_9", week: 15, home: "WAS", away: "ATL", kickoffUTC: "2026-12-20T18:00:00Z", network: "FOX" },
  { id: "w15_10", week: 15, home: "CAR", away: "CIN", kickoffUTC: "2026-12-20T18:00:00Z", network: "FOX" },
  { id: "w15_11", week: 15, home: "HOU", away: "JAX", kickoffUTC: "2026-12-20T18:00:00Z", network: "CBS" },
  { id: "w15_12", week: 15, home: "ARI", away: "NYJ", kickoffUTC: "2026-12-20T21:05:00Z", network: "FOX" },
  { id: "w15_13", week: 15, home: "LV", away: "DEN", kickoffUTC: "2026-12-20T21:25:00Z", network: "CBS" },
  { id: "w15_14", week: 15, home: "LAR", away: "DAL", kickoffUTC: "2026-12-20T21:25:00Z", network: "CBS" },
  { id: "w15_15", week: 15, home: "MIN", away: "DET", kickoffUTC: "2026-12-21T01:20:00Z", network: "NBC" },
  { id: "w15_16", week: 15, home: "KC", away: "NE", kickoffUTC: "2026-12-22T01:15:00Z", network: "ESPN/ABC" },
  { id: "w16_1", week: 16, home: "PHI", away: "HOU", kickoffUTC: "2026-12-25T01:15:00Z", network: "Amazon Prime", note: "Christmas Eve" },
  { id: "w16_2", week: 16, home: "CHI", away: "GB", kickoffUTC: "2026-12-25T18:00:00Z", network: "Netflix", note: "Christmas Day" },
  { id: "w16_3", week: 16, home: "DEN", away: "BUF", kickoffUTC: "2026-12-25T21:30:00Z", network: "Netflix", note: "Christmas Day" },
  { id: "w16_4", week: 16, home: "SEA", away: "LAR", kickoffUTC: "2026-12-26T01:15:00Z", network: "FOX", note: "Christmas Day" },
  { id: "w16_5", week: 16, home: "MIA", away: "LAC", kickoffUTC: "2026-12-27T18:00:00Z", network: "FOX" },
  { id: "w16_6", week: 16, home: "NO", away: "ARI", kickoffUTC: "2026-12-27T18:00:00Z", network: "FOX" },
  { id: "w16_7", week: 16, home: "NYJ", away: "NE", kickoffUTC: "2026-12-27T18:00:00Z", network: "CBS" },
  { id: "w16_8", week: 16, home: "BAL", away: "CLE", kickoffUTC: "2026-12-27T18:00:00Z", network: "CBS" },
  { id: "w16_9", week: 16, home: "LV", away: "TEN", kickoffUTC: "2026-12-27T21:05:00Z", network: "FOX" },
  { id: "w16_10", week: 16, home: "KC", away: "SF", kickoffUTC: "2026-12-27T21:25:00Z", network: "CBS" },
  { id: "w16_11", week: 16, home: "DAL", away: "JAX", kickoffUTC: "2026-12-28T01:20:00Z", network: "NBC" },
  { id: "w16_12", week: 16, home: "DET", away: "NYG", kickoffUTC: "2026-12-29T01:15:00Z", network: "ESPN" },
  { id: "w16_13", week: 16, home: "ATL", away: "TB", kickoffUTC: null, note: "Date/time TBD (flex)" },
  { id: "w16_14", week: 16, home: "IND", away: "CIN", kickoffUTC: null, note: "Date/time TBD (flex)" },
  { id: "w16_15", week: 16, home: "MIN", away: "WAS", kickoffUTC: null, note: "Date/time TBD (flex)" },
  { id: "w16_16", week: 16, home: "PIT", away: "CAR", kickoffUTC: null, note: "Date/time TBD (flex)" },
  { id: "w17_1", week: 17, home: "CIN", away: "BAL", kickoffUTC: "2027-01-01T01:15:00Z", network: "Amazon Prime" },
  { id: "w17_2", week: 17, home: "ATL", away: "NO", kickoffUTC: "2027-01-03T18:00:00Z", network: "FOX" },
  { id: "w17_3", week: 17, home: "CLE", away: "IND", kickoffUTC: "2027-01-03T18:00:00Z", network: "FOX" },
  { id: "w17_4", week: 17, home: "DAL", away: "NYG", kickoffUTC: "2027-01-03T18:00:00Z", network: "FOX" },
  { id: "w17_5", week: 17, home: "TEN", away: "PIT", kickoffUTC: "2027-01-03T18:00:00Z", network: "CBS" },
  { id: "w17_6", week: 17, home: "MIA", away: "BUF", kickoffUTC: "2027-01-03T18:00:00Z", network: "CBS" },
  { id: "w17_7", week: 17, home: "NYJ", away: "MIN", kickoffUTC: "2027-01-03T18:00:00Z", network: "CBS" },
  { id: "w17_8", week: 17, home: "CAR", away: "SEA", kickoffUTC: "2027-01-03T18:00:00Z", network: "FOX" },
  { id: "w17_9", week: 17, home: "ARI", away: "LV", kickoffUTC: "2027-01-03T21:05:00Z", network: "CBS" },
  { id: "w17_10", week: 17, home: "CHI", away: "DET", kickoffUTC: "2027-01-03T21:25:00Z", network: "FOX" },
  { id: "w17_11", week: 17, home: "SF", away: "PHI", kickoffUTC: "2027-01-04T01:20:00Z", network: "NBC" },
  { id: "w17_12", week: 17, home: "GB", away: "HOU", kickoffUTC: "2027-01-05T01:15:00Z", network: "ESPN" },
  { id: "w17_13", week: 17, home: "NE", away: "DEN", kickoffUTC: null, note: "Date/time TBD (flex)" },
  { id: "w17_14", week: 17, home: "LAC", away: "KC", kickoffUTC: null, note: "Date/time TBD (flex)" },
  { id: "w17_15", week: 17, home: "TB", away: "LAR", kickoffUTC: null, note: "Date/time TBD (flex)" },
  { id: "w17_16", week: 17, home: "JAX", away: "WAS", kickoffUTC: null, note: "Date/time TBD (flex)" },
  { id: "w18_1", week: 18, home: "BUF", away: "NYJ", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_2", week: 18, home: "CIN", away: "CLE", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_3", week: 18, home: "DEN", away: "LAC", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_4", week: 18, home: "GB", away: "DET", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_5", week: 18, home: "IND", away: "JAX", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_6", week: 18, home: "KC", away: "LV", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_7", week: 18, home: "LAR", away: "SEA", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_8", week: 18, home: "MIN", away: "CHI", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_9", week: 18, home: "NE", away: "MIA", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_10", week: 18, home: "NO", away: "TB", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_11", week: 18, home: "NYG", away: "PHI", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_12", week: 18, home: "ARI", away: "SF", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_13", week: 18, home: "WAS", away: "DAL", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_14", week: 18, home: "CAR", away: "ATL", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_15", week: 18, home: "BAL", away: "PIT", kickoffUTC: null, note: "Week 18 — date/time TBD" },
  { id: "w18_16", week: 18, home: "HOU", away: "TEN", kickoffUTC: null, note: "Week 18 — date/time TBD" },
];

// Round structure only — matchups get filled in by the admin once seeding
// is set (see AdminPanel). `slots` is just a count of games in that round.
export const PLAYOFF_ROUNDS = [
  { id: "wildcard",   label: "Wild Card",           slots: 6 },
  { id: "divisional", label: "Divisional",          slots: 4 },
  { id: "conf_afc",   label: "AFC Championship",    slots: 1 },
  { id: "conf_nfc",   label: "NFC Championship",    slots: 1 },
  { id: "superbowl",  label: "Super Bowl",          slots: 1 },
];

// Special preseason picks, made once per season, locked 15 min before the
// season opener kickoff (SEASON.openerKickoffUTC).
export const SPECIAL_PICK_TYPES = [
  { id: "div_AFC East",  label: "AFC East Winner",  kind: "division",   division: "AFC East" },
  { id: "div_AFC North", label: "AFC North Winner", kind: "division",   division: "AFC North" },
  { id: "div_AFC South", label: "AFC South Winner", kind: "division",   division: "AFC South" },
  { id: "div_AFC West",  label: "AFC West Winner",  kind: "division",   division: "AFC West" },
  { id: "div_NFC East",  label: "NFC East Winner",  kind: "division",   division: "NFC East" },
  { id: "div_NFC North", label: "NFC North Winner", kind: "division",   division: "NFC North" },
  { id: "div_NFC South", label: "NFC South Winner", kind: "division",   division: "NFC South" },
  { id: "div_NFC West",  label: "NFC West Winner",  kind: "division",   division: "NFC West" },
  { id: "conf_AFC",      label: "AFC Champion",     kind: "conference", conference: "AFC" },
  { id: "conf_NFC",      label: "NFC Champion",     kind: "conference", conference: "NFC" },
  { id: "superbowl",     label: "Super Bowl Champion", kind: "superbowl" },
];

export function fixturesForWeek(week) {
  return REGULAR_SEASON_FIXTURES.filter(f => f.week === week);
}

// The time a fixture should be treated as starting FOR LOCKING PURPOSES.
//
// Most fixtures have a real kickoff. The ones that don't — every Week 18 game
// plus a handful of flexed Week 16/17 games — previously never locked at all,
// because "no kickoff time" was treated as "not started yet", forever. That
// left those picks editable after the games had actually been played.
//
// For those, we fall back to the SATURDAY of that week, derived from the
// Week 1 Sunday anchor. Saturday is the earliest slot the NFL uses, so this
// errs toward locking slightly early rather than ever allowing a pick after
// kickoff — the safe direction for a prediction game. It's only a fallback:
// the moment real times are added to the data above, they take over.
export function effectiveKickoffUTC(fixture) {
  if (!fixture) return null;
  if (fixture.kickoffUTC) return fixture.kickoffUTC;
  const anchor = new Date(SEASON.week1SundayUTC).getTime();
  if (!Number.isFinite(anchor) || !Number.isFinite(fixture.week)) return null;
  const weekSunday = anchor + (fixture.week - 1) * 7 * 86400000;
  return new Date(weekSunday - 86400000).toISOString(); // the Saturday before
}

// True when a fixture's start time is a derived estimate rather than a real
// announced kickoff — lets the UI be honest about it.
export function hasEstimatedKickoff(fixture) {
  return !!fixture && !fixture.kickoffUTC;
}
