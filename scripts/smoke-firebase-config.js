// Stand-in for src/firebaseConfig.js during the smoke test ONLY.
//
// The real file ships with REPLACE_ME placeholders and firebase.js throws at
// import time when it sees them — deliberately, so a misconfigured deploy
// fails loudly instead of hanging. That guard would stop the smoke test before
// it rendered anything, so the SSR build aliases the config to this instead.
//
// These are syntactically valid and completely fake. Nothing here reaches a
// network: initializeApp/getAuth/getFirestore only construct objects, and
// renderToString never runs the effects that would open a connection.
export const firebaseConfig = {
  apiKey: "smoke-test", authDomain: "smoke.firebaseapp.com", projectId: "smoke",
  storageBucket: "smoke.firebasestorage.app", messagingSenderId: "0", appId: "0:0:web:0",
};
export const isFirebaseConfigured = true;
