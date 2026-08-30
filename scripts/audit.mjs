// ─── PRE-DEPLOY AUDIT ───────────────────────────────────────────────────────
//
// Run with:  npm run audit
//
// WHY THIS EXISTS
// ───────────────
// `npm test` covers the scoring core exhaustively and nothing else. Vite's
// build is a bundler, not a linter — it will happily ship a file that
// references a variable nobody imported, because that is only an error once a
// browser reaches the line.
//
// That is not hypothetical. A one-word change added `useMemo` to App.jsx
// without adding it to the import at the top. Tests passed, the build printed
// "built in 1.69s", the deploy went green, and the whole app died on load with
// "useMemo is not defined" — an error boundary and a blank screen for everyone.
//
// Every check below exists because the thing it looks for actually happened.
// Add to it whenever something new gets through.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname, resolve } from "node:path";

const ROOT = resolve(new URL("..", import.meta.url).pathname);
const problems = [];
const note = (file, msg) => problems.push(`${relative(ROOT, file)}: ${msg}`);

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (["node_modules", "dist", ".git", "scripts"].includes(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(js|jsx|mjs)$/.test(name)) out.push(p);
  }
  return out;
}
const files = walk(ROOT);

// Globals a browser or Node provides, plus JSX built-ins.
const KNOWN = new Set(`window document console setTimeout clearTimeout setInterval clearInterval
localStorage sessionStorage navigator fetch Date Math JSON Object Array Number String Boolean Set Map
Promise Intl Error URL Blob FormData isNaN parseInt parseFloat structuredClone queueMicrotask process
requestAnimationFrame cancelAnimationFrame matchMedia alert atob btoa crypto performance Fragment`.split(/\s+/));

function importedNames(src) {
  const names = new Set();
  for (const m of src.matchAll(/import\s+([^;]*?)\s+from\s+["']/gs)) {
    let clause = m[1].trim();
    const brace = clause.match(/\{([^}]*)\}/s);
    if (brace) {
      for (const n of brace[1].split(",")) {
        const t = n.trim();
        if (t) names.add(t.split(" as ").pop().trim());
      }
      clause = clause.slice(0, brace.index) + clause.slice(brace.index + brace[0].length);
    }
    for (const part of clause.split(",")) {
      const t = part.trim().replace(/,$/, "");
      if (!t) continue;
      const star = t.match(/^\*\s+as\s+(\w+)$/);
      if (star) names.add(star[1]);
      else if (/^\w+$/.test(t)) names.add(t);
    }
  }
  return names;
}

for (const file of files) {
  const src = readFileSync(file, "utf8");
  const dir = dirname(file);

  // 1. Hooks and components used without being imported or declared.
  //    THE ONE THAT TOOK THE APP DOWN.
  const declared = new Set([
    ...KNOWN,
    ...importedNames(src),
    ...[...src.matchAll(/(?:export\s+)?(?:async\s+)?(?:function|class)\s+(\w+)/g)].map(m => m[1]),
    ...[...src.matchAll(/(?:const|let|var)\s+(\w+)/g)].map(m => m[1]),
  ]);
  const used = new Set([
    ...[...src.matchAll(/\b(use[A-Z]\w*)\s*\(/g)].map(m => m[1]),
    ...[...src.matchAll(/<([A-Z]\w*)[\s/>]/g)].map(m => m[1]),
  ]);
  for (const name of used) {
    if (!declared.has(name)) note(file, `${name} is used but never imported or declared`);
  }

  // 2. Relative imports pointing at files that don't exist.
  for (const m of src.matchAll(/from\s+["'](\.[^"']+)["']/g)) {
    const target = resolve(dir, m[1]);
    const found = [target, `${target}.js`, `${target}.jsx`].some(c => {
      try { return statSync(c).isFile(); } catch { return false; }
    });
    if (!found) note(file, `imports "${m[1]}", which doesn't exist`);
  }

  // 3. Named imports the target module doesn't actually export, and imports
  //    nothing uses. Both mean the file and its dependency have drifted.
  for (const m of src.matchAll(/import\s*\{([^}]+)\}\s*from\s*["'](\.[^"']+)["']/gs)) {
    const target = resolve(dir, m[2]);
    const path = [target, `${target}.js`, `${target}.jsx`].find(c => {
      try { return statSync(c).isFile(); } catch { return false; }
    });
    if (!path) continue;
    const tgt = readFileSync(path, "utf8");
    const body = src.slice(m.index + m[0].length) + src.slice(0, m.index);
    for (const raw of m[1].split(",")) {
      const name = raw.trim().split(" as ")[0].trim();
      if (!name) continue;
      const exported =
        new RegExp(`export\\s+(const|function|async function|let|class)\\s+${name}\\b`).test(tgt) ||
        new RegExp(`export\\s*\\{[^}]*\\b${name}\\b`, "s").test(tgt);
      if (!exported) note(file, `imports { ${name} }, which ${relative(ROOT, path)} doesn't export`);
      if (!new RegExp(`\\b${name}\\b`).test(body)) note(file, `imports { ${name} } but never uses it`);
    }
  }
}

// 4. theme.js is one enormous template literal, so a stray backtick inside a
//    CSS comment ends the string and breaks the build. This has happened
//    twice, and the build error points at the wrong line both times.
{
  const theme = join(ROOT, "src", "theme.js");
  const src = readFileSync(theme, "utf8");
  for (const m of src.matchAll(/\/\*.*?\*\//gs)) {
    if (m[0].includes("`")) note(theme, `a CSS comment contains a backtick, which will break the build: ${m[0].slice(0, 60).replace(/\s+/g, " ")}…`);
  }
}

// 5. Class names used in JSX with no rule anywhere in the sheet — usually a
//    rename that only got applied on one side.
{
  const css = readFileSync(join(ROOT, "src", "theme.js"), "utf8");
  const defined = new Set([...css.matchAll(/\.([a-zA-Z][\w-]*)/g)].map(m => m[1]));
  for (const file of files.filter(f => f.endsWith(".jsx"))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/className=(?:"([^"]*)"|\{`([^`]*)`\})/g)) {
      // `className={`badge acc-${b.id}`}` becomes "badge acc-" once the
      // interpolation is stripped, and "acc-" is not a class anybody wrote —
      // it is half of one. A checker that reports those is a checker people
      // learn to ignore, which is worse than not having it.
      const raw = (m[1] || m[2] || "").replace(/\$\{[^}]*\}/g, " \u0000 ");
      for (const c of raw.split(/\s+/)) {
        if (c === "\u0000" || c.endsWith("-") || c.endsWith("_")) continue;
        if (/^[a-zA-Z][\w-]{2,}$/.test(c) && !defined.has(c)) note(file, `className "${c}" has no CSS rule`);
      }
    }
  }
}

// 6. Dropdowns a screen reader can't name.
for (const file of files.filter(f => f.endsWith(".jsx"))) {
  const src = readFileSync(file, "utf8");
  for (const m of src.matchAll(/<select\b[^>]*>/gs)) {
    if (!m[0].includes("aria-label")) note(file, "a <select> has no aria-label");
  }
}

if (problems.length) {
  console.error(`\n${problems.length} issue(s):\n` + problems.map(p => `  ${p}`).join("\n") + "\n");
  process.exit(1);
}
console.log(`\nAudit clean — ${files.length} files checked.\n`);
