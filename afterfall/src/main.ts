// AFTERFALL — the director. Owns the render loop, the story stages, the HUD,
// and wires the on-chain token into gameplay.

import "./style.css";
import * as THREE from "three";
import { Sfx } from "./audio";
import { EnemyManager } from "./enemies";
import { Input, Player } from "./player";
import { LINKS, TokenLink } from "./token";
import { type SpeakerId, Voice } from "./voice";
import { AMBULANCE, ARENA, BEACON, heightAt, PYLONS, World, WORLD_RADIUS } from "./world";

type Stage = "title" | "intro" | "wake" | "outside" | "ambush" | "pylons" | "boss" | "ending" | "done";

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// ------------------------------------------------------------------ setup
const canvas = $<HTMLCanvasElement>("game");
// `?low` = no shadows, lower resolution, for weaker laptops.
const LOW = new URLSearchParams(location.search).has("low");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: "high-performance" });
renderer.setPixelRatio(LOW ? Math.min(devicePixelRatio, 1) * 0.75 : Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 1400);
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

const world = new World(scene);
const input = new Input(canvas);
const player = new Player(scene);
player.cameraBlockers = world.cameraBlockers;
const enemies = new EnemyManager(scene, world.colliders);
const voice = new Voice();
const sfx = new Sfx();
const token = new TokenLink();

let stage: Stage = "title";
let exited = false;
let shards = 0;
let elapsed = 0;
let runStart = 0;
let paused = false;
let dead = false;
let barkCd = 6;
let activePylon = -1;
let pylonSpawned = 0;
let boss: ReturnType<EnemyManager["spawn"]> | null = null;
const waveTimers: { at: number; n: number }[] = [];
let stageClock = 0;
let checkpoint = new THREE.Vector3(0, 0.36, -1.2);

// ------------------------------------------------------------------ bounds
const AMB_IN = { minX: -0.15, maxX: 0.6, minZ: -2.9, maxZ: 2.95 };
const bounds = {
  groundAt(x: number, z: number) {
    if (x > AMBULANCE.minX && x < AMBULANCE.maxX && z > AMBULANCE.minZ && z < AMBULANCE.maxZ) return 0.36;
    return heightAt(x, z);
  },
  constrain(p: THREE.Vector3, r: number) {
    if (!exited) {
      const doorway = world.doorsOpen > 0.6;
      if (p.z > AMB_IN.maxZ && doorway) {
        p.x = THREE.MathUtils.clamp(p.x, -1.0, 1.0);
      } else {
        p.x = THREE.MathUtils.clamp(p.x, AMB_IN.minX, AMB_IN.maxX);
      }
      p.z = THREE.MathUtils.clamp(p.z, AMB_IN.minZ, doorway ? 8 : AMB_IN.maxZ);
      return;
    }
    for (const c of world.colliders) {
      const dx = p.x - c.x;
      const dz = p.z - c.z;
      const d = Math.hypot(dx, dz);
      const min = c.r + r;
      if (d < min && d > 1e-4) {
        p.x = c.x + (dx / d) * min;
        p.z = c.z + (dz / d) * min;
      }
    }
    // ambulance box (incl. cab)
    const b = { minX: AMBULANCE.minX - r, maxX: AMBULANCE.maxX + r, minZ: AMBULANCE.minZ - 2.1 - r, maxZ: AMBULANCE.maxZ + r };
    if (p.x > b.minX && p.x < b.maxX && p.z > b.minZ && p.z < b.maxZ) {
      const pen = [p.x - b.minX, b.maxX - p.x, p.z - b.minZ, b.maxZ - p.z];
      const i = pen.indexOf(Math.min(...pen));
      if (i === 0) p.x = b.minX;
      else if (i === 1) p.x = b.maxX;
      else if (i === 2) p.z = b.minZ;
      else p.z = b.maxZ;
    }
    const cx = p.x;
    const cz = p.z - 20;
    const d = Math.hypot(cx, cz);
    if (d > WORLD_RADIUS - 5) {
      p.x = (cx / d) * (WORLD_RADIUS - 5);
      p.z = (cz / d) * (WORLD_RADIUS - 5) + 20;
    }
  },
};

// ------------------------------------------------------------------ HUD
const hud = {
  root: $("hud"),
  hp: $("hp-fill"),
  st: $("st-fill"),
  med: $("medkits"),
  shards: $("shards"),
  chapter: $("chapter"),
  objective: $("objective"),
  prompt: $("prompt"),
  marker: $("marker"),
  markerDist: $("marker-dist"),
  bossBar: $("boss"),
  bossFill: $("boss-fill"),
  vignette: $("vignette"),
  perk: $("perk"),
  toast: $("toast"),
  blackout: $("blackout"),
};
let toastTimer = 0;
function toast(msg: string, ms = 2600) {
  hud.toast.textContent = msg;
  hud.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => hud.toast.classList.remove("show"), ms);
}
function setObjective(chapter: string, text: string) {
  hud.chapter.textContent = chapter;
  hud.objective.textContent = text;
  hud.objective.classList.remove("pulse");
  void hud.objective.offsetWidth;
  hud.objective.classList.add("pulse");
}
function fade(to: number, ms = 1200) {
  hud.blackout.style.transition = `opacity ${ms}ms ease`;
  hud.blackout.style.opacity = String(to);
  return wait(ms);
}
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const say = (...lines: [SpeakerId, string][]) => voice.say(lines);

voice.onLine = (id) => {
  if (id === "RHEA" || id === "PILOT") sfx.beep();
};

// ------------------------------------------------------------------ token UI
function renderToken() {
  const info = token.info;
  const sym = info ? `$${info.symbol}` : "token";
  for (const el of document.querySelectorAll<HTMLElement>("[data-token-sym]")) el.textContent = sym;
  const status = $("token-status");
  const connect = $<HTMLButtonElement>("btn-connect");
  const trade = $<HTMLAnchorElement>("btn-trade");
  const launch = $<HTMLAnchorElement>("btn-launch");
  const chip = $("wallet-chip");
  trade.hidden = !token.tokenAddress;
  launch.hidden = !!token.tokenAddress;
  if (token.tokenAddress) trade.href = LINKS.token(token.tokenAddress);
  if (!token.tokenAddress) {
    status.innerHTML = `No game token configured yet. Launch one on vibe/vibe, then set <code>VITE_TOKEN_ADDRESS</code> or add <code>?token=0x…</code> to the URL.`;
  } else if (!token.account) {
    status.innerHTML = `Hold <b>${sym}</b> on Robinhood Chain Testnet to become <b>Rift-Bound</b>: a glowing Rift axe (+50% damage) and an extra medkit.`;
  } else {
    const short = `${token.account.slice(0, 6)}…${token.account.slice(-4)}`;
    status.innerHTML = token.holder
      ? `<span class="ok">● ${short}</span> holds <b>${token.balanceText} ${sym}</b>. You are <b>Rift-Bound</b>.`
      : `<span class="warn">● ${short}</span> holds 0 ${sym}. Grab some on vibe/vibe to unlock the Rift axe.`;
  }
  connect.textContent = token.account ? "Refresh balance" : "Connect wallet";
  chip.hidden = !token.account;
  chip.textContent = token.account ? `${token.account.slice(0, 6)}…${token.account.slice(-4)} · ${token.balanceText} ${sym}` : "";
  player.setRiftBound(token.holder);
  hud.perk.hidden = !token.holder;
}
token.onChange = renderToken;
$("btn-launch").setAttribute("href", LINKS.create);
$("btn-faucet").setAttribute("href", LINKS.faucet);
$("btn-connect").addEventListener("click", async () => {
  const err = token.account ? (await token.refresh(), null) : await token.connect();
  if (err) toast(err, 4000);
  else if (token.holder) toast("Rift-Bound: your axe hums with rift energy.");
});
renderToken();
token.loadInfo();

// ------------------------------------------------------------------ menus
$("btn-start").addEventListener("click", () => {
  sfx.init();
  $("title").classList.add("hidden");
  input.lock();
  startIntro();
});
$("btn-mute").addEventListener("click", () => {
  voice.muted = !voice.muted;
  sfx.setMuted(voice.muted);
  $("btn-mute").textContent = voice.muted ? "Sound: off" : "Sound: on";
});
$("pause").addEventListener("click", () => input.lock());
document.addEventListener("pointerlockchange", () => {
  const playing = !["title", "intro", "done"].includes(stage);
  paused = !input.locked && playing;
  $("pause").classList.toggle("show", paused);
});
// Touch / no-pointer-lock fallback: let the game run without lock.
$("btn-nolock").addEventListener("click", (e) => {
  e.stopPropagation();
  paused = false;
  $("pause").classList.remove("show");
});
$("btn-sign").addEventListener("click", async () => {
  const out = $("sign-out");
  try {
    if (!token.account) {
      const err = await token.connect();
      if (err) throw new Error(err);
    }
    const sig = await token.signRun({ shards, kills: enemies.kills, seconds: Math.round(runStart ? elapsed - runStart : 0) });
    out.textContent = `Signed ✔ ${sig.slice(0, 18)}…${sig.slice(-8)}`;
    navigator.clipboard?.writeText(sig).catch(() => {});
  } catch (e) {
    out.textContent = (e as Error).message.split("\n")[0];
  }
});
$("btn-again").addEventListener("click", () => location.reload());

// ------------------------------------------------------------------ story
async function startIntro() {
  stage = "intro";
  hud.blackout.style.opacity = "1";
  player.frozen = true;
  sfx.siren(true);
  const beat = setInterval(() => sfx.heartbeat(), 1100);
  await wait(600);
  await say(
    ["RHEA", "Stay with me. Patient one hundred, can you hear me? Eyes on me!"],
    ["PILOT", "Mayday, mayday! Medevac one zero zero, both engines are gone. Something is tearing the sky open!"],
    ["RHEA", "Brace! Brace! Brace!"],
  );
  sfx.crash();
  clearInterval(beat);
  $("flash").classList.add("go");
  await wait(2600);
  $("flash").classList.remove("go");
  sfx.siren(false);
  // wake up
  stage = "wake";
  runStart = elapsed;
  hud.root.classList.add("show");
  player.frozen = false;
  player.pitch = 0.35;
  hud.blackout.style.transition = "opacity 4s ease";
  hud.blackout.style.opacity = "0";
  $("blur").classList.add("waking");
  setObjective("PROLOGUE · WAKE", "Look around. Get out of the ambulance.");
  sfx.startAmbience();
  await say(
    ["YOU", "Where... where am I?"],
    ["RHEA", "Hundred? If you can hear this, I was thrown clear. The ambulance came out of the cargo hold. Get out of there. The fuel is leaking."],
  );
  if (stage === "wake" && !player.hasAxe) {
    setObjective("PROLOGUE · WAKE", "Take the fire axe from the wall.");
  }
}

async function goOutside() {
  stage = "outside";
  checkpoint = new THREE.Vector3(0, 0, 6);
  player.firstPerson = false;
  setObjective("CHAPTER 1 · THE DROP", "Reach the plane wreck and find the black-box beacon.");
  await say(
    ["YOU", "Two moons. That's not possible."],
    ["RHEA", "I see them too. We didn't crash on Earth, Hundred. Something pulled us through. Get to the plane. The black-box beacon still has power."],
    ["RHEA", "And those glowing crystals? Rift Shards. My scanner goes crazy around them. Grab every one you see."],
  );
}

async function beaconFound() {
  stage = "ambush";
  stageClock = 0;
  checkpoint = BEACON.clone().add(new THREE.Vector3(3, 0, -4));
  setObjective("CHAPTER 1 · THE DROP", "Hold on…");
  await say(
    ["YOU", "Beacon's alive. The signal is weak."],
    ["RHEA", "There are three towers on the ridges, humming on the same frequency. Light them up and we can boost it."],
  );
  if (stage !== "ambush") return;
  startAmbush();
}

function startAmbush() {
  stageClock = 0;
  waveTimers.length = 0;
  waveTimers.push({ at: 0.2, n: 3 }, { at: 7, n: 2 }, { at: 14, n: 2 });
  sfx.roar();
  setObjective("CHAPTER 2 · THE HOLLOW", "Survive the Hollow ambush.");
  say(["HOLLOW", "Sky-fallers. You bring fire from the sky. You will pay in blood."]);
}

async function ambushCleared() {
  stage = "pylons";
  activePylon = -1;
  setObjective("CHAPTER 3 · RESONANCE", "Activate the resonance pylons (0/3).");
  await say(
    ["RHEA", "They're people, Hundred. Masks, spears. They've been here a long time. Maybe they came through too, long ago."],
    ["RHEA", "Follow the towers. Stand in the ring until it's fully charged. They'll come for you."],
  );
}

const pylonLines: [SpeakerId, string][][] = [
  [["RHEA", "One tower lit! I'm getting static, but there's something under it. A voice?"]],
  [["HOLLOW", "Stop! The towers call the Warden! You wake what sleeps!"], ["RHEA", "Ignore them. One more."]],
  [],
];

async function pylonLit(i: number) {
  const lit = world.pylons.filter((p) => p.lit).length;
  sfx.charge();
  toast(`Pylon ${lit}/3 resonating`);
  checkpoint = PYLONS[i].clone().add(new THREE.Vector3(0, 0, -8));
  activePylon = -1;
  setObjective("CHAPTER 3 · RESONANCE", `Activate the resonance pylons (${lit}/3).`);
  if (lit === 3) {
    stage = "boss";
    checkpoint = ARENA.clone().add(new THREE.Vector3(0, 0, -34));
    setObjective("CHAPTER 4 · THE WARDEN", "Follow the beams north to the stone circle.");
    await say(
      ["RHEA", "All three! The signal is spiking, it's pointing north. To that stone circle."],
      ["UNKNOWN", "Survivor one hundred. Come closer."],
    );
  } else {
    say(...pylonLines[lit - 1]);
  }
}

async function spawnBoss() {
  boss = enemies.spawn("warden", ARENA.clone());
  sfx.roar();
  hud.bossBar.classList.add("show");
  setObjective("CHAPTER 4 · THE WARDEN", "Defeat the Warden. Jump or dodge out of the red ring.");
  await say(
    ["WARDEN", "You wake the old towers. You wake me. I am the Warden of the Drop."],
    ["WARDEN", "Nothing that falls from the sky ever leaves."],
    ["RHEA", "Hundred, the red ring! When it glows, jump or get out of there!"],
  );
}

async function bossDefeated() {
  stage = "ending";
  hud.bossBar.classList.remove("show");
  setObjective("EPILOGUE", "The rift is opening…");
  await say(["WARDEN", "The sky... remembers you..."]);
  for (let i = 0; i <= 40; i++) {
    world.riftOpen = i / 40;
    await wait(50);
  }
  await say(
    ["RHEA", "Hundred! The signal isn't reaching home. It's reaching someone else. Someone is answering!"],
    ["UNKNOWN", "Survivor one hundred. We have been waiting a very long time. Step through."],
    ["YOU", "Rhea. Find me on the other side."],
  );
  await fade(1, 2500);
  stage = "done";
  document.exitPointerLock?.();
  hud.root.classList.remove("show");
  const secs = Math.round(elapsed - runStart);
  $("end-shards").textContent = `${shards} / ${world.shards.length}`;
  $("end-kills").textContent = String(enemies.kills);
  $("end-time").textContent = `${Math.floor(secs / 60)}m ${secs % 60}s`;
  $("end").classList.add("show");
}

// ------------------------------------------------------------------ interactions
interface Interact {
  pos: () => THREE.Vector3;
  r: number;
  label: string;
  when: () => boolean;
  run: () => void;
}
const interacts: Interact[] = [
  {
    pos: () => new THREE.Vector3(-1.0, 0.36, 1.6),
    r: 1.6,
    label: "Take the fire axe",
    when: () => stage === "wake" && !player.hasAxe,
    run: () => {
      player.equipAxe();
      world.axeProp.visible = false;
      sfx.pickup();
      toast("Fire axe: Left click (or F) to swing");
      setObjective("PROLOGUE · WAKE", "Open the rear doors.");
    },
  },
  {
    pos: () => new THREE.Vector3(0, 0.36, 3.0),
    r: 1.7,
    label: "Kick open the rear doors",
    when: () => stage === "wake" && player.hasAxe && world.doorsTarget === 0,
    run: () => {
      world.doorsTarget = 1;
      sfx.door();
      player.shake = 0.3;
      setObjective("PROLOGUE · WAKE", "Step outside.");
    },
  },
  {
    pos: () => BEACON,
    r: 2.6,
    label: "Check the black-box beacon",
    when: () => stage === "outside",
    run: () => {
      sfx.beep();
      beaconFound();
    },
  },
  ...PYLONS.map((p, i) => ({
    pos: () => p,
    r: 6,
    label: "Touch the pylon",
    when: () => stage === "pylons" && activePylon === -1 && !world.pylons[i].lit,
    run: () => {
      activePylon = i;
      pylonSpawned = 0;
      world.pylons[i].charge = 0.01;
      sfx.charge();
      enemies.spawnAround(p, 3);
      say(["HOLLOW", "The tower sings! Kill the sky-faller!"]);
      setObjective("CHAPTER 3 · RESONANCE", "Stay inside the ring while the pylon charges.");
    },
  })),
];

// ------------------------------------------------------------------ hooks
player.onSwing = () => sfx.swing();
player.onDash = () => sfx.dash();
player.onHurt = () => {
  sfx.hurt();
  hud.vignette.classList.remove("hit");
  void hud.vignette.offsetWidth;
  hud.vignette.classList.add("hit");
};
player.onSwingHit = (facing, dmg) => {
  const n = enemies.hit(player.pos, facing, 2.7, 1.2, dmg);
  if (n) sfx.hit();
  return n;
};
enemies.onSlam = () => {
  sfx.slam();
  player.shake = 0.5;
};
enemies.onSummon = () => {
  say(["WARDEN", "Children of the Drop! To me!"]);
};
enemies.onDeath = (e) => {
  if (e.kind === "warden") bossDefeated();
};

async function die() {
  dead = true;
  voice.interrupt();
  $("dead").classList.add("show");
  await wait(1200);
  say(["RHEA", "Hundred! Get up! Don't you dare quit on me!"]);
  await wait(2200);
  // respawn at the checkpoint, reset the current fight
  enemies.clear();
  player.pos.copy(checkpoint);
  player.pos.y = bounds.groundAt(checkpoint.x, checkpoint.z);
  player.hp = player.maxHp;
  player.medkits = Math.max(player.medkits, 1);
  player.invuln = 2;
  if (stage === "ambush") startAmbush();
  if (stage === "pylons" && activePylon >= 0) {
    world.pylons[activePylon].charge = 0;
    activePylon = -1;
    setObjective("CHAPTER 3 · RESONANCE", `Activate the resonance pylons (${world.pylons.filter((p) => p.lit).length}/3).`);
  }
  if (stage === "boss" && boss) {
    boss = null;
    hud.bossBar.classList.remove("show");
    setObjective("CHAPTER 4 · THE WARDEN", "Return to the stone circle.");
  }
  $("dead").classList.remove("show");
  dead = false;
}

// ------------------------------------------------------------------ objective marker
function objectiveTarget(): THREE.Vector3 | null {
  switch (stage) {
    case "wake":
      return null;
    case "outside":
      return BEACON;
    case "pylons": {
      if (activePylon >= 0) return null;
      let best: THREE.Vector3 | null = null;
      let bd = Infinity;
      world.pylons.forEach((p) => {
        if (p.lit) return;
        const d = p.pos.distanceTo(player.pos);
        if (d < bd) {
          bd = d;
          best = p.pos;
        }
      });
      return best;
    }
    case "boss":
      return boss ? null : ARENA;
    default:
      return null;
  }
}
const v = new THREE.Vector3();
function updateMarker() {
  const t = objectiveTarget();
  if (!t) {
    hud.marker.style.display = "none";
    return;
  }
  hud.marker.style.display = "block";
  v.set(t.x, t.y + 3, t.z).project(camera);
  const behind = v.z > 1;
  let x = v.x;
  let y = v.y;
  if (behind) {
    x = -x;
    y = -y;
  }
  const m = 0.88;
  if (behind || Math.abs(x) > m || Math.abs(y) > m) {
    const s = m / Math.max(Math.abs(x), Math.abs(y), 1e-3);
    x *= s;
    y *= s;
  }
  hud.marker.style.left = `${((x + 1) / 2) * innerWidth}px`;
  hud.marker.style.top = `${((1 - y) / 2) * innerHeight}px`;
  hud.markerDist.textContent = `${Math.round(Math.hypot(t.x - player.pos.x, t.z - player.pos.z))}m`;
}

// ------------------------------------------------------------------ main loop
const timer = new THREE.Timer();
let healCd = 0;

function tick(now?: number) {
  requestAnimationFrame(tick);
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 1 / 20);
  const running = !paused && !dead && stage !== "title" && stage !== "done";
  if (running) elapsed += dt;
  const t = timer.getElapsed();

  if (stage === "title") {
    // slow orbit of the crash site behind the title screen
    const a = t * 0.05;
    camera.position.set(Math.sin(a) * 26 - 6, 7, Math.cos(a) * 26 + 18);
    camera.lookAt(-6, 2, 20);
    player.model.root.visible = false;
  } else if (stage === "done") {
    // keep the last frame
  } else if (!paused) {
    if (!dead) player.update(dt, input, bounds, camera);
    else camera.position.y += (player.pos.y + 0.6 - camera.position.y) * dt; // collapse

    if (running) updateStage(dt);
    enemies.update(running ? dt : 0, t, player);
  }
  world.update(dt, t, player.pos);

  // HUD
  hud.hp.style.width = `${(player.hp / player.maxHp) * 100}%`;
  hud.st.style.width = `${player.stamina}%`;
  hud.med.textContent = String(player.medkits);
  hud.shards.textContent = String(shards);
  hud.root.classList.toggle("low", player.hp < 30);
  if (boss) hud.bossFill.style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;
  updateMarker();

  renderer.render(scene, camera);
  input.endFrame();
}

function updateStage(dt: number) {
  stageClock += dt;
  healCd -= dt;

  if (player.hp <= 0 && !dead) {
    die();
    return;
  }
  if (input.tap("KeyQ") && healCd <= 0) {
    if (player.heal()) {
      sfx.heal();
      toast("Medkit used (+45)");
    }
    healCd = 0.6;
  }

  // leaving the ambulance
  if (stage === "wake" && !exited && player.pos.z > 3.9) {
    exited = true;
    goOutside();
  }

  // interactions
  let near: Interact | null = null;
  let nd = Infinity;
  for (const it of interacts) {
    if (!it.when()) continue;
    const p = it.pos();
    const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z);
    if (d < it.r && d < nd) {
      near = it;
      nd = d;
    }
  }
  hud.prompt.classList.toggle("show", !!near);
  if (near) {
    hud.prompt.innerHTML = `<kbd>E</kbd> ${near.label}`;
    if (input.tap("KeyE")) near.run();
  }

  // shards
  if (exited) {
    const reach = player.riftBound ? 3.2 : 1.8;
    for (const s of world.shards) {
      if (s.taken) continue;
      if (s.mesh.position.distanceTo(new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z)) < reach) {
        s.taken = true;
        s.mesh.visible = false;
        shards++;
        sfx.pickup();
        if (shards === 1) toast("Rift Shard collected. They resonate with the token on-chain…", 3500);
      }
    }
  }

  // ambush waves
  if (stage === "ambush") {
    for (const w of waveTimers) {
      if (w.n > 0 && stageClock >= w.at) {
        enemies.spawnAround(player.pos, w.n, 15, 20);
        w.n = 0;
      }
    }
    if (waveTimers.length && waveTimers.every((w) => w.n === 0) && enemies.aliveCount === 0) {
      waveTimers.length = 0;
      ambushCleared();
    }
  }

  // pylon charging
  if (stage === "pylons" && activePylon >= 0) {
    const p = world.pylons[activePylon];
    const inside = Math.hypot(p.pos.x - player.pos.x, p.pos.z - player.pos.z) < 6;
    if (inside) p.charge = Math.min(1, p.charge + dt / 14);
    hud.objective.textContent = inside
      ? `Charging pylon… ${Math.round(p.charge * 100)}%`
      : "Get back inside the ring!";
    if (p.charge > 0.45 && pylonSpawned === 0) {
      pylonSpawned = 1;
      enemies.spawnAround(p.pos, 2 + activePylon);
    }
    if (p.charge >= 1 && !p.lit) {
      p.lit = true;
      pylonLit(activePylon);
    }
  }

  // boss trigger
  if (stage === "boss" && !boss && Math.hypot(player.pos.x - ARENA.x, player.pos.z - ARENA.z) < 26) {
    spawnBoss();
  }

  // ambient Hollow barks during fights
  barkCd -= dt;
  if (barkCd <= 0 && enemies.aliveCount > 0 && !voice.busy) {
    barkCd = 9 + Math.random() * 6;
    const barks = ["For the Drop!", "Sky-faller!", "Your blood feeds the towers!", "Surround it!", "The Warden watches!"];
    say(["HOLLOW", barks[Math.floor(Math.random() * barks.length)]]);
  }
}

tick();

// debug / testing hook
(window as unknown as Record<string, unknown>).__afterfall = {
  get stage() {
    return stage;
  },
  player,
  enemies,
  world,
  skip(to: Stage) {
    voice.interrupt();
    $("title").classList.add("hidden");
    hud.root.classList.add("show");
    hud.blackout.style.opacity = "0";
    sfx.init();
    player.frozen = false;
    player.hasAxe || player.equipAxe();
    world.doorsTarget = 1;
    exited = true;
    player.firstPerson = false;
    stage = to;
    runStart = elapsed;
    if (to === "outside") goOutside();
    if (to === "ambush") {
      player.pos.copy(BEACON).add(new THREE.Vector3(3, 0, -4));
      startAmbush();
    }
    if (to === "pylons") ambushCleared();
    if (to === "boss") {
      world.pylons.forEach((p) => (p.lit = true));
      player.pos.set(0, heightAt(0, 128), 128);
    }
  },
};
