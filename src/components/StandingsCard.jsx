import { useEffect, useMemo } from "react";
import { calcStandingsWithMovement, getScoringSettings, explainTiebreak } from "../lib/scoring.js";
import { fsSaveLeagueStandingsSnapshot } from "../firebase.js";
import Avatar from "./Avatar.jsx";
import MovementArrows from "./MovementArrows.jsx";

// Shared between DashboardTab (the selected league) and LeaguesTab (any
// league you expand) so the standings + movement-snapshot-persist logic
// only lives in one place.
export default function StandingsCard({ league, user, allUsers, allPredictions, results, specialResults }) {
  const scoring = getScoringSettings(league);
  const { standings, movementByUid, shouldPersist, newSnapshot, newVersion } =
    useMemo(() => calcStandingsWithMovement(league, allUsers, allPredictions, results, specialResults, scoring),
      [league, allUsers, allPredictions, results, specialResults]);

  useEffect(() => {
    if (shouldPersist) fsSaveLeagueStandingsSnapshot(league.id, newSnapshot, newVersion);
  }, [shouldPersist, newVersion]);

  // Medals for the top 3; a toilet for dead last — but only once the league
  // is big enough that "last" isn't also one of the medal spots.
  const showToilet = standings.length > 3;

  return (
    <div className="glass card">
      <div className="card-title">Standings</div>

      <div className="standings-row standings-head">
        <span className="standings-col-rank">Rank</span>
        <span className="standings-col-player">Player</span>
        <span className="standings-col-stat">Exact Score</span>
        <span className="standings-col-stat">Outcome</span>
        <span className="standings-col-pts">Total Points</span>
        <span className="standings-col-move" />
      </div>

      {standings.map((entry, i) => {
        const rank = i + 1;
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
        const isLast = showToilet && i === standings.length - 1;
        // Only relevant when tied on points with whoever's directly below —
        // explains which of the 4 tiebreakers separated them.
        const next = standings[i + 1];
        const tieInfo = next && next.points === entry.points ? explainTiebreak(entry, next) : null;
        return (
          <div key={entry.uid} className="standings-row">
            <span className="standings-rank standings-col-rank" title={`#${rank}`}>
              {medal || (isLast ? "🚽" : rank)}
            </span>
            <span className="standings-col-player" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <Avatar user={allUsers[entry.uid]} size={30} />
              <span className={`standings-name ${entry.uid === user.uid ? "you" : ""}`}>{entry.username}</span>
              {tieInfo && (
                <span className="tiebreak-info" title={tieInfo}>ⓘ</span>
              )}
            </span>
            <span className="standings-col-stat">{entry.exact}</span>
            <span className="standings-col-stat">{entry.correct}</span>
            <span className="standings-pts standings-col-pts">{entry.points}</span>
            <span className="standings-col-move"><MovementArrows movement={movementByUid[entry.uid]} /></span>
          </div>
        );
      })}

      <div className="standings-legend">
        <b>Exact Score</b> and <b>Outcome</b> never double-count the same game — a perfectly-called score
        (e.g. predicting 21–7 and it lands 21–7) counts as an Exact Score only, not also an Outcome.
        <br />
        Ties on Total Points are broken in order: 1) Super Bowl pick, 2) conference picks, 3) division picks,
        4) exact scores — look for the <span className="tiebreak-info" style={{ position: "static" }}>ⓘ</span> next to a name for the reason.
      </div>
    </div>
  );
}
