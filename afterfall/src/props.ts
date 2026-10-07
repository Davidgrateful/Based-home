// The forest floor's furniture: photo-scanned rocks, stumps, fallen trunks
// and ferns (Poly Haven, CC0; tools/world/build.mjs), and a field of grass
// that follows the player. Everything is instanced.
//
// Rocks, stumps and logs have fixed places in the world (and colliders, set by
// the caller as soon as it places them; the meshes arrive when loaded).
// Grass and ferns are "near field": generated per 3 m ground cell from a hash
// of the cell, so the same spot always grows the same plants as you walk.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { fetchModel } from "./assets";

const DIR = "./world/";
const TOUCH = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const LOW = params.has("low") || (TOUCH && !params.has("high"));

export interface Placed {
  x: number;
  y: number;
  z: number;
  /** size (m, roughly the longest side) */
  s: number;
  rx: number;
  ry: number;
  rz: number;
  /** squash height (rocks sit low) */
  sy?: number;
}

interface Piece {
  geo: THREE.BufferGeometry;
  mat: THREE.Material;
}

/** Every mesh in a glb, baked to world-less geometry, centred on the base
 *  and scaled so the longest side is 1. */
async function pieces(file: string): Promise<Piece[]> {
  const gltf = await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(await fetchModel(DIR, file), DIR);
  gltf.scene.updateMatrixWorld(true);
  const out: Piece[] = [];
  gltf.scene.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh) return;
    const g = m.geometry.clone();
    g.applyMatrix4(m.matrixWorld);
    g.computeBoundingBox();
    const b = g.boundingBox!;
    const size = b.getSize(new THREE.Vector3());
    const k = 1 / Math.max(size.x, size.y, size.z);
    const c = b.getCenter(new THREE.Vector3());
    g.translate(-c.x, -b.min.y, -c.z);
    g.scale(k, k, k);
    const mat = (m.material as THREE.MeshStandardMaterial).clone();
    mat.envMapIntensity = 0.4;
    out.push({ geo: g, mat });
  });
  return out;
}

function instance(scene: THREE.Object3D, list: Placed[], kinds: Piece[], shadow: boolean) {
  const groups = kinds.map(() => [] as Placed[]);
  list.forEach((p, i) => groups[i % kinds.length].push(p));
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const v = new THREE.Vector3();
  const s = new THREE.Vector3();
  kinds.forEach((k, i) => {
    const g = groups[i];
    if (!g.length) return;
    const im = new THREE.InstancedMesh(k.geo, k.mat, g.length);
    g.forEach((p, j) => {
      q.setFromEuler(e.set(p.rx, p.ry, p.rz));
      m.compose(v.set(p.x, p.y, p.z), q, s.set(p.s, p.s * (p.sy ?? 1), p.s));
      im.setMatrixAt(j, m);
    });
    im.castShadow = shadow;
    im.receiveShadow = true;
    scene.add(im);
  });
}

/** Rocks, stumps and fallen trunks at fixed places (loaded in the background). */
export function placeProps(scene: THREE.Object3D, rocks: Placed[], stumps: Placed[], logs: Placed[]) {
  void (async () => {
    try {
      const [r7, r9, set, stump, log] = await Promise.all(["rock-07.glb", "rock-09.glb", "rock-moss-set-01.glb", "tree-stump-01.glb", "dead-tree-trunk.glb"].map(pieces));
      instance(scene, rocks, [...r7, ...r9, ...set], true);
      instance(scene, stumps, stump, true);
      instance(scene, logs, log, true);
    } catch (e) {
      console.error("props failed to load", e);
    }
  })();
}

// ------------------------------------------------------------------ grass and ferns
/** A clump of grass blades: tapered, curved strips, darker at the root. */
function grassClump() {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const blades = 16;
  const segs = 3;
  let seed = 7;
  const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let b = 0; b < blades; b++) {
    const a = r() * Math.PI * 2;
    const ox = Math.cos(a) * r() * 0.32;
    const oz = Math.sin(a) * r() * 0.32;
    const h = 0.14 + r() * 0.26;
    const w = 0.018 + r() * 0.014;
    const lean = (r() - 0.5) * 0.9;
    const yaw = r() * Math.PI;
    const dx = Math.cos(yaw);
    const dz = Math.sin(yaw);
    const base = pos.length / 3;
    for (let i = 0; i <= segs; i++) {
      const t = i / segs;
      const y = t * h;
      const bend = lean * t * t * h;
      const hw = w * (1 - t * 0.9);
      for (const sd of [-1, 1]) {
        pos.push(ox + dx * hw * sd + Math.cos(a) * bend, y, oz + dz * hw * sd + Math.sin(a) * bend);
        const k = 0.35 + t * 0.65;
        col.push(k, k, k);
      }
    }
    for (let i = 0; i < segs; i++) {
      const v = base + i * 2;
      idx.push(v, v + 1, v + 2, v + 1, v + 3, v + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // grass lit from above, not by its own thin faces
  const n = g.attributes.normal as THREE.BufferAttribute;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, n.getX(i) * 0.3, 1, n.getZ(i) * 0.3);
  return g;
}

const sway = { uTime: { value: 0 } };
function swaying<T extends THREE.Material>(m: T, amount: number) {
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = sway.uTime;
    s.vertexShader = "uniform float uTime;\n" + s.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 iw = instanceMatrix[3].xyz;
      #else
        vec3 iw = vec3(0.0);
      #endif
      float ph = iw.x * 0.21 + iw.z * 0.17;
      float w = (sin(uTime * 1.6 + ph) * 0.6 + sin(uTime * 3.7 + ph * 2.3) * 0.25) * ${amount.toFixed(3)} * position.y * position.y;
      transformed.x += w;
      transformed.z += w * 0.5;`,
    );
  };
  return m;
}

/** A hash of a ground cell: the same cell always grows the same plants. */
function hash(ix: number, iz: number, k: number) {
  let h = (ix * 374761393 + iz * 668265263 + k * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export interface FloorInfo {
  /** 0..1: how much grows here (0 on paths, burnt ground, ash) */
  grow: number;
  /** the Blackwood: ferns only, no grass */
  dark: boolean;
}

export class NearField {
  group = new THREE.Group();
  private grass: THREE.InstancedMesh;
  private ferns: THREE.InstancedMesh[] = [];
  private cell = { x: 1e9, z: 1e9 };
  private ground: (x: number, z: number) => number;
  private floor: (x: number, z: number) => FloorInfo;
  private readonly R = LOW ? 14 : 26;
  private readonly C = 3; // cell size (m)

  constructor(ground: (x: number, z: number) => number, floor: (x: number, z: number) => FloorInfo) {
    this.ground = ground;
    this.floor = floor;
    const cells = Math.ceil(((Math.PI * this.R * this.R) / (this.C * this.C)) * 1.3);
    const perCell = LOW ? 6 : 12;
    const mat = swaying(new THREE.MeshLambertMaterial({ color: 0x5c6e48, vertexColors: true, side: THREE.DoubleSide }), 0.12);
    this.grass = new THREE.InstancedMesh(grassClump(), mat, cells * perCell);
    this.grass.count = 0;
    this.grass.frustumCulled = false;
    this.grass.receiveShadow = true;
    this.group.add(this.grass);
    void pieces("fern-02.glb")
      .then((ps) => {
        for (const p of ps) {
          const m = swaying(p.mat as THREE.MeshStandardMaterial, 0.18);
          (m as THREE.MeshStandardMaterial).color.setHex(0xa6b8a8);
          const im = new THREE.InstancedMesh(p.geo, m, cells);
          im.count = 0;
          im.frustumCulled = false;
          im.receiveShadow = true;
          this.ferns.push(im);
          this.group.add(im);
        }
        this.cell.x = 1e9; // re-scatter with ferns
      })
      .catch((e) => console.error("ferns failed to load", e));
  }

  update(t: number, at: THREE.Vector3) {
    sway.uTime.value = t;
    const cx = Math.floor(at.x / this.C);
    const cz = Math.floor(at.z / this.C);
    if (cx === this.cell.x && cz === this.cell.z) return;
    this.cell = { x: cx, z: cz };
    const n = Math.ceil(this.R / this.C);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    const v = new THREE.Vector3();
    const s = new THREE.Vector3();
    const perCell = LOW ? 6 : 12;
    let gi = 0;
    const fi = this.ferns.map(() => 0);
    const gMax = this.grass.instanceMatrix.count;
    for (let iz = cz - n; iz <= cz + n; iz++)
      for (let ix = cx - n; ix <= cx + n; ix++) {
        const x0 = ix * this.C;
        const z0 = iz * this.C;
        if (Math.hypot(x0 + this.C / 2 - at.x, z0 + this.C / 2 - at.z) > this.R) continue;
        const f = this.floor(x0 + this.C / 2, z0 + this.C / 2);
        if (f.grow <= 0.02) continue;
        if (!f.dark)
          for (let k = 0; k < perCell && gi < gMax; k++) {
            if (hash(ix, iz, k) > f.grow) continue;
            const x = x0 + hash(ix, iz, k + 11) * this.C;
            const z = z0 + hash(ix, iz, k + 23) * this.C;
            q.setFromAxisAngle(up, hash(ix, iz, k + 31) * 6.28);
            const sc = 0.7 + hash(ix, iz, k + 41) * 0.8;
            m.compose(v.set(x, this.ground(x, z) - 0.03, z), q, s.set(sc, sc * (0.8 + f.grow * 0.5), sc));
            this.grass.setMatrixAt(gi++, m);
          }
        // a fern in some cells: more of them in the dark
        if (this.ferns.length && hash(ix, iz, 97) < (f.dark ? 0.45 : 0.22) * f.grow) {
          const which = Math.floor(hash(ix, iz, 101) * this.ferns.length);
          const x = x0 + hash(ix, iz, 103) * this.C;
          const z = z0 + hash(ix, iz, 107) * this.C;
          q.setFromAxisAngle(up, hash(ix, iz, 109) * 6.28);
          const sc = 0.9 + hash(ix, iz, 113) * 0.9;
          m.compose(v.set(x, this.ground(x, z) - 0.05, z), q, s.setScalar(sc));
          const im = this.ferns[which];
          if (fi[which] < im.instanceMatrix.count) im.setMatrixAt(fi[which]++, m);
        }
      }
    this.grass.count = gi;
    this.grass.instanceMatrix.needsUpdate = true;
    this.ferns.forEach((im, i) => {
      im.count = fi[i];
      im.instanceMatrix.needsUpdate = true;
    });
  }
}

/** A ring of small photo-scanned stones around a fire pit (added when loaded). */
export function stoneRing(parent: THREE.Object3D, n: number, radius: number, size: number) {
  // rounded field stones (the scanned boulders, small): the mossy set reads as slabs this close
  void Promise.all([pieces("rock-07.glb"), pieces("rock-09.glb")])
    .then(([a, b]) => {
      const ps = [...a, ...b];
      for (let i = 0; i < n; i++) {
        const p = ps[i % ps.length];
        const m = new THREE.Mesh(p.geo, p.mat);
        const a = (i / n) * Math.PI * 2 + (i % 2) * 0.12;
        const s = size * (0.8 + ((i * 37) % 10) / 25);
        m.position.set(Math.cos(a) * radius, -0.12 * s, Math.sin(a) * radius);
        m.rotation.set((i % 3) * 0.4, a * 3.1 + i, (i % 2) * 0.3);
        m.scale.set(s, s * 0.8, s);
        m.castShadow = m.receiveShadow = true;
        parent.add(m);
      }
    })
    .catch((e) => console.error("stones failed to load", e));
}
