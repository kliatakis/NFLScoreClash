import { useState, useEffect, useRef } from "react";
import { SEASON } from "../data/fixtures.js";

export const LOCK_MINUTES_BEFORE_KICKOFF = 15;

export function useCountdown(targetISO) {
  const [countdown, setCountdown] = useState(null);
  useEffect(() => {
    if (!targetISO) { setCountdown(null); return; }
    const target = new Date(targetISO);
    const update = () => {
      const diff = target - new Date();
      if (diff <= 0) { setCountdown(null); return; }
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setCountdown({ days, hours, mins, secs, diff });
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [targetISO]);
  return countdown;
}

// Game predictions lock 15 minutes before kickoff.
export function useFixtureLock(kickoffISO) {
  const [status, setStatus] = useState(null);
  useEffect(() => {
    if (!kickoffISO) { setStatus({ locked: false, unknown: true }); return; }
    const update = () => {
      const kickoff = new Date(kickoffISO);
      const lockAt = new Date(kickoff.getTime() - LOCK_MINUTES_BEFORE_KICKOFF * 60000);
      const msLeft = lockAt - new Date();
      if (msLeft <= 0) setStatus({ locked: true });
      else setStatus({ locked: false, minsLeft: Math.floor(msLeft / 60000), msLeft });
    };
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, [kickoffISO]);
  return status;
}

// Animates a number up from 0 (or from its previous value) so stat cards
// land with a bit of life instead of snapping into place. Honours the OS-level
// "reduce motion" preference by jumping straight to the final value.
export function useCountUp(target, duration = 900) {
  const numeric = Number.isFinite(Number(target)) ? Number(target) : 0;
  // Both start at 0, NOT at the target. Seeding them with the target meant
  // from === to on the very first effect run, so the number snapped into
  // place and the animation only ever ran on later changes — i.e. it never
  // played on load, which is the one moment it exists for.
  const [display, setDisplay] = useState(0);
  const fromRef = useRef(0);

  useEffect(() => {
    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    const to = numeric;
    if (reduce || from === to || duration <= 0) {
      fromRef.current = to;
      setDisplay(to);
      return;
    }
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      // easeOutCubic — quick to start, gentle to settle
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [numeric, duration]);

  return display;
}

// Slides rows to their new positions when a list reorders, instead of having
// them teleport. Standard FLIP: remember where every row was, let React paint
// the new order, then instantly transform each row back to its old position
// and release it — the browser animates the release.
//
// Returns a ref to attach to the container. Rows are matched by a
// `data-flip-key` attribute, so identity survives reordering. Honours the
// OS-level reduce-motion setting by doing nothing at all.
export function useFlipRows(dependency) {
  const containerRef = useRef(null);
  const positionsRef = useRef(new Map());

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const reduce = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    const rows = Array.from(root.querySelectorAll("[data-flip-key]"));
    const next = new Map();

    for (const row of rows) {
      const key = row.getAttribute("data-flip-key");
      const top = row.offsetTop;
      next.set(key, top);

      if (reduce) continue;
      const prev = positionsRef.current.get(key);
      if (prev == null || prev === top) continue;

      const delta = prev - top;
      row.style.transition = "none";
      row.style.transform = `translateY(${delta}px)`;
      // Force the browser to accept that start position before animating.
      void row.offsetHeight;
      row.style.transition = "transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1)";
      row.style.transform = "";
    }

    positionsRef.current = next;
  }, [dependency]);

  return containerRef;
}

// Preseason picks (division / conference / Super Bowl winners) lock 15
// minutes before the FIRST game of the season, not per-game.
export function useSeasonPicksLock() {
  const [locked, setLocked] = useState(false);
  useEffect(() => {
    const lockAt = new Date(new Date(SEASON.openerKickoffUTC).getTime() - LOCK_MINUTES_BEFORE_KICKOFF * 60000);
    const update = () => setLocked(new Date() >= lockAt);
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, []);
  return locked;
}

// Closes a modal on Escape. Every dialog in the app could be dismissed by
// clicking the backdrop but not by keyboard, which left keyboard and screen
// reader users stuck inside one.
export function useEscapeKey(onEscape) {
  useEffect(() => {
    if (!onEscape) return;
    const onKey = (e) => { if (e.key === "Escape") onEscape(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onEscape]);
}

// Keeps Tab inside an open dialog, and puts focus back where it came from on
// close.
//
// Without this, tabbing out of a confirmation lands you on the page behind it
// — still visible through the backdrop, still clickable by keyboard — so you
// can end up operating the admin panel through a dialog asking whether you're
// sure. That matters most on exactly the screens this app uses dialogs for.
//
// Returns a ref to put on the dialog element.
export function useFocusTrap(active = true) {
  const ref = useRef(null);
  useEffect(() => {
    if (!active) return;
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement;

    const focusable = () => Array.from(node.querySelectorAll(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(el => el.offsetParent !== null);

    const onKey = (e) => {
      if (e.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) { e.preventDefault(); return; }
      const first = items[0], last = items[items.length - 1];
      // Focus sitting outside the dialog entirely (first Tab after opening,
      // or a stray click on the backdrop) gets pulled back in.
      if (!node.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };

    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      // Only restore if the old element is still on the page — a dialog that
      // deleted what opened it would otherwise throw.
      if (previouslyFocused && document.contains(previouslyFocused)) {
        try { previouslyFocused.focus(); } catch { /* not focusable any more */ }
      }
    };
  }, [active]);
  return ref;
}

// Live answer to a CSS media query.
//
// Needed by anything drawn in SVG. A viewBox scales its whole coordinate
// system to fit the element, so a chart authored 720 units wide and rendered
// into a 300px card shrinks EVERYTHING by 0.4 — an 11px axis label lands on
// screen at 4px and a 3px data point at barely one. CSS can't fix that from
// outside, because the units being scaled are inside the picture. The only
// real fix is to author a smaller picture on small screens.
export function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => {
    try { return window.matchMedia?.(query).matches ?? false; } catch { return false; }
  });
  useEffect(() => {
    let mq;
    try { mq = window.matchMedia?.(query); } catch { return; }
    if (!mq) return;
    const on = (e) => setMatches(e.matches);
    setMatches(mq.matches);
    mq.addEventListener?.("change", on);
    return () => mq.removeEventListener?.("change", on);
  }, [query]);
  return matches;
}
