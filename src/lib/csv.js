// ─── CSV EXPORT ─────────────────────────────────────────────────────────────
//
// For opening the season in Excel or Google Sheets. NOT a backup.
//
// The distinction matters enough to be written down: a CSV is one flat table,
// and what a restore needs is nested — every pick keyed by person and by game,
// plus playoff matchups and per-league scoring settings. Flattening that loses
// the structure and the types, and a restore built on parsing it back would be
// guessing. The JSON backup stays the only thing that can rebuild a season;
// these files are for looking at it.
//
// Pure functions: they take data and return a string. No download, no DOM.

// Excel and Sheets treat a leading =, +, - or @ as the start of a formula. A
// username is user-controlled text, so "=cmd" in a name would be executed by
// the spreadsheet rather than shown. Prefixing with an apostrophe is the
// standard defence and displays as plain text.
const FORMULA_STARTERS = ["=", "+", "-", "@", "\t", "\r"];

export function csvEscape(value) {
  if (value == null) return "";
  let s = String(value);
  if (FORMULA_STARTERS.includes(s[0])) s = "'" + s;
  // Quote whenever the value contains a delimiter, a quote or a newline, and
  // double any embedded quotes — RFC 4180.
  if (/[",\n\r]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Rows are arrays. A leading BOM makes Excel read the file as UTF-8 instead of
// mangling anything non-ASCII in a username; CRLF is what Excel expects.
export function toCsv(rows) {
  return "﻿" + rows.map(r => r.map(csvEscape).join(",")).join("\r\n") + "\r\n";
}

const safeName = (s) => String(s || "league").replace(/[^\w-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "league";

export function csvFilename(leagueName, kind, seasonYear, now = Date.now()) {
  const d = new Date(now);
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `scoreclash-${safeName(leagueName)}-${kind}-${seasonYear}-${stamp}.csv`;
}

// ── Standings ───────────────────────────────────────────────────────────────
// The table as ranked, with every tiebreaker column visible — the point of
// having it in a spreadsheet is being able to see why the order is what it is.
export function buildStandingsCsv(standings = []) {
  const rows = [[
    "Rank", "Player", "Points", "Correct picks", "Games scored", "Accuracy %",
    "Bonus points", "Ties called", "Medals (weeks won)",
    "Clean sweeps", "Near perfect", "Sharp weeks",
    "Super Bowl", "Conference", "Divisions",
  ]];
  standings.forEach((s, i) => {
    rows.push([
      i + 1,
      s.username,
      s.points,
      s.correct,
      s.gamesScored,
      s.gamesScored > 0 ? Math.round((s.correct / s.gamesScored) * 100) : "",
      s.totalBonus ?? s.bonusPoints ?? 0,
      s.tiesCalled ?? 0,
      s.medals ?? 0,
      s.sweepWeeks ?? 0,
      s.nearWeeks ?? 0,
      s.sharpWeeks ?? 0,
      s.superbowlCorrect ?? 0,
      s.conferenceCorrect ?? 0,
      s.divisionCorrect ?? 0,
    ]);
  });
  return toCsv(rows);
}

// ── Picks grid ──────────────────────────────────────────────────────────────
// One row per game, one column per player. This is the shape people actually
// want: sort by week, filter to a player, see who called what.
//
// `members` is [{ uid, username }] in a fixed order so the header and every
// row line up.
export function buildPicksCsv({ fixtures = [], members = [], allPredictions = {}, results = {}, teamName = (c) => c }) {
  const header = [
    "Week", "Game ID", "Kickoff (UTC)", "Away", "Home",
    "Away score", "Home score", "Winner",
    ...members.map(m => m.username),
  ];
  const rows = [header];

  const sideName = (side, f) => {
    if (side === "T") return "TIE";
    if (side === "H") return f.home;
    if (side === "A") return f.away;
    return "";
  };

  for (const f of fixtures) {
    const r = results[f.id];
    const hasScore = r && r.homeScore != null && r.awayScore != null;
    const winner = !hasScore ? ""
      : r.homeScore === r.awayScore ? "TIE"
      : r.homeScore > r.awayScore ? f.home : f.away;

    rows.push([
      f.week != null ? f.week : (f.roundLabel || f.label || "Playoffs"),
      f.id,
      f.kickoffUTC || "",
      f.away ? teamName(f.away) : "",
      f.home ? teamName(f.home) : "",
      hasScore ? r.awayScore : "",
      hasScore ? r.homeScore : "",
      winner ? (winner === "TIE" ? "TIE" : teamName(winner)) : "",
      ...members.map(m => {
        const pick = (allPredictions[m.uid]?.picks || {})[f.id];
        const side = pick && typeof pick.winner === "string" ? pick.winner : null;
        const name = sideName(side, f);
        return name && name !== "TIE" ? teamName(name) : name;
      }),
    ]);
  }
  return toCsv(rows);
}

// ── Season picks ────────────────────────────────────────────────────────────
// The preseason answers, side by side with what actually happened. Small, but
// it's the part of the game people argue about in February.
export function buildSeasonPicksCsv({ pickTypes = [], members = [], allPredictions = {}, specialResults = {}, teamName = (c) => c }) {
  const rows = [["Pick", "Actual winner", ...members.map(m => m.username)]];
  for (const type of pickTypes) {
    const actual = specialResults[type.id] || "";
    rows.push([
      type.label,
      actual ? teamName(actual) : "",
      ...members.map(m => {
        const chosen = (allPredictions[m.uid]?.specials || {})[type.id];
        return chosen ? teamName(chosen) : "";
      }),
    ]);
  }
  return toCsv(rows);
}
