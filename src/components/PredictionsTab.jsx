import { useState, useEffect } from "react";
import { REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES, SEASON } from "../data/fixtures.js";
import { TEAMS, TEAM_CODES, teamsByDivision } from "../data/teams.js";
import { fsSubscribePredictions, fsSaveGamePrediction, fsSaveSpecialPick, fsSubscribeResults } from "../firebase.js";
import { useFixtureLock, useSeasonPicksLock, useCountdown } from "../lib/hooks.js";
import { formatKickoff } from "../lib/time.js";
import TeamBadge from "./TeamBadge.jsx";

// Predictions are shared across every league the user is in — this tab is
// intentionally NOT scoped to a selected league (see conversation: a pick
// for a given game is one thing, scored differently only by each league's
// point values, not re-entered per league).
const PREDICTIONS_TABS = [
  { key: "games", label: "Game Scores" },
  { key: "division", label: "Division" },
  { key: "conference", label: "Conference" },
  { key: "superbowl", label: "Super Bowl" },
];

export default function PredictionsTab({ user }) {
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
            <GameRow key={f.id} fixture={f} pick={preds.picks?.[f.id]} result={results[f.id]} uid={user.uid} timezone={user.timezone} />
          ))}
        </div>
      )}

      {(view === "division" || view === "conference" || view === "superbowl") && (
        <SpecialPicks kind={view} preds={preds} uid={user.uid} />
      )}
    </div>
  );
}

function GameRow({ fixture, pick, result, uid, timezone }) {
  const lock = useFixtureLock(fixture.kickoffUTC);
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

  return (
    <div className={`fixture-card glass ${pick ? "predicted" : ""} ${locked ? "locked" : ""}`}>
      <div className="fixture-meta">
        {formatKickoff(fixture.kickoffUTC, timezone)}
        {fixture.network ? ` · ${fixture.network}` : ""}
        {fixture.note ? ` · ${fixture.note}` : ""}
      </div>
      <div className="fixture-body">
        <span className="fixture-teams">
          <span className="fixture-team-row"><TeamBadge code={fixture.away} showName /></span>
          <span className="fixture-vs">@</span>
          <span className="fixture-team-row"><TeamBadge code={fixture.home} showName /></span>
        </span>
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
      </div>
    </div>
  );
}

function SpecialPicks({ kind, preds, uid }) {
  const seasonLocked = useSeasonPicksLock();
  const countdown = useCountdown(SEASON.openerKickoffUTC);

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
          <span className="lock-badge open">🔓 Locks in {countdown.days}d {countdown.hours}h {countdown.mins}m</span>
        ) : null}
      </div>

      {typesForKind.map(type => {
        const options = type.kind === "division" ? teamsByDivision(type.division) : TEAM_CODES;
        const current = preds.specials?.[type.id] || "";
        return (
          <div key={type.id} className="standings-row">
            <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{type.label}</span>
            <select className="form-select" style={{ maxWidth: 220 }} disabled={seasonLocked} defaultValue={current}
              onChange={e => save(type.id, e.target.value)}>
              <option value="">Pick a team…</option>
              {options.map(code => <option key={code} value={code}>{TEAMS[code].city} {TEAMS[code].name}</option>)}
            </select>
          </div>
        );
      })}
    </div>
  );
}
