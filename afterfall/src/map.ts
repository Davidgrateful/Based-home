// The field map. It starts blank except for where you stand and fills in as
// you walk: terrain, trees, landmarks, region names. Places the story hasn't
// reached are interference at the edge. It never shows the objective; the
// world does that.

import { $, cine, persist, player, state, TOUCH, world } from "./ctx";
import { net } from "./net";
import { save } from "./save";
import { regionAt, REGIONS } from "./regions";
import { CASE_POS } from "./signs";
import { ARENA, BEACON, CAMP, heightAt, MAST, PYLONS, STATION, WORLD_RADIUS } from "./world";

// World window drawn by the map (north = +z is up, east = -x is right).
const CX = 0;
const CZ = 20;
const SPAN = 400;
const GRID = 64; // fog cells per side (6.25 m each)
const REVEAL = 26; // metres revealed around the player

const fog = new Uint8Array(GRID * GRID);
(() => {
  try {
    const bin = atob(save.fog);
    for (let i = 0; i < fog.length; i++) fog[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  } catch {}
})();

function packFog() {
  const bytes = new Uint8Array(fog.length / 8);
  for (let i = 0; i < fog.length; i++) if (fog[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

/** World → 0..1 map space. */
const mx = (x: number) => 0.5 - (x - CX) / SPAN;
const mz = (z: number) => 0.5 - (z - CZ) / SPAN;
const cellOf = (x: number, z: number) => {
  const i = Math.floor(mx(x) * GRID);
  const j = Math.floor(mz(z) * GRID);
  return i < 0 || j < 0 || i >= GRID || j >= GRID ? -1 : j * GRID + i;
};
export const discovered = (x: number, z: number) => {
  const c = cellOf(x, z);
  return c >= 0 && fog[c] === 1;
};

let dirty = false;
let saveT = 0;
let revealT = 0;

/** Called every frame while playing. */
export function mapUpdate(dt: number, walking: boolean) {
  revealT -= dt;
  saveT -= dt;
  if (walking && revealT <= 0) {
    revealT = 0.25;
    const p = player.pos;
    const cell = SPAN / GRID;
    const n = Math.ceil(REVEAL / cell);
    const ci = Math.floor(mx(p.x) * GRID);
    const cj = Math.floor(mz(p.z) * GRID);
    for (let j = cj - n; j <= cj + n; j++)
      for (let i = ci - n; i <= ci + n; i++) {
        if (i < 0 || j < 0 || i >= GRID || j >= GRID) continue;
        const d = Math.hypot(i - ci, j - cj) * cell;
        const k = j * GRID + i;
        if (d <= REVEAL && !fog[k]) {
          fog[k] = 1;
          dirty = true;
        }
      }
  }
  if (dirty && saveT <= 0) {
    saveT = 3;
    dirty = false;
    save.fog = packFog();
    persist();
  }
  if (open) draw();
}

// ------------------------------------------------------------------ drawing
let base: HTMLCanvasElement | null = null;

/** Terrain, trees and wreck scar, drawn once. Fog is laid over it per frame. */
function buildBase() {
  const S = 512;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  for (let py = 0; py < S; py++)
    for (let px = 0; px < S; px++) {
      const x = CX - (px / S - 0.5) * SPAN;
      const z = CZ - (py / S - 0.5) * SPAN;
      const k = (py * S + px) * 4;
      if (Math.hypot(x, z - 20) > WORLD_RADIUS) {
        img.data[k + 3] = 0;
        continue;
      }
      const h = heightAt(x, z);
      const hx = heightAt(x + 1.5, z) - h;
      const light = 0.62 + Math.max(-0.25, Math.min(0.25, -hx * 0.6)) + (h + 10) * 0.012;
      let r = 40, gg = 41, b = 38;
      if (x < -38) [r, gg, b] = [24, 27, 25];
      if (Math.hypot(x - STATION.x, z - STATION.z) < 46) [r, gg, b] = [52, 34, 31];
      if (Math.hypot(x + 6, z - 18) < 22) [r, gg, b] = [30, 28, 29];
      if (Math.hypot(x - ARENA.x, z - ARENA.z) < 24) [r, gg, b] = [48, 33, 32];
      img.data[k] = r * light * 1.55;
      img.data[k + 1] = gg * light * 1.55;
      img.data[k + 2] = b * light * 1.55;
      img.data[k + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  // contour-ish grain
  g.globalAlpha = 0.08;
  for (let i = 0; i < 2400; i++) {
    g.fillStyle = i % 2 ? "#000" : "#fff";
    g.fillRect(Math.random() * S, Math.random() * S, 1, 1);
  }
  g.globalAlpha = 1;
  for (const t of world.treeSpots) {
    g.fillStyle = t.kind === 1 ? "#0b0c0c" : t.kind === 2 ? "#6e2018" : "#1d2a26";
    g.beginPath();
    g.arc(mx(t.x) * S, mz(t.z) * S, t.kind === 1 ? 3.2 : 2.6, 0, Math.PI * 2);
    g.fill();
  }
  // edge of the known world
  g.strokeStyle = "rgba(233,230,223,0.25)";
  g.setLineDash([4, 6]);
  g.beginPath();
  g.arc(mx(0) * S, mz(20) * S, (WORLD_RADIUS / SPAN) * S, 0, Math.PI * 2);
  g.stroke();
  base = c;
}

interface Mark {
  x: number;
  z: number;
  label: string;
  kind: "fire" | "warm" | "rift" | "danger" | "plain";
  lit?: () => boolean;
}

const MARKS: Mark[] = [
  { x: 0, z: 0, label: "Ambulance", kind: "warm" },
  { x: CAMP.x, z: CAMP.z, label: "Fire", kind: "fire", lit: () => world.campfire.lit },
  { x: -12, z: 30, label: "Wreck", kind: "warm" },
  { x: BEACON.x, z: BEACON.z, label: "Black box", kind: "plain" },
  { x: CASE_POS.x, z: CASE_POS.z, label: "", kind: "plain" },
  { x: MAST.x, z: MAST.z, label: "Relay mast", kind: "danger" },
  { x: STATION.x, z: STATION.z, label: "Field station", kind: "danger" },
  ...PYLONS.map((p, i) => ({ x: p.x, z: p.z, label: "Tower", kind: "rift" as const, lit: () => world.pylons[i]?.lit ?? false })),
  { x: ARENA.x, z: ARENA.z, label: "Stone circle", kind: "rift" },
];

const COL = { ink: "#e9e6df", dim: "#85827b", fire: "#e0873e", rift: "#62d6e8", danger: "#c4473a" };

let open = false;
let sx = (x: number) => x;
let sz = (z: number) => z;
let canvas: HTMLCanvasElement;
let fogCanvas: HTMLCanvasElement;

function garble(s: string) {
  return s.replace(/[A-Z]/gi, (ch) => (Math.random() < 0.35 ? "▒" : ch));
}

/** Frame what has been discovered (and you), so the first map is a small
 *  patch around the ambulance and it widens as you walk. */
function fitView() {
  let x0 = player.pos.x, x1 = x0, z0 = player.pos.z, z1 = z0;
  const cell = SPAN / GRID;
  for (let k = 0; k < fog.length; k++) {
    if (!fog[k]) continue;
    const x = CX - (((k % GRID) + 0.5) / GRID - 0.5) * SPAN;
    const z = CZ - ((Math.floor(k / GRID) + 0.5) / GRID - 0.5) * SPAN;
    x0 = Math.min(x0, x - cell); x1 = Math.max(x1, x + cell);
    z0 = Math.min(z0, z - cell); z1 = Math.max(z1, z + cell);
  }
  const span = Math.min(SPAN, Math.max(110, Math.max(x1 - x0, z1 - z0) * 1.2));
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, span };
}

function draw() {
  if (!base) buildBase();
  const S = canvas.width;
  const g = canvas.getContext("2d")!;
  const v = fitView();
  // screen position of a world point in this view
  sx = (x: number) => (0.5 - (x - v.x) / v.span) * S;
  sz = (z: number) => (0.5 - (z - v.z) / v.span) * S;
  // the same window in the full-world base and fog images
  const src = (img: number) => [mx(v.x + v.span / 2) * img, mz(v.z + v.span / 2) * img, (v.span / SPAN) * img, (v.span / SPAN) * img] as const;
  g.fillStyle = "#0d0e10";
  g.fillRect(0, 0, S, S);
  g.imageSmoothingEnabled = true;
  g.drawImage(base!, ...src(base!.width), 0, 0, S, S);

  // fog: low-res alpha mask scaled up smooth, so edges feather
  const fg = fogCanvas.getContext("2d")!;
  const fi = fg.createImageData(GRID, GRID);
  for (let i = 0; i < fog.length; i++) {
    fi.data[i * 4] = 13;
    fi.data[i * 4 + 1] = 14;
    fi.data[i * 4 + 2] = 16;
    fi.data[i * 4 + 3] = fog[i] ? 0 : 255;
  }
  fg.putImageData(fi, 0, 0);
  g.drawImage(fogCanvas, ...src(GRID), 0, 0, S, S);

  const u = S / 600; // type scale
  g.textAlign = "center";
  // each walked region is named over the middle of the part you've seen
  const sum = new Map<string, [number, number, number]>();
  for (let k = 0; k < fog.length; k++) {
    if (!fog[k]) continue;
    const x = CX - (((k % GRID) + 0.5) / GRID - 0.5) * SPAN;
    const z = CZ - ((Math.floor(k / GRID) + 0.5) / GRID - 0.5) * SPAN;
    const r = regionAt(x, z);
    if (!r) continue;
    const a = sum.get(r.id) ?? [0, 0, 0];
    sum.set(r.id, [a[0] + x, a[1] + z, a[2] + 1]);
  }
  // regions: names once walked into; locked ones are interference
  for (const r of REGIONS) {
    const c = sum.get(r.id);
    const x = c ? sx(c[0] / c[2]) : sx(r.label[0]);
    const y = c ? sz(c[1] / c[2]) : sz(r.label[1]);
    if (r.locked) {
      if (!save.storyDone) continue;
      g.font = `600 ${13 * u}px "Barlow Condensed", sans-serif`;
      g.fillStyle = "rgba(233,230,223,0.35)";
      g.fillText(garble(r.name.toUpperCase()), x, y);
      continue;
    }
    if (!save.regions.includes(r.id)) continue;
    g.font = `600 ${15 * u}px "Barlow Condensed", sans-serif`;
    g.fillStyle = "rgba(233,230,223,0.62)";
    g.fillText(r.name.toUpperCase().split("").join(String.fromCharCode(8202)), x, y);
  }
  // landmarks
  g.font = `500 ${11 * u}px Barlow, sans-serif`;
  for (const m of MARKS) {
    if (!discovered(m.x, m.z)) continue;
    const x = sx(m.x);
    const y = sz(m.z);
    const lit = m.lit ? m.lit() : true;
    const col = m.kind === "fire" ? (lit ? COL.fire : COL.dim) : m.kind === "rift" ? (lit ? COL.rift : COL.dim) : m.kind === "danger" ? COL.danger : m.kind === "warm" ? COL.ink : COL.dim;
    g.fillStyle = col;
    g.strokeStyle = col;
    g.lineWidth = 1.5 * u;
    if (m.kind === "fire") {
      g.beginPath();
      g.arc(x, y, 4.5 * u, 0, Math.PI * 2);
      g.fill();
      if (lit) {
        g.globalAlpha = 0.25;
        g.beginPath();
        g.arc(x, y, 12 * u, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
    } else {
      g.save();
      g.translate(x, y);
      g.rotate(Math.PI / 4);
      g.strokeRect(-3.5 * u, -3.5 * u, 7 * u, 7 * u);
      g.restore();
    }
    if (m.label) {
      g.fillStyle = "rgba(233,230,223,0.75)";
      g.fillText(m.label, x, y + 16 * u);
    }
  }
  // you
  const px = sx(player.pos.x);
  const py = sz(player.pos.z);
  // facing (sin yaw, cos yaw) in world; map x runs along -x and map y along -z
  const a = Math.atan2(-Math.cos(player.yaw), -Math.sin(player.yaw));
  g.save();
  g.translate(px, py);
  g.rotate(a);
  g.fillStyle = COL.fire;
  g.beginPath();
  g.moveTo(9 * u, 0);
  g.lineTo(-6 * u, 5.5 * u);
  g.lineTo(-3 * u, 0);
  g.lineTo(-6 * u, -5.5 * u);
  g.closePath();
  g.fill();
  g.restore();
}

export function toggleMap(on = !open) {
  if (state.mode === "title" || (on && (cine.active || state.paused || state.dead))) return;
  open = on;
  $("map").classList.toggle("show", open);
  if (!net.active) state.paused = open;
  if (open) {
    const S = Math.round(Math.min(innerWidth, innerHeight) * Math.min(2, devicePixelRatio || 1));
    canvas.width = canvas.height = S;
    draw();
  }
}

export function initMap() {
  canvas = $<HTMLCanvasElement>("map-canvas");
  fogCanvas = document.createElement("canvas");
  fogCanvas.width = fogCanvas.height = GRID;
  addEventListener("keydown", (e) => {
    if (e.code === "KeyM" && !e.repeat) toggleMap();
    else if (open && e.code === "Escape") toggleMap(false);
  });
  $("map").addEventListener("pointerdown", () => toggleMap(false));
  if (TOUCH) {
    const b = document.createElement("button");
    b.id = "t-map";
    b.textContent = "Map";
    b.addEventListener("pointerdown", (e) => {
      e.stopPropagation();
      toggleMap();
    });
    document.body.appendChild(b);
  }
}

export const mapOpen = () => open;
