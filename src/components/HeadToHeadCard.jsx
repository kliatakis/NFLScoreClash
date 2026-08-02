import { useMemo, useState } from "react";
import { headToHead, getScoringSettings, pickWinner } from "../lib/scoring.js";
import Avatar from "./Avatar.jsx";
import TeamBadge from "./TeamBadge.jsx";
import { teamTint } from "../data/teams.js";

// Which side the pick backed. Used to read a scoreline, which no longer
// exists — a winner-only pick has no numbers to print.
const pickText = (pick, fixture) => {
  const side = pickWinner(pick);
  if (!side) return "No pick";
  return side === "T" ? "Tie" : side === "H" ? fixture.home : fixture.away;
};

export default function HeadToHeadCard({ league, user, allUsers, allPredictions, results }) {
  const scoring = getScoringSettings(league);
  const opponents = (league.members || []).filter(uid => uid !== user.uid);
  const [chosenId, setChosenId] = useState(null);

  // Derived rather than stored, so the selection can't go stale: if the chosen
  // opponent leaves the league it falls back to someone who's still here, and
  // if you were the only member when this mounted it picks up the first person
  // to join instead of staying permanently empty.
  const opponentId = opponents.includes(chosenId) ? chosenId : (opponents[0] || null);

  const h2h = useMemo(
    () => (opponentId ? headToHead(user.uid, opponentId, allUsers, allPredictions, results, scoring) : null),
    [user.uid, opponentId, allUsers, allPredictions, results, league]
  );

  if (opponents.length === 0) {
    return (
      <div className="glass card">
        <div className="empty-state">
          {/* Not 🤝 — that now means "correctly called a tie" in the scoring
              tables, and reusing it here would blur the two. */}
          <div className="empty-state-icon">🥊</div>
          <div className="empty-state-title">Nobody to compare against yet</div>
          <div className="empty-state-sub">Share your league code — once someone joins, you can go head to head with them here.</div>
        </div>
      </div>
    );
  }
  if (!h2h) return null;

  const { usernameA, usernameB, pointsA, pointsB, correctA, correctB, winsA, winsB, differences } = h2h;
  const lead = pointsA - pointsB;

  return (
    <div>
      <div className="glass card" style={{ marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Head to Head</div>
          <select className="form-select" style={{ maxWidth: 200, fontSize: 12.5, padding: "6px 10px" }}
            value={opponentId} onChange={e => setChosenId(e.target.value)}>
            {opponents.map(uid => (
              <option key={uid} value={uid}>vs {allUsers[uid]?.username || "Unknown"}</option>
            ))}
          </select>
        </div>

        <div className="h2h-head">
          <div className="h2h-side">
            <Avatar user={allUsers[user.uid]} size={44} />
            <div className="h2h-name you">{usernameA}</div>
          </div>
          <div className="h2h-score">
            <div className="h2h-points">{pointsA} <span className="h2h-dash">–</span> {pointsB}</div>
            <div className="h2h-verdict">
              {lead === 0 ? "Dead level" : lead > 0 ? `You lead by ${lead}` : `Behind by ${Math.abs(lead)}`}
            </div>
          </div>
          <div className="h2h-side">
            <Avatar user={allUsers[opponentId]} size={44} />
            <div className="h2h-name">{usernameB}</div>
          </div>
        </div>

        <div className="h2h-stats">
          <div className="h2h-stat"><b>{winsA}</b><span>games won outright</span><b>{winsB}</b></div>
          <div className="h2h-stat"><b>{correctA}</b><span>correct picks</span><b>{correctB}</b></div>
          <div className="h2h-stat"><b>{differences.length}</b><span>games you differed on</span><b>{differences.length}</b></div>
        </div>
      </div>

      <div className="glass card">
        <div className="card-title">Where You Differed</div>
        {differences.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--muted)" }}>
            No completed games where your picks differed yet — identical picks are left out, since they
            don't separate you.
          </div>
        ) : (
          differences.slice(0, 25).map(d => (
            <div key={d.fixture.id} className="h2h-row team-tinted" style={teamTint(d.fixture)}>
              <div className="h2h-row-game">
                <TeamBadge code={d.fixture.away} /> @ <TeamBadge code={d.fixture.home} />
                <span className="h2h-final">Final {d.result.awayScore}–{d.result.homeScore}</span>
              </div>
              <div className="h2h-row-picks">
                <span className={`h2h-pick ${d.winner === "a" ? "won" : d.winner === "tie" ? "" : "lost"}`}>
                  {pickText(d.pickA, d.fixture)} <em>+{d.pointsA}</em>
                </span>
                <span className={`h2h-pick ${d.winner === "b" ? "won" : d.winner === "tie" ? "" : "lost"}`}>
                  {pickText(d.pickB, d.fixture)} <em>+{d.pointsB}</em>
                </span>
              </div>
            </div>
          ))
        )}
        {differences.length > 25 && (
          <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
            Showing the 25 most recent of {differences.length}.
          </div>
        )}
      </div>
    </div>
  );
}
