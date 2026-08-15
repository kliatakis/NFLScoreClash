import { useMemo, useState } from "react";
import { fsToggleReaction } from "../firebase.js";
import {
  computeHighlights, computeWeeklyRecap, getScoringSettings, resultWinner,
  MIN_LEAGUE_SIZE_FOR_HIGHLIGHTS,
} from "../lib/scoring.js";
import { weekLabel, isTrialWeek } from "../data/fixtures.js";
import { TEAMS } from "../data/teams.js";
import { pickLine, templateParts, usablePool } from "../lib/shoutouts.js";
import {
  SOLO_MISS, GROUP_MISS, LONE_CALL, SWEEP_LINES, NEAR_LINES, SHARP_LINES,
} from "../data/roasts.js";
import TeamBadge from "./TeamBadge.jsx";

const teamName = (code) => (TEAMS[code] ? `${TEAMS[code].city} ${TEAMS[code].name}` : code);

const gameLabel = (fixture) => `${teamName(fixture.away)} @ ${teamName(fixture.home)}`;

// Who actually won, for the lines that name the teams. A tie has no winner,
// so those placeholders fall back to literal text rather than inventing one.
function gameVars(fixture, result) {
  const side = result ? resultWinner(result) : null;
  const vars = {
    game: gameLabel(fixture),
    score: result && result.awayScore != null && result.homeScore != null
      ? `${result.awayScore}-${result.homeScore}` : null,
  };
  if (side === "H") { vars.winner = teamName(fixture.home); vars.loser = teamName(fixture.away); }
  else if (side === "A") { vars.winner = teamName(fixture.away); vars.loser = teamName(fixture.home); }
  return vars;
}

const joinNames = (names) => {
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
};

// Renders one line from a pool, with {name} in bold and everything else
// plain — matching how these read before, when they were hardcoded.
function Shout({ template, vars }) {
  return (
    <>
      {templateParts(template, vars).map((p, i) =>
        p.key === "name" ? <b key={i}>{p.value}</b> : <span key={i}>{p.key ? p.value : p.text}</span>
      )}
    </>
  );
}

// Which pool a week bonus draws from. Kept tier-specific: a Clean Sweep
// should read like an event and a Sharp Week like a solid nod, and one shared
// pool would flatten the difference.
const BADGE_POOLS = { sweep: SWEEP_LINES, near: NEAR_LINES, sharp: SHARP_LINES };

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

  // Draws a line for one row, remembering what this week already used so two
  // rows can't land on the same joke — which is the whole reason the pools
  // exist. Rebuilt on every render, but the result is identical every time:
  // the pick is a hash of the row, and rows render in a fixed order.
  const usedPerPool = new Map();
  const draw = (poolKey, pool, seed) => {
    if (!usedPerPool.has(poolKey)) usedPerPool.set(poolKey, new Set());
    return pickLine(pool, seed, usedPerPool.get(poolKey));
  };
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
          <div className="board-sub">{weekLabel(week)} · shoutouts and the week in numbers</div>
        </div>
        {weeks.length > 1 && (
          <select aria-label="Which week to show on the board"
            className="form-select form-select-sm"
            style={{ maxWidth: 130 }}
            value={week}
            onChange={e => setPickedWeek(isTrialWeek(e.target.value) ? e.target.value : Number(e.target.value))}
          >
            {weeks.map(w => <option key={w} value={w}>{weekLabel(w)}</option>)}
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
          Nobody earned a week bonus in {weekLabel(week)} — three or more misses across the board.
          {/* The upset and clown callouts need a crowd to mean anything, so
              they're gated on league size. Without this line a four-person
              league just sees them stop appearing and has no idea why —
              which reads like the feature is broken. */}
          {(league?.members?.length || 0) < MIN_LEAGUE_SIZE_FOR_HIGHLIGHTS && (
            <> Upset and clown shoutouts need at least {MIN_LEAGUE_SIZE_FOR_HIGHLIGHTS} people in
              the league — you have {league?.members?.length || 0}.</>
          )}
        </div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {sweeps.map(s => (
          <div key={`sweep-${s.badge.id}`} className={`highlight-row badge-shout acc-${s.badge.id}`}>
            <b>{league.name}</b>: {s.badge.icon}{" "}
            <Shout
              template={draw(`badge:${s.badge.id}`, BADGE_POOLS[s.badge.id] || SHARP_LINES,
                `${league.id}:${week}:${s.badge.id}:${s.users.join("|")}`)}
              vars={{
                name: joinNames(s.users), week,
                games: s.badge.games, correct: s.badge.games - s.badge.misses,
                points: s.badge.points,
              }}
            />
            <ReactionBar leagueId={league.id} rowKey={`${week}:sweep:${s.badge.id}`} reactions={reactions} uid={user?.uid} />
          </div>
        ))}
        {upsets.map(h => {
          const vars = { name: joinNames(h.users), ...gameVars(h.fixture, results[h.fixture.id]) };
          return (
            <div key={`upset-${h.fixture.id}`} className="highlight-row">
              <b>{league.name}</b>: 🔮{" "}
              <Shout
                template={draw("lone", usablePool(LONE_CALL, vars),
                  `${league.id}:${week}:upset:${h.fixture.id}:${h.users.join("|")}`)}
                vars={vars}
              />
              <ReactionBar leagueId={league.id} rowKey={`${week}:upset:${h.fixture.id}`} reactions={reactions} uid={user?.uid} />
            </div>
          );
        })}
        {clowns.map(h => {
          const vars = { name: joinNames(h.users), ...gameVars(h.fixture, results[h.fixture.id]) };
          const pool = h.users.length === 1 ? SOLO_MISS : GROUP_MISS;
          return (
            <div key={`clown-${h.fixture.id}`} className="highlight-row">
              <b>{league.name}</b>: 🤡{" "}
              <Shout
                template={draw("miss", usablePool(pool, vars),
                  `${league.id}:${week}:clown:${h.fixture.id}:${h.users.join("|")}`)}
                vars={vars}
              />
              <ReactionBar leagueId={league.id} rowKey={`${week}:clown:${h.fixture.id}`} reactions={reactions} uid={user?.uid} />
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <div style={{ fontSize: 11.5, color: "var(--muted)", marginTop: 10, textAlign: "center" }}>
          + {hiddenCount} more {hiddenCount === 1 ? "highlight" : "highlights"} this week not shown
        </div>
      )}
    </div>
  );
}
