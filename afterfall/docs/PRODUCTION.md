# AFTERFALL: production audit and plan

This is the working plan, not a pitch. It records what exists, what is weak and the order of work.

## A. Current systems

| System | Where | State |
|---|---|---|
| Renderer, quality tiers, bloom | `ctx.ts`, `post.ts` | three.js r186, ACES. `?low` and touch drop shadows and bloom. |
| World | `world.ts` | One 420 m heightfield; playable radius 190 m. Crash scar, plane wreck, ambulance, 230 instanced trees, 3 pylons, stone-circle arena, campfire, shards. |
| Player | `player.ts` | First person inside the ambulance, third person outside. 3-hit axe combo, dodge, stamina, medkits, aim assist on touch. |
| Enemies | `enemies.ts` | Five kinds (hollow, runner, brute, shaman, warden). Readable wind-up state machines. Network snapshots. |
| Story | `story.ts`, `script.ts` | Linear chain: cold open → wake → black box (+ flashback) → ambush → 3 towers → Warden → epilogue. |
| Cinematics | `cinematic.ts`, `cinesets.ts` | Shot/say/wait sequencer, skip, shake. Plane interior set with three voiced actors. |
| Voice | `voice.ts` | Browser speech per speaker, radio filter, typed subtitles. |
| Loop | `night.ts` | The Long Night: dusk → storm → dawn, omens, loop reset, Memories shop. |
| Echoes | `echo.ts` | 12 ghost recordings, persisted. |
| Co-op + voice | `net.ts`, `coop.ts`, `voicechat.ts`, `server/` | Host-authoritative Long Night for 8, WebRTC positional voice. |
| Mobile | `touch.ts` | Stick, look-drag, buttons, auto low quality. |
| Save | `save.ts` | localStorage: look, name, bank, echoes, loops, memories. |
| Token | `token.ts` | Robinhood Chain Testnet balance gate (Rift-bound) and signed runs. |

## B. What already works (protect)
- Combat feel: wind-ups, hit-stop, heavy third hit, dodge.
- Cinematic cold open in the plane, black-box flashback, voice pipeline.
- Long Night loop and co-op sync. Snapshot format is index-based on `KINDS`, so new enemy kinds must be appended, never inserted.
- Touch controls and the low tier.
- Save format `afterfall.save.v1`. Add fields only, with defaults.

## C. What still reads as a prototype
- The world is one undifferentiated forest disc. Nowhere has a name and nothing tells you where you are.
- Story beats are "go to marker, press E". Nothing is discovered.
- The first enemies arrive as a wave, with no build-up.
- The rift palette is purple/magenta, which clashes with the cyan shards and towers and has no meaning.
- There's no map. The marker is the only navigation tool.

## D. Narrative problems
- "Patient 100" makes every enemy a former patient and caps the world's history at 99 people.
- The player is told their number in the first line, so there's nothing left to discover.
- Nothing in the world shows that something happened *after* the crash.
- The Warden explains himself instead of making the player doubt themselves.

## E. Gameplay problems
- Chapter One has no tension curve: walk, listen, fight.
- The campfire only matters in the Long Night.
- Every threat is a masked humanoid.

## F. World/map problems
- No regions, landmarks or sight lines. Pylons are the only tall shapes.
- No reason to leave the marker path apart from shards.
- The world never changes between visits.

## G. Visual problems
- Colour has no rules: purple rift, cyan shards, green flora, magenta ghosts.
- Fog is one flat exponential layer with no ground mist and no depth.
- Too little "story clutter": no footprints, bodies, wristbands or notes.

## H. UI/UX problems
- The HUD is tidy but always shows everything; the objective text does the navigating.
- No map screen and no discovery feedback ("You found…").

## I. Performance risks
- Point lights: 4 wreck fires, the ambulance, the beacon, 3 pylons, the rift and the campfire, all forward-shaded. Don't add more dynamic lights; use emissive and sprites.
- 2048 shadow map following the player (off on low).
- 1400 flora plus 230 trees, all instanced, so that's fine. New props must be instanced or merged.

## J. Do not touch
Net protocol shapes, the enemy `KINDS` order, the save key, touch input, the voice queue, the cinematic API and the token flow.

## K. First five minutes (new)
1. **Flight.** The plane in the clouds. Okafor and Dez in the cockpit, Rhea in the cabin. The rift opens; mayday.
2. **Fall.** Over the tree line, someone counts the fallen. "Ten thousand… and one."
3. **Title.**
4. **Wake.** The ambulance, Rhea on the radio. The player doesn't know their number.
5. **Reveal.** Two moons. Head for the wreck.
6. **Black box.** Okafor's last log, shown in flashback. Rhea dodges the question.
7. **Signs** (new). Bare footprints across the crash scar, circling the ambulance. Claw gouges on the hull. Breathing. A figure standing at the tree line, then gone. A whisper: "Nurse…"
8. **Fire** (new). Someone built a fire pit by the ambulance and left a Meridian records case open beside it. Light the fire.
9. **Records** (new). The patient registry: 0017 terminated, 4382 missing, 7291 transferred, 9843 unknown, 10000 terminated, **10001 ACTIVE**. The 10001 entry is dated three days before the flight.
10. **First Hollow** (new). One figure walks into the firelight muttering hospital words. The first fight is one on one.
11. Its wristband. Then the woods empty out toward you: Chapter Two.

## L. World map

Everything below is built.

| # | Region | Where | Role | Read |
|---|---|---|---|---|
| 01 | The Fallsite | crash scar | Crash, ambulance, fire, registry | Burning wreck, orange fire, white hull |
| 02 | The Blackwood | west of x = −38 | First exploration, natives | Black trunks, no glow, thick fog, mist |
| 03 | Meridian Field Station | east (80, 26) | Company history | Red trees, tents, lab cabin, one turning lamp |
| 04 | The Tower Fields | around the 3 towers | Resonance | Cyan rune light |
| 05 | The Warden's Domain | north stone circle | Patient One | Standing stones, red ground, gaps north and south |
| 06 | The Hollow Settlement | deep Blackwood (−124, 104) | The Changed, the wristband wall, the choice | Firelight, palisade, salvage; barred and cold until Chapter Five |
| 07 | The Rift Basin | past the circle (0, 262) | Low gravity, your own echo, natives | Floating rocks and hospital beds, cyan cracks |
| 08 | The Choir | Basin's north edge (0, 304) | The truth, the ending | White: fog, ground, a ring of figures in your clothes, the world repeated |

Navigation landmarks:
- **The red light on the relay mast:** home. It goes dark from the fifth loop.
- **The red trees** around the field station.
- **Cyan beams** from lit towers.
- **The settlement's fire** through the black trees.
- **The white column** over the Choir, visible from the title screen on.

The map frames whatever you've discovered. The Settlement, Basin and Choir appear as scrambled names until the story opens them.

## M. Story structure
- **Prologue: The Flight.** We see the people before we lose them. The watcher counts "ten thousand… and one."
- **Chapter One: The Fallsite.**
  1. Wake, two moons, black box.
  2. The signs: tracks, tally marks, breathing, a figure, a voice.
  3. The fire, then the registry: **10001 ACTIVE**, handwritten.
  4. One Hollow walks into the light.
- **Chapter Two: The Hollow.** The woods come for the fire.
- **Chapter Three: Resonance.** Towers; Rhea's orders were to keep you asleep.
- **Chapter Four: The Warden.** "Ten thousand. No. Ten thousand and one? You're not the one I was expecting."
- **Chapter Five: The Changed.**
  1. Ines (4382, "missing") meets you at the circle. Rhea dropped her off.
  2. The settlement: Teo, the wristband wall, and your band, yellowed, nailed up years ago.
  3. At the fire the truths conflict. The rift is a mouth (Teo), a door (Ines), or a pickup (Rhea, who never asked).
  4. **Choice:** leave your band on the wall (be a person) or keep it (be the key). It changes how the Choir names you.
- **Chapter Six: The Rift Basin.** Low gravity, floating relics, your echo a few seconds behind you, a fight on the way north.
- **Chapter Seven: The Choir.**
  1. "Every one of us was you." Someone has to build the fire, and someone has to write it down.
  2. You build the fire ("right next to where I woke up") and write the 10001 line yourself.
  3. Cut to the plane: "Hey, sleeper… Nobody's going anywhere tonight." The patient answers in their sleep: "I know."
- **The Long Night (the loop).** Loop wake lines move through five stages:
  1. survive
  2. been here before
  3. something changed
  4. use what you remember (the storm comes from the direction you predict)
  5. understand the loop

## N. The Patient 10001 mystery (resolved in Chapter Seven)
- **Surface:** Meridian sent ten thousand subjects through. You are listed as 10001, ACTIVE, before you boarded.
- **Plants:**
  - The watcher's hesitating count.
  - The handwritten line dated before the flight.
  - "You always pick at the wristband."
  - The fire pit built for you, and the case carried to it.
  - Your old band on the settlement wall.
  - The white column on the title screen.
  - Echo 12 in your own voice.
- **Truth:** every time you fall, you arrive before yourself. The Choir are the ones who didn't forget: earlier yous. You build the fire, carry the case and write yourself in, so the next you is expected. The opening scene was the truth: nobody's going anywhere tonight.

## O. What was built (in order)
1. **Narrative spine:**
   - Patient 10001.
   - The signs, the registry and the first Hollow.
   - The Warden meeting and the Hollow whispers.
2. **World and map:** regions with cards, the mast, the field station, the Blackwood, and the fog-of-war field map.
3. **Colour language:** cyan/white rift, warm fire, red danger, ground mist.
4. **Threats:**
   - The **Things** (natives: territorial, they fear firelight, they lunge, and they're not part of any wave; appended to `KINDS` so co-op snapshots stay compatible).
   - The **Changed** (Ines, Teo and two others at the settlement).
5. **Chapters Five to Seven:**
   - The settlement, the Basin and the Choir.
   - The wristband choice and the ending.
   - **Continue** on the menu for chapters 3–6.
6. **World memory** (`memory.ts`):
   - **Across loops:** more tally marks, your bands by the fire, a cairn (loop 3), a fallen tree (loop 4), the mast going dark (loop 5). After the story, the station lamp goes out.
   - **Across nights:** one quiet beat per night (a figure, a voice that isn't Rhea, a page in your handwriting, a stand-off at the edge of the light, a tear over the fire).
   - **Remembered direction** from loop 3 (the storm comes from where you say).
7. **Title poster:** a low shot past the survivor at the fire, the rift breathing over the wreck, an oversized wordmark and a one-row menu.
8. **Intro video:** re-rendered from the game's own script with MBROLA voices.

Performance notes: one extra point light each for the field station and the settlement. Everything else is emissive, sprites or instanced meshes. Basin debris is one instanced mesh.
