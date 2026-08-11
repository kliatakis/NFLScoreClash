import { AVATAR_GROUPS, PRESET_AVATARS } from "../data/avatars.js";

// Re-exported so existing imports keep working.
export { AVATAR_GROUPS, PRESET_AVATARS };

function usernameToHue(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return Math.abs(hash) % 360;
}

export default function Avatar({ user, size = 32 }) {
  const name = user?.username || "?";
  const initials = name.slice(0, 2).toUpperCase();
  const hue = usernameToHue(name);
  const av = user?.avatar;

  const style = {
    width: size, height: size, fontSize: size * 0.48,
    background: av ? undefined : `hsla(${hue}, 65%, 50%, 0.18)`,
    border: av ? undefined : `1.5px solid hsla(${hue}, 65%, 55%, 0.4)`,
    color: av ? undefined : `hsl(${hue}, 70%, 65%)`,
  };

  if (av?.type === "emoji") {
    // aria-hidden: the emoji is decoration, and screen readers announcing
    // "pile of poo" next to somebody's name in the standings helps nobody —
    // the username is always right beside it.
    return <div className="avatar" aria-hidden="true" style={{ ...style, fontSize: size * 0.5 }}>{av.value}</div>;
  }
  if (av?.type === "image") {
    return <img src={av.value} alt={`${name}'s avatar`} className="avatar" style={{ ...style, objectFit: "cover" }} />;
  }
  return <div className="avatar" aria-hidden="true" style={style}>{initials}</div>;
}
