// On-screen cinematics: the medevac flight. A stage built high above the world
// (it's at altitude, so the real sky shows through the windshield) with the
// cockpit, the cabin, and the people in them: Captain Okafor, First Officer
// Reyes, Rhea Vance, and the patient on the stretcher, wearing the player's own
// look. Actors animate when their lines play.

import * as THREE from "three";
import { type CamKey, key } from "./cinematic";
import { buildPlayerModel, type Humanoid, type Look } from "./models";
import type { SpeakerId } from "./voice";
import { glowTexture, type World } from "./world";

/** Where the stage sits in the world: high above the forest, under the moons. */
export const SET = new THREE.Vector3(0, 260, -320);
/** The exterior plane flies alongside the stage. */
const EXT = new THREE.Vector3(60, 262, -320);

const LOOKS: Record<"PILOT" | "DEZ" | "RHEA", Look> = {
  PILOT: { build: 2, skin: 5, hair: 1, hairColor: 5, top: 1, topColor: 1, pants: 3, extra: 6 },
  DEZ: { build: 0, skin: 2, hair: 3, hairColor: 0, top: 3, topColor: 2, pants: 0, extra: 6 },
  RHEA: { build: 0, skin: 1, hair: 4, hairColor: 3, top: 2, topColor: 5, pants: 0, extra: 0 },
};

interface Actor {
  m: Humanoid;
  talk: number;
  pose: "sit" | "stand";
  toward: number; // head turn toward the person they talk to
}

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

let active: PlaneSet | null = null;
/** Called for every spoken line: the speaker animates. */
export function castLine(id: SpeakerId) {
  active?.onLine(id);
}

export class PlaneSet {
  group = new THREE.Group();
  private scene: THREE.Scene;
  private world: World;
  private actors: Partial<Record<SpeakerId, Actor>> = {};
  private patient: Humanoid;
  private lights: { cabin: THREE.PointLight[]; alarm: THREE.PointLight[]; flood: THREE.PointLight; cockpit: THREE.PointLight };
  private windows: THREE.MeshBasicMaterial;
  private ecg: { tex: THREE.CanvasTexture; hrCanvas: HTMLCanvasElement; hrTex: THREE.CanvasTexture };
  private clouds: THREE.Sprite[] = [];
  private rift: THREE.Mesh;
  private riftMat: THREE.ShaderMaterial;
  private alarm = false;
  shaking = 0;
  private riftK = 0;
  private riftTarget = 0;
  private floodK = 0;
  private flooding = false;
  private hr = 72;
  private beatT = 0;
  private navT = 0;
  private navLights: THREE.Sprite[] = [];
  onBeat?: () => void;

  constructor(scene: THREE.Scene, world: World, patientLook: Look) {
    this.scene = scene;
    this.world = world;
    const g = this.group;
    g.position.copy(SET);

    // ---------- shell
    const hull = std(0xb7bbbe, { side: THREE.BackSide });
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(1.55, 1.55, 13.5, 28, 1, true), hull);
    tube.rotation.x = Math.PI / 2;
    tube.position.z = 0.6;
    g.add(tube);
    const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      b.position.set(x, y, z);
      g.add(b);
      return b;
    };
    box(2.5, 0.08, 13.4, std(0x3d4246), 0, -1.05, 0.6); // floor
    const panel = std(0x8d9296);
    box(1.1, 2.7, 0.06, panel, -0.92, 0.2, 5.4); // bulkhead with a door gap
    box(1.1, 2.7, 0.06, panel, 0.92, 0.2, 5.4);
    box(0.8, 0.5, 0.06, panel, 0, 1.3, 5.4);
    const strip = std(0x222222, { emissive: 0xdce7ff, emissiveIntensity: 1.1 });
    for (let z = -5; z <= 4; z += 1.5) box(0.5, 0.03, 0.9, strip, 0, 1.43, z);

    // windows down both sides
    this.windows = new THREE.MeshBasicMaterial({ color: 0x0c1526 });
    for (let z = -4.5; z <= 4.5; z += 1.5) {
      for (const x of [-1, 1]) {
        const w = new THREE.Mesh(new THREE.CircleGeometry(0.14, 24), this.windows);
        w.position.set(x * 1.44, 0.3, z);
        w.rotation.y = -x * Math.PI / 2;
        g.add(w);
      }
    }

    // ---------- cockpit
    const dark = std(0x24272b);
    box(0.08, 2.6, 1.3, dark, -1.5, 0.2, 7.95);
    box(0.08, 2.6, 1.3, dark, 1.5, 0.2, 7.95);
    box(3.1, 0.75, 0.1, dark, 0, 1.4, 8.5);
    box(3.1, 1.15, 0.1, dark, 0, -0.55, 8.5);
    const glass = new THREE.Mesh(
      new THREE.PlaneGeometry(2.9, 0.95),
      new THREE.MeshStandardMaterial({ color: 0x8fb4d0, transparent: true, opacity: 0.1, roughness: 0.05, metalness: 0.6, side: THREE.DoubleSide }),
    );
    glass.position.set(0, 0.55, 8.5);
    g.add(glass);
    box(0.05, 0.95, 0.06, dark, 0, 0.55, 8.48); // centre pillar
    box(2.5, 0.35, 0.65, std(0x1b1d20), 0, -0.1, 7.9); // glareshield / console
    const screenCols = [0x2bd17b, 0xe0a33a, 0x2bd17b, 0x5fa8ff];
    screenCols.forEach((c, i) => {
      const s = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.22), new THREE.MeshStandardMaterial({ color: 0x050505, emissive: c, emissiveIntensity: 0.9 }));
      s.position.set(-0.9 + i * 0.6, 0.09, 7.57);
      s.rotation.set(0.25, Math.PI, 0); // faces back at the pilots, tilted up
      g.add(s);
    });
    box(1.4, 0.08, 0.6, std(0x1b1d20, { emissive: 0x3a2a14, emissiveIntensity: 0.4 }), 0, 1.3, 7.4); // overhead panel
    for (const x of [-0.5, 0.5]) {
      box(0.52, 0.12, 0.5, std(0x2e3236), x, -0.52, 6.85); // seat
      box(0.52, 0.95, 0.1, std(0x2e3236), x, -0.02, 6.55);
      box(0.06, 0.4, 0.06, dark, x, -0.35, 7.42); // yoke column
      box(0.3, 0.05, 0.04, dark, x, -0.12, 7.38);
    }

    // ---------- cabin: stretcher, patient, monitor, IV
    const metal = std(0x9a9ea3, { metalness: 0.6, roughness: 0.4 });
    box(0.64, 0.07, 2.05, metal, 0.4, -0.35, 0.2);
    box(0.6, 0.07, 1.98, std(0xe8eaec), 0.4, -0.28, 0.2);
    for (const [x, z] of [[0.15, -0.7], [0.65, -0.7], [0.15, 1.1], [0.65, 1.1]]) box(0.04, 0.65, 0.04, metal, x, -0.7, z);
    this.patient = buildPlayerModel(patientLook);
    this.patient.root.rotation.x = -Math.PI / 2;
    this.patient.root.position.set(0.4, -0.09, 1.12);
    this.patient.head.rotation.y = 0.25; // head turned slightly toward Rhea
    g.add(this.patient.root);
    box(0.62, 0.06, 0.75, std(0x7f9fb8), 0.4, 0.05, 0.75); // blanket over the legs
    for (const z of [0.0, 0.9]) box(0.66, 0.02, 0.06, std(0x1d1f22), 0.4, 0.09, z); // straps
    box(0.03, 1.7, 0.03, metal, -0.05, -0.2, -0.85); // IV pole
    box(0.14, 0.2, 0.05, new THREE.MeshStandardMaterial({ color: 0xcfe6ef, transparent: true, opacity: 0.6 }), -0.05, 0.6, -0.85);

    // heart monitor with a scrolling trace
    box(0.06, 0.42, 0.6, std(0x1d1f22), 1.32, 0.35, -0.35);
    const ecgCanvas = document.createElement("canvas");
    ecgCanvas.width = 256;
    ecgCanvas.height = 96;
    const c = ecgCanvas.getContext("2d")!;
    c.fillStyle = "#020a04";
    c.fillRect(0, 0, 256, 96);
    c.strokeStyle = "#39ff8a";
    c.lineWidth = 3;
    c.beginPath();
    for (let x = 0; x <= 256; x++) {
      const p = x % 128;
      const y = p > 40 && p < 44 ? 48 - (p - 40) * 9 : p >= 44 && p < 50 ? 12 + (p - 44) * 12 : p >= 50 && p < 54 ? 84 - (p - 50) * 9 : 48 + Math.sin(x * 0.2) * 1.5;
      x === 0 ? c.moveTo(x, y) : c.lineTo(x, y);
    }
    c.stroke();
    const tex = new THREE.CanvasTexture(ecgCanvas);
    tex.wrapS = THREE.RepeatWrapping;
    const trace = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.2), new THREE.MeshBasicMaterial({ map: tex }));
    trace.position.set(1.285, 0.42, -0.4);
    trace.rotation.y = -Math.PI / 2;
    g.add(trace);
    const hrCanvas = document.createElement("canvas");
    hrCanvas.width = 128;
    hrCanvas.height = 64;
    const hrTex = new THREE.CanvasTexture(hrCanvas);
    const hrPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.08), new THREE.MeshBasicMaterial({ map: hrTex, transparent: true }));
    hrPlane.position.set(1.285, 0.42, -0.1);
    hrPlane.rotation.y = -Math.PI / 2;
    g.add(hrPlane);
    this.ecg = { tex, hrCanvas, hrTex };
    this.drawHr();

    // ---------- people
    const make = (id: "PILOT" | "DEZ" | "RHEA", pose: Actor["pose"]) => {
      const m = buildPlayerModel(LOOKS[id]);
      g.add(m.root);
      const a: Actor = { m, talk: 0, pose, toward: 0 };
      this.actors[id] = a;
      return a;
    };
    const ok = make("PILOT", "sit");
    ok.m.root.position.set(0.5, -1.4, 6.85);
    ok.toward = -0.45;
    // Okafor's beard
    const beard = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.4), std(0x9a9590, { roughness: 1 }));
    beard.position.set(0, -0.02, 0.025);
    ok.m.head.add(beard);
    const dez = make("DEZ", "sit");
    dez.m.root.position.set(-0.5, -1.4, 6.85);
    dez.toward = 0.45;
    const rhea = make("RHEA", "stand");
    rhea.m.root.position.set(-0.42, -1.05, 0.15);
    rhea.m.root.rotation.y = Math.PI / 2;
    this.group.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (mesh.isMesh) mesh.castShadow = false;
    });

    // ---------- light
    const cabin = [new THREE.PointLight(0xdfe8ff, 5, 9, 1.5), new THREE.PointLight(0xdfe8ff, 3.5, 8, 1.5)];
    cabin[0].position.set(0, 1.1, 0.4);
    cabin[1].position.set(0, 1.1, -3.5);
    const cockpit = new THREE.PointLight(0x9fc7ff, 1.6, 4, 1.5);
    cockpit.position.set(0, 0.6, 7.3);
    const alarm = [new THREE.PointLight(0xff2a1a, 0, 7, 1.5), new THREE.PointLight(0xff2a1a, 0, 5, 1.5)];
    alarm[0].position.set(0, 1.2, 0.8);
    alarm[1].position.set(0, 1.0, 6.9);
    const flood = new THREE.PointLight(0xffffff, 0, 30, 1);
    flood.position.set(0, 0.5, 9.5);
    g.add(...cabin, cockpit, ...alarm, flood);
    this.lights = { cabin, alarm, flood, cockpit };

    // ---------- the light ahead
    this.riftMat = (world.skyTearMat as THREE.ShaderMaterial).clone();
    this.riftMat.uniforms = { uTime: { value: 0 }, uOpen: { value: 0 } };
    this.rift = new THREE.Mesh(new THREE.CircleGeometry(30, 64), this.riftMat);
    this.rift.position.copy(SET).add(new THREE.Vector3(0, 25, 420));
    this.rift.lookAt(SET);
    this.rift.scale.setScalar(0.01);
    scene.add(this.rift);

    // ---------- clouds streaming past
    const cloudMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x7d8799, transparent: true, opacity: 0.22, depthWrite: false, fog: false });
    for (let i = 0; i < 46; i++) {
      const s = new THREE.Sprite(cloudMat);
      const sc = 25 + Math.random() * 45;
      s.scale.set(sc * 1.8, sc, 1);
      s.position.set(SET.x - 70 + Math.random() * 190, SET.y - 35 + Math.random() * 45, SET.z - 200 + Math.random() * 500);
      scene.add(s);
      this.clouds.push(s);
    }

    // ---------- exterior plane, cruising (no fire yet), with nav lights
    const p = world.fallingPlane;
    p.position.copy(EXT);
    p.rotation.set(0, 0, 0);
    p.visible = true;
    world.planeTrail = false;
    for (const [x, col] of [[11, 0xff3030], [-11, 0x30ff60], [0, 0xffffff]] as const) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: col, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
      s.position.set(x, x === 0 ? 3.6 : 0.2, x === 0 ? -7 : 1);
      s.scale.setScalar(2.2);
      p.add(s);
      this.navLights.push(s);
    }

    scene.add(g);
    active = this;
  }

  // ------------------------------------------------------------------ cues
  cue(c: string) {
    switch (c) {
      case "alarm":
        this.alarm = true;
        break;
      case "rift":
        this.riftTarget = 1;
        break;
      case "shake":
        this.shaking = 1;
        break;
      case "flood":
        this.flooding = true;
        break;
      case "monitorFast":
        this.hr = 142;
        this.drawHr();
        break;
      case "monitorCalm":
        this.hr = 72;
        this.drawHr();
        break;
    }
  }

  /** Okafor alone at the stick, alarms, the light pouring in. */
  flashback() {
    const dez = this.actors.DEZ;
    if (dez) dez.m.root.visible = false;
    this.alarm = true;
    this.riftK = this.riftTarget = 0.85;
    this.shaking = 0.4;
    this.world.fallingPlane.visible = false;
  }

  onLine(id: SpeakerId) {
    for (const [k, a] of Object.entries(this.actors)) if (a) a.talk = k === id ? 6 : 0;
  }

  private drawHr() {
    const g = this.ecg.hrCanvas.getContext("2d")!;
    g.clearRect(0, 0, 128, 64);
    g.fillStyle = this.hr > 100 ? "#ff6a4a" : "#39ff8a";
    g.font = "bold 44px monospace";
    g.fillText(String(this.hr), 8, 48);
    this.ecg.hrTex.needsUpdate = true;
  }

  // ------------------------------------------------------------------ shots
  /** Named camera moves, in world space. */
  shot(id: string): { from: CamKey; to: CamKey; dur: number; track?: () => THREE.Vector3 } {
    const L = (x: number, y: number, z: number) => SET.clone().add(new THREE.Vector3(x, y, z));
    switch (id) {
      case "exterior": {
        const p = this.world.fallingPlane.position;
        return {
          from: key(p.clone().add(new THREE.Vector3(-26, 5, 30)), p.clone().add(new THREE.Vector3(0, 0, 4))),
          to: key(p.clone().add(new THREE.Vector3(-16, 2, -4)), p.clone().add(new THREE.Vector3(0, 0.5, 6))),
          dur: 9,
        };
      }
      case "cockpitWide":
        return { from: key(L(0.0, 1.05, 5.6), L(0, 0.2, 9.5)), to: key(L(0.0, 1.0, 6.05), L(0, 0.25, 9.5)), dur: 9 };
      case "cockpitFaces":
        return { from: key(L(0.12, 0.42, 8.25), L(0, 0.35, 6.7)), to: key(L(-0.08, 0.45, 8.2), L(0, 0.38, 6.7)), dur: 10 };
      case "okaforClose":
        return { from: key(L(-0.15, 0.48, 8.1), L(0.5, 0.42, 6.9)), to: key(L(-0.05, 0.46, 7.95), L(0.5, 0.42, 6.9)), dur: 8 };
      case "dezSeat":
        return { from: key(L(0.2, 0.45, 8.1), L(-0.5, 0.3, 6.85)), to: key(L(0.1, 0.42, 7.95), L(-0.5, 0.3, 6.85)), dur: 7 };
      case "cabinWide":
        return { from: key(L(-0.85, 0.85, 4.6), L(0.25, -0.2, -0.3)), to: key(L(-0.75, 0.8, 4.2), L(0.2, -0.2, -0.4)), dur: 9 };
      case "monitor":
        return { from: key(L(0.65, 0.42, 0.25), L(1.3, 0.4, -0.3)), to: key(L(0.75, 0.42, 0.05), L(1.3, 0.4, -0.3)), dur: 6 };
      case "rheaClose":
        return { from: key(L(0.95, 0.42, 1.35), L(-0.42, 0.62, 0.15)), to: key(L(0.85, 0.36, 1.05), L(-0.42, 0.6, 0.12)), dur: 10 };
      case "windshield":
        return { from: key(L(0.0, 0.62, 6.2), L(0, 1.6, 20)), to: key(L(0.0, 0.6, 7.0), L(0, 1.8, 20)), dur: 9 };
      case "cabinAlarm":
        return { from: key(L(-0.9, 0.95, 3.8), L(0.25, -0.25, -0.2)), to: key(L(-0.7, 0.75, 2.6), L(0.25, -0.25, -0.4)), dur: 8 };
      default:
        return { from: key(L(0, 0.7, 5), L(0, 0.4, 10)), to: key(L(0, 0.7, 5.5), L(0, 0.4, 10)), dur: 6 };
    }
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number, t: number, speaking: boolean) {
    // flight: clouds stream past, nav lights blink
    for (const s of this.clouds) {
      s.position.z -= dt * 70;
      if (s.position.z < SET.z - 200) s.position.z += 500;
    }
    this.navT += dt;
    const blink = this.navT % 1.2 < 0.12;
    for (const n of this.navLights) n.visible = n.position.x === 0 ? blink : true;
    const p = this.world.fallingPlane;
    if (p.visible && !this.world.planeTrail) {
      p.position.y = EXT.y + Math.sin(t * 0.8) * 0.4;
      p.rotation.z = Math.sin(t * 0.5) * 0.04;
    }

    // the light ahead
    this.riftK += (this.riftTarget - this.riftK) * Math.min(1, dt * 0.35);
    this.rift.scale.setScalar(0.01 + this.riftK * 1.2);
    this.riftMat.uniforms.uTime.value = t;
    this.riftMat.uniforms.uOpen.value = this.riftK;
    if (this.flooding) this.floodK = Math.min(1, this.floodK + dt * 0.35);
    this.lights.flood.intensity = this.riftK * 6 + this.floodK * 120;
    this.windows.color.setRGB(0.05 + this.floodK, 0.08 + this.floodK, 0.15 + this.floodK);

    // alarm lights and turbulence
    const on = this.alarm && Math.sin(t * 7) > 0;
    for (const a of this.lights.alarm) a.intensity = on ? 9 : 0.6 * (this.alarm ? 1 : 0);
    for (const c of this.lights.cabin) c.intensity = this.alarm ? (Math.random() < 0.05 ? 0 : 1.6) : c === this.lights.cabin[0] ? 5 : 3.5;
    const sh = this.shaking * (0.6 + Math.sin(t * 13) * 0.4);
    this.group.position.set(SET.x + (Math.random() - 0.5) * 0.05 * sh, SET.y + (Math.random() - 0.5) * 0.06 * sh, SET.z);

    // heart monitor
    this.ecg.tex.offset.x += dt * (this.hr / 60) * 0.5;
    this.beatT -= dt;
    if (this.beatT <= 0) {
      this.beatT = 60 / this.hr;
      this.onBeat?.();
    }

    // people
    for (const [id, a] of Object.entries(this.actors)) {
      if (!a) continue;
      if (!speaking) a.talk = 0;
      a.talk = Math.max(0, a.talk - dt);
      const m = a.m;
      const talking = a.talk > 0;
      const k = talking ? 1 : 0;
      m.body.position.y = (a.pose === "sit" ? 0.95 : 0.95) + Math.sin(t * 1.7 + m.root.position.x) * 0.004;
      if (a.pose === "sit") {
        m.legL.rotation.set(-1.45, 0, -0.06);
        m.legR.rotation.set(-1.45, 0, 0.06);
        m.armL.rotation.set(-1.15 + (this.alarm ? Math.sin(t * 9) * 0.08 : 0), 0, 0.15);
        m.armR.rotation.set(-1.15 + (this.alarm ? Math.sin(t * 8) * 0.08 : 0), 0, -0.15);
        // look at the other pilot while talking, otherwise out the windshield
        const someoneTalks = Object.values(this.actors).some((o) => o && o !== a && o.talk > 0 && o.pose === "sit");
        const turn = talking ? a.toward : someoneTalks ? a.toward * 0.6 : this.riftK > 0.3 ? 0 : Math.sin(t * 0.3 + a.toward) * 0.1;
        m.head.rotation.y += (turn - m.head.rotation.y) * Math.min(1, dt * 5);
      } else {
        // Rhea leans over the stretcher, one hand on the patient
        m.body.rotation.x = 0.28;
        m.armR.rotation.set(-0.95, 0, 0.1);
        m.armL.rotation.set(-0.55 - k * Math.sin(t * 3) * 0.25, 0, -0.1);
        m.legL.rotation.set(0, 0, 0);
        m.legR.rotation.set(0, 0, 0);
        m.head.rotation.y = id === "RHEA" ? 0.1 : 0;
      }
      m.head.rotation.x = k * (Math.sin(t * 11) * 0.05 + Math.sin(t * 4.3) * 0.04) + (a.pose === "stand" ? 0.25 : 0);
    }
  }

  dispose() {
    this.scene.remove(this.group, this.rift);
    for (const c of this.clouds) this.scene.remove(c);
    for (const n of this.navLights) this.world.fallingPlane.remove(n);
    this.world.fallingPlane.visible = false;
    this.world.planeTrail = true;
    if (active === this) active = null;
  }
}
