// Picking a shoutout line from the pools in data/roasts.js.
//
// WHY THIS IS NOT Math.random()
// ─────────────────────────────
// The obvious implementation re-rolls on every render. That would mean:
//
//   * the joke changes while you're reading it, because a Firestore snapshot
//     landed and React re-rendered;
//   * the line is different on your phone and your laptop, so "did you see
//     what it called you" makes no sense;
//   * somebody leaves a 😂 on a sentence, the page refreshes, and the
//     reaction is now sitting under a completely different sentence — the
//     reaction is keyed to the row, not to the text.
//
// So the line is a pure function of the row: hash a stable seed (league,
// week, fixture, who it's about) and index into the pool. The same row always
// shows the same line, forever, on every device — and different rows show
// different lines, which is the whole point.

import {
  SOLO_MISS, GROUP_MISS, LONE_CALL, SWEEP_LINES, NEAR_LINES, SHARP_LINES,
} from "../data/roasts.js";

// FNV-1a. Small, fast, no dependencies, and spreads short similar strings
// ("w1_3" vs "w1_4") across the range — which a naive charCode sum does not,
// and those near-identical seeds are exactly what we feed it.
export function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Picks from `pool` for a given seed, skipping anything already used in this
// render pass.
//
// The de-duplication matters more than it looks: four callouts in one week
// drawing from 140 lines collide about 4% of the time, and the one week it
// happens is the week it looks broken. Walking forward from the hashed index
// keeps the result deterministic — `used` is filled in a fixed row order.
export function pickLine(pool, seed, used) {
  if (!pool || pool.length === 0) return "";
  const start = hashSeed(seed) % pool.length;
  if (!used) return pool[start];
  for (let n = 0; n < pool.length; n++) {
    const idx = (start + n) % pool.length;
    if (!used.has(idx)) { used.add(idx); return pool[idx]; }
  }
  return pool[start];   // pool exhausted — impossible in practice
}

// Last-resort wording so a sentence still reads if a placeholder can't be
// filled. In practice usablePool() means this never fires — a tied game has
// no winner, and the lines that name one are filtered out before we pick.
const FALLBACKS = {
  winner: "the winning team",
  loser: "the other lot",
  score: "the final score",
  game: "that game",
  name: "somebody",
};

// Narrows a pool to the lines whose placeholders can all be filled from
// `vars`. Deterministic: same vars, same filtered pool, same pick.
export function usablePool(pool, vars = {}) {
  const usable = (pool || []).filter(line =>
    (String(line).match(/\{([a-z]+)\}/g) || [])
      .every(token => vars[token.slice(1, -1)] != null));
  return usable.length ? usable : (pool || []);
}

// Splits a template into plain strings and {placeholder} markers, so the
// caller can decide how to render each one (the name goes bold, the rest
// doesn't). Returns [{ text }] and [{ key, value }] parts in order.
export function templateParts(template, vars = {}) {
  return String(template).split(/(\{[a-z]+\})/g)
    .filter(part => part !== "")
    .map(part => {
      const m = part.match(/^\{([a-z]+)\}$/);
      if (!m) return { text: part };
      const key = m[1];
      // Never render "{winner}" or "undefined" into a sentence a person
      // reads. A neutral word is worse writing but not a visible bug.
      if (vars[key] == null) {
        return FALLBACKS[key] ? { key, value: FALLBACKS[key] } : { text: part };
      }
      return { key, value: String(vars[key]) };
    });
}

// Convenience for tests and any non-React caller.
export function fillTemplate(template, vars = {}) {
  return templateParts(template, vars).map(p => (p.key ? p.value : p.text)).join("");
}

export const POOLS = { SOLO_MISS, GROUP_MISS, LONE_CALL, SWEEP_LINES, NEAR_LINES, SHARP_LINES };
