// CHAPTER ONE: THE FIRST NIGHT — the survival loop.
//
//   SCAVENGE  supplies are where they'd really be: luggage, the crash's medical
//             kit, a fuel can thrown clear, the ambulance's lockers, what the
//             people at the Old Camp left, the Watch's cases and generator.
//             Each place is searched once. Nothing glows.
//   THE FIRE  burns down through the night. Fuel feeds it. Near it you heal a
//             little faster and the Hollow are afraid to come in, but not too
//             afraid: they circle at the edge of the light and wait.
//   THE NIGHT early → deep → storm → dawn, by feel rather than by clock: the
//             light and the weather turn, the sounds come closer, the radio
//             breaks up. Then the Hollow give up and go back into the trees.
//
// Small state machines and one-time spots; no new lights except what the
// fire already has; at most four Hollow, two at a time.

import * as THREE from "three";
import { $, camera, cine, collectShard, enemies, fx, hud, type Interact, LOW, pick, player, say, setObjective, sfx, state, toast, TOUCH, voice, world } from "./ctx";
import type { Enemy } from "./enemies";
import type { Signs } from "./signs";
import * as S from "./script";
import { CAMP, heightAt, MICRO, OLD_CAMP, STATION } from "./world";
import { save } from "./save";

export type Res = "food" | "water" | "fuel" | "scrap" | "batteries";
type Give = Partial<Record<Res | "med" | "shards", number>>;
type Phase = "off" | "early" | "deep" | "storm" | "dawn" | "home";

/** What you're carrying. Medkits live on the player (Q / Heal uses one). */
export const supplies: Record<Res, number> = { food: 0, water: 0, fuel: 0, scrap: 0, batteries: 0 };
const up = (k: string) => !!save.flags["up:" + k];
/** How much of each supply you can carry (Field training raises it). */
export const carryCap = () => (up("field") ? 8 : 5);
/** Seconds to search something (Steady hand halves it). */
const searchTime = () => (up("hand") ? 0.4 : 0.85);

const NAMES: Record<Res | "med" | "shards", [string, string]> = {
  shards: ["Shard", "Shards"],
  food: ["Food", "Food"],
  water: ["Water", "Water"],
  fuel: ["Fuel", "Fuel"],
  scrap: ["Scrap", "Scrap"],
  batteries: ["Battery", "Batteries"],
  med: ["Medkit", "Medkits"],
};
const HINT: Record<Res | "med" | "shards", string> = {
  shards: "People out here trade in them.",
  fuel: "Fuel keeps the fire alive.",
  food: "Eat by the fire to recover.",
  water: "Drink by the fire to recover.",
  scrap: "Three scrap rigs an alarm around camp.",
  batteries: "Batteries keep your radio alive.",
  med: TOUCH ? "Heal to use it." : "Q to use it.",
};

interface Spot {
  id: string;
  /** what a full one holds; each night's contents vary around it */
  base: Give;
  /** a minor cache: where it lies changes from night to night */
  minor?: boolean;
  x: number;
  z: number;
  r: number;
  label: string;
  give: Give;
  /** a prop that goes when it's taken (a fuel can, a pile of wood) */
  prop?: THREE.Object3D;
  taken: boolean;
}

const mat = (color: number, rough = 0.9, metal = 0) => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

/** A steel jerrican, red paint worn through at the edges. */
function jerrican() {
  const g = new THREE.Group();
  const red = mat(0x7a2418, 0.6, 0.35);
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.17), red);
  body.position.y = 0.23;
  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), mat(0x2a2522, 0.6, 0.5));
  handle.position.y = 0.49;
  const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.08, 8), mat(0x2a2522, 0.5, 0.6));
  spout.position.set(0.12, 0.5, 0);
  const x = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.03, 0.18), mat(0x5e1c12, 0.7, 0.3));
  x.position.y = 0.3;
  g.add(body, handle, spout, x);
  return g;
}

/** Dead wood: a few dry limbs, broken to length, piled. */
function woodpile(n = 4) {
  const g = new THREE.Group();
  const m = mat(0x4a3d32, 1);
  for (let i = 0; i < n; i++) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05 + (i % 3) * 0.015, 0.06 + (i % 2) * 0.02, 0.9 + (i % 3) * 0.25, 6), m);
    l.rotation.set(Math.PI / 2, 0, (i - n / 2) * 0.35 + (i % 2) * 0.2);
    l.position.set((i % 2) * 0.08, 0.06 + Math.floor(i / 2) * 0.09, (i - n / 2) * 0.06);
    g.add(l);
  }
  return g;
}

/** A log rolled up to the fire to sit on. */
function seatLog() {
  const g = new THREE.Group();
  const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 1.5, 9), mat(0x3e3229, 1));
  l.rotation.z = Math.PI / 2;
  l.position.y = 0.2;
  g.add(l);
  return g;
}

// ---------------------------------------------------------------- minor caches
/** Places a minor cache could plausibly lie: path edges, under trees, by rocks.
 *  Each night a different handful of them hold something. */
const MINOR_SPOTS: [number, number][] = [
  [-4, 16], [12, -6], [24, 10], [-14, -4], [-30, 18], [-36, 38], [-20, 46], [4, 40], [18, 36], [32, 22], [40, 8],
  [-2, -12], [-44, 14], [-30, -8], [26, 46], [10, 58], [-12, 58], [48, 34], [-48, -6], [30, -10], [-6, 48], [56, 14],
];
const small = (w: number, h: number, d: number, color: number, rough = 0.85, metal = 0) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color, rough, metal));
  m.position.y = h / 2;
  return m;
};
function rucksack() {
  const g = new THREE.Group();
  const b = small(0.38, 0.46, 0.22, 0x3a4234);
  b.rotation.x = -1.2;
  b.position.set(0, 0.13, 0);
  const flap = small(0.36, 0.06, 0.18, 0x2e352a);
  flap.position.set(0, 0.27, -0.12);
  g.add(b, flap);
  return g;
}
function tin() {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.14, 12), mat(0x8a8d84, 0.45, 0.7));
  t.position.y = 0.07;
  const t2 = t.clone();
  t2.position.set(0.17, 0.07, 0.05);
  g.add(t, t2);
  return g;
}
function pouch(color: number) {
  const g = new THREE.Group();
  const p = new THREE.Mesh(new THREE.SphereGeometry(0.13, 8, 6), mat(color, 1));
  p.scale.set(1.2, 0.6, 0.9);
  p.position.y = 0.07;
  g.add(p);
  return g;
}
function medPouch() {
  const g = new THREE.Group();
  g.add(small(0.28, 0.1, 0.18, 0xc8c2b4, 0.8));
  const c = small(0.08, 0.002, 0.025, 0xa02a22);
  c.position.y = 0.101;
  g.add(c, c.clone().rotateY(Math.PI / 2));
  return g;
}
function bottle() {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.3, 10), mat(0x7a2418, 0.55, 0.3));
  b.rotation.z = Math.PI / 2 - 0.1;
  b.position.y = 0.07;
  g.add(b);
  return g;
}
function crate(color = 0x4a4f3a, size = 0.55) {
  const g = new THREE.Group();
  g.add(small(size, size * 0.65, size * 0.75, color, 0.9));
  return g;
}
/** A Meridian drop crate: heavy, stencilled, half sunk in the leaf litter. */
function rareCrate() {
  const g = new THREE.Group();
  const c = small(1.1, 0.6, 0.75, 0x3a4248, 0.6, 0.3);
  c.position.y = 0.18;
  c.rotation.z = 0.12;
  g.add(c);
  const band = small(1.12, 0.06, 0.77, 0x9c3a24, 0.7);
  band.position.y = 0.42;
  band.rotation.z = 0.12;
  g.add(band);
  return g;
}
/** Yours: the pack you were carrying when you went down. */
function myPack() {
  const g = rucksack();
  g.scale.setScalar(1.15);
  return g;
}
const MINOR_KINDS: { label: string; give: Give; prop: () => THREE.Object3D }[] = [
  { label: "Search the rucksack", give: { food: 1, water: 1, batteries: 1 }, prop: rucksack },
  { label: "Open the ration tins", give: { food: 2 }, prop: tin },
  { label: "Search the medical pouch", give: { med: 1 }, prop: medPouch },
  { label: "Take the fuel bottle", give: { fuel: 1 }, prop: bottle },
  { label: "Take the battery box", give: { batteries: 2 }, prop: () => crate(0x2e3236, 0.32) },
  { label: "Open the cloth pouch", give: { shards: 4 }, prop: () => pouch(0x4a3d32) },
  { label: "Search the supply crate", give: { food: 1, water: 1, scrap: 1, shards: 2 }, prop: () => crate() },
];

/** The deep woods: deep in the Blackwood, where nothing grows light. Better
 *  finds; more of them come; you can barely see. Nobody makes you go. */
export const DEEP = { x: -86, z: 34, r: 26 };
const DEEP_DROPS: [number, number][] = [[-94, 44], [-80, 20], [-100, 28]];

// ---------------------------------------------------------------- the radio
/** 1 = fresh batteries. It runs down over the night. */
const radio = { charge: 1, warned: false };

// ---------------------------------------------------------------- the module
class Survival {
  spots: Spot[] = [];
  phase: Phase = "off";
  private phaseT = 0;
  private built = false;
  private found = 0;
  private hinted = new Set<string>();
  private chatterT = 40;
  private said = new Set<string>();
  private soundT = 12;
  private glimpses = 0;
  private glimpseOn = false;
  private glimpseFor = 0;
  private seenFor = 0;
  private prowler: Enemy | null = null;
  private storm = { spawned: 0, killed: 0, waveT: 0 };
  private lightningT = 8;
  private alarm = false;
  private alarmRing: THREE.Group | null = null;
  private tripped = new WeakSet<Enemy>();
  private fireOutSaid = false;
  private fireWarned = false;
  private rain: THREE.LineSegments | null = null;
  private rainMat: THREE.ShaderMaterial | null = null;
  private rainK = 0;
  private lastInv = "";
  private seat = new THREE.Vector3(CAMP.x - 2.4, 0, CAMP.z + 1.3);
  private stake = new THREE.Vector3(CAMP.x - 2.6, 0, CAMP.z - 2.4);
  private signs: Signs | null = null;
  private addSpot: (id: string, x: number, z: number, label: string, give: Give, prop?: THREE.Object3D, ry?: number, r?: number) => void = () => {};
  /** Seat log (a later night may find it somewhere else). */
  seatLog: THREE.Object3D | null = null;
  /** Where you went down last, and what you were carrying. */
  private dropped: Give | null = null;
  /** Deep woods: the stalkers it has sent after you. */
  private deepHunters = new Set<Enemy>();
  private deepT = 0;
  private deepWarned = false;
  private deepIn = false;
  private needSaid = false;
  /** Story hooks: you've realised you need more (the trading post shows itself);
   *  a new night of the loop has begun. */
  onNeedSupplies: () => void = () => {};
  onLoop: (run: number) => void = () => {};
  /** The deep night's first visitor (a later night may send a different one). */
  onProwler: (e: Enemy) => void = () => {};
  /** What Rhea says as the storm hits (a later night may change it). */
  stormLine: () => import("./script").Line[] = () => S.STORM_START;
  /** Seconds into the current phase. */
  get t() {
    return this.phaseT;
  }
  /** The player is home at dawn: the story takes it from here. */
  onHome: () => void = () => {};

  /** Lay the supplies into the world (once). */
  build(signs: Signs) {
    this.signs = signs;
    if (this.built) return;
    this.built = true;
    const add = (id: string, x: number, z: number, label: string, give: Give, prop?: THREE.Object3D, ry = 0, r = 1.9) => {
      // never inside something solid: step out to where you'd stand
      for (const c of world.colliders) {
        const d = Math.hypot(x - c.x, z - c.z);
        if (d < c.r + 0.4 && d > 1e-3) {
          x = c.x + ((x - c.x) / d) * (c.r + 0.6);
          z = c.z + ((z - c.z) / d) * (c.r + 0.6);
        }
      }
      if (prop) {
        prop.position.set(x, heightAt(x, z), z);
        prop.rotation.y = ry;
        prop.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = !LOW), (m.receiveShadow = true))));
        world.scene.add(prop);
      }
      this.spots.push({ id, x, z, r, label, give: { ...give }, base: { ...give }, prop, taken: false });
    };
    this.addSpot = add;
    // the crash
    add("lug-a", -15.2, 23.8, "Search the luggage", { food: 1, water: 1 });
    add("lug-b", -6.8, 30.5, "Search the luggage", { food: 1 });
    add("kit", -3.2, 29.6, "Search the medical kit", { med: 1 });
    add("can", -23.5, 25.6, "Take the fuel can", { fuel: 2 }, jerrican(), 0.7);
    add("wreck", -26.5, 34.2, "Search the wreckage", { scrap: 2 });
    add("cockpit", -8.4, 31.6, "Search the cockpit", { batteries: 1, scrap: 1, shards: 2 });
    add("stretcher", -20, 33.5, "Strip the stretcher", { scrap: 1 });
    // the ambulance
    add("locker", -1.95, -1.2, "Search the side locker", { med: 1, batteries: 1, shards: 2 }, undefined, 0, 1.6);
    add("tank", 1.95, -2.2, "Siphon the ambulance's tank", { fuel: 1 }, undefined, 0, 1.6);
    // dead wood at the edge of the trees, near enough to the fire to risk it
    add("wood-a", 20, 2, "Gather dead wood", { fuel: 1 }, woodpile(4), 0.4);
    add("wood-b", -9, 14, "Gather dead wood", { fuel: 1 }, woodpile(3), 1.9);
    add("wood-c", 14, 24, "Gather dead wood", { fuel: 1 }, woodpile(4), -0.6);
    // what other people left
    add("pack", MICRO.pack[0] + 0.8, MICRO.pack[1] + 0.6, "Search the pack", { food: 1, batteries: 1, shards: 3 });
    add("medbag", MICRO.cups[0] + 0.8, MICRO.cups[1] - 0.8, "Search the medical bag", { med: 1, water: 1, shards: 2 });
    add("tins", OLD_CAMP.x + 2, OLD_CAMP.z - 3, "Search the supply tins", { food: 2, water: 1, shards: 4 });
    add("firewood", OLD_CAMP.x - 4.5, OLD_CAMP.z + 3.5, "Take the firewood", { fuel: 2 }, woodpile(7), 0.3);
    // the Watch
    add("case", STATION.x - 9, STATION.z + 3, "Open the Meridian case", { med: 1, batteries: 2, shards: 5 }, undefined, 0, 2.0);
    add("generator", STATION.x - 3, STATION.z + 3, "Drain the generator", { fuel: 2 }, undefined, 0, 2.2);
    add("tent", STATION.x - 7, STATION.z - 4, "Search the tent", { food: 1, water: 2, scrap: 1 }, undefined, 0, 3.4);

    // a log to sit on by the fire
    const log = seatLog();
    log.position.set(this.seat.x, heightAt(this.seat.x, this.seat.z), this.seat.z);
    log.rotation.y = 0.9;
    world.scene.add(log);
    this.seatLog = log;
    // and a stake where an alarm line would start
    const st = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.9, 6), mat(0x4a3d32, 1));
    st.position.set(this.stake.x, heightAt(this.stake.x, this.stake.z) + 0.45, this.stake.z);
    st.rotation.z = 0.12;
    world.scene.add(st);

    this.roll();
    voice.onStatic = (k, ms) => {
      sfx.staticBurst(0.35 + k * 0.4, 0.12 + k * 0.2);
      if (k > 0.4) window.setTimeout(() => sfx.staticBurst(0.25, 0.1 + k * 0.15), ms * 0.5);
    };
  }

  /** A new story: empty pockets, every spot full again. */
  reset() {
    for (const k of Object.keys(supplies) as Res[]) supplies[k] = 0;
    for (const s of this.spots) {
      s.taken = false;
      if (s.prop) s.prop.visible = true;
    }
    this.found = 0;
    this.hinted.clear();
    this.said.clear();
    this.phase = "off";
    this.alarm = false;
    if (this.alarmRing) {
      world.scene.remove(this.alarmRing);
      this.alarmRing = null;
    }
    radio.charge = 1;
    radio.warned = false;
    this.dropped = null;
    this.roll();
    this.renderInv(true);
  }

  // -------------------------------------------------------------- what's out there tonight
  /** Every night is a little different: what the fixed places hold varies,
   *  and the minor caches lie somewhere else. The landmarks never move. */
  roll() {
    const vary = (g: Give): Give => {
      const out: Give = {};
      const keys = Object.keys(g) as (keyof Give)[];
      if (Math.random() < 0.15) {
        // picked over: one thing left
        const k = keys[Math.floor(Math.random() * keys.length)];
        out[k] = 1;
        return out;
      }
      for (const k of keys) {
        const n = (g[k] ?? 0) + (k === "shards" ? Math.round((Math.random() - 0.4) * 3) : Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0);
        if (n > 0) out[k] = n;
      }
      if (!Object.keys(out).length) out[keys[0]] = 1;
      return out;
    };
    // take the old minor caches off the ground
    for (const sp of this.spots.filter((q) => q.minor)) if (sp.prop) world.scene.remove(sp.prop);
    this.spots = this.spots.filter((q) => !q.minor);
    for (const sp of this.spots) {
      sp.taken = false;
      if (sp.prop) sp.prop.visible = true;
      sp.give = vary(sp.base);
    }
    // the minor caches: a handful, from places they could plausibly be
    const pool = MINOR_SPOTS.slice().sort(() => Math.random() - 0.5).slice(0, 7);
    pool.forEach(([x, z], i) => {
      const kind = MINOR_KINDS[Math.floor(Math.random() * MINOR_KINDS.length)];
      this.addSpot(`minor-${i}`, x, z, kind.label, vary(kind.give), kind.prop(), Math.random() * 6);
      this.spots[this.spots.length - 1].minor = true;
    });
    // and one rare drop in the deep woods
    const [rx, rz] = DEEP_DROPS[Math.floor(Math.random() * DEEP_DROPS.length)];
    this.addSpot("rare", rx, rz, "Open the Meridian crate", { med: 2, batteries: 2, fuel: 2, shards: 14 }, rareCrate(), Math.random() * 6, 2.2);
    const rare = this.spots[this.spots.length - 1];
    rare.minor = true;
    // what you dropped when you went down is still where you left it
    if (this.dropped && this.lastFall) {
      const [fx, fz] = this.lastFall;
      this.addSpot("mine", fx, fz, "Pick up your pack", this.dropped, myPack(), Math.random() * 6, 2.0);
      this.spots[this.spots.length - 1].minor = true;
    }
  }
  private lastFall: [number, number] | null = null;

  // -------------------------------------------------------------- scavenging
  /** Searching takes a moment, and you're crouched in the open while you do. */
  private searching: { s: Spot; t: number; hp: number } | null = null;
  private search(s: Spot) {
    if (this.searching) return;
    this.searching = { s, t: searchTime(), hp: player.hp };
    player.frozen = true;
    sfx.rummage();
  }

  private take(s: Spot) {
    // what doesn't fit stays where it was
    const left: Give = {};
    let full = "";
    for (const [k, n] of Object.entries(s.give) as [keyof Give, number][]) {
      if (k === "med" || k === "shards") continue;
      const room = carryCap() - supplies[k as Res];
      if (n > room) {
        left[k] = n - Math.max(0, room);
        s.give[k] = Math.max(0, room);
        full = NAMES[k][1].toLowerCase();
      }
    }
    if (full) {
      for (const k of Object.keys(s.give) as (keyof Give)[]) if (!s.give[k]) delete s.give[k];
      if (!Object.keys(s.give).length) {
        s.give = left;
        toast(`You can't carry any more ${full}.`, 2200);
        return;
      }
    }
    s.taken = true;
    if (s.id === "mine") {
      this.dropped = null;
      if (!this.said.has("mine")) {
        this.said.add("mine");
        voice.interrupt();
        void say(S.PACK_FOUND);
      }
    }
    if (s.id === "rare" && !save.flags.rareSeen) {
      save.flags.rareSeen = true;
      void say(S.RARE_FOUND);
    }
    if (s.prop) s.prop.visible = false;
    sfx.rummage();
    const parts: string[] = [];
    const hints: string[] = [];
    for (const [k, n] of Object.entries(s.give) as [Res | "med" | "shards", number][]) {
      if (k === "med") player.medkits += n;
      else if (k === "shards") collectShard(n);
      else supplies[k] += n;
      parts.push(`+${n} ${NAMES[k][n === 1 ? 0 : 1]}`);
      if (!this.hinted.has(k) && s.id !== "mine") {
        this.hinted.add(k);
        hints.push(HINT[k]);
      }
      this.flash(k);
    }
    window.setTimeout(() => sfx.pickup(), 160);
    this.found++;
    toast(parts.join(" · ") + (hints.length ? ` — ${hints.join(" ")}` : "") + (full ? ` · no room for more ${full}` : ""), hints.length ? 4200 : 2200);
    if (full) {
      // the rest is still there
      s.taken = false;
      s.give = left;
      if (s.prop) s.prop.visible = true;
    }
    this.renderInv(true);
  }

  /** Every contextual action this module offers right now. */
  interacts(stage: string): Interact[] {
    if (state.mode !== "story" || !state.exited) return [];
    const list: Interact[] = [];
    for (const s of this.spots) {
      if (s.taken) continue;
      const at = new THREE.Vector3(s.x, 0, s.z);
      list.push({ pos: () => at, r: s.r, label: () => (this.searching?.s === s ? "Searching…" : s.label), when: () => !s.taken, run: () => this.search(s) });
    }
    const fireStory = this.fireStory(stage);
    const cf = world.campfire;
    if (fireStory) {
      list.push({
        pos: () => CAMP,
        r: 2.6,
        label: () => (cf.lit ? `Add fuel to the fire <span class="dim">${supplies.fuel} left</span>` : `Relight the fire <span class="dim">${supplies.fuel} fuel</span>`),
        when: () => supplies.fuel > 0 && (!cf.lit || cf.hp < cf.maxHp - 6),
        run: () => this.feed(),
      });
      list.push({
        pos: () => this.seat,
        r: 1.8,
        label: () => (supplies.food && supplies.water ? "Eat and drink" : supplies.food ? "Eat" : "Drink"),
        when: () => (supplies.food > 0 || supplies.water > 0) && (player.hp < player.maxHp - 4 || player.stamina < 60) && !this.threatNear(10),
        run: () => this.rest(),
      });
      list.push({
        pos: () => this.stake,
        r: 1.7,
        label: `Rig a tin-can alarm <span class="dim">3 scrap</span>`,
        when: () => !this.alarm && supplies.scrap >= 3,
        run: () => this.rigAlarm(),
      });
    }
    return list;
  }

  /** The story has lit the campfire (from the records on, through the night). */
  private fireStory(stage: string) {
    return stage === "records" || stage === "first" || stage === "night1";
  }

  private feed() {
    const cf = world.campfire;
    supplies.fuel--;
    if (!cf.lit) {
      cf.lit = true;
      cf.hp = cf.maxHp * 0.4;
      sfx.ignite();
      this.fireOutSaid = false;
      if (this.phase !== "off") this.objective();
    } else {
      cf.hp = Math.min(cf.maxHp, cf.hp + cf.maxHp * (up("keeper") ? 0.45 : 0.35));
      sfx.crackle(0.5);
      window.setTimeout(() => sfx.crackle(0.35), 120);
    }
    this.fireWarned = false;
    fx.sparks(CAMP.clone().setY(CAMP.y + 0.6), 14, 3);
    this.flash("fuel");
    this.renderInv(true);
  }

  private rest() {
    const msg: string[] = [];
    if (supplies.food > 0) {
      supplies.food--;
      player.hp = Math.min(player.maxHp, player.hp + 22);
      msg.push("You eat");
      this.flash("food");
    }
    if (supplies.water > 0) {
      supplies.water--;
      player.hp = Math.min(player.maxHp, player.hp + 12);
      player.stamina = player.maxStamina;
      msg.push(msg.length ? "drink" : "You drink");
      this.flash("water");
    }
    sfx.heal();
    toast(`${msg.join(" and ")}.`, 1800);
    this.renderInv(true);
  }

  private rigAlarm() {
    supplies.scrap -= 3;
    this.alarm = true;
    sfx.cans();
    this.flash("scrap");
    // posts round the camp, a line between them, tins hung on it
    const g = new THREE.Group();
    const R = 11;
    const pts: THREE.Vector3[] = [];
    const post = mat(0x4a3d32, 1);
    const tin = mat(0x8a8a84, 0.45, 0.7);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const x = CAMP.x + Math.cos(a) * R;
      const z = CAMP.z + Math.sin(a) * R;
      const y = heightAt(x, z);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.035, 0.75, 5), post);
      p.position.set(x, y + 0.37, z);
      g.add(p);
      pts.push(new THREE.Vector3(x, y + 0.6, z));
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 7), tin);
      const x2 = CAMP.x + Math.cos(a + 0.26) * R;
      const z2 = CAMP.z + Math.sin(a + 0.26) * R;
      c.position.set(x2, heightAt(x2, z2) + 0.45, z2);
      g.add(c);
    }
    pts.push(pts[0].clone());
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x8a8270, transparent: true, opacity: 0.6 })));
    world.scene.add(g);
    this.alarmRing = g;
    toast("The line runs all the way round. Anything that crosses it, you'll hear.", 3200);
    void say(S.ALARM_RIGGED);
    this.renderInv(true);
  }

  // -------------------------------------------------------------- inventory
  private flash(k: Res | "med" | "shards") {
    const el = k === "shards" ? document.getElementById("shards")?.parentElement : document.querySelector<HTMLElement>(`#supplies [data-r="${k}"]`);
    if (!el) return;
    el.classList.remove("got");
    void el.offsetWidth;
    el.classList.add("got");
  }

  renderInv(force = false) {
    const box = $("supplies");
    const any = player.medkits > 2 || Object.values(supplies).some((n) => n > 0);
    const show = state.mode === "story" && (this.found > 0 || this.phase !== "off" || any);
    box.hidden = !show;
    hud.root.classList.toggle("sup", show);
    const s = `${player.medkits}|${supplies.food}|${supplies.water}|${supplies.fuel}|${supplies.scrap}|${supplies.batteries}`;
    if (!force && s === this.lastInv) return;
    this.lastInv = s;
    const v: Record<string, number> = { med: player.medkits, ...supplies };
    for (const el of box.querySelectorAll<HTMLElement>("[data-r]")) {
      const n = v[el.dataset.r!] ?? 0;
      el.querySelector("b")!.textContent = String(n);
      el.classList.toggle("none", n === 0);
    }
  }

  // -------------------------------------------------------------- the night
  /** The first Hollow is down: the night starts (story.ts). */
  begin() {
    this.phase = "early";
    this.phaseT = 0;
    this.chatterT = 45;
    this.soundT = 14;
    this.glimpses = 0;
    this.prowler = null;
    this.storm = { spawned: 0, killed: 0, waveT: 0 };
    this.fireOutSaid = this.fireWarned = false;
    radio.charge = 1;
    radio.warned = false;
    const cf = world.campfire;
    cf.lit = true;
    cf.hp = Math.max(cf.hp, cf.maxHp * 0.85);
    hud.fire.hidden = false;
    enemies.maxAttackers = 1;
    enemies.aggression = 1;
    enemies.retreat = false;
    world.setMood("night");
    this.objective();
    void say(S.NIGHT1_START);
    this.renderInv(true);
  }

  /** Back to the story's own rules (the reveal is over, Chapter II begins). */
  end() {
    this.phase = "off";
    voice.static = 0;
    sfx.rain(0, 2);
    this.rainK = 0;
    if (this.rain) this.rain.visible = false;
    hud.fire.hidden = true;
    enemies.retreat = false;
    enemies.fear = null;
    enemies.maxAttackers = Infinity;
    enemies.aggression = 1;
    world.campfire.hp = world.campfire.maxHp;
    world.campfire.lit = true;
  }

  private objective() {
    const kick: Record<Phase, string> = { off: "", early: "EARLY NIGHT", deep: "DEEP NIGHT", storm: "THE STORM", dawn: "DAWN", home: "DAWN" };
    const text: Record<Phase, string> = {
      off: "",
      early: "Keep the fire fed. Find what you can.",
      deep: "Stay near the light.",
      storm: "Hold on until it passes.",
      dawn: "Go back to the fire.",
      home: "",
    };
    if (!world.campfire.lit && this.phase !== "dawn") setObjective(`I · THE FALL · ${kick[this.phase]}`, "The fire's out. Find something that burns.");
    else setObjective(`I · THE FALL · ${kick[this.phase]}`, text[this.phase]);
  }

  private to(p: Phase) {
    this.phase = p;
    this.phaseT = 0;
    if (p === "deep") {
      world.setMood("deep");
      sfx.ambienceTo(0.06, 8);
      enemies.aggression = 0.7;
      window.setTimeout(() => this.phase === "deep" && !voice.busy && void say(S.DEEP_NIGHT), 4000);
    } else if (p === "storm") {
      world.setMood("storm");
      sfx.ambienceTo(0.2, 4);
      sfx.rain(LOW ? 0.22 : 0.3, 6);
      sfx.thunder(0.3);
      enemies.aggression = 1.5;
      this.lightningT = 6;
      this.ensureRain();
      voice.interrupt();
      void say(this.stormLine()).then(() => {
        window.setTimeout(() => {
          if (this.phase === "storm" && !voice.busy) void say(S.STORM_LOST);
        }, 2500);
      });
      this.lose(this.prowler);
    } else if (p === "dawn") {
      world.setMood("dawn");
      sfx.rain(0, 8);
      sfx.ambienceTo(0.1, 6);
      enemies.retreat = true;
      enemies.aggression = 0;
      void say(S.DAWN1);
    }
    this.objective();
  }

  /** A Hollow gives up and walks off (deep night's prowler, or anyone at dawn). */
  private lose(e: Enemy | null) {
    if (!e || !e.alive) return;
    // retreat is per-manager; a single one is sent off by keeping it backing away
    e.committed = false;
    if (e === this.prowler) this.prowler = null;
    this.leaving.add(e);
  }
  private leaving = new Set<Enemy>();

  private spawnStalker(minR: number, maxR: number) {
    // from the dark behind you if it can: they come where you aren't looking
    const near = Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) < 16;
    const c = near ? CAMP : player.pos;
    for (let i = 0; i < 12; i++) {
      const behind = player.yaw + Math.PI + (Math.random() - 0.5) * 2.4;
      const r = minR + Math.random() * (maxR - minR);
      const x = c.x + Math.sin(behind) * r;
      const z = c.z + Math.cos(behind) * r;
      if (world.colliders.some((k) => Math.hypot(k.x - x, k.z - z) < k.r + 1)) continue;
      const e = enemies.spawn("hollow", new THREE.Vector3(x, 0, z), { rise: false, speedMul: 0.92 });
      e.stalk = true;
      // the night's later ones come with less watching first
      e.mind = this.phase === "storm" ? "stalk" : "observe";
      e.mindT = 4 + Math.random() * 4;
      e.windup = 0.7;
      e.courage = -0.4 - Math.random() * 0.4;
      return e;
    }
    return null;
  }

  /** Something in the trees: there, then not. */
  private glimpse() {
    const sg = this.signs;
    if (!sg) return;
    const a = player.yaw + (Math.random() - 0.5) * 0.9;
    const r = 22 + Math.random() * 6;
    const p = new THREE.Vector3(player.pos.x + Math.sin(a) * r, 0, player.pos.z + Math.cos(a) * r);
    sg.placeShape(p, player.pos);
    sg.showShape(true);
    this.glimpseOn = true;
    this.glimpseFor = 0;
    this.seenFor = 0;
    sfx.twig(0.3);
  }

  private threatNear(r: number) {
    return enemies.list.some((e) => e.alive && e.kind !== "thing" && Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) < r);
  }

  // -------------------------------------------------------------- dying, and the night again
  /** You went down. What you carried is temporary: half of it stays where you
   *  fell (with some of your shards), the rest is gone. Knowledge isn't. */
  onPlayerDeath() {
    const drop: Give = {};
    for (const k of Object.keys(supplies) as Res[]) {
      const half = Math.ceil(supplies[k] / 2);
      if (half > 0) drop[k] = half;
      supplies[k] = 0;
    }
    const sh = Math.min(15, Math.floor(save.bank * 0.25));
    if (sh > 0) {
      drop.shards = sh;
      save.bank -= sh;
    }
    const far = Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) > 6;
    for (const sp of this.spots.filter((q) => q.id === "mine")) if (sp.prop) world.scene.remove(sp.prop);
    this.spots = this.spots.filter((q) => q.id !== "mine");
    if (Object.keys(drop).length && far) {
      this.dropped = drop;
      this.lastFall = [player.pos.x, player.pos.z];
      this.addSpot("mine", player.pos.x, player.pos.z, "Pick up your pack", drop, myPack(), Math.random() * 6, 2.0);
      this.spots[this.spots.length - 1].minor = true;
    } else this.dropped = null;
    this.deepHunters.clear();
    this.renderInv(true);
  }

  /** The night begins again (you died in it). The world is a little different. */
  loopNight() {
    const run = Number(save.flags.run ?? 0) + 1;
    save.flags.run = String(run);
    this.phase = "early";
    this.phaseT = 0;
    this.chatterT = 45;
    this.soundT = 14;
    this.glimpses = 0;
    this.glimpseOn = false;
    this.prowler = null;
    this.leaving.clear();
    this.storm = { spawned: 0, killed: 0, waveT: 0 };
    this.fireOutSaid = this.fireWarned = false;
    for (const k of ["far", "fire", "found", "prowler"]) this.said.delete(k);
    radio.charge = 1;
    radio.warned = false;
    const cf = world.campfire;
    cf.lit = true; // already burning when you wake. You didn't light it.
    cf.hp = cf.maxHp;
    world.setMood("night");
    world.snapMood();
    enemies.maxAttackers = 1;
    enemies.aggression = 1;
    enemies.retreat = false;
    this.roll();
    this.objective();
    this.renderInv(true);
    this.onLoop(run);
  }

  /** How many times the night has begun again (persistent). */
  get run() {
    return Number(save.flags.run ?? 0);
  }

  private deepUpdate(dt: number, stage: string) {
    const d = Math.hypot(player.pos.x - DEEP.x, player.pos.z - DEEP.z);
    const inDeep = d < DEEP.r;
    world.fogExtra += ((inDeep ? 1.4 : 0) - world.fogExtra) * Math.min(1, dt * 0.6);
    if (inDeep && !this.deepIn && !save.flags.deepWarned && !voice.busy) {
      save.flags.deepWarned = true;
      void say(S.DEEP_WARN);
    }
    this.deepIn = inDeep;
    const quiet = ["intro", "wake", "first", "ambush", "ending", "choir", "finale", "done"].includes(stage);
    for (const e of this.deepHunters) if (!e.alive) this.deepHunters.delete(e);
    if (inDeep && !quiet && !cine.active) {
      this.deepT -= dt;
      if (this.deepT <= 0 && this.deepHunters.size < 2) {
        this.deepT = this.phase === "deep" || this.phase === "storm" ? 14 : 24;
        const e = this.spawnStalker(18, 24);
        if (e) {
          e.bold = 1.4;
          e.mind = "follow";
          this.deepHunters.add(e);
        }
      }
    } else if (d > DEEP.r + 14 && this.deepHunters.size) {
      // they don't follow you out of their woods
      for (const e of this.deepHunters) this.leaving.add(e);
      this.deepHunters.clear();
    }
    if (!inDeep) this.deepT = Math.min(this.deepT, 4);
  }

  onEnemyDeath(e: Enemy) {
    if (this.phase === "storm" && e.stalk) this.storm.killed++;
    if (e === this.prowler) this.prowler = null;
  }

  /** Respawned at the fire mid-night: whoever was out there comes again. */
  onRespawn() {
    if (this.phase === "storm") this.storm.spawned = this.storm.killed;
    this.prowler = null;
    this.leaving.clear();
  }

  /** Where the story marker should point during the night (or null). */
  target(): THREE.Vector3 | null {
    const far = Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) > 14;
    if ((this.phase === "storm" || this.phase === "dawn") && far) return CAMP;
    if (!world.campfire.lit && far && supplies.fuel > 0) return CAMP;
    return null;
  }

  // -------------------------------------------------------------- per frame
  /** The camp's radio: Rhea comes through clearer near it (camp.ts sets this). */
  campRadio = () => false;

  /** A full charge (the camp's radio set tops yours up). */
  chargeRadio() {
    radio.charge = 1;
    radio.warned = false;
  }

  update(dt: number, stage: string) {
    if (state.mode !== "story") return;
    const cf = world.campfire;
    const fireStory = this.fireStory(stage);
    const level = cf.lit ? cf.hp / cf.maxHp : 0;

    // the light they won't walk into (and the fire bar, while it matters)
    const pit = save.flags["camp:pit"] ? 1 : 0; // stones stacked round it: more light, further out
    enemies.fear = fireStory && cf.lit ? { pos: CAMP, r: 5 + 7 * level + pit * 2, k: level } : null;
    if (this.phase !== "off") hud.fireFill.style.width = `${level * 100}%`;

    // healing: slow anywhere quiet, faster by the fire
    if (state.exited && !state.dead && player.hp > 0 && player.hp < player.maxHp && !this.threatNear(10)) {
      const near = fireStory && cf.lit && Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) < 7;
      player.hp = Math.min(player.maxHp, player.hp + (near ? 0.6 + 1.4 * level : 0.25) * dt);
    }

    // the alarm line
    if (this.alarm) {
      for (const e of enemies.list) {
        if (!e.alive || this.tripped.has(e)) continue;
        if (Math.hypot(e.pos.x - CAMP.x, e.pos.z - CAMP.z) < 10.6) {
          this.tripped.add(e);
          sfx.cans();
          e.flee = Math.max(e.flee, 0.9); // startled
          e.courage -= 0.3;
          e.committed = false;
        }
      }
    }

    // anyone sent away walks off and is gone
    for (const e of this.leaving) {
      if (!e.alive) {
        this.leaving.delete(e);
        continue;
      }
      e.flee = 1; // backing away from whoever's nearest
      if (Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z) > 32) {
        enemies.remove(e);
        this.leaving.delete(e);
      }
    }

    this.renderInv();
    if (this.searching) {
      const sr = this.searching;
      sr.t -= dt;
      if (player.hp < sr.hp - 0.5 || state.dead) {
        // hit while you were rummaging: you let go of it
        this.searching = null;
        player.frozen = false;
      } else if (sr.t <= 0) {
        this.searching = null;
        player.frozen = false;
        if (!sr.s.taken) this.take(sr.s);
      }
    }
    if (state.exited) this.deepUpdate(dt, stage);
    if (this.phase === "off" || cine.active) return;
    this.phaseT += dt;

    // not enough out here: somebody else's lantern on the path (the trading post)
    if (this.phase === "early" && !this.needSaid && this.phaseT > 40 && !voice.busy && !save.flags.tradeRevealed) {
      this.needSaid = true;
      void say(S.SUPPLY_NEED).then(() => this.onNeedSupplies());
    }

    // the fire burns down: slowly, then faster in the wind and rain
    const burn = { off: 0, early: 0.36, deep: 0.42, storm: 0.62, dawn: 0.15, home: 0 }[this.phase];
    if (cf.lit) {
      cf.hp = Math.max(0, cf.hp - burn * (up("keeper") ? 0.85 : 1) * (save.flags["camp:pit"] ? 0.8 : 1) * dt);
      if (cf.hp / cf.maxHp < 0.25 && !this.fireWarned && !voice.busy) {
        this.fireWarned = true;
        void say(S.FIRE_LOW);
      }
      if (cf.hp <= 0) {
        cf.lit = false;
        sfx.crackle(0.6);
        if (!this.fireOutSaid) {
          this.fireOutSaid = true;
          voice.interrupt();
          void say(S.FIRE_OUT);
        }
        this.objective();
      }
    }

    // the radio runs down; fresh batteries go in when it's nearly gone
    radio.charge = this.campRadio() ? Math.min(1, radio.charge + dt / 30) : Math.max(0, radio.charge - dt / 240);
    if (radio.charge < 0.22 && supplies.batteries > 0) {
      supplies.batteries--;
      radio.charge = 1;
      radio.warned = false;
      sfx.beep();
      toast("Fresh batteries in the radio.", 2000);
      this.flash("batteries");
    } else if (radio.charge < 0.22 && !radio.warned && !voice.busy && this.phase !== "storm") {
      radio.warned = true;
      void say(S.RADIO_BATTERY);
    }
    const phaseRel = { off: 1, early: 1, deep: 0.8, storm: 0.35, dawn: 0.9, home: 1 }[this.phase];
    voice.static = Math.max(0, Math.min(0.9, 1 - phaseRel * (radio.charge > 0 ? 0.55 + 0.45 * Math.min(1, radio.charge * 2) : 0.3))) * (this.campRadio() ? 0.4 : 1);

    // a deep-night glimpse running its course
    if (this.glimpseOn && this.signs) {
      this.glimpseFor += dt;
      this.seenFor += this.signs.shapeSeen(camera) ? dt : 0;
      if (this.seenFor > 0.7 || this.glimpseFor > 5) {
        this.signs.showShape(false);
        this.glimpseOn = false;
        if (this.glimpses === 1 && !voice.busy) void say(S.GLIMPSE);
        else sfx.steps(3, 0.12);
      }
    }

    // sounds out in the dark, closer as the night goes on
    this.soundT -= dt;
    if (this.soundT <= 0 && this.phase !== "dawn") {
      const near = { early: 0.35, deep: 0.6, storm: 0.8 }[this.phase as "early" | "deep" | "storm"] ?? 0.4;
      this.soundT = (this.phase === "early" ? 22 : 11) + Math.random() * 10;
      const r = Math.random();
      if (r < 0.4) sfx.twig(0.15 + near * 0.35);
      else if (r < 0.7) sfx.steps(3 + Math.floor(Math.random() * 3), 0.06 + near * 0.12);
      else if (this.phase !== "early") sfx.murmur(0.03 + near * 0.06);
      else sfx.twig(0.2);
    }

    // Rhea checks in, now and then
    this.chatterT -= dt;
    if (this.chatterT <= 0 && !voice.busy && (this.phase === "early" || this.phase === "deep")) {
      this.chatterT = 50 + Math.random() * 25;
      const far = Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) > 45;
      const beat = far && !this.said.has("far") ? "far" : cf.lit && level < 0.45 && !this.said.has("fire") ? "fire" : this.found >= 3 && !this.said.has("found") ? "found" : null;
      if (beat) {
        this.said.add(beat);
        void say(beat === "far" ? S.RADIO_FAR : beat === "fire" ? S.RADIO_FIRE : S.RADIO_FOUND);
      }
    }

    // ---- the phases
    if (this.phase === "early") {
      if (this.phaseT > 150) this.to("deep");
    } else if (this.phase === "deep") {
      if ((this.phaseT > 22 && this.glimpses === 0) || (this.phaseT > 70 && this.glimpses === 1)) {
        if (!this.glimpseOn) {
          this.glimpses++;
          this.glimpse();
        }
      }
      if (this.phaseT > 40 && !this.prowler && !this.said.has("prowler")) {
        // one of them comes to look; it circles, and maybe it tries you
        this.said.add("prowler");
        this.prowler = this.spawnStalker(24, 30);
        if (this.prowler) this.onProwler(this.prowler);
      }
      if (this.phaseT > 120) this.to("storm");
    } else if (this.phase === "storm") {
      const st = this.storm;
      st.waveT -= dt;
      const alive = enemies.list.filter((e) => e.alive && e.stalk && !this.leaving.has(e)).length;
      // two come; when they're down (or it's been long enough), two more
      if (st.spawned < 4 && alive < 2 && (st.spawned === 0 ? this.phaseT > 9 : st.waveT <= 0 || alive === 0)) {
        const n = Math.min(2 - alive, 4 - st.spawned);
        for (let i = 0; i < n; i++) if (this.spawnStalker(22, 28)) st.spawned++;
        st.waveT = 40;
        if (st.spawned >= 3) enemies.maxAttackers = 2;
      }
      // lightning
      this.lightningT -= dt;
      if (this.lightningT <= 0) {
        this.lightningT = 7 + Math.random() * 9;
        world.hemi.intensity += LOW ? 2 : 3.2;
        window.setTimeout(() => sfx.thunder(0.3 + Math.random() * 0.5), 300 + Math.random() * 1400);
      }
      if (st.spawned >= 4 && st.killed >= 4 && this.phaseT > 60) this.to("dawn");
      else if (this.phaseT > 200 && alive === 0) this.to("dawn"); // never stuck in the storm
    } else if (this.phase === "dawn") {
      if (this.phaseT > 4 && !voice.busy && Math.hypot(player.pos.x - CAMP.x, player.pos.z - CAMP.z) < 5.5) {
        this.phase = "home";
        this.onHome();
      }
    }
  }

  // -------------------------------------------------------------- rain
  private ensureRain() {
    if (this.rain) {
      this.rain.visible = true;
      return;
    }
    const N = LOW ? 900 : 2200;
    const pos = new Float32Array(N * 6);
    const tip = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) {
      const x = Math.random();
      const y = Math.random();
      const z = Math.random();
      pos.set([x, y, z, x, y, z], i * 6);
      tip[i * 2 + 1] = 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("tip", new THREE.BufferAttribute(tip, 1));
    this.rainMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      uniforms: { uTime: { value: 0 }, uCam: { value: new THREE.Vector3() }, uAlpha: { value: 0 } },
      vertexShader: /* glsl */ `
        uniform float uTime; uniform vec3 uCam; attribute float tip; varying float vA;
        void main() {
          const float W = 34.0; const float H = 20.0;
          vec3 p = position * vec3(W, H, W);
          float x = uCam.x + mod(p.x - uCam.x + W * 0.5, W) - W * 0.5;
          float z = uCam.z + mod(p.z - uCam.z + W * 0.5, W) - W * 0.5;
          float y = uCam.y - 6.0 + mod(p.y - uTime * 15.0, H);
          y += tip * 0.55; x += tip * 0.14;
          vA = 1.0 - tip * 0.75;
          gl_Position = projectionMatrix * viewMatrix * vec4(x, y, z, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        uniform float uAlpha; varying float vA;
        void main() { gl_FragColor = vec4(0.7, 0.76, 0.86, uAlpha * vA * 0.42); }`,
    });
    this.rain = new THREE.LineSegments(g, this.rainMat);
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 5;
    world.scene.add(this.rain);
  }

  /** Every frame, cinematics included (main.ts): the rain. */
  visuals(dt: number) {
    if (!this.rain || !this.rainMat) return;
    const want = this.phase === "storm" ? 1 : 0;
    this.rainK += (want - this.rainK) * Math.min(1, dt * (want ? 0.35 : 0.9));
    this.rain.visible = this.rainK > 0.01;
    if (!this.rain.visible) return;
    this.rainMat.uniforms.uTime.value += dt;
    this.rainMat.uniforms.uCam.value.copy(camera.position);
    this.rainMat.uniforms.uAlpha.value = this.rainK;
  }

  /** Debug: jump the night along (tests). */
  skip(to: Phase) {
    if (this.phase === "off") this.begin();
    this.to(to);
  }
}

export const survival = new Survival();
void pick;
