import { useEffect, useMemo } from "react";
import { calcStandingsWithMovement, getScoringSettings } from "../lib/scoring.js";
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

  return (
    <div className="glass card">
      <div className="card-title">Standings</div>
      {standings.map((entry, i) => (
        <div key={entry.uid} className="standings-row">
          <span className={`standings-rank ${i === 0 ? "gold" : i === 1 ? "silver" : i === 2 ? "bronze" : ""}`}>{i + 1}</span>
          <Avatar user={allUsers[entry.uid]} size={30} />
          <span className={`standings-name ${entry.uid === user.uid ? "you" : ""}`}>{entry.username}</span>
          <MovementArrows movement={movementByUid[entry.uid]} />
          <span className="standings-pts">{entry.points}</span>
        </div>
      ))}
    </div>
  );
}
