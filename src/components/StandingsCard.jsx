import { useEffect, useMemo, Fragment } from "react";
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
        <span className="standings-col-stat">Exact</span>
        <span className="standings-col-stat">Outcome</span>
        <span className="standings-col-pts">Points</span>
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
        // A divider after the podium, and one before the last spot — skipped
        // together if they'd land on the same row (e.g. a 4-person league,
        // where "4th" and "last" are the same person).
        const showPodiumDivider = i === 3 && !isLast;
        return (
          <Fragment key={entry.uid}>
            {showPodiumDivider && <div className="standings-divider standings-divider-podium" />}
            {isLast && <div className="standings-divider standings-divider-caution" />}
            <div className="standings-row">
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
          </Fragment>
        );
      })}

      <div className="standings-legend">
        <div className="standings-legend-title">Scoring</div>
        <div className="scoring-summary">
          <div className="scoring-row"><span>Correct Winner</span><span className="scoring-pts">{scoring.outcomePoints} pt{scoring.outcomePoints === 1 ? "" : "s"}</span></div>
          <div className="scoring-row"><span>Exact Score</span><span className="scoring-pts">{scoring.exactPoints} pt{scoring.exactPoints === 1 ? "" : "s"}</span></div>
          <div className="scoring-row"><span>Division Winner</span><span className="scoring-pts">{scoring.divisionPoints} pt{scoring.divisionPoints === 1 ? "" : "s"}</span></div>
          <div className="scoring-row"><span>Conference Champion</span><span className="scoring-pts">{scoring.conferencePoints} pt{scoring.conferencePoints === 1 ? "" : "s"}</span></div>
          <div className="scoring-row"><span>Super Bowl Champion</span><span className="scoring-pts">{scoring.superbowlPoints} pt{scoring.superbowlPoints === 1 ? "" : "s"}</span></div>
        </div>
      </div>

      <div className="standings-legend">
        <div className="standings-legend-title">Notes</div>
        <ol className="note-list">
          <li>
            <b>Exact Score</b> and <b>Outcome</b> never double-count the same game — a perfectly-called score
            (e.g. predicting 21–7 and it lands 21–7) counts as an Exact Score only, not also an Outcome.
          </li>
          <li>
            Ties on Total Points are broken in this order — look for the <span className="tiebreak-info" style={{ position: "static" }}>ⓘ</span> next
            to a name for the exact reason:
            <div className="tiebreak-steps">
              <span className="tiebreak-step"><span className="tiebreak-step-num">1</span>Super Bowl pick</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">2</span>Conference picks</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">3</span>Division picks</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">4</span>Exact scores</span>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
