import { useEffect, useRef, useState } from "react";
import { useEscapeKey, useFocusTrap } from "../lib/hooks.js";

// A confirmation step for admin actions that move points.
//
// Two rules make the difference between a safety net and a speed bump people
// learn to click through:
//
// 1. It states the SPECIFIC change — "SEA @ NE · 21–17 → 24–17", not "Are you
//    sure?". A generic prompt trains you to hit the same button every time,
//    which is exactly the reflex that causes the mistake it's meant to stop.
// 2. Cancel takes focus, not Confirm. A stray Enter or double-tap lands on the
//    harmless option.
//
// Deliberately NOT used for entering a score for the first time. That happens
// a few hundred times a season and destroys nothing; confirming it would make
// every other confirmation feel like noise.
export default function ConfirmDialog({
  title,
  lines = [],
  note = "",
  confirmLabel = "Confirm",
  tone = "danger",          // danger = destroys or moves points, warn = overwrites
  busy = false,
  onConfirm,
  onCancel,
}) {
  const cancelRef = useRef(null);
  const [working, setWorking] = useState(false);
  useEscapeKey(working ? null : onCancel);
  // Tab stays inside the dialog. Without it you can tab straight through to
  // the admin panel behind — which is still fully operable by keyboard while
  // a dialog asks whether you're sure about destroying a result.
  const dialogRef = useFocusTrap(true);

  useEffect(() => { cancelRef.current?.focus(); }, []);

  const confirm = async () => {
    if (working) return;
    setWorking(true);
    try { await onConfirm(); }
    finally { setWorking(false); }
  };

  const disabled = busy || working;

  return (
    <div
      className="modal-overlay" role="dialog" aria-modal="true" aria-label={title}
      onClick={() => !disabled && onCancel()}
    >
      <div ref={dialogRef} className="modal confirm-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="modal-title" style={{ fontSize: 19 }}>{title}</div>

        {lines.length > 0 && (
          <div className={`confirm-lines ${tone}`}>
            {lines.map((line, i) => <div key={i} className="confirm-line">{line}</div>)}
          </div>
        )}

        {note && <p className="confirm-note">{note}</p>}

        <div className="modal-actions">
          <button ref={cancelRef} type="button" className="btn btn-ghost" disabled={disabled} onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`btn ${tone === "danger" ? "btn-danger" : "btn-primary"}`}
            disabled={disabled}
            onClick={confirm}
          >
            {disabled ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
