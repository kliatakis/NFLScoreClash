import { useState } from "react";
import { REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES, SEASON } from "../data/fixtures.js";
import { TEAMS, TEAM_CODES, teamsByDivision } from "../data/teams.js";
import {
  fsSetResult, fsClearResult, fsSetSpecialResult, fsUpdateLeague, fsDeleteLeague,
  fsAdminOverrideGamePrediction, fsGetPredictions, fsGetAllUsers,
} from "../firebase.js";
import { DEFAULT_SCORING, getScoringSettings } from "../lib/scoring.js";
import { formatKickoff } from "../lib/time.js";
import TeamBadge from "./TeamBadge.jsx";

// Playoff matchups aren't entered in-app — once real seeding is known, update
// the schedule data directly (same workflow as the regular-season fixtures)
// and redeploy, rather than maintaining a separate admin-entry UI for it.
const SECTIONS = ["Results", "Overrides", "Special Picks", "Scoring Settings", "Danger Zone"];

export default function AdminPanel({ league, user, isSuperAdmin, refresh, onLeagueDeleted }) {
  const [section, setSection] = useState("Results");
  const [fetchMsg, setFetchMsg] = useState("");
  const [fetching, setFetching] = useState(false);

  const fetchLatest = async () => {
    setFetching(true); setFetchMsg("");
    try {
      const res = await fetch("/api/fetch-results?manual=true");
      const data = await res.json();
      setFetchMsg(data.success ? `✅ ${data.updated || 0} new result(s) added.` : `⚠️ ${data.error || "Something went wrong."}`);
      if (data.success) refresh();
    } catch {
      setFetchMsg("⚠️ Could not reach the results service.");
    } finally {
      setFetching(false);
      setTimeout(() => setFetchMsg(""), 5000);
    }
  };

  return (
    <div className="admin-panel">
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {SECTIONS.filter(s => s !== "Danger Zone" || isSuperAdmin).map(s => (
          <button key={s} className={`chip ${section === s ? "active" : ""}`} style={{ cursor: "pointer" }} onClick={() => setSection(s)}>{s}</button>
        ))}
      </div>

      {section === "Results" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchLatest} disabled={fetching}>
              {fetching ? "Fetching…" : "Fetch Latest Results (ESPN)"}
            </button>
            {fetchMsg && <span style={{ fontSize: 14, color: "var(--muted)" }}>{fetchMsg}</span>}
          </div>
          <ResultsEntry timezone={user.timezone} />
        </div>
      )}

      {section === "Overrides" && <OverridesEntry league={league} adminUid={user.uid} refresh={refresh} />}
      {section === "Special Picks" && <SpecialResultsEntry />}
      {section === "Scoring Settings" && <ScoringSettings league={league} refresh={refresh} />}
      {section === "Danger Zone" && isSuperAdmin && <DangerZone league={league} onLeagueDeleted={onLeagueDeleted} />}
    </div>
  );
}

function ResultsEntry({ timezone }) {
  const [week, setWeek] = useState(1);
  const [inputs, setInputs] = useState({});
  const fixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week);

  const save = async (fid) => {
    const inp = inputs[fid];
    if (!inp || inp.home === "" || inp.away === "") return;
    await fsSetResult(fid, inp.home, inp.away);
  };
  const clear = async (fid) => { await fsClearResult(fid); };

  return (
    <div>
      <select className="form-select" style={{ marginBottom: 14, maxWidth: 160 }} value={week} onChange={e => setWeek(Number(e.target.value))}>
        {Array.from({ length: SEASON.regularSeasonWeeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
      </select>
      {fixtures.length === 0 && <div style={{ color: "var(--muted)", fontSize: 14 }}>No fixtures loaded for this week yet.</div>}
      {fixtures.map(f => (
        <div key={f.id} className="standings-row" style={{ flexWrap: "wrap" }}>
          <span style={{ flexBasis: "100%", fontSize: 12.5, color: "var(--muted)" }}>{formatKickoff(f.kickoffUTC, timezone)}</span>
          <span style={{ flex: 1, fontSize: 15 }}><TeamBadge code={f.away} /> @ <TeamBadge code={f.home} /></span>
          <input className="score-input" placeholder="A" defaultValue=""
            onChange={e => setInputs(s => ({ ...s, [f.id]: { ...s[f.id], away: e.target.value } }))} />
          <span className="score-sep">–</span>
          <input className="score-input" placeholder="H" defaultValue=""
            onChange={e => setInputs(s => ({ ...s, [f.id]: { ...s[f.id], home: e.target.value } }))} />
          <button className="btn btn-primary btn-sm" onClick={() => save(f.id)}>Save</button>
          <button className="btn btn-ghost btn-sm" onClick={() => clear(f.id)}>Clear</button>
        </div>
      ))}
    </div>
  );
}

function OverridesEntry({ league, adminUid, refresh }) {
  const [targetUid, setTargetUid] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [home, setHome] = useState("");
  const [away, setAway] = useState("");
  const [users, setUsers] = useState(null);
  const [msg, setMsg] = useState("");

  if (users === null) { fsGetAllUsers().then(setUsers); return <div style={{ color: "var(--muted)" }}>Loading…</div>; }

  const save = async () => {
    if (!targetUid || !fixtureId || home === "" || away === "") return;
    await fsAdminOverrideGamePrediction(targetUid, fixtureId, home, away, adminUid);
    setMsg("Prediction overridden — the user will see a note that it was corrected.");
    refresh();
    setTimeout(() => setMsg(""), 4000);
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
        Correct a member's prediction if they made an entry error. They'll see an asterisk marking it as admin-corrected.
      </p>
      {msg && <div className="success-msg">{msg}</div>}
      <div className="form-group">
        <label className="form-label">Member</label>
        <select className="form-select" value={targetUid} onChange={e => setTargetUid(e.target.value)}>
          <option value="">Select a member…</option>
          {league.members.map(uid => <option key={uid} value={uid}>{users[uid]?.username || uid}</option>)}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Game</label>
        <select className="form-select" value={fixtureId} onChange={e => setFixtureId(e.target.value)}>
          <option value="">Select a game…</option>
          {REGULAR_SEASON_FIXTURES.map(f => <option key={f.id} value={f.id}>Wk{f.week}: {f.away} @ {f.home}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 16 }}>
        <input className="score-input" placeholder="A" value={away} onChange={e => setAway(e.target.value)} />
        <span>–</span>
        <input className="score-input" placeholder="H" value={home} onChange={e => setHome(e.target.value)} />
      </div>
      <button className="btn btn-primary" onClick={save}>Save Override</button>
    </div>
  );
}

function SpecialResultsEntry() {
  const [saved, setSaved] = useState({});
  const set = async (typeId, team) => {
    await fsSetSpecialResult(typeId, team);
    setSaved(s => ({ ...s, [typeId]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [typeId]: false })), 2000);
  };
  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>Set the actual winner once known — these score everyone's preseason picks across every league.</p>
      {SPECIAL_PICK_TYPES.map(type => {
        const options = type.kind === "division" ? teamsByDivision(type.division) : TEAM_CODES;
        return (
          <div key={type.id} className="standings-row">
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{type.label}</span>
            <select className="form-select" style={{ maxWidth: 200 }} defaultValue="" onChange={e => set(type.id, e.target.value)}>
              <option value="">Not decided yet</option>
              {options.map(code => <option key={code} value={code}>{TEAMS[code].city} {TEAMS[code].name}</option>)}
            </select>
            {saved[type.id] && <span style={{ color: "var(--green)", fontSize: 13 }}>Saved</span>}
          </div>
        );
      })}
    </div>
  );
}

function ScoringSettings({ league, refresh }) {
  const current = getScoringSettings(league);
  const [draft, setDraft] = useState({ ...current });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setError("");
    const { outcomePoints, exactPoints, divisionPoints, conferencePoints, superbowlPoints } = draft;
    if (Number(exactPoints) <= Number(outcomePoints)) return setError("Exact score points must be greater than correct-winner points.");
    if (Number(conferencePoints) <= Number(divisionPoints)) return setError("Conference champion points should be greater than division winner points.");
    if (Number(superbowlPoints) <= Number(conferencePoints)) return setError("Super Bowl points should be greater than conference champion points.");
    await fsUpdateLeague(league.id, {
      settings: {
        outcomePoints: Number(outcomePoints), exactPoints: Number(exactPoints),
        divisionPoints: Number(divisionPoints), conferencePoints: Number(conferencePoints),
        superbowlPoints: Number(superbowlPoints),
      },
    });
    setSaved(true); refresh();
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (key, label) => (
    <div className="form-group">
      <label className="form-label">{label}</label>
      <input className="form-input" type="number" value={draft[key]} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} />
    </div>
  );

  return (
    <div style={{ maxWidth: 320 }}>
      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">Scoring settings saved.</div>}
      {field("outcomePoints", "Correct Winner")}
      {field("exactPoints", "Exact Score")}
      {field("divisionPoints", "Division Winner")}
      {field("conferencePoints", "AFC/NFC Champion")}
      {field("superbowlPoints", "Super Bowl Winner")}
      <button className="btn btn-primary" onClick={save}>Save Scoring</button>
    </div>
  );
}

function DangerZone({ league, onLeagueDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const del = async () => { await fsDeleteLeague(league.id); onLeagueDeleted(); };
  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
        Deleting a league removes it for everyone. Only the super admin (league creator) can do this.
      </p>
      {!confirming ? (
        <button className="btn btn-danger" onClick={() => setConfirming(true)}>Delete League</button>
      ) : (
        <div>
          <div className="error-msg">This can't be undone. Delete "{league.name}" for all {league.members.length} members?</div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-danger" onClick={del}>Yes, Delete Permanently</button>
            <button className="btn btn-ghost" onClick={() => setConfirming(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
