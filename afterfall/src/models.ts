// Characters built from primitives with pivoted limbs so they can be animated
// procedurally (no rigged model files). Smooth-shaded, human proportions,
// with a wardrobe for the player's survivor.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import barkUrl from "ez-tree-assets/bark/oak_color_1k.jpg";
import { boneMask, Person, peopleOk, type Outfit } from "./people";

export interface Humanoid {
  root: THREE.Group;
  body: THREE.Group;
  head: THREE.Group;
  armL: THREE.Group;
  armR: THREE.Group;
  legL: THREE.Group;
  legR: THREE.Group;
  weapon: THREE.Group;
  eyes: THREE.MeshStandardMaterial;
  mats: THREE.MeshStandardMaterial[];
}

export interface HumanoidOpts {
  cloth: number;
  skin: number;
  pants: number;
  mask?: number;
  eye?: number;
  hair?: number;
  bones?: boolean;
}

// ------------------------------------------------------------------ wardrobe
export interface Look {
  build: number;
  skin: number;
  hair: number;
  hairColor: number;
  top: number;
  topColor: number;
  pants: number;
  extra: number;
  /** Which recorded voice your lines use (0 deeper, 1 lighter). */
  voice?: number;
  /** 0 masculine, 1 feminine */
  body?: number;
}

export interface Swatch {
  name: string;
  c: number;
}

export const LOOK = {
  body: ["Masculine", "Feminine"],
  build: ["Lean", "Standard", "Heavy"],
  skin: [
    { name: "Porcelain", c: 0xf0cfb4 },
    { name: "Fair", c: 0xdfb090 },
    { name: "Olive", c: 0xc08c6a },
    { name: "Tan", c: 0xa06b4b },
    { name: "Brown", c: 0x784a31 },
    { name: "Deep", c: 0x4c2e21 },
  ] as Swatch[],
  hair: ["Shaved", "Buzz", "Short", "Swept", "Tied back", "Long"],
  hairColor: [
    { name: "Black", c: 0x16120f },
    { name: "Dark brown", c: 0x34221a },
    { name: "Brown", c: 0x5e3c24 },
    { name: "Auburn", c: 0x74331f },
    { name: "Blonde", c: 0xb59a63 },
    { name: "Grey", c: 0x8c8984 },
  ] as Swatch[],
  top: ["Medevac hoodie", "Field jacket", "Scrubs", "Bomber", "Patient gown"],
  topColor: [
    { name: "Olive", c: 0x4f5641 },
    { name: "Navy", c: 0x22304a },
    { name: "Charcoal", c: 0x323438 },
    { name: "Rust", c: 0x7c3f27 },
    { name: "Sand", c: 0xa08f70 },
    { name: "Teal", c: 0x2e5b5d },
    { name: "Medevac red", c: 0x8f2a24 },
  ] as Swatch[],
  pants: [
    { name: "Charcoal", c: 0x2c2d31 },
    { name: "Denim", c: 0x2f4058 },
    { name: "Khaki", c: 0x6f6852 },
    { name: "Black", c: 0x17171a },
    { name: "Olive", c: 0x41463a },
  ] as Swatch[],
  extra: ["None", "Beanie", "Scarf", "Backpack", "Glasses", "Bandana", "Headset"],
  voice: ["Deeper", "Lighter"],
};

export const DEFAULT_LOOK: Look = { build: 1, skin: 2, hair: 2, hairColor: 1, top: 0, topColor: 0, pants: 0, extra: 0 };

export function randomLook(): Look {
  const r = (n: number) => Math.floor(Math.random() * n);
  return {
    build: r(3),
    skin: r(LOOK.skin.length),
    hair: r(LOOK.hair.length),
    hairColor: r(LOOK.hairColor.length),
    top: r(LOOK.top.length),
    topColor: r(LOOK.topColor.length),
    pants: r(LOOK.pants.length),
    extra: r(LOOK.extra.length),
    ...((b) => ({ body: b, voice: b }))(r(2)),
  };
}

// ------------------------------------------------------------------ helpers
const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...extra });

const darker = (c: number, k = 0.7) => new THREE.Color(c).multiplyScalar(k).getHex();

function add(parent: THREE.Object3D, geo: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

/** Spherical cap, `t` = how far down from the crown it reaches (0..1 of PI). */
const cap = (r: number, t: number) => new THREE.SphereGeometry(r, 22, 12, 0, Math.PI * 2, 0, Math.PI * t);

interface BodySpec {
  skin: number;
  top: number;
  pants: number;
  w: number; // shoulder/torso width factor
  limb: number; // limb radius
  eye: number;
  armsSkin?: boolean;
}

interface Core extends Humanoid {
  skull: THREE.Group; // scaled like the skull, for hair & headwear
  skinMat: THREE.MeshStandardMaterial;
  topMat: THREE.MeshStandardMaterial;
}

function core(s: BodySpec): Core {
  const skin = mat(s.skin, { roughness: 0.65 });
  const top = mat(s.top);
  const pants = mat(s.pants, { roughness: 0.9 });
  const shoe = mat(0x1d1b19, { roughness: 0.55 });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, emissive: s.eye, emissiveIntensity: 2, roughness: 0.3 });
  const mats = [skin, top, pants];

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.95;
  root.add(body);

  // hips + torso
  const hips = add(body, new THREE.CapsuleGeometry(0.1, 0.14 * s.w, 4, 10), pants, 0, 0.04, 0);
  hips.rotation.z = Math.PI / 2;
  hips.scale.z = 1.05;
  const torso = add(body, new THREE.CapsuleGeometry(0.16, 0.3, 6, 14), top, 0, 0.33, 0);
  torso.scale.set(1.3 * s.w, 1, 0.78 * (s.w > 1.05 ? 1.12 : 1));
  add(body, new THREE.CylinderGeometry(0.05, 0.056, 0.12, 12), skin, 0, 0.68, 0);

  // head
  const head = new THREE.Group();
  head.position.y = 0.8;
  body.add(head);
  const skull = new THREE.Group();
  skull.scale.set(0.92, 1.08, 1);
  head.add(skull);
  add(skull, new THREE.SphereGeometry(0.115, 24, 18), skin);
  add(head, new THREE.BoxGeometry(0.026, 0.04, 0.03), skin, 0, -0.012, 0.112); // nose
  for (const x of [-1, 1]) {
    const ear = add(head, new THREE.SphereGeometry(0.026, 10, 8), skin, x * 0.104, 0, -0.005);
    ear.scale.set(0.5, 1, 0.8);
    add(head, new THREE.SphereGeometry(0.0135, 10, 8), eyes, x * 0.04, 0.018, 0.098);
  }

  // arms (pivot at the shoulder)
  const armX = 0.2 * s.w + 0.05;
  const arm = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * armX, 0.57, 0);
    add(pivot, new THREE.CapsuleGeometry(s.limb, 0.48, 4, 10), s.armsSkin ? skin : top, 0, -0.3, 0);
    if (s.armsSkin) add(pivot, new THREE.CapsuleGeometry(s.limb + 0.014, 0.1, 4, 10), top, 0, -0.07, 0);
    add(pivot, new THREE.SphereGeometry(s.limb * 0.95, 12, 10), skin, 0, -0.62, 0.005);
    body.add(pivot);
    return pivot;
  };
  const armL = arm(-1);
  const armR = arm(1);

  // legs (pivot at the hip)
  const leg = (side: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.095 * Math.max(1, s.w), 0.02, 0);
    add(pivot, new THREE.CapsuleGeometry(s.limb * 1.32, 0.74, 4, 10), pants, 0, -0.44, 0);
    const foot = add(pivot, new THREE.BoxGeometry(0.11, 0.08, 0.25), shoe, 0, -0.9, 0.04);
    foot.geometry.translate(0, 0, 0);
    body.add(pivot);
    return pivot;
  };
  const legL = leg(-1);
  const legR = leg(1);

  const weapon = new THREE.Group();
  weapon.position.set(0, -0.64, 0.03);
  armR.add(weapon);

  return { root, body, head, armL, armR, legL, legR, weapon, eyes, mats, skull, skinMat: skin, topMat: top };
}

function finish(h: Humanoid) {
  h.root.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.isMesh) m.castShadow = true;
  });
  return h;
}

// ------------------------------------------------------------------ NPCs
export function buildHumanoid(o: HumanoidOpts): Humanoid {
  if (peopleOk()) {
    if (o.mask !== undefined) return buildHollowPerson(o);
    // anyone else (the echoes): a plain survivor in the given colours
    return new Person({ sex: Math.random() < 0.5 ? "m" : "f", skin: 2, tint: o.skin, hair: o.hair !== undefined ? "simpleparted" : "", hairColor: o.hair ?? 0, top: o.cloth, pants: o.pants });
  }
  const h = core({ skin: o.skin, top: o.cloth, pants: o.pants, w: 1, limb: 0.058, eye: o.eye ?? 0x111111 });
  if (o.hair !== undefined) {
    const hm = mat(o.hair, { roughness: 0.95 });
    h.mats.push(hm);
    const c = add(h.skull, cap(0.122, 0.5), hm);
    c.rotation.x = -0.3;
  }
  if (o.mask !== undefined) {
    // carved bone mask over the face, eye holes glowing through
    const mm = mat(o.mask, { roughness: 0.6 });
    h.mats.push(mm);
    const mask = add(h.head, new THREE.SphereGeometry(0.128, 20, 14, 0, Math.PI), mm, 0, 0, 0.012);
    mask.scale.set(0.98, 1.14, 0.72);
    const paint = add(h.head, new THREE.BoxGeometry(0.018, 0.2, 0.01), mat(0x6e1a1c), 0.045, -0.01, 0.103);
    paint.rotation.z = 0.35;
    for (const e of h.head.children) if ((e as THREE.Mesh).material === h.eyes) e.position.z = 0.104;
  }
  if (o.bones) {
    const bm = mat(0xd8d0bc, { roughness: 0.7 });
    h.mats.push(bm);
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.35;
      const spike = add(h.head, new THREE.ConeGeometry(0.03, 0.26, 8), bm, Math.sin(a) * 0.12, 0.2, Math.cos(a) * 0.04 - 0.05);
      spike.rotation.z = -a * 0.6;
    }
    for (const x of [-1, 1]) {
      const p = add(h.body, new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), bm, x * 0.26, 0.6, 0);
      p.scale.set(1, 0.6, 0.9);
    }
  }
  return finish(h);
}

// ------------------------------------------------------------------ the survivor
export function buildPlayerModel(look: Look): Humanoid {
  if (peopleOk()) return buildPlayerPerson(look);
  const w = [0.9, 1, 1.18][look.build] ?? 1;
  const limb = [0.052, 0.058, 0.07][look.build] ?? 0.058;
  const skinC = LOOK.skin[look.skin]?.c ?? LOOK.skin[2].c;
  const topC = look.top === 4 ? 0x9aa7ae : (LOOK.topColor[look.topColor]?.c ?? LOOK.topColor[0].c);
  const pantsC = LOOK.pants[look.pants]?.c ?? LOOK.pants[0].c;
  const hairC = LOOK.hairColor[look.hairColor]?.c ?? LOOK.hairColor[0].c;
  const armsSkin = look.top === 2 || look.top === 4;
  const h = core({ skin: skinC, top: topC, pants: pantsC, w, limb, eye: 0x111111, armsSkin });
  const B = h.body;
  const trim = mat(darker(topC, 0.6));
  const dark = mat(0x1c1c1e, { roughness: 0.7 });

  // clothing details
  switch (look.top) {
    case 0: {
      // hoodie: hood bunched behind the neck, pouch pocket, drawstrings
      const hood = add(B, new THREE.CapsuleGeometry(0.075, 0.17 * w, 4, 10), h.topMat, 0, 0.63, -0.085);
      hood.rotation.z = Math.PI / 2;
      add(B, new THREE.BoxGeometry(0.24 * w, 0.12, 0.02), trim, 0, 0.17, 0.125 * (w > 1.05 ? 1.1 : 1));
      for (const x of [-1, 1]) add(B, new THREE.CylinderGeometry(0.005, 0.005, 0.15, 6), mat(0xd8d4cc), x * 0.03, 0.53, 0.125);
      break;
    }
    case 1: {
      // field jacket: collar, chest pockets, zip
      add(B, new THREE.CylinderGeometry(0.085, 0.1, 0.07, 16, 1, true), trim, 0, 0.66, 0);
      for (const x of [-1, 1]) add(B, new THREE.BoxGeometry(0.09, 0.08, 0.015), trim, x * 0.085, 0.43, 0.128);
      add(B, new THREE.BoxGeometry(0.008, 0.5, 0.006), dark, 0, 0.33, 0.13);
      break;
    }
    case 2: {
      // scrubs: V-neck and a breast pocket
      const v = add(B, new THREE.BoxGeometry(0.075, 0.075, 0.01), h.skinMat, 0, 0.6, 0.118);
      v.rotation.z = Math.PI / 4;
      add(B, new THREE.BoxGeometry(0.08, 0.07, 0.012), trim, -0.08, 0.44, 0.126);
      break;
    }
    case 3: {
      // bomber: ribbed collar, waistband, cuffs, zip
      add(B, new THREE.CylinderGeometry(0.08, 0.095, 0.05, 16), dark, 0, 0.665, 0);
      const band = add(B, new THREE.TorusGeometry(0.17, 0.025, 8, 24), dark, 0, 0.08, 0);
      band.rotation.x = Math.PI / 2;
      band.scale.set(1.25 * w, 0.78 * (w > 1.05 ? 1.12 : 1), 1);
      for (const a of [h.armL, h.armR]) add(a, new THREE.CylinderGeometry(limb + 0.009, limb + 0.009, 0.05, 12), dark, 0, -0.54, 0);
      add(B, new THREE.BoxGeometry(0.008, 0.5, 0.006), mat(0x9a9a9a, { metalness: 0.6 }), 0, 0.33, 0.13);
      break;
    }
    case 4: {
      // patient gown over trousers
      add(B, new THREE.CylinderGeometry(0.2 * w, 0.25 * w, 0.34, 16, 1, true), h.topMat, 0, -0.1, 0).scale.z = 0.8;
      for (const y of [0.25, 0.45]) add(B, new THREE.BoxGeometry(0.05, 0.015, 0.02), mat(0xd8d4cc), 0, y, -0.13);
      break;
    }
  }

  // hair
  const hm = mat(hairC, { roughness: 0.95 });
  const S = h.skull;
  const hairCap = (r: number, t: number, tilt = -0.3) => {
    const c = add(S, cap(r, t), hm);
    c.rotation.x = tilt;
    return c;
  };
  switch (look.hair) {
    case 1:
      hairCap(0.118, 0.45, -0.2);
      break;
    case 2:
      hairCap(0.124, 0.5);
      break;
    case 3: {
      hairCap(0.124, 0.5);
      const q = add(S, new THREE.CapsuleGeometry(0.04, 0.1, 4, 10), hm, 0.01, 0.1, 0.06);
      q.rotation.set(-0.5, 0, Math.PI / 2 + 0.25);
      break;
    }
    case 4:
      hairCap(0.123, 0.52);
      add(S, new THREE.SphereGeometry(0.048, 14, 10), hm, 0, 0.03, -0.13);
      break;
    case 5: {
      hairCap(0.126, 0.55);
      const back = add(h.head, new THREE.BoxGeometry(0.2, 0.24, 0.06), hm, 0, -0.1, -0.085);
      back.rotation.x = 0.12;
      for (const x of [-1, 1]) add(h.head, new THREE.BoxGeometry(0.035, 0.2, 0.09), hm, x * 0.1, -0.06, -0.01);
      break;
    }
  }

  accessorize(look, S, h.head, B, w, dark);

  // the hospital wristband every patient wears
  add(h.armL, new THREE.CylinderGeometry(limb + 0.007, limb + 0.007, 0.03, 12), mat(0xeeeeea), 0, -0.53, 0);
  return finish(h);
}


/** The creator's accessory, on a skull group (hats), the head (glasses,
 *  headset) and the torso (scarf, pack), in the old figures' units. */
export function accessorize(look: Look, S: THREE.Object3D, head: THREE.Object3D, B: THREE.Object3D, w: number, dark: THREE.Material) {
  switch (look.extra) {
    case 1: {
      const knit = mat(look.topColor === 2 ? 0x6b2f22 : 0x2e2f33, { roughness: 1 });
      const b = add(S, cap(0.133, 0.48), knit);
      b.rotation.x = -0.15;
      add(S, new THREE.CylinderGeometry(0.134, 0.134, 0.045, 24, 1, true), knit, 0, 0.035, -0.012).rotation.x = -0.15;
      break;
    }
    case 2: {
      const wool = mat(look.topColor === 3 ? 0x323438 : 0x7c3f27, { roughness: 1 });
      const s = add(B, new THREE.TorusGeometry(0.075, 0.035, 10, 20), wool, 0, 0.67, 0);
      s.rotation.x = Math.PI / 2;
      add(B, new THREE.BoxGeometry(0.07, 0.24, 0.03), wool, 0.06, 0.52, 0.135).rotation.z = 0.1;
      break;
    }
    case 3: {
      // a survivor's pack: worn canvas, a flap and buckle, a side pocket, a
      // red medical pouch off the plane, the foil blanket rolled underneath
      const k = w > 1.05 ? 1.1 : 1;
      const z0 = -0.2 * k;
      const canvas = new THREE.MeshStandardMaterial({ color: 0x5a5c48, map: canvasTex(), roughness: 0.95 });
      const webbing = mat(0x22231f, { roughness: 0.9 });
      const metal = mat(0x8c8e8a, { metalness: 0.7, roughness: 0.4 });
      add(B, new RoundedBoxGeometry(0.29 * w, 0.36, 0.14, 3, 0.04), canvas, 0, 0.39, z0);
      const flap = add(B, new RoundedBoxGeometry(0.27 * w, 0.03, 0.15, 2, 0.012), canvas, 0, 0.56, z0 - 0.005);
      flap.rotation.x = 0.12;
      add(B, new THREE.BoxGeometry(0.035, 0.03, 0.012), metal, 0, 0.5, z0 - 0.078);
      add(B, new RoundedBoxGeometry(0.06, 0.16, 0.08, 2, 0.02), canvas, 0.17 * w, 0.33, z0); // side pocket
      const med = add(B, new RoundedBoxGeometry(0.06, 0.1, 0.07, 2, 0.015), mat(0x7e2a24, { roughness: 0.85 }), -0.17 * w, 0.4, z0);
      med.rotation.z = 0.05;
      add(B, new THREE.BoxGeometry(0.004, 0.035, 0.012), mat(0xd8d4cc), -0.2 * w, 0.41, z0);
      add(B, new THREE.BoxGeometry(0.004, 0.012, 0.035), mat(0xd8d4cc), -0.2 * w, 0.41, z0);
      const roll = add(B, new THREE.CylinderGeometry(0.045, 0.045, 0.27 * w, 12), mat(0xb8bcc0, { metalness: 0.6, roughness: 0.35 }), 0, 0.18, z0);
      roll.rotation.z = Math.PI / 2;
      for (const x of [-1, 1]) {
        // compression straps on the back, shoulder straps over the top and down the chest
        add(B, new THREE.BoxGeometry(0.025, 0.34, 0.006), webbing, x * 0.07 * w, 0.39, z0 - 0.073);
        const over = add(B, new THREE.TorusGeometry(0.11 * k, 0.012, 4, 10, Math.PI * 0.75), webbing, x * 0.1 * w, 0.5, -0.02 * k);
        over.rotation.set(0, Math.PI / 2, Math.PI * 0.25);
        add(B, new THREE.BoxGeometry(0.04, 0.3, 0.012), webbing, x * 0.1 * w, 0.42, 0.127 * k);
      }
      add(B, new THREE.BoxGeometry(0.2 * w, 0.02, 0.01), webbing, 0, 0.46, 0.133 * k); // chest strap
      add(B, new THREE.BoxGeometry(0.04, 0.03, 0.014), metal, 0, 0.46, 0.138 * k);
      break;
    }
    case 4: {
      const frame = mat(0x1a1a1a, { metalness: 0.5, roughness: 0.3 });
      for (const x of [-1, 1]) add(head, new THREE.TorusGeometry(0.022, 0.004, 6, 16), frame, x * 0.04, 0.018, 0.113);
      add(head, new THREE.BoxGeometry(0.03, 0.005, 0.005), frame, 0, 0.02, 0.115);
      break;
    }
    case 5: {
      const cloth = mat(0x7d2620, { roughness: 1 });
      add(S, new THREE.CylinderGeometry(0.119, 0.119, 0.035, 24, 1, true), cloth, 0, 0.045, 0).rotation.x = -0.12;
      add(head, new THREE.SphereGeometry(0.025, 8, 6), cloth, 0, 0.05, -0.115);
      break;
    }
    case 6: {
      // aviation headset: band, ear cups, boom mic
      const shell = mat(0x2a2b2e, { roughness: 0.5 });
      const band = add(head, new THREE.TorusGeometry(0.128, 0.012, 6, 24, Math.PI), shell, 0, 0.02, -0.01);
      band.rotation.y = Math.PI / 2;
      for (const x of [-1, 1]) {
        const cup = add(head, new THREE.CylinderGeometry(0.045, 0.045, 0.04, 16), shell, x * 0.118, 0, -0.005);
        cup.rotation.z = Math.PI / 2;
      }
      const boom = add(head, new THREE.CylinderGeometry(0.006, 0.006, 0.12, 6), shell, 0.1, -0.06, 0.06);
      boom.rotation.set(Math.PI / 2.4, 0, 0.5);
      add(head, new THREE.SphereGeometry(0.014, 8, 6), shell, 0.06, -0.075, 0.105);
      break;
    }
  }

}

// ------------------------------------------------------------------ the survivor, for real
const HAIR_STYLE = ["", "buzzed", "simpleparted", "simpleparted", "buns", "long"];

/** The creator's look as clothes on a real body. */
export function lookOutfit(look: Look): Outfit {
  const sex = (look.body ?? 0) === 1 ? "f" : "m";
  const topC = LOOK.topColor[look.topColor]?.c ?? LOOK.topColor[0].c;
  const pantsC = LOOK.pants[look.pants]?.c ?? LOOK.pants[0].c;
  let hair = HAIR_STYLE[look.hair] ?? "simpleparted";
  if (hair === "buzzed" && sex === "f") hair = "buzzedfemale";
  const o: Outfit = {
    sex,
    skin: look.skin,
    hair,
    hairColor: LOOK.hairColor[look.hairColor]?.c ?? LOOK.hairColor[0].c,
    beard: sex === "m" && look.hair !== 0 && look.skin % 2 === 0 && look.build !== 0,
    top: topC,
    pants: pantsC,
    width: [0.93, 1, 1.09][look.build] ?? 1,
    belt: 0x24201c,
  };
  switch (look.top) {
    case 1: // field jacket over a dark tee
      o.top = 0x2b2b2a;
      o.jacket = topC;
      o.boots = true;
      o.shoes = 0x3a2a1e;
      break;
    case 2: // scrubs
      o.sleeves = false;
      o.belt = undefined;
      o.shoes = 0xd8d8d4;
      break;
    case 3: // bomber
      o.top = 0x1d1d1f;
      o.jacket = topC;
      break;
    case 4: // patient gown
      o.top = 0x9aa7ae;
      o.sleeves = false;
      o.belt = undefined;
      o.shoes = 0xb8bcbc;
      break;
  }
  return o;
}

function buildPlayerPerson(look: Look): Humanoid {
  const p = new Person(lookOutfit(look));
  const w = [0.9, 1, 1.18][look.build] ?? 1;
  const dark = mat(0x1c1c1e, { roughness: 0.7 });
  // hats sit on the hair; the old skull group is the head here
  accessorize(look, p.head, p.head, p.torso, w, dark);
  // the hospital wristband every patient wears
  const band = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 14), mat(0xeeeeea));
  band.position.y = 0.035;
  p.wristL.add(band);
  return p;
}

// ------------------------------------------------------------------ the Hollow, for real
/** Patients who stayed out too long: real bodies in what's left of their
 *  clothes, grey under the dirt, a carved bone mask over the face. */
function buildHollowPerson(o: HumanoidOpts): Humanoid {
  const r = Math.random();
  const sex = o.bones || r < 0.62 ? "m" : "f";
  const grey = new THREE.Color(o.skin).lerp(new THREE.Color(0x9a9a96), 0.45).getHex();
  const p = new Person({
    sex,
    skin: 2,
    tint: grey,
    hair: ["", "long", sex === "m" ? "buzzed" : "buzzedfemale", "simpleparted"][Math.floor(Math.random() * 4)],
    hairColor: 0x1a1612,
    top: o.cloth,
    sleeves: Math.random() < 0.6,
    pants: o.pants,
    shoes: 0x1c1915,
    boots: Math.random() < 0.5,
    belt: Math.random() < 0.4 ? 0x2a2018 : undefined,
    jacket: o.bones ? darker(o.cloth, 0.75) : undefined,
    width: o.bones ? 1.12 : 0.94 + Math.random() * 0.08,
  });
  const m = boneMask(o.mask!, o.eye ?? 0xff3a1a);
  p.head.add(m.mask);
  p.eyes = m.eyes;
  p.customEyes = true;
  p.mats.push(m.bone);
  if (o.bones) {
    const bm = mat(0xd8d0bc, { roughness: 0.7 });
    for (let i = 0; i < 5; i++) {
      const a = (i - 2) * 0.35;
      const spike = add(p.head, new THREE.ConeGeometry(0.03, 0.26, 8), bm, Math.sin(a) * 0.12, 0.17, Math.cos(a) * 0.04 - 0.05);
      spike.rotation.z = -a * 0.6;
    }
    for (const x of [-1, 1]) {
      const pad = add(p.torso, new THREE.SphereGeometry(0.13, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), bm, x * 0.22, 0.52, -0.01);
      pad.scale.set(1, 0.6, 0.9);
    }
  }
  return p;
}

// ------------------------------------------------------------------ the Changed, for real
/** Patients who stayed long enough to be rewritten: pale, wrapped, and the
 *  crystal coming up the left arm. */
function buildChangedPerson(o: { cloth: number; skin: number; pants: number; hair?: number; wrap?: number; sex?: "m" | "f" }): Humanoid {
  const sex = o.sex ?? (o.hair !== undefined && o.hair < 0x300000 ? "f" : "m");
  const p = new Person({
    sex,
    skin: 2,
    tint: new THREE.Color(o.skin).lerp(new THREE.Color(0xc8d4d8), 0.3).getHex(),
    hair: o.hair === undefined ? "" : sex === "f" ? "long" : "simpleparted",
    hairColor: o.hair ?? 0,
    beard: sex === "m" && o.hair !== undefined && o.hair > 0x800000,
    top: o.cloth,
    pants: o.pants,
    shoes: 0x2a2520,
    boots: true,
    jacket: darker(o.cloth, 0.8),
    belt: 0x2a2018,
  });
  const wrap = mat(o.wrap ?? 0x4a4038, { roughness: 1 });
  const w = add(p.head, new THREE.CylinderGeometry(0.115, 0.122, 0.075, 18, 1, true), wrap, 0, -0.065, 0.02);
  w.scale.set(1.05, 1, 1.18);
  const crystal = new THREE.MeshStandardMaterial({ color: 0x9eeaf5, emissive: 0x2ab8d8, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const c = add(p.wristL, new THREE.OctahedronGeometry(0.02 + (i % 3) * 0.008, 0), crystal, Math.sin(i * 2.3) * 0.035, 0.04 + i * 0.06, Math.cos(i * 1.7) * 0.035);
    c.scale.y = 1.8;
    c.rotation.z = i * 0.7;
  }
  for (let i = 0; i < 3; i++) add(p.torso, new THREE.OctahedronGeometry(0.035, 0), crystal, 0.17 + i * 0.03, 0.55 + i * 0.04, -0.02 + i * 0.03).scale.y = 2;
  return p;
}

// ------------------------------------------------------------------ weapons
/** The fire axe from the ambulance. `rift` makes the head glow. */
export function buildAxe(rift: boolean) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.026, 0.95, 10), mat(0x9a2a20, { roughness: 0.5 }));
  handle.position.y = 0.3;
  g.add(handle);
  const headMat = rift
    ? mat(0x9fd6e0, { emissive: 0x3aa8c8, emissiveIntensity: 1.6, metalness: 0.6, roughness: 0.25 })
    : mat(0xb9bcc2, { metalness: 0.85, roughness: 0.35 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.28), headMat);
  blade.position.set(0, 0.68, 0.13);
  g.add(blade);
  const pick = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.18, 8), headMat);
  pick.rotation.x = -Math.PI / 2;
  pick.position.set(0, 0.68, -0.09);
  g.add(pick);
  g.rotation.x = Math.PI / 2;
  g.traverse((m) => ((m as THREE.Mesh).castShadow = true));
  return g;
}

export function buildSpear(tip = 0xd9d2c0) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.022, 1.8, 8), mat(0x4a3220));
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.3, 8), mat(tip, { metalness: 0.3 }));
  head.position.y = 1.05;
  g.add(head);
  g.rotation.x = Math.PI / 2;
  g.position.z = 0.3;
  return g;
}

export function buildGreatAxe() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 1.6, 10), mat(0x2b1d14));
  g.add(shaft);
  const bm = mat(0x3b3f45, { metalness: 0.7, roughness: 0.4, emissive: 0x3a0008, emissiveIntensity: 0.5 });
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 24, 1, false, 0, Math.PI), bm);
    blade.rotation.z = Math.PI / 2;
    blade.rotation.y = s > 0 ? 0 : Math.PI;
    blade.position.set(0, 0.6, 0);
    g.add(blade);
  }
  g.rotation.x = Math.PI / 2;
  g.position.z = 0.2;
  return g;
}

export function buildClub() {
  // a length of branch, thick at the striking end, bound with wire and
  // studded with bone
  const g = new THREE.Group();
  const bark = barkMaterial();
  const geo = new THREE.CylinderGeometry(0.12, 0.045, 1.2, 10, 8);
  const p = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < p.count; i++) {
    // knots and a slight bend
    const y = p.getY(i);
    const k = 1 + Math.sin(y * 9 + p.getX(i) * 20) * 0.08;
    p.setX(i, p.getX(i) * k + Math.sin(y * 2.4) * 0.03);
    p.setZ(i, p.getZ(i) * k);
  }
  geo.computeVertexNormals();
  const shaft = new THREE.Mesh(geo, bark);
  shaft.position.y = 0.25;
  g.add(shaft);
  const wire = mat(0x6a6660, { metalness: 0.7, roughness: 0.5 });
  for (const y of [-0.22, -0.1]) {
    const w = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.008, 6, 14), wire);
    w.rotation.x = Math.PI / 2;
    w.position.y = y;
    g.add(w);
  }
  const bone = mat(0xd9cfb8, { roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.12, 6), bone);
    const a = (i / 6) * Math.PI * 2;
    const y = 0.62 + (i % 2) * 0.12;
    sp.position.set(Math.cos(a) * 0.11, y, Math.sin(a) * 0.11);
    sp.lookAt(Math.cos(a) * 2, y, Math.sin(a) * 2);
    sp.rotateX(Math.PI / 2);
    g.add(sp);
  }
  g.rotation.x = Math.PI / 2;
  g.position.z = 0.2;
  g.traverse((m) => ((m as THREE.Mesh).castShadow = true));
  return g;
}

let _bark: THREE.MeshStandardMaterial | null = null;
function barkMaterial() {
  if (_bark) return _bark;
  const t = new THREE.TextureLoader().load(barkUrl);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(1, 2);
  _bark = new THREE.MeshStandardMaterial({ map: t, color: 0x8a7a6a, roughness: 0.95 });
  return _bark;
}

/** Shaman staff; returns the orb material so it can glow while casting. */
export function buildStaff() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.028, 1.7, 8), mat(0x2b1d14));
  g.add(shaft);
  const orbMat = mat(0x0a2a33, { emissive: 0x3ec8e6, emissiveIntensity: 1.3 });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.12, 1), orbMat);
  orb.position.y = 0.95;
  g.add(orb);
  g.rotation.x = 0.3;
  g.position.z = 0.1;
  return { group: g, orbMat };
}

// ------------------------------------------------------------------ natives
/**
 * A Thing: something that lived here long before the first patient fell.
 * Low, long-legged, eyeless but for a pale slit, with a ridge of quills.
 * It fills the Humanoid contract so the enemy code can drive it: the arm
 * pivots are the hind legs, the leg pivots the forelegs.
 */
export function buildThing(): Humanoid {
  const hide = mat(0x4a5048, { roughness: 0.7 });
  const belly = mat(0x9a9a88, { roughness: 0.8 });
  const plate = mat(0x1b1d1c, { roughness: 0.45, metalness: 0.2 });
  const eyes = new THREE.MeshStandardMaterial({ color: 0x0b0d0b, emissive: 0xc8ffd8, emissiveIntensity: 2, roughness: 0.3 });
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.72;
  root.add(body);
  const torso = add(body, new THREE.CapsuleGeometry(0.24, 0.8, 6, 14), hide);
  torso.rotation.x = Math.PI / 2;
  const under = add(body, new THREE.CapsuleGeometry(0.2, 0.7, 6, 12), belly, 0, -0.06, 0);
  under.rotation.x = Math.PI / 2;
  // back plates and quills
  for (let i = 0; i < 5; i++) {
    const p = add(body, new THREE.SphereGeometry(0.2, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), plate, 0, 0.12, 0.42 - i * 0.2);
    p.scale.set(1, 0.45, 0.9);
    const q = add(body, new THREE.ConeGeometry(0.025, 0.32, 6), plate, 0, 0.32, 0.38 - i * 0.2);
    q.rotation.x = -0.6;
  }
  // neck + head: long, low, a vertical slit that glows
  const head = new THREE.Group();
  head.position.set(0, 0.06, 0.62);
  body.add(head);
  const neck = add(head, new THREE.CylinderGeometry(0.09, 0.14, 0.4, 10), hide, 0, 0.02, 0.12);
  neck.rotation.x = Math.PI / 2 - 0.3;
  const skull = add(head, new THREE.CapsuleGeometry(0.11, 0.3, 6, 12), hide, 0, 0.08, 0.42);
  skull.rotation.x = Math.PI / 2 + 0.15;
  const jaw = add(head, new THREE.BoxGeometry(0.14, 0.05, 0.32), belly, 0, -0.02, 0.44);
  jaw.rotation.x = 0.12;
  for (const x of [-1, 0, 1]) add(head, new THREE.SphereGeometry(0.018, 8, 6), eyes, x * 0.05, 0.16 + (x === 0 ? 0.02 : 0), 0.5 - Math.abs(x) * 0.03);
  for (const x of [-1, 1]) add(head, new THREE.SphereGeometry(0.014, 8, 6), eyes, x * 0.08, 0.12, 0.42);
  // throat sac: the light it hunts by
  add(head, new THREE.SphereGeometry(0.06, 10, 8), eyes, 0, -0.06, 0.3).scale.set(1, 0.7, 1.3);
  // legs: thin, long, two segments (pivot at the hip/shoulder)
  const limb = (x: number, z: number) => {
    const pivot = new THREE.Group();
    pivot.position.set(x * 0.2, -0.04, z);
    const upper = add(pivot, new THREE.CapsuleGeometry(0.045, 0.32, 4, 8), hide, x * 0.08, -0.16, 0);
    upper.rotation.z = x * 0.5;
    const lower = add(pivot, new THREE.CapsuleGeometry(0.032, 0.42, 4, 8), plate, x * 0.16, -0.5, 0.04);
    lower.rotation.z = -x * 0.12;
    add(pivot, new THREE.ConeGeometry(0.05, 0.12, 6), plate, x * 0.17, -0.72, 0.06).rotation.x = Math.PI;
    body.add(pivot);
    return pivot;
  };
  const legL = limb(-1, 0.38);
  const legR = limb(1, 0.38);
  const armL = limb(-1, -0.38);
  const armR = limb(1, -0.38);
  const weapon = new THREE.Group();
  head.add(weapon);
  return finish({ root, body, head, armL, armR, legL, legR, weapon, eyes, mats: [hide, belly, plate] });
}

/** One of the Changed: a survivor who stayed long enough for the rift to
 *  start rewriting them. Human, mostly. One arm has gone to cyan crystal. */
export function buildChanged(o: { cloth: number; skin: number; pants: number; hair?: number; wrap?: number; sex?: "m" | "f" }): Humanoid {
  if (peopleOk()) return buildChangedPerson(o);
  const h = core({ skin: o.skin, top: o.cloth, pants: o.pants, w: 0.96, limb: 0.054, eye: 0x7ae2ff });
  if (o.hair !== undefined) {
    const hm = mat(o.hair, { roughness: 0.95 });
    h.mats.push(hm);
    const c = add(h.skull, cap(0.124, 0.55), hm);
    c.rotation.x = -0.35;
  }
  // a cloth wrap over the lower face
  const wrap = mat(o.wrap ?? 0x4a4038, { roughness: 1 });
  h.mats.push(wrap);
  const w = add(h.head, new THREE.CylinderGeometry(0.105, 0.11, 0.07, 16, 1, true), wrap, 0, -0.04, 0.012);
  w.scale.z = 1.08;
  // crystal growth along the left arm and shoulder
  const crystal = new THREE.MeshStandardMaterial({ color: 0x9eeaf5, emissive: 0x2ab8d8, emissiveIntensity: 0.9, roughness: 0.15, metalness: 0.1, flatShading: true });
  for (let i = 0; i < 7; i++) {
    const c = add(h.armL, new THREE.OctahedronGeometry(0.035 + (i % 3) * 0.012, 0), crystal, -0.03 + Math.sin(i * 2.3) * 0.03, -0.1 - i * 0.08, Math.cos(i * 1.7) * 0.03);
    c.scale.y = 1.8;
    c.rotation.z = i * 0.7;
  }
  for (let i = 0; i < 3; i++) add(h.body, new THREE.OctahedronGeometry(0.04, 0), crystal, -0.2 - i * 0.03, 0.62 + i * 0.05, -0.02 + i * 0.03).scale.y = 2;
  return finish(h);
}

/** Worn canvas: a weave, grime toward the bottom, a few scuffs. */
let _canvas: THREE.Texture | null = null;
function canvasTex() {
  if (_canvas) return _canvas;
  const S = 128;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  g.fillStyle = "#b8b8b0";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < S; i += 2) {
    g.fillStyle = `rgba(0,0,0,${0.06 + Math.random() * 0.05})`;
    g.fillRect(0, i, S, 1);
    g.fillRect(i, 0, 1, S);
  }
  const grime = g.createLinearGradient(0, 0, 0, S);
  grime.addColorStop(0, "rgba(40,30,20,0)");
  grime.addColorStop(1, "rgba(40,30,20,0.45)");
  g.fillStyle = grime;
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 14; i++) {
    g.fillStyle = `rgba(30,24,18,${0.1 + Math.random() * 0.2})`;
    g.beginPath();
    g.ellipse(Math.random() * S, Math.random() * S, 3 + Math.random() * 10, 2 + Math.random() * 6, Math.random() * 3, 0, Math.PI * 2);
    g.fill();
  }
  _canvas = new THREE.CanvasTexture(c);
  _canvas.colorSpace = THREE.SRGBColorSpace;
  return _canvas;
}
