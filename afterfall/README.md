# AFTERFALL

**The sky has a door. You fell through it.**

A voiced 3D survival story with an endless loop mode, built for the [vibe/vibe](https://testnet.vibevibe.fun) hackathon on **Robinhood Chain Testnet**.

> Medevac Two Six was carrying one sedated patient and a secret. Then the sky tore open.
> You wake up in the wreck under two moons. Someone built a fire for you. Someone wrote your number in the book.

## The story

The full script and story bible live in [`src/script.ts`](src/script.ts). The production plan, world map and the Patient 10001 mystery are in [`docs/PRODUCTION.md`](docs/PRODUCTION.md).

**The questions that drive everything: what happened, who am I, and why were they waiting for me?**

| Act | Beat |
| --- | --- |
| **Prologue · The Flight** | You *see* the flight: Captain Okafor and his nervous co-pilot Dez in the cockpit, Rhea in the cabin talking to her sleeping patient. The heart monitor spikes, the sky opens, mayday. Outside, a masked watcher counts the fall: *"Ten thousand." "No. Count again." "Ten thousand. And one."* |
| **I · The Fallsite** | Wake in the wrecked ambulance. Two moons. The black box plays Okafor's last log over a flashback. Then the signs: warm ash footprints circling the ambulance, tally marks gouged into the hull, breathing on the radio, a figure by the burning wreck that's gone when you look again. A fire pit someone built for you, and a Meridian records case beside it: ten thousand subjects, and one more written in by hand. **Patient 10001. Active.** Dated three days before the flight. Then one Hollow walks into the firelight. |
| **II · The Hollow** | The woods come for the fire. Wristbands, statuses: terminated, missing, transferred. Rhea never asked where "transferred" went. |
| **III · Resonance** | Light three towers. Each one costs a secret: Rhea's orders were to keep you *asleep* until you landed *here*. |
| **IV · The Warden** | Patient One has counted every fall. *"Ten thousand. No. Ten thousand and one? You're not the one I was expecting."* |
| **V · The Changed** | Ines, Patient 4382 ("missing"), was dropped off by Rhea. She leads you to a settlement of survivors deep in the Blackwood: a wall of wristbands, and yours already on it, yellowed with age. At the fire the truths conflict, and you choose: **leave your band on the wall, or keep it.** |
| **VI · The Rift Basin** | Floating rocks and hospital beds, low gravity, cyan cracks, and your own echo walking a few seconds behind you. |
| **VII · The Choir** | A ring of white figures wearing your clothes. *"Every one of us was you."* You build the fire. You write the line in the registry yourself. Then you're back on the plane, and the patient answers Rhea in their sleep. |

## The world

Named regions announce themselves the first time you walk in, and the **field map** (`M`, or the Map button on touch) starts blank and fills in as you explore. Places the story hasn't reached are interference at the edge.

| Region | Read |
| --- | --- |
| 01 · The Fallsite | Burning wreck, the ambulance, the fire. The red light of a broken relay mast is how you find your way back. |
| 02 · The Blackwood | Black trunks, no glow, thicker fog. |
| 03 · Meridian Field Station | Red trees, tents, a lab cabin with its door hanging open, restraint straps on the gurneys, one emergency lamp still turning. |
| 04 · The Tower Fields | Cyan rune light. |
| 05 · The Warden's Domain | The stone circle and the rift. |
| 06 · The Hollow Settlement | Barred and cold until Chapter Five, then firelight, a palisade, the Changed. |
| 07 · The Rift Basin | Down is a suggestion here. |
| 08 · The Choir | White. |

**Three kinds of threat:** the **Hollow** (former patients, whispering scraps of hospital life), the **Things** (natives that were here first: territorial, they fear firelight, and they lunge) and the **Changed** (survivors who adapted; some help).

**The world remembers.** Every loop leaves evidence: more tally marks on the ambulance, your wristbands by the fire, a cairn that wasn't there, a fallen tree, the mast light going out. Within a loop, each night's fire gets one quiet, escalating beat: a figure at the edge of the light, a voice that isn't Rhea's, a page in your handwriting, a stand-off, a tear. From the third loop you remember which way they come, and they come that way.

Colour carries meaning: **orange** is people and safety (fire), **cyan/white** is the rift and anything impossible, **red** is danger and corruption, **black** is unknown.

## The loop: THE LONG NIGHT

The game gives the loop a story reason: **the rift is looping Patient 10001.**

- **Dusk:** scavenge Meridian supply caches, shards and Echoes before the storm. You can call the storm early for bonus shards.
- **Storm:** Hollow pour through cyan rift tears and attack your **campfire**. Hold it until the last one falls.
- **Dawn:** bank shards and buy **Memories**, which are permanent upgrades: Thick Skin, Muscle Memory, Second Wind, Field Medic, Shard Sense and Firekeeper.
- **Loop reset:** if you fall or the fire dies, you wake again on Night 1. Your Memories survive, and so does the dialogue. Your character remembers dying, and Rhea's lines change every loop.
- **Omens:** each night gets a modifier, for example Blood Moon, Choir Night, The Quiet, Starfall, Iron Hollow, Thin Sky or Drop Fog. Every fifth night the Warden's Echo hunts the fire.
- **Echoes:** 12 ghost recordings of subjects who fell before you, spread across both modes. They build the mystery: *"There's a voice on the radio every time one of us falls. Calls herself Rhea."* The 12th only appears after the other 11, and it's your own voice.

**Enemies:** the Hollow (spear), Runners (fast), Brutes (armored, go straight for the fire), Shamans (throw rift bolts you can dodge) and the Warden (telegraphed red-ring slam, summons minions).

**Combat feel:** a 3-hit combo with a heavy overhead finisher, hit-stop, damage numbers, sparks, enemy health bars, a dodge with brief invulnerability, slow-motion on the boss kill, and bloom on everything that glows.

All voices use the browser's Web Speech API, each with its own pitch, rate and voice choice. Subtitles type on as they're spoken. All sound is synthesized with WebAudio.

## Your survivor

The first time you play, you name your survivor and dress them in the firelight next to the wreck. The preview is the in-game model, and you can drag to turn it.

- **Name:** written on the wristband. Rhea and the Echoes say it out loud, and it appears on your HUD and in your signed record.
- **Frame:** lean, standard or heavy.
- **Skin tone:** six options.
- **Hair:** six styles and six colors.
- **Clothing:** medevac hoodie, field jacket, scrubs, bomber or patient gown, in seven colors.
- **Trousers:** five colors.
- **Accessory:** beanie, scarf, backpack, glasses or bandana.

Change any of it later from **Survivor** on the main menu. Everything is saved in the browser.

## Design

The interface is deliberately plain, like a shipped console game. It uses one accent color (medevac orange), Barlow and Barlow Condensed type, thin rules instead of boxes, plain subtitles with the speaker's name in color, and a text-only main menu over the live campfire scene. The world uses a muted night palette, smooth-shaded characters and restrained bloom.

## Play together (co-op)

**Play together** on the main menu opens a room for up to eight survivors. Create a room and share the invite link (`?room=CODE`, copy it from the pause menu), or type a friend's code.

- **Everyone sees everyone.** Each player keeps the name and outfit they made in the creator, with a name tag and health line over their head. Running, swinging and dodging are streamed about 12 times a second and smoothed.
- **One shared night.** The room's host runs the Long Night: the timers, waves, omens, Hollow AI and campfire. Everyone else mirrors it at 10 Hz, so all players fight the same Hollow, guard the same fire, and see the same Warden.
- **Shared combat.** Your swings feel instant locally and the host applies the damage. The Hollow hunt whichever survivor is nearest.
- **Downed, not dead.** If you fall in co-op, Rhea talks you back up after a few seconds. The loop only resets if the fire dies or everyone is down at once.
- **Personal progress.** Loot, shards, Memories and Echoes stay per player.
- **Drop in, drop out.** Late joiners catch up to the current night. If the host leaves, the next player takes over the world without a restart.

**Voice chat** is built in. Survivors in a room talk over WebRTC, peer to peer; the room server only helps them connect.
- **Positional:** you hear each person from where their survivor stands, quieter with distance and panned left or right.
- **Push to talk** on **V** by default, the **Talk** button on phones. Switch to open mic or off, and mute others, from the pause menu.
- **Speaking indicators:** a speaker mark appears on the name tag and in the room roster when someone talks.
- **Limit:** it uses public STUN servers. Players behind very strict networks may need a TURN server to hear each other.

The co-op server is `server/server.mjs`. It's one Node process that serves the built game and relays rooms over a WebSocket at `/ws`. It only relays messages; the host's browser runs the simulation.

```bash
npm run serve        # build + start on http://localhost:8787 (game + co-op)
# or, while developing:
npm start            # co-op server on :8787
npm run dev          # Vite on :5173, proxies /ws to :8787
```

**Deploying co-op.** WebSockets need a long-running server, so plain static hosts like Vercel can't run rooms by themselves.
- **Render:** `render.yaml` is included.
- **Anywhere else:** use the included `Dockerfile` (Railway, Fly, a VPS).
- **Game on Vercel, rooms elsewhere:** set `VITE_MP_SERVER=wss://your-server/ws`, or add `?mp=wss://…` to the URL.

## On phones and tablets

The game detects touch screens and switches to mobile mode automatically: lighter graphics (no shadows or glow, capped resolution) and no mouse lock. Add `?high` to the URL for full quality, or `?touch` to try the touch controls on a desktop.

- **Left thumb:** a floating stick appears wherever you touch. Push it to the edge to sprint.
- **Right thumb:** drag anywhere to look. The buttons are Swing (aim assist turns you toward the nearest Hollow), Dodge, Jump, Use (lights up when something is in reach), Heal and, in co-op, Talk.
- **Layout:** a compact HUD keeps away from the thumbs. Holding the phone upright shows a "turn your phone sideways" prompt. Android goes fullscreen in landscape where the browser allows.
- **iPhone:** speech and audio start on your first tap, as Safari requires.

## Token integration (Robinhood Chain Testnet, chain ID 46630)

- **Launch the token:** [testnet.vibevibe.fun/create](https://testnet.vibevibe.fun/create). Gas comes from the [faucet](https://faucet.testnet.chain.robinhood.com).
- **Connect it:** set `VITE_TOKEN_ADDRESS=0x…` or add `?token=0x…` to the URL.
- **Rift-Bound perk for holders:** a glowing Rift axe (+50% damage), an extra medkit every night and a wider shard pull. The game reads `balanceOf` directly from `rpc.testnet.chain.robinhood.com`.
- **Trade link:** the title screen links straight to the token's vibe/vibe page.
- **Proof of survival:** players can sign their record (best night, Echoes, shards) with their wallet. It costs no gas and sends no transaction.

## Run it

```bash
cd afterfall
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

Deploy `dist/` anywhere static. On Vercel, set the root directory to `afterfall`. Add `?low` to the URL on weaker laptops; it turns off bloom and shadows. Progress is saved in the browser's localStorage.

**Controls:** `WASD` move · mouse look · `LMB`/`F` swing (×3 combo) · `RMB`/`C` dodge · `Space` jump · `Shift` sprint · `Q` medkit · `E` interact · `M` map · arrow keys look · `Enter`/`Esc` skip cinematics.

## Code map

| File | Purpose |
| --- | --- |
| `src/script.ts` | Story bible and every line of dialogue, the Echoes, omens and loop-wake lines |
| `src/story.ts` | The story, prologue to Chapter Seven: stages, cinematics, the boss, the ending |
| `src/signs.ts`, `src/records.ts` | The Fallsite's evidence (tracks, tally marks, the figure, the case) and the subject registry |
| `src/regions.ts`, `src/map.ts` | Named regions and the fog-of-war field map |
| `src/farlands.ts`, `src/choice.ts` | The settlement and the Changed, the Rift Basin, the Choir; the on-screen choice |
| `src/fauna.ts` | The Things: wildlife spawning in the Blackwood and the Basin |
| `src/memory.ts` | World memory across loops and the escalating fire beats |
| `src/cinesets.ts` | The plane interior set and cast for the cold open and flashback |
| `src/night.ts` | The Long Night: dusk/storm/dawn, waves, omens, shop, loop reset |
| `src/cinematic.ts` | Letterboxed, skippable camera shots |
| `src/ctx.ts` | Shared renderer, world, actors, HUD helpers, interactions |
| `src/world.ts` | Terrain, sky and moods, wreck, ambulance, campfire, field station, relay mast, Blackwood, mist, caches, ghosts, rift |
| `src/enemies.ts` | Hollow, Runner, Brute, Shaman and Warden AI; projectiles; health bars |
| `src/models.ts` | Smooth-shaded characters, the full wardrobe, weapons |
| `src/player.ts` | Controller, combo combat, dodge, camera collision |
| `src/creator.ts` | Survivor creator and menu camera |
| `src/echo.ts`, `src/save.ts` | Echo collectibles and persistent progress (Memories) |
| `src/fx.ts`, `src/post.ts` | Damage numbers, sparks, bloom |
| `src/voice.ts`, `src/audio.ts` | Voiced dialogue and procedural sound |
| `src/token.ts` | Wallet, token balance, run signing (viem) |
| `src/net.ts`, `src/coop.ts` | Co-op client: rooms, state streaming, host/guest roles |
| `src/avatars.ts` | Other survivors: model, name tag, smoothing, animation |
| `server/server.mjs` | Static server + WebSocket room relay |

Testnet only. No real funds.
