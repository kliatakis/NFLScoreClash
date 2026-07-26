import { useState, useEffect, useRef } from "react";
import {
  REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES, SEASON, effectiveKickoffUTC, hasEstimatedKickoff,
  PLAYOFF_FIXTURES, PLAYOFF_ROUNDS,
} from "../data/fixtures.js";
import { TEAMS, TEAM_CODES, teamsByDivision, teamTint } from "../data/teams.js";
import {
  fsSubscribePredictions, fsSaveGamePrediction, fsSaveSpecialPick, fsSubscribeResults,
  fsSubscribePlayoffFixtures, fsSaveGamePredictions, fsClearGamePredictions,
} from "../firebase.js";
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
  { key: "playoffs", label: "Playoffs" },
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
  const [predsLoaded, setPredsLoaded] = useState(false);
  const [results, setResults] = useState({});

  useEffect(() => {
    const u1 = fsSubscribePredictions(user.uid, (p) => { setPreds(p); setPredsLoaded(true); });
    const u2 = fsSubscribeResults(setResults);
    return () => { u1(); u2(); };
  }, [user.uid]);

  const fixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week);
  const madeCount = fixtures.filter(f => preds.picks?.[f.id]?.homeScore != null).length;

  // ── The week's in-progress scores live HERE, not in each row ──────────────
  // Holding them at the week level is what makes "Save all" possible, and lets
  // the whole week go to Firestore as ONE write instead of sixteen.
  const [drafts, setDrafts] = useState({});          // fixtureId -> { away, home }
  const [bulkBusy, setBulkBusy] = useState("");      // "" | "saving" | "clearing"
  const [bulkError, setBulkError] = useState("");
  const hydratedWeeks = useRef(new Set());

  // Seed a week's inputs from saved picks exactly once — after the
  // subscription has actually delivered. Re-seeding on every update would
  // wipe whatever someone was mid-way through typing in other rows.
  useEffect(() => {
    if (!predsLoaded || hydratedWeeks.current.has(week)) return;
    hydratedWeeks.current.add(week);
    setDrafts(prev => {
      const next = { ...prev };
      for (const f of fixtures) {
        const p = preds.picks?.[f.id];
        next[f.id] = { away: p?.awayScore ?? "", home: p?.homeScore ?? "" };
      }
      return next;
    });
  }, [week, predsLoaded]);

  const draftFor = (id) => drafts[id] || { away: "", home: "" };
  const setDraft = (id, patch) =>
    setDrafts(d => ({ ...d, [id]: { ...draftFor(id), ...patch } }));

  // Dirty is DERIVED by comparing against what's stored, so there's no
  // separate flag to keep in sync (and saving elsewhere can't desync it).
  const isDirty = (f) => {
    const d = drafts[f.id];
    if (!d) return false;
    const p = preds.picks?.[f.id];
    return String(d.away) !== String(p?.awayScore ?? "") || String(d.home) !== String(p?.homeScore ?? "");
  };
  const isComplete = (f) => {
    const d = draftFor(f.id);
    return d.away !== "" && d.home !== "";
  };

  const lockedIds = useRef(new Set());
  const reportLocked = (id, locked) => {
    if (locked) lockedIds.current.add(id); else lockedIds.current.delete(id);
  };

  // Only unlocked, complete, actually-changed rows get written.
  const savableFixtures = fixtures.filter(f =>
    !lockedIds.current.has(f.id) && !results[f.id] && isComplete(f) && isDirty(f));
  const clearableFixtures = fixtures.filter(f =>
    !lockedIds.current.has(f.id) && !results[f.id] && preds.picks?.[f.id]);

  const saveAll = async () => {
    if (savableFixtures.length === 0) return;
    setBulkBusy("saving"); setBulkError("");
    try {
      const payload = {};
      for (const f of savableFixtures) {
        const d = draftFor(f.id);
        payload[f.id] = { homeScore: d.home, awayScore: d.away };
      }
      await fsSaveGamePredictions(user.uid, payload);
    } catch (err) {
      console.error("Bulk save failed", err);
      setBulkError("Couldn't save the week — check your connection and try again.");
    } finally {
      setBulkBusy("");
    }
  };

  const clearAll = async () => {
    if (clearableFixtures.length === 0) return;
    setBulkBusy("clearing"); setBulkError("");
    try {
      const ids = clearableFixtures.map(f => f.id);
      await fsClearGamePredictions(user.uid, ids);
      setDrafts(d => {
        const next = { ...d };
        for (const id of ids) next[id] = { away: "", home: "" };
        return next;
      });
    } catch (err) {
      console.error("Bulk clear failed", err);
      setBulkError("Couldn't clear the week — check your connection and try again.");
    } finally {
      setBulkBusy("");
    }
  };

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
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            <select className="form-select" style={{ maxWidth: 160 }} value={week} onChange={e => setWeek(Number(e.target.value))}>
              {Array.from({ length: SEASON.regularSeasonWeeks }, (_, i) => i + 1).map(w => <option key={w} value={w}>Week {w}</option>)}
            </select>
            {fixtures.length > 0 && (
              // Previously you had to scroll the whole week and count to know
              // whether you'd finished.
              <div className="week-progress">
                <span className="week-progress-text">
                  <b>{madeCount}</b> of {fixtures.length} picked
                  {madeCount === fixtures.length && <span className="week-progress-done"> · all done ✓</span>}
                </span>
                <span className="week-progress-bar">
                  <span className={`week-progress-fill ${madeCount === fixtures.length ? "done" : ""}`}
                    style={{ width: `${(madeCount / fixtures.length) * 100}%` }} />
                </span>
              </div>
            )}
          </div>
          {fixtures.length > 0 && (
            <div className="bulk-actions">
              <button
                className="btn btn-primary btn-sm"
                disabled={savableFixtures.length === 0 || bulkBusy !== ""}
                onClick={saveAll}
                title={savableFixtures.length === 0 ? "Nothing new to save in this week" : undefined}
              >
                {bulkBusy === "saving"
                  ? "Saving…"
                  : `Save all${savableFixtures.length ? ` (${savableFixtures.length})` : ""}`}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                disabled={clearableFixtures.length === 0 || bulkBusy !== ""}
                onClick={clearAll}
                title={clearableFixtures.length === 0 ? "No saved picks to clear in this week" : undefined}
              >
                {bulkBusy === "clearing"
                  ? "Clearing…"
                  : `Clear all${clearableFixtures.length ? ` (${clearableFixtures.length})` : ""}`}
              </button>
              <span className="bulk-hint">Only unlocked games are affected.</span>
            </div>
          )}
          {bulkError && <div className="error-msg">{bulkError}</div>}
          {fixtures.length === 0 && <div className="glass card" style={{ color: "var(--muted)" }}>No games loaded for this week yet.</div>}
          {fixtures.map(f => (
            <GameRow
              key={f.id} fixture={f} pick={preds.picks?.[f.id]} result={results[f.id]} uid={user.uid} timezone={user.timezone}
              league={league} allUsers={allUsers} allPredictions={allPredictions}
              draft={draftFor(f.id)}
              onDraftChange={(patch) => setDraft(f.id, patch)}
              dirty={isDirty(f)}
              onLockChange={(locked) => reportLocked(f.id, locked)}
            />
          ))}
        </div>
      )}

      {view === "playoffs" && (
        <PlayoffPicks
          preds={preds} results={results} uid={user.uid} timezone={user.timezone}
          league={league} allUsers={allUsers} allPredictions={allPredictions}
        />
      )}

      {(view === "division" || view === "conference" || view === "superbowl") && (
        <SpecialPicks kind={view} preds={preds} uid={user.uid} league={league} allUsers={allUsers} allPredictions={allPredictions} specialResults={specialResults} />
      )}
    </div>
  );
}

function GameRow({
  fixture, pick, result, uid, timezone, league, allUsers, allPredictions,
  draft, onDraftChange, dirty, onLockChange,
}) {
  // Locks against the effective kickoff, which falls back to a derived time
  // for fixtures the NFL hasn't scheduled yet (all of Week 18) — those used
  // to stay editable forever. See data/fixtures.js.
  const lock = useFixtureLock(effectiveKickoffUTC(fixture));
  const estimated = hasEstimatedKickoff(fixture);
  // The scores themselves live in the parent (see PredictionsTab) so the whole
  // week can be saved at once; this row only owns its own busy/feedback state.
  const away = draft?.away ?? "";
  const home = draft?.home ?? "";
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [clearing, setClearing] = useState(false);

  const locked = lock?.locked;
  const hasResult = !!result;

  // Let the parent know whether this game is locked, so "Save all" can skip it.
  useEffect(() => { onLockChange?.(!!locked); }, [locked]);

  const save = async () => {
    if (home === "" || away === "") return;
    setSaving(true);
    setSaveError(false);
    try {
      await fsSaveGamePrediction(uid, fixture.id, home, away);
      // Explicit confirmation. Previously the button just went disabled,
      // which looks identical to "nothing happened" on a slow connection.
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1600);
    } catch (err) {
      // This used to be swallowed entirely: a failed save (offline, denied,
      // flaky signal) reset the button and said nothing, so you'd walk away
      // believing your pick was in and only find out after kickoff.
      console.error("Failed to save prediction", err);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    setClearing(true);
    setSaveError(false);
    try {
      await fsClearGamePredictions(uid, [fixture.id]);
      onDraftChange?.({ away: "", home: "" });
    } catch (err) {
      console.error("Failed to clear prediction", err);
      setSaveError(true);
    } finally {
      setClearing(false);
    }
  };

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
        {/* Unmistakable "this one's done" marker — the old cue was a subtle
            border tint that was easy to miss while scanning 16 cards. */}
        {pick && !hasResult && !dirty && <span className="picked-badge">✓ Picked {pick.awayScore}–{pick.homeScore}</span>}
        {dirty && <span className="unsaved-badge">● Unsaved</span>}
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
              {/* inputMode/pattern (rather than type="number") gets phones to
                  open the number pad instead of the full QWERTY keyboard —
                  this is 32 fields a week — while avoiding type="number"'s
                  spinner arrows and scroll-wheel-changes-the-value behaviour. */}
              <input className="score-input" placeholder="A" value={away} disabled={locked}
                inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                onChange={e => onDraftChange?.({ away: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
              <span style={{ color: "var(--muted)" }}>–</span>
              <input className="score-input" placeholder="H" value={home} disabled={locked}
                inputMode="numeric" pattern="[0-9]*" autoComplete="off"
                onChange={e => onDraftChange?.({ home: e.target.value.replace(/\D/g, "").slice(0, 2) })} />
              <button
                className={`btn btn-primary btn-sm ${justSaved ? "btn-saved" : ""} ${saveError ? "btn-failed" : ""}`}
                disabled={!dirty || saving || clearing}
                onClick={save}
              >
                {saving ? "Saving…" : justSaved ? "Saved ✓" : saveError ? "Retry" : "Save"}
              </button>
              {pick && (
                <button className="btn btn-ghost btn-sm" disabled={saving || clearing} onClick={clear}>
                  {clearing ? "…" : "Clear"}
                </button>
              )}
              {saveError && (
                <span className="save-error" title="Your pick was not saved">Not saved — check your connection</span>
              )}
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

// Playoff games are predictable exactly like regular-season ones — the only
// difference is that who's playing isn't known until January, so each fixture
// shows as a locked placeholder until a league admin attaches the teams.
function PlayoffPicks({ preds, results, uid, timezone, league, allUsers, allPredictions }) {
  const [matchups, setMatchups] = useState({});
  useEffect(() => fsSubscribePlayoffFixtures(setMatchups), []);

  // Own draft state — there are only 13 of these and they arrive at different
  // times, so they're hydrated per fixture as their matchups get confirmed
  // rather than in one pass like a regular-season week.
  const [drafts, setDrafts] = useState({});
  const hydrated = useRef(new Set());
  useEffect(() => {
    for (const f of PLAYOFF_FIXTURES) {
      if (hydrated.current.has(f.id)) continue;
      const p = preds.picks?.[f.id];
      if (!p) continue;
      hydrated.current.add(f.id);
      setDrafts(d => ({ ...d, [f.id]: { away: p.awayScore ?? "", home: p.homeScore ?? "" } }));
    }
  }, [preds]);

  const draftFor = (id) => drafts[id] || { away: "", home: "" };
  const isDirty = (id) => {
    const d = drafts[id];
    if (!d) return false;
    const p = preds.picks?.[id];
    return String(d.away) !== String(p?.awayScore ?? "") || String(d.home) !== String(p?.homeScore ?? "");
  };

  const readyCount = PLAYOFF_FIXTURES.filter(f => matchups[f.id]?.home && matchups[f.id]?.away).length;

  return (
    <div>
      <div className="glass card" style={{ marginBottom: 18, fontSize: 13, color: "var(--muted)" }}>
        {readyCount === 0
          ? "Playoff matchups aren't known until the regular season ends. These games are already here — they'll open for predictions as soon as a league admin sets who's playing."
          : `${readyCount} of ${PLAYOFF_FIXTURES.length} playoff games confirmed. Picks score the same way as regular-season games.`}
      </div>

      {PLAYOFF_ROUNDS.map(round => {
        const fixtures = PLAYOFF_FIXTURES.filter(f => f.round === round.id);
        if (fixtures.length === 0) return null;
        return (
          <div key={round.id} style={{ marginBottom: 20 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>{round.label}</div>
            {fixtures.map(f => {
              const m = matchups[f.id];
              const ready = !!(m?.home && m?.away);
              if (!ready) {
                return (
                  <div key={f.id} className="fixture-card glass playoff-pending">
                    <div className="fixture-meta">{f.label}</div>
                    <div className="fixture-body">
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>🔒 Teams to be confirmed</span>
                    </div>
                  </div>
                );
              }
              // Merge the admin-set teams and kickoff onto the placeholder so
              // it behaves like any other fixture from here on.
              const merged = { ...f, home: m.home, away: m.away, kickoffUTC: m.kickoffUTC || null, note: f.label };
              return (
                <GameRow
                  key={f.id} fixture={merged} pick={preds.picks?.[f.id]} result={results[f.id]}
                  uid={uid} timezone={timezone}
                  league={league} allUsers={allUsers} allPredictions={allPredictions}
                  draft={draftFor(f.id)}
                  onDraftChange={(patch) => setDrafts(d => ({ ...d, [f.id]: { ...draftFor(f.id), ...patch } }))}
                  dirty={isDirty(f.id)}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function SpecialPicks({ kind, preds, uid, league, allUsers, allPredictions, specialResults }) {
  const seasonLocked = useSeasonPicksLock();
  const countdown = useCountdown(SEASON_LOCK_AT);

  const [saveError, setSaveError] = useState("");

  const save = async (typeId, team) => {
    setSaveError("");
    try {
      await fsSaveSpecialPick(uid, typeId, team);
    } catch (err) {
      // Same problem as the game rows: silently dropping this would leave the
      // dropdown showing a pick that was never stored.
      console.error("Failed to save season pick", err);
      setSaveError("Couldn't save that pick — check your connection and try again.");
    }
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

      {saveError && <div className="error-msg">{saveError}</div>}

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
