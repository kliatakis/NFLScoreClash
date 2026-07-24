import { useState, useEffect } from "react";
import { REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES, SEASON, effectiveKickoffUTC, hasEstimatedKickoff } from "../data/fixtures.js";
import { TEAMS, TEAM_CODES, teamsByDivision, teamTint } from "../data/teams.js";
import { fsSubscribePredictions, fsSaveGamePrediction, fsSaveSpecialPick, fsSubscribeResults } from "../firebase.js";
import { useFixtureLock, useSeasonPicksLock, useCountdown, LOCK_MINUTES_BEFORE_KICKOFF } from "../lib/hooks.js";
import { formatKickoff, lockUrgency, formatDuration } from "../lib/time.js";
import { classifyPick } from "../lib/scoring.js";
import TeamBadge from "./TeamBadge.jsx";

// Predictions are shared across every league the user is in — this tab is
// intentionally NOT scoped to a selected league for entering picks (see
// conversation: a pick for a given game is one thing, scored differently
// only by each league's point values, not re-entered per league). The
// "reveal everyone's picks" feature below IS league-scoped though — it needs
// a specific member list, so it uses whichever league is currently selected
// (same one shown on the Dashboard) and simply doesn't render if none is.
const PREDICTIONS_TABS = [
  { key: "games", label: "Game Scores" },
  { key: "division", label: "Division" },
  { key: "conference", label: "Conference" },
  { key: "superbowl", label: "Super Bowl" },
];

// Preseason picks lock 15 minutes before the season opener — computed once
// (not per-render) since SEASON.openerKickoffUTC is a build-time constant.
const SEASON_LOCK_AT = new Date(new Date(SEASON.openerKickoffUTC).getTime() - LOCK_MINUTES_BEFORE_KICKOFF * 60000).toISOString();

export default function PredictionsTab({ user, league, allUsers, allPredictions, specialResults }) {
  const [view, setView] = useState("games"); // games | division | conference | superbowl
  const [week, setWeek] = useState(1);
  const [preds, setPreds] = useState({ picks: {}, specials: {} });
  const [results, setResults] = useState({});

  useEffect(() => {
    const u1 = fsSubscribePredictions(user.uid, setPreds);
    const u2 = fsSubscribeResults(setResults);
    return () => { u1(); u2(); };
  }, [user.uid]);

  const fixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week);

  return (
    <div>
      <div className="page-title">Predictions</div>
      <div className="page-sub">Your picks are shared across every league you're in — enter once.</div>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {PREDICTIONS_TABS.map(t => (
          <button key={t.key} className={`nav-tab ${view === t.key ? "active" : ""}`} onClick={() => setView(t.key)}>{t.label}</button>
        ))}
      </div>

      {view === "games" && (
        <div>
          <select className="form-select" style={{ marginBottom: 16, maxWidth: 160 }} value={week} onChange={e => setWeek(Number(e.target.value))}>
            {Array.from({ length: SEASON.regularSeasonWeeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
          {fixtures.length === 0 && <div className="glass card" style={{ color: "var(--muted)" }}>No games loaded for this week yet.</div>}
          {fixtures.map(f => (
            <GameRow
              key={f.id} fixture={f} pick={preds.picks?.[f.id]} result={results[f.id]} uid={user.uid} timezone={user.timezone}
              league={league} allUsers={allUsers} allPredictions={allPredictions}
            />
          ))}
        </div>
      )}

      {(view === "division" || view === "conference" || view === "superbowl") && (
        <SpecialPicks kind={view} preds={preds} uid={user.uid} league={league} allUsers={allUsers} allPredictions={allPredictions} specialResults={specialResults} />
      )}
    </div>
  );
}

function GameRow({ fixture, pick, result, uid, timezone, league, allUsers, allPredictions }) {
  // Locks against the effective kickoff, which falls back to a derived time
  // for fixtures the NFL hasn't scheduled yet (all of Week 18) — those used
  // to stay editable forever. See data/fixtures.js.
  const lock = useFixtureLock(effectiveKickoffUTC(fixture));
  const estimated = hasEstimatedKickoff(fixture);
  const [home, setHome] = useState(pick?.homeScore ?? "");
  const [away, setAway] = useState(pick?.awayScore ?? "");
  const [dirty, setDirty] = useState(false);
  useEffect(() => { setHome(pick?.homeScore ?? ""); setAway(pick?.awayScore ?? ""); setDirty(false); }, [pick?.homeScore, pick?.awayScore]);

  const save = async () => {
    if (home === "" || away === "") return;
    await fsSaveGamePrediction(uid, fixture.id, home, away);
    setDirty(false);
  };

  const locked = lock?.locked;
  const hasResult = !!result;

  // Only built once the game is final and we know which league's members to
  // reveal — nothing shown otherwise (no result yet, or no league selected).
  const revealRows = hasResult && league ? league.members.map(mUid => {
    const mPick = (allPredictions[mUid]?.picks || {})[fixture.id];
    // Same classifier the standings and highlights use, so a pick can never
    // be labelled one way here and counted another way there.
    const kind = classifyPick(mPick, result);
    if (!kind) return { uid: mUid, label: "No pick", status: "none" };
    const icon = kind === "exact" ? "🔥" : kind === "outcome" ? "✅" : "❌";
    return {
      uid: mUid,
      label: `${mPick.awayScore}–${mPick.homeScore} ${icon}`,
      status: kind === "exact" ? "exact" : kind === "outcome" ? "correct" : "wrong",
    };
  }) : null;

  const myKind = classifyPick(pick, result);

  return (
    <div
      className={`fixture-card glass team-tinted ${pick ? "predicted" : ""} ${locked ? "locked" : ""} ${myKind === "exact" ? "exact-hit" : ""}`}
      style={teamTint(fixture)}
    >
      <div className="fixture-meta">
        {formatKickoff(fixture.kickoffUTC, timezone)}
        {fixture.network ? ` · ${fixture.network}` : ""}
        {fixture.note ? ` · ${fixture.note}` : ""}
        {!hasResult && !locked && lock?.msLeft != null && (
          <span className={`lock-badge ${lockUrgency(lock.msLeft)}`} style={{ marginLeft: 8 }} title={estimated ? "Exact kickoff not announced yet — picks lock at the earliest possible slot for this week" : undefined}>
            ⏱ Locks in {estimated ? "~" : ""}{formatDuration(lock.msLeft)}
          </span>
        )}
        {myKind === "exact" && <span className="exact-hit-badge">🔥 Exact score!</span>}
      </div>
      <div className="fixture-body">
        <span className="fixture-teams">
          <span className="fixture-team-row"><TeamBadge code={fixture.away} showName /></span>
          <span className="fixture-vs">@</span>
          <span className="fixture-team-row"><TeamBadge code={fixture.home} showName /></span>
        </span>
        <span className="fixture-action">
          {hasResult ? (
            <span style={{ fontFamily: "var(--font-display)", fontSize: 18 }}>{result.awayScore}–{result.homeScore}</span>
          ) : locked ? (
            <span className="lock-badge locked">🔒 Locked</span>
          ) : (
            <>
              <input className="score-input" placeholder="A" value={away} disabled={locked} onChange={e => { setAway(e.target.value); setDirty(true); }} />
              <span style={{ color: "var(--muted)" }}>–</span>
              <input className="score-input" placeholder="H" value={home} disabled={locked} onChange={e => { setHome(e.target.value); setDirty(true); }} />
              <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={save}>Save</button>
            </>
          )}
          {pick?.overriddenBy && (
            <span className="overridden-flag" title="This prediction was corrected by a league admin">*corrected</span>
          )}
        </span>
      </div>
      {revealRows && <RevealPicks rows={revealRows} allUsers={allUsers} />}
    </div>
  );
}

// Shared by GameRow and SpecialPicks — collapsed by default so a long weekly
// slate doesn't turn into a wall of everyone's scores by default.
function RevealPicks({ rows, allUsers }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixture-reveal">
      <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>
        {open ? "Hide" : "Show"} Everyone's Picks
      </button>
      {open && (
        <div className="reveal-list">
          {rows.map(r => (
            <div key={r.uid} className="reveal-row">
              <span>{allUsers?.[r.uid]?.username || "Unknown"}</span>
              <span className={`reveal-${r.status}`}>{r.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SpecialPicks({ kind, preds, uid, league, allUsers, allPredictions, specialResults }) {
  const seasonLocked = useSeasonPicksLock();
  const countdown = useCountdown(SEASON_LOCK_AT);

  const save = async (typeId, team) => {
    await fsSaveSpecialPick(uid, typeId, team);
  };

  const typesForKind = SPECIAL_PICK_TYPES.filter(t => t.kind === kind);

  return (
    <div>
      <div className="glass card" style={{ marginBottom: 18 }}>
        {seasonLocked ? (
          <span className="lock-badge locked">🔒 Locked — the season has started</span>
        ) : countdown ? (
          <span className={`lock-badge ${lockUrgency(countdown.diff)}`}>🔓 Locks in {countdown.days}d {countdown.hours}h {countdown.mins}m</span>
        ) : null}
      </div>

      {typesForKind.map(type => {
        const options = type.kind === "division" ? teamsByDivision(type.division) : TEAM_CODES;
        const current = preds.specials?.[type.id] || "";
        const actual = specialResults?.[type.id];

        const revealRows = actual && league ? league.members.map(mUid => {
          const mPick = (allPredictions[mUid]?.specials || {})[type.id];
          if (!mPick) return { uid: mUid, label: "No pick", status: "none" };
          const isCorrect = mPick === actual;
          const team = TEAMS[mPick];
          return {
            uid: mUid,
            label: `${team ? `${team.city} ${team.name}` : mPick} ${isCorrect ? "✅" : "❌"}`,
            status: isCorrect ? "correct" : "wrong",
          };
        }) : null;

        return (
          <div key={type.id} style={{ marginBottom: 4 }}>
            <div className="standings-row">
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{type.label}</span>
              <select className="form-select" style={{ maxWidth: 220 }} disabled={seasonLocked} value={current}
                onChange={e => save(type.id, e.target.value)}>
                <option value="">Pick a team…</option>
                {options.map(code => <option key={code} value={code}>{TEAMS[code].city} {TEAMS[code].name}</option>)}
              </select>
            </div>
            {revealRows && <RevealPicks rows={revealRows} allUsers={allUsers} />}
          </div>
        );
      })}
    </div>
  );
}
