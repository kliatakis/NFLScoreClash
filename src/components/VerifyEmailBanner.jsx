import { useState } from "react";
import { fbSendVerificationEmail } from "../firebase.js";

// Shown until the account's email is confirmed. Doesn't block app usage —
// just a persistent nudge, since a hard gate would be a bad experience if a
// verification email lands in spam. Status only refreshes on next
// login/reload (Firebase doesn't push emailVerified changes live), so after
// clicking the link in the email, a refresh clears this banner.
export default function VerifyEmailBanner({ email }) {
  const [state, setState] = useState("idle"); // idle | sending | sent | cooldown | error

  const resend = async () => {
    setState("sending");
    try {
      await fbSendVerificationEmail();
      setState("sent");
      setTimeout(() => setState("cooldown"), 4000);
    } catch {
      setState("error");
    }
  };

  return (
    <div className="glass card" style={{ marginBottom: 18, borderLeft: "3px solid var(--gold)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
      <span style={{ fontSize: 13 }}>
        📧 Please verify your email{email ? ` (${email})` : ""} — check your inbox for the confirmation link.
        {state === "sent" && <span style={{ color: "var(--green)", marginLeft: 8 }}>Sent!</span>}
        {state === "error" && <span style={{ color: "var(--accent2)", marginLeft: 8 }}>Couldn't send — try again shortly.</span>}
      </span>
      <button className="btn btn-ghost btn-sm" onClick={resend} disabled={state === "sending" || state === "cooldown"}>
        {state === "sending" ? "Sending…" : state === "cooldown" ? "Sent — check inbox" : "Resend Email"}
      </button>
    </div>
  );
}
