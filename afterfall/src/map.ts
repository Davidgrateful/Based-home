// The field map. It starts blank except for where you stand and fills in as
// you walk: terrain, trees, landmarks, region names. Places the story hasn't
// reached are interference at the edge. It never shows the objective; the
// world does that.

import { $, cine, farlands, persist, player, state, TOUCH, world } from "./ctx";
import { net } from "./net";
import { save } from "./save";
import { regionAt, REGIONS } from "./regions";
import { CASE_POS } from "./signs";
import { ARENA, BASIN_C, BASIN_R, BEACON, CAMP, CHOIR_C, DEAD_TREE, heightAt, MAST, OLD_CAMP, PYLONS, SHED, SCAR, SETTLEMENT, STATION, WORLD_RADIUS } from "./world";
import { designation, EVIDENCE, evidenceFound, knownPatients, LANDMARKS, landmarkFound } from "./history";

// World window drawn by the map (north = +z is up, east = -x is right).
const CX = 0;
const CZ = 75;
const SPAN = 520;
const GRID = 72; // fog cells per side (~7.2 m each)
const FOG_V = "v2:"; // bump when the window changes; older reveals are dropped
const REVEAL = 26; // metres revealed around the player

const fog = new Uint8Array(GRID * GRID);
(() => {
  try {
    if (!save.fog.startsWith(FOG_V)) return;
    const bin = atob(save.fog.slice(FOG_V.length));
    for (let i = 0; i < fog.length; i++) fog[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1;
  } catch {}
})();

function packFog() {
  const bytes = new Uint8Array(Math.ceil(fog.length / 8));
  for (let i = 0; i < fog.length; i++) if (fog[i]) bytes[i >> 3] |= 1 << (i & 7);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return FOG_V + btoa(s);
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
let mapBtn: HTMLElement | null = null;

export function mapUpdate(dt: number, walking: boolean) {
  if (mapBtn) mapBtn.hidden = cine.active || state.dead;
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
const BASE = 768;

/** The survey sheet, drawn once: dark paper, hill shading, contour lines
 *  every 2.5 m (heavier every 10), the woods stippled in, the edge of the
 *  known world dashed. Fog is laid over it when the map is open. */
function buildBase() {
  const S = BASE;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  const img = g.createImageData(S, S);
  const H = new Float32Array(S * S);
  const inside = new Uint8Array(S * S);
  for (let py = 0; py < S; py++)
    for (let px = 0; px < S; px++) {
      const x = CX - (px / S - 0.5) * SPAN;
      const z = CZ - (py / S - 0.5) * SPAN;
      const i = py * S + px;
      H[i] = heightAt(x, z);
      inside[i] = Math.hypot(x, z - 20) <= WORLD_RADIUS || Math.hypot(x - BASIN_C.x, z - BASIN_C.z) <= BASIN_R ? 1 : 0;
    }
  for (let py = 0; py < S; py++)
    for (let px = 0; px < S; px++) {
      const i = py * S + px;
      const k = i * 4;
      const x = CX - (px / S - 0.5) * SPAN;
      const z = CZ - (py / S - 0.5) * SPAN;
      // paper, with a little grain
      const grain = (Math.sin(px * 12.9898 + py * 78.233) * 43758.5453) % 1;
      let r = 30, gg = 28, b = 24;
      if (inside[i]) {
        const hx = H[Math.min(i + 1, S * S - 1)] - H[i];
        const shade = Math.max(-0.18, Math.min(0.18, -hx * 0.9));
        r = 38; gg = 36; b = 31;
        if (x < -38) [r, gg, b] = [28, 30, 27]; // the Blackwood
        if (Math.hypot(x - BASIN_C.x, z - BASIN_C.z) < BASIN_R) [r, gg, b] = [28, 36, 40];
        if (Math.hypot(x - CHOIR_C.x, z - CHOIR_C.z) < 22) [r, gg, b] = [70, 74, 74];
        if (Math.hypot(x - SCAR.x, z - SCAR.z) < 9) [r, gg, b] = [32, 40, 44];
        if (Math.hypot(x + 6, z - 18) < 20) [r, gg, b] = [34, 30, 28]; // burnt ground
        const l = 1 + shade;
        r *= l; gg *= l; b *= l;
      }
      const n = 1 + (grain - 0.5) * 0.08;
      img.data[k] = r * n;
      img.data[k + 1] = gg * n;
      img.data[k + 2] = b * n;
      img.data[k + 3] = 255;
    }
  // contours: where the 2.5 m band changes between neighbours
  for (let py = 0; py < S - 1; py++)
    for (let px = 0; px < S - 1; px++) {
      const i = py * S + px;
      if (!inside[i]) continue;
      const a = Math.floor(H[i] / 2.5);
      if (a === Math.floor(H[i + 1] / 2.5) && a === Math.floor(H[i + S] / 2.5)) continue;
      const major = Math.max(a, Math.floor(H[i + 1] / 2.5), Math.floor(H[i + S] / 2.5)) % 4 === 0;
      const k = i * 4;
      const add = major ? 34 : 18;
      img.data[k] += add;
      img.data[k + 1] += add * 0.95;
      img.data[k + 2] += add * 0.85;
    }
  g.putImageData(img, 0, 0);
  // the woods: a stipple of small trunks; the Blackwood dense and dark
  for (const t of world.treeSpots) {
    const x = mx(t.x) * S;
    const y = mz(t.z) * S;
    if (t.kind === 1) {
      g.fillStyle = "rgba(10,12,11,0.85)";
      g.beginPath();
      g.arc(x, y, 3, 0, Math.PI * 2);
      g.fill();
    } else {
      g.strokeStyle = t.kind === 2 ? "rgba(150,70,58,0.55)" : "rgba(170,176,160,0.32)";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, y, 1.5, 0, Math.PI * 2);
      g.stroke();
    }
  }
  // edge of the known world
  g.strokeStyle = "rgba(233,230,223,0.22)";
  g.setLineDash([4, 6]);
  g.beginPath();
  g.arc(mx(0) * S, mz(20) * S, (WORLD_RADIUS / SPAN) * S, 0, Math.PI * 2);
  g.stroke();
  g.beginPath();
  g.arc(mx(BASIN_C.x) * S, mz(BASIN_C.z) * S, (BASIN_R / SPAN) * S, 0, Math.PI * 2);
  g.stroke();
  g.setLineDash([]);
  base = c;
}

/** Unsurveyed ground: darker paper, hatched. */
let hatch: CanvasPattern | null = null;
let fogOut: HTMLCanvasElement | null = null;
function hatchPattern(g: CanvasRenderingContext2D) {
  if (hatch) return hatch;
  const p = document.createElement("canvas");
  p.width = p.height = 12;
  const pg = p.getContext("2d")!;
  pg.fillStyle = "#151412";
  pg.fillRect(0, 0, 12, 12);
  pg.strokeStyle = "rgba(233,230,223,0.06)";
  pg.beginPath();
  pg.moveTo(0, 12);
  pg.lineTo(12, 0);
  pg.stroke();
  hatch = g.createPattern(p, "repeat");
  return hatch;
}

type Kind = "fire" | "warm" | "rift" | "danger" | "plain" | "white" | "crash" | "tower" | "unknown";
interface Mark {
  x: number;
  z: number;
  label: string;
  kind: Kind;
  lit?: () => boolean;
  /** on the map yet? (default: once you've walked near it) */
  known?: () => boolean;
}

const near = (x: number, z: number) => () => discovered(x, z);
const MARKS: Mark[] = [
  { x: 0, z: 0, label: "Ambulance", kind: "warm" },
  { x: CAMP.x, z: CAMP.z, label: "Fire", kind: "fire", lit: () => world.campfire.lit },
  { x: -12, z: 30, label: "Crash site", kind: "crash", known: () => true },
  { x: BEACON.x, z: BEACON.z, label: "", kind: "plain" }, // the black box: in the wreck, under "Crash site"
  { x: CASE_POS.x, z: CASE_POS.z, label: "", kind: "plain" },
  { x: MAST.x, z: MAST.z, label: "Watchtower", kind: "tower", known: () => landmarkFound("watchtower") },
  { x: STATION.x, z: STATION.z, label: "", kind: "danger", known: () => save.regions.includes("station") },
  { x: DEAD_TREE.x, z: DEAD_TREE.z, label: "Dead tree", kind: "plain", known: () => landmarkFound("deadtree") },
  { x: SHED.x, z: SHED.z, label: "Shed", kind: "plain" },
  { x: SCAR.x, z: SCAR.z, label: "", kind: "rift", known: () => save.regions.includes("scar") },
  { x: OLD_CAMP.x, z: OLD_CAMP.z, label: "", kind: "fire", lit: () => false, known: () => save.regions.includes("oldcamp") },
  ...PYLONS.map((p, i) => ({ x: p.x, z: p.z, label: "Tower", kind: "rift" as const, lit: () => world.pylons[i]?.lit ?? false })),
  { x: ARENA.x, z: ARENA.z, label: "Stone circle", kind: "rift" },
  { x: SETTLEMENT.x, z: SETTLEMENT.z, label: "Settlement", kind: "fire", lit: () => farlands.live },
  { x: CHOIR_C.x, z: CHOIR_C.z, label: "White light ?", kind: "unknown", known: () => landmarkFound("whitelight") && !save.regions.includes("choir") },
  { x: CHOIR_C.x, z: CHOIR_C.z, label: "White light", kind: "white", known: () => save.regions.includes("choir") },
];
void near;

const COL = { ink: "#e9e6df", dim: "#85827b", fire: "#e0873e", rift: "#62d6e8", danger: "#c4473a", pencil: "#b9563f" };

let open = false;
let sx = (x: number) => x;
let sz = (z: number) => z;
let canvas: HTMLCanvasElement;
let fogCanvas: HTMLCanvasElement;

function garble(s: string) {
  return s.replace(/[A-Z]/gi, (ch) => (Math.random() < 0.35 ? "▒" : ch));
}

/** A label's own slight tilt, as if written by hand (stable per label). */
const tilt = (s: string) => {
  let h = 0;
  for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return ((h % 100) / 100) * 0.08;
};

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
  const span = Math.min(SPAN, Math.max(130, Math.max(x1 - x0, z1 - z0) * 1.35));
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, span };
}

function draw() {
  if (!base) buildBase();
  const S = canvas.width;
  const g = canvas.getContext("2d")!;
  const v = fitView();
  sx = (x: number) => (0.5 - (x - v.x) / v.span) * S;
  sz = (z: number) => (0.5 - (z - v.z) / v.span) * S;
  const src = (img: number) => [mx(v.x + v.span / 2) * img, mz(v.z + v.span / 2) * img, (v.span / SPAN) * img, (v.span / SPAN) * img] as const;
  g.fillStyle = "#151412";
  g.fillRect(0, 0, S, S);
  g.imageSmoothingEnabled = true;
  g.drawImage(base!, ...src(base!.width), 0, 0, S, S);

  // unsurveyed ground: hatched dark paper through a feathered mask
  const fg = fogCanvas.getContext("2d")!;
  const fi = fg.createImageData(GRID, GRID);
  for (let i = 0; i < fog.length; i++) fi.data[i * 4 + 3] = fog[i] ? 0 : 255;
  fg.putImageData(fi, 0, 0);
  fogOut ??= document.createElement("canvas");
  if (fogOut.width !== S) fogOut.width = fogOut.height = S;
  const fo = fogOut.getContext("2d")!;
  fo.globalCompositeOperation = "source-over";
  fo.clearRect(0, 0, S, S);
  fo.imageSmoothingEnabled = true;
  fo.drawImage(fogCanvas, ...src(GRID), 0, 0, S, S);
  fo.globalCompositeOperation = "source-in";
  fo.fillStyle = hatchPattern(fo) ?? "#151412";
  fo.fillRect(0, 0, S, S);
  g.drawImage(fogOut, 0, 0);

  const u = S / 600; // type scale
  // survey grid: every 50 m, lettered along the top and numbered down the side
  g.strokeStyle = "rgba(233,230,223,0.07)";
  g.lineWidth = 1;
  g.font = `500 ${9 * u}px "IBM Plex Mono", monospace`;
  g.fillStyle = "rgba(233,230,223,0.32)";
  g.textAlign = "left";
  for (let wx = Math.ceil((v.x - v.span / 2) / 50) * 50; wx <= v.x + v.span / 2; wx += 50) {
    const X = sx(wx);
    g.beginPath(); g.moveTo(X, 0); g.lineTo(X, S); g.stroke();
    g.fillText(String.fromCharCode(72 - Math.round(wx / 50)), X + 3 * u, 12 * u);
  }
  for (let wz = Math.ceil((v.z - v.span / 2) / 50) * 50; wz <= v.z + v.span / 2; wz += 50) {
    const Y = sz(wz);
    g.beginPath(); g.moveTo(0, Y); g.lineTo(S, Y); g.stroke();
    g.fillText(String(Math.round(wz / 50) + 4), 4 * u, Y - 3 * u);
  }
  // north
  g.save();
  g.translate(S - 26 * u, 30 * u);
  g.strokeStyle = g.fillStyle = "rgba(233,230,223,0.6)";
  g.beginPath(); g.moveTo(0, -14 * u); g.lineTo(5 * u, 6 * u); g.lineTo(0, 2 * u); g.lineTo(-5 * u, 6 * u); g.closePath(); g.stroke();
  g.textAlign = "center";
  g.font = `600 ${10 * u}px "IBM Plex Mono", monospace`;
  g.fillText("N", 0, 20 * u);
  g.restore();

  // if most of the sheet is still blank, say so where it's blank
  g.textAlign = "center";
  g.font = `600 ${13 * u}px "Barlow Condensed", sans-serif`;
  g.fillStyle = "rgba(233,230,223,0.16)";
  for (const [fx, fz] of [[0.5, 0.18], [0.2, 0.62], [0.8, 0.7]]) {
    const wx = v.x - (fx - 0.5) * v.span;
    const wz = v.z - (fz - 0.5) * v.span;
    if (!discovered(wx, wz)) g.fillText("U N K N O W N   T E R R I T O R Y", fx * S, fz * S);
  }

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
  for (const r of REGIONS) {
    const c = sum.get(r.id);
    const x = c ? sx(c[0] / c[2]) : sx(r.label[0]);
    const y = c ? sz(c[1] / c[2]) : sz(r.label[1]);
    g.save();
    g.translate(x, y);
    g.rotate(tilt(r.name) - 0.04);
    if (r.locked?.()) {
      if (!save.storyDone && !save.flags.settlementFound) {
        g.restore();
        continue;
      }
      g.font = `600 ${13 * u}px "Barlow Condensed", sans-serif`;
      g.fillStyle = "rgba(233,230,223,0.3)";
      g.fillText(garble(r.name.toUpperCase()), 0, 0);
    } else if (save.regions.includes(r.id)) {
      g.font = `600 ${15 * u}px "Barlow Condensed", sans-serif`;
      g.fillStyle = "rgba(233,230,223,0.6)";
      g.fillText(r.name.toUpperCase().split("").join(String.fromCharCode(8202)), 0, 0);
    }
    g.restore();
  }

  // landmarks, inked by hand
  for (const m of MARKS) {
    if (!(m.known ? m.known() : discovered(m.x, m.z))) continue;
    const x = sx(m.x);
    const y = sz(m.z);
    const lit = m.lit ? m.lit() : true;
    const col = m.kind === "white" ? "#f2f8fa" : m.kind === "fire" ? (lit ? COL.fire : COL.dim) : m.kind === "rift" ? (lit ? COL.rift : COL.dim) : m.kind === "danger" ? COL.danger : m.kind === "warm" || m.kind === "crash" || m.kind === "tower" ? COL.ink : COL.dim;
    g.fillStyle = col;
    g.strokeStyle = col;
    g.lineWidth = 1.5 * u;
    g.save();
    g.translate(x, y);
    if (m.kind === "fire") {
      g.beginPath();
      g.arc(0, 0, 4 * u, 0, Math.PI * 2);
      lit ? g.fill() : g.stroke();
    } else if (m.kind === "crash") {
      g.beginPath();
      g.moveTo(-6 * u, -6 * u); g.lineTo(6 * u, 6 * u);
      g.moveTo(6 * u, -6 * u); g.lineTo(-6 * u, 6 * u);
      g.stroke();
    } else if (m.kind === "tower") {
      g.beginPath();
      g.moveTo(0, -8 * u); g.lineTo(5 * u, 5 * u); g.lineTo(-5 * u, 5 * u); g.closePath();
      g.stroke();
    } else if (m.kind === "unknown") {
      g.font = `600 ${16 * u}px "IBM Plex Mono", monospace`;
      g.textAlign = "center";
      g.fillText("?", 0, 6 * u);
    } else {
      // a pencil ring, drawn twice and not quite closed
      for (const o of [0, 1]) {
        g.beginPath();
        g.arc(o * 0.6 * u, o * 0.4 * u, (5.5 + o * 0.7) * u, 0.3 + o, Math.PI * 1.85 + o);
        g.stroke();
      }
    }
    g.restore();
    if (m.label) {
      g.save();
      g.translate(x, y + 17 * u);
      g.rotate(tilt(m.label));
      g.font = `500 ${11 * u}px "IBM Plex Mono", monospace`;
      g.textAlign = "center";
      g.fillStyle = "rgba(233,230,223,0.78)";
      g.fillText(m.label.toUpperCase(), 0, 0);
      g.restore();
    }
  }
  // the evidence, pencilled where it was found: numbers that don't stop
  g.font = `500 ${10 * u}px "IBM Plex Mono", monospace`;
  g.fillStyle = COL.pencil;
  const placed = new Map<string, number>();
  g.strokeStyle = COL.pencil;
  g.lineWidth = 1 * u;
  const done = new Set<string>();
  const anchors = new Map<string, [number, number]>();
  for (const e of EVIDENCE) {
    if (!evidenceFound(e.id) || !e.patients.length) continue;
    const fresh = e.patients.filter((p) => !done.has(p));
    if (!fresh.length) continue;
    fresh.forEach((p) => done.add(p));
    // one pencilled column per place, anchored at the first thing found there
    const key = e.where;
    const n = placed.get(key) ?? 0;
    placed.set(key, n + 1);
    const ex = sx(e.at.x);
    const ey = sz(e.at.z);
    const anchor = anchors.get(key) ?? [ex + 34 * u, ey + 26 * u];
    anchors.set(key, anchor);
    const lx = anchor[0];
    const ly = anchor[1] + n * 12 * u;
    g.beginPath();
    g.moveTo(ex + 2 * u, ey + 2 * u);
    g.lineTo(lx - 3 * u, ly - 4 * u);
    g.stroke();
    g.save();
    g.translate(lx, ly);
    g.rotate(-0.05);
    g.textAlign = "left";
    g.fillText(fresh.join(" · "), 0, 0);
    g.restore();
  }

  // you: the arrow. Once you know, it isn't "you" any more.
  const px = sx(player.pos.x);
  const py = sz(player.pos.z);
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
  g.font = `600 ${11 * u}px "IBM Plex Mono", monospace`;
  g.textAlign = "center";
  g.fillStyle = designation() >= 2 ? COL.pencil : COL.fire;
  g.fillText(designation() >= 2 ? "10001" : "YOU", px, py + 20 * u);
}

/** The notes beside the sheet: how much is surveyed, the places, the numbers. */
function notes() {
  let seen = 0;
  for (const f of fog) seen += f;
  $("map-surveyed").textContent = `Surveyed ${Math.max(1, Math.round((seen / fog.length) * 100 * 2.1))}%`;
  const places: string[] = [];
  for (const r of REGIONS) if (save.regions.includes(r.id)) places.push(`<li><span>${r.no}</span>${r.name}</li>`);
  for (const l of LANDMARKS) if (landmarkFound(l.id)) places.push(`<li><span>··</span>${l.name}</li>`);
  $("map-places").innerHTML = places.join("") || "<li class='mn-none'>Nothing yet.</li>";
  const pts = knownPatients().map((p) => `<li><span>${p.no}</span>${p.where}</li>`);
  if (designation() >= 2) pts.push(`<li class="mn-you"><span>10001</span>You</li>`);
  $("map-patients").innerHTML = pts.join("") || "<li class='mn-none'>None found.</li>";
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
    notes();
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
    mapBtn = b;
  }
}

export const mapOpen = () => open;
