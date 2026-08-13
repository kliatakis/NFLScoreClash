// ─── ScoreClash: Automatic Results Fetcher ──────────────────────────────────
//
// Thin orchestration only. The two interesting halves live in src/lib/ so
// they're independently readable and testable:
//   resultsProviders.js — talks to a score source, returns normalized games
//   resultsMatching.js  — validates those games and decides what to write
//
// This file just wires them to Firestore. Swapping ESPN for a paid provider
// later means writing one new adapter and changing the `provider` line; the
// validation, matching, and write logic stay exactly as they are.
//
// Current source is ESPN's public (unofficial, undocumented, free, no API
// key) scoreboard endpoint — chosen because the original ScoreClash build hit
// a wall with API-Football, whose free tier excludes the current season. The
// trade-off is that it's unsupported and could change without notice, which
// is why every run now leaves a health record (see below) and the admin has a
// manual button as a fallback.
//
// Guarantees: never overwrites an existing score; only ever adds keys under
// results/{seasonId}.scores — never predictions, users, leagues, or the
// `specials` field in that same document.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SEASON, PLAYOFF_FIXTURES, PRESEASON_FIXTURES } from "../src/data/fixtures.js";
import { espnProvider } from "../src/lib/resultsProviders.js";
import { planResultWrites } from "../src/lib/resultsMatching.js";
import { ALARMING_SKIPS } from "../src/lib/fetchHealth.js";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();
const RESULTS_DOC_ID = `results_${SEASON.year}`;

// Swap this one line to change provider.
const provider = espnProvider;

// One document, overwritten every run. The admin panel reads it to tell
// "nothing has finished since yesterday" apart from "this has been broken for
// three weeks" — which otherwise look identical from the outside.
//
// Written even when the run fails, and even when it writes nothing. That's
// the entire point: a run that leaves no trace is indistinguishable from a
// run that never happened.
async function recordHealth(fields) {
  try {
    await db.collection("health").doc("fetcher").set(fields, { merge: true });
  } catch (err) {
    console.error("Couldn't record fetcher health", err);
  }
}

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"];
  const isCronRequest = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualRequest = req.query?.manual === "true"; // same-app admin button

  if (!isCronRequest && !isManualRequest) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const startedAt = Date.now();

  try {
    const { games, fetchedCount } = await provider.fetchRecentGames();

    const resultsDocRef = db.collection("results").doc(RESULTS_DOC_ID);
    const snap = await resultsDocRef.get();
    const data = snap.exists ? snap.data() : {};
    const currentScores = data.scores || {};

    // Playoff slots an admin has filled in. Without these, postseason games
    // have nothing to match against and are skipped — which is correct before
    // the matchups are known, and is reported rather than hidden.
    const stored = data.playoffFixtures || {};
    const playoffSlots = PLAYOFF_FIXTURES
      .map(f => ({ ...f, ...(stored[f.id] || {}) }))
      .filter(f => f.home && f.away);

    // Preseason games are only ever written while a trial is RUNNING, and only
    // for weeks that haven't been cleared.
    //
    // Both halves matter. The window we ask ESPN for reaches a day back and
    // three forward, so a preseason weekend stays fetchable for days after it
    // was played — long enough that clearing a week the same night saw every
    // score reappear at 06:00 the next morning. Without the trial check the
    // final wipe was just as fragile: clear it on the 29th, and the 30th put
    // August's results back into a table about to start Week 1.
    const trialActive = data.trialActive === true;
    const cleared = new Set(Array.isArray(data.clearedTrialWeeks) ? data.clearedTrialWeeks : []);
    const preseasonSlots = trialActive
      ? PRESEASON_FIXTURES.filter(f => !cleared.has(`pre${f.preWeek}`))
      : [];

    const { writes, details, skipped, updatedCount } = planResultWrites({
      games,
      currentScores,
      seasonYear: SEASON.year,
      playoffSlots,
      preseasonSlots,
    });

    if (updatedCount > 0) {
      if (snap.exists) {
        // Field-path update: touches only these specific score keys, leaving
        // `specials` and everything else in the document alone.
        await resultsDocRef.update(writes);
      } else {
        // Document doesn't exist yet — update() would throw, so seed it.
        const seed = {};
        for (const [path, value] of Object.entries(writes)) {
          seed[path.replace(/^scores\./, "")] = value;
        }
        await resultsDocRef.set({ scores: seed }, { merge: true });
      }

      // One history entry per RUN, not per game. A daily cron across a season
      // is ~150 runs; logging each individual score would drown the handful of
      // entries a human made, which are the ones anyone ever goes looking for.
      //
      // Best-effort, and after the write: the scores are already saved, and a
      // failure to log must never turn a successful fetch into a 500 that the
      // cron then reports as broken.
      try {
        const added = details.filter(d => d.status === "added");
        await db.collection("auditLog").add({
          v: 1,
          at: Date.now(),
          kind: "fetch_results",
          actorUid: "system",
          actorName: isCronRequest ? "Daily auto-fetch" : "Manual fetch",
          leagueId: null,
          global: true,
          summary: `${updatedCount} result${updatedCount === 1 ? "" : "s"} added from ${fetchedCount} checked · `
            + added.slice(0, 6).map(d => `${d.game} ${d.score}`).join(", ")
            + (added.length > 6 ? `, +${added.length - 6} more` : ""),
          detail: { added: added.map(d => ({ fixtureId: d.fixtureId, game: d.game, score: d.score, matchedBy: d.matchedBy })) },
        });
      } catch (logErr) {
        console.error("Couldn't write the history entry for this fetch", logErr);
      }
    }

    // Which games it saw but couldn't place — the detail that turns "0 new
    // results" from reassuring into alarming.
    const unmatched = details
      .filter(d => ALARMING_SKIPS.includes(d.status))
      .map(d => d.game)
      .filter(Boolean);

    await recordHealth({
      at: startedAt,
      ok: true,
      provider: provider.name,
      trigger: isCronRequest ? "cron" : "manual",
      checked: fetchedCount,
      updated: updatedCount,
      playoffSlotsKnown: playoffSlots.length,
      trialActive,
      preseasonSlotsOpen: preseasonSlots.length,
      skipped,
      unmatched,
      error: null,
      // Only advanced when something was actually written, so it survives the
      // many runs that legitimately do nothing.
      ...(updatedCount > 0 ? { lastWriteAt: startedAt } : {}),
    });

    return res.status(200).json({
      success: true,
      provider: provider.name,
      checked: fetchedCount,
      updated: updatedCount,
      skipped,
      details,
    });
  } catch (error) {
    await recordHealth({
      at: startedAt,
      ok: false,
      provider: provider.name,
      trigger: isCronRequest ? "cron" : "manual",
      error: String(error?.message || error).slice(0, 300),
    });
    return res.status(500).json({ success: false, provider: provider.name, error: error.message });
  }
}
