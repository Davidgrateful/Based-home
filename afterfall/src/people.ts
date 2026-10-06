// Realistic people: Quaternius' CC0 base bodies and animation library
// (public/people, built by tools/people/build.mjs), dressed by the game.
//
// Clothes are generated from the body itself: every vertex is assigned to the
// bone that moves it most, so the torso/arms, legs and feet can be lifted off
// the skin as a fitted layer that deforms with the same skeleton. Hair is a
// separate skinned mesh rebound to the wearer's bones by name. Every person
// has an AnimationMixer and a small vocabulary: a looping base (idle, walk,
// sit, drive...) and one-shots (attack, hit, die, roll...) faded over it.
//
// Person satisfies the old Humanoid shape, so code written for the primitive
// figures keeps working: head and weapon are real attachment points (on the
// head and right-hand bones); the limb groups are inert stand-ins.

import * as THREE from "three";
import { GLTFLoader, type GLTF } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import type { Humanoid } from "./models";

// ---------------------------------------------------------------- library
interface Lib {
  body: Record<"m" | "f", GLTF>;
  dark: Record<"m" | "f", THREE.Texture>;
  hair: Record<string, GLTF>;
  clips: Record<string, THREE.AnimationClip>;
  shells: Record<"m" | "f", Record<Region, THREE.BufferGeometry>>;
}
let lib: Lib | null = null;
const waiting: (() => void)[] = [];

const HAIRS = ["buzzed", "buzzedfemale", "simpleparted", "long", "buns", "beard"];
const BASE = "./people/";

async function load(): Promise<void> {
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const tex = new THREE.TextureLoader();
  const get = (f: string) => loader.loadAsync(BASE + f);
  const [m, f, anims, ...hair] = await Promise.all([get("male.glb"), get("female.glb"), get("anims.glb"), ...HAIRS.map((h) => get(`hair-${h}.glb`))]);
  const dark = (s: string) =>
    tex.loadAsync(BASE + `skin-dark-${s}.webp`).then((t) => {
      t.flipY = false; // glTF texture convention
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    });
  const [dm, df] = await Promise.all([dark("m"), dark("f")]);
  const clips: Record<string, THREE.AnimationClip> = {};
  for (const c of anims.animations) clips[c.name] = cleanClip(c);
  lib = {
    body: { m, f },
    dark: { m: dm, f: df },
    hair: Object.fromEntries(HAIRS.map((h, i) => [h, hair[i]])),
    clips,
    shells: { m: makeShells(m), f: makeShells(f) },
  };
  for (const w of waiting.splice(0)) w();
}

let failed = false;
/** Ready once every asset has loaded (the menu waits on this). */
export const peopleReady: Promise<void> = load().catch((e) => {
  failed = true;
  console.error("people failed to load", e);
});
/** False if the people couldn't load (the game falls back to the old figures). */
export const peopleOk = () => !failed;

/** Keep only rotations (and the hips' height), so the library's mannequin
 *  proportions don't stretch our bodies. */
function cleanClip(c: THREE.AnimationClip) {
  c.tracks = c.tracks.filter((t) => t.name.endsWith(".quaternion") || t.name === "pelvis.position");
  return c;
}

// ---------------------------------------------------------------- clothing shells
type Region = "top" | "sleeves" | "pants" | "shoes" | "boots" | "belt" | "jacket";
const REGIONS: Region[] = ["top", "sleeves", "pants", "shoes", "boots", "belt", "jacket"];
/** Height off the skin (m); outer layers sit further out. */
const LIFT: Record<Region, number> = { top: 0.012, sleeves: 0.011, pants: 0.01, shoes: 0.016, boots: 0.02, belt: 0.024, jacket: 0.03 };
/** Smoothing passes: cloth bridges the grooves of the muscle sculpt. */
const DRAPE: Record<Region, number> = { top: 10, sleeves: 6, pants: 8, shoes: 3, boots: 6, belt: 4, jacket: 16 };

/** Where a vertex sits on the T-posed rest body (metres) and which bone owns it. */
interface Spot {
  bone: string;
  x: number;
  y: number;
}
/** Which garments cover a spot. `k` are the rig's landmarks. */
function covers(r: Region, s: Spot, k: { waist: number; shortSleeve: number; wrist: number }) {
  const b = s.bone;
  const ax = Math.abs(s.x);
  const torso = /^(spine_0[123]|clavicle_[lr])$/.test(b);
  const upper = /^upperarm_[lr]$/.test(b);
  const lower = /^lowerarm_[lr]$/.test(b);
  const hips = /^(pelvis|spine_01|thigh_[lr])$/.test(b);
  const leg = /^(pelvis|spine_01|thigh_[lr]|calf_[lr])$/.test(b);
  const foot = /^(foot_[lr]|ball_[lr]|ball_leaf_[lr])$/.test(b);
  switch (r) {
    case "top":
      return ((torso || /^pelvis$/.test(b)) && s.y > k.waist - 0.03) || (upper && ax < k.shortSleeve);
    case "sleeves":
      return (upper && ax >= k.shortSleeve - 0.05) || (lower && ax < k.wrist);
    case "pants":
      return leg && s.y < k.waist + 0.02 && !(b.startsWith("calf") && s.y < 0.06);
    case "shoes":
      return foot || (b.startsWith("calf") && s.y < 0.14);
    case "boots":
      return foot || (b.startsWith("calf") && s.y < 0.3);
    case "belt":
      return hips && s.y > k.waist - 0.05 && s.y < k.waist;
    case "jacket":
      return torso || upper || (lower && ax < k.wrist - 0.02) || (/^(pelvis|spine_01)$/.test(b) && s.y > k.waist - 0.07);
  }
}

function bodyMesh(g: THREE.Object3D) {
  let best: THREE.SkinnedMesh | null = null;
  g.traverse((o) => {
    const m = o as THREE.SkinnedMesh;
    if (m.isSkinnedMesh && (!best || m.geometry.attributes.position.count > best.geometry.attributes.position.count)) best = m;
  });
  return best! as THREE.SkinnedMesh;
}


/** Relax the shell (neighbour averaging), then push any vertex that sank
 *  back out so it stays at least `lift` above the skin along its normal.
 *  Works on positions welded across UV seams; open edges (hems) stay put. */
function drape(p: THREE.BufferAttribute, skin: THREE.BufferAttribute, nor: THREE.BufferAttribute, tris: number[], passes: number, lift: number) {
  // weld: one id per distinct skin position
  const ids = new Map<string, number>();
  const canon = new Int32Array(p.count).fill(-1);
  const rep: number[] = [];
  const used = new Set(tris);
  for (const v of used) {
    const key = `${Math.round(skin.getX(v) * 1e4)},${Math.round(skin.getY(v) * 1e4)},${Math.round(skin.getZ(v) * 1e4)}`;
    let id = ids.get(key);
    if (id === undefined) {
      id = rep.length;
      ids.set(key, id);
      rep.push(v);
    }
    canon[v] = id;
  }
  const n = rep.length;
  const nb: Set<number>[] = Array.from({ length: n }, () => new Set());
  const edges = new Map<number, number>();
  for (let i = 0; i < tris.length; i += 3)
    for (let k = 0; k < 3; k++) {
      const x = canon[tris[i + k]];
      const y = canon[tris[i + ((k + 1) % 3)]];
      nb[x].add(y);
      nb[y].add(x);
      const e = Math.min(x, y) * n + Math.max(x, y);
      edges.set(e, (edges.get(e) ?? 0) + 1);
    }
  const pinned = new Uint8Array(n);
  for (const [e, c] of edges)
    if (c === 1) {
      pinned[Math.floor(e / n)] = 1;
      pinned[e % n] = 1;
    }
  const a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    a[i * 3] = p.getX(rep[i]);
    a[i * 3 + 1] = p.getY(rep[i]);
    a[i * 3 + 2] = p.getZ(rep[i]);
  }
  const tmp = new Float32Array(a.length);
  for (let it = 0; it < passes; it++) {
    tmp.set(a);
    for (let v = 0; v < n; v++) {
      if (pinned[v]) continue;
      let x = 0, y = 0, z = 0;
      for (const u of nb[v]) {
        x += tmp[u * 3];
        y += tmp[u * 3 + 1];
        z += tmp[u * 3 + 2];
      }
      const k = 0.5 / nb[v].size;
      a[v * 3] = tmp[v * 3] * 0.5 + x * k;
      a[v * 3 + 1] = tmp[v * 3 + 1] * 0.5 + y * k;
      a[v * 3 + 2] = tmp[v * 3 + 2] * 0.5 + z * k;
      const s = rep[v];
      const nx = nor.getX(s), ny = nor.getY(s), nz = nor.getZ(s);
      const d = (a[v * 3] - skin.getX(s)) * nx + (a[v * 3 + 1] - skin.getY(s)) * ny + (a[v * 3 + 2] - skin.getZ(s)) * nz;
      if (d < lift) {
        a[v * 3] += nx * (lift - d);
        a[v * 3 + 1] += ny * (lift - d);
        a[v * 3 + 2] += nz * (lift - d);
      }
    }
  }
  for (const v of used) p.setXYZ(v, a[canon[v] * 3], a[canon[v] * 3 + 1], a[canon[v] * 3 + 2]);
}

/** Cut the body into fitted garment shells, one geometry per garment. */
function makeShells(g: GLTF): Record<Region, THREE.BufferGeometry> {
  const body = bodyMesh(g.scene);
  const geo = body.geometry;
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const ji = geo.attributes.skinIndex as THREE.BufferAttribute;
  const jw = geo.attributes.skinWeight as THREE.BufferAttribute;
  const bones = body.skeleton.bones;
  g.scene.updateMatrixWorld(true);
  const at = (name: string) => bones.find((b) => b.name === name)!.getWorldPosition(new THREE.Vector3());
  const k = {
    waist: at("pelvis").y + 0.075,
    shortSleeve: at("upperarm_l").x + 0.12,
    wrist: at("hand_l").x - 0.03,
  };
  // every vertex on the rest body, in metres
  const spots: Spot[] = [];
  const v3 = new THREE.Vector3();
  for (let v = 0; v < pos.count; v++) {
    let bi = 0;
    let bw = -1;
    for (let j = 0; j < 4; j++) {
      const w = jw.getComponent(v, j);
      if (w > bw) {
        bw = w;
        bi = ji.getComponent(v, j);
      }
    }
    body.getVertexPosition(v, v3);
    body.localToWorld(v3);
    spots.push({ bone: bones[bi]?.name ?? "", x: v3.x, y: v3.y });
  }
  const index = geo.index!;
  // positions are quantized (meshopt): metres per stored unit, from the rest pose
  body.computeBoundingBox();
  geo.computeBoundingBox();
  const unit = (body.boundingBox!.max.y - body.boundingBox!.min.y) / (geo.boundingBox!.max.y - geo.boundingBox!.min.y);
  const out = {} as Record<Region, THREE.BufferGeometry>;
  for (const r of REGIONS) {
    const inside = spots.map((s) => covers(r, s, k));
    const g2 = geo.clone();
    // float positions: lifting a packed int16 at the edge of its range would wrap
    const p2 = new THREE.BufferAttribute(new Float32Array(pos.count * 3), 3);
    const lift = LIFT[r] / unit;
    for (let v = 0; v < p2.count; v++) {
      p2.setXYZ(v, pos.getX(v) + nor.getX(v) * lift, pos.getY(v) + nor.getY(v) * lift, pos.getZ(v) + nor.getZ(v) * lift);
    }
    g2.setAttribute("position", p2);
    const tris: number[] = [];
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);
      // whole triangles only: hems follow the edge loops instead of zig-zagging
      if (inside[a] && inside[b] && inside[c]) tris.push(a, b, c);
    }
    g2.setIndex(tris);
    drape(p2, pos, nor, tris, DRAPE[r], lift);
    g2.computeVertexNormals();
    out[r] = g2;
  }
  return out;
}

/** A faint woven texture so fabric doesn't read as paint. */
let weave: THREE.CanvasTexture | null = null;
function fabricNormal() {
  if (weave) return weave;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const img = g.createImageData(128, 128);
  for (let y = 0; y < 128; y++)
    for (let x = 0; x < 128; x++) {
      const k = (y * 128 + x) * 4;
      const wx = Math.sin((x / 128) * Math.PI * 48) * 18 + (Math.random() - 0.5) * 14;
      const wy = Math.sin((y / 128) * Math.PI * 48) * 18 + (Math.random() - 0.5) * 14;
      img.data[k] = 128 + wx;
      img.data[k + 1] = 128 + wy;
      img.data[k + 2] = 255;
      img.data[k + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  weave = new THREE.CanvasTexture(c);
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(16, 16);
  return weave;
}

// ---------------------------------------------------------------- appearance
export interface Outfit {
  sex: "m" | "f";
  /** 0..5, porcelain to deep */
  skin: number;
  /** override the skin tint (the Hollow's grey, the Changed's pallor) */
  tint?: number;
  /** "", or a hair-*.glb name */
  hair: string;
  hairColor: number;
  beard?: boolean;
  top: number; // fabric colour
  sleeves?: boolean; // long sleeves (false: short)
  pants: number;
  shoes?: number;
  /** boots instead of shoes */
  boots?: boolean;
  /** a belt colour */
  belt?: number;
  /** an outer jacket colour */
  jacket?: number;
  /** body width multiplier (lean / standard / heavy) */
  width?: number;
  height?: number;
}

const SKIN_TINT = [0xfff1ea, 0xf3dccb, 0xe9c4a6, 0xffffff, 0xd6b29c, 0xa98b7c];

// ---------------------------------------------------------------- animation names
const CLIP: Record<string, string> = {
  idle: "Idle_Loop",
  talk: "Idle_Talking_Loop",
  walk: "Walk_Loop",
  stroll: "Walk_Formal_Loop",
  jog: "Jog_Fwd_Loop",
  sprint: "Sprint_Loop",
  ready: "Sword_Idle",
  attack: "Sword_Attack",
  jab: "Punch_Jab",
  cross: "Punch_Cross",
  hitChest: "Hit_Chest",
  hitHead: "Hit_Head",
  die: "Death01",
  roll: "Roll",
  jumpStart: "Jump_Start",
  jump: "Jump_Loop",
  land: "Jump_Land",
  sit: "Sitting_Idle_Loop",
  sitTalk: "Sitting_Talking_Loop",
  drive: "Driving_Loop",
  cast: "Spell_Simple_Shoot",
  castIdle: "Spell_Simple_Idle_Loop",
  crouch: "Crouch_Idle_Loop",
  kneel: "Fixing_Kneeling",
  interact: "Interact",
  pickup: "PickUp_Table",
};
export type Pose = keyof typeof CLIP;

// ---------------------------------------------------------------- Person
const live = new Set<Person>();

export class Person implements Humanoid {
  root = new THREE.Group();
  /** The figure, pivoting at the hips (0.95 m up, like the old figures):
   *  code that bobs or leans `body` keeps working. */
  body = new THREE.Group();
  /** On the upper spine, origin at the hips' rest height: scarves, packs. */
  torso = new THREE.Group();
  /** On the left wrist, y up the forearm: the hospital wristband. */
  wristL = new THREE.Group();
  /** On the head bone: masks, headsets, beanies. */
  head = new THREE.Group();
  /** In the right hand: weapons. */
  weapon = new THREE.Group();
  /** Inert stand-ins kept for the old Humanoid shape. */
  armL = new THREE.Group();
  armR = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  eyes = new THREE.MeshStandardMaterial({ color: 0x0c0c0c, emissive: 0x000000, emissiveIntensity: 0 });
  /** Materials that flash when hit (skin and clothes). */
  mats: THREE.MeshStandardMaterial[] = [];
  outfit: Outfit;
  ready = false;
  private mixer: THREE.AnimationMixer | null = null;
  private actions: Record<string, THREE.AnimationAction> = {};
  private baseName: Pose = "idle";
  private baseSpeed = 1;
  private oneShot: THREE.AnimationAction | null = null;
  private model: THREE.Object3D | null = null;
  private bones: Record<string, THREE.Bone> = {};
  private skinMat: THREE.MeshStandardMaterial | null = null;
  private eyeGlow = 0;
  /** Set when something else (a mask) owns `eyes`. */
  customEyes = false;

  constructor(o: Outfit) {
    this.outfit = o;
    live.add(this);
    this.body.position.y = 0.95;
    this.root.add(this.body);
    if (lib) this.build();
    else waiting.push(() => this.build());
  }

  private build() {
    const L = lib!;
    const o = this.outfit;
    const model = cloneSkinned(L.body[o.sex].scene);
    this.model = model;
    model.traverse((n) => {
      if ((n as THREE.Bone).isBone) this.bones[n.name] = n as THREE.Bone;
      const m = n as THREE.SkinnedMesh;
      if (m.isMesh) {
        m.castShadow = true;
        m.frustumCulled = false; // skinned bounds don't follow the pose
        const mat = (m.material as THREE.MeshStandardMaterial).clone();
        m.material = mat;
        if (/Superhero/i.test(mat.name)) {
          this.skinMat = mat;
          this.mats.push(mat);
        } else if (/Eyes/i.test(mat.name)) {
          mat.emissive = new THREE.Color(0x000000);
          if (!this.customEyes) this.eyes = mat;
        } else if (/Hair/i.test(mat.name)) {
          mat.color.setHex(o.hairColor); // eyebrows
        }
      }
    });
    model.position.y = -0.95;
    this.body.add(model);
    // Attachment frames, worked out on the T-posed rest body (in the root's
    // own space, wherever the root already stands) so the old builders' axes
    // still hold: head = y up, z out of the face, origin at the centre of the
    // skull; weapon = z out of the fist, y back up the forearm.
    this.root.updateMatrixWorld(true);
    const rootQ = this.root.getWorldQuaternion(new THREE.Quaternion());
    const rootS = this.root.getWorldScale(new THREE.Vector3());
    const local = (b: THREE.Bone) => this.root.worldToLocal(b.getWorldPosition(new THREE.Vector3()));
    const attach = (g: THREE.Group, bone: THREE.Bone | undefined, at: THREE.Vector3, rot = new THREE.Quaternion()) => {
      if (!bone) return;
      const inv = bone.getWorldQuaternion(new THREE.Quaternion()).invert();
      g.quaternion.copy(inv).multiply(rootQ).multiply(rot);
      g.position.copy(bone.worldToLocal(this.root.localToWorld(at.clone())));
      // bones may carry the armature's scale; attachments scale with the root only
      const sc = bone.getWorldScale(new THREE.Vector3());
      g.scale.set(rootS.x / sc.x, rootS.y / sc.y, rootS.z / sc.z);
      bone.add(g);
    };
    const B = this.bones;
    const zTurn = (a: number) => new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), a);
    if (B.Head) {
      attach(this.head, B.Head, local(B.Head).add(new THREE.Vector3(0, 0.075, 0)));
      this.head.scale.multiplyScalar(0.84); // a real skull is smaller than the old figures'
    }
    if (B.spine_03) attach(this.torso, B.spine_03, new THREE.Vector3(0, 0.95, 0));
    // left wrist: the arm runs out along +x in the T-pose; y points back to the elbow
    if (B.hand_l) attach(this.wristL, B.hand_l, local(B.hand_l).add(new THREE.Vector3(-0.025, 0, 0)), zTurn(Math.PI / 2));
    // right palm: a little past the wrist toward the fingers (-x)
    if (B.hand_r) attach(this.weapon, B.hand_r, local(B.hand_r).add(new THREE.Vector3(-0.075, -0.015, 0)), zTurn(-Math.PI / 2));
    this.dress();
    this.mixer = new THREE.AnimationMixer(model);
    for (const [k, clip] of Object.entries(CLIP)) {
      const c = L.clips[clip];
      if (c) this.actions[k] = this.mixer.clipAction(c);
    }
    this.ready = true;
    this.setBase(this.baseName, this.baseSpeed, 0);
  }

  /** Skin, clothes, hair. Call again after changing `outfit`. */
  dress() {
    if (!this.model || !lib) return;
    const L = lib;
    const o = this.outfit;
    const body = bodyMesh(this.model);
    // skin
    const sm = this.skinMat!;
    const dark = o.skin >= 3;
    if (dark && !sm.userData.light) sm.userData.light = sm.map;
    sm.map = dark ? L.dark[o.sex] : (sm.userData.light ?? sm.map);
    sm.color.setHex(o.tint ?? SKIN_TINT[o.skin] ?? 0xffffff);
    sm.needsUpdate = true;
    // clothes: fitted shells on the same skeleton
    const old: THREE.Object3D[] = [];
    this.model.traverse((c) => c.userData.garment && old.push(c));
    for (const c of old) c.removeFromParent();
    this.mats = [sm];
    const wear = (r: Region, color: number, rough = 0.88) => {
      const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, normalMap: fabricNormal(), normalScale: new THREE.Vector2(0.22, 0.22) });
      const mesh = new THREE.SkinnedMesh(L.shells[o.sex][r], mat);
      mesh.name = r;
      mesh.bind(body.skeleton, body.bindMatrix);
      mesh.userData.garment = true;
      mesh.castShadow = false; // the body's shadow is the same shape
      mesh.frustumCulled = false;
      body.parent!.add(mesh);
      this.mats.push(mat);
    };
    wear("top", o.top);
    if (o.sleeves !== false) wear("sleeves", o.top);
    wear("pants", o.pants, 0.92);
    wear(o.boots ? "boots" : "shoes", o.shoes ?? 0x1d1b19, 0.6);
    if (o.belt !== undefined) wear("belt", o.belt, 0.5);
    if (o.jacket !== undefined) wear("jacket", o.jacket, 0.8);
    // hair (and beard)
    const styles = [o.hair, o.beard ? "beard" : ""].filter(Boolean);
    for (const s of styles) {
      const src = L.hair[s];
      if (!src) continue;
      const tmpl = bodyMesh(src.scene);
      const mesh = new THREE.SkinnedMesh(tmpl.geometry, (tmpl.material as THREE.MeshStandardMaterial).clone());
      (mesh.material as THREE.MeshStandardMaterial).color.setHex(o.hairColor);
      mesh.name = "hair-" + s;
      const bones = tmpl.skeleton.bones.map((b) => this.bones[b.name] ?? b);
      mesh.bind(new THREE.Skeleton(bones, tmpl.skeleton.boneInverses), tmpl.bindMatrix);
      mesh.userData.garment = true;
      mesh.frustumCulled = false;
      body.parent!.add(mesh);
    }
    // build: wider/narrower and taller/shorter
    this.model.scale.set(o.width ?? 1, o.height ?? 1, o.width ?? 1);
  }

  setOutfit(o: Outfit) {
    this.outfit = o;
    this.dress();
  }

  /** The looping base pose. */
  setBase(name: Pose, speed = 1, fade = 0.25) {
    const changed = name !== this.baseName;
    this.baseName = name;
    this.baseSpeed = speed;
    if (!this.ready) return;
    const a = this.actions[name];
    if (!a) return;
    a.timeScale = speed;
    if (!changed && a.isRunning()) return;
    for (const [k, other] of Object.entries(this.actions)) if (k !== name && other !== this.oneShot && other.isRunning()) other.fadeOut(fade);
    a.reset().setEffectiveWeight(1).fadeIn(fade).play();
  }

  /** Pick idle / walk / jog / sprint from a ground speed in m/s. */
  move(speed: number, combat = false) {
    if (speed < 0.3) this.setBase(combat ? "ready" : "idle");
    else if (speed < 2.6) this.setBase("walk", Math.max(0.6, speed / 1.6));
    else if (speed < 6) this.setBase("jog", Math.max(0.7, speed / 4));
    else this.setBase("sprint", Math.max(0.8, speed / 7.5));
  }

  /** A one-shot over the base (attack, hit, roll...). Resolves when done. */
  play(name: Pose, speed = 1, hold = false): Promise<void> {
    if (!this.ready) return Promise.resolve();
    const a = this.actions[name];
    if (!a) return Promise.resolve();
    if (this.oneShot && this.oneShot !== a) this.oneShot.fadeOut(0.1);
    this.oneShot = a;
    a.reset();
    a.setLoop(THREE.LoopOnce, 1);
    a.clampWhenFinished = true;
    a.timeScale = speed;
    a.setEffectiveWeight(1).fadeIn(0.08).play();
    return new Promise((done) => {
      const end = (e: { action: THREE.AnimationAction }) => {
        if (e.action !== a) return;
        this.mixer!.removeEventListener("finished", end);
        if (!hold) {
          a.fadeOut(0.18);
          if (this.oneShot === a) this.oneShot = null;
        }
        done();
      };
      this.mixer!.addEventListener("finished", end);
    });
  }

  /** Drop any held one-shot (after a death pose, on a respawn). */
  clear() {
    if (!this.oneShot) return;
    this.oneShot.fadeOut(0.2);
    this.oneShot = null;
  }

  /** True while a one-shot is playing. */
  get busy() {
    return !!this.oneShot;
  }

  /** Glowing eyes (the Hollow); 0 for none. */
  glow(color: number, intensity: number) {
    this.eyeGlow = intensity;
    this.eyes.emissive?.setHex(color);
    this.eyes.emissiveIntensity = intensity;
  }

  bone(name: string) {
    return this.bones[name];
  }

  /** Extra head turn on top of the clip (radians): yaw about the body's up
   *  axis, pitch nodding down (+). Eased, so cutscenes can just set targets. */
  lookYaw = 0;
  lookPitch = 0;
  private yawNow = 0;
  private pitchNow = 0;

  update(dt: number) {
    this.mixer?.update(dt);
    const k = Math.min(1, dt * 5);
    this.yawNow += (this.lookYaw - this.yawNow) * k;
    this.pitchNow += (this.lookPitch - this.pitchNow) * k;
    if (Math.abs(this.yawNow) + Math.abs(this.pitchNow) > 0.002) this.turnHead();
  }

  private static qa = new THREE.Quaternion();
  private static qb = new THREE.Quaternion();
  private static qp = new THREE.Quaternion();
  private static ax = new THREE.Vector3();
  /** Spread the turn over neck and head, in the body's own frame. */
  private turnHead() {
    const rootQ = this.root.getWorldQuaternion(Person.qa.clone());
    for (const [name, w] of [
      ["neck_01", 0.4],
      ["Head", 0.6],
    ] as const) {
      const b = this.bones[name];
      if (!b?.parent) continue;
      const up = Person.ax.set(0, 1, 0).applyQuaternion(rootQ);
      const turn = Person.qb.setFromAxisAngle(up, this.yawNow * w);
      const side = Person.ax.set(1, 0, 0).applyQuaternion(rootQ);
      turn.multiply(new THREE.Quaternion().setFromAxisAngle(side, this.pitchNow * w));
      // world-space turn -> the bone's parent space
      const pq = b.parent.getWorldQuaternion(Person.qp);
      const local = pq.clone().invert().multiply(turn).multiply(pq);
      b.quaternion.premultiply(local);
    }
  }
}

/** Every Person in the scene updates from one place (people join on creation;
 *  only those in the scene and visible are animated). */
export function track(p: Person) {
  live.add(p);
  return p;
}
export function untrack(p: Person) {
  live.delete(p);
}
export function updatePeople(dt: number) {
  for (const p of live) if (p.root.parent && p.root.visible) p.update(dt);
}

/** The Hollow's carved bone mask, shaped for a real face (goes on Person.head).
 *  Returns the group and the eye material, which glows through the holes. */
export function boneMask(color: number, eye: number) {
  const g = new THREE.Group();
  const bone = new THREE.MeshStandardMaterial({ color, roughness: 0.62 });
  // a shallow shell over the face: front half of a squashed sphere
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.1, 28, 18, 0, Math.PI, 0.12, Math.PI * 0.8), bone);
  shell.scale.set(1.12, 1.32, 1.2);
  shell.position.set(0, -0.012, 0.035);
  g.add(shell);
  // brow ridge and a crude nose bridge
  const brow = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 16, Math.PI), bone);
  brow.position.set(0, 0.03, 0.15);
  brow.scale.set(1.05, 0.5, 1);
  g.add(brow);
  const eyes = new THREE.MeshStandardMaterial({ color: 0x050505, emissive: eye, emissiveIntensity: 2.2 });
  for (const x of [-1, 1]) {
    const hole = new THREE.Mesh(new THREE.CircleGeometry(0.017, 14), eyes);
    hole.position.set(x * 0.036, 0.004, 0.153);
    hole.scale.y = 0.7;
    hole.rotation.y = x * 0.25;
    g.add(hole);
  }
  // a painted slash
  const paint = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.16, 0.004), new THREE.MeshStandardMaterial({ color: 0x6e1a1c, roughness: 0.8 }));
  paint.position.set(0.03, -0.02, 0.151);
  paint.rotation.z = 0.35;
  g.add(paint);
  g.traverse((m) => ((m as THREE.Mesh).castShadow = true));
  return { mask: g, eyes, bone };
}
