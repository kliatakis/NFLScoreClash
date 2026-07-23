// ─── GridClash: Automatic Results Fetcher ─────────────────────────────────
// Uses ESPN's public (unofficial, undocumented, free, no API key) scoreboard
// endpoint instead of a paid provider — this was the exact mistake made on
// the original ScoreClash build: API-Football's free tier excludes the
// current season, so the paid plan was needed. ESPN's endpoint has no such
// restriction and is the de facto standard hobby fantasy-football projects
// use for this. Trade-off: it's not officially documented/supported, so it
// could change or break without notice — the admin's manual "Fetch Latest
// Results" button (calling this same endpoint with ?manual=true) is the
// fallback if the daily cron ever silently stops working.
//
// Never overwrites an existing result. Never touches predictions, users, or
// leagues — only adds new entries to results/{seasonId}.scores.

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { REGULAR_SEASON_FIXTURES, SEASON } from "../src/data/fixtures.js";

if (!getApps().length) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
  initializeApp({ credential: cert(serviceAccount) });
}
const db = getFirestore();
const RESULTS_DOC_ID = `results_${SEASON.year}`;

// ESPN's team abbreviations differ from ours in a couple of spots.
const ESPN_ABBR_MAP = {
  WSH: "WAS",
  JAC: "JAX",
  LA: "LAR",
};
function normalize(abbr) {
  return ESPN_ABBR_MAP[abbr] || abbr;
}

export default async function handler(req, res) {
  const authHeader = req.headers["authorization"];
  const isCronRequest = process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  const isManualRequest = req.query?.manual === "true"; // same-app admin button

  if (!isCronRequest && !isManualRequest) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    // ESPN's scoreboard endpoint defaults to "today" if no ?dates= param is
    // given, in whatever the server's local date is — pass explicit dates
    // to be safe across the whole current week instead of just today, since
    // NFL games span Thu/Sun/Mon (and occasional Wed/Sat/Fri specials).
    const today = new Date();
    const dateParam = [-1, 0, 1, 2, 3].map(offset => {
      const d = new Date(today.getTime() + offset * 86400000);
      return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
    }).join(",");

    const url = `https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?dates=${dateParam}`;
    const response = await fetch(url);
    const data = await response.json();
    const events = Array.isArray(data.events) ? data.events : [];

    const resultsDocRef = db.collection("results").doc(RESULTS_DOC_ID);
    const snap = await resultsDocRef.get();
    const currentScores = snap.exists ? (snap.data().scores || {}) : {};

    let updatedCount = 0;
    const details = [];

    for (const event of events) {
      const comp = event.competitions?.[0];
      const completed = comp?.status?.type?.completed;
      if (!completed) continue;

      const home = comp.competitors.find(c => c.homeAway === "home");
      const away = comp.competitors.find(c => c.homeAway === "away");
      if (!home || !away) continue;

      const homeAbbr = normalize(home.team.abbreviation);
      const awayAbbr = normalize(away.team.abbreviation);
      const homeScore = Number(home.score);
      const awayScore = Number(away.score);

      const match = REGULAR_SEASON_FIXTURES.find(f => f.home === homeAbbr && f.away === awayAbbr);
      if (!match) { details.push({ status: "no_match", homeAbbr, awayAbbr }); continue; }
      if (currentScores[match.id]) { details.push({ status: "already_exists", fixtureId: match.id }); continue; }

      currentScores[match.id] = { homeScore, awayScore, enteredAt: Date.now() };
      updatedCount++;
      details.push({ status: "added", fixtureId: match.id, score: `${awayScore}-${homeScore}` });
    }

    if (updatedCount > 0) {
      await resultsDocRef.set({ scores: currentScores }, { merge: true });
    }

    return res.status(200).json({ success: true, checked: events.length, updated: updatedCount, details });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}
