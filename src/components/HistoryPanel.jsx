import { useState, useEffect, useMemo } from "react";
import {
  fsSubscribeAuditLog, fsSubscribeResults, fsSubscribeSpecialResults,
  fsSubscribePlayoffFixtures, fsSubscribeAllPredictions,
  fsSetResult, fsClearResult, fsSetSpecialResult, fsSetPlayoffFixture,
  fsClearPlayoffFixture, fsAdminOverrideGamePrediction, fsClearGamePredictions,
  fsUpdateLeague, fsSetLeagueAdmins,
} from "../firebase.js";
import {
  AUDIT_KINDS, AUDIT_GROUPS, filterEntries, groupByDay, timeLabel,
} from "../lib/auditLog.js";
import { planUndo, undoTargetOf, NOT_UNDOABLE, hasUndoDetail } from "../lib/undo.js";
import { pickWinner } from "../lib/scoring.js";
import ConfirmDialog from "./ConfirmDialog.jsx";

// The change history — every admin action that can move a point, newest first.
//
// The list itself is read-only by construction: there is no edit and no delete
// here, and the security rules refuse both at the database, so this tab can
// only ever grow. Undo doesn't break that — it writes a NEW change that
// reverses an old one, and gets its own entry.
export default function HistoryPanel({ league, timezone, isSuperAdmin, logChange }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  // Live current state, so undo can check that what it's about to reverse is
  // still what that entry left behind. Read fresh from the same subscriptions
  // the rest of the app uses — never from the entry itself.
  const [scores, setScores] = useState({});
  const [specials, setSpecials] = useState({});
  const [matchups, setMatchups] = useState({});
  const [allPredictions, setAllPredictions] = useState({});

  const [undoing, setUndoing] = useState(null);   // { entry, plan }
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [undoError, setUndoError] = useState("");

  useEffect(() => fsSubscribeAuditLog((rows, err) => { setEntries(rows); setError(err); }), []);
  useEffect(() => fsSubscribeResults(setScores), []);
  useEffect(() => fsSubscribeSpecialResults(setSpecials), []);
  useEffect(() => fsSubscribePlayoffFixtures(setMatchups), []);
  useEffect(() => fsSubscribeAllPredictions(setAllPredictions), []);

  const visible = useMemo(
    () => filterEntries(entries || [], { leagueId: league?.id ?? null, group, search }),
    [entries, league?.id, group, search]);

  const days = useMemo(() => groupByDay(visible, timezone), [visible, timezone]);

  // Whatever this entry's target looks like RIGHT NOW.
  const currentFor = (entry) => {
    switch (undoTargetOf(entry)) {
      case "result":  return scores[entry.target] || null;
      case "special": return specials[entry.target] || null;
      case "playoff": return matchups[entry.target] || null;
      case "pick":    return pickWinner((allPredictions[entry.detail?.targetUid]?.picks || {})[entry.detail?.fixtureId]);
      case "scoring": return league?.settings || {};
      case "admins":  return league?.adminIds || [];
      default:        return null;
    }
  };

  const openUndo = (entry) => {
    setUndoError("");
    const plan = planUndo(entry, currentFor(entry), { leagueId: league?.id });
    if (!plan.ok) { setUndoError(plan.reason); return; }
    setUndoing({ entry, plan });
  };

  const applyUndo = async () => {
    if (!undoing) return;
    const { entry, plan } = undoing;
    const a = plan.action;
    setBusy(true); setUndoError("");
    try {
      // Re-planned against live data one last time. The dialog may have been
      // open for a while, and somebody else could have moved underneath it.
      const fresh = planUndo(entry, currentFor(entry), { leagueId: league?.id });
      if (!fresh.ok) { setUndoError(fresh.reason); setUndoing(null); return; }

      switch (a.type) {
        case "result.set":   await fsSetResult(a.fixtureId, a.homeScore, a.awayScore); break;
        case "result.clear": await fsClearResult(a.fixtureId); break;
        case "special.set":  await fsSetSpecialResult(a.typeId, a.team); break;
        case "playoff.set":  await fsSetPlayoffFixture(a.fixtureId, a.matchup); break;
        case "playoff.clear": await fsClearPlayoffFixture(a.fixtureId); break;
        case "pick.set":     await fsAdminOverrideGamePrediction(a.uid, a.fixtureId, a.winner, entry.actorUid); break;
        case "pick.clear":   await fsClearGamePredictions(a.uid, [a.fixtureId]); break;
        case "scoring.set":  await fsUpdateLeague(a.leagueId, { settings: a.settings }); break;
        case "admins.set": {
          const current = league?.adminIds || [];
          const next = a.makeAdmin
            ? [...current, a.targetUid]
            : current.filter(x => x !== a.targetUid);
          await fsSetLeagueAdmins(a.leagueId, next);
          break;
        }
        default: throw new Error(`Unknown undo action: ${a.type}`);
      }

      // The reversal gets its own entry, under the SAME kind so the filters
      // and colours still work. Nothing is removed from the log — the rules
      // don't allow it, and the honest record is "this happened, then it was
      // undone".
      logChange?.(entry.kind, {
        target: entry.target,
        global: !!entry.global,
        summary: `Undo · ${entry.summary}`,
        detail: { undoOf: entry.id || null, undoneAt: entry.at, action: a },
      });

      setMsg(plan.summary + " — done.");
      setUndoing(null);
      setTimeout(() => setMsg(""), 5000);
    } catch (err) {
      console.error("Undo failed", err);
      setUndoError("Couldn't apply that undo — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
        Everything an admin changed that can affect the standings — scores, season winners, playoff
        matchups, scoring values and corrected picks. Entries can't be edited or deleted, by anyone,
        from anywhere in the app.
        {isSuperAdmin && " As super admin you can undo a change, as long as nothing else has touched it since."}
      </p>

      {msg && <div className="success-msg">{msg}</div>}
      {undoError && <div className="error-msg">{undoError}</div>}

      <div className="history-filters">
        {AUDIT_GROUPS.map(g => (
          <button key={g.id} type="button" className={`chip ${group === g.id ? "active" : ""}`}
            style={{ cursor: "pointer" }} onClick={() => setGroup(g.id)}>
            {g.label}
          </button>
        ))}
      </div>
      <input
        className="form-input" style={{ marginBottom: 14 }}
        type="search" aria-label="Search the change history"
        placeholder="Search a team, a name, a week…"
        value={search} onChange={e => setSearch(e.target.value)}
      />

      {error && (
        <div className="error-msg">
          Couldn't load the history. If this is the first time you've seen it, the new security rules
          may not be published yet — see RESET.md.
        </div>
      )}

      {entries === null && !error && (
        <>
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </>
      )}

      {entries !== null && visible.length === 0 && (
        <div className="empty-state" style={{ padding: "28px 0" }}>
          <div className="empty-state-icon">📜</div>
          <div className="empty-state-title">Nothing recorded yet</div>
          <div className="empty-state-sub">
            {entries.length === 0
              ? "Changes appear here from the moment an admin edits a result, a pick or the scoring."
              : "Nothing matches that filter."}
          </div>
        </div>
      )}

      {days.map(day => (
        <div key={day.key} className="history-day">
          <div className="history-date">{day.label}</div>
          {day.entries.map(e => {
            const meta = AUDIT_KINDS[e.kind];
            const id = e.id || `${e.at}_${e.kind}`;
            const open = expanded === id;
            const isUndo = e.summary?.startsWith("Undo · ");
            // The button only appears where an undo is actually possible.
            // A disabled button on every row would be noise; the reason for
            // the ones that can never be undone is shown instead.
            const canOffer = isSuperAdmin && !isUndo && hasUndoDetail(e);
            const blocked = isSuperAdmin && !isUndo && NOT_UNDOABLE[e.kind];
            return (
              <div key={id} className={`history-row ${meta.tone}`}>
                <span className="history-icon" aria-hidden="true">{meta.icon}</span>
                <div className="history-body">
                  <div className="history-kind">
                    {meta.label}
                    {/* Results and season winners live in one shared document,
                        so a change to them lands in every league at once. Say
                        so rather than letting it look league-specific. */}
                    {e.global && <span className="chip" title="This affects every league in the app">All leagues</span>}
                    {isUndo && <span className="chip">Reversal</span>}
                  </div>
                  <div className="history-summary">{e.summary}</div>
                  <div className="history-meta">
                    {timeLabel(e.at, timezone)} · {e.actorName}
                    {e.detail && (
                      <button type="button" className="link-btn" style={{ marginLeft: 8 }}
                        onClick={() => setExpanded(open ? null : id)}>
                        {open ? "hide detail" : "detail"}
                      </button>
                    )}
                    {canOffer && (
                      <button type="button" className="link-btn undo-btn" style={{ marginLeft: 8 }}
                        onClick={() => openUndo(e)}>
                        undo
                      </button>
                    )}
                  </div>
                  {blocked && (
                    <div className="history-noundo">{NOT_UNDOABLE[e.kind]}</div>
                  )}
                  {open && (
                    <pre className="history-detail">{JSON.stringify(e.detail, null, 2)}</pre>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {entries !== null && entries.length >= 400 && (
        <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 12 }}>
          Showing the most recent 400 changes. Older ones are still stored — take a backup from the
          Backup tab to get the full record as a file.
        </p>
      )}

      {undoing && (
        <ConfirmDialog
          tone="warn"
          title="Undo this change?"
          lines={[undoing.entry.summary, `→ ${undoing.plan.summary}`]}
          note="This writes a new change that reverses the old one. Both stay in the history — nothing is erased. If anyone has touched this since, the undo will be refused rather than overwrite them."
          confirmLabel="Undo it"
          busy={busy}
          onConfirm={applyUndo}
          onCancel={() => setUndoing(null)}
        />
      )}
    </div>
  );
}
