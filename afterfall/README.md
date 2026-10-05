# AFTERFALL

**The sky has a door. You fell through it.**

A voiced 3D survival story with an endless loop mode, built for the [vibe/vibe](https://testnet.vibevibe.fun) hackathon on **Robinhood Chain Testnet**.

> Medevac Flight 100 was carrying one sedated patient and a secret. Then the sky tore open.
> You wake up in the wreck under two moons, and the masked things in the trees are already counting.

## The story

The full script and story bible live in [`src/script.ts`](src/script.ts).

**The question that drives everything: why does the sky open for *you*?**

| Act | Beat |
| --- | --- |
| **Cold open** | Black screen. A typed Meridian Institute transfer manifest. You *hear* the cabin: the pilot, Rhea the flight medic, an alarm, "Mayday". Hard cut outside: a tear opens in the alien sky, a burning medevac plane dives out of it, and a masked watcher on the ridge whispers: *"Count it." "One hundred."* Then the title slams in. |
| **I · The Drop** | Wake in first person inside the wrecked ambulance. Take the fire axe and kick the doors open. The camera cranes up to reveal two moons. Rhea guides you by radio to the black box, where the dead pilot's last log says: *"The cargo isn't a patient. He's a key."* |
| **II · The Hollow** | The masked natives attack. They wear Meridian hospital bands like yours. Ninety-nine patients came before you. None went home. |
| **III · Resonance** | Light three towers while they swarm you. Each tower you light makes someone tell a secret: Rhea admits her orders were to keep you *asleep* until you landed *here*. |
| **IV · The Warden** | Patient One. "The door only opens for the hundredth. The door is mine. So are you." |
| **Epilogue** | The rift opens and the Choir answers: "We counted every fall. We waited for you." |

## The loop: THE LONG NIGHT

The game gives the loop a story reason: **the rift is looping Patient 100.**

- **Dusk:** scavenge Meridian supply caches, shards and Echoes before the storm. You can call the storm early for bonus shards.
- **Storm:** Hollow pour through purple rift tears and attack your **campfire**. Hold it until the last one falls.
- **Dawn:** bank shards and buy **Memories**, which are permanent upgrades: Thick Skin, Muscle Memory, Second Wind, Field Medic, Shard Sense and Firekeeper.
- **Loop reset:** if you fall or the fire dies, you wake again on Night 1. Your Memories survive, and so does the dialogue. Your character remembers dying, and Rhea's lines change every loop.
- **Omens:** each night gets a modifier, for example Blood Moon, Choir Night, The Quiet, Starfall, Iron Hollow, Thin Sky or Drop Fog. Every fifth night the Warden's Echo hunts the fire.
- **Echoes:** 12 ghost recordings of the patients who fell before you, spread across both modes. They build the mystery: *"There's a voice on the radio every time one of us falls. Calls herself Rhea."* The 12th only appears after the other 11, and it's your own voice.

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

**Controls:** `WASD` move · mouse look · `LMB`/`F` swing (×3 combo) · `RMB`/`C` dodge · `Space` jump · `Shift` sprint · `Q` medkit · `E` interact · arrow keys look · `Enter`/`Esc` skip cinematics.

## Code map

| File | Purpose |
| --- | --- |
| `src/script.ts` | Story bible and every line of dialogue, the Echoes, omens and loop-wake lines |
| `src/story.ts` | Chapter One: cold open, stages, cinematics, the boss |
| `src/night.ts` | The Long Night: dusk/storm/dawn, waves, omens, shop, loop reset |
| `src/cinematic.ts` | Letterboxed, skippable camera shots |
| `src/ctx.ts` | Shared renderer, world, actors, HUD helpers, interactions |
| `src/world.ts` | Terrain, sky and moods, wreck, ambulance, campfire, caches, ghosts, rift |
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
