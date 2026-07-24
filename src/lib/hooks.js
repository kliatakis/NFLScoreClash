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
  const [display, setDisplay] = useState(numeric);
  const fromRef = useRef(numeric);

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
