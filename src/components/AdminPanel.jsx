import { useState, useEffect } from "react";
import { REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES, SEASON, PLAYOFF_FIXTURES, PLAYOFF_ROUNDS, isPlayoffMatchupReady } from "../data/fixtures.js";
import { TEAMS, TEAM_CODES, teamsByConference, teamsForSpecialPick } from "../data/teams.js";
import {
  fsSetResult, fsClearResult, fsSetSpecialResult, fsUpdateLeague, fsDeleteLeague,
  fsAdminOverrideGamePrediction, fsGetPredictions, fsGetAllUsers,
  fsSubscribeResults, fsSubscribeSpecialResults,
  fsSetPlayoffFixture, fsClearPlayoffFixture, fsSubscribePlayoffFixtures,
} from "../firebase.js";
import { getScoringSettings } from "../lib/scoring.js";
import { formatKickoff } from "../lib/time.js";
import TeamBadge from "./TeamBadge.jsx";
import BackupPanel from "./BackupPanel.jsx";

const SECTIONS = ["Results", "Playoffs", "Overrides", "Special Picks", "Scoring Settings", "Backup", "Danger Zone"];

export default function AdminPanel({ league, user, isSuperAdmin, onLeagueDeleted }) {
  const [section, setSection] = useState("Results");
  const [fetchMsg, setFetchMsg] = useState("");
  const [fetching, setFetching] = useState(false);

  const fetchLatest = async () => {
    setFetching(true); setFetchMsg("");
    try {
      const res = await fetch("/api/fetch-results?manual=true");
      const data = await res.json();
      setFetchMsg(data.success ? `✅ ${data.updated || 0} new result(s) added.` : `⚠️ ${data.error || "Something went wrong."}`);

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

      {section === "Playoffs" && <PlayoffEntry timezone={user.timezone} />}
      {section === "Overrides" && <OverridesEntry league={league} adminUid={user.uid} />}
      {section === "Special Picks" && <SpecialResultsEntry />}
      {section === "Scoring Settings" && <ScoringSettings league={league} />}
      {section === "Backup" && <BackupPanel user={user} isSuperAdmin={isSuperAdmin} />}
      {section === "Danger Zone" && isSuperAdmin && <DangerZone league={league} onLeagueDeleted={onLeagueDeleted} />}
    </div>
  );
}

function ResultsEntry({ timezone }) {
  // A "period" is either a regular-season week number or a playoff round id,
  // so playoff scores are entered in the same place as everything else.
  const [period, setPeriod] = useState("1");
  const [results, setResults] = useState({});
  const [matchups, setMatchups] = useState({});
  // Live, so the admin can SEE what's already entered (by hand or by the
  // auto-fetch cron) instead of typing blind into empty boxes.
  useEffect(() => fsSubscribeResults(setResults), []);
  useEffect(() => fsSubscribePlayoffFixtures(setMatchups), []);

  const isPlayoffRound = PLAYOFF_ROUNDS.some(r => r.id === period);

  // Playoff placeholders only become enterable once an admin has said who's
  // playing — there's no sensible way to record a score for an unknown game.
  const fixtures = isPlayoffRound
    ? PLAYOFF_FIXTURES
        .filter(f => f.round === period && matchups[f.id]?.home && matchups[f.id]?.away)
        .map(f => ({ ...f, ...matchups[f.id] }))
    : REGULAR_SEASON_FIXTURES.filter(f => f.week === Number(period));

  const enteredCount = fixtures.filter(f => results[f.id]).length;
  const pendingPlayoff = isPlayoffRound
    ? PLAYOFF_FIXTURES.filter(f => f.round === period).length - fixtures.length
    : 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <select className="form-select" style={{ maxWidth: 220 }} value={period} onChange={e => setPeriod(e.target.value)}>
          <optgroup label="Regular Season">
            {Array.from({ length: SEASON.regularSeasonWeeks }, (_, i) => i + 1)
              .map(w => <option key={w} value={String(w)}>Week {w}</option>)}
          </optgroup>
          <optgroup label="Playoffs">
            {PLAYOFF_ROUNDS.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
          </optgroup>
        </select>
        {fixtures.length > 0 && (
          <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
            {enteredCount} of {fixtures.length} results entered
          </span>
        )}
      </div>

      {fixtures.length === 0 && (
        <div style={{ color: "var(--muted)", fontSize: 14 }}>
          {isPlayoffRound
            ? "No matchups set for this round yet — set them in the Playoffs tab first."
            : "No fixtures loaded for this week yet."}
        </div>
      )}
      {pendingPlayoff > 0 && fixtures.length > 0 && (
        <div style={{ color: "var(--muted)", fontSize: 13, marginBottom: 10 }}>
          {pendingPlayoff} more game{pendingPlayoff === 1 ? "" : "s"} in this round still need their teams set.
        </div>
      )}

      {fixtures.map(f => (
        <ResultRow key={f.id} fixture={f} result={results[f.id]} timezone={timezone} />
      ))}
    </div>
  );
}

// One row per game, with its own local input state seeded from the stored
// result — so existing scores are visible and editable, and "Clear" only
// appears when there's actually something to clear.
function ResultRow({ fixture, result, timezone }) {
  const [away, setAway] = useState(result?.awayScore ?? "");
  const [home, setHome] = useState(result?.homeScore ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-sync whenever the stored result changes underneath us (another admin
  // saving, or the daily fetch landing while this panel is open).
  useEffect(() => {
    setAway(result?.awayScore ?? "");
    setHome(result?.homeScore ?? "");
    setDirty(false);
  }, [result?.awayScore, result?.homeScore]);

  const hasResult = !!result;

  const save = async () => {
    if (away === "" || home === "") return;
    setBusy(true);
    await fsSetResult(fixture.id, home, away);
    setBusy(false);
    setDirty(false);
  };

  const clear = async () => {
    setBusy(true);
    await fsClearResult(fixture.id);
    setBusy(false);
  };

  return (
    <div className="standings-row" style={{ flexWrap: "wrap" }}>
      <span style={{ flexBasis: "100%", fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8 }}>
        {formatKickoff(fixture.kickoffUTC, timezone)}
        {hasResult && <span className="chip active">Entered</span>}
      </span>
      <span style={{ flex: 1, fontSize: 15 }}><TeamBadge code={fixture.away} /> @ <TeamBadge code={fixture.home} /></span>
      <input className="score-input" placeholder="A" value={away}
        inputMode="numeric" pattern="[0-9]*" autoComplete="off"
        onChange={e => { setAway(e.target.value.replace(/\D/g, "").slice(0, 2)); setDirty(true); }} />
      <span className="score-sep">–</span>
      <input className="score-input" placeholder="H" value={home}
        inputMode="numeric" pattern="[0-9]*" autoComplete="off"
        onChange={e => { setHome(e.target.value.replace(/\D/g, "").slice(0, 2)); setDirty(true); }} />
      <button className="btn btn-primary btn-sm" disabled={!dirty || busy} onClick={save}>
        {hasResult ? "Update" : "Save"}
      </button>
      {hasResult && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={clear}>Clear</button>}
    </div>
  );
}

// Attaches real teams and kickoff times to the placeholder playoff fixtures.
// Everyone's picks and the scoring already key off those permanent IDs, so
// filling these in is purely a matter of saying who's playing and when.
function PlayoffEntry({ timezone }) {
  const [matchups, setMatchups] = useState({});
  const [results, setResults] = useState({});
  useEffect(() => fsSubscribePlayoffFixtures(setMatchups), []);
  useEffect(() => fsSubscribeResults(setResults), []);

  const setCount = PLAYOFF_FIXTURES.filter(f => isPlayoffMatchupReady(matchups[f.id])).length;

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
        Set who's playing once seeding is known. Until a game has both teams and a kickoff time it stays
        closed for predictions — nobody can pick a game whose teams aren't decided.
        {" "}<b>{setCount} of {PLAYOFF_FIXTURES.length}</b> set. Enter the final scores from the Results tab
        or here once played.
      </p>

      {PLAYOFF_ROUNDS.map(round => {
        const fixtures = PLAYOFF_FIXTURES.filter(f => f.round === round.id);
        if (fixtures.length === 0) return null;
        return (
          <div key={round.id} style={{ marginBottom: 18 }}>
            <div className="form-label" style={{ marginBottom: 8 }}>{round.label}</div>
            {fixtures.map(f => (
              <PlayoffRow key={f.id} fixture={f} matchup={matchups[f.id]} result={results[f.id]} timezone={timezone} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function PlayoffRow({ fixture, matchup, result, timezone }) {
  const [away, setAway] = useState(matchup?.away || "");
  const [home, setHome] = useState(matchup?.home || "");
  const [when, setWhen] = useState(toLocalInput(matchup?.kickoffUTC));
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setAway(matchup?.away || "");
    setHome(matchup?.home || "");
    setWhen(toLocalInput(matchup?.kickoffUTC));
  }, [matchup?.away, matchup?.home, matchup?.kickoffUTC]);

  // The Super Bowl is cross-conference; every other playoff game is within one.
  const options = fixture.conf ? teamsByConference(fixture.conf) : TEAM_CODES;
  const isSet = !!(matchup?.home && matchup?.away);

  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    if (!away || !home || away === home) return;
    // A kickoff time is mandatory: it's the only thing that can lock this game,
    // so saving without one would open it for picks that never close.
    if (!when) { setError("Set a kickoff time — without one this game would never lock."); return; }
    const kickoff = new Date(when);
    if (isNaN(kickoff)) { setError("That kickoff time isn't valid."); return; }
    setBusy(true);
    try {
      await fsSetPlayoffFixture(fixture.id, { away, home, kickoffUTC: kickoff.toISOString() });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      console.error("Failed to save playoff matchup", err);
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    setBusy(true);
    try { await fsClearPlayoffFixture(fixture.id); }
    catch (err) { console.error("Failed to clear playoff matchup", err); setError("Couldn't clear that matchup."); }
    finally { setBusy(false); }
  };

  return (
    <div className="standings-row" style={{ flexWrap: "wrap", gap: 8 }}>
      <span style={{ flexBasis: "100%", fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {fixture.label}
        {isSet && <span className="chip active">Set</span>}
        {result && <span className="chip">Final {result.awayScore}–{result.homeScore}</span>}
        {isSet && matchup?.kickoffUTC && <span>{formatKickoff(matchup.kickoffUTC, timezone)}</span>}
        {isSet && !matchup?.kickoffUTC && <span style={{ color: "var(--gold)" }}>No kickoff time — still closed for picks</span>}
        {error && <span style={{ color: "var(--accent2)" }}>{error}</span>}
      </span>

      <select className="form-select" style={{ maxWidth: 190 }} value={away} onChange={e => setAway(e.target.value)}>
        <option value="">Away team…</option>
        {options.map(c => <option key={c} value={c}>{TEAMS[c].city} {TEAMS[c].name}</option>)}
      </select>
      <span className="score-sep">@</span>
      <select className="form-select" style={{ maxWidth: 190 }} value={home} onChange={e => setHome(e.target.value)}>
        <option value="">Home team…</option>
        {options.map(c => <option key={c} value={c}>{TEAMS[c].city} {TEAMS[c].name}</option>)}
      </select>
      <input className="form-input" type="datetime-local" style={{ maxWidth: 210 }}
        value={when} onChange={e => setWhen(e.target.value)} />

      {/* A kickoff time is required, not optional: without one the game has
          nothing to lock against and would stay editable forever — including
          after it had been played. */}
      <button className={`btn btn-primary btn-sm ${saved ? "btn-saved" : ""}`}
        disabled={busy || !away || !home || away === home || !when}
        title={!when ? "Set a kickoff time — picks lock 15 minutes before it" : undefined}
        onClick={save}>
        {busy ? "Saving…" : saved ? "Saved ✓" : isSet ? "Update" : "Set"}
      </button>
      {isSet && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={clear}>Clear</button>}
    </div>
  );
}

// datetime-local wants "YYYY-MM-DDTHH:mm" in LOCAL time; we store UTC.
function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d)) return "";
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function OverridesEntry({ league, adminUid }) {
  const [targetUid, setTargetUid] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [winner, setWinner] = useState("");
  const [users, setUsers] = useState(null);
  const [msg, setMsg] = useState("");
  const fixture = REGULAR_SEASON_FIXTURES.find(f => f.id === fixtureId) || null;

  // Loaded in an effect, not during render — kicking off a fetch from the
  // render path re-fires on every render until it resolves and misbehaves
  // under React's double-invoked development renders.
  useEffect(() => {
    let alive = true;
    fsGetAllUsers().then(u => { if (alive) setUsers(u); });
    return () => { alive = false; };
  }, []);

  const save = async () => {
    if (!targetUid || !fixtureId || !winner) return;
    await fsAdminOverrideGamePrediction(targetUid, fixtureId, winner, adminUid);
    setMsg("Prediction overridden — the user will see a note that it was corrected.");
    setWinner("");
    setTimeout(() => setMsg(""), 4000);
  };

  if (users === null) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

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
        <select className="form-select" value={fixtureId}
          onChange={e => { setFixtureId(e.target.value); setWinner(""); }}>
          <option value="">Select a game…</option>
          {REGULAR_SEASON_FIXTURES.map(f => <option key={f.id} value={f.id}>Wk{f.week}: {f.away} @ {f.home}</option>)}
        </select>
      </div>
      {/* Named sides rather than two score boxes — the game is winner-only, so
          there is no scoreline to correct. Disabled until a game is chosen,
          because the options are that game's teams. */}
      <div className="form-group">
        <label className="form-label">Corrected pick</label>
        <select className="form-select" value={winner} disabled={!fixture}
          onChange={e => setWinner(e.target.value)}>
          <option value="">{fixture ? "Select the winner…" : "Pick a game first"}</option>
          {fixture && <option value="A">{fixture.away} (away)</option>}
          {fixture && <option value="H">{fixture.home} (home)</option>}
          {fixture && <option value="T">Tie</option>}
        </select>
      </div>
      <button className="btn btn-primary" onClick={save} disabled={!targetUid || !fixture || !winner}>
        Save Override
      </button>
    </div>
  );
}

function SpecialResultsEntry() {
  const [saved, setSaved] = useState({});
  // Live, and CONTROLLED — these dropdowns used to be uncontrolled with a
  // hardcoded empty default, so they always read "Not decided yet" even for
  // winners that had already been set. The admin had no way to see or verify
  // existing entries.
  const [specials, setSpecials] = useState({});
  useEffect(() => fsSubscribeSpecialResults(setSpecials), []);

  const set = async (typeId, team) => {
    await fsSetSpecialResult(typeId, team);
    setSaved(s => ({ ...s, [typeId]: true }));
    setTimeout(() => setSaved(s => ({ ...s, [typeId]: false })), 2000);
  };

  const decidedCount = SPECIAL_PICK_TYPES.filter(t => specials[t.id]).length;

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
        Set the actual winner once known — these score everyone's season picks across every league.
        {" "}<b>{decidedCount} of {SPECIAL_PICK_TYPES.length}</b> decided so far.
      </p>
      {SPECIAL_PICK_TYPES.map(type => {
        // Constrained per pick type — an admin could previously record an
        // NFC team as the AFC champion.
        const options = teamsForSpecialPick(type);
        return (
          <div key={type.id} className="standings-row">
            <span style={{ flex: 1, fontSize: 15, fontWeight: 600 }}>{type.label}</span>
            <select className="form-select" style={{ maxWidth: 200 }} value={specials[type.id] || ""} onChange={e => set(type.id, e.target.value)}>
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

// 1–20 rather than a free-text number box: it keeps the values sane and,
// more importantly, makes 0 unselectable. Zero-point categories used to make
// a wrong pick and a correct one indistinguishable by score alone (see
// classifyPick in lib/scoring.js, which now also defends against this
// independently).
const POINT_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

function ScoringSettings({ league }) {
  const current = getScoringSettings(league);
  const [draft, setDraft] = useState({ ...current });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setError("");
    const { correctPoints, tiePoints, sweepBonus, nearPerfectBonus, sharpBonus,
            divisionPoints, conferencePoints, superbowlPoints } = draft;
    const all = [correctPoints, tiePoints, sweepBonus, nearPerfectBonus, sharpBonus,
                 divisionPoints, conferencePoints, superbowlPoints];
    if (all.some(v => !Number.isFinite(Number(v)) || Number(v) < 1 || Number(v) > 20)) {
      return setError("Every value must be between 1 and 20 points.");
    }
    // The bonus tiers have to descend, or a worse week would pay more.
    if (Number(sweepBonus) <= Number(nearPerfectBonus)) return setError("Clean Sweep must be worth more than Near Perfect.");
    if (Number(nearPerfectBonus) <= Number(sharpBonus)) return setError("Near Perfect must be worth more than Sharp Week.");
    if (Number(conferencePoints) <= Number(divisionPoints)) return setError("Conference champion points should be greater than division winner points.");
    if (Number(superbowlPoints) <= Number(conferencePoints)) return setError("Super Bowl points should be greater than conference champion points.");
    await fsUpdateLeague(league.id, {
      settings: {
        correctPoints: Number(correctPoints),
        tiePoints: Number(tiePoints),
        sweepBonus: Number(sweepBonus),
        nearPerfectBonus: Number(nearPerfectBonus),
        sharpBonus: Number(sharpBonus),
        divisionPoints: Number(divisionPoints),
        conferencePoints: Number(conferencePoints),
        superbowlPoints: Number(superbowlPoints),
      },
    });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const field = (key, label) => {
    const current = Number(draft[key]);
    // A league configured before this was a dropdown could hold a value
    // outside 1–20 — including the 0 that used to make wrong picks count as
    // correct ones in the stats columns. Surface that value as an extra
    // option rather than rendering a blank select, so the admin can see what
    // it actually is and pick a valid replacement.
    const options = POINT_OPTIONS.includes(current) ? POINT_OPTIONS : [current, ...POINT_OPTIONS];
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <select
          className="form-select"
          value={current}
          onChange={e => setDraft(d => ({ ...d, [key]: Number(e.target.value) }))}
        >
          {options.map(n => (
            <option key={n} value={n}>{n} {n === 1 ? "point" : "points"}{POINT_OPTIONS.includes(n) ? "" : " (invalid)"}</option>
          ))}
        </select>
      </div>
    );
  };

  return (
    <div style={{ maxWidth: 320 }}>
      {error && <div className="error-msg">{error}</div>}
      {saved && <div className="success-msg">Scoring settings saved.</div>}
      {field("correctPoints", "Correct Winner")}
      {field("tiePoints", "🤝 Correctly Called a Tie")}
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginTop: -6, marginBottom: 4, lineHeight: 1.5 }}>
        NFL ties run at roughly one or two a season, so this is worth more than a normal
        pick. Only pays if the game actually ends level.
      </p>

      <div className="form-label" style={{ marginTop: 18, marginBottom: 8 }}>Week accuracy bonuses</div>
      <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 12, lineHeight: 1.5 }}>
        Counted in misses, not a fixed score — weeks run 13 to 16 games because of byes. You must
        pick the whole week to qualify. Regular season only.
      </p>
      {field("sweepBonus", "🧹 Clean Sweep — no misses")}
      {field("nearPerfectBonus", "🎯 Near Perfect — one miss")}
      {field("sharpBonus", "💎 Sharp Week — two misses")}

      <div className="form-label" style={{ marginTop: 18, marginBottom: 8 }}>Season picks</div>
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
