// THE LONG NIGHT — the replayable loop.
//
//   DUSK   scavenge supply caches, shards and Echoes before the storm
//   STORM  the rift spits Hollow at your campfire; hold it until the last falls
//   DAWN   bank shards, buy Memories (permanent upgrades), face the next night
//   RESET  if you fall or the fire dies, the loop resets to Night 1, but your
//          Memories, banked shards and Echoes carry over. That's the story
//          reason the game repeats: the rift is looping Patient 100.

import * as THREE from "three";
import {
  $,
  applyMemories,
  card,
  cine,
  collectShard,
  enemies,
  fade,
  fx,
  hud,
  type Interact,
  input,
  persist,
  pick,
  pickupShards,
  player,
  runInteractions,
  say,
  setObjective,
  sfx,
  state,
  toast,
  voice,
  wait,
  world,
} from "./ctx";
import { echoProgress, listenEcho, spawnEcho, unfoundEchoes } from "./echo";
import type { Enemy, EnemyKind, FireLike } from "./enemies";
import { MEMORIES, save } from "./save";
import * as S from "./script";
import { CAMP, heightAt, WORLD_RADIUS } from "./world";

type Phase = "dusk" | "storm" | "dawn" | "over";

export const night = {
  n: 1,
  phase: "dusk" as Phase,
  omen: S.FIRST_NIGHT_OMEN as S.Omen,
  boss: null as Enemy | null,
};

let phaseT = 0;
let toSpawn = 0;
let spawnTimer = 0;
let spawnGap = 6;
let kills = 0;
let fireWarned = false;
let barkCd = 8;
let loopShards = 0;
let bestThisLoop = 0;

const fire: FireLike = {
  pos: CAMP,
  get alive() {
    return world.campfire.lit && world.campfire.hp > 0;
  },
  damage(n: number) {
    if (night.phase !== "storm") return;
    world.campfire.hp = Math.max(0, world.campfire.hp - n);
    fx.number(CAMP.clone().add(new THREE.Vector3(0, 2, 0)), `-${Math.round(n)}`, "fire");
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

export async function startLongNight(fromReset = false) {
  state.mode = "night";
  state.dead = false;
  voice.interrupt();
  enemies.clear();
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
  player.pos.set(CAMP.x - 1.5, heightAt(CAMP.x, CAMP.z - 3), CAMP.z - 3);
  player.yaw = 0;
  player.pitch = 0.1;
  hud.root.classList.add("show");
  hud.fire.hidden = false;
  $("night-chip").hidden = false;
  enemies.fire = fire;
  night.n = 1;
  loopShards = 0;
  bestThisLoop = 0;
  state.runShards = 0;
  state.runStart = state.elapsed;
  sfx.startAmbience();
  await fade(0, 1500);

  const lines = !fromReset && save.loops === 0 ? S.NIGHT_INTRO_FIRST : S.LOOP_WAKE[Math.min(save.loops, S.LOOP_WAKE.length - 1)];
  if (fromReset) {
    card(`LOOP ${save.loops + 1}`, "WAKE AGAIN", "Same moons. Same fire. You remember more.", 3000);
    await wait(3100);
  }
  startNight();
  if (lines.length) say(lines);
}

function startNight() {
  const n = night.n;
  night.phase = "dusk";
  night.boss = null;
  hud.bossBar.classList.remove("show");
  phaseT = n === 1 ? 80 : 65;
  night.omen = n === 1 ? S.FIRST_NIGHT_OMEN : n % 5 === 0 ? S.WARDEN_OMEN : pick(S.OMENS);
  kills = 0;
  fireWarned = false;
  world.setMood(night.omen.fog ? "fog" : "dusk", night.omen.fog);
  world.setCampfire(true, 100 + save.mem.keeper * 30);
  player.medkits = Math.max(player.medkits, 1 + save.mem.medic + (player.riftBound ? 1 : 0));
  world.clearCaches();
  world.clearDynamicShards();
  const caches = Math.min(6, 3 + Math.floor(n / 3));
  for (let i = 0; i < caches; i++) {
    const p = randomSpot(22, 85);
    world.spawnCache(p.x, p.z);
  }
  if (night.omen.starfall) {
    for (let i = 0; i < 18; i++) {
      const p = randomSpot(10, 70);
      world.addShard(p.x, p.z, true, 2);
    }
  }
  const pool = unfoundEchoes();
  if (pool.length && Math.random() < 0.5 + (night.omen.echo ?? 0) && !world.ghosts.length) {
    const p = randomSpot(35, 95);
    spawnEcho(pick(pool), p.x, p.z);
  }
  $("night-chip").textContent = `NIGHT ${n}`;
  card(`NIGHT ${n}`, night.omen.name, night.omen.text, 3800);
  const opener = n - 1 < S.NIGHT_OPENERS.length ? S.NIGHT_OPENERS[n - 1] : pick(S.NIGHT_OPENERS);
  setTimeout(() => {
    if (night.phase === "dusk" && state.mode === "night") say(opener);
  }, 4200);
}

function beginStorm() {
  const n = night.n;
  night.phase = "storm";
  const o = night.omen;
  world.setMood(o.blood ? "blood" : o.fog ? "fog" : "storm", o.fog);
  sfx.roar();
  sfx.rumble();
  toast("THE STORM IS HERE. Defend the fire.", 3000);
  toSpawn = 6 + n * 3 + (o.bias ? 2 : 0);
  spawnGap = (n > 5 ? 4.5 : 6) * (o.waveGap ?? 1);
  spawnTimer = 1;
  if (o.id === "warden") {
    const p = randomSpot(24, 28);
    world.spawnTear(p.x, p.z, true);
    night.boss = enemies.spawn("warden", new THREE.Vector3(p.x, 0, p.z), { hpMul: 0.7 + n * 0.06, dmgMul: 0.9 });
    hud.bossName.textContent = "WARDEN'S ECHO";
    hud.bossBar.classList.add("show");
    say([["WARDEN", "I was the first. I will be the last thing you see. Again."]]);
  } else {
    say([["RHEA", pick(["Here they come. Stay near the fire!", "Rift's opening. Hold the light, Hundred!", "I can hear them from here. Fire. Now."])]]);
  }
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
    world.spawnTear(x, z);
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
  card("DAWN", `NIGHT ${night.n} SURVIVED`, `+${bonus} shards · ${kills} Hollow fell`, 3000);
  say(pick(S.DAWN_LINES));
  await wait(3200);
  if (night.phase !== "dawn") return;
  openShop("dawn");
}

// ------------------------------------------------------------------ loop reset
async function loopReset(reason: string) {
  if (night.phase === "over") return;
  night.phase = "over";
  state.dead = true;
  voice.interrupt();
  save.loops++;
  save.bestNight = Math.max(save.bestNight, bestThisLoop);
  persist();
  sfx.rumble();
  $("dead").classList.add("show");
  $("dead-title").textContent = "THE LOOP RESETS";
  $("dead-sub").textContent = reason;
  await wait(2600);
  $("dead").classList.remove("show");
  $("dead-title").textContent = "YOU WENT DOWN";
  $("dead-sub").textContent = "Rhea's voice cuts through the static…";
  openShop("over");
}

// ------------------------------------------------------------------ shop
function openShop(kind: "dawn" | "over") {
  document.exitPointerLock?.();
  const el = $("shop");
  $("shop-kicker").textContent = kind === "dawn" ? `DAWN · NIGHT ${night.n} SURVIVED` : `LOOP ${save.loops} ENDED · BEST NIGHT ${save.bestNight}`;
  $("shop-title").textContent = kind === "dawn" ? "Spend what you carried back" : "What leaks through the loop";
  $("shop-sub").textContent =
    kind === "dawn"
      ? "Rift Shards become Memories. Memories survive every reset."
      : `You survived ${bestThisLoop} night${bestThisLoop === 1 ? "" : "s"} and banked ${loopShards + state.runShards} shards. The fire remembers you. So does the dark.`;
  $<HTMLButtonElement>("shop-go").textContent = kind === "dawn" ? `Face Night ${night.n + 1}` : "Wake again";
  $("shop-go").onclick = () => {
    el.classList.remove("show");
    input.lock();
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
    btn.className = maxed ? "ghost" : "secondary";
    btn.textContent = maxed ? "Mastered" : `◆ ${cost}`;
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
    list.push({ pos: () => g.pos, r: 2.4, label: `Listen to the Echo <span class="dim">(${echoProgress()})</span>`, when: () => true, run: () => listenEcho(g) });
  }
  list.push({
    pos: () => CAMP,
    r: 2.6,
    label: "Call the storm early <span class=\"dim\">(+10 shards)</span>",
    when: () => night.phase === "dusk" && phaseT > 5,
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
  if (night.omen.quiet) player.hp = Math.min(player.maxHp, player.hp + 6);
}

export function nightUpdate(dt: number) {
  if (night.phase === "over") return;
  if (player.hp <= 0) {
    loopReset("You fell in the dark.");
    return;
  }
  runInteractions(interacts());
  pickupShards();

  const cf = world.campfire;
  hud.fireFill.style.width = `${(cf.hp / cf.maxHp) * 100}%`;

  if (night.phase === "dusk") {
    phaseT -= dt;
    const s = Math.max(0, Math.ceil(phaseT));
    const left = world.caches.filter((c) => !c.opened).length;
    hud.chapter.textContent = `NIGHT ${night.n} · ${night.omen.name}`;
    hud.objective.textContent =
      phaseT > 20
        ? `Scavenge before the storm · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")} · ${left} cache${left === 1 ? "" : "s"} left`
        : `Storm in ${s}s · get back to the fire!`;
    if (phaseT <= 0) beginStorm();
  } else if (night.phase === "storm") {
    spawnTimer -= dt;
    if (toSpawn > 0 && spawnTimer <= 0) {
      spawnTimer = spawnGap;
      spawnGroup();
    }
    const alive = enemies.aliveCount;
    hud.chapter.textContent = `NIGHT ${night.n} · ${night.omen.name}`;
    hud.objective.textContent = `Hold the fire · ${alive + toSpawn} Hollow left`;
    if (night.boss?.alive) hud.bossFill.style.width = `${Math.max(0, night.boss.hp / night.boss.maxHp) * 100}%`;
    if (!fireWarned && cf.hp / cf.maxHp < 0.35) {
      fireWarned = true;
      voice.interrupt();
      say(S.FIRE_LOW);
    }
    if (toSpawn === 0 && alive === 0) dawn();
    barkCd -= dt;
    if (barkCd <= 0 && alive > 0 && !voice.busy && !night.omen.quiet) {
      barkCd = 8 + Math.random() * 6;
      say([["HOLLOW", pick(S.HOLLOW_BARKS)]]);
    }
  }
  void setObjective;
  void cine;
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
