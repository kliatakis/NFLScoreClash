// Vite config used only by `npm run smoke`.
//
// Aliases the Firebase config to a fake one so the smoke test runs against the
// repo exactly as it ships — with REPLACE_ME placeholders in the real file and
// no credentials anywhere. Nothing here touches the normal build.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [{
      // Must match the WHOLE specifier: a regex alias replaces only the part
      // it matched, so /\/firebaseConfig\.js$/ turns "./firebaseConfig.js"
      // into "." + the absolute path.
      find: /^.*firebaseConfig\.js$/,
      replacement: fileURLToPath(new URL("./smoke-firebase-config.js", import.meta.url)),
    }],
  },
});
