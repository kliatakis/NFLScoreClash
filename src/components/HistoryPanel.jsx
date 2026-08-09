import { useState, useEffect, useMemo } from "react";
import { fsSubscribeAuditLog } from "../firebase.js";
import {
  AUDIT_KINDS, AUDIT_GROUPS, filterEntries, groupByDay, timeLabel,
} from "../lib/auditLog.js";

// The change history — every admin action that can move a point, newest first.
//
// Read-only by construction. There is no edit and no delete here, and the
// security rules refuse both at the database, so this tab can only ever grow.
export default function HistoryPanel({ league, timezone }) {
  const [entries, setEntries] = useState(null);
  const [error, setError] = useState(null);
  const [group, setGroup] = useState("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState(null);

  useEffect(() => fsSubscribeAuditLog((rows, err) => {
    setEntries(rows);
    setError(err);
  }), []);

  const visible = useMemo(
    () => filterEntries(entries || [], { leagueId: league?.id ?? null, group, search }),
    [entries, league?.id, group, search]);

  const days = useMemo(() => groupByDay(visible, timezone), [visible, timezone]);

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14, lineHeight: 1.5 }}>
        Everything an admin changed that can affect the standings — scores, season winners, playoff
        matchups, scoring values and corrected picks. Entries can't be edited or deleted, by anyone,
        from anywhere in the app.
      </p>

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
                  </div>
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
    </div>
  );
}
