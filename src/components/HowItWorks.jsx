import { DEFAULT_SCORING, WEEK_BADGES } from "../lib/scoring.js";
import { useEscapeKey } from "../lib/hooks.js";

// A short explainer for people who just got handed a league code and have no
// idea how any of this scores. Deliberately generic — it describes the rules
// and shows the DEFAULT point values, noting that each league can change
// them (the live values for a specific league are shown under its standings).
export default function HowItWorks({ onClose }) {
  useEscapeKey(onClose);
  return (
    <div className="modal-overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="How ScoreClash works">
      <div className="modal" style={{ maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">How ScoreClash Works</div>
        <p className="modal-sub">The whole game in about a minute.</p>

        <div className="howto-section">
          <div className="howto-heading">1 · Tap a winner</div>
          <p>
            One tap per game — the away team, the home team, or the narrow <b>TIE</b> strip between
            them. It saves the moment you tap; tap the same side again to undo. A whole week takes
            about fifteen seconds. Ties are rare enough (about one a season) that calling one
            correctly is worth several times a normal pick.
          </p>
          <p style={{ marginTop: 6 }}>
            Picks are yours, not per-league: tap once and it counts in every league you're in.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">2 · Picks lock before kickoff</div>
          <p>
            Each game locks 15 minutes before it starts, and you'll see a countdown that turns
            green → orange → red as that approaches. Once it's locked, that's your answer.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">3 · How points work</div>
          <div className="scoring-summary">
            <div className="scoring-row"><span>Correct winner</span><span className="scoring-pts">{DEFAULT_SCORING.correctPoints} pt</span></div>
            <div className="scoring-row"><span>🤝 Correctly called a tie</span><span className="scoring-pts">{DEFAULT_SCORING.tiePoints} pts</span></div>
            <div className="scoring-row"><span>Division winner</span><span className="scoring-pts">{DEFAULT_SCORING.divisionPoints} pts</span></div>
            <div className="scoring-row"><span>Conference champion</span><span className="scoring-pts">{DEFAULT_SCORING.conferencePoints} pts</span></div>
            <div className="scoring-row"><span>Super Bowl champion</span><span className="scoring-pts">{DEFAULT_SCORING.superbowlPoints} pts</span></div>
          </div>
          <p style={{ marginTop: 8, fontSize: 11.5, opacity: 0.75 }}>
            These are the defaults — a league admin can change them. Your league's actual
            values are always shown underneath its standings table.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">4 · Nail a whole week for a bonus</div>
          <p style={{ marginBottom: 8 }}>
            This is where the real points are. Get through a week with almost nothing wrong and
            you earn a badge plus bonus points — kept for the season.
          </p>
          <div className="scoring-summary">
            {WEEK_BADGES.map(b => (
              <div key={b.id} className="scoring-row">
                <span>{b.icon} <b>{b.label}</b> — {b.blurb}</span>
                <span className="scoring-pts">+{DEFAULT_SCORING[b.bonusKey]}</span>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 8, fontSize: 11.5, opacity: 0.75 }}>
            Counted in <b>misses</b>, not a fixed number correct — weeks run from 13 to 16 games
            because of bye weeks, so a clean sweep means every game in that particular week. You
            have to pick the whole week to qualify, and bonuses are regular season only.
            They're settled once the last game of the week is in, so don't expect one on
            Thursday night.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">5 · Season picks are worth the most</div>
          <p>
            Before the season starts you also pick all eight division winners, both conference
            champions, and the Super Bowl winner. These lock when the first game of the season
            kicks off and don't reopen, so they're worth far more than a single game.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">6 · Ties</div>
          <p style={{ marginBottom: 8 }}>
            Level on points? Eight tiebreakers run in order — the season picks first, since
            calling the Super Bowl in August is the hardest thing to fluke, then your
            week-by-week form.
          </p>
          <div className="scoring-summary">
            <div className="scoring-row"><span>1 · Correct Super Bowl pick</span></div>
            <div className="scoring-row"><span>2 · Correct conference picks</span></div>
            <div className="scoring-row"><span>3 · Correct division picks</span></div>
            <div className="scoring-row"><span>4 · 🏅 Game weeks won</span></div>
            <div className="scoring-row"><span>5 · 🧹 Clean Sweep weeks</span></div>
            <div className="scoring-row"><span>6 · 🎯 Near Perfect weeks</span></div>
            <div className="scoring-row"><span>7 · 💎 Sharp Weeks</span></div>
            <div className="scoring-row"><span>8 · Total correct picks</span></div>
          </div>
          <p style={{ marginTop: 8, fontSize: 11.5, opacity: 0.75 }}>
            Whenever a tie is broken, an ⓘ appears next to the name explaining exactly which
            one separated you.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">7 · The playoffs</div>
          <p>
            All thirteen playoff games are in the <b>Playoffs</b> tab from day one, sitting greyed
            out until the regular season decides who's actually in them. A game opens for
            predictions once an admin has set both teams <i>and</i> a kickoff time — the kickoff
            is what locks it, so without one it stays closed. From there it scores exactly like
            any other game.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">8 · Once games finish</div>
          <p>
            Completed games let you open <b>Show Everyone's Picks</b> to see what the whole
            league guessed. The dashboard runs a recap of each week — who won it, the average
            score, who climbed, who fell, and which game caught most people out — followed by
            callouts for week bonuses, upsets and the occasional howler.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">9 · Inside your league</div>
          <p>
            Open a league from <b>My Leagues</b> for four views beyond the main table:
          </p>
          <div className="scoring-summary" style={{ marginTop: 8 }}>
            <div className="scoring-row"><span><b>Weekly Standings</b> — each week's own race, plus a 🏅 badge for every week you top</span></div>
            <div className="scoring-row"><span><b>Head 2 Head</b> — pick a rival and see only the games you picked differently</span></div>
            <div className="scoring-row"><span><b>Season Chart</b> — everyone's points plotted week by week</span></div>
            <div className="scoring-row"><span><b>Members</b> — who's in, and who runs it</span></div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
