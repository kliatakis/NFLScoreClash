import { useMemo, useState } from "react";
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
  // null = follow the latest week automatically; a number = the user picked
  // a specific week from the selector.
  const [pickedWeek, setPickedWeek] = useState(null);

  const { week, weeks, fire, upsets, clowns } = useMemo(
    () => computeHighlights(league, allUsers, allPredictions, results, pickedWeek),
    [league, allUsers, allPredictions, results, pickedWeek]
  );

  if (!week) return null;
  const nothingHappened = fire.length === 0 && upsets.length === 0 && clowns.length === 0;
  // With only one week of results and nothing notable in it, there's no card
  // worth showing at all. Once there's history, keep it so the week selector
  // stays reachable.
  if (nothingHappened && weeks.length < 2) return null;

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
    </div>
  );
}
