// The forest, grown properly: procedural trees (EZ-Tree, MIT, by Dan
// Greenheck: real bark textures, branching, leaf cards) generated once per
// variant at load, then instanced across every tree spot in the world.
//
// Two levels of detail per variant: the full tree near the camera (and only
// these cast shadows), a lighter one with fewer, larger leaves and coarser
// branches further out. The split is rebuilt a few times a second as you move.
//
// Kinds follow the world's colour language: ordinary forest (cool, a little
// wrong), the Blackwood (near-black pines), the Station's red woods.

import * as THREE from "three";
import { Tree } from "ez-tree";

export interface TreeSpot {
  x: number;
  y: number;
  z: number;
  /** yaw (radians) */
  rot: number;
  /** height (m) */
  h: number;
  /** 0 forest, 1 Blackwood, 2 Station */
  kind: 0 | 1 | 2;
  /** 0..1, picks the variant */
  pick: number;
}

const TOUCH = typeof matchMedia !== "undefined" && matchMedia("(pointer: coarse)").matches;
const params = new URLSearchParams(typeof location !== "undefined" ? location.search : "");
const LOW = params.has("low") || (TOUCH && !params.has("high"));
/** Full trees inside this radius; light ones out to FAR. */
const NEAR = LOW ? 24 : 45;
const FAR = LOW ? 150 : 240;

/** Presets per kind, and how each kind is tinted (leaves, bark). */
const KINDS: { presets: string[]; leaf: number[]; bark: number }[] = [
  { presets: ["Oak Large", "Ash Medium", "Pine Large", "Oak Medium"], leaf: [0x7f9a8c, 0x8a9a7a, 0x6f8c86], bark: 0x9a9088 },
  { presets: ["Pine Large", "Pine Medium"], leaf: [0x2e3532, 0x262c2a], bark: 0x3a3634 },
  { presets: ["Ash Large", "Oak Medium"], leaf: [0xa8483a, 0x8a3a30], bark: 0x6a4a42 },
];

interface Variant {
  branch: THREE.BufferGeometry;
  leaves: THREE.BufferGeometry;
  barkMat: THREE.Material;
  leafMat: THREE.Material;
}
interface Part {
  full: Variant;
  low: Variant;
  meshes: { fullB: THREE.InstancedMesh; fullL: THREE.InstancedMesh; lowB: THREE.InstancedMesh; lowL: THREE.InstancedMesh; shB: THREE.InstancedMesh; shL: THREE.InstancedMesh };
  spots: number[];
}

/** Grow one tree from a preset; `low` thins it out. Geometry comes back
 *  normalised: base at the origin, 1 unit tall. */
function grow(preset: string, seed: number, low: boolean) {
  const t = new Tree();
  t.loadPreset(preset);
  const o = t.options;
  o.seed = seed;
  if (low) {
    // a silhouette, not a tree: drop the finest twigs, coarse branches,
    // fewer but bigger leaf cards
    const sec = o.branch.sections as Record<string, number>;
    const seg = o.branch.segments as Record<string, number>;
    if (o.branch.levels >= 3) {
      o.branch.levels -= 1;
      o.leaves.size *= 1.6;
    }
    for (const k of Object.keys(sec)) sec[k] = Math.max(2, Math.round(sec[k] * 0.3));
    for (const k of Object.keys(seg)) seg[k] = Math.max(3, Math.round(seg[k] * 0.5));
    o.leaves.count = Math.max(1, Math.round(o.leaves.count * 0.5));
    o.leaves.size *= 1.5;
    o.leaves.billboard = "single";
  }
  t.generate();
  const box = new THREE.Box3().setFromObject(t);
  const h = box.max.y - box.min.y;
  const fix = (g: THREE.BufferGeometry) => {
    g = g.clone();
    g.translate(0, -box.min.y, 0);
    g.scale(1 / h, 1 / h, 1 / h);
    return g;
  };
  const branch = fix(t.branchesMesh.geometry);
  const leaves = fix(t.leavesMesh.geometry);
  // leaf cards lit like a crown, not like flat cards: normals point out from
  // the middle of the canopy (softer, rounder light)
  leaves.computeBoundingBox();
  const c = leaves.boundingBox!.getCenter(new THREE.Vector3());
  const p = leaves.attributes.position as THREE.BufferAttribute;
  const n = leaves.attributes.normal as THREE.BufferAttribute;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.set(p.getX(i) - c.x, (p.getY(i) - c.y) * 0.7 + 0.15, p.getZ(i) - c.z).normalize();
    n.setXYZ(i, v.x, v.y, v.z);
  }
  const bm = t.branchesMesh.material as THREE.MeshPhongMaterial;
  const lm = t.leavesMesh.material as THREE.MeshPhongMaterial;
  return { branch, leaves, bark: bm, leafMap: lm.map, alphaTest: lm.alphaTest };
}

const wind = { uTime: { value: 0 } };

/** Layer for meshes only the sun's shadow camera renders. */
export const SHADOW_LAYER = 3;
function shadowOnly(m: THREE.InstancedMesh) {
  m.layers.set(SHADOW_LAYER);
  return m;
}

/** Leaves that sway, per instance (the library's shader ignores instancing). */
function leafMaterial(map: THREE.Texture | null, alphaTest: number) {
  const m = new THREE.MeshLambertMaterial({ map, alphaTest, side: THREE.DoubleSide });
  m.onBeforeCompile = (s) => {
    s.uniforms.uTime = wind.uTime;
    s.vertexShader = "uniform float uTime;\n" + s.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 iw = instanceMatrix[3].xyz;
      #else
        vec3 iw = vec3(0.0);
      #endif
      float ph = dot(iw, vec3(0.13, 0.0, 0.17)) + position.y * 3.0;
      float sway = (sin(uTime * 0.9 + ph) * 0.6 + sin(uTime * 2.3 + ph * 1.7) * 0.25) * 0.012 * position.y;
      transformed.x += sway;
      transformed.z += sway * 0.6;`,
    );
  };
  return m;
}

export class Forest {
  group = new THREE.Group();
  private parts: Part[] = [];
  private spots: TreeSpot[];
  private refreshT = 0;
  private last = new THREE.Vector3(1e9, 0, 0);

  constructor(spots: TreeSpot[]) {
    this.spots = spots;
    let seed = 41;
    KINDS.forEach((kind, k) => {
      kind.presets.forEach((preset) => {
        const s = seed++;
        const full = grow(preset, s, false);
        const low = grow(preset, s, true);
        const barkMat = full.bark.clone();
        (barkMat as THREE.MeshPhongMaterial).aoMap = null; // instancing has no uv2 needs; keeps it simple
        const fullV: Variant = { branch: full.branch, leaves: full.leaves, barkMat, leafMat: leafMaterial(full.leafMap, full.alphaTest) };
        const lowV: Variant = { branch: low.branch, leaves: low.leaves, barkMat, leafMat: leafMaterial(low.leafMap, low.alphaTest) };
        const mine = spots.map((sp, i) => (sp.kind === k && Math.floor(sp.pick * kind.presets.length) === kind.presets.indexOf(preset) ? i : -1)).filter((i) => i >= 0);
        const n = Math.max(1, mine.length);
        const im = (g: THREE.BufferGeometry, m: THREE.Material, shadow: boolean) => {
          const x = new THREE.InstancedMesh(g, m, n);
          x.castShadow = shadow;
          x.receiveShadow = true;
          x.count = 0;
          x.frustumCulled = false;
          this.group.add(x);
          return x;
        };
        this.parts.push({
          full: fullV,
          low: lowV,
          spots: mine,
          meshes: {
            fullB: im(fullV.branch, barkMat, false),
            fullL: im(fullV.leaves, fullV.leafMat, false),
            lowB: im(lowV.branch, barkMat, false),
            lowL: im(lowV.leaves, lowV.leafMat, false),
            // near trees cast their shadows from the light version: only the
            // shadow camera sees these (SHADOW_LAYER)
            shB: shadowOnly(im(lowV.branch, barkMat, true)),
            shL: shadowOnly(im(lowV.leaves, lowV.leafMat, true)),
          },
        });
      });
    });
    // per-instance tints: the kind's leaf colours, varied a little per tree
    const col = new THREE.Color();
    for (const part of this.parts)
      for (const mesh of Object.values(part.meshes)) {
        part.spots.forEach((i, j) => {
          const sp = spots[i];
          const K = KINDS[sp.kind];
          if (mesh === part.meshes.fullB || mesh === part.meshes.lowB) col.setHex(K.bark);
          else col.setHex(K.leaf[Math.floor(((sp.pick * 7.31) % 1) * K.leaf.length)]);
          col.multiplyScalar(0.85 + ((sp.pick * 13.7) % 1) * 0.3);
          mesh.setColorAt(j, col);
        });
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      }
  }

  /** Re-split near and far trees around the camera; sway the leaves. */
  update(dt: number, t: number, cam: THREE.Vector3) {
    wind.uTime.value = t;
    this.refreshT -= dt;
    if (this.refreshT > 0 && cam.distanceToSquared(this.last) < 16) return;
    this.refreshT = 0.35;
    this.last.copy(cam);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const up = new THREE.Vector3(0, 1, 0);
    for (const part of this.parts) {
      const M = part.meshes;
      let nf = 0;
      let nl = 0;
      for (let j = 0; j < part.spots.length; j++) {
        const sp = this.spots[part.spots[j]];
        const d = Math.hypot(sp.x - cam.x, sp.z - cam.z);
        if (d > FAR) continue;
        q.setFromAxisAngle(up, sp.rot);
        m.compose(p.set(sp.x, sp.y - 0.15, sp.z), q, s.setScalar(sp.h));
        // colours are per spot: copy this spot's tint to the slot it lands in
        if (d < NEAR) {
          M.fullB.setMatrixAt(nf, m);
          M.fullL.setMatrixAt(nf, m);
          copyColor(M.fullB, j, nf);
          copyColor(M.fullL, j, nf);
          M.shB.setMatrixAt(nf, m);
          M.shL.setMatrixAt(nf, m);
          nf++;
        } else {
          M.lowB.setMatrixAt(nl, m);
          M.lowL.setMatrixAt(nl, m);
          copyColor(M.lowB, j, nl);
          copyColor(M.lowL, j, nl);
          nl++;
        }
      }
      M.fullB.count = M.fullL.count = M.shB.count = M.shL.count = nf;
      M.lowB.count = M.lowL.count = nl;
      for (const x of Object.values(M)) {
        x.instanceMatrix.needsUpdate = true;
        if (x.instanceColor) x.instanceColor.needsUpdate = true;
      }
    }
  }
}

/** Instance colours were written per spot (index j); slots get reused as the
 *  split changes, so keep the original tints aside and copy into place. */
const tintStore = new WeakMap<THREE.InstancedMesh, Float32Array>();
function copyColor(mesh: THREE.InstancedMesh, from: number, to: number) {
  const ic = mesh.instanceColor;
  if (!ic) return;
  let store = tintStore.get(mesh);
  if (!store) {
    store = (ic.array as Float32Array).slice();
    tintStore.set(mesh, store);
  }
  ic.setXYZ(to, store[from * 3], store[from * 3 + 1], store[from * 3 + 2]);
}
