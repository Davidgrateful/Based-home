// Shared game context: renderer, world, actors, HUD helpers and run state.
// Modes (story.ts, night.ts) and the main loop all import from here.

import * as THREE from "three";
import { Sfx } from "./audio";
import { Cine } from "./cinematic";
import { EnemyManager } from "./enemies";
import { FX } from "./fx";
import { Input, Player } from "./player";
import { makePost } from "./post";
import { persist, save } from "./save";
export { persist };
import type { Line } from "./script";
import { TokenLink } from "./token";
import { Voice } from "./voice";
import { AMBULANCE, heightAt, World, WORLD_RADIUS } from "./world";

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// `?low` = no shadows/bloom, lower resolution, for weaker laptops.
export const LOW = new URLSearchParams(location.search).has("low");

export const canvas = $<HTMLCanvasElement>("game");
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: !LOW, powerPreference: "high-performance" });
renderer.setPixelRatio(LOW ? Math.min(devicePixelRatio, 1) * 0.75 : Math.min(devicePixelRatio, 1.75));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = !LOW;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(68, innerWidth / innerHeight, 0.05, 1400);
export const post = makePost(renderer, scene, camera, LOW);
addEventListener("resize", () => {
  renderer.setSize(innerWidth, innerHeight);
  post.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
});

export const world = new World(scene);
export const input = new Input(canvas);
export const player = new Player(scene);
player.cameraBlockers = world.cameraBlockers;
export const enemies = new EnemyManager(scene, world.colliders);
export const voice = new Voice();
export const sfx = new Sfx();
export const token = new TokenLink();
export const fx = new FX(scene);
export const cine = new Cine(voice);

export const state = {
  mode: "title" as "title" | "story" | "night",
  exited: false,
  runShards: 0,
  elapsed: 0,
  runStart: 0,
  paused: false,
  dead: false,
  hitStop: 0,
  remoteSwing: false, // a co-op guest's swing being resolved on the host
  slowMo: 1,
};

// ------------------------------------------------------------------ bounds
const AMB_IN = { minX: -0.15, maxX: 0.6, minZ: -2.9, maxZ: 2.95 };
export const bounds = {
  groundAt(x: number, z: number) {
    if (x > AMBULANCE.minX && x < AMBULANCE.maxX && z > AMBULANCE.minZ && z < AMBULANCE.maxZ) return 0.36;
    return heightAt(x, z);
  },
  constrain(p: THREE.Vector3, r: number) {
    if (!state.exited) {
      const doorway = world.doorsOpen > 0.6;
      if (p.z > AMB_IN.maxZ && doorway) p.x = THREE.MathUtils.clamp(p.x, -1.0, 1.0);
      else p.x = THREE.MathUtils.clamp(p.x, AMB_IN.minX, AMB_IN.maxX);
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
export const hud = {
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
  bossName: $("boss-name"),
  bossFill: $("boss-fill"),
  vignette: $("vignette"),
  perk: $("perk"),
  toast: $("toast"),
  blackout: $("blackout"),
  fire: $("firebar"),
  fireFill: $("fire-fill"),
};

let toastTimer = 0;
export function toast(msg: string, ms = 2600) {
  hud.toast.textContent = msg;
  hud.toast.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => hud.toast.classList.remove("show"), ms);
}

export function setObjective(chapter: string, text: string) {
  hud.chapter.textContent = chapter;
  hud.objective.textContent = text;
  hud.objective.classList.remove("pulse");
  void hud.objective.offsetWidth;
  hud.objective.classList.add("pulse");
}

export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function fade(to: number, ms = 1200) {
  hud.blackout.style.transition = `opacity ${ms}ms ease`;
  hud.blackout.style.opacity = String(to);
  return wait(ms);
}

export const say = (lines: Line[]) => voice.say(lines);

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Big centered card: chapter titles, omens, loop resets. */
export async function card(kicker: string, title: string, sub = "", ms = 3600) {
  const el = $("card");
  $("card-kicker").textContent = kicker;
  $("card-title").textContent = title;
  $("card-sub").textContent = sub;
  el.classList.remove("show");
  void el.offsetWidth;
  el.classList.add("show");
  sfx.sting();
  await wait(ms);
  el.classList.remove("show");
}

/** Apply permanent Memories (upgrades) to the player. */
export function applyMemories() {
  const m = save.mem;
  player.maxHp = 100 + m.skin * 15;
  player.hp = player.maxHp;
  player.dmgMul = 1 + m.muscle * 0.15;
  player.regenMul = 1 + m.wind * 0.3;
  player.dodgeCost = 25 - m.wind * 4;
  player.pickupBonus = m.sense * 1.2;
}

export function collectShard(value = 1) {
  state.runShards += value;
  save.bank += value;
  persist();
}

export function hurtFlash() {
  hud.vignette.classList.remove("hit");
  void hud.vignette.offsetWidth;
  hud.vignette.classList.add("hit");
}

export const heightAtCtx = heightAt;

// ------------------------------------------------------------------ interactions
export interface Interact {
  pos: () => THREE.Vector3;
  r: number;
  label: string | (() => string);
  when: () => boolean;
  run: () => void;
}

export function runInteractions(list: Interact[]) {
  let near: Interact | null = null;
  let nd = Infinity;
  for (const it of list) {
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
    const label = typeof near.label === "function" ? near.label() : near.label;
    hud.prompt.innerHTML = `<kbd>E</kbd> ${label}`;
    if (input.tap("KeyE")) near.run();
  }
}

/** Pull in shards near the player. */
export function pickupShards(onFirst?: () => void) {
  const reach = (player.riftBound ? 3.2 : 1.8) + player.pickupBonus;
  const at = new THREE.Vector3(player.pos.x, player.pos.y + 1, player.pos.z);
  for (const s of world.shards) {
    if (s.taken) continue;
    const d = s.mesh.position.distanceTo(at);
    if (d < reach + 2.5 && d > reach) s.mesh.position.lerp(at, 0.08); // magnet
    if (d < reach) {
      s.taken = true;
      s.mesh.visible = false;
      collectShard(s.value ?? 1);
      sfx.pickup();
      if (state.runShards === (s.value ?? 1)) onFirst?.();
    }
  }
}
