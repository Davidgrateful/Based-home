// The world remembers. Across loops it keeps evidence (more tally marks,
// your wristbands by the fire, a cairn, a fallen tree, the mast going dark).
// Across a loop's nights the fire's edge escalates slowly: a figure, a voice
// that isn't Rhea's, a page in your handwriting, a stand-off, a tear. And
// from the third loop on you remember which way they come; so do they.

import * as THREE from "three";
import { enemies, persist, player, say, sfx, state, toast, world } from "./ctx";
import { save } from "./save";
import * as S from "./script";
import { signs } from "./story";
import type { Line } from "./script";
import { CAMP, heightAt, MAST, STATION } from "./world";

const once = (k: string) => {
  if (save.flags["mem_" + k]) return false;
  save.flags["mem_" + k] = true;
  persist();
  return true;
};

// ---------------------------------------------------------------- props
const props = new THREE.Group();
world.scene.add(props);
const stone = new THREE.MeshStandardMaterial({ color: 0x4a4744, roughness: 1, flatShading: true });
const CAIRN = new THREE.Vector3(-6, 0, 22);
const TREE = new THREE.Vector3(-9, 0, 27);
let built = { cairn: false, tree: false, bands: 0, page: false };

function buildCairn() {
  const g = new THREE.Group();
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34 - i * 0.04, 0), stone);
    s.position.set(Math.sin(i * 2) * 0.05, 0.2 + i * 0.32, Math.cos(i * 3) * 0.05);
    s.scale.y = 0.6;
    s.castShadow = true;
    g.add(s);
  }
  g.position.set(CAIRN.x, heightAt(CAIRN.x, CAIRN.z), CAIRN.z);
  props.add(g);
  world.colliders.push({ x: CAIRN.x, z: CAIRN.z, r: 0.5 });
}

function buildFallenTree() {
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.55, 11, 8), new THREE.MeshStandardMaterial({ color: 0x1c1426, roughness: 1 }));
  trunk.rotation.set(0, 0.6, Math.PI / 2 - 0.08);
  trunk.position.set(TREE.x, heightAt(TREE.x, TREE.z) + 0.45, TREE.z);
  trunk.castShadow = true;
  props.add(trunk);
  for (let i = -4; i <= 4; i += 2) world.colliders.push({ x: TREE.x + Math.cos(0.6) * i, z: TREE.z - Math.sin(0.6) * i, r: 0.7 });
}

function placeBands(n: number) {
  for (; built.bands < Math.min(n, 9); built.bands++) {
    const a = 0.5 + built.bands * 0.55;
    const b = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 6, 14), new THREE.MeshStandardMaterial({ color: 0xe8ecef, roughness: 0.5 }));
    b.rotation.x = Math.PI / 2;
    b.position.set(CAMP.x + Math.cos(a) * 0.82, heightAt(CAMP.x, CAMP.z) + 0.2, CAMP.z + Math.sin(a) * 0.82);
    props.add(b);
  }
}

let pageMesh: THREE.Mesh | null = null;
function placePage(on: boolean) {
  if (on && !pageMesh) {
    pageMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), new THREE.MeshStandardMaterial({ color: 0xe4dfd3, roughness: 1, side: THREE.DoubleSide }));
    pageMesh.rotation.set(-Math.PI / 2, 0, 0.6);
    pageMesh.position.set(CAMP.x - 1.3, heightAt(CAMP.x - 1.3, CAMP.z + 0.6) + 0.02, CAMP.z + 0.6);
    props.add(pageMesh);
  }
  if (pageMesh) pageMesh.visible = on;
}

/** Make the world match what the loop has done so far. Called on every wake. */
export function applyWorldMemory() {
  const L = save.loops;
  signs.addTally(Math.min(14, L * 2));
  placeBands(L);
  if (L >= 3 && !built.cairn) {
    built.cairn = true;
    buildCairn();
  }
  if (L >= 4 && !built.tree) {
    built.tree = true;
    buildFallenTree();
  }
  world.mastDark = L >= 5;
  world.stationDark = save.storyDone;
}

/** Lines for whatever's new since the last wake (one per wake, oldest first). */
export function memoryWakeLine(): Line[] | null {
  const L = save.loops;
  if (L >= 1 && once("bands")) return S.MEM_BANDS;
  if (L >= 3 && once("cairn")) return S.MEM_CAIRN;
  if (L >= 4 && once("tree")) return S.MEM_TREE;
  if (L >= 5 && once("mast")) return S.MEM_MAST;
  if ((L >= 6 || (save.storyDone && L >= 3)) && once("understand")) return S.MEM_UNDERSTAND;
  return null;
}

// ---------------------------------------------------------------- remembered direction
const BEARINGS = [
  { name: "the wreck", p: new THREE.Vector3(-12, 0, 30) },
  { name: "the Blackwood", p: new THREE.Vector3(-80, 0, 12) },
  { name: "the mast", p: MAST },
  { name: "the field station", p: STATION },
  { name: "the stone circle", p: new THREE.Vector3(0, 0, 165) },
];
/** From the third loop, each night's storm comes from one remembered side. */
export function rememberedAngle(n: number): number | null {
  if (save.loops < 2) return null;
  const b = BEARINGS[(n * 7 + 3) % BEARINGS.length];
  return Math.atan2(b.p.z - CAMP.z, b.p.x - CAMP.x);
}
function rememberedName(n: number) {
  return BEARINGS[(n * 7 + 3) % BEARINGS.length].name;
}

// ---------------------------------------------------------------- the fire's edge
type Beat = "shape" | "voice" | "page" | "standoff" | "tear";
let tonight: Beat | null = null;
let beatAt = 0;
let beatDone = false;
let clock = 0;
let shapeT = 0;

/** Each night (from the second) gets at most one quiet beat, unlocked slowly. */
export function memoryNightStart(n: number) {
  clock = 0;
  beatDone = false;
  shapeT = 0;
  signs.showShape(false);
  placePage(false);
  const pool: Beat[] = [];
  if (n >= 2) pool.push("shape");
  if (n >= 3) pool.push("voice");
  if (n >= 4 || save.loops >= 2) pool.push("page");
  if (n >= 5) pool.push("standoff");
  if (n >= 6 || save.loops >= 4) pool.push("tear");
  // newest unlocked beat first, so each night brings something new
  tonight = pool.length ? pool[pool.length - 1 - (n % Math.min(2, pool.length))] : null;
  beatAt = tonight === "standoff" ? -1 : 20 + Math.random() * 20;
  const ang = rememberedAngle(n);
  if (ang !== null) {
    const where = rememberedName(n);
    setTimeout(() => {
      if (state.mode === "night") say([["YOU", `They came from ${where} last time. They'll come from ${where} again.`]]);
    }, 9000);
  }
}

/** The storm arrived (for the stand-off beat). */
export function memoryStorm() {
  if (tonight === "standoff" && !beatDone) {
    beatDone = true;
    say(S.MEM_STANDOFF);
    // they hold at the edge of the light for a few breaths
    enemies.holdT = 9;
  }
}

export function memoryUpdate(dt: number, dusk: boolean) {
  clock += dt;
  if (!tonight || beatDone || !dusk || beatAt < 0 || clock < beatAt) {
    if (shapeT > 0) {
      shapeT -= dt;
      if (shapeT <= 0 || signs.shapeSeen(cameraRef())) signs.showShape(false);
    }
    return;
  }
  beatDone = true;
  const away = new THREE.Vector3().subVectors(CAMP, player.pos).setY(0);
  const a = Math.atan2(-away.z, -away.x) + (Math.random() - 0.5) * 1.2;
  switch (tonight) {
    case "shape": {
      // at the edge of the light, opposite where you're looking
      const p = new THREE.Vector3(CAMP.x + Math.cos(a + Math.PI) * 20, 0, CAMP.z + Math.sin(a + Math.PI) * 20);
      signs.placeShape(p, CAMP);
      signs.showShape(true);
      shapeT = 9;
      sfx.breath(2);
      setTimeout(() => say(S.MEM_SHAPE), 2500);
      break;
    }
    case "voice":
      sfx.ambienceTo(0.02, 1.5);
      say(S.MEM_VOICE).then(() => sfx.ambienceTo(0.18, 3));
      break;
    case "page":
      placePage(true);
      toast("Something's by the fire that wasn't there a minute ago.", 3500);
      say(S.MEM_PAGE);
      break;
    case "tear":
      world.spawnTear(CAMP.x, CAMP.z + 1.5, true);
      sfx.rumble();
      say(S.MEM_TEAR);
      break;
  }
}

let camRef: THREE.Camera | null = null;
export function setMemoryCamera(c: THREE.Camera) {
  camRef = c;
}
function cameraRef() {
  return camRef!;
}
