// ─── YOUR FIREBASE KEYS — THE ONE FILE YOU EDIT ─────────────────────────────
//
// This used to live inside firebase.js. That was a trap: firebase.js changes
// whenever a feature needs a new query, so every update meant re-uploading it
// — and re-uploading it silently replaced these keys with the placeholders
// below. The app then builds and deploys perfectly and fails at runtime.
//
// Split out so that never happens again. firebase.js can change as often as it
// likes; this file is yours and should be uploaded exactly ONCE.
//
// ── Where to find these ──
//   console.firebase.google.com → your project → ⚙ Project settings →
//   General → Your apps → SDK setup and configuration → Config
//
// These values are not secret. They identify the project in the browser;
// access is controlled by firestore.rules, not by hiding this.
export const firebaseConfig = {
  apiKey: "REPLACE_ME",
  authDomain: "REPLACE_ME.firebaseapp.com",
  projectId: "REPLACE_ME",
  storageBucket: "REPLACE_ME.firebasestorage.app",
  messagingSenderId: "REPLACE_ME",
  appId: "REPLACE_ME",
};

// True when the file is still untouched. The app checks this and says so
// plainly rather than half-working — an unconfigured Firebase produces auth
// calls that hang, which looks like a bug in the app instead of a missing key.
export const isFirebaseConfigured = !Object.values(firebaseConfig)
  .some(v => typeof v === "string" && v.includes("REPLACE_ME"));
