import { useState, useEffect, useMemo } from "react";
import { fsGetAllUsers, fsSubscribeAllPredictions, fsSubscribeResults, fsSubscribeFetchHealth } from "../firebase.js";
import { assessCapacity, assessWrites, FREE_READS_PER_DAY, TYPICAL_OPENS_PER_PERSON } from "../lib/capacity.js";
import { assessFetchHealth } from "../lib/fetchHealth.js";
import { SCORABLE_FIXTURES, isPreseasonFixture } from "../data/fixtures.js";

// Admin-only: how much room is left, and whether the moving parts are moving.
//
// Deliberately adds NO new Firestore cost of its own. Accounts come from a
// one-shot read (they change when somebody signs up, not while you watch), and
// everything else reuses subscriptions the panel already has open. A capacity
// gauge that itself consumed the quota would be a poor joke.
export default function AppHealthPanel() {
  const [accounts, setAccounts] = useState(null);
  const [allPredictions, setAllPredictions] = useState({});
  const [results, setResults] = useState({});
  const [health, setHealth] = useState(null);
  const [opens, setOpens] = useState(TYPICAL_OPENS_PER_PERSON);

  // A failed read must not look like a slow one. Leaving `accounts` null on
  // error left the panel showing "Reading the numbers…" for ever, which reads
  // as a hang rather than as the error it is.
  const [loadError, setLoadError] = useState("");
  useEffect(() => {
    fsGetAllUsers()
      .then(u => setAccounts(Object.keys(u).length))
      .catch(err => { console.error("Couldn't count accounts", err); setLoadError(err?.message || "Couldn't read the account list."); });
  }, []);
  useEffect(() => fsSubscribeAllPredictions(setAllPredictions), []);
  useEffect(() => fsSubscribeResults(setResults), []);
  useEffect(() => fsSubscribeFetchHealth(setHealth), []);

  const predictionDocs = Object.keys(allPredictions).length;
  const cap = useMemo(
    () => assessCapacity({ accounts: accounts ?? 0, predictionDocs, opensPerPerson: opens }),
    [accounts, predictionDocs, opens]);
  const writes = assessWrites(accounts ?? 0);
  const fetcher = useMemo(() => assessFetchHealth(health), [health]);

  const picks = useMemo(() => {
    let total = 0, trial = 0;
    for (const p of Object.values(allPredictions)) {
      for (const id of Object.keys(p?.picks || {})) { total++; if (isPreseasonFixture(id)) trial++; }
    }
    return { total, trial };
  }, [allPredictions]);

  const scores = Object.keys(results).length;
  const trialScores = Object.keys(results).filter(isPreseasonFixture).length;

  if (loadError) {
    return <div className="error-msg">Couldn't work out capacity: {loadError}</div>;
  }
  if (accounts == null) {
    return <div style={{ color: "var(--muted)", fontSize: 14 }}>Reading the numbers…</div>;
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--muted)", marginBottom: 14, lineHeight: 1.55 }}>
        Going over Firebase's free daily read limit doesn't produce a bill — it produces an outage.
        Reads stop for the rest of the day and resume around 10:00 your time. There's no warning
        email, so the number lives here instead.
      </p>

      <div className={`fetch-health ${cap.level}`}>
        <span className="fetch-health-icon" aria-hidden="true">
          {cap.level === "good" ? "🟢" : cap.level === "warn" ? "🟡" : "🔴"}
        </span>
        <div className="fetch-health-body">
          <div className="fetch-health-head">{cap.headline}</div>
          <div className="fetch-health-line">
            <b>{cap.accounts}</b> account{cap.accounts === 1 ? "" : "s"} ·
            about <b>{cap.perOpen}</b> reads each time somebody opens the app ·
            roughly <b>{cap.expectedDaily.toLocaleString()}</b> of {FREE_READS_PER_DAY.toLocaleString()} a day
          </div>
          <div className="fetch-health-line">
            {cap.roomFor > 0
              ? <>Room for about <b>{cap.roomFor}</b> more {cap.roomFor === 1 ? "person" : "people"} before the free tier runs out (around <b>{cap.maxAccounts}</b> in total).</>
              : <>Already past what the free tier comfortably carries — switch the Firebase project to the pay-as-you-go plan, where this costs pennies a month.</>}
          </div>
          <div style={{ marginTop: 9, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, color: "var(--muted)" }}>Assuming each person opens it</span>
            <select aria-label="How often each person opens the app"
              className="form-select form-select-sm" style={{ maxWidth: 110 }}
              value={opens} onChange={e => setOpens(Number(e.target.value))}>
              {[2, 3, 5, 8, 12].map(n => <option key={n} value={n}>{n}×/day</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="backup-block" style={{ marginTop: 16 }}>
        <div className="form-label">Why it grows the way it does</div>
        <p className="backup-note">
          Every open reads every account and every player's picks, so the cost rises with the SQUARE
          of the number of people — twice the members is four times the reads. It counts registered
          accounts rather than league members: two leagues of twenty cost the same as one of forty.
          These are estimates from how the app loads its data, not measured usage — Firestore doesn't
          expose a counter to the app. Firebase Console → Firestore → Usage has the real graph.
        </p>
      </div>

      <div className="backup-block" style={{ marginTop: 16 }}>
        <div className="form-label">What's stored</div>
        <div className="fetch-health-line">
          <b>{scores}</b> of {SCORABLE_FIXTURES.length} games scored
          {trialScores > 0 && <> · <b>{trialScores}</b> of them preseason trial</>}
        </div>
        <div className="fetch-health-line">
          <b>{picks.total}</b> picks stored across <b>{predictionDocs}</b> player{predictionDocs === 1 ? "" : "s"}
          {picks.trial > 0 && <> · <b>{picks.trial}</b> of them on trial games</>}
        </div>
        {(trialScores > 0 || picks.trial > 0) && (
          <p className="backup-note" style={{ marginTop: 8 }}>
            Trial data still counts towards the standings. Clear it in Preseason Trial before Week 1.
          </p>
        )}
        <div className="fetch-health-line" style={{ marginTop: 6 }}>
          Writes are never the limit: about <b>{writes.weekly.toLocaleString()}</b> a week across
          a full slate, against {writes.limit.toLocaleString()} a day.
        </div>
      </div>

      <div className="backup-block" style={{ marginTop: 16 }}>
        <div className="form-label">Results fetcher</div>
        <div className="fetch-health-head">{fetcher.headline}</div>
        {fetcher.detail?.map((line, i) => (
          <div key={i} className="fetch-health-line">{line}</div>
        ))}
        <p className="backup-note" style={{ marginTop: 8 }}>
          The full panel and the manual button are in the Results tab.
        </p>
      </div>
    </div>
  );
}
