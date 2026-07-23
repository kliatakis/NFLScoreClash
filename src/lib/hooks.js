import { useState, useEffect } from "react";
import { SEASON } from "../data/fixtures.js";

const LOCK_MINUTES_BEFORE_KICKOFF = 15;

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
      else setStatus({ locked: false, minsLeft: Math.floor(msLeft / 60000) });
    };
    update();
    const id = setInterval(update, 15000);
    return () => clearInterval(id);
  }, [kickoffISO]);
  return status;
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
