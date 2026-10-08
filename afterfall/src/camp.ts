// THE CAMP — the fire becomes somewhere you live.
//
// Six small things you can put together around it, each where it would
// really go, each out of something you can see lying there first: a heap of
// stones, a rolled tarp, two broken pallets, a dented Meridian case, an empty
// crate, a door off the wreck. Walk up to it and build it. No menu.
//
//   FIRE PIT   stones stacked two high, a tripod and a pot   burns slower, throws more light
//   STORAGE    crates under a tarp                           what you stow here outlives you
//   SHELTER    a lean-to and a bedroll                       rest; you wake here
//   MEDICAL    the case opened on a crate, bandages drying   patch yourself up
//   RADIO      the mast's radio rebuilt, a wire up a pole    Rhea, clearer; your radio charges
//   MAP TABLE  the door on trestles, your finds pinned to it what you've found, on the map
//
// What it costs: things you carry (scrap, fuel, batteries), shards, what
// you've found out, how far the story has gone. Built is built: it stays
// through every death (save.flags["camp:<id>"]).

import * as THREE from "three";
import { fx, LOW, persist, player, say, sfx, toast, type Interact, voice, world } from "./ctx";
import { evidenceFound } from "./history";
import { save } from "./save";
import * as S from "./script";
import { carryCap, type Res, supplies, survival } from "./survival";
import { CAMP, heightAt } from "./world";

export type CampId = "pit" | "storage" | "shelter" | "medic" | "radio" | "table";
type Cost = Partial<Record<Res | "shards", number>>;

interface Piece {
  id: CampId;
  /** prompt verb when you can build it */
  verb: string;
  /** what it is, when you can't yet */
  noun: string;
  /** offset from the fire (x: west, z: north) and facing */
  at: [number, number, number];
  cost: Cost;
  /** a reason it can't be built yet (in the world's words), or null */
  gate: (stage: string) => string | null;
}

const built = (id: CampId) => !!save.flags["camp:" + id];
export const camp = { built };

const PAST_FIRST = ["ch2", "pylons", "boss", "ending", "changed", "settlement", "basin", "choir", "finale", "done"];
const evidenceCount = () => Object.keys(save.flags).filter((k) => k.startsWith("ev:")).length;

const PIECES: Piece[] = [
  { id: "pit", verb: "Build up the fire pit", noun: "A heap of flat stones", at: [0.3, -2.1, 0.4], cost: { scrap: 2 }, gate: () => null },
  { id: "storage", verb: "Make a store", noun: "Two broken pallets", at: [-3.7, 3.3, -0.6], cost: { scrap: 3, shards: 6 }, gate: () => null },
  {
    id: "shelter",
    verb: "Put up a shelter",
    noun: "A rolled tarp and poles",
    at: [3.7, 3.1, 0.55],
    cost: { scrap: 4, shards: 8 },
    gate: (st) => (PAST_FIRST.includes(st) || save.flags["rw:firstNight"] ? null : "Not tonight. Get through the night first."),
  },
  {
    id: "medic",
    verb: "Set up a medical station",
    noun: "A dented Meridian case",
    at: [3.9, -1.5, 1.2],
    cost: { shards: 12, fuel: 1 },
    gate: () => (evidenceCount() >= 3 ? null : "Sealed. You don't know what half of this is for yet."),
  },
  {
    id: "radio",
    verb: "Rebuild the radio",
    noun: "An empty crate",
    at: [-4.1, -0.3, -1.3],
    cost: { batteries: 2, scrap: 2 },
    gate: (st) => (evidenceFound("d-radio") || st === "ch2" ? null : "Nothing to build a radio out of. Not yet."),
  },
  {
    id: "table",
    verb: "Make a map table",
    noun: "A door off the wreck",
    at: [0.6, 4.6, 0.1],
    cost: { scrap: 2, shards: 8 },
    gate: () => (evidenceCount() >= 5 ? null : "Not enough to put on a map. Find out more first."),
  },
];

const mat = (color: number, rough = 0.9, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });
const WOOD = mat(0x5a4836, 1);
const DARK = mat(0x3a2f26, 1);
const GREY = mat(0x6d6a66, 1, 0, { flatShading: true });
const TARP = mat(0x3d4a44, 1, 0, { side: THREE.DoubleSide });
const CLOTH = mat(0xcfc9bb, 1, 0, { side: THREE.DoubleSide });
const OLIVE = mat(0x4a4f3a, 0.9);
const METAL = mat(0x55585a, 0.5, 0.6);

const mesh = (geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => {
  const o = new THREE.Mesh(geo, m);
  o.position.set(x, y, z);
  o.rotation.set(rx, ry, rz);
  return o;
};
const rock = (s: number, seed: number) => {
  const g = new THREE.DodecahedronGeometry(s, 0);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    const k = 0.82 + 0.3 * Math.abs(Math.sin(seed * 12.9 + i * 3.7));
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.6, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
};
/** A crate with the Meridian stripe. */
const crate = (w = 0.62, h = 0.4, d = 0.45, m = OLIVE) => {
  const c = new THREE.Group();
  c.add(mesh(new THREE.BoxGeometry(w, h, d), m));
  for (const s of [-1, 1]) c.add(mesh(new THREE.BoxGeometry(w + 0.01, 0.035, 0.03), DARK, 0, (s * h) / 3, d / 2));
  return c;
};
/** A sagging cloth between points (tarps, bandages). */
const sheet = (w: number, h: number, sag: number, m: THREE.Material) => {
  const g = new THREE.PlaneGeometry(w, h, 6, 4);
  const p = g.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) p.setZ(i, -Math.cos((p.getX(i) / w) * Math.PI) * sag - Math.abs(p.getY(i)) * sag * 0.6);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
};
const pole = (len: number, r = 0.04) => mesh(new THREE.CylinderGeometry(r * 0.85, r, len, 6), DARK);

/** The map on the table: your finds as pins (redrawn as you find more). */
function mapTex() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 340;
  const g = c.getContext("2d")!;
  g.fillStyle = "#c9bfa6";
  g.fillRect(0, 0, 512, 340);
  g.strokeStyle = "rgba(60,48,36,0.55)";
  g.lineWidth = 2;
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    for (let x = 0; x <= 512; x += 16) g.lineTo(x, 30 + i * 36 + Math.sin(x * 0.02 + i) * 10);
    g.stroke();
  }
  g.strokeStyle = "rgba(140,52,40,0.85)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(250, 200);
  g.lineTo(196, 120);
  g.lineTo(130, 150);
  g.stroke();
  const n = Object.keys(save.flags).filter((k) => k.startsWith("ev:")).length;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996;
    const r = 30 + 12 * Math.sqrt(i) * 3;
    g.fillStyle = i % 3 ? "#8a2a22" : "#2a2622";
    g.beginPath();
    g.arc(256 + Math.cos(a) * r * 1.4, 170 + Math.sin(a) * r * 0.9, 6, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = "rgba(40,30,22,0.8)";
  g.font = "600 22px monospace";
  g.fillText("X", 244, 210);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ------------------------------------------------------------------ the raw materials
function raw(id: CampId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case "pit":
      for (let i = 0; i < 9; i++) g.add(mesh(rock(0.17 + (i % 3) * 0.04, i), GREY, Math.sin(i * 2.1) * 0.35, 0.08 + (i > 5 ? 0.12 : 0), Math.cos(i * 1.7) * 0.3, 0, i, 0));
      break;
    case "storage":
      for (const [y, ry] of [[0.06, 0.2], [0.17, -0.25]] as const) {
        const p = new THREE.Group();
        for (let i = 0; i < 4; i++) p.add(mesh(new THREE.BoxGeometry(1.1, 0.03, 0.16), WOOD, 0, 0.08, -0.36 + i * 0.24, 0, 0, i === 2 ? 0.08 : 0));
        for (const z of [-0.4, 0.4]) p.add(mesh(new THREE.BoxGeometry(1.1, 0.08, 0.08), DARK, 0, 0.03, z));
        p.position.y = y - 0.04;
        p.rotation.set(0.04, ry, 0);
        g.add(p);
      }
      break;
    case "shelter": {
      const roll = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.4, 10), TARP, 0, 0.16, 0, 0, 0, Math.PI / 2);
      g.add(roll);
      for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.035, 0.04, 2.2, 6), DARK, 0.1 * i - 0.1, 0.05 + i * 0.02, 0.4 + i * 0.08, 0, 0.15 * i, Math.PI / 2));
      break;
    }
    case "medic": {
      const c = crate(0.6, 0.24, 0.4, mat(0xd8d4c8, 0.7));
      c.position.y = 0.12;
      c.rotation.set(0, 0.3, 0.12);
      g.add(c);
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.002, 0.05), mat(0xa02a22, 0.7), 0.0, 0.25, 0.03, 0, 0.3, 0.12));
      break;
    }
    case "radio": {
      const c = crate();
      c.position.y = 0.2;
      g.add(c);
      break;
    }
    case "table": {
      // a door, face up in the grass, its window long gone
      g.add(mesh(new THREE.BoxGeometry(0.8, 0.05, 1.9), mat(0xbab4ac, 0.6, 0.4), 0, 0.03, 0, 0.02, 0.4, 0.03));
      break;
    }
  }
  return g;
}

// ------------------------------------------------------------------ what gets built
function make(id: CampId): THREE.Group {
  const g = new THREE.Group();
  switch (id) {
    case "pit": {
      // two courses of stones round the fire, a tripod and a pot, split wood stacked by it
      const ring = new THREE.Group();
      for (let k = 0; k < 2; k++) {
        const n = k ? 12 : 15;
        for (let i = 0; i < n; i++) {
          const a = (i / n) * Math.PI * 2 + k * 0.2;
          const r = k ? 0.98 : 1.08;
          ring.add(mesh(rock(0.2 - k * 0.03, i + k * 20), GREY, Math.cos(a) * r, 0.09 + k * 0.15, Math.sin(a) * r, 0, -a, 0));
        }
      }
      g.add(ring);
      const tri = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const leg = pole(1.75, 0.025);
        leg.position.set(Math.cos(a) * 0.55, 0.82, Math.sin(a) * 0.55);
        leg.rotation.set(Math.sin(a) * -0.32, 0, Math.cos(a) * 0.32);
        tri.add(leg);
      }
      tri.add(mesh(new THREE.CylinderGeometry(0.003, 0.003, 0.5), METAL, 0, 1.36, 0));
      const pot = mesh(new THREE.CylinderGeometry(0.15, 0.12, 0.2, 12), mat(0x2a2826, 0.5, 0.6), 0, 1.02, 0);
      tri.add(pot);
      g.add(tri);
      // split wood stacked where the stone heap was
      const wood = new THREE.Group();
      wood.position.set(0.3, 0, -2.1);
      wood.rotation.y = 0.4;
      g.add(wood);
      for (let i = 0; i < 7; i++) wood.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.7, 6), i % 2 ? WOOD : DARK, (i % 4) * 0.15 - 0.22, 0.07 + Math.floor(i / 4) * 0.13, 0, 0, 0, Math.PI / 2));
      break;
    }
    case "storage": {
      const stack: [number, number, number, number][] = [[0, 0.2, 0, 0.1], [0.66, 0.2, 0.05, -0.08], [0.3, 0.6, 0.02, 0.25], [-0.1, 0.2, 0.62, 0.4]];
      for (const [x, y, z, ry] of stack) {
        const c = crate();
        c.position.set(x, y, z);
        c.rotation.y = ry;
        g.add(c);
      }
      const t = sheet(1.6, 1.3, 0.12, TARP);
      t.rotation.set(-Math.PI / 2 + 0.25, 0, 0.05);
      t.position.set(0.3, 0.86, 0.12);
      g.add(t);
      const bag = mesh(new THREE.SphereGeometry(0.2, 8, 6), mat(0x3b3f30, 1), 1.15, 0.18, 0.35);
      bag.scale.set(1, 0.8, 0.7);
      g.add(bag);
      g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.42, 10), mat(0x7a2418, 0.6, 0.35), -0.6, 0.21, -0.1));
      break;
    }
    case "shelter": {
      // a lean-to: two uprights, a ridge, the tarp sloping back to the ground, a bedroll under it
      for (const x of [-1.05, 1.05]) {
        const p = pole(1.5);
        p.position.set(x, 0.75, 0.55);
        g.add(p);
      }
      const ridge = pole(2.4, 0.035);
      ridge.rotation.z = Math.PI / 2;
      ridge.position.set(0, 1.48, 0.55);
      g.add(ridge);
      const t = sheet(2.5, 1.85, 0.08, TARP);
      t.rotation.x = -Math.PI / 2 + 0.92;
      t.position.set(0, 0.76, -0.12);
      g.add(t);
      const roll = mesh(new THREE.BoxGeometry(0.75, 0.08, 1.75), mat(0x5c4a3a, 1), 0.1, 0.05, -0.05, 0, 0.04, 0);
      g.add(roll);
      g.add(mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.72, 10), mat(0x6a5a46, 1), 0.1, 0.11, -0.86, 0, 0, Math.PI / 2));
      g.add(mesh(new THREE.BoxGeometry(0.3, 0.1, 0.22), mat(0x3b3f30, 1), -0.75, 0.05, 0.35, 0, 0.5, 0));
      // guy lines to pegs
      const lm = new THREE.LineBasicMaterial({ color: 0x8a8270 });
      for (const x of [-1.05, 1.05]) g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x, 1.48, 0.55), new THREE.Vector3(x * 1.45, 0.02, 1.35)]), lm));
      break;
    }
    case "medic": {
      const c = crate(0.7, 0.5, 0.5);
      c.position.y = 0.25;
      g.add(c);
      // the case, open on top: cloth, a few bottles, a roll of bandage
      const base = mesh(new THREE.BoxGeometry(0.56, 0.1, 0.36), mat(0xd8d4c8, 0.7), 0, 0.55, 0);
      const lid = mesh(new THREE.BoxGeometry(0.56, 0.02, 0.36), mat(0xd8d4c8, 0.7), 0, 0.68, -0.29, -1.2, 0, 0);
      g.add(base, lid);
      g.add(mesh(new THREE.BoxGeometry(0.16, 0.003, 0.05), mat(0xa02a22, 0.7), 0, 0.71, -0.27, -1.2, 0, 0));
      g.add(mesh(new THREE.PlaneGeometry(0.42, 0.26), CLOTH, 0, 0.605, 0.02, -Math.PI / 2, 0, 0.1));
      for (let i = 0; i < 3; i++) g.add(mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.1, 8), mat(i ? 0x6e8796 : 0x8a6a3a, 0.25), -0.16 + i * 0.07, 0.66, 0.06));
      g.add(mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.08, 10), CLOTH, 0.16, 0.65, 0.04, 0, 0, Math.PI / 2));
      // bandages drying on a line from a stake
      const st = pole(1.6, 0.03);
      st.position.set(0.85, 0.8, -0.1);
      g.add(st);
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0.85, 1.5, -0.1), new THREE.Vector3(0.4, 1.38, -0.15), new THREE.Vector3(-0.2, 1.3, -0.2)]), new THREE.LineBasicMaterial({ color: 0x8a8270 })));
      for (let i = 0; i < 2; i++) g.add(mesh(new THREE.PlaneGeometry(0.1, 0.42), CLOTH, 0.55 - i * 0.4, 1.17 - i * 0.04, -0.13 - i * 0.03, 0, 0.3, 0));
      break;
    }
    case "radio": {
      const c = crate();
      c.position.y = 0.2;
      g.add(c);
      const set = new THREE.Group();
      set.add(mesh(new THREE.BoxGeometry(0.4, 0.22, 0.2), mat(0x3d4232, 0.7, 0.2)));
      const dial = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.02, 12), mat(0x8a8470, 0.5, 0.4), 0.12, 0, 0.105, Math.PI / 2, 0, 0);
      set.add(dial);
      set.add(mesh(new THREE.PlaneGeometry(0.18, 0.13), mat(0x1d1f1a, 1), -0.07, 0, 0.101));
      // the one bright thing: a small green lamp
      set.add(mesh(new THREE.SphereGeometry(0.012, 6, 4), mat(0x103010, 0.4, 0, { emissive: 0x6dff8a, emissiveIntensity: 2.2 }), 0.15, 0.07, 0.101));
      set.position.set(0, 0.52, 0);
      set.rotation.y = 0.2;
      g.add(set);
      g.add(mesh(new THREE.BoxGeometry(0.24, 0.18, 0.17), mat(0x1e1f20, 0.6, 0.3), 0.55, 0.09, 0.1, 0, 0.3, 0)); // a battery, wired in
      const mast = pole(3.2, 0.03);
      mast.position.set(-0.5, 1.6, -0.3);
      g.add(mast);
      const lm = new THREE.LineBasicMaterial({ color: 0x2a2826 });
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.6, -0.05), new THREE.Vector3(-0.3, 0.9, -0.25), new THREE.Vector3(-0.5, 3.1, -0.3)]), lm));
      g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.5, 3.15, -0.3), new THREE.Vector3(-1.9, 0.02, -1.4)]), new THREE.LineBasicMaterial({ color: 0x8a8270 })));
      break;
    }
    case "table": {
      for (const z of [-0.65, 0.65]) {
        for (const s of [-1, 1]) {
          const leg = pole(0.95, 0.035);
          leg.position.set(s * 0.25, 0.43, z);
          leg.rotation.z = s * 0.3;
          g.add(leg);
        }
        g.add(mesh(new THREE.BoxGeometry(0.62, 0.06, 0.06), DARK, 0, 0.82, z));
      }
      g.add(mesh(new THREE.BoxGeometry(0.85, 0.05, 1.95), mat(0xbab4ac, 0.6, 0.4), 0, 0.875, 0));
      const map = mesh(new THREE.PlaneGeometry(0.7, 1.05), new THREE.MeshStandardMaterial({ map: mapTex(), roughness: 1 }), 0, 0.903, 0.1, -Math.PI / 2, 0, Math.PI / 2 + 0.06);
      map.name = "map";
      g.add(map);
      for (const [x, z] of [[-0.3, -0.38], [0.28, 0.6]] as const) g.add(mesh(rock(0.06, x * 9), GREY, x, 0.92, z));
      // a lantern with no light of its own: a glow in its glass
      const lan = new THREE.Group();
      lan.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 10), mat(0x2a2522, 0.6, 0.6)));
      lan.add(mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 10), mat(0x2a1f10, 0.3, 0, { emissive: 0xffb860, emissiveIntensity: 1.3 }), 0, 0.09, 0));
      lan.add(mesh(new THREE.ConeGeometry(0.08, 0.06, 10), mat(0x2a2522, 0.6, 0.6), 0, 0.19, 0));
      lan.position.set(0.25, 0.92, -0.72);
      g.add(lan);
      g.add(mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.16, 5), mat(0x1a1a1a, 0.6), -0.15, 0.91, -0.6, Math.PI / 2, 0, 0.5)); // a pencil
      break;
    }
  }
  return g;
}

const COLL: Record<CampId, number> = { pit: 0.45, storage: 0.9, shelter: 0, medic: 0.45, radio: 0.4, table: 0.6 };

interface Slot {
  p: Piece;
  pos: THREE.Vector3;
  root: THREE.Group;
  raw: THREE.Group;
  done: THREE.Group | null;
  grow: number;
}

class Camp {
  slots: Slot[] = [];
  built = built;
  /** what's stowed in the crates (outlives you) */
  stash: Record<Res, number> = { food: 0, water: 0, fuel: 0, scrap: 0, batteries: 0 };
  private restCd = 0;
  private medCd = 0;
  private radioCd = 0;
  private stage = "";

  build() {
    try {
      if (typeof save.flags.stash === "string") Object.assign(this.stash, JSON.parse(save.flags.stash));
    } catch {}
    for (const p of PIECES) {
      const [dx, dz, ry] = p.at;
      const pos = new THREE.Vector3(CAMP.x + dx, 0, CAMP.z + dz);
      pos.y = heightAt(pos.x, pos.z);
      const root = new THREE.Group();
      root.position.copy(pos);
      root.rotation.y = ry;
      const r = raw(p.id);
      root.add(r);
      world.scene.add(root);
      const s: Slot = { p, pos, root, raw: r, done: null, grow: 1 };
      this.slots.push(s);
      if (built(p.id)) this.finish(s, true);
      // the medical case only turns up once there's a reason to open it
    }
    this.shadows();
  }

  private shadows() {
    for (const s of this.slots) s.root.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = !LOW), (m.receiveShadow = true))));
  }

  private finish(s: Slot, quiet: boolean) {
    s.raw.visible = false;
    const d = make(s.p.id);
    if (s.p.id === "pit") {
      // the stones go round the fire itself, not where the heap was
      d.position.set(CAMP.x, CAMP.y, CAMP.z);
      world.scene.add(d);
    } else s.root.add(d);
    s.done = d;
    if (COLL[s.p.id] && s.p.id !== "pit") world.colliders.push({ x: s.pos.x, z: s.pos.z, r: COLL[s.p.id] });
    if (s.p.id === "pit") world.campfire.fire.setBoost(1.3);
    s.grow = quiet ? 1 : 0;
    if (!quiet) d.scale.setScalar(0.01);
    this.shadows();
    if (s.p.id === "pit") d.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = !LOW), (m.receiveShadow = true))));
  }

  /** What you're short of (counting what's in the store), or null. */
  private short(c: Cost): string | null {
    for (const [k, n] of Object.entries(c) as [Res | "shards", number][]) {
      const have = k === "shards" ? save.bank : supplies[k] + (built("storage") ? this.stash[k] : 0);
      if (have < n) return `${n} ${k}`;
    }
    return null;
  }

  private costText(c: Cost) {
    return Object.entries(c)
      .map(([k, n]) => `${n} ${k}`)
      .join(" · ");
  }

  private pay(c: Cost) {
    for (const [k, n] of Object.entries(c) as [Res | "shards", number][]) {
      if (k === "shards") {
        save.bank -= n;
        continue;
      }
      let left = n;
      const fromBag = Math.min(supplies[k], left);
      supplies[k] -= fromBag;
      left -= fromBag;
      if (left > 0) this.stash[k] -= left; // the rest out of the crates
    }
    this.saveStash();
    survival.renderInv(true);
  }

  private saveStash() {
    save.flags.stash = JSON.stringify(this.stash);
    persist();
  }

  private async raise(s: Slot) {
    const why = s.p.gate(this.stage);
    if (why) {
      toast(why, 2600);
      return;
    }
    const miss = this.short(s.p.cost);
    if (miss) {
      toast(`You need ${miss}.`, 2200);
      return;
    }
    this.pay(s.p.cost);
    save.flags["camp:" + s.p.id] = true;
    persist();
    player.frozen = true;
    sfx.build();
    fx.sparks(s.pos.clone().setY(s.pos.y + 0.3), 6, 1.5);
    await new Promise((r) => window.setTimeout(r, 1500));
    player.frozen = false;
    this.finish(s, false);
    voice.interrupt();
    void say(S.CAMP_BUILT[s.p.id]);
  }

  interacts(stage: string): Interact[] {
    this.stage = stage;
    const list: Interact[] = [];
    for (const s of this.slots) {
      if (s.done) continue;
      if (s.p.id === "medic" && evidenceCount() < 1) continue; // not lying there yet
      list.push({
        pos: () => s.pos,
        r: 1.9,
        label: () => {
          if (s.p.gate(stage)) return `${s.p.noun}`;
          const miss = this.short(s.p.cost);
          return miss ? `${s.p.noun} <span class="dim">needs ${this.costText(s.p.cost)}</span>` : `${s.p.verb} <span class="dim">${this.costText(s.p.cost)}</span>`;
        },
        when: () => !player.frozen,
        run: () => void this.raise(s),
      });
    }
    const at = (id: CampId) => this.slots.find((s) => s.p.id === id)!.pos;
    if (built("storage")) {
      const carried = () => (Object.keys(supplies) as Res[]).reduce((n, k) => n + supplies[k], 0);
      const stored = () => (Object.keys(this.stash) as Res[]).reduce((n, k) => n + this.stash[k], 0);
      list.push({
        pos: () => at("storage"),
        r: 2.0,
        label: () => (carried() ? `Stow what you're carrying <span class="dim">it stays here</span>` : `Take from the store <span class="dim">${stored()} things</span>`),
        when: () => carried() > 0 || stored() > 0,
        run: () => (carried() ? this.stow() : this.take()),
      });
    }
    if (built("shelter"))
      list.push({ pos: () => at("shelter"), r: 2.0, label: "Rest under the tarp", when: () => this.restCd <= 0 && (player.hp < player.maxHp - 5 || player.stamina < 70), run: () => void this.rest() });
    if (built("medic"))
      list.push({
        pos: () => at("medic"),
        r: 1.8,
        label: () => (player.medkits < 2 ? `Patch yourself up <span class="dim">and pack a dressing</span>` : "Patch yourself up"),
        when: () => this.medCd <= 0 && (player.hp < player.maxHp - 5 || player.medkits < 2),
        run: () => this.patch(),
      });
    if (built("radio")) list.push({ pos: () => at("radio"), r: 1.8, label: "Call Rhea", when: () => this.radioCd <= 0 && !voice.busy, run: () => this.call() });
    if (built("table")) list.push({ pos: () => at("table"), r: 2.0, label: "Look at the map", when: () => true, run: () => this.onMap() });
    return list;
  }

  /** Opened by story.ts (the map module would import us otherwise). */
  onMap = () => {};

  private stow() {
    for (const k of Object.keys(supplies) as Res[]) {
      this.stash[k] += supplies[k];
      supplies[k] = 0;
    }
    sfx.rummage();
    toast("Stowed. It'll be here.", 1800);
    this.saveStash();
    survival.renderInv(true);
  }

  private take() {
    let n = 0;
    for (const k of Object.keys(this.stash) as Res[]) {
      const t = Math.min(this.stash[k], carryCap() - supplies[k]);
      this.stash[k] -= t;
      supplies[k] += t;
      n += t;
    }
    sfx.rummage();
    toast(n ? "You take what you can carry." : "You can't carry any more.", 1800);
    this.saveStash();
    survival.renderInv(true);
  }

  private async rest() {
    this.restCd = 90;
    player.frozen = true;
    const b = document.getElementById("blackout")!;
    b.style.transition = "opacity 0.8s";
    b.style.opacity = "0.85";
    await new Promise((r) => window.setTimeout(r, 1600));
    player.hp = player.maxHp;
    player.stamina = player.maxStamina;
    sfx.heal();
    b.style.opacity = "0";
    player.frozen = false;
    toast("You rest for a while.", 1800);
  }

  private patch() {
    this.medCd = 120;
    player.hp = player.maxHp;
    if (player.medkits < 2) player.medkits++;
    sfx.heal();
    toast(player.medkits < 2 ? "Cleaned up and dressed." : "Cleaned up, and a dressing packed for later.", 2000);
    survival.renderInv(true);
  }

  private call() {
    this.radioCd = 40;
    survival.chargeRadio();
    sfx.staticBurst(0.4, 0.1);
    const pool = S.CAMP_RADIO;
    const run = Number(save.flags.run ?? 0);
    void say(pool[(run + Math.floor(Math.random() * pool.length)) % pool.length]);
  }

  /** You're home: the radio there (if built) clears Rhea up. */
  get radioHere() {
    return built("radio") && Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) < 14;
  }

  private evSeen = -1;

  update(dt: number) {
    const ev = evidenceCount();
    if (ev !== this.evSeen) {
      this.evSeen = ev;
      this.refreshMap();
    }
    this.restCd -= dt;
    this.medCd -= dt;
    this.radioCd -= dt;
    for (const s of this.slots) {
      if (!s.done || s.grow >= 1) continue;
      s.grow = Math.min(1, s.grow + dt * 1.6);
      // pieces settle into place rather than pop: a little overshoot
      const k = 1 - Math.pow(1 - s.grow, 3);
      s.done.scale.set(k, Math.min(1, k * 1.05), k);
    }
  }

  /** Redraw the pinned map (after you find something). */
  refreshMap() {
    const s = this.slots.find((x) => x.p.id === "table");
    const m = s?.done?.getObjectByName("map") as THREE.Mesh | undefined;
    if (!m) return;
    const mt = m.material as THREE.MeshStandardMaterial;
    mt.map?.dispose();
    mt.map = mapTex();
    mt.needsUpdate = true;
  }

  /** Testing. */
  grant(id: CampId) {
    const s = this.slots.find((x) => x.p.id === id);
    if (!s || s.done) return;
    save.flags["camp:" + id] = true;
    this.finish(s, true);
  }
}

export const base = new Camp();
