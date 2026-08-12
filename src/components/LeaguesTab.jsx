import { useState, useEffect } from "react";
import { useEscapeKey } from "../lib/hooks.js";
import {
  fsCreateLeague, fsGetLeague, fsAddLeagueMember, fsRemoveLeagueMember,
  fsSetLeagueAdmins, fsLeaveLeague, fsLogChange,
} from "../firebase.js";
import { makeEntry } from "../lib/auditLog.js";
import { generateCode, DEFAULT_SCORING } from "../lib/scoring.js";
import Avatar from "./Avatar.jsx";
import AdminPanel from "./AdminPanel.jsx";
import ConfirmDialog from "./ConfirmDialog.jsx";
import StandingsCard from "./StandingsCard.jsx";
import WeeklyStandingsCard from "./WeeklyStandingsCard.jsx";
import HeadToHeadCard from "./HeadToHeadCard.jsx";
import SeasonChartCard from "./SeasonChartCard.jsx";
import AwardsCard from "./AwardsCard.jsx";

export default function LeaguesTab({ user, myLeagues, allUsers, allPredictions, results, specialResults, selectedLeague, onSetLeague, leaguesLoaded = true, inviteCode = null, onInviteHandled }) {
  const [modal, setModal] = useState(null); // "create" | "join"
  const [expandedId, setExpandedId] = useState(null);
  const [expandedPanel, setExpandedPanel] = useState("standings"); // standings | members | admin
  const [copiedId, setCopiedId] = useState(null);

  // If you're only in one league, jump straight to its standings — no need
  // to click "Manage" first. With more than one, you pick which to expand.
  useEffect(() => {
    if (myLeagues.length === 1 && expandedId === null) {
      setExpandedId(myLeagues[0].id);
      setExpandedPanel("standings");
    }
  }, [myLeagues.length]);

  const openLeague = (leagueId) => {
    onSetLeague(leagueId);
    setExpandedId(id => (id === leagueId ? null : leagueId));
    setExpandedPanel("standings");
  };

  const copyCode = (code) => {
    navigator.clipboard?.writeText(code);
    setCopiedId(code);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // A bare 6-character code left the inviter to explain, in WhatsApp, what to
  // do with it. This hands over a complete message plus a link that opens the
  // join dialog already filled in.
  const [sharedId, setSharedId] = useState(null);
  const inviteText = (league) => {
    const url = `${window.location.origin}${window.location.pathname}?join=${league.id}`;
    return `Join my ScoreClash league "${league.name}"\n\nCode: ${league.id}\n${url}`;
  };
  const shareInvite = async (league) => {
    const text = inviteText(league);
    try {
      // The native share sheet on a phone is far better than a clipboard copy
      // — it goes straight to WhatsApp. Desktop browsers mostly lack it.
      if (navigator.share) {
        await navigator.share({ title: `ScoreClash — ${league.name}`, text });
        return;
      }
      await navigator.clipboard?.writeText(text);
      setSharedId(league.id);
      setTimeout(() => setSharedId(null), 1800);
    } catch { /* dismissed the share sheet, or clipboard denied — nothing to do */ }
  };

  // Someone arrived on an invite link for a league they're not in yet.
  useEffect(() => {
    if (inviteCode && !myLeagues.some(l => l.id === inviteCode)) setModal("join");
  }, [inviteCode, myLeagues]);

  return (
    <div>
      <div className="page-title">My Leagues</div>
      <div className="page-sub">Create a league and share the code, or join one a friend sent you.</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal("create")}>+ Create League</button>
        <button className="btn btn-ghost" onClick={() => setModal("join")}>Join with Code</button>
      </div>

      {/* Same three-state rule as the dashboard — don't claim someone has no
          leagues before the subscription has actually answered. */}
      {!leaguesLoaded && myLeagues.length === 0 && (
        <div className="glass card">
          <div className="skeleton skeleton-row" />
          <div className="skeleton skeleton-row" />
        </div>
      )}

      {leaguesLoaded && myLeagues.length === 0 && (
        <div className="glass card">
          <div className="empty-state">
            <div className="empty-state-icon">🏆</div>
            <div className="empty-state-title">You're not in any leagues yet</div>
            <div className="empty-state-sub">
              Create a league to get a 6-character code you can share, or use Join with Code
              if a friend has already sent you theirs.
            </div>
          </div>
        </div>
      )}

      {myLeagues.map(league => {
        const isSuperAdmin = league.superAdminId === user.uid;
        const isAdmin = isSuperAdmin || (league.adminIds || []).includes(user.uid);
        const isSelected = selectedLeague === league.id;
        const isExpanded = expandedId === league.id;

        return (
          <div key={league.id} className="glass card" style={{ marginBottom: 14, borderColor: isSelected ? "rgba(59,130,246,0.4)" : undefined }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
              {/* Not role="button": it contains the Copy button, and nesting
                  a control inside a control is invalid and confuses screen
                  readers. The keyboard path is the real "View" button to the
                  right; this is a mouse shortcut, so it's marked as one. */}
              <div style={{ cursor: "pointer", flex: 1, minWidth: 180 }}
                onClick={() => openLeague(league.id)}>
                <div style={{ fontWeight: 800, fontSize: 16, display: "flex", alignItems: "center", gap: 12 }}>
                  {league.name} {isSelected && <span className="chip active">Active</span>}
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 8, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {league.members.length} member{league.members.length !== 1 ? "s" : ""}
                  <span className="league-code-pill">
                    <span className="league-code-pill-label">CODE</span>
                    <code>{league.id}</code>
                    <button
                      className="league-code-copy"
                      onClick={(e) => { e.stopPropagation(); copyCode(league.id); }}
                    >
                      {copiedId === league.id ? "Copied!" : "Copy"}
                    </button>
                  </span>
                  {isSuperAdmin && <span className="chip super">Super Admin</span>}
                  {!isSuperAdmin && isAdmin && <span className="chip active">Admin</span>}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); shareInvite(league); }}>
                  {sharedId === league.id ? "Copied!" : "Invite"}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => openLeague(league.id)}>
                  {isExpanded ? "Hide" : "View"}
                </button>
              </div>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <button className={`nav-tab ${expandedPanel === "standings" ? "active" : ""}`} onClick={() => setExpandedPanel("standings")}>Standings</button>
                  <button className={`nav-tab ${expandedPanel === "weekly" ? "active" : ""}`} onClick={() => setExpandedPanel("weekly")}>Weekly Standings</button>
                  <button className={`nav-tab ${expandedPanel === "h2h" ? "active" : ""}`} onClick={() => setExpandedPanel("h2h")}>Head 2 Head</button>
                  <button className={`nav-tab ${expandedPanel === "chart" ? "active" : ""}`} onClick={() => setExpandedPanel("chart")}>Season Chart</button>
                  <button className={`nav-tab ${expandedPanel === "awards" ? "active" : ""}`} onClick={() => setExpandedPanel("awards")}>Awards</button>
                  <button className={`nav-tab ${expandedPanel === "members" ? "active" : ""}`} onClick={() => setExpandedPanel("members")}>Members</button>
                  {isAdmin && <button className={`nav-tab ${expandedPanel === "admin" ? "active" : ""}`} onClick={() => setExpandedPanel("admin")}>Admin Panel</button>}
                </div>

                {expandedPanel === "standings" && (
                  <StandingsCard league={league} user={user} allUsers={allUsers} allPredictions={allPredictions} results={results} specialResults={specialResults} />
                )}
                {expandedPanel === "weekly" && (
                  <WeeklyStandingsCard league={league} user={user} allUsers={allUsers} allPredictions={allPredictions} results={results} />
                )}
                {expandedPanel === "h2h" && (
                  <HeadToHeadCard league={league} user={user} allUsers={allUsers} allPredictions={allPredictions} results={results} />
                )}
                {expandedPanel === "chart" && (
                  <SeasonChartCard league={league} user={user} allUsers={allUsers} allPredictions={allPredictions} results={results} />
                )}
                {expandedPanel === "awards" && (
                  <AwardsCard league={league} allUsers={allUsers} allPredictions={allPredictions}
                    results={results} specialResults={specialResults} />
                )}
                {expandedPanel === "members" && (
                  <MembersList
                    league={league} user={user} allUsers={allUsers} isSuperAdmin={isSuperAdmin} isAdmin={isAdmin}

                    onLeft={() => { setExpandedId(null); onSetLeague(null); }}
                  />
                )}
                {expandedPanel === "admin" && isAdmin && (
                  <AdminPanel league={league} user={user} isSuperAdmin={isSuperAdmin}
                    onLeagueDeleted={() => { setExpandedId(null); onSetLeague(null); }} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {modal === "create" && <CreateLeagueModal user={user} onClose={() => setModal(null)} onDone={(id) => { onSetLeague(id); setModal(null); }} />}
      {modal === "join" && (
        <JoinLeagueModal
          user={user}
          initialCode={inviteCode || ""}
          onClose={() => { setModal(null); onInviteHandled?.(); }}
          onDone={(id) => { onSetLeague(id); setModal(null); onInviteHandled?.(); }}
        />
      )}
    </div>
  );
}

function MembersList({ league, user, allUsers, isSuperAdmin, isAdmin, onLeft }) {
  const [confirmKick, setConfirmKick] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [leaving, setLeaving] = useState(false);

  // Recorded in the league's History (Admin Panel → History). Membership and
  // admin rights decide who can change scores and scoring, so they belong in
  // the same record as the scores themselves. `global: false` — these are
  // about this league only, unlike a result, which lands in every league.
  const log = (kind, summary, detail) => {
    try {
      fsLogChange(makeEntry({
        kind, actorUid: user.uid, actorName: user.username || "Admin",
        leagueId: league.id, global: false, summary, detail, now: Date.now(),
      }));
    } catch (err) { console.error("Couldn't build a history entry", err); }
  };

  const nameOf = (uid) => allUsers[uid]?.username || uid;

  // No manual refresh needed anywhere in here — every league doc is live via
  // fsSubscribeMyLeagues, so these writes flow back on their own.
  const toggleAdmin = async (uid) => {
    const current = league.adminIds || [];
    const promoting = !current.includes(uid);
    const next = promoting ? [...current, uid] : current.filter(a => a !== uid);
    await fsSetLeagueAdmins(league.id, next);
    log("admins_changed",
      `${nameOf(uid)} ${promoting ? "made an admin" : "had admin rights revoked"}`,
      { targetUid: uid, promoted: promoting });
  };

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const kick = async (uid) => {
    setBusy(true); setError("");
    try {
      await fsRemoveLeagueMember(league.id, uid);
      log("member_removed", `${nameOf(uid)} removed from ${league.name}`, { targetUid: uid });
      setConfirmKick(null);
    } catch (err) {
      // Previously unguarded: a failed write left the row sitting on
      // "Confirm | Cancel" with the member still there and no explanation.
      console.error("Couldn't remove the member", err);
      setError("Couldn't remove them — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    setLeaving(true); setError("");
    try {
      await fsLeaveLeague(league.id, user.uid);
      setConfirmLeave(false);
      onLeft?.();
    } catch (err) {
      console.error("Couldn't leave the league", err);
      setError("Couldn't leave — check your connection and try again.");
    } finally {
      setLeaving(false);
    }
  };

  return (
    <div>
      {/* Super admins can't leave their own league — Danger Zone -> Delete
          League is the equivalent action for them (see AdminPanel), since
          leaving would either abandon a league with other people still in
          it, or is pointless if they're the only member. */}
      {error && <div className="error-msg">{error}</div>}

      {!isSuperAdmin && (
        <div style={{ marginBottom: 16, paddingBottom: 16, borderBottom: "1px solid var(--border)" }}>
          <button className="btn btn-ghost btn-sm" onClick={() => setConfirmLeave(true)}>Leave League</button>
        </div>
      )}

      {/* Both of these used to be an inline two-step. Leaving at least said
          what would happen; Kick turned into a bare "Confirm | Cancel" with
          no statement of what it does to the other person at all. They now
          use the same dialog as every other destructive action, and both say
          the thing people actually worry about: the picks are safe. */}
      {confirmLeave && (
        <ConfirmDialog
          tone="danger"
          title={`Leave ${league.name}?`}
          lines={[league.name, `Code ${league.id}`]}
          note="Your picks belong to your account, not to the league — nothing is deleted, and they come straight back if you rejoin. You'll disappear from this league's standings until you do, and you'll need the code above to get back in."
          confirmLabel="Leave the league"
          busy={leaving}
          onConfirm={leave}
          onCancel={() => setConfirmLeave(false)}
        />
      )}

      {confirmKick && (
        <ConfirmDialog
          tone="danger"
          title={`Remove ${nameOf(confirmKick)} from the league?`}
          lines={[nameOf(confirmKick), `${league.name} · code ${league.id}`]}
          note="They drop out of the standings immediately. Their picks aren't deleted — those are stored per person — so if they rejoin with the code, everything they've scored comes back with them. Recorded in History under your name."
          confirmLabel="Remove them"
          busy={busy}
          onConfirm={() => kick(confirmKick)}
          onCancel={() => setConfirmKick(null)}
        />
      )}

      {league.members.map(uid => {
        const u = allUsers[uid] || {};
        const isSuper = league.superAdminId === uid;
        const isMemberAdmin = (league.adminIds || []).includes(uid);
        return (
          <div key={uid} className="standings-row">
            <Avatar user={u} size={30} />
            <span style={{ flex: 1, fontWeight: 600 }}>{u.username || uid} {uid === user.uid && <span style={{ color: "var(--muted)", fontWeight: 400 }}>(you)</span>}</span>
            {isSuper && <span className="chip super">Super Admin</span>}
            {!isSuper && isMemberAdmin && <span className="chip active">Admin</span>}
            {isSuperAdmin && !isSuper && (
              <button className="btn btn-ghost btn-sm" onClick={() => toggleAdmin(uid)}>
                {isMemberAdmin ? "Revoke Admin" : "Make Admin"}
              </button>
            )}
            {isAdmin && !isSuper && uid !== user.uid && (
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmKick(uid)}>Remove</button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function CreateLeagueModal({ user, onClose, onDone }) {
  useEscapeKey(onClose);
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    setError("");
    if (!name.trim()) { setError("Please enter a league name."); return; }
    setBusy(true);
    // Retried on the vanishingly rare chance the generated code is already
    // taken (fsCreateLeague refuses to overwrite rather than clobbering the
    // existing league). Wrapped so a network or permission failure shows an
    // error instead of leaving the button disabled forever.
    try {
      let id = null;
      for (let attempt = 0; attempt < 5 && !id; attempt++) {
        const candidate = generateCode(6);
        try {
          await fsCreateLeague({
            id: candidate, name: name.trim(),
            superAdminId: user.uid, adminIds: [], members: [user.uid],
            settings: { ...DEFAULT_SCORING },
            createdAt: Date.now(),
          });
          id = candidate;
        } catch (err) {
          if (err?.code !== "league-code-collision") throw err;
        }
      }
      if (!id) { setError("Couldn't generate a free league code. Try again."); return; }
      onDone(id);
    } catch (err) {
      console.error("Create league failed", err);
      setError("Couldn't create the league — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Create league">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Create League</div>
        <p className="modal-sub">A unique code will be generated for your friends to join.</p>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label className="form-label">League Name</label>
          <input className="form-input" value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Office Rivals 2026" autoFocus />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={create}>Create League</button>
        </div>
      </div>
    </div>
  );
}

function JoinLeagueModal({ user, onClose, onDone, initialCode = "" }) {
  useEscapeKey(onClose);
  const [code, setCode] = useState(initialCode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    setError("");
    if (!trimmed) return;
    setBusy(true);
    try {
      const league = await fsGetLeague(trimmed);
      if (!league) {
        setError(`No league found with code "${trimmed}". Double-check with the league admin.`);
        return;
      }
      if (!league.members.includes(user.uid)) {
        await fsAddLeagueMember(trimmed, user.uid);
      }
      onDone(trimmed);
    } catch (err) {
      // Without this the button stayed disabled and nothing was reported —
      // it just looked like the app had ignored the click.
      console.error("Join league failed", err);
      setError("Couldn't join that league — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Join league">
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Join League</div>
        <p className="modal-sub">
          {initialCode
            ? "You've been invited — just confirm to join."
            : "Enter the 6-character league code shared by the league admin."}
        </p>
        {error && <div className="error-msg">{error}</div>}
        <div className="form-group">
          <label className="form-label">League Code</label>
          <input className="form-input" value={code} onChange={e => setCode(e.target.value)} style={{ textTransform: "uppercase" }} autoFocus />
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" disabled={busy} onClick={join}>Join</button>
        </div>
      </div>
    </div>
  );
}
