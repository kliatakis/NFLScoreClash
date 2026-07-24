import { DEFAULT_SCORING } from "../lib/scoring.js";

// A short explainer for people who just got handed a league code and have no
// idea how any of this scores. Deliberately generic — it describes the rules
// and shows the DEFAULT point values, noting that each league can change
// them (the live values for a specific league are shown under its standings).
export default function HowItWorks({ onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 520, maxHeight: "85vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
        <div className="modal-title">How ScoreClash Works</div>
        <p className="modal-sub">The whole game in about a minute.</p>

        <div className="howto-section">
          <div className="howto-heading">1 · Predict every game</div>
          <p>
            For each fixture you enter a final score — away team first, home team second.
            Predictions are yours, not per-league: enter a score once and it counts in
            every league you're in.
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
          <p style={{ marginBottom: 8 }}>
            Getting the winner right scores; getting the exact score scores more. They never
            both count for the same game — a perfect call is an Exact Score only.
          </p>
          <div className="scoring-summary">
            <div className="scoring-row"><span>Correct winner</span><span className="scoring-pts">{DEFAULT_SCORING.outcomePoints} pt</span></div>
            <div className="scoring-row"><span>Exact score</span><span className="scoring-pts">{DEFAULT_SCORING.exactPoints} pts</span></div>
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
          <div className="howto-heading">4 · Preseason picks are worth the most</div>
          <p>
            Before the season starts you also pick all eight division winners, both conference
            champions, and the Super Bowl winner. These lock when the first game of the season
            kicks off and don't reopen, so they're worth far more than a single game.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">5 · Ties</div>
          <p>
            Level on points? The tiebreakers run in order: Super Bowl pick, then conference
            picks, then division picks, then number of exact scores. Whenever a tie is broken,
            an ⓘ appears next to the name explaining exactly why.
          </p>
        </div>

        <div className="howto-section">
          <div className="howto-heading">6 · Once games finish</div>
          <p>
            Completed games let you open <b>Show Everyone's Picks</b> to see what the whole
            league guessed. The dashboard also calls out the week's exact-score hits, upsets,
            and the occasional howler.
          </p>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Got it</button>
        </div>
      </div>
    </div>
  );
}
