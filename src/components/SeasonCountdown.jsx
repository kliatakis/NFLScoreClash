import { REGULAR_SEASON_FIXTURES, SEASON, SPECIAL_PICK_TYPES } from "../data/fixtures.js";
import { useCountdown, useSeasonPicksLock } from "../lib/hooks.js";
import { formatKickoff } from "../lib/time.js";
import TeamBadge from "./TeamBadge.jsx";
import { teamTint } from "../data/teams.js";

// Before kickoff the app has nothing to show — no results, no standings
// movement, no highlights — so anyone invited early logs in to blank cards and
// has no reason to come back. This gives the preseason a pulse: how long left,
// what the opening game is, and a nudge about the preseason picks that lock
// the moment the season starts and never reopen.
//
// Disappears entirely once the opener has kicked off; from then on the real
// data carries the page.
// Named in the same words the Predictions tabs use, so the two screens agree.
const PICK_GROUPS = [
  { kind: "division",   label: "Division winners" },
  { kind: "conference", label: "Conference champions" },
  { kind: "superbowl",  label: "Super Bowl winner" },
];

export default function SeasonCountdown({ user, allPredictions, timezone, onGoToPicks }) {
  const countdown = useCountdown(SEASON.openerKickoffUTC);
  // Season picks shut 15 minutes BEFORE kickoff, not at it. The clock below
  // counts to kickoff because that's what its label says — but for that last
  // quarter of an hour the picks section must stop inviting you to do
  // something the Predictions tab will refuse.
  const picksLocked = useSeasonPicksLock();
  if (!countdown) return null; // season under way (or already done)

  const opener = REGULAR_SEASON_FIXTURES.find(f => f.kickoffUTC === SEASON.openerKickoffUTC)
    || REGULAR_SEASON_FIXTURES[0];

  const specials = (allPredictions?.[user.uid] || {}).specials || {};
  const madeCount = SPECIAL_PICK_TYPES.filter(t => specials[t.id]).length;
  const totalSpecials = SPECIAL_PICK_TYPES.length;
  const allMade = madeCount === totalSpecials;

  return (
    <div className="glass card countdown-card" style={{ marginBottom: 24 }}>
      <div className="countdown-label">Kickoff in</div>

      <div className="countdown-clock">
        <span className="countdown-unit"><b>{countdown.days}</b><i>days</i></span>
        <span className="countdown-unit"><b>{String(countdown.hours).padStart(2, "0")}</b><i>hrs</i></span>
        <span className="countdown-unit"><b>{String(countdown.mins).padStart(2, "0")}</b><i>min</i></span>
        <span className="countdown-unit"><b>{String(countdown.secs).padStart(2, "0")}</b><i>sec</i></span>
      </div>

      {opener && (
        <div className="countdown-opener team-tinted" style={teamTint(opener)}>
          <div className="countdown-opener-label">{SEASON.label} opener</div>
          <div className="countdown-opener-teams">
            <TeamBadge code={opener.away} showName />
            <span className="fixture-vs" style={{ padding: 0 }}>@</span>
            <TeamBadge code={opener.home} showName />
          </div>
          <div className="countdown-opener-when">{formatKickoff(opener.kickoffUTC, timezone)}</div>
        </div>
      )}

      {/* Broken out by category rather than a lumped "x of 11". A bare total
          told you nothing about WHAT was being asked for or where to do it —
          this names each thing, shows how far along you are on each, and
          gives you somewhere to go. */}
      <div className="countdown-picks">
        <div className="countdown-picks-title">
          {allMade ? "Your season picks are all in ✓" : "Your season picks"}
        </div>
        <div className="countdown-picks-sub">
          Made once, before kickoff. They lock when the opener starts and can't be changed after.
        </div>

        <div className="countdown-picks-list">
          {PICK_GROUPS.map(g => {
            const total = SPECIAL_PICK_TYPES.filter(t => t.kind === g.kind).length;
            const made = SPECIAL_PICK_TYPES.filter(t => t.kind === g.kind && specials[t.id]).length;
            const done = made === total;
            return (
              <div key={g.kind} className={`countdown-pick-row ${done ? "done" : ""}`}>
                <span className="countdown-pick-name">{done ? "✓" : "○"} {g.label}</span>
                <span className="countdown-pick-bar">
                  <span className="countdown-pick-fill" style={{ width: `${(made / total) * 100}%` }} />
                </span>
                <span className="countdown-pick-count">{made}/{total}</span>
              </div>
            );
          })}
        </div>

        {picksLocked ? (
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--gold)", fontWeight: 700 }}>
            🔒 Season picks are locked — {allMade ? "yours are all in." : `you got ${madeCount} of ${totalSpecials} in.`}
          </div>
        ) : (!allMade && onGoToPicks && (
          <button className="btn btn-primary btn-sm" style={{ marginTop: 14 }} onClick={onGoToPicks}>
            Make your picks →
          </button>
        ))}
      </div>
    </div>
  );
}
