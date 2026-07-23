import { useEffect, useMemo } from "react";
import { calcStandingsWithMovement, getScoringSettings } from "../lib/scoring.js";
import { fsSaveLeagueStandingsSnapshot } from "../firebase.js";
import { REGULAR_SEASON_FIXTURES } from "../data/fixtures.js";
import Avatar from "./Avatar.jsx";
import MovementArrows from "./MovementArrows.jsx";
import TeamBadge from "./TeamBadge.jsx";

export default function DashboardTab({ user, league, allUsers, allPredictions, results, specialResults, lastLoginPrev, setTab }) {
  if (!league) {
    return (
      <div className="glass card" style={{ textAlign: "center" }}>
        <div style={{ fontSize: 15, marginBottom: 12 }}>Pick or create a league to see your standings.</div>
        <button className="btn btn-primary" onClick={() => setTab("leagues")}>Go to My Leagues</button>
      </div>
    );
  }

  const scoring = getScoringSettings(league);
  const { standings, movementByUid, shouldPersist, newSnapshot, newVersion } =
    useMemo(() => calcStandingsWithMovement(league, allUsers, allPredictions, results, specialResults, scoring),
      [league, allUsers, allPredictions, results, specialResults]);

  useEffect(() => {
    if (shouldPersist) fsSaveLeagueStandingsSnapshot(league.id, newSnapshot, newVersion);
  }, [shouldPersist, newVersion]);

  // "What's new since you last logged in" — driven by the account-wide
  // lastLoginAt timestamp (see App.jsx / firebase.js), not localStorage, so
  // it's identical no matter which device you check from.
  const newResultsCount = useMemo(() => {
    if (!lastLoginPrev) return 0;
    return Object.values(results).filter(r => r.enteredAt && r.enteredAt > lastLoginPrev).length;
  }, [results, lastLoginPrev]);

  const upcoming = REGULAR_SEASON_FIXTURES
    .filter(f => !results[f.id])
    .slice(0, 6);

  const me = standings.find(s => s.uid === user.uid);
  const myRank = me ? standings.indexOf(me) + 1 : null;

  // Accuracy = games where the winner was picked correctly (exact score
  // counts too, it's still a correct-winner pick) out of games with an
  // actual result AND a pick entered. Games with no pick made aren't held
  // against you here — that's a "didn't play" state, not a wrong guess.
  const accuracyPct = me && me.gamesScored > 0
    ? Math.round(((me.correct + me.exact) / me.gamesScored) * 100)
    : null;

  return (
    <div>
      <div className="page-title">{league.name}</div>
      <div className="page-sub">Code <code>{league.id}</code> · {league.members.length} members</div>

      {newResultsCount > 0 && (
        <div className="glass card" style={{ marginBottom: 18, borderLeft: "3px solid var(--accent)" }}>
          🏈 {newResultsCount} new result{newResultsCount > 1 ? "s" : ""} since you last logged in.
        </div>
      )}

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="glass stat-card">
          <div className="stat-card-val" style={{ color: "var(--accent)" }}>{myRank ?? "–"}</div>
          <div className="stat-card-label">Your Rank</div>
        </div>
        <div className="glass stat-card">
          <div className="stat-card-val">{me?.points ?? 0}</div>
          <div className="stat-card-label">Your Points</div>
        </div>
        <div className="glass stat-card">
          <div className="stat-card-val" style={{ color: "var(--gold)" }}>{me?.exact ?? 0}</div>
          <div className="stat-card-label">Exact Scores</div>
        </div>
        <div className="glass stat-card">
          <div className="stat-card-val" style={{ color: "var(--green)" }}>{accuracyPct != null ? `${accuracyPct}%` : "–"}</div>
          <div className="stat-card-label">
            Prediction Accuracy
            {me && me.gamesScored > 0 && (
              <span style={{ display: "block", textTransform: "none", fontWeight: 500, marginTop: 2, opacity: 0.8 }}>
                {me.correct + me.exact}/{me.gamesScored} winners called
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="glass card" style={{ marginBottom: 24 }}>
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

      <div className="card-title">Upcoming Games</div>
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {upcoming.map(f => (
          <div key={f.id} className="glass" style={{ minWidth: 200, borderRadius: 14, padding: 14, flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.5 }}>Week {f.week}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <TeamBadge code={f.away} showName />
              <TeamBadge code={f.home} showName />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
