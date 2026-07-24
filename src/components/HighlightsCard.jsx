import { useMemo } from "react";
import { computeHighlights } from "../lib/scoring.js";
import { TEAMS } from "../data/teams.js";

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
  const { week, fire, upsets, clowns } = useMemo(
    () => computeHighlights(league, allUsers, allPredictions, results),
    [league, allUsers, allPredictions, results]
  );

  if (!week || (fire.length === 0 && upsets.length === 0 && clowns.length === 0)) return null;

  return (
    <div className="glass card" style={{ marginBottom: 24 }}>
      <div className="card-title">Week {week} Highlights</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {fire.map((h, i) => (
          <div key={`fire-${i}`} className="highlight-row">
            🔥 <b>{joinNames(h.users)}</b> predicted the correct score of {gameLabel(h.fixture)} ({h.score})!!
          </div>
        ))}
        {upsets.map((h, i) => (
          <div key={`upset-${i}`} className="highlight-row">
            🎯 <b>{joinNames(h.users)}</b> called the upset in {gameLabel(h.fixture)}!!
          </div>
        ))}
        {clowns.map((h, i) => (
          <div key={`clown-${i}`} className="highlight-row">
            🤡 <b>{joinNames(h.users)}</b> {h.users.length === 1 ? "was the only one" : "were the only ones"} who didn't predict {gameLabel(h.fixture)} correctly. Did you flip a coin or just close your eyes?
          </div>
        ))}
      </div>
    </div>
  );
}
