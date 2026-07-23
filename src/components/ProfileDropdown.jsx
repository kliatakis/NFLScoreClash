import { useState } from "react";
import { fsWriteUser } from "../firebase.js";
import Avatar, { PRESET_AVATARS } from "./Avatar.jsx";
import { COMMON_TIMEZONES, DEFAULT_TIMEZONE } from "../lib/time.js";

export default function ProfileDropdown({ user, onLogout, onUpdate, darkMode, onToggleDark }) {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(user.username);

  const pickAvatar = async (emoji) => {
    const avatar = { type: "emoji", value: emoji };
    await fsWriteUser(user.uid, { avatar });
    onUpdate({ ...user, avatar });
  };

  const saveUsername = async () => {
    if (!username.trim()) return;
    await fsWriteUser(user.uid, { username: username.trim() });
    onUpdate({ ...user, username: username.trim() });
  };

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
            <div style={{ padding: 12 }}>
              <button className="btn btn-ghost btn-full" onClick={onLogout}>Sign Out</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
