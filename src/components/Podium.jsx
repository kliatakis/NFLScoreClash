import Avatar from "./Avatar.jsx";

// The top three, rendered as an actual podium above the standings table.
// Laid out 2nd — 1st — 3rd so first place sits centre and tallest, the way a
// real podium reads.
//
// Hidden in two cases, both because a podium would mislead rather than
// celebrate: leagues with fewer than three players, and any point before a
// full week of the season has been played (`ready`) — until then everyone is
// on zero and the "ranking" is just member-list order.
export default function Podium({ standings, allUsers, user, ready }) {
  if (!ready) return null;
  if (!standings || standings.length < 3) return null;

  const [first, second, third] = standings;
  const slots = [
    { entry: second, medal: "🥈", block: "silver", label: "2ND" },
    { entry: first, medal: "🥇", block: "gold", label: "1ST" },
    { entry: third, medal: "🥉", block: "bronze", label: "3RD" },
  ];

  return (
    <div className="podium">
      {slots.map(({ entry, medal, block, label }) => (
        <div key={entry.uid} className="podium-slot">
          <div className="podium-medal">{medal}</div>
          <Avatar user={allUsers[entry.uid]} size={block === "gold" ? 46 : 38} />
          <div className={`podium-name ${entry.uid === user.uid ? "you" : ""}`} title={entry.username}>
            {entry.username}
          </div>
          <div className="podium-pts">{entry.points}</div>
          <div className={`podium-block ${block}`}>{label}</div>
        </div>
      ))}
    </div>
  );
}
