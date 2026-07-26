import { TEAMS } from "../data/teams.js";

// Team color + emoji chip — deliberately never an official logo image (see
// data/teams.js for why). Falls back to color + abbreviation for any team
// missing an `emoji` entry, same fallback pattern as Avatar uses for users.
export default function TeamBadge({ code, size = 26, showName = false }) {
  const t = TEAMS[code];
  if (!t) return <span className="team-badge">{code}</span>;
  // The label text deliberately does NOT use the team's own secondary color —
  // several teams' secondary is black/near-black (Ravens, Bengals, Panthers,
  // Saints, Cardinals, Buccaneers…), which is unreadable on the dark glass
  // background. Team color is reserved for the icon chip + tinted background;
  // the label always uses the app's own high-contrast text color.
  return (
    <span className="team-badge" style={{ background: `${t.primary}22`, border: `1px solid ${t.primary}55`, color: "var(--text)" }}>
      {/* A gradient from the team's primary into its secondary, with a soft
          inner highlight — a flat disc read as generated, this reads as made.
          Falls back to the primary alone if a team has no secondary. */}
      <span
        className="team-badge-icon"
        style={{
          width: size, height: size,
          background: t.secondary
            ? `linear-gradient(145deg, ${t.primary}, ${t.secondary})`
            : t.primary,
          boxShadow: `inset 0 1px 1px rgba(255,255,255,0.25), inset 0 -2px 4px ${t.primary}`,
        }}
      >
        {t.emoji || <span className="team-badge-abbr" style={{ color: "#fff" }}>{t.abbr}</span>}
      </span>
      {/* In a span so it can truncate — "Jacksonville Jaguars" next to a
          progress bar and a W-L record overflows a narrow phone otherwise. */}
      <span className="team-badge-label">{showName ? `${t.city} ${t.name}` : t.abbr}</span>
    </span>
  );
}
