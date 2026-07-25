import { useEffect, useMemo, useState } from "react";
import { DIVISIONS, teamsByDivision, TEAMS } from "../data/teams.js";
import { REGULAR_SEASON_FIXTURES } from "../data/fixtures.js";
import { fsSubscribeResults } from "../firebase.js";
import TeamBadge from "./TeamBadge.jsx";

// Real NFL win/loss records per division, computed from entered results —
// separate from the fantasy prediction leaderboard. This is a read-only
// reference view: who's actually good, not who's predicting well.
export default function NflStandingsTab() {
  const [results, setResults] = useState({});
  useEffect(() => fsSubscribeResults(setResults), []);

  const records = useMemo(() => {
    const rec = {};
    for (const code of Object.keys(TEAMS)) rec[code] = { w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    for (const f of REGULAR_SEASON_FIXTURES) {
      const r = results[f.id];
      if (!r) continue;
      const h = rec[f.home], a = rec[f.away];
      if (!h || !a) continue;
      h.pf += r.homeScore; h.pa += r.awayScore;
      a.pf += r.awayScore; a.pa += r.homeScore;
      if (r.homeScore > r.awayScore) { h.w++; a.l++; }
      else if (r.awayScore > r.homeScore) { a.w++; h.l++; }
      else { h.t++; a.t++; }
    }
    return rec;
  }, [results]);

  const gamesPlayed = useMemo(
    () => REGULAR_SEASON_FIXTURES.filter(f => results[f.id]).length,
    [results]
  );

  if (gamesPlayed === 0) {
    return (
      <div>
        <div className="page-title">NFL Standings</div>
        <div className="page-sub">Real win/loss records by division, based on entered results.</div>
        <div className="glass card">
          <div className="empty-state">
            <div className="empty-state-icon">🏟️</div>
            <div className="empty-state-title">The season hasn't started</div>
            <div className="empty-state-sub">
              Every team is 0–0. Once results start being entered, division races will show up here.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">NFL Standings</div>
      <div className="page-sub">
        Real win/loss records by division · {gamesPlayed} of {REGULAR_SEASON_FIXTURES.length} games played
      </div>

      {Object.entries(DIVISIONS).map(([conf, divisions]) => (
        <div key={conf} style={{ marginBottom: 26 }}>
          <div className={`conf-heading ${conf.toLowerCase()}`}>{conf}</div>
          <div className="grid-2">
            {divisions.map(div => (
              <DivisionCard key={div} division={div} records={records} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DivisionCard({ division, records }) {
  const teams = teamsByDivision(division)
    .map(code => {
      const r = records[code];
      const played = r.w + r.l + r.t;
      // Ties count as half a win, the way the NFL actually does it.
      const pct = played ? (r.w + r.t * 0.5) / played : 0;
      return { code, ...r, played, pct, diff: r.pf - r.pa };
    })
    .sort((a, b) => b.pct - a.pct || b.diff - a.diff || a.code.localeCompare(b.code));

  // Only crown a leader once somebody has actually played.
  const anyPlayed = teams.some(t => t.played > 0);

  return (
    <div className="glass card">
      <div className="card-title">{division}</div>
      {teams.map((t, i) => {
        const isLeader = anyPlayed && i === 0 && t.pct > 0;
        return (
          <div key={t.code} className={`nfl-row ${isLeader ? "leader" : ""}`}>
            <span className="nfl-row-team">
              {isLeader && <span className="nfl-crown" title={`${division} leader`}>👑</span>}
              <TeamBadge code={t.code} showName />
            </span>
            <span className="nfl-row-bar">
              <span className="nfl-bar">
                <span className="nfl-bar-fill" style={{ width: `${Math.round(t.pct * 100)}%` }} />
              </span>
            </span>
            <span className="nfl-row-rec" title={`Point differential ${t.diff >= 0 ? "+" : ""}${t.diff}`}>
              {t.w}-{t.l}{t.t ? `-${t.t}` : ""}
            </span>
          </div>
        );
      })}
    </div>
  );
}
