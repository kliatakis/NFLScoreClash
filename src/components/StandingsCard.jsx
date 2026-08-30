import { useEffect, useMemo, Fragment } from "react";
import { calcStandingsWithMovement, getScoringSettings, explainTiebreak, hasCompletedWeek, weeklyWinTally, describeBonuses } from "../lib/scoring.js";
import { weekLabel } from "../data/fixtures.js";
import { useFlipRows } from "../lib/hooks.js";
import { fsSaveLeagueStandingsSnapshot } from "../firebase.js";
import Avatar from "./Avatar.jsx";
import MovementArrows from "./MovementArrows.jsx";
import Podium from "./Podium.jsx";

// One-line "🧹2 🎯1 💎3 🤝1" summary — only the tiers actually earned, so it
// stays short on a phone.
const bonusChips = (entry) => {
  const parts = [];
  for (const [id, icon] of [["sweep", "🧹"], ["near", "🎯"], ["sharp", "💎"]]) {
    const n = (entry.badges || []).filter(b => b.id === id).length;
    if (n) parts.push(`${icon}${n}`);
  }
  if (entry.tiesCalled > 0) parts.push(`🤝${entry.tiesCalled}`);
  return parts.join(" ");
};

// Shared between DashboardTab (the selected league) and LeaguesTab (any
// league you expand) so the standings + movement-snapshot-persist logic
// only lives in one place.
export default function StandingsCard({ league, user, allUsers, allPredictions, results, specialResults }) {
  const scoring = getScoringSettings(league);
  const { standings, movementByUid, shouldPersist, newSnapshot, newVersion, newTrackedSnapshot, newTrackedVersion } =
    useMemo(() => calcStandingsWithMovement(league, allUsers, allPredictions, results, specialResults, scoring),
      [league, allUsers, allPredictions, results, specialResults]);

  useEffect(() => {
    if (shouldPersist) fsSaveLeagueStandingsSnapshot(league.id, newSnapshot, newVersion, newTrackedSnapshot, newTrackedVersion);
  }, [shouldPersist, newVersion, newTrackedVersion]);

  // Medals for the top 3; a toilet for dead last — but only once the league
  // is big enough that "last" isn't also one of the medal spots.
  const showToilet = standings.length > 3;

  // The podium waits for a full week of the season to be in the books —
  // 272 fixtures to scan, so memoized against the results it depends on.
  const podiumReady = useMemo(() => hasCompletedWeek(results), [results]);

  // Slide rows into place when the order changes, rather than teleporting.
  const rowsRef = useFlipRows(standings.map(s => s.uid).join(","));

  // A badge for every week you topped. Shown inline so the table says who's
  // been consistently sharp, not just who's accumulated the most.
  const tally = useMemo(
    () => weeklyWinTally(league, allUsers, allPredictions, results, scoring),
    [league, allUsers, allPredictions, results]
  );
  const weeksWonBy = (uid) => tally.perWeek.filter(w => w.winners.some(x => x.uid === uid)).map(w => w.week);

  // Profiles arrive from their own subscription, a beat after the league
  // does. Without this the table renders every player as "Unknown" for a
  // moment before snapping to real names — a skeleton reads as loading
  // rather than as broken data.
  const loadingProfiles = Object.keys(allUsers).length === 0 && (league.members || []).length > 0;
  if (loadingProfiles) {
    return (
      <div className="glass card">
        <div className="card-title">Standings</div>
        {(league.members || []).map(uid => (
          <div key={uid} className="skeleton skeleton-row" />
        ))}
      </div>
    );
  }

  return (
    <div className="glass card">
      <div className="card-title">Standings</div>

      <Podium standings={standings} allUsers={allUsers} user={user} ready={podiumReady} />

      <div className="standings-row standings-head">
        <span className="standings-col-rank">Rank</span>
        <span className="standings-col-player">Player</span>
        <span className="standings-col-stat">Correct</span>
        <span className="standings-col-stat">Bonus</span>
        <span className="standings-col-pts">Points</span>
        <span className="standings-col-move" />
      </div>

      <div ref={rowsRef}>
      {standings.map((entry, i) => {
        const rank = i + 1;
        const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : null;
        const isLast = showToilet && i === standings.length - 1;
        const isMe = entry.uid === user.uid;
        // Only relevant when tied on points with whoever's directly below —
        // explains which of the eight tiebreakers separated them.
        const next = standings[i + 1];
        const tieInfo = next && next.points === entry.points ? explainTiebreak(entry, next) : null;
        const bonusLines = describeBonuses(entry);
        // A divider after the podium, and one before the last spot — skipped
        // together if they'd land on the same row (e.g. a 4-person league,
        // where "4th" and "last" are the same person).
        const showPodiumDivider = i === 3 && !isLast;
        return (
          <Fragment key={entry.uid}>
            {showPodiumDivider && <div className="standings-divider standings-divider-podium" />}
            {isLast && <div className="standings-divider standings-divider-caution" />}
            <div className={`standings-row ${isMe ? "is-me" : ""}`} data-flip-key={entry.uid}>
              <span className="standings-rank standings-col-rank" title={`#${rank}`}>
                {medal || (isLast ? "🚽" : rank)}
              </span>
              <span className="standings-col-player">
                <Avatar user={allUsers[entry.uid]} size={30} />
                <span className="standings-player-info">
                  <span className="standings-player-line">
                    <span className={`standings-name ${isMe ? "you" : ""}`}>{entry.username}</span>
                    {(() => {
                      const weeks = weeksWonBy(entry.uid);
                      if (weeks.length === 0) return null;
                      return (
                        <span className="week-badge" title={`Top scorer in ${weeks.slice().reverse().map(weekLabel).join(", ")}`}>
                          🏅{weeks.length > 1 ? `×${weeks.length}` : ""}
                        </span>
                      );
                    })()}
                    {tieInfo && (
                      <span className="tiebreak-info" title={tieInfo}>ⓘ</span>
                    )}
                  </span>
                  {/* Phones have no room for two extra numeric columns AND a
                      readable name, so on mobile the stats drop under the name
                      and the columns are hidden instead. */}
                  <span className="standings-substats">
                    {entry.gamesScored > 0
                      ? `${entry.correct} of ${entry.gamesScored} correct`
                      : "no picks scored yet"}
                    {entry.totalBonus > 0 ? ` · +${entry.totalBonus} bonus` : ""}
                    {/* The tooltip is unreachable on a phone, so the mobile
                        line spells the breakdown out instead. */}
                    {bonusLines.length > 0 && (
                      <span className="standings-substats-bonus">{bonusChips(entry)}</span>
                    )}
                  </span>
                </span>
              </span>
              {/* "5" alone can't be read: five from five and five from sixty
                  are the same number on screen. That was survivable while
                  everyone started together and stops being so the moment
                  people join at different weeks — the table then ranks tenure
                  as much as skill, with nothing on it saying so. The
                  denominator is the whole fix. */}
              <span className="standings-col-stat">
                {entry.gamesScored > 0
                  ? <>{entry.correct}<span className="stat-of">/{entry.gamesScored}</span></>
                  : "–"}
              </span>
              <span className="standings-col-stat">
                {entry.totalBonus > 0 ? (
                  <>
                    +{entry.totalBonus}
                    <span className="tiebreak-info bonus-info" title={bonusLines.join("\n")}>ⓘ</span>
                  </>
                ) : "–"}
              </span>
              <span className="standings-pts standings-col-pts">{entry.points}</span>
              <span className="standings-col-move"><MovementArrows movement={movementByUid[entry.uid]} /></span>
            </div>
          </Fragment>
        );
      })}
      </div>

      <div className="standings-legend">
        <div className="standings-legend-title">Scoring</div>
        <div className="scoring-summary">
          {[
            ["Correct Winner", scoring.correctPoints],
            ["🤝 Correctly Called a Tie", scoring.tiePoints],
            ["🧹 Clean Sweep — whole week correct", scoring.sweepBonus],
            ["🎯 Near Perfect — one miss", scoring.nearPerfectBonus],
            ["💎 Sharp Week — two misses", scoring.sharpBonus],
            ["Division Winner", scoring.divisionPoints],
            ["Conference Champion", scoring.conferencePoints],
            ["Super Bowl Champion", scoring.superbowlPoints],
          ].map(([label, pts]) => (
            /* Every line is points, so every line reads the same way. The
               bonuses used to show "+5" while the rest showed "1 pt", which
               made them look like a different kind of thing. */
            <div key={label} className="scoring-row">
              <span>{label}</span>
              <span className="scoring-pts">{pts} {pts === 1 ? "pt" : "pts"}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="standings-legend">
        <div className="standings-legend-title">Notes</div>
        <ol className="note-list">
          <li>
            Week bonuses are counted in <b>misses</b>, not a fixed score — weeks range from 13 to 16 games
            because of byes, so a clean sweep means every game in <i>that</i> week. You must have picked the
            whole week to qualify.
          </li>
          <li>
            Ties on Total Points are broken in this order — look for the <span className="tiebreak-info" style={{ position: "static" }}>ⓘ</span> next
            to a name for the exact reason:
            <div className="tiebreak-steps">
              <span className="tiebreak-step"><span className="tiebreak-step-num">1</span>Super Bowl pick</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">2</span>Conference picks</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">3</span>Division picks</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">4</span>🏅 Game weeks won</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">5</span>🧹 Clean Sweeps</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">6</span>🎯 Near Perfects</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">7</span>💎 Sharp Weeks</span>
              <span className="tiebreak-step"><span className="tiebreak-step-num">8</span>Total correct picks</span>
            </div>
          </li>
        </ol>
      </div>
    </div>
  );
}
