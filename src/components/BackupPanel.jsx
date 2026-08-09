import { useState, useRef } from "react";
import { SEASON } from "../data/fixtures.js";
import { fsReadEverything, fsApplyRestorePlan } from "../firebase.js";
import {
  buildBackup, validateBackup, planRestore, describePlan, backupFilename, RESTORABLE,
} from "../lib/backup.js";

// Admin backup + restore.
//
// Download is a pure read and carries no risk. Restore is the only screen in
// the app that can destroy a season, so it is deliberately slow: it takes its
// own safety backup first, shows exactly what it intends to write, and asks
// you to type a word before it does anything.
//
// All the decision-making is in lib/backup.js as pure functions, tested
// directly. This file is presentation plus confirmation.

const PART_LABELS = {
  results: "Results (scores, season results, playoff matchups)",
  predictions: "Everyone's picks",
  leagues: "League names and scoring settings",
};

function download(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoked on the next tick — revoking immediately can cancel the download
  // in some browsers before it has started reading the blob.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export default function BackupPanel({ user, isSuperAdmin, logChange }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  // Restore state
  const [file, setFile] = useState(null);         // { name, backup, validation }
  const [mode, setMode] = useState("merge");
  const [parts, setParts] = useState(RESTORABLE);
  const [plan, setPlan] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [report, setReport] = useState(null);
  const fileInput = useRef(null);

  const snapshot = async () => {
    // includeHistory: a backup taken before a wipe is the only copy of the
    // change history that survives it — the auditLog collection is append-only
    // in the app but a Firestore console wipe clears it like anything else.
    const all = await fsReadEverything({ includeHistory: true });
    return buildBackup({
      ...all,
      seasonYear: SEASON.year,
      takenBy: { uid: user.uid, username: user.username },
    });
  };

  const doDownload = async () => {
    setBusy("download"); setError(""); setMsg("");
    try {
      const backup = await snapshot();
      download(backup, backupFilename(backup));
      const c = backup.counts;
      setMsg(`Saved — ${c.players} player${c.players === 1 ? "" : "s"}, ${c.picks} picks, ${c.scores} results`
        + `, ${c.historyEntries} history entr${c.historyEntries === 1 ? "y" : "ies"}.`);
    } catch (err) {
      console.error("Backup failed", err);
      setError("Couldn't read the data to back up. Check your connection and try again.");
    } finally { setBusy(""); }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = "";               // so picking the same file twice re-triggers
    if (!f) return;
    setError(""); setMsg(""); setPlan(null); setReport(null); setConfirmText("");
    try {
      const text = await f.text();
      let parsed;
      try { parsed = JSON.parse(text); }
      catch { setError("That file isn't valid JSON."); setFile(null); return; }
      const validation = validateBackup(parsed, { seasonYear: SEASON.year });
      setFile({ name: f.name, backup: parsed, validation });
      if (!validation.ok) setError(validation.errors[0]);
    } catch (err) {
      console.error("Couldn't read file", err);
      setError("Couldn't read that file.");
      setFile(null);
    }
  };

  // Builds the plan against LIVE data, read fresh at this moment — not against
  // anything cached, so the preview reflects reality at the time you're asked
  // to confirm.
  const preview = async () => {
    if (!file?.validation.ok) return;
    setBusy("preview"); setError("");
    try {
      const current = await fsReadEverything();
      const leaguesById = {};
      for (const l of current.leagues) if (l?.id) leaguesById[l.id] = l;
      setPlan(planRestore(file.backup, { ...current, leagues: leaguesById }, { mode, parts }));
      setConfirmText("");
    } catch (err) {
      console.error("Preview failed", err);
      setError("Couldn't read the current data to compare against.");
    } finally { setBusy(""); }
  };

  const apply = async () => {
    if (!plan || plan.isEmpty || confirmText.trim().toUpperCase() !== "RESTORE") return;
    setBusy("restore"); setError(""); setReport(null);
    try {
      // A restore is itself undoable only if there's a copy of what it
      // replaced. This runs first, and a failure here aborts the whole thing.
      const before = await snapshot();
      download(before, `BEFORE-RESTORE-${backupFilename(before)}`);
      const result = await fsApplyRestorePlan(plan);
      // A restore is the single largest change anyone can make from inside
      // the app. It goes in the history with the file it came from, so
      // "everything looks different since Tuesday" has an answer.
      logChange?.("restore", {
        summary: `${mode === "merge" ? "Merged" : "Replaced from"} ${file?.name || "a backup file"}`
          + ` · ${result.done.length} document(s) written`
          + (result.failed.length ? `, ${result.failed.length} failed` : ""),
        detail: {
          file: file?.name || null,
          backupTakenAt: file?.backup?.takenAtISO || null,
          mode, parts,
          written: result.done, failed: result.failed,
        },
      });
      setReport(result);
      setPlan(null);
      setConfirmText("");
      setMsg(result.failed.length === 0
        ? `Restored ${result.done.length} document${result.done.length === 1 ? "" : "s"}.`
        : `Restored ${result.done.length}, but ${result.failed.length} failed — see below.`);
    } catch (err) {
      console.error("Restore aborted", err);
      setError("Couldn't take the safety backup, so nothing was restored. Try again.");
    } finally { setBusy(""); }
  };

  const togglePart = (p) => {
    setPlan(null);
    setParts(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
        Standings, badges and charts are never stored — they're recalculated from picks and
        results every time a page loads. Picks and results can't be worked out from anything
        else, so they're the only things worth copying: put those back and the rest rebuilds
        itself.
      </p>

      {msg && <div className="success-msg">{msg}</div>}
      {error && <div className="error-msg">{error}</div>}

      <div className="backup-block">
        <div className="form-label">Download a backup</div>
        <p className="backup-note">
          A JSON file you can keep anywhere. This is the copy that survives losing the
          Firebase project itself — take one before every risky change.
        </p>
        <button className="btn btn-primary btn-sm" disabled={!!busy} onClick={doDownload}>
          {busy === "download" ? "Preparing…" : "Download backup"}
        </button>
      </div>

      {!isSuperAdmin ? (
        <div className="backup-block">
          <div className="form-label">Restore</div>
          <p className="backup-note">Only the league's super admin can restore from a backup.</p>
        </div>
      ) : (
        <div className="backup-block danger">
          <div className="form-label">Restore from a file</div>
          <p className="backup-note">
            A safety backup of the current data downloads automatically before anything is
            written, so a restore you regret can itself be undone.
          </p>
          <p className="backup-note">
            <b>Picks and results restore fully.</b> Recreating a league that was <i>deleted</i>
            will be refused by the security rules — a league can only be created by its own
            super admin with themselves as the sole member. If that happens, make the league
            again with the same code, have everyone rejoin, then restore: the picks are keyed
            to people, not to the league, so they come back intact.
          </p>

          <input ref={fileInput} type="file" accept="application/json,.json"
            onChange={onFile} style={{ display: "none" }} />
          <button className="btn btn-ghost btn-sm" disabled={!!busy} onClick={() => fileInput.current?.click()}>
            Choose backup file…
          </button>

          {file && (
            <div className="backup-file">
              <div className="backup-file-name">{file.name}</div>
              {file.validation.ok ? (
                <>
                  <div className="backup-meta">
                    Taken {new Date(file.backup.takenAt).toLocaleString()}
                    {file.backup.takenBy?.username ? ` by ${file.backup.takenBy.username}` : ""}
                  </div>
                  <div className="backup-meta">
                    {file.validation.counts.players} players · {file.validation.counts.picks} picks ·
                    {" "}{file.validation.counts.scores} results ·
                    {" "}{file.validation.counts.specialResults} season results ·
                    {" "}{file.validation.counts.leagues} leagues
                  </div>
                  {file.validation.warnings.map((w, i) => (
                    <div key={i} className="backup-warn">⚠ {w}</div>
                  ))}

                  <div className="backup-opts">
                    <div className="form-label" style={{ marginTop: 12 }}>What to restore</div>
                    {RESTORABLE.map(p => (
                      <label key={p} className="backup-check">
                        <input type="checkbox" checked={parts.includes(p)} onChange={() => togglePart(p)} />
                        <span>{PART_LABELS[p]}</span>
                      </label>
                    ))}

                    <div className="form-label" style={{ marginTop: 12 }}>How</div>
                    <label className="backup-check">
                      <input type="radio" name="restore-mode" checked={mode === "merge"}
                        onChange={() => { setMode("merge"); setPlan(null); }} />
                      <span><b>Merge</b> — only fill in what's missing. Never deletes or overwrites.</span>
                    </label>
                    <label className="backup-check">
                      <input type="radio" name="restore-mode" checked={mode === "replace"}
                        onChange={() => { setMode("replace"); setPlan(null); }} />
                      <span><b>Replace</b> — restore exactly, discarding anything newer.</span>
                    </label>
                  </div>

                  <button className="btn btn-ghost btn-sm" style={{ marginTop: 12 }}
                    disabled={!!busy} onClick={preview}>
                    {busy === "preview" ? "Checking…" : "Preview changes"}
                  </button>
                </>
              ) : (
                <div className="backup-warn">This file can't be restored.</div>
              )}
            </div>
          )}

          {plan && (
            <div className={`backup-plan ${plan.mode === "replace" ? "replace" : ""}`}>
              <b>{describePlan(plan)}</b>
              {!plan.isEmpty && (
                <>
                  <p className="backup-note" style={{ marginTop: 10 }}>
                    Type <code>RESTORE</code> to confirm. A safety backup will download first.
                  </p>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <input className="form-input" style={{ maxWidth: 160 }} value={confirmText}
                      onChange={e => setConfirmText(e.target.value)} placeholder="RESTORE" />
                    <button className="btn btn-danger btn-sm" disabled={!!busy || confirmText.trim().toUpperCase() !== "RESTORE"}
                      onClick={apply}>
                      {busy === "restore" ? "Restoring…" : "Restore now"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {report && (
            <div className="backup-plan">
              <b>{report.done.length} document{report.done.length === 1 ? "" : "s"} written.</b>
              {report.failed.length > 0 && (
                <ul style={{ marginTop: 8, paddingLeft: 18 }}>
                  {report.failed.map((f, i) => (
                    <li key={i} className="backup-warn">{f.label}: {f.message}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
