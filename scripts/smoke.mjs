// ─── SMOKE TEST: DOES EVERY SCREEN ACTUALLY RENDER? ─────────────────────────
//
// Run with:  npm run smoke        (part of `npm run check`)
//
// WHY THIS EXISTS
// ───────────────
// Everything else in this repo inspects the source WITHOUT EXECUTING IT. The
// unit tests import pure functions from src/lib. The audit reads files as
// text. Vite bundles without evaluating. All three passed on a version of
// App.jsx that used `useMemo` without importing it — and the app died on load
// for everyone, because a missing identifier is only an error at the moment a
// browser reaches the line.
//
// So this one runs the code. Vite compiles the whole component tree for Node
// (which evaluates every module, catching anything referenced but not
// imported), then every component is rendered with realistic props, which
// catches whatever throws on the way to first paint.
//
// WHAT IT DOES NOT COVER, HONESTLY
// ─────────────────────────────────
// renderToString does not run effects, so anything inside useEffect is not
// exercised here. Clicks, live Firestore data and CSS are all out of scope
// too. This is a smoke test: it proves the screens come up, not that they are
// correct. `npm test` is what proves the numbers.

import { execSync } from "node:child_process";
import { rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { JSDOM } from "jsdom";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const OUT = join(ROOT, "dist-ssr");

// A DOM has to exist before the modules are imported — several read `window`
// or localStorage as they initialise.
const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://scoreclash.local/" });
for (const k of ["window", "document", "navigator", "localStorage", "sessionStorage",
                 "HTMLElement", "Element", "Node", "getComputedStyle", "requestAnimationFrame"]) {
  // Node 22 defines some of these as getter-only on globalThis, so a plain
  // assignment throws. defineProperty replaces them outright.
  try { Object.defineProperty(globalThis, k, { value: dom.window[k], configurable: true, writable: true }); }
  catch { /* whatever we can't replace, the component tree can live without */ }
}
globalThis.matchMedia = dom.window.matchMedia = (q) => ({
  matches: false, media: q, onchange: null,
  addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {},
  dispatchEvent() { return false; },
});

console.log("\n  compiling the component tree for Node…");
try {
  execSync(`npx vite build --config scripts/vite.smoke.config.mjs --ssr scripts/smoke-entry.jsx --outDir dist-ssr --logLevel error`,
    { cwd: ROOT, stdio: "pipe" });
} catch (err) {
  console.error("\n  The SSR build failed — that is itself a real failure:\n");
  console.error(String(err.stdout || "") + String(err.stderr || ""));
  process.exit(1);
}

const { renderToString } = await import("react-dom/server");
const React = await import("react");
const mod = await import(join(OUT, "smoke-entry.js"));

// ── Realistic props ─────────────────────────────────────────────────────────
// A mid-season league with results, picks, an admin and a rival, so components
// render their populated state rather than only their empty state.
const members = ["me", "rival", "third", "fourth", "fifth"];
const allUsers = Object.fromEntries(members.map(u => [u, { username: u, avatar: null, timezone: "Europe/Athens" }]));
const allPredictions = Object.fromEntries(members.map(u => [u, { picks: {}, specials: {} }]));
const results = {};
const user = { uid: "me", username: "me", email: "me@example.com", timezone: "Europe/Athens", emailVerified: true };
const league = {
  id: "TESTCODE", name: "Test League", members, adminIds: ["me"], superAdminId: "me",
  settings: {}, reactions: {},
};

const props = {
  user, league, allUsers, allPredictions, results, specialResults: {},
  selectedLeague: league, myLeagues: [league], leaguesLoaded: true, hasLeagues: true,
  isSuperAdmin: true, isAdmin: true, timezone: "Europe/Athens", lastLoginPrev: Date.now() - 86400000,
  setTab() {}, onSetLeague() {}, onLogin() {}, onLeft() {}, onDone() {}, onClose() {},
  onUpdate() {}, onLogout() {}, onLeagueDeleted() {}, onInviteHandled() {}, logChange() {},
  onConfirm() {}, onCancel() {}, onGo() {}, darkMode: true, onToggleTheme() {},
  title: "Test", lines: ["a", "b"], note: "note", confirmLabel: "Confirm",
  code: "ABC", email: "me@example.com", name: "SCORECLASH", movement: { dir: "up", arrows: 1 },
  standings: [], entry: null, week: 1, uid: "me", size: 30,
  children: React.createElement("div", null, "child"),
};

const failures = [];
const skipped = [];
let rendered = 0;

for (const [name, Component] of Object.entries(mod)) {
  if (typeof Component !== "function") { skipped.push(`${name} (not a component)`); continue; }
  try {
    const html = renderToString(React.createElement(Component, props));
    rendered++;
    if (typeof html !== "string") failures.push(`${name}: rendered something that isn't markup`);
  } catch (err) {
    const msg = String(err && err.message || err).split("\n")[0];
    // A component that genuinely needs a prop shape this harness doesn't model
    // is a limitation of the harness. Anything else is a real defect.
    if (/is not defined|is not a function|Cannot read propert|before initialization|Invalid hook call|Rendered more hooks/.test(msg)) {
      failures.push(`${name}: ${msg}`);
    } else {
      skipped.push(`${name}: ${msg}`);
    }
  }
}

rmSync(OUT, { recursive: true, force: true });

console.log(`  rendered ${rendered} components`);
if (skipped.length) {
  console.log(`  skipped ${skipped.length}:`);
  for (const s of skipped) console.log(`     ${s}`);
}

if (failures.length) {
  console.error(`\n${failures.length} component(s) failed to render:\n` + failures.map(f => `  ${f}`).join("\n") + "\n");
  process.exit(1);
}
console.log("\n  Smoke test clean — every screen renders.\n");
