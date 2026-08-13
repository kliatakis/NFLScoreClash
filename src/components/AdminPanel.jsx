import { useState, useEffect, useCallback, useMemo } from "react";
import {
  REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES, SEASON, PLAYOFF_FIXTURES, PLAYOFF_ROUNDS,
  PRESEASON_FIXTURES, PRESEASON_WEEKS, preseasonFixturesForWeek,
  isPlayoffMatchupReady, isPreseasonGameReady,
} from "../data/fixtures.js";
import { TEAMS, TEAM_CODES, teamsByConference, teamsForSpecialPick } from "../data/teams.js";
import {
  fsSetResult, fsClearResult, fsSetSpecialResult, fsUpdateLeague, fsDeleteLeague,
  fsAdminOverrideGamePrediction, fsGetPredictions, fsGetAllUsers,
  fsSubscribeResults, fsSubscribeSpecialResults, fsSubscribeAllPredictions,
  fsSetPlayoffFixture, fsClearPlayoffFixture, fsSubscribePlayoffFixtures,
  fsLogChange, fsSubscribeFetchHealth,
  fsSetPreseasonFixture, fsClearPreseasonFixture, fsSubscribePreseasonFixtures,
  fsClearPreseasonTrial, fsWipeSeasonPlay, fsReadEverything,
} from "../firebase.js";
import { buildBackup, backupFilename } from "../lib/backup.js";
import { assessFetchHealth } from "../lib/fetchHealth.js";
import { getScoringSettings, pickWinner } from "../lib/scoring.js";
import { formatKickoff } from "../lib/time.js";
import {
  makeEntry, resultKind, resultSummary, fixtureText, scoreText,
  overrideSummary, pickSideText, scoringDiff, scoringSummary,
  playoffSummary, specialSummary,
} from "../lib/auditLog.js";
import TeamBadge from "./TeamBadge.jsx";
import BackupPanel from "./BackupPanel.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import HistoryPanel from "./HistoryPanel.jsx";

const SECTIONS = ["Results", "Preseason Trial", "Playoffs", "Overrides", "Special Picks", "Scoring Settings", "History", "Backup", "Danger Zone"];

// Saves an object as a downloaded .json. Same helper as BackupPanel's; kept
// local rather than shared because it's six lines and importing a component's
// internals to reuse them is worse than repeating them.
function downloadJson(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Plain names for the history line. The on-screen labels carry emoji and
// dashes ("🧹 Clean Sweep — no misses") which read badly in a one-line summary.
const SCORING_LABELS = {
  correctPoints: "Correct Winner",
  tiePoints: "Called a Tie",
  sweepBonus: "Clean Sweep",
  nearPerfectBonus: "Near Perfect",
  sharpBonus: "Sharp Week",
  divisionPoints: "Division Winner",
  conferencePoints: "AFC/NFC Champion",
  superbowlPoints: "Super Bowl Winner",
};

export default function AdminPanel({ league, user, isSuperAdmin, onLeagueDeleted }) {
  const [section, setSection] = useState("Results");
  const [fetchMsg, setFetchMsg] = useState("");
  const [fetching, setFetching] = useState(false);

  // Every admin action funnels through here.
  //
  // `global` is the important flag. Scores, season winners and playoff
  // matchups live in ONE document shared by the whole app, so changing one
  // moves the standings in every league — those are logged as global and
  // shown in every league's history. Scoring values and membership belong to
  // this league alone.
  //
  // Never awaited by callers: see fsLogChange in firebase.js for why a
  // logging failure must not look like a save failure.
  const logChange = useCallback((kind, { summary, target, detail, global = true } = {}) => {
    try {
      fsLogChange(makeEntry({
        kind,
        actorUid: user.uid,
        actorName: user.username || user.email || "Admin",
        leagueId: league?.id || null,
        global,
        target,
        summary,
        detail,
        now: Date.now(),
      }));
    } catch (err) {
      // makeEntry throws on a programming error (unknown kind). Shouldn't
      // reach a user, and definitely shouldn't take the panel down with it.
      console.error("Couldn't build a history entry", err);
    }
  }, [user.uid, user.username, user.email, league?.id]);

  const fetchLatest = async () => {
    setFetching(true); setFetchMsg("");
    try {
      const res = await fetch("/api/fetch-results?manual=true");
      const data = await res.json();
      if (!data.success) {
        setFetchMsg(`⚠️ ${data.error || "Something went wrong."}`);
      } else {
        // Reporting only "0 added" hides the difference between "nothing has
        // been played" and "the feed changed and nothing matches any more" —
        // which is the failure that would quietly cost a season.
        const skipped = data.skipped || {};
        const notable = ["unknown_team_code", "no_matching_fixture", "wrong_season_year"]
          .filter(k => skipped[k])
          .map(k => `${skipped[k]} ${k.replace(/_/g, " ")}`);
        setFetchMsg(
          `✅ ${data.updated || 0} new result(s) from ${data.checked || 0} game(s) checked.`
          + (notable.length ? `  ⚠️ ${notable.join(", ")} — check the feed.` : "")
        );
      }

    } catch {
      setFetchMsg("⚠️ Could not reach the results service.");
    } finally {
      setFetching(false);
      setTimeout(() => setFetchMsg(""), 12000);
    }
    // No log call here — the endpoint writes its own entry server-side, which
    // is the only place that knows what actually landed.
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
          <FetchHealth />
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={fetchLatest} disabled={fetching}>
              {fetching ? "Fetching…" : "Fetch Latest Results (ESPN)"}
            </button>
            {fetchMsg && <span style={{ fontSize: 14, color: "var(--muted)" }}>{fetchMsg}</span>}
          </div>
          <ResultsEntry timezone={user.timezone} logChange={logChange} />
        </div>
      )}

      {section === "Preseason Trial" && <PreseasonTrial league={league} timezone={user.timezone} logChange={logChange} isSuperAdmin={isSuperAdmin} />}
      {section === "Playoffs" && <PlayoffEntry league={league} timezone={user.timezone} logChange={logChange} />}
      {section === "Overrides" && <OverridesEntry league={league} adminUid={user.uid} logChange={logChange} />}
      {section === "Special Picks" && <SpecialResultsEntry logChange={logChange} />}
      {section === "Scoring Settings" && <ScoringSettings league={league} logChange={logChange} />}
      {section === "History" && (
        <HistoryPanel league={league} timezone={user.timezone}
          isSuperAdmin={isSuperAdmin} logChange={logChange} />
      )}
      {section === "Backup" && <BackupPanel user={user} league={league} isSuperAdmin={isSuperAdmin} logChange={logChange} />}
      {section === "Danger Zone" && isSuperAdmin && (
        <DangerZone league={league} user={user} logChange={logChange} onLeagueDeleted={onLeagueDeleted} />
      )}
    </div>
  );
}

// Is the automatic fetcher alive?
//
// The scores come from an undocumented ESPN endpoint with no contract and no
// alerting. The realistic failure is silent: they rename a team's
// abbreviation, that team's games stop matching, and every run still reports
// "success, 0 new results" — which is also exactly what a quiet Tuesday looks
// like. This card is the difference between those two.
function FetchHealth() {
  const [record, setRecord] = useState(undefined);   // undefined = still loading
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => fsSubscribeFetchHealth(setRecord), []);
  // "3 hours ago" has to keep up without a reload.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  if (record === undefined) return <div className="skeleton skeleton-row" style={{ marginBottom: 14 }} />;

  const { level, headline, detail } = assessFetchHealth(record, now);
  const icon = { good: "✅", warn: "⚠️", bad: "🚨", unknown: "❔" }[level];

  return (
    <div className={`fetch-health ${level}`}>
      <span className="fetch-health-icon" aria-hidden="true">{icon}</span>
      <div className="fetch-health-body">
        <div className="fetch-health-head">Auto-fetch · {headline}</div>
        {detail.map((line, i) => <div key={i} className="fetch-health-line">{line}</div>)}
      </div>
    </div>
  );
}

function ResultsEntry({ timezone, logChange }) {
  // A "period" is a regular-season week number, a playoff round id, or the
  // preseason trial — every score in the app is typed in the same place.
  const [period, setPeriod] = useState("1");
  const [results, setResults] = useState({});
  const [matchups, setMatchups] = useState({});
  const [preseason, setPreseason] = useState({});
  // Live, so the admin can SEE what's already entered (by hand or by the
  // auto-fetch cron) instead of typing blind into empty boxes.
  useEffect(() => fsSubscribeResults(setResults), []);
  useEffect(() => fsSubscribePlayoffFixtures(setMatchups), []);
  useEffect(() => fsSubscribePreseasonFixtures(setPreseason), []);

  const isPlayoffRound = PLAYOFF_ROUNDS.some(r => r.id === period);
  const isPreseason = period === "preseason";

  // Placeholders only become enterable once an admin has said who's playing —
  // there's no sensible way to record a score for an unknown game.
  const fixtures = isPreseason
    ? PRESEASON_FIXTURES
        .filter(f => preseason[f.id]?.home && preseason[f.id]?.away)
        .map(f => ({ ...f, ...preseason[f.id], note: f.label }))
    : isPlayoffRound
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
          <optgroup label="Rehearsal">
            <option value="preseason">Preseason Trial</option>
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
          {isPreseason
            ? "No trial games set up yet — add them in the Preseason Trial tab first."
            : isPlayoffRound
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
        <ResultRow key={f.id} fixture={f} result={results[f.id]} timezone={timezone} logChange={logChange} />
      ))}
    </div>
  );
}

// One row per game, with its own local input state seeded from the stored
// result — so existing scores are visible and editable, and "Clear" only
// appears when there's actually something to clear.
function ResultRow({ fixture, result, timezone, logChange }) {
  const [away, setAway] = useState(result?.awayScore ?? "");
  const [home, setHome] = useState(result?.homeScore ?? "");
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // null | "update" | "clear"
  const [confirming, setConfirming] = useState(null);

  // Re-sync whenever the stored result changes underneath us (another admin
  // saving, or the daily fetch landing while this panel is open).
  useEffect(() => {
    setAway(result?.awayScore ?? "");
    setHome(result?.homeScore ?? "");
    setDirty(false);
  }, [result?.awayScore, result?.homeScore]);

  const hasResult = !!result;
  const before = hasResult ? { homeScore: result.homeScore, awayScore: result.awayScore } : null;
  const after = { homeScore: Number(home), awayScore: Number(away) };

  const doSave = async () => {
    setError("");
    setBusy(true);
    try {
      await fsSetResult(fixture.id, home, away);
      logChange(resultKind(before, after), {
        target: fixture.id,
        summary: resultSummary(fixture, before, after),
        detail: { before, after },
      });
      setDirty(false);
      setConfirming(null);
    } catch (err) {
      console.error("Couldn't save the result", err);
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  // Entering a score for the first time is the ordinary action — it happens
  // ~285 times a season and destroys nothing, so it goes straight through.
  // Overwriting one that's already there is the one that silently moves
  // everyone's points, so that stops for a nod.
  const save = () => {
    if (away === "" || home === "") return;
    if (hasResult) { setConfirming("update"); return; }
    doSave();
  };

  const doClear = async () => {
    setError("");
    setBusy(true);
    try {
      await fsClearResult(fixture.id);
      logChange("result_cleared", {
        target: fixture.id,
        summary: resultSummary(fixture, before, null),
        detail: { before },
      });
      setConfirming(null);
    } catch (err) {
      console.error("Couldn't clear the result", err);
      setError("Couldn't clear — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="standings-row" style={{ flexWrap: "wrap" }}>
      <span style={{ flexBasis: "100%", fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {formatKickoff(fixture.kickoffUTC, timezone)}
        {hasResult && <span className="chip active">Entered</span>}
        {error && <span style={{ color: "var(--accent2)" }}>{error}</span>}
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
      {hasResult && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming("clear")}>Clear</button>}

      {confirming === "update" && (
        <ConfirmDialog
          tone="warn"
          title="Change a score that's already saved?"
          lines={[fixtureText(fixture), `${scoreText(before)}  →  ${scoreText(after)}`]}
          note="Points, week bonuses and medals are recalculated from scores every time anyone opens the app, so this changes the standings for everyone immediately. It's recorded in History."
          confirmLabel="Change the score"
          busy={busy}
          onConfirm={doSave}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "clear" && (
        <ConfirmDialog
          tone="danger"
          title="Clear this result?"
          lines={[fixtureText(fixture), `${scoreText(before)}  →  no score`]}
          note="Everyone loses the points they earned from this game, and any Clean Sweep / Near Perfect / Sharp Week bonus for this week disappears until a score is entered again."
          confirmLabel="Clear the score"
          busy={busy}
          onConfirm={doClear}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

// ─── PRESEASON TRIAL ────────────────────────────────────────────────────────
//
// A dress rehearsal on real games, a fortnight before anything counts.
//
// These score FOR REAL while the trial runs — that's deliberate. A rehearsal
// on a separate scoreboard tests a copy of the machine; this tests the machine
// itself, including the ESPN fetch, the locking, the reveal at kickoff and the
// standings. "Clear the trial" then removes every trace so Week 1 starts from
// zero, and the dashboard nags everyone until it's been done.
function PreseasonTrial({ league, timezone, logChange, isSuperAdmin }) {
  const [slots, setSlots] = useState({});
  const [results, setResults] = useState({});
  const [allPredictions, setAllPredictions] = useState({});
  // null = not confirming; a number = that week; "all" = the lot
  const [confirming, setConfirming] = useState(null);
  const [week, setWeek] = useState(PRESEASON_WEEKS[PRESEASON_WEEKS.length - 1]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => fsSubscribePreseasonFixtures(setSlots), []);
  useEffect(() => fsSubscribeResults(setResults), []);
  useEffect(() => fsSubscribeAllPredictions(setAllPredictions), []);

  const picksFor = (f) => Object.values(allPredictions)
    .filter(p => (p?.picks || {})[f.id] !== undefined).length;

  // Counts per week, so each week can report and clear on its own.
  const tally = (fixtures) => ({
    set: fixtures.filter(f => isPreseasonGameReady(slots[f.id])).length,
    scored: fixtures.filter(f => results[f.id]).length,
    picks: fixtures.reduce((n, f) => n + picksFor(f), 0),
  });
  const weekFixtures = preseasonFixturesForWeek(week);
  const weekCounts = tally(weekFixtures);
  const allCounts = tally(PRESEASON_FIXTURES);
  const weekHasAnything = weekCounts.set > 0 || weekCounts.scored > 0 || weekCounts.picks > 0;
  const anyAnything = allCounts.set > 0 || allCounts.scored > 0 || allCounts.picks > 0;

  // One code path for both buttons — "clear week 2" and "clear everything"
  // differ only in which ids they're handed.
  const clearTrial = async (scope) => {
    const fixtures = scope === "all" ? PRESEASON_FIXTURES : preseasonFixturesForWeek(scope);
    const what = scope === "all" ? "the whole trial" : `Preseason Week ${scope}`;
    setBusy(true); setError("");
    try {
      const report = await fsClearPreseasonTrial(fixtures.map(f => f.id));
      logChange("result_cleared", {
        target: scope === "all" ? "preseason-trial" : `preseason-week-${scope}`,
        summary: `${what} cleared — ${report.scoresCleared} score slot(s), ${report.picksCleared} pick(s)`,
        detail: { scope, ...report },
      });
      setConfirming(null);
      setMsg(report.failed.length === 0
        ? `Cleared ${what} — ${report.picksCleared} pick${report.picksCleared === 1 ? "" : "s"} and every score in it removed.`
        : `Cleared most of it, but ${report.failed.length} document(s) failed: ${report.failed.join(", ")}. Try again.`);
      setTimeout(() => setMsg(""), 12000);
    } catch (err) {
      console.error("Couldn't clear the preseason trial", err);
      setError("Couldn't clear it — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55 }}>
        A dress rehearsal on real preseason games. Point a slot at a game, everyone picks it, the
        score arrives from ESPN or you type it in — the full machine, points and all.
        {" "}<b>These count while the trial is running</b>, which is the point. Clear it below before
        Week 1 and the table goes back to zero.
      </p>

      {msg && <div className="success-msg">{msg}</div>}
      {error && <div className="error-msg">{error}</div>}

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <select className="form-select" style={{ maxWidth: 220 }} value={week}
          onChange={e => setWeek(Number(e.target.value))}>
          {PRESEASON_WEEKS.map(w => {
            const c = tally(preseasonFixturesForWeek(w));
            return (
              <option key={w} value={w}>
                Preseason Week {w}{c.set ? ` · ${c.set} set` : ""}
              </option>
            );
          })}
        </select>
        <span style={{ fontSize: 13.5, color: "var(--muted)" }}>
          <b>{weekCounts.set} of {weekFixtures.length}</b> set · {weekCounts.scored} scored · {weekCounts.picks} pick(s)
        </span>
      </div>

      <p className="backup-note" style={{ marginBottom: 12 }}>
        Teams AND a kickoff time, or the game stays closed — without a time there's nothing to lock
        against. Enter the scores in the Results tab under “Preseason Trial”, or let the daily fetch
        find them.
      </p>

      {weekFixtures.map(f => (
        <PlayoffRow
          key={f.id} fixture={f} matchup={slots[f.id]} result={results[f.id]}
          timezone={timezone} logChange={logChange}
          pickedCount={picksFor(f)}
          onSave={(next) => fsSetPreseasonFixture(f.id, next)}
          onClear={() => fsClearPreseasonFixture(f.id)}
          anyTeam
        />
      ))}

      {/* Per week, so you can rehearse in Week 2, wipe it, and go again in
          Week 3 from a clean table — without losing the setup for a week you
          haven't run yet. */}
      <div className="backup-block danger" style={{ marginTop: 18 }}>
        <div className="form-label">Clear</div>
        <p className="backup-note">
          Deletes the trial scores, everyone's trial picks and the games themselves. Nothing else is
          touched — regular-season picks, season picks and scoring settings are left exactly as they
          are. Clear everything before the season opener.
        </p>
        {!isSuperAdmin ? (
          <p className="backup-note">Only the league's super admin can clear a trial.</p>
        ) : (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn btn-danger btn-sm" disabled={!weekHasAnything || busy}
              onClick={() => setConfirming(week)}>
              {weekHasAnything ? `Clear Preseason Week ${week}` : `Nothing in Week ${week}`}
            </button>
            <button className="btn btn-ghost btn-sm" disabled={!anyAnything || busy}
              onClick={() => setConfirming("all")}>
              Clear all three weeks
            </button>
          </div>
        )}
      </div>

      {confirming != null && (() => {
        const scope = confirming;
        const c = scope === "all" ? allCounts : tally(preseasonFixturesForWeek(scope));
        return (
          <ConfirmDialog
            tone="danger"
            title={scope === "all" ? "Clear the whole preseason trial?" : `Clear Preseason Week ${scope}?`}
            lines={[
              `${c.set} trial game${c.set === 1 ? "" : "s"}`,
              `${c.scored} score${c.scored === 1 ? "" : "s"} · ${c.picks} pick${c.picks === 1 ? "" : "s"}`,
            ]}
            note={
              (scope === "all"
                ? "Every trial week goes. "
                : `Only Week ${scope} goes — the other preseason weeks are left alone. `)
              + "Those trial points disappear from the standings. Regular-season picks, season picks and scoring settings are untouched. This can't be undone, but it's exactly what the trial is for."
            }
            confirmLabel={scope === "all" ? "Clear all three" : `Clear Week ${scope}`}
            busy={busy}
            onConfirm={() => clearTrial(scope)}
            onCancel={() => setConfirming(null)}
          />
        );
      })()}
    </div>
  );
}

// Attaches real teams and kickoff times to the placeholder playoff fixtures.
// Everyone's picks and the scoring already key off those permanent IDs, so
// filling these in is purely a matter of saying who's playing and when.
function PlayoffEntry({ league, timezone, logChange }) {
  const [matchups, setMatchups] = useState({});
  const [results, setResults] = useState({});
  const [allPredictions, setAllPredictions] = useState({});
  useEffect(() => fsSubscribePlayoffFixtures(setMatchups), []);
  useEffect(() => fsSubscribeResults(setResults), []);
  // Needed only to warn how many people have already picked a game before you
  // change who's playing in it. Picks hang off the placeholder id, so swapping
  // the teams silently reassigns everyone's pick to a different matchup.
  useEffect(() => fsSubscribeAllPredictions(setAllPredictions), []);

  const pickedCount = (fixtureId) => (league?.members || [])
    .filter(uid => pickWinner((allPredictions[uid]?.picks || {})[fixtureId]) != null).length;

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
              <PlayoffRow key={f.id} fixture={f} matchup={matchups[f.id]} result={results[f.id]}
                timezone={timezone} logChange={logChange} pickedCount={pickedCount(f.id)} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Also used, unchanged, for the preseason trial rows — the job is identical
// (attach two teams and a kickoff to a permanent empty slot), so the writes
// are injected rather than the component being copied.
function PlayoffRow({
  fixture, matchup, result, timezone, logChange, pickedCount = 0,
  onSave = null, onClear = null, anyTeam = false,
}) {
  // The Super Bowl's date and kickoff have been known since the schedule was
  // published and are already sitting in SEASON — no reason to make somebody
  // type them in from memory. Every other playoff slot genuinely isn't known
  // until the round before, so only this one prefills.
  const defaultWhen = fixture.round === "superbowl"
    ? toLocalInput(SEASON.playoffs?.superBowl?.kickoffUTC)
    : "";
  const [away, setAway] = useState(matchup?.away || "");
  const [home, setHome] = useState(matchup?.home || "");
  const [when, setWhen] = useState(toLocalInput(matchup?.kickoffUTC) || defaultWhen);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [confirming, setConfirming] = useState(null);   // null | "update" | "clear"

  useEffect(() => {
    setAway(matchup?.away || "");
    setHome(matchup?.home || "");
    setWhen(toLocalInput(matchup?.kickoffUTC) || defaultWhen);
  }, [matchup?.away, matchup?.home, matchup?.kickoffUTC, defaultWhen]);

  // The Super Bowl is cross-conference; every other playoff game is within
  // one. Preseason ignores conferences entirely — anybody can play anybody.
  const options = (!anyTeam && fixture.conf) ? teamsByConference(fixture.conf) : TEAM_CODES;
  const isSet = !!(matchup?.home && matchup?.away);

  const [error, setError] = useState("");

  const doSave = async () => {
    const kickoff = new Date(when);
    setBusy(true);
    try {
      const next = { away, home, kickoffUTC: kickoff.toISOString() };
      const previous = isSet ? { away: matchup.away, home: matchup.home, kickoffUTC: matchup.kickoffUTC } : null;
      await (onSave ? onSave(next) : fsSetPlayoffFixture(fixture.id, next));
      logChange(previous ? "playoff_changed" : "playoff_set", {
        target: fixture.id,
        summary: playoffSummary(fixture, previous, next),
        detail: { before: previous, after: next },
      });
      setSaved(true);
      setConfirming(null);
      setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      console.error("Failed to save playoff matchup", err);
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    setError("");
    if (!away || !home || away === home) return;
    // A kickoff time is mandatory: it's the only thing that can lock this game,
    // so saving without one would open it for picks that never close.
    if (!when) { setError("Set a kickoff time — without one this game would never lock."); return; }
    if (isNaN(new Date(when))) { setError("That kickoff time isn't valid."); return; }
    // Replacing a matchup that people may already have picked is the risky
    // one — their picks stay attached to the fixture id while the teams under
    // it change. Setting an empty one for the first time is harmless.
    if (isSet) { setConfirming("update"); return; }
    doSave();
  };

  const doClear = async () => {
    setBusy(true);
    try {
      await (onClear ? onClear() : fsClearPlayoffFixture(fixture.id));
      logChange("playoff_cleared", {
        target: fixture.id,
        summary: playoffSummary(fixture, { away: matchup?.away, home: matchup?.home }, null),
        detail: { before: { away: matchup?.away, home: matchup?.home, kickoffUTC: matchup?.kickoffUTC } },
      });
      setConfirming(null);
    } catch (err) {
      console.error("Failed to clear playoff matchup", err);
      setError("Couldn't clear that matchup.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="standings-row" style={{ flexWrap: "wrap", gap: 8 }}>
      <span style={{ flexBasis: "100%", fontSize: 12.5, color: "var(--muted)", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {fixture.label}
        {isSet && <span className="chip active">Set</span>}
        {result && <span className="chip">Final {result.awayScore}–{result.homeScore}</span>}
        {isSet && matchup?.kickoffUTC && <span>{formatKickoff(matchup.kickoffUTC, timezone)}</span>}
        {isSet && !matchup?.kickoffUTC && <span style={{ color: "var(--gold)" }}>No kickoff time — still closed for picks</span>}
        {pickedCount > 0 && <span className="chip">{pickedCount} picked</span>}
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
      {isSet && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setConfirming("clear")}>Clear</button>}

      {confirming === "update" && (
        <ConfirmDialog
          tone="warn"
          title="Change who's playing in this game?"
          lines={[
            fixture.label,
            `${matchup?.away || "?"} @ ${matchup?.home || "?"}  →  ${away} @ ${home}`,
          ]}
          note={
            pickedCount > 0
              ? `${pickedCount} member${pickedCount === 1 ? " has" : "s have"} already picked this game. Picks are stored against the slot, not the teams — so their pick now applies to the NEW matchup, which may not be the team they chose. Only do this if it's a correction they'd expect.`
              : "Picks are stored against the slot, not the teams. Nobody has picked this one yet, so there's nothing to disturb."
          }
          confirmLabel="Change the matchup"
          busy={busy}
          onConfirm={doSave}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === "clear" && (
        <ConfirmDialog
          tone="danger"
          title="Clear this matchup?"
          lines={[fixture.label, `${matchup?.away || "?"} @ ${matchup?.home || "?"}  →  not set`]}
          note={`The game closes for predictions again. Picks already made are kept but score nothing until teams and a kickoff time are set.${pickedCount > 0 ? ` ${pickedCount} member${pickedCount === 1 ? " has" : "s have"} picked this one.` : ""}`}
          confirmLabel="Clear the matchup"
          busy={busy}
          onConfirm={doClear}
          onCancel={() => setConfirming(null)}
        />
      )}
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

function OverridesEntry({ league, adminUid, logChange }) {
  const [targetUid, setTargetUid] = useState("");
  const [fixtureId, setFixtureId] = useState("");
  const [winner, setWinner] = useState("");
  const [users, setUsers] = useState(null);
  const [targetPicks, setTargetPicks] = useState(null);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const fixture = REGULAR_SEASON_FIXTURES.find(f => f.id === fixtureId) || null;

  // Loaded in an effect, not during render — kicking off a fetch from the
  // render path re-fires on every render until it resolves and misbehaves
  // under React's double-invoked development renders.
  useEffect(() => {
    let alive = true;
    fsGetAllUsers().then(u => { if (alive) setUsers(u); });
    return () => { alive = false; };
  }, []);

  // The member's CURRENT picks, so the confirmation can show what's actually
  // being replaced. Overwriting a pick blind — with no idea whether you're
  // fixing a typo or wiping a correct answer — is the thing to avoid here.
  useEffect(() => {
    let alive = true;
    setTargetPicks(null);
    if (!targetUid) return;
    fsGetPredictions(targetUid).then(p => { if (alive) setTargetPicks(p?.picks || {}); });
    return () => { alive = false; };
  }, [targetUid]);

  const currentSide = fixtureId && targetPicks ? (targetPicks[fixtureId]?.winner ?? null) : null;
  const username = users?.[targetUid]?.username || targetUid;

  const doSave = async () => {
    setBusy(true); setError("");
    try {
      await fsAdminOverrideGamePrediction(targetUid, fixtureId, winner, adminUid);
      logChange("pick_override", {
        target: `${targetUid}:${fixtureId}`,
        summary: overrideSummary(username, fixture, currentSide, winner),
        detail: { targetUid, username, fixtureId, before: currentSide, after: winner },
      });
      setMsg("Prediction overridden — the user will see a note that it was corrected.");
      setWinner("");
      setConfirming(false);
      // Keep the local copy honest so a second override in a row shows the
      // right "before".
      setTargetPicks(p => ({ ...(p || {}), [fixtureId]: { winner } }));
      setTimeout(() => setMsg(""), 4000);
    } catch (err) {
      console.error("Couldn't override the prediction", err);
      setError("Couldn't save that override — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  if (users === null) return <div style={{ color: "var(--muted)" }}>Loading…</div>;

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
        Correct a member's prediction if they made an entry error. They'll see an asterisk marking it as
        admin-corrected, and it's recorded in History with your name on it.
      </p>
      {msg && <div className="success-msg">{msg}</div>}
      {error && <div className="error-msg">{error}</div>}
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

      {/* Shown before you commit, not after: replacing a pick you can't see is
          how a correct answer gets overwritten by mistake. */}
      {fixture && targetUid && (
        <div className="override-current">
          {targetPicks === null
            ? "Reading their current pick…"
            : <>Currently picked: <b>{pickSideText(currentSide, fixture)}</b></>}
        </div>
      )}

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
      <button className="btn btn-primary" onClick={() => setConfirming(true)} disabled={!targetUid || !fixture || !winner || busy}>
        Save Override
      </button>

      {confirming && (
        <ConfirmDialog
          tone="danger"
          title={`Change ${username}'s pick?`}
          lines={[
            fixtureText(fixture),
            `${pickSideText(currentSide, fixture)}  →  ${pickSideText(winner, fixture)}`,
          ]}
          note="This is someone else's answer. It changes their points immediately, they'll see a *corrected mark on it, and the change is recorded in History under your name."
          confirmLabel="Change their pick"
          busy={busy}
          onConfirm={doSave}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function SpecialResultsEntry({ logChange }) {
  const [saved, setSaved] = useState({});
  // Live, and CONTROLLED — these dropdowns used to be uncontrolled with a
  // hardcoded empty default, so they always read "Not decided yet" even for
  // winners that had already been set. The admin had no way to see or verify
  // existing entries.
  const [specials, setSpecials] = useState({});
  const [confirming, setConfirming] = useState(null);  // { type, next }
  const [busy, setBusy] = useState(false);
  useEffect(() => fsSubscribeSpecialResults(setSpecials), []);

  const teamName = (code) => (code && TEAMS[code] ? `${TEAMS[code].city} ${TEAMS[code].name}` : "");

  const apply = async (type, team) => {
    const previous = specials[type.id] || "";
    setBusy(true);
    try {
      await fsSetSpecialResult(type.id, team);
      logChange(team ? (previous ? "special_changed" : "special_set") : "special_cleared", {
        target: type.id,
        summary: specialSummary(type.label, teamName(previous), teamName(team)),
        detail: { before: previous || null, after: team || null },
      });
      setSaved(s => ({ ...s, [type.id]: true }));
      setConfirming(null);
      setTimeout(() => setSaved(s => ({ ...s, [type.id]: false })), 2000);
    } catch (err) {
      console.error("Couldn't save the season result", err);
    } finally {
      setBusy(false);
    }
  };

  // Setting a winner for the first time goes straight through. Replacing one
  // that's already decided rescores everybody's season pick, so it stops.
  const change = (type, team) => {
    if (specials[type.id]) { setConfirming({ type, next: team }); return; }
    apply(type, team);
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
            <select className="form-select" style={{ maxWidth: 200 }} value={specials[type.id] || ""}
              disabled={busy}
              onChange={e => change(type, e.target.value)}>
              <option value="">Not decided yet</option>
              {options.map(code => <option key={code} value={code}>{TEAMS[code].city} {TEAMS[code].name}</option>)}
            </select>
            {saved[type.id] && <span style={{ color: "var(--green)", fontSize: 13 }}>Saved</span>}
          </div>
        );
      })}

      {confirming && (
        <ConfirmDialog
          tone={confirming.next ? "warn" : "danger"}
          title={confirming.next ? "Change a winner that's already decided?" : "Clear this winner?"}
          lines={[
            confirming.type.label,
            `${teamName(specials[confirming.type.id]) || "not set"}  →  ${teamName(confirming.next) || "not decided"}`,
          ]}
          note="Season picks are worth several times a normal game, and this applies to every league in the app — not just this one."
          confirmLabel={confirming.next ? "Change the winner" : "Clear it"}
          busy={busy}
          onConfirm={() => apply(confirming.type, confirming.next)}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  );
}

// 1–20 rather than a free-text number box: it keeps the values sane and,
// more importantly, makes 0 unselectable. Zero-point categories used to make
// a wrong pick and a correct one indistinguishable by score alone (see
// classifyPick in lib/scoring.js, which now also defends against this
// independently).
const POINT_OPTIONS = Array.from({ length: 20 }, (_, i) => i + 1);

function ScoringSettings({ league, logChange }) {
  const current = getScoringSettings(league);
  const [draft, setDraft] = useState({ ...current });
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const next = useMemo(() => ({
    correctPoints: Number(draft.correctPoints),
    tiePoints: Number(draft.tiePoints),
    sweepBonus: Number(draft.sweepBonus),
    nearPerfectBonus: Number(draft.nearPerfectBonus),
    sharpBonus: Number(draft.sharpBonus),
    divisionPoints: Number(draft.divisionPoints),
    conferencePoints: Number(draft.conferencePoints),
    superbowlPoints: Number(draft.superbowlPoints),
  }), [draft]);

  const diff = useMemo(() => scoringDiff(current, next, SCORING_LABELS), [current, next]);

  const validate = () => {
    const all = Object.values(next);
    if (all.some(v => !Number.isFinite(v) || v < 1 || v > 20)) {
      return "Every value must be between 1 and 20 points.";
    }
    // The bonus tiers have to descend, or a worse week would pay more.
    if (next.sweepBonus <= next.nearPerfectBonus) return "Clean Sweep must be worth more than Near Perfect.";
    if (next.nearPerfectBonus <= next.sharpBonus) return "Near Perfect must be worth more than Sharp Week.";
    if (next.conferencePoints <= next.divisionPoints) return "Conference champion points should be greater than division winner points.";
    if (next.superbowlPoints <= next.conferencePoints) return "Super Bowl points should be greater than conference champion points.";
    return "";
  };

  const doSave = async () => {
    setBusy(true);
    try {
      await fsUpdateLeague(league.id, { settings: next });
      logChange("scoring_changed", {
        global: false,               // scoring belongs to this league alone
        target: league.id,
        summary: scoringSummary(diff),
        detail: { before: current, after: next },
      });
      setSaved(true);
      setConfirming(false);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Couldn't save the scoring settings", err);
      setError("Couldn't save — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    const problem = validate();
    setError(problem);
    if (problem) return;
    if (diff.length === 0) { setError("Nothing has changed."); return; }
    setConfirming(true);
  };

  const field = (key, label) => {
    const value = Number(draft[key]);
    // A league configured before this was a dropdown could hold a value
    // outside 1–20 — including the 0 that used to make wrong picks count as
    // correct ones in the stats columns. Surface that value as an extra
    // option rather than rendering a blank select, so the admin can see what
    // it actually is and pick a valid replacement.
    const options = POINT_OPTIONS.includes(value) ? POINT_OPTIONS : [value, ...POINT_OPTIONS];
    return (
      <div className="form-group">
        <label className="form-label">{label}</label>
        <select
          className="form-select"
          value={value}
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
      <button className="btn btn-primary" onClick={save} disabled={busy}>Save Scoring</button>

      {confirming && (
        <ConfirmDialog
          tone="warn"
          title="Change how this league scores?"
          lines={diff.map(d => `${d.label}:  ${d.from == null ? "—" : d.from}  →  ${d.to}`)}
          note="Scoring is applied to the whole season every time the standings are drawn, so this re-scores games that have already been played — not just future ones. Positions can change straight away."
          confirmLabel="Apply new scoring"
          busy={busy}
          onConfirm={doSave}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

function DangerZone({ league, user, logChange, onLeagueDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  // ── Fresh start ──────────────────────────────────────────────────────────
  const [wipeWord, setWipeWord] = useState("");
  const [wiping, setWiping] = useState(false);
  const [wipeMsg, setWipeMsg] = useState("");
  const [wipeError, setWipeError] = useState("");

  const del = async () => {
    setBusy(true);
    try {
      await fsDeleteLeague(league.id);
      onLeagueDeleted();
    } finally {
      setBusy(false);
    }
  };

  const freshStart = async () => {
    if (wipeWord.trim().toUpperCase() !== "WIPE") return;
    setWiping(true); setWipeError(""); setWipeMsg("");
    try {
      // A safety copy downloads FIRST, and a failure here aborts the whole
      // thing. Exactly the rule the restore follows: an irreversible action
      // that can't produce its own undo doesn't run.
      const all = await fsReadEverything({ includeHistory: true });
      const backup = buildBackup({
        ...all, seasonYear: SEASON.year,
        takenBy: { uid: user.uid, username: user.username },
      });
      downloadJson(backup, `BEFORE-WIPE-${backupFilename(backup)}`);

      const report = await fsWipeSeasonPlay({ leagueIds: [league.id] });
      logChange("restore", {
        global: true,
        target: "fresh-start",
        summary: `Fresh start — ${report.predictionsDeleted} prediction doc(s) and every result deleted`,
        detail: report,
      });
      setWipeWord("");
      setWipeMsg(report.failed.length === 0
        ? `Done. ${report.predictionsDeleted} player${report.predictionsDeleted === 1 ? "" : "s"}' picks and every result removed. Accounts and the league are untouched — everyone is on zero.`
        : `Mostly done, but these failed: ${report.failed.join(", ")}. Run it again.`);
    } catch (err) {
      console.error("Fresh start failed", err);
      setWipeError("Couldn't take the safety backup, so nothing was deleted. Try again.");
    } finally {
      setWiping(false);
    }
  };

  return (
    <div>
      {/* Deliberately ABOVE Delete League: it's the thing people actually
          want when they think they want to delete everything, and it costs
          nobody their account. */}
      <div className="backup-block danger" style={{ marginBottom: 18 }}>
        <div className="form-label">Fresh start — clear the season, keep everyone</div>
        <p className="backup-note">
          Deletes <b>every pick and every result</b> — game picks, season picks, scores, playoff
          matchups and any preseason trial. Everyone goes back to zero.
        </p>
        <p className="backup-note">
          <b>Kept:</b> all accounts, usernames, avatars and timezones, plus this league, its code
          <code> {league.id}</code>, its members, its admins and its scoring settings. Nobody has to
          re-register or rejoin.
        </p>
        <p className="backup-note">
          Picks and results are shared across the whole app, so this clears them for
          <b> every league</b>, not just this one. A safety backup downloads automatically first.
        </p>

        {wipeMsg && <div className="success-msg">{wipeMsg}</div>}
        {wipeError && <div className="error-msg">{wipeError}</div>}

        <div className="backup-plan" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            className="form-input" style={{ maxWidth: 160 }}
            aria-label="Type WIPE to confirm"
            placeholder="Type WIPE"
            value={wipeWord}
            onChange={e => setWipeWord(e.target.value)}
          />
          <button
            className="btn btn-danger btn-sm"
            disabled={wiping || wipeWord.trim().toUpperCase() !== "WIPE"}
            onClick={freshStart}
          >
            {wiping ? "Clearing…" : "Clear the season"}
          </button>
        </div>
      </div>

      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14 }}>
        Deleting a league removes it for everyone. Only the super admin (league creator) can do this.
      </p>
      <button className="btn btn-danger" onClick={() => setConfirming(true)}>Delete League</button>

      {confirming && (
        <ConfirmDialog
          tone="danger"
          title="Delete this league permanently?"
          lines={[`"${league.name}"  ·  code ${league.id}`, `${league.members.length} member${league.members.length === 1 ? "" : "s"}`]}
          note="This can't be undone from inside the app. Everyone's picks survive (they're stored per person, not per league) but the league, its scoring settings and its history are gone. Take a backup first if you're not certain."
          confirmLabel="Delete permanently"
          busy={busy}
          onConfirm={del}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}
