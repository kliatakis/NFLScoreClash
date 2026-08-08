import { useState } from "react";
import { fbRegister, fbLogin, fbResetPassword, fbSendVerificationEmail, fsWriteUser, fsReadUser, fsIsUsernameTaken, fsClaimUsername, validateUsername, USERNAME_MAX } from "../firebase.js";
import { WordmarkLogo } from "./Logo.jsx";
import { detectTimezone } from "../lib/time.js";
import Footer from "./Footer.jsx";

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
        const nameError = validateUsername(username);
        if (nameError) { setError(nameError); return; }
        // Checked against the public `usernames` collection, NOT `users` —
        // there's no signed-in user at this point, so reading `users` here is
        // (correctly) forbidden and used to fail the whole sign-up.
        if (await fsIsUsernameTaken(username.trim(), null)) { setError("That username is taken — pick another."); return; }
        const user = await fbRegister(email, password);

        // ⚠️ The account EXISTS from this line onwards.
        //
        // Nothing after it may be reported as "registration failed". The
        // profile write used to be unguarded, so a dropped connection at this
        // moment showed a sign-up error to somebody who now had a perfectly
        // good account — and retrying told them "that email is already
        // registered", with no way forward. Every step here is therefore
        // best-effort, and we sign them in regardless; the profile repairs
        // itself from the live subscription in App.jsx.
        try { await fsClaimUsername(user.uid, username.trim()); } catch (err) {
          console.error("Couldn't claim the username", err);
        }
        try {
          await fsWriteUser(user.uid, {
            username: username.trim(), email, avatar: null, lastLoginAt: Date.now(),
            // Seeded from the browser rather than defaulting everyone to Athens.
            timezone: detectTimezone(),
          });
        } catch (err) {
          console.error("Couldn't write the profile after sign-up", err);
        }
        try { await fbSendVerificationEmail(); } catch { /* non-fatal — the in-app banner offers a retry */ }
        onLogin({
          uid: user.uid, username: username.trim(), email,
          emailVerified: user.emailVerified, timezone: detectTimezone(),
        });
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
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <div style={{ margin: "auto", display: "flex", flexDirection: "column", alignItems: "center", gap: 32, padding: 20, width: "100%" }}>
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
              <input className="form-input" value={username} onChange={e => setUsername(e.target.value)}
                placeholder="How friends will see you" maxLength={USERNAME_MAX} />
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
            {/* Buttons, not spans. These were click-only, which meant a
                keyboard user could not reach "Create an account" at all —
                there is no other route to the sign-up form. type="button" is
                required: inside a <form>, a bare button submits it. */}
            {mode === "login" ? (
              <>
                <button type="button" className="link-btn" onClick={() => setMode("register")}>Create an account</button>
                <button type="button" className="link-btn" onClick={() => setMode("reset")}>Forgot password?</button>
              </>
            ) : (
              <button type="button" className="link-btn" onClick={() => setMode("login")}>← Back to sign in</button>
            )}
          </div>
        </form>
      </div>
      <Footer />
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
