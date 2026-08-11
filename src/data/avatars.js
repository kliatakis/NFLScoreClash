// Avatar presets.
//
// Stored on the user document as { type: "emoji", value: "🦁" } — the EMOJI is
// the identity, not the id, so ids here are only React keys and can be
// renumbered freely. Two entries must never share an emoji, or both tiles
// would render as "selected" at once (there's a test for this).
//
// Grouped because the list is long enough now that one undifferentiated grid
// is a wall. "Hall of Shame" exists because this app roasts people by design —
// half the fun is picking the toilet before anyone else does.
export const AVATAR_GROUPS = [
  {
    id: "animals",
    label: "Animals",
    avatars: [
      { id: "an1", emoji: "🦁", label: "Lion" },       { id: "an2", emoji: "🐯", label: "Tiger" },
      { id: "an3", emoji: "🦅", label: "Eagle" },      { id: "an4", emoji: "🐺", label: "Wolf" },
      { id: "an5", emoji: "🦊", label: "Fox" },        { id: "an6", emoji: "🐉", label: "Dragon" },
      { id: "an7", emoji: "🦈", label: "Shark" },      { id: "an8", emoji: "🦏", label: "Rhino" },
      { id: "an9", emoji: "🐻", label: "Bear" },       { id: "an10", emoji: "🐐", label: "Goat" },
      { id: "an11", emoji: "🐙", label: "Octopus" },   { id: "an12", emoji: "🦥", label: "Sloth" },
      { id: "an13", emoji: "🦩", label: "Flamingo" },  { id: "an14", emoji: "🐧", label: "Penguin" },
      { id: "an15", emoji: "🦔", label: "Hedgehog" },  { id: "an16", emoji: "🐨", label: "Koala" },
      { id: "an17", emoji: "🐼", label: "Panda" },     { id: "an18", emoji: "🦘", label: "Kangaroo" },
      { id: "an19", emoji: "🦙", label: "Llama" },     { id: "an20", emoji: "🐳", label: "Whale" },
      { id: "an21", emoji: "🦖", label: "Dino" },      { id: "an22", emoji: "🦄", label: "Unicorn" },
      { id: "an23", emoji: "🐸", label: "Frog" },      { id: "an24", emoji: "🦆", label: "Duck" },
      { id: "an25", emoji: "🦉", label: "Owl" },       { id: "an26", emoji: "🐍", label: "Snake" },
      { id: "an27", emoji: "🦦", label: "Otter" },     { id: "an28", emoji: "🦡", label: "Badger" },
      { id: "an29", emoji: "🦨", label: "Skunk" },     { id: "an30", emoji: "🐊", label: "Croc" },
      { id: "an31", emoji: "🦃", label: "Turkey" },    { id: "an32", emoji: "🦞", label: "Lobster" },
      { id: "an33", emoji: "🐒", label: "Monkey" },    { id: "an34", emoji: "🦧", label: "Orangutan" },
      { id: "an35", emoji: "🐝", label: "Bee" },       { id: "an36", emoji: "🦭", label: "Seal" },
      { id: "an37", emoji: "🦋", label: "Butterfly" }, { id: "an38", emoji: "🐢", label: "Turtle" },
    ],
  },
  {
    // The point of this row. Nobody has to take the loo roll, but somebody
    // always does, and the rest of the league gets to enjoy it.
    id: "shame",
    label: "Hall of shame",
    avatars: [
      { id: "sh1", emoji: "🤡", label: "Clown" },      { id: "sh2", emoji: "💩", label: "Poop" },
      { id: "sh3", emoji: "🚽", label: "Toilet" },     { id: "sh4", emoji: "🧻", label: "Loo roll" },
      { id: "sh5", emoji: "🗿", label: "Stone face" }, { id: "sh6", emoji: "🫠", label: "Melting" },
      { id: "sh7", emoji: "🥴", label: "Woozy" },      { id: "sh8", emoji: "😴", label: "Asleep" },
      { id: "sh9", emoji: "🤯", label: "Mind blown" }, { id: "sh10", emoji: "🫥", label: "Invisible" },
      { id: "sh11", emoji: "🥶", label: "Frozen" },    { id: "sh12", emoji: "🙃", label: "Upside down" },
      { id: "sh13", emoji: "🪦", label: "RIP" },       { id: "sh14", emoji: "🚨", label: "Alarm" },
      { id: "sh15", emoji: "🎲", label: "Dice" },      { id: "sh16", emoji: "🃏", label: "Joker" },
      { id: "sh17", emoji: "🎰", label: "Slot machine" }, { id: "sh18", emoji: "🥔", label: "Potato" },
      { id: "sh19", emoji: "🪳", label: "Roach" },     { id: "sh20", emoji: "🤥", label: "Liar" },
      { id: "sh21", emoji: "🫏", label: "Donkey" },    { id: "sh22", emoji: "🧱", label: "Brick" },
    ],
  },
  {
    id: "characters",
    label: "Characters",
    avatars: [
      { id: "ch1", emoji: "🤖", label: "Robot" },      { id: "ch2", emoji: "👽", label: "Alien" },
      { id: "ch3", emoji: "👻", label: "Ghost" },      { id: "ch4", emoji: "💀", label: "Skull" },
      { id: "ch5", emoji: "🧟", label: "Zombie" },     { id: "ch6", emoji: "🧙", label: "Wizard" },
      { id: "ch7", emoji: "🥷", label: "Ninja" },      { id: "ch8", emoji: "🤠", label: "Cowboy" },
      { id: "ch9", emoji: "🦸", label: "Hero" },       { id: "ch10", emoji: "🦹", label: "Villain" },
      { id: "ch11", emoji: "🧛", label: "Vampire" },   { id: "ch12", emoji: "🧜", label: "Merfolk" },
      { id: "ch13", emoji: "🤹", label: "Juggler" },   { id: "ch14", emoji: "🥸", label: "Disguise" },
      { id: "ch15", emoji: "👺", label: "Tengu" },     { id: "ch16", emoji: "🕵️", label: "Detective" },
      { id: "ch17", emoji: "🧝", label: "Elf" },       { id: "ch18", emoji: "🎅", label: "Santa" },
      { id: "ch19", emoji: "🤓", label: "Nerd" },      { id: "ch20", emoji: "😎", label: "Cool" },
      { id: "ch21", emoji: "🥳", label: "Party" },     { id: "ch22", emoji: "🧠", label: "Big brain" },
    ],
  },
  {
    id: "food",
    label: "Food & drink",
    avatars: [
      { id: "fd1", emoji: "🌮", label: "Taco" },       { id: "fd2", emoji: "🍕", label: "Pizza" },
      { id: "fd3", emoji: "🥑", label: "Avocado" },    { id: "fd4", emoji: "🍩", label: "Donut" },
      { id: "fd5", emoji: "🍔", label: "Burger" },     { id: "fd6", emoji: "🌶️", label: "Pepper" },
      { id: "fd7", emoji: "🍺", label: "Beer" },       { id: "fd8", emoji: "🍌", label: "Banana" },
      { id: "fd9", emoji: "🌭", label: "Hot dog" },    { id: "fd10", emoji: "🥓", label: "Bacon" },
      { id: "fd11", emoji: "🍗", label: "Drumstick" }, { id: "fd12", emoji: "🧀", label: "Cheese" },
      { id: "fd13", emoji: "🥨", label: "Pretzel" },   { id: "fd14", emoji: "☕", label: "Coffee" },
      { id: "fd15", emoji: "🍿", label: "Popcorn" },   { id: "fd16", emoji: "🍦", label: "Ice cream" },
    ],
  },
  {
    id: "vibes",
    label: "Vibes",
    avatars: [
      { id: "vb1", emoji: "🔥", label: "Fire" },       { id: "vb2", emoji: "⚡", label: "Lightning" },
      { id: "vb3", emoji: "🌟", label: "Star" },       { id: "vb4", emoji: "💎", label: "Diamond" },
      { id: "vb5", emoji: "🎯", label: "Target" },     { id: "vb6", emoji: "👑", label: "Crown" },
      { id: "vb7", emoji: "🚀", label: "Rocket" },     { id: "vb8", emoji: "🏆", label: "Trophy" },
      { id: "vb9", emoji: "🎱", label: "8-ball" },     { id: "vb10", emoji: "🍀", label: "Lucky" },
      { id: "vb11", emoji: "🏈", label: "Football" },  { id: "vb12", emoji: "🧢", label: "Cap" },
      { id: "vb13", emoji: "🥊", label: "Boxing" },    { id: "vb14", emoji: "💪", label: "Muscle" },
      { id: "vb15", emoji: "🛸", label: "UFO" },       { id: "vb16", emoji: "🪄", label: "Wand" },
      { id: "vb17", emoji: "🧲", label: "Magnet" },    { id: "vb18", emoji: "🪃", label: "Boomerang" },
      { id: "vb19", emoji: "🛋️", label: "Couch" },     { id: "vb20", emoji: "📺", label: "TV" },
    ],
  },
];

// Flat list, kept for anything that just wants "every avatar".
export const PRESET_AVATARS = AVATAR_GROUPS.flatMap(g => g.avatars);
