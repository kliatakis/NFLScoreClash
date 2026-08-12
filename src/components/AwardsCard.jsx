import { useMemo } from "react";
import { computeSeasonAwards, isSeasonComplete, awardsProgress } from "../lib/awards.js";
import { getScoringSettings } from "../lib/scoring.js";

// The season's closing ceremony.
//
// Visible all season rather than only at the end — half the fun is watching
// who currently holds "Howler of the Season" and trying not to take it off
// them. The heading says whether it's settled.
export default function AwardsCard({ league, allUsers, allPredictions, results, specialResults }) {
  const awards = useMemo(
    () => computeSeasonAwards(league, allUsers, allPredictions, results, specialResults, getScoringSettings(league)),
    [league, allUsers, allPredictions, results, specialResults]);

  const done = isSeasonComplete(results);
  const { played, total } = awardsProgress(results);

  if (awards.length === 0) {
    return (
      <div className="glass card">
        <div className="card-title">Season Awards</div>
        <div className="empty-state" style={{ padding: "24px 0" }}>
          <div className="empty-state-icon">🏆</div>
          <div className="empty-state-title">Nothing to hand out yet</div>
          <div className="empty-state-sub">
            Awards appear as results come in — the first ones show up after a week or two.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass card">
      <div className="card-title" style={{ marginBottom: 4 }}>
        {done ? "Season Awards" : "Season Awards — as it stands"}
      </div>
      <div className="board-sub" style={{ marginBottom: 16 }}>
        {done
          ? "The Super Bowl is in. This is final."
          : `${played} of ${total} regular-season games played — everything below can still change.`}
      </div>

      <div className="awards-grid">
        {awards.map(a => (
          <div key={a.id} className={`award ${a.tone}`}>
            <span className="award-icon" aria-hidden="true">{a.icon}</span>
            <div className="award-body">
              <div className="award-label">{a.label}</div>
              <div className="award-winner">{a.winner}</div>
              <div className="award-detail">{a.detail}</div>
            </div>
          </div>
        ))}
      </div>

      {/* An award nobody earned isn't shown at all — see lib/awards.js. Saying
          so stops the list looking arbitrary when it's shorter some weeks. */}
      <p style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 14, lineHeight: 1.5 }}>
        Only awards somebody has actually earned appear. A season with no ties has no Tie
        Whisperer, and nobody wins Call of the Season until somebody calls one alone.
      </p>
    </div>
  );
}
