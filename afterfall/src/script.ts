// ============================================================================
// AFTERFALL — the script.
//
// STORY BIBLE
// ----------
// Logline: A sedated patient on a black-site medevac flight wakes up on the far
// side of a tear in the sky. He's the hundredth person to fall, and the world
// on the other side has been counting.
//
// The engine of the story is one question: why does the sky open for YOU?
//   Act I   (Wake → Black box): survival, wonder, and a dead pilot's warning.
//   Act II  (Hollow → Towers):  the Hollow are former patients. Rhea is hiding
//                               something. Every tower lit costs a secret.
//   Act III (Warden → Rift):    Patient One explains the hundredth is a key.
//                               The door opens, and something answers.
//   The Long Night (the loop):  the rift has caught you in a loop. Every death
//                               resets the night, but your memories leak
//                               through (upgrades), and so do the Echoes of the
//                               99 before you. Echo #12 is your own voice.
//
// Characters
//   YOU / "HUNDRED" — Patient 100, named and dressed by the player. Dry,
//                     stubborn, gets braver the more scared they get.
//   RHEA VANCE      — Flight medic. Warm and funny under fire, and guilty. The
//                     Echoes hint that "Rhea" has been on every transfer.
//                     (Seeded, unresolved: Chapter Two's hook.)
//   CAPT. OKAFOR    — The pilot. Dies in the crash; his black-box log is the
//                     first crack in the lie.
//   THE HOLLOW      — The 98 patients before you, masked so they can't see who
//                     they were. Creed: "Fall. Forget. Belong." Their barks are
//                     scraps of hospital life, which makes them sad and scary.
//   THE WARDEN      — Patient One. A man who carved his own name away to rule.
//   THE CHOIR       — The voice behind the rift. "The ones who didn't forget."
//
// Writing rules: every scene ends on a question. Short lines (they're spoken
// by TTS). Rhea's jokes come before bad news. Nobody explains everything.
// ============================================================================

import type { SpeakerId } from "./voice";

export type Line = [SpeakerId, string, { name?: string; pitch?: number; rate?: number }?];

// ---------------------------------------------------------------- COLD OPEN
export const COLD_OPEN_CAPTIONS = [
  "MERIDIAN INSTITUTE · PATIENT TRANSFER",
  "SUBJECT 100 · SEDATED · DESTINATION: [REDACTED]",
  "03:12 AM · 31,000 FT",
];

export const COLD_OPEN_CABIN: Line[] = [
  ["PILOT", "Meridian Control, Medevac One Zero Zero. Level at three one zero. Cargo is sedated and stable."],
  ["RHEA", "Stable is a strong word, Captain. Their heart rate just doubled. In their sleep."],
  ["PILOT", "Then put them under deeper. We don't get paid to ask questions, Vance."],
  ["RHEA", "Hey. Hundred. Whatever you're dreaming about, stop it. Please."],
  ["PILOT", "What is that? There's a light ahead of us. It's opening."],
  ["RHEA", "Captain, pull up. Pull up!"],
  ["PILOT", "Mayday, mayday! Medevac One Zero Zero, we are going in!"],
];

export const COLD_OPEN_WATCHERS: Line[] = [
  ["HOLLOW", "Count it.", { name: "THE HOLLOW · WATCHER", pitch: 0.4 }],
  ["HOLLOW", "One hundred.", { name: "THE HOLLOW · WATCHER", pitch: 0.65 }],
];

export const TITLE_TAGLINE = "The sky has a door. You fell through it.";

// ---------------------------------------------------------------- ACT I
export const WAKE: Line[] = [
  ["YOU", "Rhea?"],
  ["RHEA", "Hundred. Hundred, if you can hear me, tap the radio. Anything."],
  ["YOU", "I'm here. I think. Where is here?"],
  ["RHEA", "{name}, right? It's on your wristband. Stay grumpy, it keeps you alive. The ambulance tore out of the cargo hold when we hit. I got thrown clear. I'm hurt, but I'm moving."],
  ["RHEA", "Listen. That smell is fuel. Find something heavy and get out of that box."],
];

export const TAKE_AXE: Line[] = [
  ["YOU", "Fire axe. Okay. Okay."],
  ["RHEA", "Perfect. Now the doors. Kick like they owe you money."],
];

export const REVEAL: Line[] = [
  ["YOU", "Rhea. Look up."],
  ["RHEA", "I'm looking."],
  ["YOU", "There are two moons."],
  ["RHEA", "Yeah. I counted three times too."],
  ["RHEA", "Okay. Priorities. The black box has its own battery. If we boost its beacon, maybe somebody hears us. Head for the wreck."],
];

export const FIRST_SHARD: Line[] = [
  ["YOU", "It's warm. It's humming."],
  ["RHEA", "My scanner spikes every time you get close to one. Not me. You. Keep them. Something here runs on that hum."],
];

export const BLACK_BOX: Line[] = [
  ["YOU", "Black box. It's still recording."],
  ["PILOT", "Okafor. Final log. Meridian lied to us. Patient one hundred isn't a patient. They're a key.", { name: "BLACK BOX · CAPT. OKAFOR" }],
  ["PILOT", "The light opened the second he woke up. If anyone hears this, keep Hundred away from the towers.", { name: "BLACK BOX · CAPT. OKAFOR" }],
  ["RHEA", "Hundred, I didn't know. I swear I didn't know that part."],
  ["YOU", "That part?"],
  ["RHEA", "Later. Something's moving in the trees."],
];

// ---------------------------------------------------------------- ACT II
export const AMBUSH_START: Line[] = [
  ["HOLLOW", "Fall. Forget. Belong."],
  ["HOLLOW", "The hundredth has come home!", { pitch: 0.7 }],
];

export const AMBUSH_CLEARED: Line[] = [
  ["YOU", "They're wearing hospital bands. Meridian bands."],
  ["RHEA", "Same as yours."],
  ["YOU", "Rhea. How many patients did Meridian transfer before me?"],
  ["RHEA", "The manifest says ninety nine. None of them came home."],
  ["RHEA", "Okafor said stay away from the towers. But they're the only thing strong enough to carry a signal."],
  ["YOU", "Then I guess I'm not listening to Okafor."],
];

export const PYLON_TOUCH: Line[] = [["HOLLOW", "No! The towers wake the Warden!"]];

export const PYLON_LIT: Line[][] = [
  [
    ["RHEA", "It worked! The signal jumped. And there's something riding underneath it. Voices."],
    ["CHOIR", "Hundred."],
    ["YOU", "Tell me you heard that."],
    ["RHEA", "I heard it. Keep going."],
  ],
  [
    ["RHEA", "Hundred, I need to tell you something before I lose my nerve."],
    ["RHEA", "My orders weren't to keep you alive. They were to keep you asleep. Until we landed."],
    ["YOU", "Landed where?"],
    ["RHEA", "I think they meant here."],
  ],
  [
    ["WARDEN", "Who rings my towers?"],
    ["RHEA", "All three beams point north. To that stone circle. Whatever lives there is awake now."],
    ["YOU", "Yeah. I think it's been awake the whole time."],
  ],
];

// ---------------------------------------------------------------- ACT III
export const WARDEN_INTRO: Line[] = [
  ["WARDEN", "Ninety nine came before you. I was the first."],
  ["WARDEN", "They gave me a number instead of a name. So I carved the rest away."],
  ["WARDEN", "The door only opens for the hundredth. The door is mine. So are you."],
  ["RHEA", "Hundred, the red ring! When it glows, jump or get out of there!"],
];
export const WARDEN_SUMMON: Line[] = [["WARDEN", "Children of the Drop! Bring me the key!"]];
export const WARDEN_HALF: Line[] = [["WARDEN", "You think the sky saved you? The sky ate you!"]];
export const WARDEN_LOW: Line[] = [["WARDEN", "I remember rain. Earth rain. Cold, on my face."]];
export const WARDEN_DEATH: Line[] = [["WARDEN", "Patient One. Discharged."]];

export const EPILOGUE: Line[] = [
  ["RHEA", "Hundred, the signal is punching through. But it's not going home. Something on the other side is pulling."],
  ["CHOIR", "Hundred. We counted every fall. We waited for you."],
  ["YOU", "Who are you?"],
  ["CHOIR", "The ones who didn't forget."],
  ["RHEA", "I'm coming to you. Don't you dare go through without me."],
  ["YOU", "Then hurry. Because I don't think it's going to wait."],
];

export const RESPAWN: Line[][] = [
  [["RHEA", "{name}! Get up! Don't you dare quit on me!"]],
  [["RHEA", "Breathe. In. Out. You're not done. I'm not done with you."]],
  [["RHEA", "Up! Up! You can bleed later, that's an order."]],
];

// ---------------------------------------------------------------- HOLLOW BARKS
// Scraps of hospital life — the people they were leaking through the masks.
export const HOLLOW_BARKS = [
  "Visiting hours are over.",
  "Is it Tuesday? It feels like Tuesday.",
  "Take your medicine.",
  "Fall. Forget. Belong.",
  "I had a name. I had a name!",
  "Don't look at the moons.",
  "Count it! One hundred!",
  "Lights out. Lights out!",
  "Nurse? Nurse!",
  "The key! Take the key!",
];

// ---------------------------------------------------------------- THE LONG NIGHT
export const NIGHT_INTRO_FIRST: Line[] = [
  ["RHEA", "Hundred. The rift went wild when the Warden fell. It's spitting Hollow out of the sky, and I can't reach you before dark."],
  ["RHEA", "That fire pit by the ambulance. Somebody built it for you. Light it. Hold it. Whatever comes out of the dark hates the light."],
];

/** Played when the loop resets. Index = loop count (last one repeats). */
export const LOOP_WAKE: Line[][] = [
  [],
  [
    ["YOU", "Rhea. I died. I felt it."],
    ["RHEA", "What? You're right here, {name}. You never left the fire."],
    ["YOU", "Then why do I remember the dark?"],
  ],
  [
    ["YOU", "Same moons. Same smoke. Same fire."],
    ["RHEA", "Hundred, you're scaring me."],
    ["YOU", "Good. Stay scared. It keeps you alive."],
  ],
  [
    ["RHEA", "Hundred, tap the radio. Anything."],
    ["YOU", "I know. I always know what you're going to say."],
    ["RHEA", "Then tell me how tonight ends."],
    ["YOU", "Differently."],
  ],
  [
    ["YOU", "Again. The shards remember. So do I."],
  ],
];

export const NIGHT_OPENERS: Line[][] = [
  [["RHEA", "First night out here. Keep the fire burning. Whatever comes out of the dark, it hates the light."]],
  [["RHEA", "I found tracks by the river. Bare feet. Dozens. Heading your way."]],
  [["RHEA", "I keep hearing my name in the static. In my own voice. That's normal, right?"]],
  [["RHEA", "The second moon looks bigger tonight. Tell me I'm wrong."], ["YOU", "You're wrong."], ["RHEA", "Liar."]],
  [["RHEA", "Something big is walking toward your fire. Something that used to be the Warden."]],
  [["RHEA", "I tried to walk to you today. I walked for six hours. I ended up where I started."]],
  [["RHEA", "If I stop answering, keep the fire lit anyway. Promise me."]],
  [["RHEA", "The Hollow are learning. They watched you fight last night."]],
  [["CHOIR", "Hundred. Stop counting the nights. We stopped long ago."]],
];

export interface Omen {
  id: string;
  name: string;
  text: string;
  speed?: number;
  shardMul?: number;
  dmg?: number;
  waveGap?: number;
  echo?: number;
  bias?: "runner" | "brute" | "shaman";
  starfall?: boolean;
  quiet?: boolean;
  fog?: number;
  blood?: boolean;
}

export const OMENS: Omen[] = [
  { id: "blood", name: "BLOOD MOON", text: "The Hollow are frenzied. They move faster, and every shard counts double.", speed: 1.25, shardMul: 2, blood: true },
  { id: "choir", name: "CHOIR NIGHT", text: "Shamans lead the storm. The Echoes are louder tonight.", bias: "shaman", echo: 1 },
  { id: "quiet", name: "THE QUIET", text: "No barks. No warning. They hit harder, but every kill heals you.", dmg: 1.3, quiet: true },
  { id: "starfall", name: "STARFALL", text: "Shards rain from the sky. Go get them before the storm.", starfall: true },
  { id: "iron", name: "IRON HOLLOW", text: "Brutes march tonight, and they're coming for the fire.", bias: "brute" },
  { id: "thin", name: "THIN SKY", text: "The rift is torn wide. Waves come faster.", waveGap: 0.6 },
  { id: "fog", name: "THE DROP FOG", text: "A white fog rolls in. You won't see them until they're close.", fog: 0.03, bias: "runner" },
];

export const FIRST_NIGHT_OMEN: Omen = { id: "first", name: "THE FIRST NIGHT", text: "Scavenge the wreckage. Get back to the fire before the storm." };
export const WARDEN_OMEN: Omen = { id: "warden", name: "WARDEN'S ECHO", text: "Patient One won't stay dead. He's coming for the fire.", bias: "brute" };

export const DAWN_LINES: Line[][] = [
  [["RHEA", "Sun's up. Or whatever that is. You made it, {name}."]],
  [["RHEA", "Dawn. I could hear you fighting from here. Rest."]],
  [["YOU", "Still here."], ["RHEA", "Still here."]],
  [["RHEA", "That's another night. I'm marking them on my arm."]],
];

export const FIRE_LOW: Line[] = [["RHEA", "The fire's dying! Get back to it!"]];

// ---------------------------------------------------------------- ECHOES
// Twelve recordings from the patients who fell before. Collected across both
// modes; the last one only appears once the other eleven are found.
export interface Echo {
  id: number;
  patient: string;
  lines: Line[];
}

const E = (patient: string, pitch: number, text: string): Line => ["ECHO", text, { name: `ECHO · PATIENT ${patient}`, pitch }];

export const ECHOES: Echo[] = [
  { id: 0, patient: "7", lines: [E("7", 1.2, "Patient seven. Day one. They said it was a clinical trial. They said I'd be home by spring.")] },
  { id: 1, patient: "12", lines: [E("12", 0.8, "Patient twelve. The shards sing when you're close to the towers. Don't sing back.")] },
  { id: 2, patient: "23", lines: [E("23", 1.4, "Patient twenty three. I forgot my daughter's name today. I wrote it on my arm. Now I can't read my own handwriting.")] },
  { id: 3, patient: "31", lines: [E("31", 0.7, "Patient thirty one. The masks aren't for war. They're so we don't have to see who we used to be.")] },
  { id: 4, patient: "44", lines: [E("44", 1.0, "Patient forty four. Meridian drops one of us every year. Like feeding something.")] },
  { id: 5, patient: "58", lines: [E("58", 1.3, "Patient fifty eight. The Warden was kind once. He taught me how to make fire.")] },
  { id: 6, patient: "63", lines: [E("63", 0.9, "Patient sixty three. There's a voice on the radio every time one of us falls. Warm. Funny. Calls herself Rhea.")] },
  { id: 7, patient: "71", lines: [E("71", 0.6, "Patient seventy one. Fall. Forget. Belong. It isn't a prayer. It's a set of instructions.")] },
  { id: 8, patient: "86", lines: [E("86", 1.1, "Patient eighty six. The second moon is closer every night. I measured it with my thumb.")] },
  { id: 9, patient: "92", lines: [E("92", 1.5, "Patient ninety two. If you're the hundredth, listen. The door doesn't lead home. Home is what it eats.")] },
  { id: 10, patient: "99", lines: [E("99", 1.0, "Patient ninety nine. I'm the last one before you. I built a fire at the crash site and kept it lit every night. For you. Keep it lit.")] },
  {
    id: 11,
    patient: "100",
    lines: [
      ["YOU", "Patient one hundred. {name}. If you're hearing this, it's already happened. I've done this before. Many times.", { name: "ECHO · PATIENT 100" }],
      ["YOU", "Stop counting the nights. Start counting the people. Find Rhea.", { name: "ECHO · PATIENT 100" }],
      ["RHEA", "Hundred? Who were you talking to?"],
      ["YOU", "Me."],
    ],
  },
];

export const ECHO_FIRST_FIND: Line[] = [["RHEA", "Hundred? Your signal just doubled. Like there are two of you standing there."]];
