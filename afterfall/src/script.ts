// ============================================================================
// AFTERFALL — the script.
//
// STORY BIBLE
// ----------
// Logline: A sedated patient on a black-site medevac flight wakes up on the far
// side of a tear in the sky. Meridian sent ten thousand subjects through. The
// registry says the player is number 10001, ACTIVE, dated three days before the
// flight, in handwriting. The world on the other side has been counting.
//
// The engine of the story is one question: why does the sky open for YOU?
//   Cold open:  we SEE the flight. A tired captain, a rookie co-pilot, a medic
//               who talks to her sleeping patient. Then the sky opens.
//   Act I   (Wake → Black box): survival, wonder, and a dead pilot's warning,
//               shown in flashback.
//   Act II  (Hollow → Towers):  the Hollow are former patients. Rhea is hiding
//               something. Every tower lit costs a secret.
//   Act III (Warden → Rift):    Patient One was waiting for 10000. You are
//               not the one he expected. The door opens, and something answers.
//   The Long Night (the loop):  the rift loops Patient 10001. Every death
//               resets the night; memories leak through. Echo #12 is your own
//               voice: you built the fire, carried the case and wrote yourself
//               into the registry on an earlier cycle. (Kept unspoken until then.)
//
// Characters (and how they talk)
//   YOU             — Patient 10001 (they don't know it yet), named and dressed
//                     by the player. Rhea calls them "sleeper". Dry. Says less
//                     than they feel. Jokes when scared.
//   RHEA VANCE      — Flight medic. Talks to unconscious patients because "they
//                     can hear more than you think". Warm, quick, a little bossy.
//                     Jokes first, bad news second. Hiding orders she hates.
//   CAPT. DANIEL OKAFOR — Pilot, thirty years flying. Dry, patient, fatherly.
//                     Calls everyone by their last name. Dies at the stick.
//   DEZ REYES       — First officer. First black-site run. Over-checks gauges,
//                     talks too much when nervous. In the log: "Dez is gone."
//                     Not dead. Gone. (Chapter Two.)
//   THE HOLLOW      — Some of the subjects before you, masked so they can't see
//                     who they were. Their barks are scraps of hospital life.
//                     (Not every threat is a patient: the Things were here first,
//                     and the Changed adapted. See docs/PRODUCTION.md.)
//   THE WARDEN      — Patient One. Speaks in pronouncements; cracks at the end.
//   THE CHOIR       — The voice behind the rift. "The ones who didn't forget."
//
// Writing rules: people interrupt, trail off, and answer the question under
// the question. Short lines (they're spoken by TTS). Every scene ends on a
// question. Nobody explains everything.
// ============================================================================

import type { SpeakerId } from "./voice";

export type Line = [SpeakerId, string, { name?: string; pitch?: number; rate?: number; radio?: boolean }?];

/** A cinematic beat: a camera shot, what happens in it, and who speaks. */
export interface Beat {
  shot: string;
  lines: Line[];
  cue?: ("alarm" | "rift" | "shake" | "flood" | "monitorFast" | "monitorCalm" | "beep")[];
  hold?: number; // extra seconds on the shot after the lines
}

const IN = { radio: false }; // spoken in the room, not over the radio
const COM = { radio: true, name: "Okafor (intercom)" };

// ---------------------------------------------------------------- COLD OPEN
export const COLD_OPEN_CAPTIONS = [
  "MERIDIAN INSTITUTE · PATIENT TRANSFER · DESIGNATION WITHHELD",
  "03:12 · 31,000 FT · FLIGHT PLAN: [REDACTED]",
];

/** The flight, shot by shot. The camera, the cast and the cues live in cinesets.ts. */
export const COLD_OPEN_BEATS: Beat[] = [
  {
    shot: "exterior",
    lines: [["PILOT", "Meridian Control, Medevac Two Six. Level three one zero. Cargo's asleep. Crew's awake. Mostly."]],
  },
  {
    shot: "cockpitWide",
    lines: [
      ["DEZ", "Mostly?"],
      ["PILOT", "You've checked that fuel gauge nine times, Reyes.", IN],
      ["DEZ", "It's my first black-site run, Captain. I'm allowed nine."],
    ],
  },
  {
    shot: "cockpitFaces",
    lines: [
      ["PILOT", "It's a hospital transfer.", IN],
      ["DEZ", "Hospitals don't pay triple. And they don't make you sign an NDA in the parking lot."],
      ["PILOT", "Fair.", IN],
    ],
  },
  {
    shot: "cabinWide",
    cue: ["beep"],
    lines: [
      ["RHEA", "Cabin to cockpit. Are you two done gossiping? My patient's trying to sleep.", { radio: true }],
      ["PILOT", "Your patient's sedated, Vance.", COM],
    ],
  },
  {
    shot: "monitor",
    cue: ["monitorFast"],
    lines: [["RHEA", "Mm. Then explain why their heart rate just jumped to one forty.", IN]],
  },
  {
    shot: "cockpitFaces",
    lines: [
      ["DEZ", "Is that bad? That sounds bad."],
      ["RHEA", "In someone this sedated? It means they're having one hell of a dream.", { radio: true }],
    ],
  },
  {
    shot: "rheaClose",
    lines: [
      ["RHEA", "Hey, sleeper. It's Rhea again. Whatever you're dreaming about, you can let it go.", IN],
      ["RHEA", "I've got you. Nobody's going anywhere tonight.", IN],
    ],
    hold: 0.8,
  },
  {
    shot: "windshield",
    cue: ["rift"],
    lines: [
      ["DEZ", "Captain. Twelve o'clock. Is that a storm?"],
      ["PILOT", "Storms don't glow like that.", IN],
      ["DEZ", "It's opening. Why is it opening?"],
    ],
  },
  {
    shot: "cockpitFaces",
    cue: ["alarm", "shake"],
    lines: [
      ["PILOT", "Autopilot off. Hard left, now.", IN],
      ["DEZ", "She's not answering! Everything's dead, the controls are dead!"],
    ],
  },
  {
    shot: "cabinAlarm",
    cue: ["alarm", "shake", "monitorFast"],
    lines: [
      ["RHEA", "Captain, talk to me!", IN],
      ["PILOT", "Vance, strap in. Strap the patient in!", COM],
      ["RHEA", "Already done. Sleeper, hold on to me. Hold on.", IN],
    ],
  },
  {
    shot: "okaforClose",
    cue: ["alarm", "shake", "flood"],
    lines: [["PILOT", "Mayday, mayday, Medevac Two Six. We're going in. God help whoever's down there.", IN]],
  },
];

export const COLD_OPEN_WATCHERS: Line[] = [
  ["HOLLOW", "Count it.", { name: "Watcher", pitch: 0.4 }],
  ["HOLLOW", "Ten thousand.", { name: "Watcher", pitch: 0.65 }],
  ["HOLLOW", "No. Count again.", { name: "Watcher", pitch: 0.4 }],
  ["HOLLOW", "Ten thousand. And one.", { name: "Watcher", pitch: 0.65, rate: 0.8 }],
];

export const TITLE_TAGLINE = "The sky has a door. You fell through it.";

// ---------------------------------------------------------------- ACT I
export const WAKE: Line[] = [
  ["YOU", "Rhea?"],
  ["RHEA", "Sleeper? Oh, thank God. Tap the radio if you can hear me. Anything."],
  ["YOU", "I'm here. I think. Where's here?"],
  ["RHEA", "{name}. That's what your wristband says. Hi, {name}. I'm Rhea. I've been talking to you for six hours and you never once talked back."],
  ["YOU", "Sorry. I was unconscious."],
  ["RHEA", "Excuses. And stop picking at the wristband. You always pick at it."],
  ["YOU", "Always?"],
  ["RHEA", "You picked at it the whole flight. Listen. I got thrown clear. My leg's fine. ...It's not fine. I'm moving."],
  ["RHEA", "That smell is fuel. Find something heavy and get out of that box before it decides to become a fireball."],
];

export const TAKE_AXE: Line[] = [
  ["YOU", "Fire axe. Okay. Okay, I can do fire axe."],
  ["RHEA", "Good. Now the doors. Kick them like they owe you money."],
];

export const REVEAL: Line[] = [
  ["YOU", "Rhea."],
  ["RHEA", "What? What's wrong?"],
  ["YOU", "Look up."],
  ["RHEA", "Okay. That's two moons."],
  ["YOU", "Two moons."],
  ["RHEA", "I counted. Three times. Still two."],
  ["RHEA", "Panic later. The black box has its own battery. If it's still sending, someone might hear. Get to the wreck."],
];

/** When you've been wandering a while: Rhea gives directions by what you can
 *  see, never by a marker. One line per objective. */
export const NAV: Record<string, Line[]> = {
  outside: [["RHEA", "The wreck's ahead of you. Follow the smoke."]],
  signs: [["RHEA", "Head back to the ambulance. Keep the dead tree behind you."]],
  fire: [["RHEA", "The fire pit's by the ambulance. Look for the stones."]],
  records: [["RHEA", "The case. It's by the stones, where the fire is."]],
  night1: [["RHEA", "Follow the smoke back. The fire's by the ambulance."]],
  pylons: [["RHEA", "Listen for the towers. One's west, past that blue scar. One's east, out by the dead tree. One's north."]],
  boss: [["RHEA", "Follow the beams north. To the stones."]],
  changed: [["RHEA", "East. Where the trees go black."]],
  basin: [["RHEA", "North. Toward the white light."]],
};

export const FIRST_SHARD: Line[] = [
  ["YOU", "It's warm. And it's humming."],
  ["RHEA", "My scanner just jumped off the chart. Not near me. Near you. Keep it. Keep all of them."],
];

/** Played over the flashback of Okafor alone in the burning cockpit. */
export const BLACK_BOX_LOG: Line[] = [
  ["PILOT", "This is Captain Daniel Okafor. Final log. If you're hearing this, we didn't make it.", { name: "Okafor (recording)", radio: true }],
  ["PILOT", "Meridian lied to us. That light opened the second our patient's heart rate spiked.", { name: "Okafor (recording)", radio: true }],
  ["PILOT", "Reyes is gone. I looked away for one second and his seat was empty.", { name: "Okafor (recording)", radio: true }],
  ["PILOT", "Vance is in the back with the patient. If anyone finds this, keep them away from the towers. Please.", { name: "Okafor (recording)", radio: true }],
];

export const BLACK_BOX: Line[] = [
  ["YOU", "Rhea. Did you know?"],
  ["RHEA", "Not all of it."],
  ["YOU", "How much of it?"],
  ["RHEA", "Later. I swear, later."],
  ["RHEA", "Go back to the ambulance. There's a medkit in the side locker, and I want you near something with walls."],
];

// ---------------------------------------------------------------- THE SIGNS
// Anticipation before the first Hollow: tracks, marks, breath, a shape, a voice.
export const SIGN_TRACKS: Line[] = [
  ["YOU", "Footprints. Bare feet."],
  ["RHEA", "Ours?"],
  ["YOU", "Nobody on that plane walked out barefoot."],
  ["YOU", "They go around the ambulance. All the way around. Like someone was checking on me."],
];
export const SIGN_MARKS: Line[] = [
  ["YOU", "Something scratched the side of the ambulance."],
  ["RHEA", "Scratched, or wrote?"],
  ["YOU", "Tally marks. Hundreds of them."],
  ["YOU", "And one word under all of them. Hundred."],
  ["RHEA", "Keep moving."],
];
export const SIGN_BREATH: Line[] = [
  ["RHEA", "{name}, is that you breathing like that?"],
  ["YOU", "Like what?"],
  ["RHEA", "Nothing. It's the static. Must be the static."],
];
export const SIGN_SHAPE: Line[] = [
  ["YOU", "Rhea. There's someone standing by the wreck."],
  ["RHEA", "A survivor? Wave at them."],
  ["YOU", "They're gone."],
];
export const SIGN_VOICE: Line[] = [["HOLLOW", "Nurse?", { name: "By the wreck", pitch: 0.7, rate: 0.75 }]];

export const FIRE_FOUND: Line[] = [
  ["YOU", "Someone built a fire pit. Stones, kindling, dry wood. Right next to where I woke up."],
  ["RHEA", "Then light it. Whatever's out there, I'd rather it saw you from far away than up close."],
];
export const FIRE_LIT: Line[] = [
  ["RHEA", "Better. I can see your smoke from here."],
  ["YOU", "There's a case by the stones. Meridian. Somebody carried it here from the wreck."],
  ["RHEA", "Don't open that. {name}, those files aren't for"],
  ["YOU", "It's already open."],
];
export const RECORDS_READ: Line[] = [
  ["YOU", "Rhea. There's a record for me."],
  ["RHEA", "That's not possible. They don't assign a number until"],
  ["YOU", "Ten thousand and one. Active. Dated three days before we took off."],
  ["YOU", "Rhea?"],
  ["RHEA", "I'm here. I signed off on ten thousand myself. There was no one after."],
  ["YOU", "Then who wrote me in?"],
  ["RHEA", "It's handwritten. Isn't it."],
  ["YOU", "How did you know that?"],
  ["RHEA", "Stay by the fire. Please. Just stay by the fire."],
];
export const FIRST_HOLLOW: Line[] = [["HOLLOW", "Room four. Don't close it. Don't close the door.", { pitch: 0.7, rate: 0.8 }]];
export const FIRST_HOLLOW_DOWN: Line[] = [
  ["YOU", "It's wearing a wristband. Twenty two ninety one."],
  ["RHEA", "That one says terminated."],
  ["YOU", "Then why was it walking?"],
];

export const BLACK_BOX_FIND: Line[] = [["YOU", "Black box. It's still got power. There's a recording."]];

// ---------------------------------------------------------------- THE FIRST NIGHT
// Chapter One's survival loop: keep the fire, get through to dawn. Rhea is on
// the radio, less and less of her as the night goes on.
export const NIGHT1_START: Line[] = [
  ["RHEA", "That one won't be the last."],
  ["RHEA", "There's weather coming. I can hear it on the radio, rolling in from the north."],
  ["YOU", "How long?"],
  ["RHEA", "Long enough to find things that burn. Food. Water. Go."],
];
/** Radio check-ins while you scavenge. Short; never more than she'd say. */
export const RADIO_FAR: Line[] = [
  ["RHEA", "How far are you?"],
  ["YOU", "I don't know."],
  ["RHEA", "Then you're farther than you should be."],
];
export const RADIO_FOUND: Line[] = [
  ["RHEA", "What have you got?"],
  ["YOU", "Tins. Water. Somebody's socks."],
  ["RHEA", "Keep the tins."],
];
export const RADIO_FIRE: Line[] = [
  ["RHEA", "Is the fire still going?"],
  ["YOU", "For now."],
  ["RHEA", "Make it longer than for now."],
];
export const RADIO_BATTERY: Line[] = [
  ["RHEA", "You're breaking up. Your radio's dying."],
  ["YOU", "Then I'll find it something to eat."],
];
export const DEEP_NIGHT: Line[] = [
  ["RHEA", "It's gone very quiet where you are."],
  ["YOU", "It isn't quiet. Something keeps walking just past the light."],
  ["RHEA", "Then don't leave the light."],
];
export const GLIMPSE: Line[] = [
  ["YOU", "Rhea. Someone's standing in the trees."],
  ["RHEA", "Say again?"],
  ["YOU", "Nothing. They're gone."],
];
export const STORM_START: Line[] = [["RHEA", "Here it comes. Stay by the fire, {name}. Whatever you hear out there, it isn't"]];
export const STORM_LOST: Line[] = [["YOU", "Rhea?"]];
export const FIRE_OUT: Line[] = [["YOU", "It's out. I need something that burns."]];
export const ALARM_RIGGED: Line[] = [["YOU", "If anything walks into that, I'll hear it."]];
export const DAWN1: Line[] = [
  ["YOU", "They're going back into the trees."],
  ["RHEA", "Sun's coming up. Or whatever that is. Come back to the fire."],
];
/** Back at the fire, after the first night. She says one thing too many. */
export const FIRST_NIGHT_END: Line[] = [
  ["RHEA", "You're back."],
  ["YOU", "You knew I'd make it."],
  ["RHEA", "…"],
  ["YOU", "Rhea?"],
  ["RHEA", "I knew where you'd come back from."],
];

// ---------------------------------------------------------------- THE THINGS
// First sighting of a native. Not a patient. Not anybody.
export const THING_FIRST: Line[] = [
  ["YOU", "Rhea. Something's watching me. It's not one of them."],
  ["RHEA", "Not a Hollow?"],
  ["YOU", "No mask. No wristband. No face, really."],
  ["RHEA", "Then it was here before any of us. Back away slow. Find a fire if you can."],
];

// ---------------------------------------------------------------- ACT II
export const AMBUSH_START: Line[] = [
  ["HOLLOW", "Fall. Forget. Belong."],
  ["HOLLOW", "Ten thousand and one! The one has come home!", { pitch: 0.7 }],
];

export const AMBUSH_CLEARED: Line[] = [
  ["YOU", "Wristbands. All of them. Meridian."],
  ["RHEA", "Same as yours."],
  ["YOU", "Ten thousand people, Rhea."],
  ["RHEA", "Not all of them are out here. Some went missing. Some were transferred."],
  ["YOU", "Transferred where?"],
  ["RHEA", "That was the word they used. I never asked."],
  ["YOU", "You never asked."],
  ["RHEA", "I know how that sounds."],
  ["RHEA", "Okafor said stay away from the towers. They're also the only thing that can carry a signal. So. Something stupid."],
  ["YOU", "Light the towers."],
  ["RHEA", "Light the towers."],
];

export const PYLON_TOUCH: Line[] = [["HOLLOW", "No! No, the towers wake him!"]];

export const PYLON_LIT: Line[][] = [
  [
    ["RHEA", "It worked, the signal jumped! And there's something riding underneath it. Voices."],
    ["CHOIR", "Ten thousand and one."],
    ["YOU", "Tell me you heard that."],
    ["RHEA", "I heard it. I really wish I hadn't. Keep going."],
  ],
  [
    // the radio drops out; when she comes back she won't say where she is
    ["YOU", "Rhea?"],
    ["YOU", "Rhea, are you there?"],
    ["RHEA", "...I'm here."],
    ["YOU", "Where?"],
    ["RHEA", "{name}, I need to tell you something before I lose my nerve."],
    ["YOU", "That's never a good start."],
    ["RHEA", "My orders weren't to keep you alive. They were to keep you asleep. Until we landed."],
    ["YOU", "Landed where?"],
    ["RHEA", "I think they meant here."],
  ],
  [
    ["WARDEN", "Who rings my towers?"],
    ["RHEA", "All three beams point north. To that stone circle."],
    ["YOU", "Something's waiting there."],
    ["RHEA", "Something's been waiting there a very long time."],
  ],
];

// ---------------------------------------------------------------- ACT III
export const WARDEN_INTRO: Line[] = [
  ["WARDEN", "Ten thousand."],
  ["WARDEN", "No."],
  ["WARDEN", "Ten thousand. And one?", { rate: 0.8 }],
  ["WARDEN", "You're not the one I was expecting."],
  ["YOU", "Who were you expecting?"],
  ["WARDEN", "The last one. They promised me the last one. I was the first. I have counted every one of them down."],
  ["WARDEN", "There is no one after the last. So what are you?"],
  ["RHEA", "{name}, the red ring! When it glows, jump or run!"],
];
export const WARDEN_SUMMON: Line[] = [["WARDEN", "Children! Hold the one I didn't count!"]];
export const WARDEN_HALF: Line[] = [["WARDEN", "You think the sky saved you? The sky ate you!"]];
export const WARDEN_LOW: Line[] = [["WARDEN", "I remember rain. Real rain. Cold, on my face."]];
export const WARDEN_DEATH: Line[] = [["WARDEN", "Patient One. Discharged."]];

export const EPILOGUE: Line[] = [
  ["RHEA", "{name}, the signal's through! But it's not going home. Something on the other side is pulling it."],
  ["CHOIR", "Ten thousand and one. We counted every fall. You are the one we did not count."],
  ["YOU", "Who are you?"],
  ["CHOIR", "Come and see."],
  ["RHEA", "Don't you dare go anywhere without me."],
];

// ---------------------------------------------------------------- CHAPTER FIVE: THE CHANGED
export const INES_MEET: Line[] = [
  ["INES", "Don't swing. I'm not one of them."],
  ["YOU", "You've got a wristband."],
  ["INES", "Forty three eighty two. They wrote me down as missing. I wasn't missing. I was busy."],
  ["INES", "You put the Warden down. Do you know what that means?"],
  ["YOU", "That he stops trying to kill me?"],
  ["INES", "It means nobody's standing in the door. Everything out here is going to come and look."],
  ["RHEA", "{name}, I've got two signals on you. One of them's wrong. It's too bright."],
  ["INES", "Tell her Ines says hello. She'll remember me. She's the one who dropped me off."],
  ["RHEA", "Ines?"],
  ["INES", "There are people in the deep woods. Living ones. Keep the red light on your right and walk until the trees go black. I'll have the fire going."],
];
export const CHANGED_WALK: Line[] = [
  ["RHEA", "{name}. About Ines."],
  ["YOU", "She said you dropped her off."],
  ["RHEA", "I've flown forty transfers. I talked every one of them down. I told myself they were going somewhere better."],
  ["YOU", "Were they?"],
  ["RHEA", "I never asked. That was the job. Not asking."],
];
export const SETTLEMENT_ARRIVE: Line[] = [
  ["TEO", "Another one walking in on their own feet. That's twice this year."],
  ["INES", "Teo, this is ten thousand and one."],
  ["TEO", "No. There's no such number."],
  ["YOU", "That's what everyone keeps telling me."],
];
export const WRISTBAND_WALL: Line[] = [
  ["YOU", "Wristbands. Hundreds of them, nailed up in rows."],
  ["INES", "Everyone who makes it here leaves theirs. It's how we stop being numbers."],
  ["YOU", "There's one here with my number on it."],
  ["INES", "That's not possible."],
  ["YOU", "The plastic's gone yellow. It's been here for years."],
  ["INES", "Teo's going to want to see that."],
];
export const FIRE_TALK: Line[] = [
  ["TEO", "Sit. The fire doesn't ask questions."],
  ["TEO", "Meridian thinks it's a door. It isn't. It's a mouth. And it's always hungry."],
  ["INES", "And sometimes it spits us back out. Changed. Alive. It's a door, Teo. Doors go both ways."],
  ["TEO", "Everyone who wants to go home walks north into the Basin. Nobody walks back."],
  ["INES", "Because nobody's tried it with a key."],
  ["RHEA", "{name}, listen to me. Meridian has a pickup at the heart of the Basin. That's what the towers were for. I can get you out. I just need you there."],
  ["TEO", "Your radio woman. Ask her what happens to the ones she picks up."],
  ["YOU", "Rhea?"],
  ["RHEA", "I don't know. I never asked."],
  ["TEO", "Leave your band on the wall. Stay. Be a person here instead of a number out there."],
  ["INES", "Or keep it, walk north, and find out what the number's for."],
];
export const CHOICE_LEFT: Line[] = [
  ["YOU", "{name}. Not ten thousand and one. Just {name}."],
  ["TEO", "Then the fire's yours, whenever you want it."],
  ["INES", "You're still going north."],
  ["YOU", "I'm still going north."],
];
export const CHOICE_KEPT: Line[] = [
  ["YOU", "I'm keeping it. If it's a key, I want to know what it opens."],
  ["TEO", "Everyone says that."],
  ["INES", "Not everyone gets to be right."],
];

// ---------------------------------------------------------------- CHAPTER SIX: THE RIFT BASIN
export const BASIN_ENTER: Line[] = [
  ["RHEA", "The signal's so strong here I can hear my own heartbeat in it."],
  ["YOU", "Rhea, the rocks are floating."],
  ["RHEA", "Of course they are. Why wouldn't they be."],
];
export const BASIN_ECHO: Line[] = [
  ["YOU", "Someone's following me. It's me. A few seconds behind."],
  ["RHEA", "Don't look at it too long."],
];
export const BASIN_FIGHT: Line[] = [["HOLLOW", "The one walks north! Stop the one!", { pitch: 0.6 }]];
export const BASIN_LIGHT: Line[] = [
  ["RHEA", "{name}, there's a light ahead of you. White. My whole screen's just white."],
  ["YOU", "I'm walking into it."],
  ["RHEA", "I know. I think I've always known you would."],
];

// ---------------------------------------------------------------- CHAPTER SEVEN: THE CHOIR
export const CHOIR_GREET_KEPT: Line[] = [["CHOIR", "Ten thousand and one."]];
export const CHOIR_GREET_LEFT: Line[] = [["CHOIR", "{name}. You came with a name. You are the first who did."]];
export const CHOIR_TRUTH: Line[] = [
  ["CHOIR", "Meridian opened the door ten thousand times. The ten thousand and first time, the door opened itself."],
  ["YOU", "Why?"],
  ["CHOIR", "Because you were already on this side."],
  ["YOU", "Who are you?"],
  ["CHOIR", "The ones who didn't forget. Every one of us walked in here. Every one of us was you."],
  ["YOU", "Then what happens now?"],
  ["CHOIR", "Someone has to be waiting when you fall. Someone has to build the fire. Someone has to write it down."],
];
export const CHOIR_BUILD: Line[] = [
  ["YOU", "Stones. Kindling. Dry wood."],
  ["YOU", "Right next to where I woke up."],
];
export const CHOIR_WRITTEN: Line[] = [
  ["YOU", "Ten thousand and one. Active. Flight, the fourteenth of March."],
  ["YOU", "It was my handwriting. The whole time."],
  ["RHEA", "{name}? I can't see you anymore. Everything's gone white."],
  ["YOU", "Rhea. You told me nobody was going anywhere tonight."],
  ["RHEA", "When did I say that?"],
  ["YOU", "You will."],
  ["RHEA", "Then come back to me."],
  ["YOU", "Every time."],
];
export const CHOIR_AGAIN_KEPT: Line[] = [["CHOIR", "Ten thousand and one. Again."]];
export const CHOIR_AGAIN_LEFT: Line[] = [["CHOIR", "{name}. Again."]];
/** Back on the plane. The first scene, heard the second time. */
export const ENDING_PLANE: Line[] = [
  ["RHEA", "Hey, sleeper. It's Rhea again. Whatever you're dreaming about, you can let it go."],
  ["RHEA", "I've got you. Nobody's going anywhere tonight."],
];
export const ENDING_WHISPER: Line[] = [
  ["YOU", "I know.", { name: "The patient", rate: 0.7, pitch: 0.85 }],
  ["RHEA", "Sleeper?"],
];

export const RESPAWN: Line[][] = [
  [["RHEA", "{name}! Get up. Don't you dare quit on me."]],
  [["RHEA", "Breathe. In. Out. You're not done, and I'm not done with you."]],
  [["RHEA", "Up! You can bleed later. That's a medical opinion."]],
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
  "Count it! Ten thousand!",
  "Lights out. Lights out!",
  "Nurse? Nurse!",
  "Room four. Room four.",
  "Mom?",
  "Don't close it!",
  "And one. And one.",
];

// ---------------------------------------------------------------- THE LONG NIGHT
export const NIGHT_INTRO_FIRST: Line[] = [
  ["RHEA", "{name}, the rift went wild when the Warden fell. It's spitting Hollow out of the sky, and I can't reach you before dark."],
  ["RHEA", "The fire pit by the ambulance. Somebody built it for you. Light it. Stay in the light."],
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
    ["RHEA", "{name}, you're scaring me."],
    ["YOU", "Good. Stay scared. It keeps you alive."],
  ],
  [
    ["RHEA", "Sleeper? Tap the radio if you can hear me. Anything."],
    ["YOU", "I know. I always know what you're going to say."],
    ["RHEA", "Then tell me how tonight ends."],
    ["YOU", "Differently."],
  ],
  [["YOU", "Again. The shards remember. So do I."]],
];

export const NIGHT_OPENERS: Line[][] = [
  [["RHEA", "First night out here. Keep the fire burning. Whatever comes out of the dark, it hates the light."]],
  [["RHEA", "I found tracks by the river. Bare feet. Dozens of them. Heading your way."]],
  [["RHEA", "I keep hearing my name in the static. In my own voice. That's normal, right?"], ["YOU", "Totally normal."], ["RHEA", "You're a terrible liar."]],
  [["RHEA", "The second moon looks bigger tonight. Tell me I'm wrong."], ["YOU", "You're wrong."], ["RHEA", "Liar."]],
  [["RHEA", "Something big is walking toward your fire. Something that used to be the Warden."]],
  [["RHEA", "I tried to walk to you today. Six hours. I ended up right where I started."]],
  [["RHEA", "If I stop answering, keep the fire lit anyway. Promise me."], ["YOU", "Promise."]],
  [["RHEA", "The Hollow are learning. They watched you fight last night."]],
  [["CHOIR", "Ten thousand and one. Stop counting the nights. We stopped long ago."]],
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

// ---------------------------------------------------------------- WORLD MEMORY
// The loop keeps evidence. These play the first time each change is noticed.
export const MEM_CAIRN: Line[] = [["YOU", "That cairn wasn't here last time."], ["RHEA", "Last time?"], ["YOU", "Never mind."]];
export const MEM_TREE: Line[] = [["YOU", "That tree was standing yesterday. Or whenever yesterday was."]];
export const MEM_MAST: Line[] = [["RHEA", "{name}, the mast light's out. I can't find you without it."], ["YOU", "Then I'll find you."]];
export const MEM_BANDS: Line[] = [["YOU", "Wristbands on the stones by the fire. Mine. More of them every time."]];
// Escalation around the fire, one beat per night, slowly.
export const MEM_SHAPE: Line[] = [["YOU", "Someone at the edge of the light again."], ["RHEA", "Same one?"], ["YOU", "I think it's always the same one."]];
export const MEM_VOICE: Line[] = [
  ["RHEA", "Sleeper? Over here.", { name: "From the trees", radio: false, rate: 0.85 }],
  ["RHEA", "{name}, that wasn't me. I didn't say anything. I swear I didn't say anything."],
];
export const MEM_PAGE: Line[] = [["YOU", "There's a page by the fire. The registry. My line."], ["RHEA", "Is the ink"], ["YOU", "Still wet."]];
export const MEM_STANDOFF: Line[] = [["RHEA", "They've stopped at the edge of the light. Why have they stopped?"], ["YOU", "They're waiting to see if I remember."]];
export const MEM_TEAR: Line[] = [["CHOIR", "Again."]];
export const MEM_UNDERSTAND: Line[] = [
  ["YOU", "I understand it now. It isn't punishing me. It's waiting for me to build the fire."],
  ["RHEA", "Then build it. I'll be on the radio. I'm always on the radio."],
];

export const FIRE_LOW: Line[] = [["RHEA", "The fire's dying! Get back to it!"]];

// ---------------------------------------------------------------- ECHOES
// Twelve recordings from subjects who fell before. Collected across both
// modes; the last one only appears once the other eleven are found. Numbers
// match the registry the player reads at the fire (records.ts).
export interface Echo {
  id: number;
  patient: string;
  lines: Line[];
}

const E = (patient: string, pitch: number, text: string): Line => ["ECHO", text, { name: `Patient ${patient}`, pitch }];

export const ECHOES: Echo[] = [
  { id: 0, patient: "0007", lines: [E("0007", 1.2, "Patient seven. Day one. They said it was a clinical trial. They said I'd be home by spring.")] },
  { id: 1, patient: "0412", lines: [E("0412", 0.8, "Four twelve. The shards sing when you're close to the towers. Don't sing back.")] },
  { id: 2, patient: "1123", lines: [E("1123", 1.4, "Eleven twenty three. I forgot my daughter's name today. I wrote it on my arm. Now I can't read my own handwriting.")] },
  { id: 3, patient: "2031", lines: [E("2031", 0.7, "Twenty thirty one. The masks aren't for war. They're so we don't have to see who we used to be.")] },
  { id: 4, patient: "3344", lines: [E("3344", 1.0, "Thirty three forty four. Meridian sends one of us through every few days. Like feeding something.")] },
  { id: 5, patient: "4382", lines: [E("4382", 1.3, "Forty three eighty two. They'll list me as missing. I'm not missing. The Warden was kind once. He taught me how to make fire.")] },
  { id: 6, patient: "5063", lines: [E("5063", 0.9, "Fifty sixty three. There's a voice on the radio every time one of us falls. Warm. Funny. Calls herself Rhea.")] },
  { id: 7, patient: "6071", lines: [E("6071", 0.6, "Sixty seventy one. Fall. Forget. Belong. It isn't a prayer. It's a set of instructions.")] },
  { id: 8, patient: "7291", lines: [E("7291", 1.1, "Seventy two ninety one. Transferred, they'll say. The second moon is closer every night. I measured it with my thumb.")] },
  { id: 9, patient: "9843", lines: [E("9843", 1.5, "Ninety eight forty three. If you're the last one, listen. The door doesn't lead home. Home is what it eats.")] },
  { id: 10, patient: "10000", lines: [E("10000", 1.0, "Ten thousand. There was a fire pit by the wreck when I landed. Already built. Like somebody knew. I kept it lit. Whoever you are, keep it lit.")] },
  {
    id: 11,
    patient: "10001",
    lines: [
      ["YOU", "Ten thousand and one. {name}. If you're hearing this, it's already happened. I've done this before. Many times.", { name: "Patient 10001" }],
      ["YOU", "I built the fire. I carried the case to it. I wrote us into the book, so you'd know you were expected.", { name: "Patient 10001" }],
      ["YOU", "Stop counting the nights. Start counting the people. Find Rhea.", { name: "Patient 10001" }],
      ["RHEA", "{name}? Who were you talking to?"],
      ["YOU", "Me."],
    ],
  },
];

export const ECHO_FIRST_FIND: Line[] = [["RHEA", "{name}? Your signal just doubled. Like there are two of you standing there."]];
