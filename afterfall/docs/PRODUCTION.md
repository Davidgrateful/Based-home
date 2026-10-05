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

## L. World map (target)

(Stages 1–3 below are built as of this pass.)

| # | Region | Status | Role | Read |
|---|---|---|---|---|
| 01 | The Fallsite | built | Crash scar, ambulance, fire, records | Burning wreck, orange fire, white hull |
| 02 | The Blackwood | built (west belt) | First exploration, abandoned camps, records | Black trunks, low fog, no flora glow |
| 03 | Meridian Field Station | built (east, by tower 1) | Company history, Rhea's link | Red trees, white tents, dead floodlights |
| 04 | The Tower Fields | built | Towers / resonance | Cyan rune light |
| 05 | The Warden's Domain | built (north circle) | Patient One | Standing stones, red ground |
| 06 | The Hollow Settlement | planned | The Changed: survivors who adapted | Firelight, salvaged walls |
| 07 | The Rift Basin | planned | Gravity anomalies, floating debris | Cyan/white, broken ground |
| 08 | The Choir | planned (late) | Reality unstable | White |

Navigation landmarks:
- **The broken radio mast** at the Fallsite: tall, with a red light.
- **The red trees** at the station.
- **Cyan beams** from lit towers.
- **The rift glow** to the north.

The map starts blank and reveals as you walk. Regions beyond the edge show as distorted static until the story reaches them.

## M. Story structure
- **Prologue: The Flight.** We see the people before we lose them.
- **Chapter One: The Fallsite.** Survive, discover, become 10001.
- **Chapter Two: The Hollow.** The woods come for the fire. Wristbands and patient numbers.
- **Chapter Three: Resonance.** Towers; the field station; Rhea's orders.
- **Chapter Four: The Warden.** "Ten thousand." "…No. Ten thousand and one?" "You're not the one I was expecting."
- **The Long Night (the loop).**
  1. "I need to survive."
  2. "I've been here before."
  3. "Something changed."
  4. "I can use what I remember."
  5. "I understand the loop."

## N. The Patient 10001 mystery
- **Surface:** Meridian sent ten thousand subjects through. You are listed as 10001, ACTIVE, before you ever boarded.
- **Plants** (kept small, all in the first ten minutes):
  - The watcher's count stops at ten thousand, then hesitates.
  - The 10001 record is dated before the flight and is written by hand, not printed.
  - Rhea, in the wake scene: "You always pick at the wristband." She has said this before.
  - The fire pit was built for you, and the records case was carried to it.
  - Echo 12 is your own voice.
- **Truth** (not locked yet): the registry stops at 10000 because Meridian stopped there. 10001 was added by someone who had already lived this, inside the loop: you, on an earlier cycle. You built the fire. You carried the case. "Someone knew Patient 10001 would arrive" is true, and that someone is the player. The Warden was waiting for 10000, the last of Meridian's keys, and you are the first patient who wasn't sent. You came back. The opening scene is the truth all along: Rhea says "Nobody's going anywhere tonight" and nobody does; the night repeats.

## O. Implementation plan (order)
1. **Narrative spine** (this pass)
   - Rename to 10001 in all script and UI.
   - The player doesn't know their number until the records.
   - Signs sequence, fire, records overlay, first Hollow one on one.
   - New Warden meeting.
   - Hollow whispers.
2. **World and map** (this pass)
   - Named regions with entry cards.
   - Radio mast and field-station landmarks; Blackwood fog and dark trunks.
   - Fog-of-war map (M / map button) saved per browser.
3. **Colour language** (this pass)
   - Rift and tears move to cyan/white.
   - Echo ghosts move to white.
   - Red is kept for danger and corruption.
   - Ground mist near the forest.
4. **Threat categories** (next)
   - "Things", native creatures: a new appended `KINDS` entry with its own model and behaviour.
   - "Changed", intelligent survivors: NPCs in the Hollow Settlement.
5. **World memory** (next)
   - Loop-indexed changes around the fire: objects, footprints closer, new paths.
6. **Title screen poster** (next)
   - Wreck, fire, rift and silhouette composition.
7. **New regions** (later): Settlement, Rift Basin, Choir.
