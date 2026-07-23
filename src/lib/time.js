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
  { id: "Europe/Athens", label: "Athens / Eastern Europe (EEST/EET)" },
  { id: "Europe/London", label: "London (GMT/BST)" },
  { id: "Europe/Paris", label: "Paris, Berlin, Rome (CEST/CET)" },
  { id: "Europe/Moscow", label: "Moscow (MSK)" },
  { id: "America/New_York", label: "US Eastern (ET)" },
  { id: "America/Chicago", label: "US Central (CT)" },
  { id: "America/Denver", label: "US Mountain (MT)" },
  { id: "America/Los_Angeles", label: "US Pacific (PT)" },
  { id: "America/Sao_Paulo", label: "São Paulo (BRT)" },
  { id: "Asia/Dubai", label: "Dubai (GST)" },
  { id: "Asia/Kolkata", label: "India (IST)" },
  { id: "Asia/Singapore", label: "Singapore / Hong Kong (SGT)" },
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
