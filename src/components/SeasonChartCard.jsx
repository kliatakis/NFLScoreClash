import { useMemo, useState } from "react";
import { calcSeasonProgression, getScoringSettings } from "../lib/scoring.js";

// Drawn by hand in SVG rather than pulling in a charting library — this is one
// simple line chart, and Recharts/Chart.js would add more to the bundle than
// the entire rest of the app.
const W = 720, H = 320;
const PAD = { top: 18, right: 18, bottom: 34, left: 40 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

// Distinguishable at a glance, and stable per player regardless of position.
const LINE_COLORS = [
  "#3b82f6", "#22c55e", "#f59e0b", "#a855f7", "#06d6f7",
  "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#8b5cf6",
];
const colorFor = (uid, i, isMe) => (isMe ? "#f43f5e" : LINE_COLORS[i % LINE_COLORS.length]);

export default function SeasonChartCard({ league, user, allUsers, allPredictions, results }) {
  const scoring = getScoringSettings(league);
  const { weeks, series, maxPoints } = useMemo(
    () => calcSeasonProgression(league, allUsers, allPredictions, results, scoring),
    [league, allUsers, allPredictions, results]
  );
  const [hidden, setHidden] = useState(() => new Set());

  if (weeks.length === 0) {
    return (
      <div className="glass card">
        <div className="empty-state">
          <div className="empty-state-icon">📈</div>
          <div className="empty-state-title">Nothing to chart yet</div>
          <div className="empty-state-sub">
            Once a week of results is in, everyone's points will start plotting here week by week.
          </div>
        </div>
      </div>
    );
  }

  // A single played week has no line to draw between points, so widen the
  // scale slightly to keep the dots off the axis.
  const xFor = (i) => PAD.left + (weeks.length === 1 ? PLOT_W / 2 : (i / (weeks.length - 1)) * PLOT_W);
  const yFor = (pts) => PAD.top + PLOT_H - (pts / maxPoints) * PLOT_H;

  // Round gridline steps rather than arbitrary fractions of the max.
  const step = Math.max(1, Math.ceil(maxPoints / 4 / 5) * 5);
  const gridLines = [];
  for (let v = 0; v <= maxPoints; v += step) gridLines.push(v);

  const toggle = (uid) =>
    setHidden(prev => {
      const next = new Set(prev);
      if (next.has(uid)) next.delete(uid); else next.add(uid);
      return next;
    });

  const visible = series.filter(s => !hidden.has(s.uid));

  return (
    <div className="glass card">
      <div className="card-title">Season Progression</div>

      <div className="chart-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} className="season-chart" role="img"
          aria-label="Cumulative points per player by week">
          {/* horizontal gridlines + y labels */}
          {gridLines.map(v => (
            <g key={v}>
              <line x1={PAD.left} y1={yFor(v)} x2={W - PAD.right} y2={yFor(v)} className="chart-grid" />
              <text x={PAD.left - 8} y={yFor(v) + 4} className="chart-axis-label" textAnchor="end">{v}</text>
            </g>
          ))}

          {/* week labels — thinned out so they don't collide on a long season */}
          {weeks.map((w, i) => {
            const everyN = weeks.length > 10 ? Math.ceil(weeks.length / 8) : 1;
            if (i % everyN !== 0 && i !== weeks.length - 1) return null;
            return (
              <text key={w} x={xFor(i)} y={H - PAD.bottom + 20} className="chart-axis-label" textAnchor="middle">
                W{w}
              </text>
            );
          })}

          {visible.map((s, i) => {
            const isMe = s.uid === user.uid;
            const colorIndex = series.findIndex(x => x.uid === s.uid);
            const color = colorFor(s.uid, colorIndex, isMe);
            const pts = s.points.map((p, idx) => `${xFor(idx)},${yFor(p)}`).join(" ");
            return (
              <g key={s.uid}>
                {weeks.length > 1 && (
                  <polyline points={pts} fill="none" stroke={color}
                    strokeWidth={isMe ? 3.5 : 2} strokeLinejoin="round" strokeLinecap="round"
                    opacity={isMe ? 1 : 0.85} />
                )}
                {s.points.map((p, idx) => (
                  <circle key={idx} cx={xFor(idx)} cy={yFor(p)} r={isMe ? 4 : 3} fill={color}>
                    <title>{`${s.username} — Week ${weeks[idx]}: ${p} pts`}</title>
                  </circle>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      {/* Tap a name to hide that line — essential once a league gets big. */}
      <div className="chart-legend">
        {series.map((s, i) => {
          const isMe = s.uid === user.uid;
          const off = hidden.has(s.uid);
          return (
            <button
              key={s.uid}
              className={`chart-legend-item ${off ? "off" : ""}`}
              onClick={() => toggle(s.uid)}
              title={off ? "Show on chart" : "Hide from chart"}
            >
              <span className="chart-swatch" style={{ background: colorFor(s.uid, i, isMe) }} />
              <span className="chart-legend-name">{s.username}{isMe ? " (you)" : ""}</span>
              <b>{s.total}</b>
            </button>
          );
        })}
      </div>

      <div className="standings-legend">
        <div className="standings-legend-title">Note</div>
        <ol className="note-list">
          <li>
            Game points only. Division, conference and Super Bowl picks aren't tied to any
            single week, so including them would drop an unexplained cliff into everyone's
            line — they're in the main standings total instead.
          </li>
        </ol>
      </div>
    </div>
  );
}
