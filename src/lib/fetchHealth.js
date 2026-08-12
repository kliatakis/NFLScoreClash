// ─── FETCHER HEALTH ─────────────────────────────────────────────────────────
//
// WHY THIS EXISTS
// ───────────────
// The results come from ESPN's public scoreboard: undocumented, unsupported,
// free, and under no obligation to keep working. There is no contract and no
// alert. The realistic failure isn't a loud outage — it's ESPN renaming one
// team's abbreviation in October, after which that team's games quietly stop
// matching while every run still reports "success, 0 new results". A Tuesday
// with no games looks exactly the same.
//
// So every run now leaves a record, and this turns it into one of three
// states an admin can read at a glance. The point is to make silence
// distinguishable from breakage.
//
// Pure: takes the stored record and a clock, returns a verdict.

// The cron runs daily. A day and a bit allows for a late run or a slow
// deploy; two days and more means it isn't running at all.
export const STALE_AFTER_MS = 26 * 60 * 60 * 1000;
export const DEAD_AFTER_MS = 50 * 60 * 60 * 1000;

// Skip reasons that mean "we saw a real game and could not place it". These
// are the ones that indicate breakage rather than normal quiet.
export const ALARMING_SKIPS = ["unknown_team_code", "no_matching_fixture", "unmapped_team", "wrong_season_year"];

export function assessFetchHealth(record, now = Date.now()) {
  if (!record || !record.at) {
    return {
      level: "unknown",
      headline: "No fetch recorded yet",
      detail: [
        "Nothing has run, or the run predates this panel.",
        "Use the button above once — it writes the same record the daily job does.",
      ],
    };
  }

  const age = now - record.at;
  const detail = [];
  const ago = describeAge(age);

  if (record.ok === false) {
    return {
      level: "bad",
      headline: `Last run FAILED, ${ago}`,
      detail: [
        record.error || "The provider didn't respond as expected.",
        "Scores can still be entered by hand in the Results tab — nothing is blocked.",
      ],
    };
  }

  if (age > DEAD_AFTER_MS) {
    return {
      level: "bad",
      headline: `No run for ${ago}`,
      detail: [
        "The daily job should run every 24 hours. Check Vercel → Deployments → Cron Jobs.",
        "Until it's back, use the button above after each set of games.",
      ],
    };
  }

  // The interesting case: it ran, it succeeded, and it still couldn't place
  // games it saw. That's what a renamed team code looks like.
  const alarming = ALARMING_SKIPS
    .map(k => [k, record.skipped?.[k] || 0])
    .filter(([, n]) => n > 0);

  if (alarming.length > 0) {
    return {
      level: "warn",
      headline: `Ran ${ago}, but couldn't place ${alarming.reduce((a, [, n]) => a + n, 0)} game(s)`,
      detail: [
        alarming.map(([k, n]) => `${n} × ${k.replace(/_/g, " ")}`).join(", "),
        ...(record.unmatched?.length ? [`Affected: ${record.unmatched.slice(0, 8).join(", ")}`] : []),
        "A team abbreviation on their side may have changed. Check ESPN_ABBR_MAP in src/lib/resultsProviders.js.",
      ],
    };
  }

  if (age > STALE_AFTER_MS) {
    return {
      level: "warn",
      headline: `Last run ${ago}`,
      detail: ["Slightly overdue — the job runs once a day. Worth a look if it doesn't catch up."],
    };
  }

  detail.push(`Checked ${record.checked ?? 0} game(s), wrote ${record.updated ?? 0}.`);
  if (record.lastWriteAt) detail.push(`Last actually wrote a score ${describeAge(now - record.lastWriteAt)}.`);
  if ((record.updated ?? 0) === 0) {
    detail.push("Writing nothing is normal when no games have finished since the last run.");
  }
  return { level: "good", headline: `Healthy — ran ${ago}`, detail };
}

export function describeAge(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "just now";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minute${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
