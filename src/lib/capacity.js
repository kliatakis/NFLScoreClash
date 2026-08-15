// ─── CAPACITY ───────────────────────────────────────────────────────────────
//
// How close the app is to Firestore's free daily read quota, and how many more
// people it can take before that becomes a problem.
//
// WHY THIS EXISTS
// ───────────────
// Exceeding the free quota does not produce a bill — it produces an OUTAGE.
// Firestore returns RESOURCE_EXHAUSTED and refuses reads for the rest of the
// day, resetting around midnight Pacific. Burn the quota on a Sunday afternoon
// and the standings stop loading until Monday morning, through exactly the
// window everyone cares about. There is no reliable warning email, and the
// console's usage graph only helps if you think to go and look at it.
//
// So the number is computed here instead, from the one thing that drives it.
//
// THIS IS AN ESTIMATE, AND IT IS DERIVED — NOT MEASURED
// ─────────────────────────────────────────────────────
// The Firestore client SDK exposes no read counter, so nothing here can report
// what was actually spent. What it does instead is model the app's OWN
// subscription pattern, which is knowable exactly:
//
//   App.jsx opens a live listener on the whole `users` collection and another
//   on the whole `predictions` collection. Both are read in full on every app
//   open, by every client. That is the entire cost driver, and it is why the
//   total is quadratic in headcount rather than linear: N people each reading
//   N+N documents.
//
// The consequence worth understanding: cost scales with the number of
// REGISTERED ACCOUNTS, not with the size of any one league. Two leagues of
// fifty cost the same as one league of a hundred, because neither listener is
// league-scoped.
//
// If those subscriptions ever change, FIXED_READS_PER_OPEN and readsPerOpen
// must change with them or this panel will quietly start lying — which would
// be worse than not having it. That is the maintenance cost of the feature and
// it is accepted deliberately.

export const FREE_READS_PER_DAY = 50000;
export const FREE_WRITES_PER_DAY = 20000;

// Everything read per app open BESIDES the two whole-collection listeners:
// the league query, the user's own profile, the results document (which
// several components listen to separately), plus the handful a tab opens when
// it mounts. Counted generously — a number that flatters the app would defeat
// the point.
export const FIXED_READS_PER_OPEN = 10;

// How many times a day a typical member opens the app. Sundays are far busier
// than Tuesdays; this is the average that matters over a week.
export const TYPICAL_OPENS_PER_PERSON = 5;

export function readsPerOpen(accounts, predictionDocs = accounts) {
  return Math.max(0, accounts) + Math.max(0, predictionDocs) + FIXED_READS_PER_OPEN;
}

// Returns the whole picture in one object so the panel renders it without
// doing arithmetic of its own.
export function assessCapacity({
  accounts = 0,
  predictionDocs = accounts,
  opensPerPerson = TYPICAL_OPENS_PER_PERSON,
} = {}) {
  const perOpen = readsPerOpen(accounts, predictionDocs);
  const opensPerDay = Math.floor(FREE_READS_PER_DAY / perOpen);
  const expectedDaily = accounts * opensPerPerson * perOpen;
  const usedPct = Math.round((expectedDaily / FREE_READS_PER_DAY) * 100);

  // The largest headcount that still fits, solved rather than guessed:
  // n * opens * (2n + fixed) <= FREE  →  2*opens*n² + fixed*opens*n - FREE <= 0
  const a = 2 * opensPerPerson, b = FIXED_READS_PER_OPEN * opensPerPerson;
  const maxAccounts = Math.floor((-b + Math.sqrt(b * b + 4 * a * FREE_READS_PER_DAY)) / (2 * a));

  const level = usedPct >= 90 ? "bad" : usedPct >= 50 ? "warn" : "good";

  return {
    accounts, predictionDocs, perOpen, opensPerDay, expectedDaily, usedPct,
    maxAccounts, roomFor: Math.max(0, maxAccounts - accounts), level,
    headline:
      level === "good" ? `Comfortable — about ${usedPct}% of the daily free read quota`
      : level === "warn" ? `Getting busy — about ${usedPct}% of the daily free read quota`
      : `At the limit — about ${usedPct}% of the daily free read quota`,
  };
}

// Writes are never the constraint, but saying so explicitly is worth more than
// leaving someone to wonder. A full week of picks is one write per person per
// game; even at a hundred people that is a rounding error against 20,000.
export function assessWrites(accounts, gamesPerWeek = 16) {
  const weekly = accounts * gamesPerWeek;
  return { weekly, daily: Math.round(weekly / 7), limit: FREE_WRITES_PER_DAY };
}
