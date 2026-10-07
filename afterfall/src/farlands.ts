// The far places, reached after the Warden: the settlement of the Changed in
// the deep Blackwood, the Rift Basin past the stone circle, and the Choir at
// the Basin's white heart. Built once; idle until the story gets there (the
// Basin's floating debris is visible from the circle before then, on purpose).

import * as THREE from "three";
import { Person } from "./people";
import { Fire } from "./fire";
import { buildChanged, buildPlayerModel, DEFAULT_LOOK, type Humanoid, type Look } from "./models";
import { BASIN_C, BASIN_R, CHOIR_C, beamFade, glowTexture, heightAt, SETTLEMENT, type World } from "./world";
import type { SpeakerId } from "./voice";

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.85, ...extra });
const at = (x: number, z: number, lift = 0) => new THREE.Vector3(x, heightAt(x, z) + lift, z);

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
}

export interface Npc {
  id: SpeakerId | "";
  h: Humanoid;
  pos: THREE.Vector3;
  yaw: number;
  sit?: boolean;
  talk: number;
}

export const SETTLE_FIRE = at(SETTLEMENT.x, SETTLEMENT.z);
export const WALL_POS = at(SETTLEMENT.x - 7.5, SETTLEMENT.z + 2.5);
export const CHOIR_PIT = at(CHOIR_C.x, CHOIR_C.z);
export const CHOIR_CASE = at(CHOIR_C.x + 1.8, CHOIR_C.z - 1.2);

export const inBasin = (x: number, z: number) => Math.hypot(x - BASIN_C.x, z - BASIN_C.z) < BASIN_R - 4 && z > 196;
export const inChoir = (x: number, z: number) => Math.hypot(x - CHOIR_C.x, z - CHOIR_C.z) < 24;

export class Farlands {
  npcs: Npc[] = [];
  ines: Npc;
  teo: Npc;
  myBand: THREE.Mesh;
  private scene: THREE.Scene;
  private world: World;
  private settleFire!: Fire;
  private settleLight: THREE.PointLight;
  private debris: THREE.InstancedMesh;
  private debrisData: { p: THREE.Vector3; s: number; r: THREE.Euler; spin: number; bob: number }[] = [];
  private relics: { g: THREE.Object3D; base: THREE.Vector3; spin: number }[] = [];
  private figures: Humanoid[] = [];
  private pitStones: THREE.Group;
  private pitFire!: Fire;
  private ghost!: Humanoid;
  private barricade: THREE.Group;
  private gateCollider: { x: number; z: number; r: number }[];
  private lamps: THREE.Sprite[] = [];
  live = false;
  private trail: THREE.Vector3[] = [];
  private trailYaw: number[] = [];
  private trailT = 0;
  ghostOn = false;
  choirSpeaking = 0;

  constructor(scene: THREE.Scene, world: World, look: Look | null) {
    this.scene = scene;
    this.world = world;
    // ---------------------------------------------------------------- settlement
    const S = SETTLEMENT;
    const wood = std(0x3a2a1e);
    const darkWood = std(0x241a12);
    // palisade: sharpened logs in a ring, gate facing east toward the Fallsite
    const logs: THREE.Vector3[] = [];
    for (let i = 0; i < 64; i++) {
      const a = (i / 64) * Math.PI * 2;
      if (Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 0.22) continue; // gate (+x)
      logs.push(new THREE.Vector3(S.x + Math.cos(a) * 17, 0, S.z + Math.sin(a) * 17));
    }
    const logGeo = new THREE.CylinderGeometry(0.16, 0.2, 3.4, 7);
    logGeo.translate(0, 1.7, 0);
    const tipGeo = new THREE.ConeGeometry(0.16, 0.5, 7);
    tipGeo.translate(0, 3.65, 0);
    const pal = new THREE.InstancedMesh(logGeo, wood, logs.length);
    const tips = new THREE.InstancedMesh(tipGeo, darkWood, logs.length);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    logs.forEach((p, i) => {
      const h = 0.85 + ((i * 37) % 10) / 30;
      q.setFromEuler(new THREE.Euler(Math.sin(i * 3.1) * 0.05, 0, Math.cos(i * 2.3) * 0.05));
      m.compose(new THREE.Vector3(p.x, heightAt(p.x, p.z) - 0.2, p.z), q, new THREE.Vector3(1, h, 1));
      pal.setMatrixAt(i, m);
      tips.setMatrixAt(i, m);
      world.colliders.push({ x: p.x, z: p.z, r: 0.45 });
    });
    pal.castShadow = true;
    scene.add(pal, tips);
    // lean-tos built from salvage: boards and plane panels
    const panel = std(0xa4abb3, { metalness: 0.5, roughness: 0.5 });
    for (const [ang, metal] of [[1.1, false], [2.3, true], [3.6, false], [4.9, true]] as const) {
      const g = new THREE.Group();
      const roof = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.08, 2.6), metal ? panel : wood);
      roof.position.set(0, 1.35, 0);
      roof.rotation.x = 0.55;
      g.add(roof);
      for (const x of [-1.5, 1.5]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 2.2, 6), darkWood);
        post.position.set(x, 1.1, -0.9);
        g.add(post);
      }
      const roll = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 1.4, 4, 8), std(0x5a4f3e));
      roll.rotation.z = Math.PI / 2;
      roll.position.set(0, 0.22, 0.2);
      g.add(roll);
      const x = S.x + Math.cos(ang) * 11;
      const z = S.z + Math.sin(ang) * 11;
      g.position.copy(at(x, z));
      g.rotation.y = Math.atan2(S.x - x, S.z - z);
      g.traverse((o) => ((o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).castShadow = true) : 0));
      scene.add(g);
      world.colliders.push({ x, z, r: 1.6 });
    }
    // an old hospital bed frame, an IV stand: they brought what they could
    const steel = std(0x8d939a, { metalness: 0.6, roughness: 0.45 });
    const bed = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 2), steel);
    frame.position.y = 0.55;
    bed.add(frame);
    for (const [x, z] of [[-0.4, -0.9], [0.4, -0.9], [-0.4, 0.9], [0.4, 0.9]]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.55, 5), steel);
      l.position.set(x, 0.27, z);
      bed.add(l);
    }
    bed.position.copy(at(S.x + 4, S.z - 8));
    bed.rotation.y = 0.7;
    scene.add(bed);
    // the fire
    this.settleFire = new Fire({ size: 1.1, smoke: 1, logs: true, stones: true, light: 22, lightRange: 30 });
    this.settleFire.group.position.copy(SETTLE_FIRE);
    scene.add(this.settleFire.group);
    this.settleLight = this.settleFire.light!;
    world.colliders.push({ x: SETTLE_FIRE.x, z: SETTLE_FIRE.z, r: 1.1 });
    // the wall of wristbands: how they stop being numbers
    const board = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.1, 0.12), wood);
    const wallYaw = Math.atan2(S.x - WALL_POS.x, S.z - WALL_POS.z);
    const wall = new THREE.Group();
    board.position.y = 1.5;
    wall.add(board);
    for (const x of [-1.7, 1.7]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, 2.7, 6), darkWood);
      post.position.set(x, 1.35, -0.08);
      wall.add(post);
    }
    const bandGeo = new THREE.BoxGeometry(0.11, 0.03, 0.02);
    const bands = new THREE.InstancedMesh(bandGeo, std(0xffffff, { roughness: 0.5 }), 26 * 15);
    const r = rng(404);
    let n = 0;
    for (let row = 0; row < 15; row++)
      for (let col = 0; col < 26; col++) {
        q.setFromEuler(new THREE.Euler(0, 0, (r() - 0.5) * 0.5));
        m.compose(new THREE.Vector3(-1.62 + col * 0.13, 0.62 + row * 0.12, 0.07), q, new THREE.Vector3(1, 1, 1));
        bands.setMatrixAt(n, m);
        bands.setColorAt(n++, new THREE.Color(r() < 0.75 ? 0xe8ecef : r() < 0.6 ? 0x9ec6df : 0xdcd6c4));
      }
    bands.position.y = 0.1;
    wall.add(bands);
    this.myBand = new THREE.Mesh(bandGeo, std(0xc9b26a, { roughness: 0.6, emissive: 0x3a2a00, emissiveIntensity: 0.4 }));
    this.myBand.position.set(1.14, 1.98, 0.08);
    this.myBand.rotation.z = 0.2;
    wall.add(this.myBand);
    wall.position.copy(WALL_POS);
    wall.rotation.y = wallYaw;
    scene.add(wall);
    world.colliders.push({ x: WALL_POS.x, z: WALL_POS.z, r: 1.4 });

    // the Changed
    const npc = (id: SpeakerId | "", h: Humanoid, x: number, z: number, faceFire = true, sit = false) => {
      const pos = at(x, z);
      const yaw = faceFire ? Math.atan2(S.x - x, S.z - z) : 0;
      h.root.position.copy(pos);
      h.root.rotation.y = yaw;
      if (sit && h instanceof Person) h.setBase("sit", 1, 0);
      else if (sit) {
        h.legL.rotation.x = h.legR.rotation.x = -1.45;
        h.body.position.y = 0.5;
      }
      scene.add(h.root);
      world.colliders.push({ x, z, r: 0.5 });
      const o: Npc = { id, h, pos, yaw, sit, talk: 0 };
      this.npcs.push(o);
      return o;
    };
    this.ines = npc("INES", buildChanged({ cloth: 0x3d4a52, skin: 0x8d6a52, pants: 0x2b2a28, hair: 0x1b1714, wrap: 0x6a5a48 }), S.x + 2.2, S.z + 1.6);
    this.teo = npc("TEO", buildChanged({ cloth: 0x4a3b2c, skin: 0x6e5444, pants: 0x2a231c, hair: 0x9a958c, wrap: 0x3a3430 }), S.x - 1.9, S.z - 1.4, true, true);
    npc("", buildChanged({ cloth: 0x2f3530, skin: 0x9a7a62, pants: 0x232320, hair: 0x3a2a1e }), S.x + 15, S.z + 4, false).h.root.rotation.y = Math.PI / 2;
    npc("", buildChanged({ cloth: 0x4a3e3a, skin: 0x5e4436, pants: 0x262220 }), S.x - 5, S.z + 3.5, true, true);
    // a pale glow by the gate: lanterns from the plane's emergency kits
    const lampList: THREE.Sprite[] = [];
    for (const dz of [-2.2, 2.2]) {
      const lamp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb060, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending }));
      lamp.position.copy(at(S.x + 17.5, S.z + dz, 2.6));
      lamp.scale.setScalar(1.2);
      scene.add(lamp);
      lampList.push(lamp);
    }

    // ---------------------------------------------------------------- the Rift Basin
    const rr = rng(1717);
    const rockGeo = new THREE.DodecahedronGeometry(1, 0);
    const N = 54;
    this.debris = new THREE.InstancedMesh(rockGeo, std(0x2a3236, { flatShading: true, roughness: 0.9 }), N);
    for (let i = 0; i < N; i++) {
      const a = rr() * Math.PI * 2;
      const d = 8 + rr() * (BASIN_R - 14);
      const x = BASIN_C.x + Math.cos(a) * d;
      const z = BASIN_C.z + Math.sin(a) * d;
      this.debrisData.push({ p: at(x, z, 3 + rr() * 22), s: 0.4 + rr() * rr() * 3.6, r: new THREE.Euler(rr() * 6, rr() * 6, rr() * 6), spin: (rr() - 0.5) * 0.4, bob: rr() * 6 });
    }
    this.debris.castShadow = true;
    scene.add(this.debris);
    // what the rift took: hospital beds, a wheelchair, seats, suitcases
    const white = std(0xd8dde0, { roughness: 0.6 });
    const relic = (make: () => THREE.Object3D, x: number, z: number, h: number) => {
      const g = make();
      const base = at(x, z, h);
      g.position.copy(base);
      g.rotation.set(rr() * 2, rr() * 6, rr() * 2);
      scene.add(g);
      this.relics.push({ g, base, spin: (rr() - 0.5) * 0.3 });
    };
    const hospitalBed = () => {
      const g = new THREE.Group();
      const top = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 2), white);
      g.add(top);
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.06), steel);
      head.position.set(0, 0.3, -1);
      g.add(head);
      return g;
    };
    const seats = () => {
      const g = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.5), std(0x2c3550));
        s.position.x = i * 0.55;
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.1), std(0x2c3550));
        b.position.set(i * 0.55, 0.35, -0.25);
        g.add(s, b);
      }
      return g;
    };
    const suitcase = () => new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.22), std([0x5a3a2a, 0x2a2f3a, 0x6a1f1f][Math.floor(rr() * 3)]));
    const wheel = () => {
      const g = new THREE.Group();
      const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), std(0x1d1f22));
      g.add(seat);
      for (const x of [-0.3, 0.3]) {
        const w = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.025, 6, 16), steel);
        w.position.x = x;
        w.rotation.y = Math.PI / 2;
        g.add(w);
      }
      return g;
    };
    relic(hospitalBed, -14, 236, 6);
    relic(hospitalBed, 22, 270, 11);
    relic(hospitalBed, -26, 288, 4);
    relic(seats, 10, 226, 8);
    relic(seats, -8, 278, 15);
    relic(wheel, 30, 244, 5);
    relic(suitcase, -20, 252, 3);
    relic(suitcase, 4, 248, 9);
    relic(suitcase, 16, 292, 6);
    // cracks in the ground with the rift showing through
    const crackMat = new THREE.MeshBasicMaterial({ color: 0x5fe8ff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (let i = 0; i < 34; i++) {
      const a = rr() * Math.PI * 2;
      const d = 6 + rr() * (BASIN_R - 10);
      const x = BASIN_C.x + Math.cos(a) * d;
      const z = BASIN_C.z + Math.sin(a) * d;
      const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.18 + rr() * 0.25, 3 + rr() * 8), crackMat);
      crack.rotation.set(-Math.PI / 2, 0, rr() * Math.PI);
      crack.position.copy(at(x, z, 0.06));
      scene.add(crack);
    }
    // the white column over the Choir: visible from the stone circle
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(5, 7, 260, 24, 1, true),
      // faint, and thinning as it climbs: from the crash it is a pale thread you squint at
      new THREE.MeshBasicMaterial({ color: 0xdfeef2, transparent: true, opacity: 0.045, alphaMap: beamFade(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide }),
    );
    column.position.copy(at(CHOIR_C.x, CHOIR_C.z, 128));
    scene.add(column);
    const core = new THREE.Mesh(column.geometry, (column.material as THREE.MeshBasicMaterial).clone());
    (core.material as THREE.MeshBasicMaterial).opacity = 0.1;
    core.scale.set(0.25, 1, 0.25);
    core.position.copy(column.position);
    scene.add(core);

    // ---------------------------------------------------------------- the Choir
    this.dressAs(look);
    // the world, repeated in white: the ambulance, the fuselage, the stretcher, the mast
    const dup = std(0xe9eef0, { emissive: 0x8a9a9e, emissiveIntensity: 0.35, roughness: 0.7 });
    const place = (o: THREE.Object3D, ang: number, d: number, yaw: number) => {
      o.position.copy(at(CHOIR_C.x + Math.cos(ang) * d, CHOIR_C.z + Math.sin(ang) * d));
      o.rotation.y = yaw;
      scene.add(o);
    };
    const amb = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.BoxGeometry(2.7, 2.6, 6.5), dup);
    shell.position.y = 1.6;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.7, 1.9, 2), dup);
    cab.position.set(0, 1.25, -4.25);
    amb.add(shell, cab);
    place(amb, 2.2, 21, 0.4);
    const fus = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 10, 18, 1, true), dup);
    (fus.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    fus.rotation.z = Math.PI / 2;
    const fg = new THREE.Group();
    fus.position.y = 1.6;
    fg.add(fus);
    place(fg, 4.1, 22, 1.2);
    const mast = new THREE.Mesh(new THREE.BoxGeometry(1.2, 18, 1.2), dup);
    mast.position.y = 9;
    const mg = new THREE.Group();
    mg.add(mast);
    mg.rotation.z = 0.12;
    place(mg, 5.4, 24, 0);
    const stretcher = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 2), dup);
    stretcher.position.y = 0.45;
    const sg = new THREE.Group();
    sg.add(stretcher);
    place(sg, 0.8, 19, 2);
    // the pit, not yet built; the case, white, waiting
    this.pitStones = new THREE.Group();
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * Math.PI * 2;
      const st = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), std(0x9aa0a2, { flatShading: true }));
      st.position.set(Math.cos(a) * 0.82, 0.08, Math.sin(a) * 0.82);
      st.scale.y = 0.7;
      this.pitStones.add(st);
    }
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 1.3, 6), std(0x6e6a64));
      l.rotation.z = Math.PI / 2 - 0.35;
      l.rotation.y = (i / 4) * Math.PI;
      l.position.y = 0.3;
      this.pitStones.add(l);
    }
    this.pitFire = new Fire({ size: 1, smoke: 1, light: 6, lightRange: 12, onWhite: true });
    this.pitFire.lit = false;
    this.pitStones.add(this.pitFire.group);
    this.pitStones.position.copy(CHOIR_PIT);
    this.pitStones.visible = false;
    scene.add(this.pitStones);
    const cs = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.2, 0.44), dup);
    cs.position.copy(CHOIR_CASE).add(new THREE.Vector3(0, 0.1, 0));
    cs.rotation.y = -0.5;
    scene.add(cs);

    // the gate is barred until someone opens it for you (Chapter Five)
    this.barricade = new THREE.Group();
    for (let i = 0; i < 4; i++) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.19, 5, 7), darkWood);
      l.rotation.x = Math.PI / 2;
      l.position.set(0, 0.5 + i * 0.6, 0);
      this.barricade.add(l);
    }
    this.barricade.position.copy(at(S.x + 17, S.z));
    scene.add(this.barricade);
    this.gateCollider = [
      { x: S.x + 17, z: S.z - 1.6, r: 1 },
      { x: S.x + 17, z: S.z, r: 1 },
      { x: S.x + 17, z: S.z + 1.6, r: 1 },
    ];
    this.lamps = lampList;
    this.setLive(false);
  }

  /** The Choir wears your clothes; so does your echo. */
  dressAs(look: Look | null) {
    for (const f of this.figures) this.scene.remove(f.root);
    this.figures = [];
    if (this.ghost) this.scene.remove(this.ghost.root);
    const choirMat = new THREE.MeshBasicMaterial({ color: 0xf4f8f9, transparent: true, opacity: 0.88 });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      const h = buildPlayerModel(look ?? DEFAULT_LOOK);
      h.root.traverse((o) => {
        const mm = o as THREE.Mesh;
        if (mm.isMesh) mm.material = choirMat;
      });
      const x = CHOIR_C.x + Math.cos(a) * 11;
      const z = CHOIR_C.z + Math.sin(a) * 11;
      h.root.position.copy(at(x, z));
      h.root.rotation.y = Math.atan2(CHOIR_C.x - x, CHOIR_C.z - z);
      h.head.rotation.x = 0.35;
      if (h instanceof Person) {
        h.lookPitch = 0.35;
        h.setBase("idle", 0.3, 0);
      }
      this.scene.add(h.root);
      this.figures.push(h);
    }
    // your echo in the Basin: where you were a few seconds ago
    this.ghost = buildPlayerModel(look ?? DEFAULT_LOOK);
    const gm = new THREE.MeshBasicMaterial({ color: 0xbff2ff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false });
    this.ghost.root.traverse((o) => {
      const mm = o as THREE.Mesh;
      if (mm.isMesh) {
        mm.material = gm;
        mm.castShadow = false;
      }
    });
    this.ghost.root.visible = false;
    this.scene.add(this.ghost.root);
  }

  /** Before Chapter Five the settlement is shut, cold and empty. */
  setLive(on: boolean) {
    this.live = on;
    for (const n of this.npcs) n.h.root.visible = on;
    this.settleFire.lit = on;
    for (const l of this.lamps) l.visible = on;
    this.barricade.visible = !on;
    const cols = this.world.colliders;
    for (const c of this.gateCollider) {
      const i = cols.indexOf(c);
      if (on && i >= 0) cols.splice(i, 1);
      if (!on && i < 0) cols.push(c);
    }
    const fi = this.world.otherFires.indexOf(SETTLE_FIRE);
    if (on && fi < 0) this.world.otherFires.push(SETTLE_FIRE);
    if (!on && fi >= 0) this.world.otherFires.splice(fi, 1);
  }

  /** Your band, new and white, nailed up next to the old yellow one. */
  leaveBand() {
    const b = this.myBand.clone();
    b.material = new THREE.MeshStandardMaterial({ color: 0xf2f4f5, roughness: 0.5 });
    b.position.x -= 0.14;
    b.rotation.z = -0.15;
    this.myBand.parent!.add(b);
  }

  /** Put Ines somewhere (the stone circle, for the meeting) or home. */
  placeInes(p: THREE.Vector3 | null, faceTo?: THREE.Vector3) {
    const n = this.ines;
    const pos = p ?? at(SETTLEMENT.x + 2.2, SETTLEMENT.z + 1.6);
    n.pos.copy(pos).setY(heightAt(pos.x, pos.z));
    n.h.root.position.copy(n.pos);
    const f = faceTo ?? SETTLE_FIRE;
    n.yaw = Math.atan2(f.x - pos.x, f.z - pos.z);
    n.h.root.rotation.y = n.yaw;
  }

  buildPit() {
    this.pitStones.visible = true;
  }
  lightPit() {
    this.pitFire.lit = true;
    this.world.otherFires.push(CHOIR_PIT);
  }

  /** A line was spoken: the speaker gestures; the Choir lifts its heads. */
  onLine(id: SpeakerId) {
    for (const n of this.npcs) n.talk = n.id === id ? 3 : 0;
    if (id === "CHOIR") this.choirSpeaking = 4;
  }

  update(dt: number, t: number, player: { pos: THREE.Vector3; yaw: number; gravityMul: number }) {
    const p = player.pos;
    // the Changed: breathe, look at you when you're close, talk with their hands
    for (const n of this.npcs) {
      const d = Math.hypot(p.x - n.pos.x, p.z - n.pos.z);
      if (d > 60) continue;
      n.talk = Math.max(0, n.talk - dt);
      if (n.h instanceof Person) {
        const look = d < 9 ? Math.atan2(p.x - n.pos.x, p.z - n.pos.z) - n.yaw : 0;
        n.h.lookYaw = THREE.MathUtils.clamp(Math.atan2(Math.sin(look), Math.cos(look)), -1, 1) * 0.8;
        n.h.setBase(n.talk > 0 ? (n.sit ? "sitTalk" : "talk") : n.sit ? "sit" : "idle", 1, 0.4);
        continue;
      }
      n.h.body.position.y = (n.sit ? 0.5 : 0.95) + Math.sin(t * 1.6 + n.pos.x) * 0.006;
      const look = d < 9 ? Math.atan2(p.x - n.pos.x, p.z - n.pos.z) - n.yaw : 0;
      const la = Math.atan2(Math.sin(look), Math.cos(look));
      n.h.head.rotation.y += (THREE.MathUtils.clamp(la, -1, 1) - n.h.head.rotation.y) * Math.min(1, dt * 4);
      n.h.armR.rotation.x = n.talk > 0 ? -0.4 + Math.sin(t * 6) * 0.25 : n.sit ? -0.6 : 0;
      n.h.armL.rotation.x = n.sit ? -0.6 : 0;
    }
    // settlement fire: only burns while there's someone to tend it
    this.settleFire.lit = this.live;
    // basin: drifting debris and relics (cheap enough to always run)
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    this.debrisData.forEach((d, i) => {
      d.r.y += d.spin * dt;
      d.r.x += d.spin * 0.5 * dt;
      q.setFromEuler(d.r);
      m.compose(new THREE.Vector3(d.p.x, d.p.y + Math.sin(t * 0.4 + d.bob) * 0.8, d.p.z), q, new THREE.Vector3(d.s, d.s * 0.8, d.s));
      this.debris.setMatrixAt(i, m);
    });
    this.debris.instanceMatrix.needsUpdate = true;
    for (const r of this.relics) {
      r.g.rotation.y += r.spin * dt;
      r.g.position.y = r.base.y + Math.sin(t * 0.3 + r.base.x) * 1.2;
    }
    // the Choir: still, until it speaks
    this.choirSpeaking = Math.max(0, this.choirSpeaking - dt);
    for (const [i, f] of this.figures.entries()) {
      const k = this.choirSpeaking > 0 ? 1 : 0;
      if (f instanceof Person) f.lookPitch = k ? -0.15 : 0.35;
      else f.head.rotation.x += ((k ? -0.15 : 0.35) - f.head.rotation.x) * Math.min(1, dt * 2);
      f.body.position.y = 0.95 + Math.sin(t * 0.8 + i) * 0.01;
    }

    // zones: weather, gravity, your echo
    const basin = inBasin(p.x, p.z);
    const choir = inChoir(p.x, p.z);
    this.world.zoneMood = choir ? "choir" : basin ? "basin" : null;
    player.gravityMul = basin && !choir ? 0.42 : 1;
    this.trailT -= dt;
    if (this.trailT <= 0) {
      this.trailT = 0.1;
      this.trail.push(p.clone());
      this.trailYaw.push(player.yaw);
      if (this.trail.length > 32) {
        this.trail.shift();
        this.trailYaw.shift();
      }
    }
    const g = this.ghost.root;
    g.visible = this.ghostOn && basin && !choir && this.trail.length >= 30 && this.trail[0].distanceTo(p) > 1.5;
    if (g.visible) {
      g.position.copy(this.trail[0]);
      g.rotation.y = this.trailYaw[0];
      const s = Math.sin(t * 6) * 0.5;
      if (this.ghost instanceof Person) this.ghost.setBase("walk", 1, 0.2);
      this.ghost.legL.rotation.x = s;
      this.ghost.legR.rotation.x = -s;
    }
  }
}
