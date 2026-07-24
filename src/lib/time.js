// ─── TIMEZONE-AWARE KICKOFF FORMATTING ──────────────────────────────────────
//
// Every kickoff is stored as a UTC ISO string (see data/fixtures.js) precisely
// so it can be displayed correctly in any local timezone, DST included.
// Default display zone is "Europe/Athens" (Kostas asked for EEST) — using the
// real IANA zone rather than a fixed "+3" offset means it automatically shows
// EEST in summer and EET in winter, which a hardcoded offset could not do.
// Users can override this from Settings (see ProfileDropdown.jsx); the choice
// is stored on their account (users/{uid}.timezone), not per-device.

export const DEFAULT_TIMEZONE = "Europe/Athens";

// A curated list, not the full IANA database — enough spread to cover most
// leagues without turning the settings dropdown into an unusable 400-entry list.
export const COMMON_TIMEZONES = [
  { id: "Europe/Athens", label: "Athens (EEST/EET)" },
  { id: "Europe/London", label: "London (GMT/BST)" },
  { id: "Europe/Paris", label: "Central Europe (CEST/CET)" },
  { id: "Europe/Moscow", label: "Moscow (MSK)" },
  { id: "America/New_York", label: "US Eastern (ET)" },
  { id: "America/Chicago", label: "US Central (CT)" },
  { id: "America/Denver", label: "US Mountain (MT)" },
  { id: "America/Los_Angeles", label: "US Pacific (PT)" },
  { id: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { id: "Asia/Dubai", label: "Dubai (GST)" },
  { id: "Asia/Kolkata", label: "India (IST)" },
  { id: "Asia/Singapore", label: "Singapore / HK (SGT)" },
  { id: "Asia/Tokyo", label: "Tokyo / Seoul (JST)" },
  { id: "Australia/Sydney", label: "Sydney (AEST/AEDT)" },
  { id: "Pacific/Auckland", label: "Auckland (NZST/NZDT)" },
  { id: "UTC", label: "UTC" },
];

// Full: "Sun, Sep 13 · 8:00 PM EEST"
export function formatKickoff(kickoffUTC, timezone = DEFAULT_TIMEZONE) {
  if (!kickoffUTC) return "Date/time TBD";
  try {
    const d = new Date(kickoffUTC);
    const datePart = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, weekday: "short", month: "short", day: "numeric",
    }).format(d);
    const timePart = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short",
    }).format(d);
    return `${datePart} · ${timePart}`;
  } catch {
    return new Date(kickoffUTC).toUTCString();
  }
}

// Compact: "8:00 PM EEST" — for tight spaces like fixture card rows.
export function formatKickoffTime(kickoffUTC, timezone = DEFAULT_TIMEZONE) {
  if (!kickoffUTC) return "TBD";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone, hour: "numeric", minute: "2-digit", timeZoneName: "short",
    }).format(new Date(kickoffUTC));
  } catch {
    return new Date(kickoffUTC).toUTCString();
  }
}

// ─── LOCK COUNTDOWN URGENCY ──────────────────────────────────────────────────
// Shared by per-game locks (Predictions tab) and the season-picks lock
// (Division/Conference/Super Bowl) so both use identical thresholds/colors:
// green with a full day+ to go, orange inside a day, red inside the last
// six hours. Maps to the .lock-badge.open / .warn / .urgent CSS classes.
export function lockUrgency(msLeft) {
  if (msLeft == null) return "open";
  const hours = msLeft / 3600000;
  if (hours >= 24) return "open";
  if (hours >= 6) return "warn";
  return "urgent";
}

// "2d 4h", "5h 12m", "38m" — compact enough for a badge.
export function formatDuration(ms) {
  if (ms == null || ms <= 0) return "0m";
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}
