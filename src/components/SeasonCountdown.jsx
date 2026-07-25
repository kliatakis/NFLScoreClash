import { REGULAR_SEASON_FIXTURES, SEASON, SPECIAL_PICK_TYPES } from "../data/fixtures.js";
import { useCountdown } from "../lib/hooks.js";
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
export default function SeasonCountdown({ user, allPredictions, timezone }) {
  const countdown = useCountdown(SEASON.openerKickoffUTC);
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

      <div className={`countdown-picks ${allMade ? "done" : ""}`}>
        <span>
          {allMade
            ? `All ${totalSpecials} season picks in — you're set.`
            : `${madeCount} of ${totalSpecials} season picks made`}
        </span>
        <span className="countdown-bar">
          <span className="countdown-bar-fill" style={{ width: `${(madeCount / totalSpecials) * 100}%` }} />
        </span>
        {!allMade && (
          <span className="countdown-picks-hint">
            Division, conference and Super Bowl picks lock when the opener starts and can't be changed after.
          </span>
        )}
      </div>
    </div>
  );
}
