// Shared per-league movement indicator: dash for no change, 1 arrow for a
// 1-2 position swing, 2 arrows for anything bigger than that (capped at 2 —
// a jump from last to 1st still shows just two arrows).
export default function MovementArrows({ movement }) {
  if (!movement || movement.dir === "same" || movement.arrows === 0) {
    return <span className="movement movement-dash" title="No change since the last result">–</span>;
  }
  const symbol = movement.dir === "up" ? "▲" : "▼";
  const title = movement.dir === "up"
    ? `Up ${movement.arrows === 2 ? "3+" : "1-2"} spot${movement.arrows === 2 ? "s" : ""} since the last result`
    : `Down ${movement.arrows === 2 ? "3+" : "1-2"} spot${movement.arrows === 2 ? "s" : ""} since the last result`;
  return (
    <span className="movement" title={title}>
      {Array.from({ length: movement.arrows }).map((_, i) => (
        <span key={i} className={`movement-arrow ${movement.dir}`}>{symbol}</span>
      ))}
    </span>
  );
}
