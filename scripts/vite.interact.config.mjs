// Vite config for `npm run interact`.
//
// Same as the smoke config, plus one thing: src/firebase.js is swapped for a
// generated stub. The interaction test mounts components for real, so their
// effects RUN — and StandingsCard's effect persists the movement snapshot.
// Without the stub the test opens a live Firestore connection on every run,
// which is slow, needs network, and (with real credentials present) would be
// writing to the actual league from a test. The stub makes it hermetic.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^.*\/firebase\.js$/,
        replacement: fileURLToPath(new URL("./interact-firebase-stub.js", import.meta.url)),
      },
      {
        find: /^.*firebaseConfig\.js$/,
        replacement: fileURLToPath(new URL("./smoke-firebase-config.js", import.meta.url)),
      },
    ],
  },
});
