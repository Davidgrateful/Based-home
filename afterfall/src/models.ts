// Low-poly characters built from primitives, with pivoted limbs so they can be
// animated procedurally (no rigged model files needed).

import * as THREE from "three";

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

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.05, flatShading: true, ...extra });

function limb(len: number, w: number, m: THREE.Material, y: number, x: number) {
  const pivot = new THREE.Group();
  pivot.position.set(x, y, 0);
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), m);
  mesh.position.y = -len / 2;
  mesh.castShadow = true;
  pivot.add(mesh);
  return pivot;
}

export function buildHumanoid(o: HumanoidOpts): Humanoid {
  const cloth = mat(o.cloth);
  const skin = mat(o.skin);
  const pants = mat(o.pants);
  const eyes = mat(0x000000, { emissive: o.eye ?? 0x111111, emissiveIntensity: 2 });
  const mats = [cloth, skin, pants];

  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = 0.95;
  root.add(body);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.7, 0.32), cloth);
  torso.position.y = 0.35;
  torso.castShadow = true;
  body.add(torso);

  const head = new THREE.Group();
  head.position.y = 0.88;
  body.add(head);
  const skull = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.34, 0.3), skin);
  skull.castShadow = true;
  head.add(skull);
  if (o.hair !== undefined) {
    const hm = mat(o.hair);
    mats.push(hm);
    const hair = new THREE.Mesh(new THREE.BoxGeometry(0.33, 0.12, 0.33), hm);
    hair.position.set(0, 0.16, -0.02);
    head.add(hair);
  }
  if (o.mask !== undefined) {
    const mm = mat(o.mask, { roughness: 0.4 });
    mats.push(mm);
    const mask = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.36, 0.06), mm);
    mask.position.z = 0.17;
    head.add(mask);
    // war-paint slash
    const slash = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.38, 0.01), mat(0x8a1020));
    slash.position.set(0.06, 0, 0.205);
    slash.rotation.z = 0.4;
    head.add(slash);
  }
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.02), eyes);
    e.position.set(0.07 * s, 0.03, o.mask !== undefined ? 0.205 : 0.155);
    head.add(e);
  }
  if (o.bones) {
    const bm = mat(0xe8e0cc);
    mats.push(bm);
    for (let i = 0; i < 5; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 4), bm);
      const a = (i - 2) * 0.35;
      spike.position.set(Math.sin(a) * 0.14, 0.26, Math.cos(a) * 0.05 - 0.04);
      spike.rotation.z = -a * 0.6;
      head.add(spike);
    }
    const shoulder = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.12, 0.4), bm);
    shoulder.position.y = 0.66;
    body.add(shoulder);
  }

  const armL = limb(0.62, 0.15, cloth, 0.66, -0.36);
  const armR = limb(0.62, 0.15, cloth, 0.66, 0.36);
  body.add(armL, armR);
  for (const a of [armL, armR]) {
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.13), skin);
    hand.position.y = -0.66;
    a.add(hand);
  }
  const legL = limb(0.9, 0.2, pants, 0.0, -0.14);
  const legR = limb(0.9, 0.2, pants, 0.0, 0.14);
  body.add(legL, legR);
  legL.position.y = legR.position.y = 0.02;
  body.position.y = 0.92;

  const weapon = new THREE.Group();
  weapon.position.set(0, -0.66, 0.04);
  armR.add(weapon);

  return { root, body, head, armL, armR, legL, legR, weapon, eyes, mats };
}

/** The fire axe from the ambulance. `rift` makes the head glow. */
export function buildAxe(rift: boolean) {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.95, 6), mat(0xb52b20));
  handle.position.y = 0.3;
  g.add(handle);
  const headMat = rift
    ? mat(0x9ff6ff, { emissive: 0x2ad8ff, emissiveIntensity: 2.2, metalness: 0.6, roughness: 0.2 })
    : mat(0xc9ccd2, { metalness: 0.8, roughness: 0.3 });
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.22, 0.3), headMat);
  blade.position.set(0, 0.68, 0.14);
  g.add(blade);
  const pick = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.2, 4), headMat);
  pick.rotation.x = -Math.PI / 2;
  pick.position.set(0, 0.68, -0.1);
  g.add(pick);
  g.rotation.x = Math.PI / 2;
  g.traverse((m) => ((m as THREE.Mesh).castShadow = true));
  return g;
}

export function buildSpear(tip = 0xd9d2c0) {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.8, 5), mat(0x4a3220));
  g.add(shaft);
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.32, 4), mat(tip, { metalness: 0.3 }));
  head.position.y = 1.05;
  g.add(head);
  g.rotation.x = Math.PI / 2;
  g.position.z = 0.3;
  return g;
}

export function buildGreatAxe() {
  const g = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.6, 6), mat(0x2b1d14));
  g.add(shaft);
  const bm = mat(0x3b3f45, { metalness: 0.7, roughness: 0.4, emissive: 0x550010, emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) {
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.05, 3, 1, false, 0, Math.PI), bm);
    blade.rotation.z = Math.PI / 2;
    blade.rotation.y = s > 0 ? 0 : Math.PI;
    blade.position.set(0, 0.6, 0);
    g.add(blade);
  }
  g.rotation.x = Math.PI / 2;
  g.position.z = 0.2;
  return g;
}
