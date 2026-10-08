// The forest floor between the trees: leaf litter under the trunks, mud and
// standing water in the hollows, old burns, deer tracks across the wet, and
// fallen branches. Each kind is one instanced mesh, laid flat on the slope,
// placed by a seeded hand so it's the same forest every time.

import * as THREE from "three";

type Ground = (x: number, z: number) => number;

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

function canvas(S: number, draw: (g: CanvasRenderingContext2D, S: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  draw(g, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** A soft blob of colour, ragged at the edge. */
function blob(g: CanvasRenderingContext2D, S: number, col: [number, number, number], alpha: number, lumps = 14) {
  for (let i = 0; i < lumps; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * S * 0.2;
    const x = S / 2 + Math.cos(a) * r;
    const y = S / 2 + Math.sin(a) * r;
    const rad = S * (0.16 + Math.random() * 0.18);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, `rgba(${col[0]},${col[1]},${col[2]},${alpha})`);
    gr.addColorStop(1, `rgba(${col[0]},${col[1]},${col[2]},0)`);
    g.fillStyle = gr;
    g.fillRect(0, 0, S, S);
  }
}

const leavesTex = () =>
  canvas(256, (g, S) => {
    blob(g, S, [38, 28, 18], 0.35, 10);
    for (let i = 0; i < 260; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.pow(Math.random(), 0.7) * S * 0.42;
      const x = S / 2 + Math.cos(a) * r;
      const y = S / 2 + Math.sin(a) * r;
      const tone = Math.random();
      g.fillStyle = tone < 0.4 ? `rgba(92,58,30,0.9)` : tone < 0.75 ? `rgba(120,84,42,0.85)` : `rgba(60,46,30,0.9)`;
      g.save();
      g.translate(x, y);
      g.rotate(Math.random() * 6.28);
      g.beginPath();
      g.ellipse(0, 0, 3 + Math.random() * 4, 1.6 + Math.random() * 2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  });

const mudTex = () =>
  canvas(256, (g, S) => {
    blob(g, S, [34, 26, 20], 0.55, 16);
    blob(g, S, [22, 20, 18], 0.5, 6); // the wet middle
  });

const burnTex = () =>
  canvas(256, (g, S) => {
    blob(g, S, [14, 12, 11], 0.75, 18);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(70,66,60,${0.2 + Math.random() * 0.3})`;
      g.fillRect(S / 2 + (Math.random() - 0.5) * S * 0.5, S / 2 + (Math.random() - 0.5) * S * 0.5, 2, 2); // ash
    }
  });

/** A line of cloven prints, slightly wandering. */
const tracksTex = () =>
  canvas(256, (g, S) => {
    g.fillStyle = "rgba(20,16,12,0.75)";
    for (let i = 0; i < 9; i++) {
      const y = S - 16 - i * 27;
      const x = S / 2 + (i % 2 ? 14 : -14) + Math.sin(i * 0.8) * 10;
      for (const o of [-3.5, 3.5]) {
        g.beginPath();
        g.ellipse(x + o, y, 3, 6.5, o * 0.04, 0, Math.PI * 2);
        g.fill();
      }
    }
  });

/** A fallen branch: a crooked limb with two side twigs. */
function branchGeo() {
  const parts: THREE.BufferGeometry[] = [];
  const add = (len: number, r: number, x: number, z: number, ry: number, rz: number) => {
    const c = new THREE.CylinderGeometry(r * 0.6, r, len, 5);
    c.rotateZ(Math.PI / 2 + rz);
    c.rotateY(ry);
    c.translate(x, r, z);
    parts.push(c.toNonIndexed());
  };
  add(1.6, 0.045, 0, 0, 0, 0.04);
  add(0.6, 0.022, 0.35, 0.18, -0.7, 0.1);
  add(0.45, 0.018, -0.3, -0.12, 0.9, -0.08);
  let n = 0;
  for (const p of parts) n += p.attributes.position.count;
  const pos = new Float32Array(n * 3);
  const nor = new Float32Array(n * 3);
  let o = 0;
  for (const p of parts) {
    pos.set(p.attributes.position.array as Float32Array, o * 3);
    nor.set(p.attributes.normal.array as Float32Array, o * 3);
    o += p.attributes.position.count;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  g.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
  return g;
}

export interface LitterSpots {
  /** ordinary (lit) forest trunks: leaf litter gathers under them */
  trees: { x: number; z: number }[];
  /** keep clear of these (camps, the crash, structures) */
  avoid: { x: number; z: number; r: number }[];
  /** inside the walkable world? */
  inside: (x: number, z: number) => boolean;
}

export function buildLitter(scene: THREE.Object3D, ground: Ground, spots: LitterSpots) {
  const rand = rng(5150);
  const up = new THREE.Vector3(0, 1, 0);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const q2 = new THREE.Quaternion();
  const n = new THREE.Vector3();
  const v = new THREE.Vector3();
  const sc = new THREE.Vector3();
  const clear = (x: number, z: number) => spots.inside(x, z) && !spots.avoid.some((a) => Math.hypot(x - a.x, z - a.z) < a.r);
  /** lie flat on the ground, tilted to its slope */
  const lay = (x: number, z: number, size: number, rot: number, lift = 0.03) => {
    const e = 0.6;
    n.set(ground(x - e, z) - ground(x + e, z), 2 * e, ground(x, z - e) - ground(x, z + e)).normalize();
    q.setFromUnitVectors(up, n);
    q2.setFromAxisAngle(up, rot);
    q.multiply(q2);
    m.compose(v.set(x, ground(x, z) + lift, z), q, sc.set(size, 1, size));
    return m;
  };
  const decals = (tex: THREE.Texture, count: number, place: (i: number) => [number, number, number] | null, rough = 1, lift = 0.03) => {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, depthWrite: false, roughness: rough, polygonOffset: true, polygonOffsetFactor: -1 });
    const im = new THREE.InstancedMesh(geo, mat, count);
    let k = 0;
    for (let i = 0; i < count * 4 && k < count; i++) {
      const p = place(i);
      if (!p || !clear(p[0], p[1])) continue;
      im.setMatrixAt(k++, lay(p[0], p[1], p[2], rand() * 6.28, lift));
    }
    im.count = k;
    im.receiveShadow = true;
    im.renderOrder = 1;
    scene.add(im);
    return im;
  };
  const anywhere = (): [number, number] => [(rand() - 0.5) * 340, (rand() - 0.5) * 340 + 40];

  // leaves gather under the trunks of the ordinary woods
  const trees = spots.trees;
  decals(leavesTex(), 150, () => {
    const t = trees[Math.floor(rand() * trees.length)];
    if (!t) return null;
    const a = rand() * 6.28;
    const r = 0.8 + rand() * 2.2;
    return [t.x + Math.cos(a) * r, t.z + Math.sin(a) * r, 2.5 + rand() * 3];
  });
  // mud and standing water in the low ground; it catches the moon
  const muds: [number, number][] = [];
  decals(mudTex(), 40, () => {
    const [x, z] = anywhere();
    if (ground(x, z) > ground(x + 6, z) + 0.3 && ground(x, z) > ground(x, z + 6) + 0.3) return null; // hollows only
    muds.push([x, z]);
    return [x, z, 2 + rand() * 4];
  }, 0.22, 0.035);
  // old burns: lightning, or somebody's fire long ago
  decals(burnTex(), 14, () => {
    const [x, z] = anywhere();
    return [x, z, 2.5 + rand() * 3.5];
  });
  // deer tracks crossing the wet ground
  decals(tracksTex(), 10, (i) => {
    const mu = muds[i % Math.max(1, muds.length)];
    if (!mu) return null;
    return [mu[0] + (rand() - 0.5) * 2, mu[1] + (rand() - 0.5) * 2, 2.2];
  }, 0.4, 0.045);

  // fallen branches
  const bm = new THREE.MeshStandardMaterial({ color: 0x3a2f26, roughness: 1 });
  const branches = new THREE.InstancedMesh(branchGeo(), bm, 200);
  let k = 0;
  for (let i = 0; i < 900 && k < 200; i++) {
    const t = trees[Math.floor(rand() * trees.length)];
    const [x, z] = t && rand() < 0.75 ? [t.x + (rand() - 0.5) * 7, t.z + (rand() - 0.5) * 7] : anywhere();
    if (!clear(x, z)) continue;
    q.setFromEuler(new THREE.Euler((rand() - 0.5) * 0.15, rand() * 6.28, (rand() - 0.5) * 0.15));
    const s = 0.7 + rand() * 1.3;
    m.compose(v.set(x, ground(x, z) - 0.02, z), q, sc.set(s, s, s));
    branches.setMatrixAt(k++, m);
  }
  branches.count = k;
  branches.castShadow = true;
  branches.receiveShadow = true;
  scene.add(branches);
}
