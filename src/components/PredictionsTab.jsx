import { useState, useEffect, useRef } from "react";
import {
  REGULAR_SEASON_FIXTURES, SPECIAL_PICK_TYPES, SEASON, effectiveKickoffUTC, hasEstimatedKickoff,
  PLAYOFF_FIXTURES, PLAYOFF_ROUNDS, PRESEASON_FIXTURES, PRESEASON_WEEKS,
  preseasonFixturesForWeek, isPlayoffMatchupReady,
} from "../data/fixtures.js";
import { TEAMS, teamsForSpecialPick, teamTint, teamSideTint } from "../data/teams.js";
import {
  fsSubscribePredictions, fsSaveGamePrediction, fsSaveSpecialPick, fsSubscribeResults,
  fsSubscribePlayoffFixtures, fsSaveGamePredictions, fsClearGamePredictions,
  fsSubscribeTrialActive,
} from "../firebase.js";
import { useFixtureLock, useSeasonPicksLock, useCountdown, LOCK_MINUTES_BEFORE_KICKOFF } from "../lib/hooks.js";
import { formatKickoff, lockUrgency, formatDuration } from "../lib/time.js";
import {
  classifyPick, pickWinner, resultWinner, nextOpenWeek, weekPickState, openPickWeeks,
} from "../lib/scoring.js";
import TeamBadge from "./TeamBadge.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";

// Predictions are shared across every league the user is in — this tab is
// intentionally NOT scoped to a selected league for entering picks (see
// conversation: a pick for a given game is one thing, scored differently
// only by each league's point values, not re-entered per league). The
// "reveal everyone's picks" feature below IS league-scoped though — it needs
// a specific member list, so it uses whichever league is currently selected
// (same one shown on the Dashboard) and simply doesn't render if none is.
// "Game Scores" was a leftover from when this tab took exact scorelines —
// there are no scores here any more, only a winner, and "Regular Season" also
// pairs properly with "Playoffs". The three season picks say "Winners"
// because "Division" alone doesn't tell you what you're being asked for, and
// these are the picks people most often don't realise exist until they lock.
// The trial tab is added only while a trial is actually set up, so it
// disappears the moment it's cleared rather than sitting there all season
// as a dead tab.
const PREDICTIONS_TABS = [
  { key: "games", label: "Regular Season" },
  { key: "playoffs", label: "Playoffs" },
  { key: "division", label: "Division Winners" },
  { key: "conference", label: "Conference Winners" },
  { key: "superbowl", label: "Super Bowl Winner" },
];
const TRIAL_TAB = { key: "preseason", label: "🧪 Preseason Trial" };

// Preseason picks lock 15 minutes before the season opener — computed once
// (not per-render) since SEASON.openerKickoffUTC is a build-time constant.
const SEASON_LOCK_AT = new Date(new Date(SEASON.openerKickoffUTC).getTime() - LOCK_MINUTES_BEFORE_KICKOFF * 60000).toISOString();

export default function PredictionsTab({ user, league, allUsers, allPredictions, specialResults }) {
  const [view, setView] = useState("games"); // games | division | conference | superbowl
  const [week, setWeek] = useState(1);
  const [preds, setPreds] = useState({ picks: {}, specials: {} });
  const [predsLoaded, setPredsLoaded] = useState(false);
  const [results, setResults] = useState({});
  // Whether the week has been auto-set once. After that the person's own
  // choice wins — jumping them back to the live week while they're reading
  // Week 3 would be worse than the problem this fixes.
  const weekAutoSet = useRef(false);
  const [trialActive, setTrialActive] = useState(false);

  useEffect(() => {
    const u1 = fsSubscribePredictions(user.uid, (p) => { setPreds(p); setPredsLoaded(true); });
    const u2 = fsSubscribeResults(setResults);
    const u3 = fsSubscribeTrialActive(setTrialActive);
    return () => { u1(); u2(); u3(); };
  }, [user.uid]);

  // The trial tab only exists while a trial does. It's first because during
  // those two weeks it's the only thing anyone can actually pick.
  const trialOpen = trialActive;
  const tabs = trialOpen ? [TRIAL_TAB, ...PREDICTIONS_TABS] : PREDICTIONS_TABS;

  // A tab that vanishes underneath you (the admin just cleared the trial)
  // must not leave the page blank.
  useEffect(() => {
    if (!trialOpen && view === "preseason") setView("games");
  }, [trialOpen, view]);

  // Open on the week that's actually live, not Week 1.
  //
  // The selector was hardcoded to 1, so from Week 2 onwards every single visit
  // landed on a week that had already been played and needed changing by hand
  // — and App.jsx remounts this tab on every tab switch, so it reset each
  // time. Worse, the dashboard's "Pick Week 6 →" button led straight here and
  // still showed Week 1.
  //
  // Waits for results to arrive: on first paint `results` is {} and every week
  // looks unplayed, which would answer Week 1 and immediately be right for the
  // wrong reason.
  useEffect(() => {
    if (weekAutoSet.current || Object.keys(results).length === 0) return;
    weekAutoSet.current = true;
    const open = nextOpenWeek(results);
    // Regular season over — leave them on the last week rather than nowhere.
    setWeek(open ?? SEASON.regularSeasonWeeks);
  }, [results]);

  const fixtures = REGULAR_SEASON_FIXTURES.filter(f => f.week === week);
  // Counted via pickWinner, not a stray homeScore field — winner-only picks
  // have no scoreline, so the old check made the progress bar read 0 forever.
  const madeCount = fixtures.filter(f => pickWinner(preds.picks?.[f.id]) != null).length;

  // ── The week's in-progress picks live HERE, not in each row ───────────────
  // Holding them at the week level is what makes "Save all" possible, and lets
  // the whole week go to Firestore as ONE write instead of sixteen.
  // A draft is simply the side you've tapped: "H", "A" or "T".
  const [drafts, setDrafts] = useState({});          // fixtureId -> "H" | "A" | "T"
  const [bulkBusy, setBulkBusy] = useState("");      // "" | "saving" | "clearing"
  const [bulkError, setBulkError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const hydratedWeeks = useRef(new Set());

  // Seed a week from saved picks exactly once, after the subscription has
  // actually delivered. Re-seeding on every update would undo taps someone
  // had made but not yet saved.
  useEffect(() => {
    if (!predsLoaded || hydratedWeeks.current.has(week)) return;
    hydratedWeeks.current.add(week);
    setDrafts(prev => {
      const next = { ...prev };
      for (const f of fixtures) next[f.id] = pickWinner(preds.picks?.[f.id]);
      return next;
    });
  }, [week, predsLoaded]);

  const draftFor = (id) => drafts[id] ?? null;
  const setDraft = (id, winner) => setDrafts(d => ({ ...d, [id]: winner }));

  // Dirty is DERIVED by comparing against what's stored, so there's no
  // separate flag to keep in sync (and saving elsewhere can't desync it).
  const isDirty = (f) => draftFor(f.id) !== pickWinner(preds.picks?.[f.id]);
  const isComplete = (f) => draftFor(f.id) != null;

  // Lock state is computed HERE from the clock, not reported up by each row.
  //
  // It was originally collected from the rows into a ref, which was wrong in a
  // way that mattered: refs don't trigger a re-render, so the list of savable
  // fixtures was built during a render that happened BEFORE the rows had
  // reported anything. On first paint nothing looked locked, so "Save all"
  // would happily include games that had already kicked off — and because
  // predictions are writable, that write would have gone through.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);
  const isLocked = (f) => {
    const kickoff = effectiveKickoffUTC(f);
    if (!kickoff) return false; // unscheduled — handled per-view
    return now >= new Date(kickoff).getTime() - LOCK_MINUTES_BEFORE_KICKOFF * 60000;
  };

  // Which weeks are pickable at all — the current one plus the next two, and
  // none at all while the rehearsal is running. Decided by the calendar, not
  // by results: see openPickWeeks in lib/scoring.js for why "Week 2 opens when
  // Week 1 finishes" would let a slow admin lock the whole league out.
  //
  // Declared here, below `now`, because it reads it. (It sat above the state
  // declaration at first, which is a temporal dead zone and takes the page
  // down on load.)
  const weekState = weekPickState(week, { now, trialOpen });
  const openWeeks = openPickWeeks({ now, trialOpen });

  // Only unlocked, unplayed, complete, actually-changed rows in an OPEN week
  // get written. The week gate is repeated here rather than trusted from the
  // UI: "Save all" writes in bulk, and a stale render must not be able to
  // push a week that isn't open yet.
  const savableFixtures = !weekState.open ? [] : fixtures.filter(f =>
    !isLocked(f) && !results[f.id] && isComplete(f) && isDirty(f));
  const clearableFixtures = !weekState.open ? [] : fixtures.filter(f =>
    !isLocked(f) && !results[f.id] && preds.picks?.[f.id]);

  const saveAll = async () => {
    if (savableFixtures.length === 0) return;
    setBulkBusy("saving"); setBulkError("");
    try {
      const payload = {};
      for (const f of savableFixtures) payload[f.id] = draftFor(f.id);
      await fsSaveGamePredictions(user.uid, payload);
    } catch (err) {
      console.error("Bulk save failed", err);
      setBulkError("Couldn't save the week — check your connection and try again.");
    } finally {
      setBulkBusy("");
    }
  };

  // The one destructive action any member can take, and it was a single
  // unguarded tap: "Clear all (16)" deleted a whole week of saved picks with
  // no undo. It sits right next to "Save all", which is the button people
  // actually want. Every admin action that destroys something asks first —
  // this one has to as well.
  const clearAll = async () => {
    if (clearableFixtures.length === 0) return;
    setBulkBusy("clearing"); setBulkError("");
    try {
      const ids = clearableFixtures.map(f => f.id);
      await fsClearGamePredictions(user.uid, ids);
      setDrafts(d => {
        const next = { ...d };
        for (const id of ids) next[id] = null;
        return next;
      });
      setConfirmClear(false);
    } catch (err) {
      console.error("Bulk clear failed", err);
      setBulkError("Couldn't clear the week — check your connection and try again.");
      setConfirmClear(false);
    } finally {
      setBulkBusy("");
    }
  };

  return (
    <div>
      <div className="page-title">Predictions</div>
      <div className="page-sub">Your picks are shared across every league you're in — enter once.</div>

      <div className="subtab-row">
        {tabs.map(t => (
          <button key={t.key} className={`nav-tab ${view === t.key ? "active" : ""}`} onClick={() => setView(t.key)}>{t.label}</button>
        ))}
      </div>

      {view === "games" && (
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
            {/* Weeks outside the window stay selectable so you can LOOK at
                them — the schedule is public and hiding it helps nobody. They
                just can't be picked, and the card below says why. */}
            <select className="form-select" style={{ maxWidth: 190 }} value={week} onChange={e => setWeek(Number(e.target.value))}>
              {Array.from({ length: SEASON.regularSeasonWeeks }, (_, i) => i + 1).map(w => (
                <option key={w} value={w}>
                  Week {w}{openWeeks.includes(w) ? "" : " 🔒"}
                </option>
              ))}
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
          {!weekState.open && (
            <div className="glass card week-closed">
              <div className="mini-label">Week {week} is closed for picks</div>
              {weekState.reason === "trial"
                ? "The preseason trial is running, so the regular season is on hold. Pick the trial games in the 🧪 tab — the real thing opens once an admin clears the rehearsal."
                : weekState.reason === "past"
                  ? "This week has been played. You can look at it and see everyone's picks, but nothing can be changed."
                  : `You can pick the current week and the two after it — far enough ahead to cover a holiday, close enough that the league keeps its rhythm. Week ${week} opens nearer the time.`}
              {weekState.reason === "future" && openWeeks.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <button className="btn btn-primary btn-sm" onClick={() => setWeek(openWeeks[0])}>
                    Go to Week {openWeeks[0]}
                  </button>
                </div>
              )}
            </div>
          )}

          {fixtures.length > 0 && weekState.open && (
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
                onClick={() => setConfirmClear(true)}
                title={clearableFixtures.length === 0 ? "No saved picks to clear in this week" : undefined}
              >
                {bulkBusy === "clearing"
                  ? "Clearing…"
                  : `Clear all${clearableFixtures.length ? ` (${clearableFixtures.length})` : ""}`}
              </button>
              <span className="bulk-hint">Only unlocked games are affected.</span>
            </div>
          )}

          {confirmClear && (
            <ConfirmDialog
              tone="danger"
              title={`Clear your Week ${week} picks?`}
              lines={[
                `${clearableFixtures.length} saved pick${clearableFixtures.length === 1 ? "" : "s"} will be deleted`,
                "Locked and already-played games are left alone",
              ]}
              note="There's no undo — you'd have to pick the week again from scratch. Your picks count in every league you're in, so this clears them everywhere."
              confirmLabel={`Clear ${clearableFixtures.length} pick${clearableFixtures.length === 1 ? "" : "s"}`}
              busy={bulkBusy === "clearing"}
              onConfirm={clearAll}
              onCancel={() => setConfirmClear(false)}
            />
          )}
          {bulkError && <div className="error-msg">{bulkError}</div>}
          {fixtures.length === 0 && <div className="glass card" style={{ color: "var(--muted)" }}>No games loaded for this week yet.</div>}
          {fixtures.map(f => (
            <GameRow
              key={f.id} fixture={f} pick={preds.picks?.[f.id]} result={results[f.id]} uid={user.uid} timezone={user.timezone}
              league={league} allUsers={allUsers} allPredictions={allPredictions}
              draft={draftFor(f.id)}
              onDraftChange={(patch) => setDraft(f.id, patch)}
              // A closed week is read-only: the rows still show, with
              // everyone's picks once locked, but nothing can be tapped.
              readOnly={!weekState.open}
            />
          ))}
        </div>
      )}

      {view === "preseason" && (
        <TrialPicks
          preds={preds} predsLoaded={predsLoaded} results={results} uid={user.uid} timezone={user.timezone}
          league={league} allUsers={allUsers} allPredictions={allPredictions}
        />
      )}

      {view === "playoffs" && (
        <PlayoffPicks
          preds={preds} predsLoaded={predsLoaded} results={results} uid={user.uid} timezone={user.timezone}
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
  draft, onDraftChange, readOnly = false,
}) {
  // Locks against the effective kickoff, which falls back to a derived time
  // for fixtures the NFL hasn't scheduled yet (all of Week 18) — those used
  // to stay editable forever. See data/fixtures.js.
  const lock = useFixtureLock(effectiveKickoffUTC(fixture));
  const estimated = hasEstimatedKickoff(fixture);
  // The pick itself lives in the parent (see PredictionsTab) so the whole week
  // can be saved at once; this row only owns its own busy/feedback state.
  const selected = draft ?? null;                 // "H" | "A" | "T" | null
  const savedWinner = pickWinner(pick);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [clearing, setClearing] = useState(false);

  const locked = lock?.locked;
  const hasResult = !!result;

  // Tapping a side saves it immediately — with one tap per game there's no
  // reason to make people confirm, and it removes a whole button from a row
  // that's now meant to be a single gesture. "Save all" stays for anyone who
  // taps through a week offline and needs a retry.
  const choose = async (winner) => {
    if (locked || hasResult || readOnly) return;
    const next = winner === selected ? null : winner;   // tap again to undo
    onDraftChange?.(next);
    setSaveError(false);
    if (next === null) {
      setClearing(true);
      try { await fsClearGamePredictions(uid, [fixture.id]); }
      catch (err) { console.error("Failed to clear prediction", err); setSaveError(true); }
      finally { setClearing(false); }
      return;
    }
    setSaving(true);
    try {
      await fsSaveGamePrediction(uid, fixture.id, next);
    } catch (err) {
      // Never swallow this: a failed save that says nothing means someone
      // walks away believing their pick is in and finds out after kickoff.
      console.error("Failed to save prediction", err);
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  // "You picked the Cleveland Browns" beats a bare "✓ Picked" — with two team
  // names side by side, the chip should say which one you actually backed.
  const pickedLabel = () => {
    if (!savedWinner) return null;
    if (savedWinner === "T") return "You picked a Tie";
    const code = savedWinner === "H" ? fixture.home : fixture.away;
    const team = TEAMS[code];
    return `You picked the ${team ? `${team.city} ${team.name}` : code}`;
  };

  const optionClass = (side) => {
    const chosen = selected === side;
    const wasRight = hasResult && resultWinner(result) === side;
    return [
      "pick-option",
      chosen ? "chosen" : "",
      hasResult && chosen && wasRight ? "was-right" : "",
      hasResult && chosen && !wasRight ? "was-wrong" : "",
      hasResult && !chosen && wasRight ? "actual" : "",
    ].filter(Boolean).join(" ");
  };

  // Revealed from the moment the game LOCKS, not from the moment it's scored.
  //
  // Once picks are locked nobody can act on this, so hiding it until a result
  // lands only removed the most interesting hour of the week — "four of us
  // took the Chiefs and you didn't" is the whole point of playing in a group.
  // Before the result there are no ✅/❌ marks, just who took whom.
  const revealOpen = (locked || hasResult) && !!league;
  const sideName = (side) =>
    side === "T" ? "Tie" : (TEAMS[side === "H" ? fixture.home : fixture.away]?.abbr ?? side);

  const revealRows = revealOpen ? league.members.map(mUid => {
    const mPick = (allPredictions[mUid]?.picks || {})[fixture.id];
    const side = pickWinner(mPick);
    if (!side) return { uid: mUid, label: "No pick", status: "none", side: null };
    if (!hasResult) return { uid: mUid, label: sideName(side), status: "pending", side };
    // Same classifier the standings use, so a pick can never be labelled one
    // way here and counted another way there.
    const kind = classifyPick(mPick, result);
    // A half-entered result (one score typed, the other still blank) can't be
    // judged — showing a ❌ for it would accuse someone of a miss that hasn't
    // happened.
    if (!kind) return { uid: mUid, label: sideName(side), status: "pending", side };
    return {
      uid: mUid,
      label: `${sideName(side)} ${kind === "correct" ? "✅" : "❌"}`,
      status: kind === "correct" ? "correct" : "wrong",
      side,
    };
  }) : null;

  // "5 of 6 backed KC" — the headline that makes the list worth opening, and
  // the thing that tells you instantly whether you're with the crowd.
  const consensus = (() => {
    if (!revealRows) return null;
    const made = revealRows.filter(r => r.side);
    if (made.length === 0) return null;
    const tally = {};
    for (const r of made) tally[r.side] = (tally[r.side] || 0) + 1;
    const [topSide, count] = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
    // The stored pick, not the draft — after lock they're the same, but a
    // week you've never opened has no draft hydrated and would never be
    // flagged as contrarian.
    const mine = savedWinner;
    return {
      text: `${count} of ${made.length} backed ${sideName(topSide)}`,
      // Only interesting when you're actually against the grain.
      contrarian: mine && tally[mine] === 1 && made.length > 2,
      unanimous: count === made.length && made.length > 1,
    };
  })();

  return (
    <div
      className={`fixture-card glass team-tinted ${savedWinner ? "predicted" : ""} ${locked ? "locked" : ""}`}
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
        {hasResult && <span className="final-badge">Final {result.awayScore}–{result.homeScore}</span>}
        {savedWinner && !hasResult && !saving && !clearing && (
          <span className="picked-badge">✓ {pickedLabel()}</span>
        )}
        {/* Tied to the write actually being in flight, not to "draft differs
            from stored". Those look the same until a save fails, at which
            point the row would sit on "Saving…" forever next to an error
            telling you it hadn't saved. */}
        {(saving || clearing) && <span className="unsaved-badge">● Saving…</span>}
        {saveError && <span className="save-error">Not saved — tap again</span>}
        {pick?.overriddenBy && (
          <span className="overridden-flag" title="This prediction was corrected by a league admin">*corrected</span>
        )}
      </div>

      {/* One tap per game. Two large targets with a narrow tie strip between —
          NFL ties are around 0.5% of games, so giving "Tie" a third of the row
          would shrink the two options people actually use. */}
      {/* `has-pick` lets the CSS fade whichever side you DIDN'T choose. */}
      <div className={`pick-row ${selected ? "has-pick" : ""}`}>
        <button
          className={optionClass("A")}
          disabled={locked || hasResult || saving || clearing || readOnly}
          onClick={() => choose("A")}
          style={teamSideTint(fixture.away)}
        >
          <TeamBadge code={fixture.away} showName />
        </button>

        <button
          className={`${optionClass("T")} pick-option-tie`}
          disabled={locked || hasResult || saving || clearing || readOnly}
          onClick={() => choose("T")}
          title="Predict a tie"
        >
          TIE
        </button>

        <button
          className={optionClass("H")}
          disabled={locked || hasResult || saving || clearing || readOnly}
          onClick={() => choose("H")}
          style={teamSideTint(fixture.home)}
        >
          <TeamBadge code={fixture.home} showName />
        </button>
      </div>

      {locked && !hasResult && (
        <div className="fixture-reveal"><span className="lock-badge locked">🔒 Locked</span></div>
      )}

      {revealRows && <RevealPicks rows={revealRows} allUsers={allUsers} consensus={consensus} settled={hasResult} />}
    </div>
  );
}

// Shared by GameRow and SpecialPicks — collapsed by default so a long weekly
// slate doesn't turn into a wall of everyone's scores by default.
function RevealPicks({ rows, allUsers, consensus, settled }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="fixture-reveal">
      <div className="reveal-head">
        <button className="btn btn-ghost btn-sm" onClick={() => setOpen(o => !o)}>
          {open ? "Hide" : "Show"} Everyone's Picks
        </button>
        {consensus && (
          <span className={`consensus ${consensus.contrarian ? "contrarian" : ""} ${consensus.unanimous ? "unanimous" : ""}`}>
            {consensus.unanimous ? "Everyone agreed · " : ""}{consensus.text}
            {consensus.contrarian ? " · you're on your own 😬" : ""}
          </span>
        )}
      </div>
      {!settled && open && (
        <div className="reveal-note">Locked in — result still to come.</div>
      )}
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
function PlayoffPicks({ preds, predsLoaded, results, uid, timezone, league, allUsers, allPredictions }) {
  const [matchups, setMatchups] = useState({});
  useEffect(() => fsSubscribePlayoffFixtures(setMatchups), []);

  // Seeded ONCE, on the first delivered snapshot — same rule as a regular
  // season week.
  //
  // This used to seed each fixture lazily, the first time a saved pick showed
  // up for it. That re-ran on every snapshot, which raced with the user: tap
  // a team, tap a different one before the first write echoes back, and the
  // arriving snapshot would seed the draft with the pick you'd just replaced.
  // The row then showed the wrong team and sat on "Saving…" indefinitely.
  const [drafts, setDrafts] = useState({});
  const hydrated = useRef(false);
  useEffect(() => {
    if (!predsLoaded || hydrated.current) return;
    hydrated.current = true;
    const next = {};
    for (const f of PLAYOFF_FIXTURES) next[f.id] = pickWinner(preds.picks?.[f.id]);
    setDrafts(next);
  }, [predsLoaded]);

  const draftFor = (id) => drafts[id] ?? null;
  const isDirty = (id) => drafts[id] !== undefined && drafts[id] !== pickWinner(preds.picks?.[id]);

  const readyCount = PLAYOFF_FIXTURES.filter(f => isPlayoffMatchupReady(matchups[f.id])).length;

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
              // Requires a kickoff time too — without one the row would never
              // lock. See isPlayoffMatchupReady.
              const ready = isPlayoffMatchupReady(m);
              if (!ready) {
                return (
                  <div key={f.id} className="fixture-card glass playoff-pending">
                    <div className="fixture-meta">{f.label}</div>
                    <div className="fixture-body">
                      <span style={{ fontSize: 13, color: "var(--muted)" }}>
                        {m?.home && m?.away ? "🔒 Kickoff time not set yet" : "🔒 Teams to be confirmed"}
                      </span>
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
                  onDraftChange={(winner) => setDrafts(d => ({ ...d, [f.id]: winner }))}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// The preseason rehearsal, over the real preseason schedule.
//
// These are ordinary fixtures — constants with teams and kickoffs, like any
// regular-season game — so they lock, reveal and score down exactly the same
// paths. Grouped by preseason week because a week is what earns a bonus.
function TrialPicks({ preds, predsLoaded, results, uid, timezone, league, allUsers, allPredictions }) {
  const [drafts, setDrafts] = useState({});
  const hydrated = useRef(false);
  useEffect(() => {
    if (!predsLoaded || hydrated.current) return;
    hydrated.current = true;
    const next = {};
    for (const f of PRESEASON_FIXTURES) next[f.id] = pickWinner(preds.picks?.[f.id]);
    setDrafts(next);
  }, [predsLoaded]);

  const [week, setWeek] = useState(() => {
    // Open on the preseason week that's live, the same rule the regular
    // season uses.
    const now = Date.now();
    const live = PRESEASON_WEEKS.find(w =>
      preseasonFixturesForWeek(w).some(f => new Date(f.kickoffUTC).getTime() > now - 6 * 3600000));
    return live ?? PRESEASON_WEEKS[PRESEASON_WEEKS.length - 1];
  });

  const fixtures = preseasonFixturesForWeek(week);
  const made = fixtures.filter(f => pickWinner(preds.picks?.[f.id]) != null).length;

  return (
    <div>
      <div className="glass card" style={{ marginBottom: 18, fontSize: 13, color: "var(--muted)", lineHeight: 1.55 }}>
        <b>🧪 Preseason Trial</b> — a rehearsal on the real preseason. Everything counts exactly
        like the season: points, medals, and the week bonuses if you call a whole week. An admin
        wipes all of it before Week 1.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16, flexWrap: "wrap" }}>
        <select className="form-select" style={{ maxWidth: 220 }} value={week}
          onChange={e => setWeek(Number(e.target.value))}>
          {PRESEASON_WEEKS.map(w => <option key={w} value={w}>Preseason Week {w}</option>)}
        </select>
        <div className="week-progress">
          <span className="week-progress-text">
            <b>{made}</b> of {fixtures.length} picked
            {made === fixtures.length && <span className="week-progress-done"> · all done ✓</span>}
          </span>
          <span className="week-progress-bar">
            <span className={`week-progress-fill ${made === fixtures.length ? "done" : ""}`}
              style={{ width: `${(made / fixtures.length) * 100}%` }} />
          </span>
        </div>
      </div>

      {fixtures.map(f => (
        <GameRow
          key={f.id} fixture={f} pick={preds.picks?.[f.id]} result={results[f.id]}
          uid={uid} timezone={timezone}
          league={league} allUsers={allUsers} allPredictions={allPredictions}
          draft={drafts[f.id] ?? null}
          onDraftChange={(winner) => setDrafts(d => ({ ...d, [f.id]: winner }))}
        />
      ))}
    </div>
  );
}

function SpecialPicks({ kind, preds, uid, league, allUsers, allPredictions, specialResults }) {
  const seasonLocked = useSeasonPicksLock();
  const countdown = useCountdown(SEASON_LOCK_AT);

  const [saveError, setSaveError] = useState("");
  // Which row is mid-write, and which just landed — so a saved pick confirms
  // itself instead of the dropdown quietly changing and leaving you to guess
  // whether it stuck.
  const [savingId, setSavingId] = useState(null);
  const [justSavedId, setJustSavedId] = useState(null);

  const save = async (typeId, team) => {
    setSaveError("");
    setSavingId(typeId);
    try {
      await fsSaveSpecialPick(uid, typeId, team);
      if (team) {
        setJustSavedId(typeId);
        setTimeout(() => setJustSavedId(id => (id === typeId ? null : id)), 2200);
      }
    } catch (err) {
      // Same problem as the game rows: silently dropping this would leave the
      // dropdown showing a pick that was never stored.
      console.error("Failed to save season pick", err);
      setSaveError("Couldn't save that pick — check your connection and try again.");
    } finally {
      setSavingId(id => (id === typeId ? null : id));
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
        // Only the teams that could actually win this — an NFC team can't be
        // AFC champion, so listing all 32 was 16 wrong answers of scrolling.
        const options = teamsForSpecialPick(type);
        const current = preds.specials?.[type.id] || "";
        const actual = specialResults?.[type.id];
        const saving = savingId === type.id;
        const justSaved = justSavedId === type.id;

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
            <div className={`standings-row special-pick-row ${current ? "has-pick" : ""}`}>
              <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{type.label}</span>
              <span className="special-pick-state">
                {saving && <span className="unsaved-badge">● Saving…</span>}
                {!saving && justSaved && <span className="picked-badge saved-flash">✓ Saved</span>}
                {!saving && !justSaved && current && <span className="picked-badge">✓ Picked</span>}
              </span>
              <select className={`form-select ${current ? "has-pick" : ""}`} style={{ maxWidth: 220 }}
                disabled={seasonLocked || saving} value={current}
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
