# AFTERFALL

A voiced 3D survival story built for the [vibe/vibe](https://testnet.vibevibe.fun) hackathon on **Robinhood Chain Testnet**.

> Medevac Flight 100 never landed. Something tore the sky open and pulled it through.
> You wake up strapped in the back of a wrecked ambulance, under two moons, in a world
> that has been waiting for people like you to fall.

## Story (Chapter One)

| Stage | What happens |
| --- | --- |
| **Prologue: Wake** | A black screen with a heartbeat and a dying siren. Rhea, the flight medic, and the pilot call the crash. You wake up in first person inside the ambulance, take the fire axe off the wall and kick open the doors. |
| **Ch.1 The Drop** | The camera pulls out to third person and you see an alien world with two moons. Rhea, alive somewhere, guides you over the radio to the plane wreck's black-box beacon. Pick up **Rift Shards** along the way. |
| **Ch.2 The Hollow** | Masked natives who fell through long ago ambush you in waves. |
| **Ch.3 Resonance** | Light three resonance pylons. You have to stand in each ring while it charges and the Hollow swarm you. |
| **Ch.4 The Warden** | The boss fight in the stone circle. He has telegraphed swings and a red-ring ground slam (jump or dodge out of it), and summons minions at 66% and 33% health. |
| **Epilogue** | The rift opens and *someone on the other side answers*. To be continued. |

Every line is spoken with the browser's built-in **Web Speech API**, so it needs no API keys or audio files. Each character has their own voice, pitch and rate (Rhea, You, the Pilot, the Hollow, the Warden, and an unknown voice). Subtitles always show. All sound effects (siren, heartbeat, crash, hits, wind) are generated at runtime with WebAudio.

## Token integration (Robinhood Chain Testnet, chain ID 46630)

- **Launch the token on vibe/vibe**: [testnet.vibevibe.fun/create](https://testnet.vibevibe.fun/create). Get testnet ETH from the [faucet](https://faucet.testnet.chain.robinhood.com).
- **Plug it into the game**: set `VITE_TOKEN_ADDRESS=0x…` (see `.env.example`), or just add `?token=0x…` to the game URL.
- **Holders become Rift-Bound**. Connect a wallet on the title screen. If it holds any of the token, you get a glowing Rift axe (+50% damage), an extra medkit and a bigger shard pickup radius. The game reads `balanceOf` directly from `https://rpc.testnet.chain.robinhood.com` with viem, and adds or switches the wallet to chain 46630 automatically.
- **Trade link**: when a token is configured, the title screen links straight to its vibe/vibe page (`/t/<address>`).
- **Proof of play**: the end screen lets the player sign their run (shards, kills, time, token, chain) with their wallet. It costs no gas and sends no transaction.

## Run it

```bash
cd afterfall
npm install
npm run dev        # http://localhost:5173
npm run build      # static site in dist/
```

Deploy `dist/` anywhere static: Vercel (set the root directory to `afterfall`, framework Vite), Netlify or GitHub Pages.

Append `?low` to the URL on weaker laptops. It turns off shadows and lowers the resolution.

## Controls

`WASD` move · mouse look · `LMB`/`F` swing · `RMB`/`C` dodge (brief invulnerability) · `Space` jump · `Shift` sprint · `Q` medkit · `E` interact · arrow keys look if you have no mouse.

## Code map

| File | Purpose |
| --- | --- |
| `src/main.ts` | Story director: stages, dialogue, HUD, interactions, checkpoints, render loop |
| `src/world.ts` | Terrain, shader sky with two moons and aurora, ambulance, plane wreck, forest, pylons, rift arena, particles |
| `src/player.ts` | Input, first-person to third-person controller, combat, dodge, camera collision |
| `src/enemies.ts` | Hollow and Warden AI (chase → telegraphed wind-up → strike → recover, ground slam, summons) |
| `src/models.ts` | Procedural low-poly characters and weapons |
| `src/voice.ts` | Voiced dialogue and subtitles |
| `src/audio.ts` | Procedural WebAudio SFX |
| `src/token.ts` | Robinhood Chain Testnet wallet connection, token balance and run signing (viem) |

Testnet only. No real funds.
