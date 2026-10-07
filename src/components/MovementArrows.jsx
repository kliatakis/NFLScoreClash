// Shared per-league movement indicator: dash for no change, 1 arrow for a
// 1-2 position swing, 2 arrows for anything bigger than that (capped at 2 —
// a jump from last to 1st still shows just two arrows).
//
// The window these describe is ONE GAME-WEEK, not "since the last score
// entered". They appear when a week finishes and hold completely still until
// the next one does, so during a live Sunday they still show last week's
// movement rather than creeping with each result. See calcStandingsWithMovement.
export default function MovementArrows({ movement }) {
  if (!movement || movement.dir === "same" || movement.arrows === 0) {
    return <span className="movement movement-dash" title="No change in the last completed game-week">–</span>;
  }
  const symbol = movement.dir === "up" ? "▲" : "▼";
  const title = movement.dir === "up"
    ? `Up ${movement.arrows === 2 ? "3+" : "1-2"} spot${movement.arrows === 2 ? "s" : ""} in the last completed game-week`
    : `Down ${movement.arrows === 2 ? "3+" : "1-2"} spot${movement.arrows === 2 ? "s" : ""} in the last completed game-week`;
  return (
    <span className="movement" title={title}>
      {Array.from({ length: movement.arrows }).map((_, i) => (
        <span key={i} className={`movement-arrow ${movement.dir}`}>{symbol}</span>
      ))}
    </span>
  );
}
