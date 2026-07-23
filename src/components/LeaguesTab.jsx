import { useState, useEffect } from "react";
import {
  fsCreateLeague, fsGetLeague, fsAddLeagueMember, fsRemoveLeagueMember,
  fsSetLeagueAdmins, fsDeleteLeague, fsGetAllUsers,
} from "../firebase.js";
import { generateCode, DEFAULT_SCORING } from "../lib/scoring.js";
import Avatar from "./Avatar.jsx";
import AdminPanel from "./AdminPanel.jsx";
import StandingsCard from "./StandingsCard.jsx";

export default function LeaguesTab({ user, myLeagues, allUsers, allPredictions, results, specialResults, selectedLeague, onSetLeague, refresh }) {
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

  return (
    <div>
      <div className="page-title">My Leagues</div>
      <div className="page-sub">Create a league and share the code, or join one a friend sent you.</div>

      <div style={{ display: "flex", gap: 10, marginBottom: 20 }}>
        <button className="btn btn-primary" onClick={() => setModal("create")}>+ Create League</button>
        <button className="btn btn-ghost" onClick={() => setModal("join")}>Join with Code</button>
      </div>

      {myLeagues.length === 0 && (
        <div className="glass card" style={{ textAlign: "center", color: "var(--muted)" }}>
          You're not in any leagues yet.
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
              <div style={{ cursor: "pointer", flex: 1, minWidth: 180 }} onClick={() => openLeague(league.id)}>
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
              <button className="btn btn-ghost btn-sm" onClick={() => openLeague(league.id)}>
                {isExpanded ? "Hide" : "View"}
              </button>
            </div>

            {isExpanded && (
              <div style={{ marginTop: 16, borderTop: "1px solid var(--border)", paddingTop: 16 }}>
                <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
                  <button className={`nav-tab ${expandedPanel === "standings" ? "active" : ""}`} onClick={() => setExpandedPanel("standings")}>Standings</button>
                  <button className={`nav-tab ${expandedPanel === "members" ? "active" : ""}`} onClick={() => setExpandedPanel("members")}>Members</button>
                  {isAdmin && <button className={`nav-tab ${expandedPanel === "admin" ? "active" : ""}`} onClick={() => setExpandedPanel("admin")}>Admin Panel</button>}
                </div>

                {expandedPanel === "standings" && (
                  <StandingsCard league={league} user={user} allUsers={allUsers} allPredictions={allPredictions} results={results} specialResults={specialResults} />
                )}
                {expandedPanel === "members" && (
                  <MembersList
                    league={league} user={user} allUsers={allUsers} isSuperAdmin={isSuperAdmin} isAdmin={isAdmin}
                    refresh={refresh}
                  />
                )}
                {expandedPanel === "admin" && isAdmin && (
                  <AdminPanel league={league} user={user} isSuperAdmin={isSuperAdmin} refresh={refresh}
                    onLeagueDeleted={() => { setExpandedId(null); onSetLeague(null); }} />
                )}
              </div>
            )}
          </div>
        );
      })}

      {modal === "create" && <CreateLeagueModal user={user} onClose={() => setModal(null)} onDone={(id) => { onSetLeague(id); setModal(null); refresh(); }} />}
      {modal === "join" && <JoinLeagueModal user={user} onClose={() => setModal(null)} onDone={(id) => { onSetLeague(id); setModal(null); refresh(); }} />}
    </div>
  );
}

function MembersList({ league, user, allUsers, isSuperAdmin, isAdmin, refresh }) {
  const [confirmKick, setConfirmKick] = useState(null);

  const toggleAdmin = async (uid) => {
    const current = league.adminIds || [];
    const next = current.includes(uid) ? current.filter(a => a !== uid) : [...current, uid];
    await fsSetLeagueAdmins(league.id, next);
    refresh();
  };

  const kick = async (uid) => {
    await fsRemoveLeagueMember(league.id, uid);
    setConfirmKick(null);
    refresh();
  };

  return (
    <div>
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
              confirmKick === uid ? (
                <>
                  <button className="btn btn-danger btn-sm" onClick={() => kick(uid)}>Confirm</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmKick(null)}>Cancel</button>
                </>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => setConfirmKick(uid)}>Kick</button>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}

function CreateLeagueModal({ user, onClose, onDone }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const create = async () => {
    if (!name.trim()) { setError("Please enter a league name."); return; }
    setBusy(true);
    const id = generateCode(6);
    await fsCreateLeague({
      id, name: name.trim(),
      superAdminId: user.uid, adminIds: [], members: [user.uid],
      settings: { ...DEFAULT_SCORING },
      createdAt: Date.now(),
    });
    onDone(id);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
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

function JoinLeagueModal({ user, onClose, onDone }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const join = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setBusy(true);
    const league = await fsGetLeague(trimmed);
    if (!league) {
      setError(`No league found with code "${trimmed}". Double-check with the league admin.`);
      setBusy(false);
      return;
    }
    if (!league.members.includes(user.uid)) {
      await fsAddLeagueMember(trimmed, user.uid);
    }
    onDone(trimmed);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">Join League</div>
        <p className="modal-sub">Enter the 6-character league code shared by the league admin.</p>
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
