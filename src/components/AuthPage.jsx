import { useState } from "react";
import { fbRegister, fbLogin, fbResetPassword, fbSendVerificationEmail, fsWriteUser, fsReadUser, fsIsUsernameTaken } from "../firebase.js";
import { WordmarkLogo } from "./Logo.jsx";

export default function AuthPage({ onLogin }) {
  const [mode, setMode] = useState("login"); // login | register | reset
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(""); setInfo(""); setBusy(true);
    try {
      if (mode === "reset") {
        await fbResetPassword(email);
        setInfo("Password reset email sent — check your inbox.");
        return;
      }
      if (mode === "register") {
        if (!username.trim()) { setError("Pick a username."); return; }
        if (await fsIsUsernameTaken(username.trim(), null)) { setError("That username is taken — pick another."); return; }
        const user = await fbRegister(email, password);
        await fsWriteUser(user.uid, { username: username.trim(), email, avatar: null, lastLoginAt: Date.now() });
        try { await fbSendVerificationEmail(); } catch { /* non-fatal — the in-app banner offers a retry */ }
        onLogin({ uid: user.uid, username: username.trim(), email, emailVerified: user.emailVerified });
        return;
      }
      const user = await fbLogin(email, password);
      const profile = await fsReadUser(user.uid);
      onLogin({ uid: user.uid, username: profile?.username || email, email, emailVerified: user.emailVerified });
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 32, padding: 20 }}>
      <WordmarkLogo width={340} />
      <form onSubmit={submit} className="glass card" style={{ width: "100%", maxWidth: 380 }}>
        <div className="modal-title" style={{ marginBottom: 18 }}>
          {mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Reset Password"}
        </div>
        {error && <div className="error-msg">{error}</div>}
        {info && <div className="success-msg">{info}</div>}

        {mode === "register" && (
          <div className="form-group">
            <label className="form-label">Username</label>
            <input className="form-input" value={username} onChange={e => setUsername(e.target.value)} placeholder="How friends will see you" />
          </div>
        )}
        <div className="form-group">
          <label className="form-label">Email</label>
          <input className="form-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        {mode !== "reset" && (
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
        )}

        <button className="btn btn-primary btn-full" disabled={busy} type="submit">
          {busy ? "Please wait…" : mode === "login" ? "Sign In" : mode === "register" ? "Create Account" : "Send Reset Email"}
        </button>

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
          {mode === "login" ? (
            <>
              <span style={{ cursor: "pointer" }} onClick={() => setMode("register")}>Create an account</span>
              <span style={{ cursor: "pointer" }} onClick={() => setMode("reset")}>Forgot password?</span>
            </>
          ) : (
            <span style={{ cursor: "pointer" }} onClick={() => setMode("login")}>← Back to sign in</span>
          )}
        </div>
      </form>
    </div>
  );
}

function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code.includes("wrong-password") || code.includes("invalid-credential")) return "Incorrect email or password.";
  if (code.includes("user-not-found")) return "No account with that email.";
  if (code.includes("email-already-in-use")) return "That email is already registered — try signing in instead.";
  if (code.includes("weak-password")) return "Password must be at least 6 characters.";
  return err?.message || "Something went wrong.";
}
