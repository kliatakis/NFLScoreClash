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
// trade-off is that it's unsupported and could change without notice, hence
// the admin's manual "Fetch Latest Results" button as a fallback and the
// per-game reporting below so a silent breakage is diagnosable.
//
// Guarantees: never overwrites an existing score; only ever adds keys under
// results/{seasonId}.scores — never predictions, users, leagues, or the
// `specials` field in that same document.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { SEASON } from "../src/data/fixtures.js";
import { espnProvider } from "../src/lib/resultsProviders.js";
import { planResultWrites } from "../src/lib/resultsMatching.js";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();
const RESULTS_DOC_ID = `results_${SEASON.year}`;

// Swap this one line to change provider.
const provider = espnProvider;

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"];
  const isCronRequest = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualRequest = req.query?.manual === "true"; // same-app admin button

  if (!isCronRequest && !isManualRequest) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const { games, fetchedCount } = await provider.fetchRecentGames();

    const resultsDocRef = db.collection("results").doc(RESULTS_DOC_ID);
    const snap = await resultsDocRef.get();
    const currentScores = snap.exists ? (snap.data().scores || {}) : {};

    const { writes, details, skipped, updatedCount } = planResultWrites({
      games,
      currentScores,
      seasonYear: SEASON.year,
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

    return res.status(200).json({
      success: true,
      provider: provider.name,
      checked: fetchedCount,
      updated: updatedCount,
      skipped,
      details,
    });
  } catch (error) {
    return res.status(500).json({ success: false, provider: provider.name, error: error.message });
  }
}
