import { useMemo, useState } from "react";
import { computeHighlights, computeWeeklyRecap, getScoringSettings } from "../lib/scoring.js";
import { TEAMS } from "../data/teams.js";
import TeamBadge from "./TeamBadge.jsx";

const gameLabel = (fixture) => {
  const away = TEAMS[fixture.away], home = TEAMS[fixture.home];
  return `${away ? `${away.city} ${away.name}` : fixture.away} @ ${home ? `${home.city} ${home.name}` : fixture.home}`;
};

const joinNames = (names) => {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

// A fun "announcement board" for the most recently completed week — exact
// score hits, long-shot correct calls, and the rare miss on an "obvious"
// result. Renders nothing at all if there's no completed week yet, or
// nothing notable happened (small leagues especially — see computeHighlights).
export default function HighlightsCard({ league, allUsers, allPredictions, results }) {
  // null = follow the latest week automatically; a number = the user picked
  // a specific week from the selector.
  const [pickedWeek, setPickedWeek] = useState(null);

  const { week, weeks, fire, upsets, clowns, hiddenCount } = useMemo(
    () => computeHighlights(league, allUsers, allPredictions, results, pickedWeek),
    [league, allUsers, allPredictions, results, pickedWeek]
  );

  const recap = useMemo(
    () => computeWeeklyRecap(league, allUsers, allPredictions, results, getScoringSettings(league), pickedWeek),
    [league, allUsers, allPredictions, results, pickedWeek]
  );

  if (!week) return null;
  const nothingHappened = fire.length === 0 && upsets.length === 0 && clowns.length === 0;
  // The card used to hide itself when no callouts fired. It no longer does —
  // the recap always has something to say about a completed week, even a
  // quiet one.

  return (
    <div className="glass card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="card-title" style={{ marginBottom: 0 }}>Week {week} Highlights</div>
        {weeks.length > 1 && (
          <select
            className="form-select"
            style={{ maxWidth: 130, fontSize: 12, padding: "6px 10px" }}
            value={week}
            onChange={e => setPickedWeek(Number(e.target.value))}
          >
            {weeks.map(w => <option key={w} value={w}>Week {w}</option>)}
          </select>
        )}
      </div>
      <div style={{ height: 16 }} />

      {/* The week in numbers, before the individual callouts. */}
      {recap && recap.week === week && (
        <div className="recap">
          <div className="recap-grid">
            <div className="recap-stat">
              <b>{recap.winners.length === 0 ? "—" : recap.winners.map(w => w.username).join(" & ")}</b>
              <span>{recap.winners.length > 1 ? "shared the week" : "won the week"}</span>
            </div>
            <div className="recap-stat">
              <b>{recap.topPoints}</b>
              <span>top score</span>
            </div>
            <div className="recap-stat">
              <b>{recap.average}</b>
              <span>
                average
                {recap.playedCount < recap.players ? ` · ${recap.playedCount} of ${recap.players} played` : ""}
              </span>
            </div>
            <div className="recap-stat">
              <b>{recap.exactCount}</b>
              <span>exact score{recap.exactCount === 1 ? "" : "s"}</span>
            </div>
          </div>

          {(recap.riser || recap.faller) && (
            <div className="recap-movers">
              {recap.riser && (
                <span className="recap-mover up">
                  ▲ <b>{recap.riser.username}</b> climbed {recap.riser.delta} place{recap.riser.delta === 1 ? "" : "s"}
                </span>
              )}
              {recap.faller && (
                <span className="recap-mover down">
                  ▼ <b>{recap.faller.username}</b> dropped {recap.faller.delta} place{recap.faller.delta === 1 ? "" : "s"}
                </span>
              )}
            </div>
          )}

          {(recap.toughest || recap.easiest) && (
            <div className="recap-games">
              {recap.toughest && (
                <div className="recap-game">
                  <span className="recap-game-tag tough">Trickiest</span>
                  <TeamBadge code={recap.toughest.fixture.away} /> @ <TeamBadge code={recap.toughest.fixture.home} />
                  <span className="recap-game-note">
                    {recap.toughest.right} of {recap.toughest.picked} called it
                  </span>
                </div>
              )}
              {recap.easiest && (
                <div className="recap-game">
                  <span className="recap-game-tag easy">Everyone got</span>
                  <TeamBadge code={recap.easiest.fixture.away} /> @ <TeamBadge code={recap.easiest.fixture.home} />
                  <span className="recap-game-note">{recap.easiest.picked} of {recap.easiest.picked}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {nothingHappened && (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Nothing wild happened in Week {week} — no exact scores, no upsets, no howlers.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fire.map((h, i) => (
          <div key={`fire-${i}`} className="highlight-row">
            <b>{league.name}</b>: 🔥 <b>{joinNames(h.users)}</b> predicted the correct score of {gameLabel(h.fixture)} ({h.score})!!
          </div>
        ))}
        {upsets.map((h, i) => (
          <div key={`upset-${i}`} className="highlight-row">
            <b>{league.name}</b>: 🎯 <b>{joinNames(h.users)}</b> called the upset in {gameLabel(h.fixture)}!!
          </div>
        ))}
        {clowns.map((h, i) => (
          <div key={`clown-${i}`} className="highlight-row">
            <b>{league.name}</b>: 🤡 <b>{joinNames(h.users)}</b> {h.users.length === 1 ? "was the only one" : "were the only ones"} who didn't predict {gameLabel(h.fixture)} correctly. Did you flip a coin or just close your eyes?
          </div>
        ))}
      </div>
      {hiddenCount > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
          + {hiddenCount} more {hiddenCount === 1 ? "highlight" : "highlights"} this week not shown
        </div>
      )}
    </div>
  );
}
