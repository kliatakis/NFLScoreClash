import { useMemo } from "react";
import { calcStandings, getScoringSettings } from "../lib/scoring.js";
import { REGULAR_SEASON_FIXTURES } from "../data/fixtures.js";
import { formatKickoff } from "../lib/time.js";
import StandingsCard from "./StandingsCard.jsx";
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
  // Used only for the "my rank / my points / my accuracy" stat cards below;
  // StandingsCard independently computes (and persists) the same standings
  // for the movement-arrow table, so this is a light, side-effect-free calc.
  const standings = useMemo(() => calcStandings(league, allUsers, allPredictions, results, specialResults, scoring),
    [league, allUsers, allPredictions, results, specialResults]);

  // "What's new since you last logged in" — driven by the account-wide
  // lastLoginAt timestamp (see App.jsx / firebase.js), not localStorage, so
  // it's identical no matter which device you check from.
  const newResultsCount = useMemo(() => {
    if (!lastLoginPrev) return 0;
    return Object.values(results).filter(r => r.enteredAt && r.enteredAt > lastLoginPrev).length;
  }, [results, lastLoginPrev]);

  // The full slate for the earliest week that still has unplayed games —
  // rather than an arbitrary "next 6" cut that could straddle two weeks.
  const upcomingWeek = useMemo(() => {
    const weeks = REGULAR_SEASON_FIXTURES.filter(f => !results[f.id]).map(f => f.week);
    return weeks.length ? Math.min(...weeks) : null;
  }, [results]);
  const upcoming = upcomingWeek != null
    ? REGULAR_SEASON_FIXTURES.filter(f => f.week === upcomingWeek)
    : [];

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

      <div style={{ marginBottom: 24 }}>
        <StandingsCard league={league} user={user} allUsers={allUsers} allPredictions={allPredictions} results={results} specialResults={specialResults} />
      </div>

      <div className="card-title">{upcomingWeek != null ? `Week ${upcomingWeek} — Upcoming Games` : "Upcoming Games"}</div>
      {upcoming.length === 0 && <div className="glass card" style={{ color: "var(--muted)" }}>No upcoming games loaded.</div>}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {upcoming.map(f => (
          <div key={f.id} className="fixture-card glass" style={{ minWidth: 200, flexShrink: 0 }}>
            <div className="fixture-meta">
              {formatKickoff(f.kickoffUTC, user.timezone)}
              {f.network ? ` · ${f.network}` : ""}
              {f.note ? ` · ${f.note}` : ""}
            </div>
            <div className="fixture-body" style={{ flexDirection: "column", alignItems: "flex-start" }}>
              <span className="fixture-teams">
                <span className="fixture-team-row"><TeamBadge code={f.away} showName /></span>
                <span className="fixture-vs">@</span>
                <span className="fixture-team-row"><TeamBadge code={f.home} showName /></span>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
