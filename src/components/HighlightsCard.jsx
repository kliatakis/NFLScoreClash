import { useMemo, useState } from "react";
import { fsToggleReaction } from "../firebase.js";
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

// Tier-specific wording. A Clean Sweep should read like an event; a Sharp Week
// like a solid nod. Same template for all three would flatten the difference.
function badgeShout({ badge, users }, week) {
  const who = <b>{joinNames(users)}</b>;
  const many = users.length > 1;
  const pts = <> <b>+{badge.points}</b> points.</>;
  if (badge.id === "sweep") {
    return (
      <>
        {who} went a <b>perfect {badge.games} from {badge.games}</b> in Week {week}
        {many ? " — they both swept it" : " — a Clean Sweep"}!!{pts}
      </>
    );
  }
  if (badge.id === "near") {
    return (
      <>
        {who} {many ? "were" : "was"} one game away from perfection in Week {week} —
        {" "}<b>Near Perfect</b>, {badge.games - 1} from {badge.games}.{pts}
      </>
    );
  }
  return (
    <>
      {who} dropped only two all week — <b>Sharp Week</b> in Week {week},
      {" "}{badge.games - 2} from {badge.games}.{pts}
    </>
  );
}

// A fun "announcement board" for the most recently completed week — week
// accuracy bonuses, long-shot correct calls, and the rare miss on an
// "obvious" result. Renders nothing at all if there's no completed week yet, or
// nothing notable happened (small leagues especially — see computeHighlights).
// The reactions people actually reach for on a results board: nice call,
// clown move, and pure disbelief.
const REACTIONS = ["🔥", "🤡", "😂"];

// One row's reaction strip. Renders from the league doc, which the parent
// already subscribes to, so a tap by anyone shows up for everyone live.
function ReactionBar({ leagueId, rowKey, reactions, uid }) {
  const [busy, setBusy] = useState("");
  const forRow = reactions?.[rowKey] || {};
  // Without a uid there's nobody to attribute a reaction to, and toggling
  // would push `undefined` into the array.
  if (!uid) return null;
  const toggle = async (emoji, isOn) => {
    if (!leagueId || busy) return;
    setBusy(emoji);
    try { await fsToggleReaction(leagueId, rowKey, emoji, uid, isOn); }
    catch (err) { console.error("Reaction failed", err); }
    finally { setBusy(""); }
  };
  return (
    <div className="reaction-bar">
      {REACTIONS.map(emoji => {
        const who = forRow[emoji] || [];
        const mine = who.includes(uid);
        return (
          <button key={emoji} type="button" disabled={!!busy}
            className={`reaction ${mine ? "mine" : ""} ${who.length ? "has" : ""}`}
            aria-pressed={mine} aria-label={`React ${emoji}`}
            onClick={() => toggle(emoji, mine)}>
            <span>{emoji}</span>
            {who.length > 0 && <em>{who.length}</em>}
          </button>
        );
      })}
    </div>
  );
}

export default function HighlightsCard({ league, user, allUsers, allPredictions, results }) {
  // null = follow the latest week automatically; a number = the user picked
  // a specific week from the selector.
  const [pickedWeek, setPickedWeek] = useState(null);

  const { week, weeks, sweeps, upsets, clowns, hiddenCount } = useMemo(
    () => computeHighlights(league, allUsers, allPredictions, results, pickedWeek, getScoringSettings(league)),
    [league, allUsers, allPredictions, results, pickedWeek]
  );

  const recap = useMemo(
    () => computeWeeklyRecap(league, allUsers, allPredictions, results, getScoringSettings(league), pickedWeek),
    [league, allUsers, allPredictions, results, pickedWeek]
  );

  // Live off the league doc the parent already subscribes to.
  const reactions = league?.reactions || {};

  if (!week) return null;
  const nothingHappened = sweeps.length === 0 && upsets.length === 0 && clowns.length === 0;
  // The card used to hide itself when no callouts fired. It no longer does —
  // the recap always has something to say about a completed week, even a
  // quiet one.

  return (
    <div className="glass card" style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        {/* The title said "Week 5 Highlights" while a week selector sat right
            next to it saying "Week 5" — the same fact twice, and neither of
            them said what the section actually is. The name is fixed now and
            the selector carries the week. */}
        <div>
          <div className="card-title" style={{ marginBottom: 0 }}>Announcement Board</div>
          {/* The week still has to be stated when there's only one and the
              selector is hidden. */}
          <div className="board-sub">Week {week} · shoutouts and the week in numbers</div>
        </div>
        {weeks.length > 1 && (
          <select
            className="form-select form-select-sm"
            style={{ maxWidth: 130 }}
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
              <b>{recap.badgeEarners.length}</b>
              <span>week bonus{recap.badgeEarners.length === 1 ? "" : "es"}</span>
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
          Nobody earned a week bonus in Week {week} — three or more misses across the board.
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sweeps.map(s => (
          <div key={`sweep-${s.badge.id}`} className={`highlight-row badge-shout acc-${s.badge.id}`}>
            <b>{league.name}</b>: {s.badge.icon} {badgeShout(s, week)}
            <ReactionBar leagueId={league.id} rowKey={`${week}:sweep:${s.badge.id}`} reactions={reactions} uid={user?.uid} />
          </div>
        ))}
        {upsets.map((h, i) => (
          <div key={`upset-${h.fixture.id}`} className="highlight-row">
            <b>{league.name}</b>: 🔮 <b>{joinNames(h.users)}</b> called the upset in {gameLabel(h.fixture)}!!
            <ReactionBar leagueId={league.id} rowKey={`${week}:upset:${h.fixture.id}`} reactions={reactions} uid={user?.uid} />
          </div>
        ))}
        {clowns.map((h, i) => (
          <div key={`clown-${h.fixture.id}`} className="highlight-row">
            <b>{league.name}</b>: 🤡 <b>{joinNames(h.users)}</b> {h.users.length === 1 ? "was the only one" : "were the only ones"} who didn't predict {gameLabel(h.fixture)} correctly. Did you flip a coin or just close your eyes?
            <ReactionBar leagueId={league.id} rowKey={`${week}:clown:${h.fixture.id}`} reactions={reactions} uid={user?.uid} />
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
