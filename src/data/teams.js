// ─── NFL TEAMS ──────────────────────────────────────────────────────────────
// Team colors + a relevant emoji badge instead of official logos, deliberately —
// team logos are actively-enforced trademarks; colors + emoji give the same
// visual identity/"pop" without that risk. Where no single emoji reads as an
// obvious literal match, we picked a fun thematic one instead of falling back
// to a flat color+abbreviation badge (falling back is still supported by
// TeamBadge for any team missing an `emoji` field — see components/TeamBadge.jsx).
//
// A few raptor-heavy teams (Eagles/Falcons/Seahawks/Ravens) would otherwise all
// want the same generic hawk/eagle emoji, so a couple were given a distinct
// "vibe" pick instead (Falcons → fire, Seahawks → the loud "12th man" crowd)
// so the league table doesn't look repetitive.

export const CONFERENCES = ["AFC", "NFC"];

export const DIVISIONS = {
  AFC: ["AFC East", "AFC North", "AFC South", "AFC West"],
  NFC: ["NFC East", "NFC North", "NFC South", "NFC West"],
};

export const TEAMS = {
  // ── AFC East ──
  BUF: { city: "Buffalo",       name: "Bills",       abbr: "BUF", conf: "AFC", div: "AFC East",  primary: "#00338D", secondary: "#C60C30", emoji: "🦬" },
  MIA: { city: "Miami",         name: "Dolphins",    abbr: "MIA", conf: "AFC", div: "AFC East",  primary: "#008E97", secondary: "#FC4C02", emoji: "🐬" },
  NE:  { city: "New England",   name: "Patriots",    abbr: "NE",  conf: "AFC", div: "AFC East",  primary: "#002244", secondary: "#C60C30", emoji: "🔔" },
  NYJ: { city: "New York",      name: "Jets",        abbr: "NYJ", conf: "AFC", div: "AFC East",  primary: "#125740", secondary: "#000000", emoji: "✈️" },

  // ── AFC North ──
  BAL: { city: "Baltimore",     name: "Ravens",      abbr: "BAL", conf: "AFC", div: "AFC North", primary: "#241773", secondary: "#000000", emoji: "🐦‍⬛" },
  CIN: { city: "Cincinnati",    name: "Bengals",     abbr: "CIN", conf: "AFC", div: "AFC North", primary: "#FB4F14", secondary: "#000000", emoji: "🐯" },
  CLE: { city: "Cleveland",     name: "Browns",      abbr: "CLE", conf: "AFC", div: "AFC North", primary: "#311D00", secondary: "#FF3C00", emoji: "🐶" },
  PIT: { city: "Pittsburgh",    name: "Steelers",    abbr: "PIT", conf: "AFC", div: "AFC North", primary: "#FFB612", secondary: "#101820", emoji: "🔩" },

  // ── AFC South ──
  HOU: { city: "Houston",       name: "Texans",      abbr: "HOU", conf: "AFC", div: "AFC South", primary: "#03202F", secondary: "#A71930", emoji: "🐂" },
  IND: { city: "Indianapolis",  name: "Colts",       abbr: "IND", conf: "AFC", div: "AFC South", primary: "#002C5F", secondary: "#A2AAAD", emoji: "🧲" },
  JAX: { city: "Jacksonville",  name: "Jaguars",     abbr: "JAX", conf: "AFC", div: "AFC South", primary: "#101820", secondary: "#D7A22A", emoji: "🐆" },
  TEN: { city: "Tennessee",     name: "Titans",      abbr: "TEN", conf: "AFC", div: "AFC South", primary: "#0C2340", secondary: "#4B92DB", emoji: "💪" },

  // ── AFC West ──
  DEN: { city: "Denver",        name: "Broncos",     abbr: "DEN", conf: "AFC", div: "AFC West",  primary: "#FB4F14", secondary: "#002244", emoji: "🐎" },
  KC:  { city: "Kansas City",   name: "Chiefs",      abbr: "KC",  conf: "AFC", div: "AFC West",  primary: "#E31837", secondary: "#FFB81C", emoji: "🏹" },
  LV:  { city: "Las Vegas",     name: "Raiders",     abbr: "LV",  conf: "AFC", div: "AFC West",  primary: "#000000", secondary: "#A5ACAF", emoji: "☠️" },
  LAC: { city: "Los Angeles",   name: "Chargers",    abbr: "LAC", conf: "AFC", div: "AFC West",  primary: "#0080C6", secondary: "#FFC20E", emoji: "⚡" },

  // ── NFC East ──
  DAL: { city: "Dallas",        name: "Cowboys",     abbr: "DAL", conf: "NFC", div: "NFC East",  primary: "#003594", secondary: "#869397", emoji: "🤠" },
  NYG: { city: "New York",      name: "Giants",      abbr: "NYG", conf: "NFC", div: "NFC East",  primary: "#0B2265", secondary: "#A71930", emoji: "🗽" },
  PHI: { city: "Philadelphia",  name: "Eagles",      abbr: "PHI", conf: "NFC", div: "NFC East",  primary: "#004C54", secondary: "#A5ACAF", emoji: "🦅" },
  WAS: { city: "Washington",    name: "Commanders",  abbr: "WAS", conf: "NFC", div: "NFC East",  primary: "#5A1414", secondary: "#FFB612", emoji: "🫡" },

  // ── NFC North ──
  CHI: { city: "Chicago",       name: "Bears",       abbr: "CHI", conf: "NFC", div: "NFC North", primary: "#0B162A", secondary: "#C83803", emoji: "🐻" },
  DET: { city: "Detroit",       name: "Lions",       abbr: "DET", conf: "NFC", div: "NFC North", primary: "#0076B6", secondary: "#B0B7BC", emoji: "🦁" },
  GB:  { city: "Green Bay",     name: "Packers",     abbr: "GB",  conf: "NFC", div: "NFC North", primary: "#203731", secondary: "#FFB612", emoji: "🧀" },
  MIN: { city: "Minnesota",     name: "Vikings",     abbr: "MIN", conf: "NFC", div: "NFC North", primary: "#4F2683", secondary: "#FFC62F", emoji: "⚔️" },

  // ── NFC South ──
  ATL: { city: "Atlanta",       name: "Falcons",     abbr: "ATL", conf: "NFC", div: "NFC South", primary: "#A71930", secondary: "#000000", emoji: "🔥" },
  CAR: { city: "Carolina",      name: "Panthers",    abbr: "CAR", conf: "NFC", div: "NFC South", primary: "#0085CA", secondary: "#101820", emoji: "🐈‍⬛" },
  NO:  { city: "New Orleans",   name: "Saints",      abbr: "NO",  conf: "NFC", div: "NFC South", primary: "#D3BC8D", secondary: "#101820", emoji: "⚜️" },
  TB:  { city: "Tampa Bay",     name: "Buccaneers",  abbr: "TB",  conf: "NFC", div: "NFC South", primary: "#D50A0A", secondary: "#34302B", emoji: "🏴‍☠️" },

  // ── NFC West ──
  ARI: { city: "Arizona",       name: "Cardinals",   abbr: "ARI", conf: "NFC", div: "NFC West",  primary: "#97233F", secondary: "#000000", emoji: "🐦" },
  SF:  { city: "San Francisco", name: "49ers",       abbr: "SF",  conf: "NFC", div: "NFC West",  primary: "#AA0000", secondary: "#B3995D", emoji: "⛏️" },
  LAR: { city: "Los Angeles",   name: "Rams",        abbr: "LAR", conf: "NFC", div: "NFC West",  primary: "#003594", secondary: "#FFA300", emoji: "🐏" },
  SEA: { city: "Seattle",       name: "Seahawks",    abbr: "SEA", conf: "NFC", div: "NFC West",  primary: "#002244", secondary: "#69BE28", emoji: "🔊" },
};

export const TEAM_CODES = Object.keys(TEAMS);

export function teamLabel(code) {
  const t = TEAMS[code];
  return t ? `${t.city} ${t.name}` : code;
}

// Divisions grouped for the preseason "pick the division winner" picker and
// for the Groups/Standings tab.
export function teamsByDivision(div) {
  return TEAM_CODES.filter(c => TEAMS[c].div === div);
}

export function teamsByConference(conf) {
  return TEAM_CODES.filter(c => TEAMS[c].conf === conf);
}
