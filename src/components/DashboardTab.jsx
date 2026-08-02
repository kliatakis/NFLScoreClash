import { useMemo } from "react";
import { calcStandings, getScoringSettings, pickWinner } from "../lib/scoring.js";
import { REGULAR_SEASON_FIXTURES } from "../data/fixtures.js";
import { teamTint } from "../data/teams.js";
import { formatKickoff } from "../lib/time.js";
import { useCountUp } from "../lib/hooks.js";
import Avatar from "./Avatar.jsx";
import StandingsCard from "./StandingsCard.jsx";
import HighlightsCard from "./HighlightsCard.jsx";
import SeasonCountdown from "./SeasonCountdown.jsx";
import TeamBadge from "./TeamBadge.jsx";

// Stat card whose number animates up on load, and whose top accent bar
// matches the colour of its own value (they were all blue before, regardless
// of what the number underneath was).
function StatCard({ value, label, color, accent, suffix = "", sub = null, emptyLabel = "–", primary = false }) {
  const shown = useCountUp(value);
  return (
    <div className={`glass stat-card ${primary ? "primary" : ""}`} style={accent ? { "--card-accent": accent } : undefined}>
      <div className="stat-card-val" style={color ? { color } : undefined}>
        {value == null ? emptyLabel : `${shown}${suffix}`}
      </div>
      <div className="stat-card-label">
        {label}
        {sub}
      </div>
    </div>
  );
}

export default function DashboardTab({ user, league, allUsers, allPredictions, results, specialResults, lastLoginPrev, setTab }) {
  if (!league) {
    return (
      <div className="glass card">
        <div className="empty-state">
          <div className="empty-state-icon">🏈</div>
          <div className="empty-state-title">No league yet</div>
          <div className="empty-state-sub" style={{ marginBottom: 16 }}>
            Create one and share the code with friends, or join a league someone's already sent you a code for.
          </div>
          <button className="btn btn-primary" onClick={() => setTab("leagues")}>Go to My Leagues</button>
        </div>
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

  // A rank is meaningless before anything has been scored — everyone is level
  // on zero and the order is just however the member list happens to sit. Show
  // N/A until there's a real result (or a decided season pick) behind it.
  const seasonScoring = Object.keys(results).length > 0 || Object.keys(specialResults).length > 0;
  const myRank = seasonScoring && me ? standings.indexOf(me) + 1 : null;

  // How far through this week's picks you are — the thing you most need to
  // know when you open the app mid-week.
  // Whoever is nearest you on points, above or below. A table tells you your
  // rank; this tells you who you're actually racing.
  const rival = useMemo(() => {
    if (!seasonScoring || !me || standings.length < 2) return null;
    let best = null;
    for (const entry of standings) {
      if (entry.uid === user.uid) continue;
      const gap = Math.abs(entry.points - me.points);
      if (!best || gap < best.gap) best = { entry, gap, ahead: entry.points > me.points };
    }
    return best;
  }, [standings, me, seasonScoring, user.uid]);

  const myPicks = (allPredictions[user.uid] || {}).picks || {};
  const pickProgress = useMemo(() => {
    if (upcomingWeek == null) return null;
    const weekFixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === upcomingWeek);
    const made = weekFixtures.filter(f => pickWinner(myPicks[f.id])).length;
    return { made, total: weekFixtures.length };
  }, [upcomingWeek, allPredictions, user.uid]);

  // Accuracy = games where you called the winner, out of games that have a
  // result AND a pick. Games you didn't pick aren't held against you — that's
  // a "didn't play" state, not a wrong guess.
  const accuracyPct = me && me.gamesScored > 0
    ? Math.round((me.correct / me.gamesScored) * 100)
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

      <SeasonCountdown
        user={user} allPredictions={allPredictions} timezone={user.timezone}
        onGoToPicks={() => setTab("predictions")}
      />

      {rival && (
        <div className="glass card rival-card" onClick={() => setTab("leagues")}>
          <div className="rival-label">Closest rival</div>
          <div className="rival-body">
            <Avatar user={allUsers[rival.entry.uid]} size={40} />
            <div className="rival-text">
              <b>{rival.entry.username}</b>
              {rival.gap === 0
                ? " is level with you on points."
                : rival.ahead
                  ? ` is ${rival.gap} point${rival.gap === 1 ? "" : "s"} ahead of you.`
                  : ` is ${rival.gap} point${rival.gap === 1 ? "" : "s"} behind you.`}
            </div>
            <div className={`rival-gap ${rival.ahead ? "behind" : "leading"}`}>
              {rival.gap === 0 ? "=" : rival.ahead ? `−${rival.gap}` : `+${rival.gap}`}
            </div>
          </div>
        </div>
      )}

      {pickProgress && pickProgress.made < pickProgress.total && (
        <div className="glass card pick-progress" onClick={() => setTab("predictions")}>
          <div className="pick-progress-head">
            <span>Week {upcomingWeek} picks</span>
            <b>{pickProgress.made} / {pickProgress.total}</b>
          </div>
          <span className="pick-progress-bar">
            <span className="pick-progress-fill" style={{ width: `${(pickProgress.made / pickProgress.total) * 100}%` }} />
          </span>
          <div className="pick-progress-hint">
            {pickProgress.made === 0
              ? "You haven't made any picks for this week yet — tap to start."
              : `${pickProgress.total - pickProgress.made} still to go — tap to finish.`}
          </div>
        </div>
      )}

      <HighlightsCard league={league} allUsers={allUsers} allPredictions={allPredictions} results={results} />

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <StatCard
          value={myRank} label="Your Rank" emptyLabel="N/A" primary
          color="var(--accent)" accent="linear-gradient(90deg, var(--accent), #06d6f7)"
          sub={!seasonScoring ? (
            <span style={{ display: "block", textTransform: "none", fontWeight: 500, marginTop: 2, opacity: 0.8 }}>
              once results are in
            </span>
          ) : null}
        />
        <StatCard
          value={me?.points ?? 0} label="Your Points"
          accent="linear-gradient(90deg, #8b5cf6, var(--accent))"
        />
        <StatCard
          value={me?.bonusPoints ?? 0} label="Bonus Points"
          color="var(--gold)" accent="linear-gradient(90deg, var(--gold), #fbbf24)"
        />
        <StatCard
          value={accuracyPct} label="Prediction Accuracy" suffix="%"
          color="var(--green)" accent="linear-gradient(90deg, var(--green), #4ade80)"
          sub={me && me.gamesScored > 0 ? (
            <span style={{ display: "block", textTransform: "none", fontWeight: 500, marginTop: 2, opacity: 0.8 }}>
              {me.correct}/{me.gamesScored} winners called
            </span>
          ) : null}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <StandingsCard league={league} user={user} allUsers={allUsers} allPredictions={allPredictions} results={results} specialResults={specialResults} />
      </div>

      <div className="card-title">{upcomingWeek != null ? `Week ${upcomingWeek} — Upcoming Games` : "Upcoming Games"}</div>
      {upcoming.length === 0 && <div className="glass card" style={{ color: "var(--muted)" }}>No upcoming games loaded.</div>}
      <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
        {upcoming.map(f => (
          <div key={f.id} className="fixture-card glass team-tinted" style={{ minWidth: 200, flexShrink: 0, ...teamTint(f) }}>
            <div className="fixture-meta">
              {formatKickoff(f.kickoffUTC, user.timezone)}
              {f.network ? ` · ${f.network}` : ""}
              {f.note ? ` · ${f.note}` : ""}
            </div>
            <div className="fixture-body">
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
