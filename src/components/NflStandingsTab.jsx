import { useEffect, useState } from "react";
import { DIVISIONS, teamsByDivision } from "../data/teams.js";
import { REGULAR_SEASON_FIXTURES } from "../data/fixtures.js";
import { fsSubscribeResults } from "../firebase.js";
import TeamBadge from "./TeamBadge.jsx";

// Real NFL win/loss standings per division, computed from entered results —
// the equivalent of the old World Cup app's "Groups" tab (who's actually
// leading), separate from the fantasy prediction leaderboard.
export default function NflStandingsTab() {
  const [results, setResults] = useState({});
  useEffect(() => fsSubscribeResults(setResults), []);

  const recordFor = (teamCode) => {
    let w = 0, l = 0, t = 0;
    for (const f of REGULAR_SEASON_FIXTURES) {
      const r = results[f.id];
      if (!r || (f.home !== teamCode && f.away !== teamCode)) continue;
      const isHome = f.home === teamCode;
      const us = isHome ? r.homeScore : r.awayScore;
      const them = isHome ? r.awayScore : r.homeScore;
      if (us > them) w++; else if (us < them) l++; else t++;
    }
    return { w, l, t };
  };

  const allDivisions = Object.values(DIVISIONS).flat();

  return (
    <div>
      <div className="page-title">NFL Standings</div>
      <div className="page-sub">Real win/loss records by division, based on entered results.</div>
      <div className="grid-2">
        {allDivisions.map(div => (
          <DivisionCard key={div} division={div} recordFor={recordFor} />
        ))}
      </div>
    </div>
  );
}

function DivisionCard({ division, recordFor }) {
  const teams = teamsByDivision(division)
    .map(code => ({ code, ...recordFor(code) }))
    .sort((a, b) => (b.w - b.l) - (a.w - a.l));

  return (
    <div className="glass card">
      <div className="card-title">{division}</div>
      {teams.map(t => (
        <div key={t.code} className="standings-row">
          <TeamBadge code={t.code} showName />
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-display)", fontSize: 15 }}>{t.w}-{t.l}{t.t ? `-${t.t}` : ""}</span>
        </div>
      ))}
    </div>
  );
}
