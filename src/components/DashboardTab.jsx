import { useMemo, useState, useEffect } from "react";
import {
  calcStandings, getScoringSettings, pickWinner, pickStreaks, liveWeekStatus,
  pendingPickers, nextOpenWeek, calcMatchScore,
} from "../lib/scoring.js";
import {
  REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES, PLAYOFF_FIXTURES, PRESEASON_FIXTURES,
  isPlayoffMatchupReady,
} from "../data/fixtures.js";
import { fsSubscribePlayoffFixtures } from "../firebase.js";
import { teamTint } from "../data/teams.js";
import { formatKickoff, formatDuration } from "../lib/time.js";
import { useCountUp, useSeasonPicksLock } from "../lib/hooks.js";
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

export default function DashboardTab({ user, league, allUsers, allPredictions, results, specialResults, lastLoginPrev, setTab, leaguesLoaded = true, hasLeagues = false }) {
  // ⚠️ Every hook in this component must run BEFORE the "no league" guard
  // further down.
  //
  // The guard used to sit at the top, which broke the rules of hooks: on load
  // the leagues subscription hasn't delivered yet, so `league` is null and the
  // component returned early having called no hooks. A moment later the league
  // arrives, the same mounted component re-renders, and suddenly five useMemos
  // run — React sees more hooks than last time and throws. Keep the guard
  // below the hooks and this can't recur.
  const scoring = getScoringSettings(league);
  // Used only for the "my rank / my points / my accuracy" stat cards below;
  // StandingsCard independently computes (and persists) the same standings
  // for the movement-arrow table, so this is a light, side-effect-free calc.
  const standings = useMemo(
    () => (league ? calcStandings(league, allUsers, allPredictions, results, specialResults, scoring) : []),
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
  // Shared with the Predictions week selector so the two always agree.
  const upcomingWeek = useMemo(() => nextOpenWeek(results), [results]);

  // ── The playoffs ──────────────────────────────────────────────────────────
  // Everything above keys off REGULAR_SEASON_FIXTURES, so from the moment
  // Week 18 finished the dashboard had nothing to say for a month — no games
  // listed, no nudge, no progress — while the highest-stakes picks of the
  // season were going unmade. The matchups live in the results document,
  // attached by an admin (see AdminPanel → Playoffs).
  const [playoffMatchups, setPlayoffMatchups] = useState({});
  useEffect(() => fsSubscribePlayoffFixtures(setPlayoffMatchups), []);

  // Only games an admin has actually confirmed. A placeholder with no teams
  // isn't pickable and shouldn't be advertised as if it were.
  const openPlayoffGames = useMemo(() => PLAYOFF_FIXTURES
    .filter(f => isPlayoffMatchupReady(playoffMatchups[f.id]) && !results[f.id])
    .map(f => ({ ...f, ...playoffMatchups[f.id], note: f.label }))
    .sort((a, b) => new Date(a.kickoffUTC) - new Date(b.kickoffUTC)),
    [playoffMatchups, results]);

  // How much of the table is rehearsal. Counted across the whole league, not
  // just you, because the warning is about the standings being wrong for
  // everybody.
  const trialPoints = useMemo(() => {
    let n = 0;
    for (const f of PRESEASON_FIXTURES) {
      const r = results[f.id];
      if (!r) continue;
      for (const uid of (league?.members || [])) {
        n += calcMatchScore((allPredictions[uid]?.picks || {})[f.id], r, scoring);
      }
    }
    return n;
  }, [results, allPredictions, league, scoring]);

  const playoffProgress = useMemo(() => {
    if (openPlayoffGames.length === 0) return null;
    const picks = (allPredictions[user.uid] || {}).picks || {};
    const made = openPlayoffGames.filter(f => pickWinner(picks[f.id])).length;
    return { made, total: openPlayoffGames.length };
  }, [openPlayoffGames, allPredictions, user.uid]);

  const upcoming = upcomingWeek != null
    ? REGULAR_SEASON_FIXTURES.filter(f => f.week === upcomingWeek)
    : openPlayoffGames;

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

  // Your run of consecutive correct calls. Median best over a season is
  // around 10, so this is a number worth watching.
  const streaks = useMemo(
    () => pickStreaks(user.uid, allPredictions, results),
    [allPredictions, results, user.uid]);

  // Mid-week tension: a bonus tier you're still on course for. Only ever
  // appears while a week is part-played — see liveWeekStatus.
  const live = useMemo(() => {
    // Newest first: a stale part-played week (a game whose result never
    // arrived) would otherwise sit there forever and mask the current one.
    const weeks = REGULAR_SEASON_FIXTURES.map(f => f.week);
    for (const w of [...new Set(weeks)].sort((a, b) => b - a)) {
      const st = liveWeekStatus(user.uid, w, allPredictions, results, scoring);
      if (st) return st;
    }
    return null;
  }, [allPredictions, results, user.uid, league]);

  // Who still hasn't done their picks. Nagging is the point.
  const pending = useMemo(
    () => (league && upcomingWeek != null
      ? pendingPickers(league, allUsers, allPredictions, upcomingWeek, results)
      : null),
    [league, allUsers, allPredictions, upcomingWeek, results]);

  // ── To-do list ────────────────────────────────────────────────────────────
  // A brand-new member lands on a dashboard with nothing on it and no idea
  // what to do first. Three concrete steps, each ticking off as it's done,
  // and the whole card goes once they're all complete.
  const [checklistHidden, setChecklistHidden] = useState(() => {
    try { return localStorage.getItem("sc_hideChecklist") === "true"; } catch { return false; }
  });
  const hideChecklist = () => {
    setChecklistHidden(true);
    try { localStorage.setItem("sc_hideChecklist", "true"); } catch { /* nothing to do */ }
  };
  const seasonPicksLocked = useSeasonPicksLock();
  const checklist = useMemo(() => {
    if (!league) return null;
    const specials = (allPredictions[user.uid] || {}).specials || {};
    const seasonMade = SPECIAL_PICK_TYPES.filter(t => specials[t.id]).length;
    const steps = [
      // Dropped once the deadline passes. Left in, it would nag all season
      // about something that can no longer be done — the checklist would
      // never complete and never go away.
      ...(seasonPicksLocked ? [] : [{
        id: "season", label: "Make your season picks",
        note: `${seasonMade} of ${SPECIAL_PICK_TYPES.length} · they lock at kickoff and never reopen`,
        done: seasonMade === SPECIAL_PICK_TYPES.length, go: "predictions",
      }]),
      // Dropped once the regular season is over. It used to survive as
      // "Pick Week" with the note "the season hasn't started" — wrong on both
      // counts in January — and because it could never be marked done, the
      // whole card sat there nagging for the entire playoffs.
      ...(upcomingWeek == null || !pickProgress ? [] : [{
        id: "week", label: `Pick Week ${upcomingWeek}`,
        note: `${pickProgress.made} of ${pickProgress.total} games`,
        done: pickProgress.made === pickProgress.total, go: "predictions",
      }]),
      // TAKES OVER from the weekly step — it does not sit alongside it.
      //
      // Gated on the regular season being finished, not merely on a playoff
      // matchup existing. An admin setting one early (or testing one in
      // September) otherwise parked "Pick the playoff games" in the list for
      // months, next to a weekly step that's the actual job that week.
      //
      // The trade-off: this waits for every Week 18 result to be in, so one
      // score an admin forgets to enter would delay the nudge. In practice
      // the daily fetch has them all by the Monday, days before the wild
      // card round — and the Predictions tab and Upcoming strip both show
      // the playoffs regardless.
      ...(upcomingWeek == null && playoffProgress ? [{
        id: "playoffs", label: "Pick the playoff games",
        note: `${playoffProgress.made} of ${playoffProgress.total} confirmed game${playoffProgress.total === 1 ? "" : "s"}`,
        done: playoffProgress.made === playoffProgress.total, go: "predictions",
      }] : []),
      { id: "invite", label: "Invite someone",
        note: league.members.length > 1
          ? `${league.members.length} in the league`
          : "a league of one is just a spreadsheet",
        done: league.members.length > 1, go: "leagues" },
    ];
    return steps.every(s => s.done) ? null : steps;
  }, [league, allPredictions, user.uid, upcomingWeek, pickProgress, playoffProgress, seasonPicksLocked]);

  // Accuracy = games where you called the winner, out of games that have a
  // result AND a pick. Games you didn't pick aren't held against you — that's
  // a "didn't play" state, not a wrong guess.
  const accuracyPct = me && me.gamesScored > 0
    ? Math.round((me.correct / me.gamesScored) * 100)
    : null;

  // ── Guard goes HERE, after every hook. See the note at the top. ──────────
  //
  // Three distinct states, not two. Collapsing the first into the second is
  // what produced a "No league yet" flash on every reload: between signing in
  // and the leagues snapshot landing there IS no league, but saying so is a
  // lie that gets corrected a moment later.
  if (!league) {
    if (!leaguesLoaded) {
      return (
        <div className="glass card">
          <div className="skeleton skeleton-title" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </div>
      );
    }
    return (
      <div className="glass card">
        <div className="empty-state">
          <div className="empty-state-icon">🏈</div>
          <div className="empty-state-title">{hasLeagues ? "Pick a league" : "No league yet"}</div>
          <div className="empty-state-sub" style={{ marginBottom: 16 }}>
            {hasLeagues
              ? "You're in more than one league — choose which one this dashboard should follow."
              : "Create one and share the code with friends, or join a league someone's already sent you a code for."}
          </div>
          <button className="btn btn-primary" onClick={() => setTab("leagues")}>Go to My Leagues</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="page-title">{league.name}</div>
      <div className="page-sub">Code <code>{league.id}</code> · {league.members.length} members</div>

      {/* ── Trial data is still counting ────────────────────────────────────
          The rehearsal scores for real, which is what makes it a real
          rehearsal — and also what makes forgetting to clear it a problem.
          This sits at the very top of the page, for everyone, until an admin
          has wiped it. Silence here would mean Week 1 starting with points
          from an August friendly still in the table. */}
      {trialPoints > 0 && (
        <div className="glass card trial-warning">
          <div className="mini-label">Preseason trial</div>
          🧪 <b>{trialPoints} point{trialPoints === 1 ? "" : "s"}</b> in the standings
          {trialPoints > 0 && " right now"} came from trial games, not the real season.
          An admin clears them in <b>Admin Panel → Preseason Trial</b> before Week 1.
        </div>
      )}

      {newResultsCount > 0 && (
        <div className="glass card" style={{ marginBottom: 18, borderLeft: "3px solid var(--accent)" }}>
          <div className="mini-label">Since your last visit</div>
          🏈 {newResultsCount} new result{newResultsCount > 1 ? "s have" : " has"} come in.
        </div>
      )}

      <SeasonCountdown
        user={user} allPredictions={allPredictions} timezone={user.timezone}
        onGoToPicks={() => setTab("predictions")}
      />

      {checklist && !checklistHidden && (
        <div className="glass card checklist">
          {/* Labelled as a to-do list, not "Getting started" — by the time
              you're on Week 2 the card is no longer about getting started,
              it's about what you still owe. The count is always ≥ 1: the
              whole card is dropped once every step is done. */}
          <div className="checklist-head">
            <span className="checklist-title">
              <span className="mini-label inline">Your to-do list</span>
              <span className="checklist-count">{checklist.filter(s => !s.done).length} left</span>
            </span>
            <button
              type="button" className="link-btn" onClick={hideChecklist}
              title="Hide for good — everything here is still reachable from the tabs above"
            >Hide</button>
          </div>
          {checklist.map(step => (
            <button
              key={step.id}
              type="button"
              className={`checklist-step ${step.done ? "done" : ""}`}
              onClick={() => setTab(step.go)}
              disabled={step.done}
            >
              <span className="checklist-tick">{step.done ? "✓" : ""}</span>
              <span className="checklist-text">
                <b>{step.label}</b>
                <span>{step.note}</span>
              </span>
              {!step.done && <span className="checklist-go">→</span>}
            </button>
          ))}
        </div>
      )}

      {/* ── Your form: two small facts, one card ───────────────────────────
          These were separate cards. Mid-season a player could be looking at
          seven stacked callouts before reaching the standings — on a phone,
          more than a screen of alerts before any actual content. Both are
          about how you're going right now, so they share a row. */}
      {/* ── This week so far ───────────────────────────────────────────────
          Only ever appears mid-week, while a bonus tier is still reachable.
          It used to share a card with the streak, but the two answer
          different questions — "what's still on the table right now" versus
          "how am I doing overall" — and one card can only carry one title. */}
      {live && (
        <div className="glass card form-card">
          <div className="mini-label">This week so far</div>
          <div className="form-strip">
            <div className={`form-item ${live.perfect ? "perfect" : ""}`}>
              <span className="form-icon">{live.tier.icon}</span>
              <span className="form-text">
                <b>{live.tier.label} still alive</b>
                <span>
                  {live.correct} from {live.played} in Week {live.week}
                  {" · "}{live.remaining} to go
                </span>
              </span>
              <span className="form-value">+{live.points}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Outstanding picks — yours and everyone else's, in ONE card ──────
          There used to be a separate "Week 5 picks 8/16" card as well as this
          one, both saying the same thing whenever you were the one behind.
          Your own progress leads; the rest is peer pressure. */}
      {pending && pending.missing.length > 0 && (() => {
        const mine = pending.missing.find(m => m.uid === user.uid);
        const others = pending.missing.filter(m => m.uid !== user.uid);
        return (
          <div className="glass card nudge-card" role="button" tabIndex={0}
            aria-label="Go to your predictions"
            onClick={() => setTab("predictions")}
            onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab("predictions"); } }}>
            <div className="nudge-head">
              <span className="mini-label inline">
                {mine ? `Your Week ${pending.week} picks` : `Week ${pending.week} picks`}
              </span>
              {pending.firstKickoffUTC && (
                <span className="nudge-clock">
                  first lock in {formatDuration(new Date(pending.firstKickoffUTC).getTime() - Date.now() - 15 * 60000)}
                </span>
              )}
            </div>

            {mine && (
              <>
                <div className="pick-progress-head">
                  <span>{mine.made === 0 ? "You haven't started" : "You're part way through"}</span>
                  <b>{mine.made} / {mine.total}</b>
                </div>
                <span className="pick-progress-bar">
                  <span className="pick-progress-fill" style={{ width: `${(mine.made / mine.total) * 100}%` }} />
                </span>
              </>
            )}

            {others.length > 0 && (
              <div className="nudge-list">
                <span className="nudge-label">{mine ? "Also waiting on" : "Waiting on"}</span>
                {others.map(m => (
                  <span key={m.uid} className="nudge-pill">
                    {m.username}<em>{m.made}/{m.total}</em>
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Where you stand: rival and streak, side by side ────────────────
          Both answer "how am I doing", one against the league and one
          against yourself, so they read as a pair. They wrap onto separate
          rows below ~620px. */}
      {(rival || streaks.current >= 3) && (
        <div className="dash-pair">
          {rival && (
            <div className="glass card rival-card" role="button" tabIndex={0} aria-label="View the league standings"
              onClick={() => setTab("leagues")}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setTab("leagues"); } }}>
              <div className="mini-label">Closest rival</div>
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

          {/* The old version said only "6 in a row" — a number with no noun,
              in a card with no title. Both are named now. The tooltip covers
              the one rule that isn't obvious: a game you skipped doesn't end
              a run, only a wrong call does. */}
          {streaks.current >= 3 && (
            <div
              className="glass card streak-card"
              title="Correct winner picks in a row, in the order the games were played. A game you didn't pick is skipped, not counted as a miss — only a wrong call ends the run."
            >
              <div className="mini-label">Winning streak</div>
              <div className="rival-body">
                <span className="streak-icon" aria-hidden="true">🔥</span>
                <div className="rival-text">
                  You've called <b>{streaks.current} winners in a row</b>.
                  <span className="streak-sub">Best run this season: {streaks.best}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <HighlightsCard league={league} user={user} allUsers={allUsers} allPredictions={allPredictions} results={results} />

      <div className="card-title">Your season so far</div>
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

      <div className="card-title">
        {upcomingWeek != null ? `Week ${upcomingWeek} — Upcoming Games` : "Playoffs — Upcoming Games"}
      </div>
      {/* "No upcoming games loaded" reads like a failure. Once the regular
          season is done it isn't one — and if the playoff matchups simply
          haven't been set yet, that's the thing worth saying. */}
      {upcoming.length === 0 && (
        <div className="glass card" style={{ color: "var(--muted)" }}>
          {upcomingWeek == null
            ? "The regular season is done. Playoff games appear here as soon as a league admin confirms who's playing."
            : "No games loaded for this week yet."}
        </div>
      )}
      {/* Own class rather than inline styles so it can carry a visible
          scrollbar — the global 5px one is nearly invisible on a dark card,
          and there was nothing to suggest the row scrolled at all. */}
      <div className="hscroll">
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
