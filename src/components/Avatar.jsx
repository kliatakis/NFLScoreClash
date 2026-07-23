export const PRESET_AVATARS = [
  // ── Animals ──
  { id: "a1", emoji: "🦁", label: "Lion" }, { id: "a2", emoji: "🐯", label: "Tiger" },
  { id: "a3", emoji: "🦅", label: "Eagle" }, { id: "a4", emoji: "🐺", label: "Wolf" },
  { id: "a5", emoji: "🦊", label: "Fox" }, { id: "a6", emoji: "🐉", label: "Dragon" },
  { id: "a7", emoji: "🦈", label: "Shark" }, { id: "a8", emoji: "🦏", label: "Rhino" },
  { id: "a9", emoji: "🐻", label: "Bear" }, { id: "a10", emoji: "🦋", label: "Butterfly" },
  { id: "a11", emoji: "🐸", label: "Frog" }, { id: "a12", emoji: "🦄", label: "Unicorn" },
  { id: "a19", emoji: "🐐", label: "Goat" }, { id: "a21", emoji: "🐙", label: "Octopus" },
  { id: "a22", emoji: "🦥", label: "Sloth" }, { id: "a23", emoji: "🦩", label: "Flamingo" },
  { id: "a24", emoji: "🐧", label: "Penguin" }, { id: "a25", emoji: "🦔", label: "Hedgehog" },
  { id: "a26", emoji: "🐨", label: "Koala" }, { id: "a27", emoji: "🐼", label: "Panda" },
  { id: "a28", emoji: "🦘", label: "Kangaroo" }, { id: "a29", emoji: "🦙", label: "Llama" },
  { id: "a30", emoji: "🐳", label: "Whale" }, { id: "a31", emoji: "🦖", label: "Dino" },

  // ── Funny / characters ──
  { id: "a32", emoji: "🤡", label: "Clown" }, { id: "a33", emoji: "🤖", label: "Robot" },
  { id: "a34", emoji: "👽", label: "Alien" }, { id: "a35", emoji: "👻", label: "Ghost" },
  { id: "a36", emoji: "💀", label: "Skull" }, { id: "a37", emoji: "🧟", label: "Zombie" },
  { id: "a38", emoji: "🧙", label: "Wizard" }, { id: "a39", emoji: "🥷", label: "Ninja" },
  { id: "a40", emoji: "🥳", label: "Party" }, { id: "a41", emoji: "😎", label: "Cool" },
  { id: "a42", emoji: "🤠", label: "Cowboy" },

  // ── Food ──
  { id: "a43", emoji: "🌮", label: "Taco" }, { id: "a44", emoji: "🍕", label: "Pizza" },
  { id: "a45", emoji: "🥑", label: "Avocado" }, { id: "a46", emoji: "🍩", label: "Donut" },
  { id: "a47", emoji: "🍔", label: "Burger" }, { id: "a48", emoji: "🌶️", label: "Pepper" },
  { id: "a49", emoji: "🍺", label: "Beer" },

  // ── Objects / vibes ──
  { id: "a13", emoji: "🔥", label: "Fire" }, { id: "a14", emoji: "⚡", label: "Lightning" },
  { id: "a15", emoji: "🌟", label: "Star" }, { id: "a16", emoji: "💎", label: "Diamond" },
  { id: "a17", emoji: "🎯", label: "Target" }, { id: "a18", emoji: "👑", label: "Crown" },
  { id: "a19b", emoji: "🚀", label: "Rocket" }, { id: "a50", emoji: "🏆", label: "Trophy" },
  { id: "a51", emoji: "🎱", label: "8-Ball" }, { id: "a52", emoji: "🍀", label: "Lucky" },
];

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

  if (av?.type === "emoji") return <div className="avatar" style={{ ...style, fontSize: size * 0.5 }}>{av.value}</div>;
  if (av?.type === "image") return <img src={av.value} alt="avatar" className="avatar" style={{ ...style, objectFit: "cover" }} />;
  return <div className="avatar" style={style}>{initials}</div>;
}
