import { useMemo, useState } from "react";
import { calcWeeklyStandings, weeklyWinTally, getScoringSettings, completedWeeks, weekAccuracyBadges } from "../lib/scoring.js";
import Avatar from "./Avatar.jsx";

// Per-week race, separate from the cumulative season table — so there's still
// something to win once someone has run away with the title.
export default function WeeklyStandingsCard({ league, user, allUsers, allPredictions, results }) {
  const scoring = getScoringSettings(league);
  const weeks = useMemo(() => completedWeeks(results), [results]);
  const [pickedWeek, setPickedWeek] = useState(null);
  const week = pickedWeek != null && weeks.includes(pickedWeek) ? pickedWeek : weeks[0];

  const table = useMemo(
    () => (week == null ? [] : calcWeeklyStandings(league, allUsers, allPredictions, results, scoring, week)),
    [league, allUsers, allPredictions, results, week]
  );
  const tally = useMemo(
    () => weeklyWinTally(league, allUsers, allPredictions, results, scoring),
    [league, allUsers, allPredictions, results]
  );

  if (week == null) {
    return (
      <div className="glass card">
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">No weeks played yet</div>
          <div className="empty-state-sub">Once results start coming in, each week gets its own leaderboard here.</div>
        </div>
      </div>
    );
  }

  const topPoints = table.length ? table[0].points : 0;
  const mostWins = Math.max(0, ...Object.values(tally.byUid));

  return (
    <div>
      <div className="glass card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Week {week} Points</div>
          {weeks.length > 1 && (
            <select className="form-select form-select-sm" style={{ maxWidth: 130 }}
              value={week} onChange={e => setPickedWeek(Number(e.target.value))}>
              {weeks.map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
          )}
        </div>

        {table.map((row, i) => {
          // Everyone level on the top score shares the win.
          const isWinner = row.points > 0 && row.points === topPoints;
          const isMe = row.uid === user.uid;
          return (
            <div key={row.uid} className={`standings-row ${isWinner ? "week-winner" : ""} ${isMe ? "is-me" : ""}`}>
              <span className="standings-rank standings-col-rank">{isWinner ? "👑" : i + 1}</span>
              <span className="standings-col-player">
                <Avatar user={allUsers[row.uid]} size={30} />
                <span className="standings-player-info">
                  <span className="standings-player-line">
                    <span className={`standings-name ${row.uid === user.uid ? "you" : ""}`}>{row.username}</span>
                  </span>
                  {/* Mobile hides the stat columns app-wide, so this table
                      needs the same under-the-name fallback the season
                      standings has, or those numbers vanish on a phone. */}
                  <span className="standings-substats">
                    {row.correct} of {row.gamesInWeek} correct
                    {row.badge ? ` · ${row.badge.icon} +${row.badge.points}` : ""}
                  </span>
                </span>
              </span>
              <span className="standings-col-stat">{row.correct}</span>
              <span className="standings-col-stat" title={row.badge ? `${row.badge.label} (+${row.badge.points})` : undefined}>
                {row.badge ? `${row.badge.icon}+${row.badge.points}` : "–"}
              </span>
              <span className="standings-pts standings-col-pts">{row.points}</span>
            </div>
          );
        })}

        <div className="standings-legend">
          <div className="standings-legend-title">Note</div>
          <ol className="note-list">
            <li>
              Only game results count towards a week's points. Division, conference and Super Bowl
              picks are season-long, so they're left out of the weekly race rather than dumped
              into whichever week they happened to be decided.
            </li>
            <li>
              Week bonuses are settled once every game in the week has a result — so the bonus
              column stays empty while a week is still being played, even if you've got
              everything right so far.
            </li>
          </ol>
        </div>
      </div>

      {/* Your badge cabinet — gold medals for weeks you topped, plus the
          accuracy badges earned by getting a week almost entirely right. */}
      {(() => {
        const wins = tally.perWeek.filter(w => w.winners.some(x => x.uid === user.uid)).map(w => w.week);
        const accuracy = weekAccuracyBadges(user.uid, allPredictions, results, scoring);
        const none = wins.length === 0 && accuracy.length === 0;
        return (
          <div className="glass card" style={{ marginBottom: 14 }}>
            <div className="card-title">Your Badges</div>
            {none ? (
              <div style={{ fontSize: 13, color: "var(--muted)" }}>
                No badges yet — top the league in a week for a 🏅, or get a whole week almost
                entirely right for an accuracy badge.
              </div>
            ) : (
              <>
                <div className="badge-strip">
                  {wins.slice().sort((a, b) => a - b).map(w => (
                    <span key={`win-${w}`} className="badge-medal" title={`Top scorer in Week ${w}`}>
                      <span className="badge-medal-icon">🏅</span>
                      <span className="badge-medal-week">WK {w}</span>
                    </span>
                  ))}
                  {accuracy.slice().reverse().map(b => (
                    <span key={`acc-${b.week}`} className={`badge-medal acc-${b.id}`}
                      title={`${b.label} in Week ${b.week} — ${b.blurb} of ${b.games} games, +${b.points} points`}>
                      <span className="badge-medal-icon">{b.icon}</span>
                      <span className="badge-medal-week">WK {b.week}</span>
                    </span>
                  ))}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10 }}>
                  {wins.length} week{wins.length === 1 ? "" : "s"} won (ties share the medal)
                  {accuracy.length > 0 && ` · ${accuracy.length} accuracy badge${accuracy.length === 1 ? "" : "s"} worth +${accuracy.reduce((s, b) => s + b.points, 0)} points`}
                </div>
              </>
            )}
          </div>
        );
      })()}

      <div className="glass card">
        <div className="card-title">Weeks Won</div>
        {Object.keys(tally.byUid).length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>Nobody's won a week yet.</div>
        ) : (
          (league.members || [])
            .map(uid => ({ uid, wins: tally.byUid[uid] || 0, username: allUsers[uid]?.username || "Unknown" }))
            .sort((a, b) => b.wins - a.wins || a.username.localeCompare(b.username))
            .map(row => (
              <div key={row.uid} className={`standings-row ${row.uid === user.uid ? "is-me" : ""}`}>
                <span className="standings-col-player" style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <Avatar user={allUsers[row.uid]} size={26} />
                  <span className={`standings-name ${row.uid === user.uid ? "you" : ""}`}>{row.username}</span>
                </span>
                <span style={{ flex: 1, minWidth: 60 }}>
                  <span className="winbar">
                    <span className="winbar-fill" style={{ width: mostWins ? `${(row.wins / mostWins) * 100}%` : "0%" }} />
                  </span>
                </span>
                <span className="standings-pts" style={{ width: 40, textAlign: "right" }}>{row.wins}</span>
              </div>
            ))
        )}
      </div>
    </div>
  );
}
