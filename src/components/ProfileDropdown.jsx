import { useState } from "react";
import { fsWriteUser, fsIsUsernameTaken, fbChangePassword, fbChangeEmail, fbDeleteAccountCascade } from "../firebase.js";
import Avatar, { PRESET_AVATARS } from "./Avatar.jsx";
import { COMMON_TIMEZONES, DEFAULT_TIMEZONE } from "../lib/time.js";

export default function ProfileDropdown({ user, onLogout, onUpdate, darkMode, onToggleDark }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(user.username);
  const [usernameErr, setUsernameErr] = useState("");
  // main | password | email | delete — swaps the bottom of the dropdown
  // into a small inline form instead of opening a separate modal.
  const [accountView, setAccountView] = useState("main");

  const pickAvatar = async (emoji) => {
    const avatar = { type: "emoji", value: emoji };
    await fsWriteUser(user.uid, { avatar });
    onUpdate({ ...user, avatar });
  };

  const saveUsername = async () => {
    const trimmed = username.trim();
    setUsernameErr("");
    if (!trimmed) return;
    if (trimmed === user.username) return;
    if (await fsIsUsernameTaken(trimmed, user.uid)) { setUsernameErr("That username is taken."); return; }
    await fsWriteUser(user.uid, { username: trimmed });
    onUpdate({ ...user, username: trimmed });
  };

  const closeAccountPanel = () => setAccountView("main");

  const saveTimezone = async (timezone) => {
    await fsWriteUser(user.uid, { timezone });
    onUpdate({ ...user, timezone });
  };

  return (
    <div style={{ position: "relative" }}>
      <button className={`profile-btn ${open ? "open" : ""}`} onClick={() => setOpen(o => !o)}>
        <Avatar user={user} size={26} />
        <span>{user.username}</span>
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 200 }} onClick={() => setOpen(false)} />
          <div className="profile-dropdown glass">
            <div className="profile-section" style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <Avatar user={user} size={44} />
              <div>
                <div style={{ fontWeight: 700 }}>{user.username}</div>
                <div style={{ fontSize: 11, color: "var(--muted)" }}>{user.email}</div>
              </div>
            </div>
            <div className="profile-section">
              <div className="form-label">Avatar</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 6 }}>
                {PRESET_AVATARS.map(a => (
                  <div key={a.id} onClick={() => pickAvatar(a.emoji)}
                    style={{ aspectRatio: "1", borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, cursor: "pointer" }}
                    title={a.label}>
                    {a.emoji}
                  </div>
                ))}
              </div>
            </div>
            <div className="profile-section" style={{ display: "flex", gap: 8 }}>
              <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} style={{ fontSize: 13, padding: "8px 12px" }} />
              <button className="btn btn-primary btn-sm" onClick={saveUsername}>Save</button>
            </div>
            {usernameErr && <div className="error-msg" style={{ margin: "0 12px 8px" }}>{usernameErr}</div>}
            <div className="profile-section toggle-row">
              <span style={{ fontSize: 13, fontWeight: 600 }}>Dark mode</span>
              <div className={`toggle ${darkMode ? "on" : ""}`} onClick={onToggleDark} />
            </div>
            <div className="profile-section">
              <div className="form-label">Kickoff times shown in</div>
              <select
                className="form-select"
                value={user.timezone || DEFAULT_TIMEZONE}
                onChange={e => saveTimezone(e.target.value)}
              >
                {COMMON_TIMEZONES.map(tz => (
                  <option key={tz.id} value={tz.id}>{tz.label}</option>
                ))}
              </select>
            </div>

            {accountView === "main" && (
              <div className="profile-section" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div className="form-label">Account</div>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }} onClick={() => setAccountView("password")}>Change Password</button>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start" }} onClick={() => setAccountView("email")}>Change Email</button>
                <button className="btn btn-ghost btn-sm" style={{ justifyContent: "flex-start", color: "var(--accent2)" }} onClick={() => setAccountView("delete")}>Delete Account</button>
              </div>
            )}
            {accountView === "password" && <ChangePasswordForm onClose={closeAccountPanel} />}
            {accountView === "email" && <ChangeEmailForm user={user} onUpdate={onUpdate} onClose={closeAccountPanel} />}
            {accountView === "delete" && <DeleteAccountForm onClose={closeAccountPanel} />}

            {accountView === "main" && (
              <div style={{ padding: 12 }}>
                <button className="btn btn-ghost btn-full" onClick={onLogout}>Sign Out</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function ChangePasswordForm({ onClose }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    if (next.length < 6) { setError("New password must be at least 6 characters."); return; }
    setBusy(true);
    try {
      await fbChangePassword(current, next);
      setDone(true);
      setTimeout(onClose, 1500);
    } catch (err) {
      setError(err?.code?.includes("wrong-password") || err?.code?.includes("invalid-credential") ? "Current password is incorrect." : (err?.message || "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-section">
      <div className="form-label">Change Password</div>
      {done ? (
        <div className="success-msg">Password updated.</div>
      ) : (
        <>
          {error && <div className="error-msg">{error}</div>}
          <input className="form-input" type="password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="form-input" type="password" placeholder="New password" value={next} onChange={e => setNext(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

function ChangeEmailForm({ user, onUpdate, onClose }) {
  const [current, setCurrent] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    setError("");
    if (!newEmail.includes("@")) { setError("Enter a valid email."); return; }
    setBusy(true);
    try {
      await fbChangeEmail(current, newEmail);
      onUpdate({ ...user, email: newEmail, emailVerified: false });
      setDone(true);
      setTimeout(onClose, 1800);
    } catch (err) {
      setError(err?.code?.includes("wrong-password") || err?.code?.includes("invalid-credential") ? "Current password is incorrect." : (err?.message || "Something went wrong."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="profile-section">
      <div className="form-label">Change Email</div>
      {done ? (
        <div className="success-msg">Email updated — check your inbox to re-verify.</div>
      ) : (
        <>
          {error && <div className="error-msg">{error}</div>}
          <input className="form-input" type="password" placeholder="Current password" value={current} onChange={e => setCurrent(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="form-input" type="email" placeholder="New email" value={newEmail} onChange={e => setNewEmail(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={submit}>{busy ? "Saving…" : "Save"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}

function DeleteAccountForm({ onClose }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const submit = async () => {
    setError("");
    if (!password) { setError("Enter your password to confirm."); return; }
    setBusy(true);
    try {
      await fbDeleteAccountCascade(password);
      // No further action needed — deleting the Firebase Auth user fires
      // onAuthStateChanged in App.jsx, which drops back to the sign-in page.
    } catch (err) {
      setError(err?.code?.includes("wrong-password") || err?.code?.includes("invalid-credential") ? "Incorrect password." : (err?.message || "Something went wrong."));
      setBusy(false);
    }
  };

  return (
    <div className="profile-section">
      <div className="form-label" style={{ color: "var(--accent2)" }}>Delete Account</div>
      {!confirming ? (
        <>
          <p style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>
            This permanently deletes your account, removes you from every league you're in, and can't be undone.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-danger btn-sm" onClick={() => setConfirming(true)}>Continue</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          </div>
        </>
      ) : (
        <>
          {error && <div className="error-msg">{error}</div>}
          <input className="form-input" type="password" placeholder="Confirm your password" value={password} onChange={e => setPassword(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-danger btn-sm" disabled={busy} onClick={submit}>{busy ? "Deleting…" : "Yes, Delete My Account"}</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Cancel</button>
          </div>
        </>
      )}
    </div>
  );
}
