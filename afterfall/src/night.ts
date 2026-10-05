// THE LONG NIGHT — the replayable loop, solo or co-op.
//
//   DUSK   scavenge supply caches, shards and Echoes before the storm
//   STORM  the rift spits Hollow at your campfire; hold it until the last falls
//   DAWN   bank shards, buy Memories (permanent upgrades), face the next night
//   RESET  if the fire dies (or everyone falls) the loop resets to Night 1, but
//          Memories, banked shards and Echoes carry over. That's the story
//          reason the game repeats: the rift is looping Patient 10001.
//
// Co-op: the room's host runs this director (timers, spawns, campfire) and
// streams it; everyone else mirrors it. Loot is per player.

import * as THREE from "three";
import {
  $,
  applyMemories,
  card,
  collectShard,
  enemies,
  fade,
  hud,
  type Interact,
  input,
  persist,
  pick,
  pickupShards,
  player,
  runInteractions,
  say,
  sfx,
  state,
  toast,
  voice,
  wait,
  world,
} from "./ctx";
import { echoProgress, listenEcho, spawnEcho, unfoundEchoes } from "./echo";
import type { Enemy, EnemyKind, EnemySnap, FireLike } from "./enemies";
import { net } from "./net";
import { MEMORIES, playerName, save } from "./save";
import * as S from "./script";
import { CAMP, heightAt, WORLD_RADIUS } from "./world";

type Phase = "dusk" | "storm" | "dawn" | "over";

export const night = {
  n: 1,
  phase: "dusk" as Phase,
  omen: S.FIRST_NIGHT_OMEN as S.Omen,
  boss: null as Enemy | null,
};

/** Everything a client needs to set up the same night as the host. */
export interface NightStart {
  n: number;
  om: string;
  caches: [number, number][];
  echo: [number, number, number] | null;
  loop: boolean;
}

let phaseT = 0;
let toSpawn = 0;
let spawnTimer = 0;
let spawnGap = 6;
let kills = 0;
let fireWarned = false;
let barkCd = 8;
let loopShards = 0;
let bestThisLoop = 0;
let resetReason = "";
let lastStart: NightStart | null = null;
let downFor = 0;
let syncT = 0;

const ALL_OMENS = [S.FIRST_NIGHT_OMEN, S.WARDEN_OMEN, ...S.OMENS];

const fire: FireLike = {
  pos: CAMP,
  get alive() {
    return world.campfire.lit && world.campfire.hp > 0;
  },
  damage(n: number) {
    if (night.phase !== "storm" || net.isClient) return;
    world.campfire.hp = Math.max(0, world.campfire.hp - n);
    if (world.campfire.hp <= 0) loopReset("The fire went out.");
  },
};

// ------------------------------------------------------------------ setup
function randomSpot(minR: number, maxR: number) {
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = minR + Math.random() * (maxR - minR);
    const x = CAMP.x + Math.cos(a) * r;
    const z = CAMP.z + Math.sin(a) * r;
    if (Math.hypot(x, z - 20) > WORLD_RADIUS - 15) continue;
    if (world.colliders.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + 1.5)) continue;
    return { x, z };
  }
  return { x: CAMP.x + minR, z: CAMP.z };
}

/** Wake at the camp. Co-op clients then wait for the host's night. */
export async function startLongNight(fromReset = false, ns?: NightStart) {
  state.mode = "night";
  state.dead = false;
  voice.interrupt();
  enemies.clear();
  enemies.puppet = net.isClient;
  world.clearCaches();
  world.clearDynamicShards();
  for (const g of [...world.ghosts]) world.removeGhost(g);
  // Post-story world: towers lit, rift unstable, ambulance open.
  world.doorsTarget = 1;
  world.axeProp.visible = false;
  world.pylons.forEach((p) => (p.lit = true));
  world.riftOpen = 0.45;
  state.exited = true;
  player.equipAxe();
  player.firstPerson = false;
  player.frozen = false;
  player.camDist = 5;
  applyMemories();
  const spread = net.active ? (net.id % 6) * 1.1 - 2.8 : -1.5;
  player.pos.set(CAMP.x + spread, heightAt(CAMP.x, CAMP.z - 3), CAMP.z - 3);
  player.yaw = 0;
  player.pitch = 0.1;
  hud.root.classList.add("show");
  hud.fire.hidden = false;
  $("night-chip").hidden = false;
  $("shop").classList.remove("show");
  enemies.fire = fire;
  night.n = 1;
  night.phase = "dusk";
  loopShards = 0;
  bestThisLoop = 0;
  downFor = 0;
  state.runShards = 0;
  state.runStart = state.elapsed;
  sfx.startAmbience();
  await fade(0, 1500);

  const lines = !fromReset && save.loops === 0 ? S.NIGHT_INTRO_FIRST : S.LOOP_WAKE[Math.min(save.loops, S.LOOP_WAKE.length - 1)];
  if (fromReset) {
    card(`Loop ${save.loops + 1}`, "Wake again", "Same moons. Same fire. You remember more.", 3000);
    await wait(3100);
  }
  if (net.isClient) {
    if (ns) applyNightStart(ns);
    else setWaiting();
  } else startNight();
  if (lines.length) say(lines);
}

function setWaiting() {
  hud.chapter.textContent = `Room ${net.room}`;
  hud.objective.textContent = "Joining the night…";
}

/** Host: decide the night, apply it, and send it to the room. */
function startNight() {
  const n = night.n;
  const omen = n === 1 ? S.FIRST_NIGHT_OMEN : n % 5 === 0 ? S.WARDEN_OMEN : pick(S.OMENS);
  const caches: [number, number][] = [];
  for (let i = 0; i < Math.min(6, 3 + Math.floor(n / 3)); i++) {
    const p = randomSpot(22, 85);
    caches.push([Math.round(p.x * 10) / 10, Math.round(p.z * 10) / 10]);
  }
  let echo: NightStart["echo"] = null;
  const pool = unfoundEchoes();
  if (pool.length && Math.random() < 0.5 + (omen.echo ?? 0)) {
    const p = randomSpot(35, 95);
    echo = [pick(pool), p.x, p.z];
  }
  const ns: NightStart = { n, om: omen.id, caches, echo, loop: false };
  lastStart = ns;
  applyNightStart(ns);
  if (net.active) net.send({ t: "ns", ...ns });
}

function applyNightStart(ns: NightStart) {
  const n = ns.n;
  night.n = n;
  night.phase = "dusk";
  night.boss = null;
  night.omen = ALL_OMENS.find((o) => o.id === ns.om) ?? S.FIRST_NIGHT_OMEN;
  hud.bossBar.classList.remove("show");
  $("shop").classList.remove("show");
  phaseT = n === 1 ? 80 : 65;
  kills = 0;
  fireWarned = false;
  world.setMood(night.omen.fog ? "fog" : "dusk", night.omen.fog);
  world.setCampfire(true, 100 + save.mem.keeper * 30);
  player.medkits = Math.max(player.medkits, 1 + save.mem.medic + (player.riftBound ? 1 : 0));
  world.clearCaches();
  world.clearDynamicShards();
  for (const [x, z] of ns.caches) world.spawnCache(x, z);
  if (night.omen.starfall) {
    for (let i = 0; i < 18; i++) {
      const p = randomSpot(10, 70);
      world.addShard(p.x, p.z, true, 2);
    }
  }
  for (const g of [...world.ghosts]) world.removeGhost(g);
  if (ns.echo && !save.echoes.includes(ns.echo[0])) spawnEcho(ns.echo[0], ns.echo[1], ns.echo[2]);
  $("night-chip").textContent = `Night ${n}`;
  card(`Night ${n}`, night.omen.name, night.omen.text, 3800);
  const opener = n - 1 < S.NIGHT_OPENERS.length ? S.NIGHT_OPENERS[n - 1] : pick(S.NIGHT_OPENERS);
  setTimeout(() => {
    if (night.phase === "dusk" && state.mode === "night") say(opener);
  }, 4200);
}

/** Mood, sound and lines when the storm hits (everyone). */
function stormHits() {
  night.phase = "storm";
  const o = night.omen;
  world.setMood(o.blood ? "blood" : o.fog ? "fog" : "storm", o.fog);
  sfx.roar();
  sfx.rumble();
  toast(net.active ? "The storm is here. Hold the fire together." : "The storm is here. Defend the fire.", 3000);
  if (o.id === "warden") {
    hud.bossName.textContent = "Warden's Echo";
    hud.bossBar.classList.add("show");
    say([["WARDEN", "I was the first. I will be the last thing you see. Again."]]);
  } else {
    say([["RHEA", pick(["Here they come. Stay near the fire!", "Rift's opening. Hold the light, {name}!", "I can hear them from here. Fire. Now."])]]);
  }
}

/** Host: the storm begins and the waves are queued. */
function beginStorm() {
  const n = night.n;
  const o = night.omen;
  stormHits();
  toSpawn = 6 + n * 3 + (o.bias ? 2 : 0) + Math.max(0, net.peers.size) * 2;
  spawnGap = (n > 5 ? 4.5 : 6) * (o.waveGap ?? 1);
  spawnTimer = 1;
  if (o.id === "warden") {
    const p = randomSpot(24, 28);
    tear(p.x, p.z, true);
    night.boss = enemies.spawn("warden", new THREE.Vector3(p.x, 0, p.z), { hpMul: (0.7 + n * 0.06) * (1 + net.peers.size * 0.5), dmgMul: 0.9 });
  }
}

function tear(x: number, z: number, big = false) {
  world.spawnTear(x, z, big);
  if (net.active) net.send({ t: "tear", x, z, big });
}

function spawnGroup() {
  const n = night.n;
  const o = night.omen;
  const size = Math.min(toSpawn, 2 + Math.floor(n / 2));
  const weights: [EnemyKind, number][] = [
    ["hollow", 5],
    ["runner", n >= 2 ? 2 + n * 0.3 : 0],
    ["shaman", n >= 3 ? 1.5 : 0],
    ["brute", n >= 4 ? 1 : 0],
  ];
  if (o.bias) for (const w of weights) if (w[0] === o.bias) w[1] += 4;
  const total = weights.reduce((a, w) => a + w[1], 0);
  const base = randomSpot(26, 34);
  for (let i = 0; i < size; i++) {
    let r = Math.random() * total;
    let kind: EnemyKind = "hollow";
    for (const [k, w] of weights) {
      r -= w;
      if (r <= 0) {
        kind = k;
        break;
      }
    }
    const x = base.x + (Math.random() - 0.5) * 6;
    const z = base.z + (Math.random() - 0.5) * 6;
    tear(x, z);
    enemies.spawn(kind, new THREE.Vector3(x, 0, z), {
      hpMul: 1 + 0.12 * (n - 1),
      dmgMul: (1 + 0.07 * (n - 1)) * (o.dmg ?? 1),
      speedMul: o.speed ?? 1,
      rise: false,
    });
  }
  toSpawn -= size;
}

async function dawn() {
  night.phase = "dawn";
  hud.bossBar.classList.remove("show");
  world.setMood("dawn");
  const bonus = 5 + night.n * 3;
  collectShard(bonus);
  loopShards += bonus;
  bestThisLoop = night.n;
  save.bestNight = Math.max(save.bestNight, night.n);
  persist();
  sfx.sting();
  player.hp = player.maxHp;
  state.dead = false;
  $("dead").classList.remove("show");
  card("Dawn", `Night ${night.n} survived`, `+${bonus} shards · ${kills} Hollow fell`, 3000);
  say(pick(S.DAWN_LINES));
  await wait(3200);
  if (night.phase !== "dawn") return;
  openShop("dawn");
}

// ------------------------------------------------------------------ loop reset
async function loopReset(reason: string) {
  if (night.phase === "over") return;
  night.phase = "over";
  resetReason = reason;
  if (net.active && !net.isClient) net.send({ t: "w", ph: "over", pt: 0, fh: 0, fm: world.campfire.maxHp, e: [], rr: reason });
  state.dead = true;
  voice.interrupt();
  save.loops++;
  save.bestNight = Math.max(save.bestNight, bestThisLoop);
  persist();
  sfx.rumble();
  $("dead").classList.add("show");
  $("dead-title").textContent = "The loop resets";
  $("dead-sub").textContent = reason;
  await wait(2600);
  $("dead").classList.remove("show");
  $("dead-title").textContent = "You went down";
  $("dead-sub").textContent = "Rhea's voice cuts through the static.";
  openShop("over");
}

// ------------------------------------------------------------------ co-op: going down
/** In co-op you don't loop alone: you go down and Rhea talks you back up. */
function goDown() {
  state.dead = true;
  downFor = 7;
  voice.interrupt();
  $("dead").classList.add("show");
  $("dead-title").textContent = "You went down";
  $("dead-sub").textContent = "Hold on. The others are still fighting.";
  say([["RHEA", "{name}! Stay down, breathe. I'm talking you back up."]]);
}

function getUp() {
  state.dead = false;
  $("dead").classList.remove("show");
  player.pos.set(CAMP.x + (Math.random() - 0.5) * 3, heightAt(CAMP.x, CAMP.z - 3), CAMP.z - 3);
  player.hp = Math.round(player.maxHp * 0.6);
  player.invuln = 2.5;
  toast("Back on your feet");
}

// ------------------------------------------------------------------ shop
function openShop(kind: "dawn" | "over") {
  document.exitPointerLock?.();
  const el = $("shop");
  const waiting = net.isClient;
  $("shop-kicker").textContent = kind === "dawn" ? `Dawn. Night ${night.n} survived` : `Loop ${save.loops} ended. Best night ${save.bestNight}`;
  $("shop-title").textContent = kind === "dawn" ? "Memories" : "The loop resets";
  $("shop-sub").textContent =
    kind === "dawn"
      ? "Rift Shards become Memories. Memories survive every reset."
      : `${resetReason} You survived ${bestThisLoop} night${bestThisLoop === 1 ? "" : "s"} and banked ${loopShards + state.runShards} shards.`;
  const go = $<HTMLButtonElement>("shop-go");
  go.textContent = waiting ? "Ready" : kind === "dawn" ? `Face Night ${night.n + 1}` : "Wake again";
  go.onclick = () => {
    el.classList.remove("show");
    input.lock();
    if (waiting) {
      hud.objective.textContent = "Waiting for the host to start the night…";
      return;
    }
    if (kind === "dawn") {
      night.n++;
      startNight();
    } else {
      fade(1, 600).then(() => startLongNight(true));
    }
  };
  renderShop();
  el.classList.add("show");
}

export function renderShop() {
  $("shop-bank").textContent = String(save.bank);
  $("shop-echoes").textContent = echoProgress();
  const list = $("shop-list");
  list.innerHTML = "";
  for (const m of MEMORIES) {
    const lvl = save.mem[m.id];
    const maxed = lvl >= m.max;
    const cost = maxed ? 0 : m.cost(lvl);
    const row = document.createElement("div");
    row.className = "mem";
    row.innerHTML = `
      <div class="mem-info"><b>${m.name}</b><span>${m.desc}</span>
        <div class="pips">${Array.from({ length: m.max }, (_, i) => `<i class="${i < lvl ? "on" : ""}"></i>`).join("")}</div></div>`;
    const btn = document.createElement("button");
    btn.className = maxed ? "btn" : save.bank >= cost ? "btn primary" : "btn";
    btn.textContent = maxed ? "Complete" : `Buy · ${cost}`;
    btn.disabled = maxed || save.bank < cost;
    btn.onclick = () => {
      if (save.bank < cost) return;
      save.bank -= cost;
      save.mem[m.id]++;
      persist();
      sfx.coin();
      const hp = player.hp;
      applyMemories();
      player.hp = Math.min(player.maxHp, hp + 15);
      renderShop();
    };
    row.appendChild(btn);
    list.appendChild(row);
  }
}

// ------------------------------------------------------------------ co-op wire
/** Host: what joiners need to catch up. */
export function nightCatchUp(to: number) {
  if (lastStart && state.mode === "night") net.send({ t: "ns", to, ...lastStart });
}

export function onNetNightStart(ns: NightStart) {
  if (!net.isClient) return;
  lastStart = ns;
  if (state.mode !== "night" || night.phase === "over") startLongNight(night.phase === "over", ns);
  else applyNightStart(ns);
}

export function onNetWorld(m: { ph: Phase; pt: number; fh: number; fm: number; e: EnemySnap[]; rr: string }) {
  if (!net.isClient || state.mode !== "night") return;
  phaseT = m.pt;
  world.campfire.maxHp = m.fm;
  world.campfire.hp = m.fh;
  enemies.applySnapshot(m.e);
  if (m.ph !== night.phase) {
    if (m.ph === "storm" && night.phase === "dusk") stormHits();
    else if (m.ph === "dawn" && night.phase === "storm") dawn();
    else if (m.ph === "over") loopReset(m.rr || "The loop resets.");
  }
}

/** Promoted to host mid-night (the old host left): take over the world. */
export function becomeHost() {
  enemies.puppet = false;
  if (state.mode !== "night") return;
  for (const e of enemies.list) e.netPos = null;
  if (night.phase === "storm") {
    toSpawn = 0;
    night.boss = enemies.list.find((e) => e.kind === "warden" && e.alive) ?? null;
  }
  if (!lastStart) startNight();
}

// ------------------------------------------------------------------ per frame
const interacts = (): Interact[] => {
  const list: Interact[] = world.caches
    .filter((c) => !c.opened)
    .map((c) => ({
      pos: () => c.pos,
      r: 2.2,
      label: "Open the Meridian supply cache",
      when: () => night.phase === "dusk" || night.phase === "storm",
      run: () => {
        world.openCache(c);
        sfx.door();
        const mul = night.omen.shardMul ?? 1;
        const n = (4 + Math.floor(Math.random() * 5)) * mul;
        for (let i = 0; i < n; i++) world.addShard(c.pos.x + (Math.random() - 0.5) * 3, c.pos.z + (Math.random() - 0.5) * 3, true);
        if (Math.random() < 0.35) {
          player.medkits++;
          toast(`Cache: ${n} shards and a medkit`);
        } else toast(`Cache: ${n} shards`);
      },
    }));
  for (const g of world.ghosts) {
    list.push({ pos: () => g.pos, r: 2.4, label: `Listen to the Echo <span class="dim">${echoProgress()}</span>`, when: () => true, run: () => listenEcho(g) });
  }
  list.push({
    pos: () => CAMP,
    r: 2.6,
    label: 'Call the storm early <span class="dim">+10 shards</span>',
    when: () => night.phase === "dusk" && phaseT > 5 && !net.isClient,
    run: () => {
      collectShard(10);
      loopShards += 10;
      sfx.coin();
      phaseT = 0;
    },
  });
  return list;
};

export function nightTarget(): THREE.Vector3 | null {
  const far = Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) > 14;
  if (night.phase === "storm") return far ? CAMP : null;
  if (night.phase === "dusk") {
    if (phaseT < 20) return far ? CAMP : null;
    let best: THREE.Vector3 | null = null;
    let bd = Infinity;
    for (const c of world.caches) {
      if (c.opened) continue;
      const d = c.pos.distanceTo(player.pos);
      if (d < bd) {
        bd = d;
        best = c.pos;
      }
    }
    return best;
  }
  return null;
}

export function nightOnDeath(e: Enemy) {
  if (state.mode !== "night") return;
  kills++;
  const mul = night.omen.shardMul ?? 1;
  if (e.kind === "warden") {
    for (let i = 0; i < 12; i++) world.addShard(e.pos.x + (Math.random() - 0.5) * 5, e.pos.z + (Math.random() - 0.5) * 5, true, mul);
    say([["WARDEN", "Patient One. Discharged. Again."]]);
    hud.bossBar.classList.remove("show");
  } else if (Math.random() < (e.kind === "brute" ? 1 : 0.55)) {
    world.addShard(e.pos.x, e.pos.z, true, mul * (e.kind === "brute" ? 3 : 1));
  }
  if (night.omen.quiet && !state.dead) player.hp = Math.min(player.maxHp, player.hp + 6);
}

/** Runs every frame in the Long Night, also while you're down in co-op. */
export function nightUpdate(dt: number) {
  if (night.phase === "over") return;
  const host = !net.isClient;

  // falling
  if (!state.dead && player.hp <= 0) {
    if (net.active) goDown();
    else {
      loopReset("You fell in the dark.");
      return;
    }
  }
  if (state.dead && downFor > 0) {
    downFor -= dt;
    if (downFor <= 0) getUp();
  }
  if (host && net.active && state.dead && enemies.others.every((o) => o.down)) {
    loopReset("Everyone fell. The dark takes the fire.");
    return;
  }

  if (!state.dead) {
    runInteractions(interacts());
    pickupShards();
  }

  const cf = world.campfire;
  hud.fireFill.style.width = `${(cf.hp / cf.maxHp) * 100}%`;
  hud.chapter.textContent = `Night ${night.n} · ${night.omen.name}`;
  const boss = night.boss?.alive ? night.boss : enemies.list.find((e) => e.kind === "warden" && e.alive);
  if (boss) hud.bossFill.style.width = `${Math.max(0, boss.hp / boss.maxHp) * 100}%`;

  if (night.phase === "dusk") {
    if (host) phaseT -= dt;
    const s = Math.max(0, Math.ceil(phaseT));
    const left = world.caches.filter((c) => !c.opened).length;
    hud.objective.textContent =
      phaseT > 20
        ? `Scavenge before the storm · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} · ${left} cache${left === 1 ? "" : "s"} left`
        : `Storm in ${s}s · get back to the fire!`;
    if (host && phaseT <= 0) beginStorm();
  } else if (night.phase === "storm") {
    const alive = enemies.aliveCount;
    if (host) {
      spawnTimer -= dt;
      if (toSpawn > 0 && spawnTimer <= 0) {
        spawnTimer = spawnGap;
        spawnGroup();
      }
      if (toSpawn === 0 && alive === 0) dawn();
    }
    hud.objective.textContent = `Hold the fire · ${alive + (host ? toSpawn : 0)} Hollow ${host ? "left" : "in sight"}`;
    if (!fireWarned && cf.hp / cf.maxHp < 0.35) {
      fireWarned = true;
      voice.interrupt();
      say(S.FIRE_LOW);
    }
    barkCd -= dt;
    if (barkCd <= 0 && alive > 0 && !voice.busy && !night.omen.quiet) {
      barkCd = 8 + Math.random() * 6;
      say([["HOLLOW", pick(S.HOLLOW_BARKS)]]);
    }
  }

  // host streams the world ~10 times a second
  if (host && net.active) {
    syncT -= dt;
    if (syncT <= 0) {
      syncT = 0.1;
      net.send({ t: "w", ph: night.phase, pt: Math.round(phaseT * 10) / 10, fh: Math.round(cf.hp), fm: cf.maxHp, e: enemies.snapshot(), rr: resetReason });
    }
  }
  void playerName;
}

/** Debug helpers for testing. */
export const nightDebug = {
  storm: () => {
    phaseT = 0;
  },
  win: () => {
    toSpawn = 0;
    enemies.clear();
  },
};
