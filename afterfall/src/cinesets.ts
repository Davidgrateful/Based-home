// On-screen cinematics: the medevac flight. A stage built high above the world
// (it's at altitude, so the real sky shows through the glass) with the
// cockpit, the cabin, and the people in them: Captain Okafor, First Officer
// Reyes, Rhea Vance, and the patient on the stretcher, wearing the player's own
// face. Outside, the same jet flies over a moonlit sea of cloud.
//
// Group space: the cabin runs along +z toward the nose; the floor is at
// y = -1.05; the stretcher is on the left (+x) side.

import * as THREE from "three";
import { cloudSea, moonSky, puffTextures } from "./aircraft";
import { type CamKey, key } from "./cinematic";
import { accessorize, buildPlayerModel, DEFAULT_LOOK, type Look } from "./models";
import { Person } from "./people";
import type { SpeakerId } from "./voice";
import type { World } from "./world";

/** Where the stage sits in the world: high above the forest, under the moons. */
export const SET = new THREE.Vector3(0, 260, -320);
/** The exterior jet flies alongside the stage. */
const EXT = new THREE.Vector3(60, 262, -320);
const FLOOR = -1.05;

interface Actor {
  m: Person;
  talk: number;
  pose: "fly" | "stand";
  toward: number; // head turn toward the person they talk to
  /** seconds until the next small task (checking the line, the monitor) */
  busy?: number;
}

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

let active: PlaneSet | null = null;
/** Called for every spoken line: the speaker animates. */
export function castLine(id: SpeakerId) {
  active?.onLine(id);
}

// ------------------------------------------------------------------ textures
function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void, srgb = true) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Cream sidewall panels with seams, a grey dado below. u around, v along. */
function wallTexture() {
  return canvasTex(512, 512, (g) => {
    g.fillStyle = "#d9d5cc";
    g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 4000; i++) {
      g.fillStyle = `rgba(0,0,0,${Math.random() * 0.025})`;
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    // dado (lower wall) both sides: u 0..0.14 and 0.86..1
    g.fillStyle = "#5c6064";
    g.fillRect(0, 0, 512 * 0.13, 512);
    g.fillRect(512 * 0.87, 0, 512 * 0.13, 512);
    g.fillStyle = "#3a3d40";
    g.fillRect(512 * 0.13, 0, 4, 512);
    g.fillRect(512 * 0.87 - 4, 0, 4, 512);
    // panel seams along the cabin
    g.fillStyle = "rgba(60,58,52,0.35)";
    for (const y of [0, 256]) g.fillRect(0, y, 512, 3);
    // ceiling centre panel line
    g.fillRect(512 * 0.36, 0, 2, 512);
    g.fillRect(512 * 0.64, 0, 2, 512);
  });
}

/** Grey rubber floor with seat tracks and a non-slip pattern. */
function floorTexture() {
  return canvasTex(256, 256, (g) => {
    g.fillStyle = "#3b3e42";
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = "rgba(255,255,255,0.035)";
    for (let y = 0; y < 256; y += 8) for (let x = (y / 8) % 2 ? 4 : 0; x < 256; x += 8) g.fillRect(x, y, 3, 3);
    g.fillStyle = "#8d9196";
    for (const x of [40, 216]) {
      g.fillRect(x, 0, 6, 256);
      g.fillStyle = "#1c1d1f";
      for (let y = 4; y < 256; y += 16) g.fillRect(x + 1, y, 4, 6);
      g.fillStyle = "#8d9196";
    }
  });
}

// ------------------------------------------------------------------ geometry helpers
/** A smooth closed-ish profile swept along z: the inside skin of the hull.
 *  `prof` is half the cross-section (port side, floor edge to ceiling centre). */
function shell(prof: [number, number][], z0: number, z1: number, taper?: (z: number) => { sx: number; sy: number }) {
  const half = new THREE.CatmullRomCurve3(prof.map(([x, y]) => new THREE.Vector3(x, y, 0))).getPoints(22);
  const pts = [...half.map((p) => new THREE.Vector2(p.x, p.y))];
  for (let i = half.length - 2; i >= 0; i--) pts.push(new THREE.Vector2(-half[i].x, half[i].y));
  // u by arc length
  const len: number[] = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const total = len[len.length - 1];
  const nz = Math.max(2, Math.ceil((z1 - z0) / 0.5));
  const v: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];
  for (let j = 0; j <= nz; j++) {
    const z = z0 + ((z1 - z0) * j) / nz;
    const t = taper ? taper(z) : { sx: 1, sy: 1 };
    for (let i = 0; i < pts.length; i++) {
      v.push(pts[i].x * t.sx, FLOOR + (pts[i].y - FLOOR) * t.sy, z);
      uv.push(len[i] / total, z / 2.2);
    }
  }
  const n = pts.length;
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      idx.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** A rod between two points. */
function rod(a: THREE.Vector3, b: THREE.Vector3, r: number, m: THREE.Material) {
  const d = b.clone().sub(a);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), m);
  mesh.position.copy(a).addScaledVector(d, 0.5);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return mesh;
}

/** A rounded box (softer than a BoxGeometry, cheap). */
function soft(w: number, h: number, d: number, r: number, m: THREE.Material) {
  const shape = new THREE.Shape();
  const x = w / 2 - r;
  const y = h / 2 - r;
  shape.moveTo(-x, -h / 2);
  shape.lineTo(x, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -y);
  shape.lineTo(w / 2, y);
  shape.quadraticCurveTo(w / 2, h / 2, x, h / 2);
  shape.lineTo(-x, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, y);
  shape.lineTo(-w / 2, -y);
  shape.quadraticCurveTo(-w / 2, -h / 2, -x, -h / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: d - r * 2, bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 2, curveSegments: 3 });
  geo.translate(0, 0, -(d - r * 2) / 2);
  return new THREE.Mesh(geo, m);
}

// ------------------------------------------------------------------ the outside view in the windows
const VIEW_FRAG = /* glsl */ `
  uniform float uTime, uFlood, uAlarm;
  varying vec2 vUv;
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vn(vec2 p) { vec2 i = floor(p), f = fract(p); vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y); }
  float fbm(vec2 p) { float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * vn(p); p *= 2.1; a *= 0.5; } return v; }
  void main() {
    vec2 p = vUv;
    vec3 sky = mix(vec3(0.05, 0.09, 0.17), vec3(0.02, 0.03, 0.07), p.y);
    // the cloud sea below the horizon, streaming back
    float horizon = 0.42;
    if (p.y < horizon) {
      float d = fbm(vec2(p.x * 3.0 + uTime * 1.4, (horizon - p.y) * 9.0));
      vec3 cl = mix(vec3(0.16, 0.2, 0.28), vec3(0.55, 0.6, 0.7), smoothstep(0.35, 0.8, d));
      sky = mix(sky, cl, smoothstep(horizon, horizon - 0.05, p.y));
    }
    // a scrap of cloud whipping past now and then
    float wisp = smoothstep(0.62, 0.9, fbm(vec2(p.x * 2.0 + uTime * 6.0, p.y * 3.0)));
    sky += wisp * 0.22;
    sky = mix(sky, vec3(1.0), uFlood);
    sky += uAlarm * vec3(0.15, 0.0, 0.0);
    gl_FragColor = vec4(sky, 1.0);
    #include <colorspace_fragment>
  }
`;

// ------------------------------------------------------------------ glass cockpit
interface Display {
  kind: "pfd" | "nd" | "eicas";
  g: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
}

export class PlaneSet {
  group = new THREE.Group();
  private scene: THREE.Scene;
  private world: World;
  private actors: Partial<Record<SpeakerId, Actor>> = {};
  private patient: Person;
  private lights: { cabin: THREE.PointLight[]; alarm: THREE.PointLight[]; flood: THREE.PointLight; cockpit: THREE.PointLight };
  private view: THREE.ShaderMaterial;
  private strips: THREE.MeshStandardMaterial;
  private masterWarn: THREE.MeshStandardMaterial;
  private ecg: { tex: THREE.CanvasTexture; hrCanvas: HTMLCanvasElement; hrTex: THREE.CanvasTexture };
  private displays: Display[] = [];
  private drawT = 0;
  private puffs: THREE.Sprite[] = [];
  private sea: { mesh: THREE.Mesh; mat: THREE.ShaderMaterial };
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
  private bank = 0;
  private pitch = 0;
  onBeat?: () => void;

  constructor(scene: THREE.Scene, world: World, patientLook: Look) {
    this.scene = scene;
    this.world = world;
    const g = this.group;
    g.position.copy(SET);
    const env = moonSky();
    const add = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0) => {
      o.position.set(x, y, z);
      g.add(o);
      return o;
    };

    // ---------- materials
    const wallTex = wallTexture();
    wallTex.wrapS = wallTex.wrapT = THREE.RepeatWrapping;
    const wall = new THREE.MeshStandardMaterial({ map: wallTex, color: 0xc9c4ba, roughness: 0.75, side: THREE.DoubleSide });
    const floorTex = floorTexture();
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(2, 10);
    const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 });
    const trim = std(0x8c8a84, { roughness: 0.6 });
    const charcoal = std(0x26292d, { roughness: 0.6 });
    const metal = std(0xa9adb2, { metalness: 0.75, roughness: 0.32, envMap: env });
    const leather = std(0x2b2724, { roughness: 0.55 });
    const panelGrey = std(0x3a3e43, { roughness: 0.7 });

    // ---------- cabin hull: contoured sidewalls, coves, a flat ceiling
    const cabinProf: [number, number][] = [
      [1.0, FLOOR],
      [1.28, -0.8],
      [1.46, -0.25],
      [1.5, 0.3],
      [1.42, 0.85],
      [1.18, 1.22],
      [0.78, 1.42],
      [0.0, 1.46],
    ];
    add(new THREE.Mesh(shell(cabinProf, -6.2, 5.4), wall));
    const floor = add(new THREE.Mesh(new THREE.PlaneGeometry(2.1, 11.6), floorMat), 0, FLOOR + 0.001, -0.4);
    floor.rotation.x = -Math.PI / 2;
    // aft wall
    add(new THREE.Mesh(new THREE.CircleGeometry(1.55, 32), wall), 0, 0.1, -6.15);

    // cove lighting strips and the ceiling's centre light panel
    this.strips = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xdde6ff, emissiveIntensity: 1.3 });
    for (const x of [-1, 1]) {
      const s = add(new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, 11.2), this.strips), x * 1.08, 1.25, -0.4);
      s.rotation.z = x * 0.6;
    }
    for (let z = -5; z <= 4; z += 1.8) {
      // passenger service units: reading lights, gaspers, an oxygen panel
      const psu = add(soft(0.62, 0.05, 0.9, 0.02, std(0xcfcbc2)), 0.42, 1.43, z);
      psu.rotation.z = -0.06;
      for (const dx of [-0.15, 0.15]) {
        const lamp = add(new THREE.Mesh(new THREE.CircleGeometry(0.035, 16), this.strips), 0.42 + dx, 1.402, z + 0.2);
        lamp.rotation.x = Math.PI / 2;
        const gasper = add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.03, 12), metal), 0.42 + dx, 1.395, z - 0.15);
        gasper.rotation.x = 0;
      }
    }
    // grab rail along the ceiling
    add(rod(new THREE.Vector3(-0.35, 1.36, -5), new THREE.Vector3(-0.35, 1.36, 4.6), 0.016, metal));

    // ---------- windows: deep reveals, shades, the night outside
    this.view = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uFlood: { value: 0 }, uAlarm: { value: 0 } },
      vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
      fragmentShader: VIEW_FRAG,
    });
    const reveal = std(0xe4e0d8, { roughness: 0.5 });
    const shade = std(0xd0ccc3, { roughness: 0.7 });
    for (let z = -4.6; z <= 4.4; z += 1.0) {
      for (const x of [-1, 1]) {
        const w = new THREE.Group();
        w.position.set(x * 1.485, 0.32, z);
        w.rotation.y = -x * Math.PI / 2;
        w.rotation.x = 0;
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.028, 10, 28), reveal);
        ring.scale.set(0.82, 1.08, 0.45);
        w.add(ring);
        const glass = new THREE.Mesh(new THREE.CircleGeometry(0.16, 28), this.view);
        glass.scale.set(0.82, 1.08, 1);
        glass.position.z = 0.006;
        w.add(glass);
        // some shades half down
        if ((z * 7 + x * 3) % 3 > 1.6) {
          const sh = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.17), shade);
          sh.position.set(0, 0.1, 0.012);
          w.add(sh);
        }
        g.add(w);
      }
    }

    // ---------- bulkhead between cabin and cockpit, with the doorway
    const bulk = std(0xcfcac0, { roughness: 0.7 });
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 0.08), bulk), -0.95, 0.2, 5.4);
    add(new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.6, 0.08), bulk), 0.95, 0.2, 5.4);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.75, 0.08), bulk), 0, 1.2, 5.4);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.88, 0.12), trim), -0.4, FLOOR + 0.94, 5.4);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.88, 0.12), trim), 0.4, FLOOR + 0.94, 5.4);
    // half-drawn curtain on the doorway
    const curtain = add(new THREE.Mesh(new THREE.PlaneGeometry(0.42, 1.7, 8, 1), std(0x2f3a4a, { side: THREE.DoubleSide, roughness: 1 })), -0.2, FLOOR + 0.95, 5.33);
    const cp = curtain.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 40) * 0.025);
    curtain.geometry.computeVertexNormals();
    // an exit sign and a fire extinguisher
    const exit = add(new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.08), new THREE.MeshBasicMaterial({ map: canvasTex(128, 42, (c) => {
      c.fillStyle = "#1d8a3a";
      c.fillRect(0, 0, 128, 42);
      c.fillStyle = "#fff";
      c.font = "bold 30px Arial";
      c.textAlign = "center";
      c.fillText("EXIT", 64, 32);
    }) })), 0, 0.88, 5.35);
    exit.rotation.y = Math.PI;
    const ext = add(new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.36, 14), std(0xb31c1c, { roughness: 0.4 })), 1.05, -0.6, 5.3);
    ext.rotation.z = 0;

    // ---------- the stretcher and the patient
    const stretcher = new THREE.Group();
    stretcher.position.set(0.42, 0, 0.2);
    g.add(stretcher);
    const legs = [[-0.27, -0.95], [0.27, -0.95], [-0.27, 0.95], [0.27, 0.95]];
    for (const [x, z] of legs) stretcher.add(rod(new THREE.Vector3(x, FLOOR, z), new THREE.Vector3(x, -0.4, z), 0.02, metal));
    const frame = soft(0.62, 0.05, 2.05, 0.02, metal);
    frame.position.y = -0.38;
    stretcher.add(frame);
    for (const x of [-0.31, 0.31]) stretcher.add(rod(new THREE.Vector3(x, -0.28, -0.7), new THREE.Vector3(x, -0.28, 0.85), 0.012, metal)); // side rails
    const mattress = soft(0.58, 0.1, 1.98, 0.04, std(0x31495e, { roughness: 0.45 }));
    mattress.position.y = -0.3;
    stretcher.add(mattress);
    const pillow = soft(0.42, 0.08, 0.32, 0.035, std(0xe8eaec, { roughness: 0.9 }));
    pillow.position.set(0, -0.21, -0.78);
    pillow.rotation.x = 0.2;
    stretcher.add(pillow);
    this.patient = buildPlayerModel({ ...patientLook, top: 4, extra: 0 }) as Person;
    this.patient.root.rotation.x = -Math.PI / 2;
    this.patient.root.position.set(0.42, -0.19, 1.15);
    this.patient.lookYaw = 0.45; // toward Rhea
    this.patient.setBase("idle", 0.25, 0);
    g.add(this.patient.root);
    // blanket over the legs, draped
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.05, 12, 12), std(0x7a96ad, { roughness: 1, side: THREE.DoubleSide }));
    const bp = blanket.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) {
      const x = bp.getX(i);
      const y = bp.getY(i);
      const bump = Math.max(0, 1 - Math.abs(x) / 0.36);
      bp.setZ(i, 0.14 * Math.sin(bump * Math.PI * 0.5) - (Math.abs(x) > 0.3 ? (Math.abs(x) - 0.3) * 1.6 : 0) + Math.sin(y * 9) * 0.005);
    }
    blanket.geometry.computeVertexNormals();
    blanket.rotation.x = -Math.PI / 2;
    blanket.position.set(0, -0.2, 0.45);
    stretcher.add(blanket);
    for (const z of [0.15, 0.7]) {
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.012, 4, 24, Math.PI), std(0x1d1f22));
      strap.position.set(0, -0.26, z);
      strap.scale.set(1, 0.48, 1);
      stretcher.add(strap);
    }

    // IV pole, bag and line to the patient's arm
    add(rod(new THREE.Vector3(-0.05, FLOOR, -0.85), new THREE.Vector3(-0.05, 0.75, -0.85), 0.012, metal));
    add(rod(new THREE.Vector3(-0.15, 0.75, -0.85), new THREE.Vector3(0.05, 0.75, -0.85), 0.008, metal));
    const bag = add(soft(0.12, 0.2, 0.04, 0.015, new THREE.MeshStandardMaterial({ color: 0xd8eef5, transparent: true, opacity: 0.55, roughness: 0.15, envMap: env })), -0.05, 0.6, -0.85);
    bag.rotation.y = 0.3;
    const line = new THREE.CatmullRomCurve3([new THREE.Vector3(-0.05, 0.48, -0.85), new THREE.Vector3(0.0, 0.0, -0.6), new THREE.Vector3(0.15, -0.15, -0.2), new THREE.Vector3(0.2, -0.17, 0.05)]);
    add(new THREE.Mesh(new THREE.TubeGeometry(line, 24, 0.004, 5), new THREE.MeshStandardMaterial({ color: 0xeef4f6, transparent: true, opacity: 0.7 })));

    // ---------- monitor on an arm over the stretcher, with a live trace
    const mon = new THREE.Group();
    mon.position.set(1.22, 0.38, -0.35);
    mon.rotation.y = -Math.PI / 2 + 0.25;
    g.add(mon);
    mon.add(soft(0.62, 0.42, 0.08, 0.02, charcoal));
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
    const trace = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.17), new THREE.MeshBasicMaterial({ map: tex }));
    trace.position.set(-0.07, 0.06, 0.045);
    mon.add(trace);
    const spo2 = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.1), new THREE.MeshBasicMaterial({ map: canvasTex(256, 64, (q) => {
      q.fillStyle = "#020608";
      q.fillRect(0, 0, 256, 64);
      q.strokeStyle = "#4fd6ff";
      q.lineWidth = 2;
      q.beginPath();
      for (let x = 0; x < 256; x++) q.lineTo(x, 34 - Math.max(0, Math.sin((x / 40) * Math.PI * 2)) ** 3 * 22);
      q.stroke();
    }) }));
    spo2.position.set(-0.07, -0.1, 0.045);
    mon.add(spo2);
    const hrCanvas = document.createElement("canvas");
    hrCanvas.width = 128;
    hrCanvas.height = 128;
    const hrTex = new THREE.CanvasTexture(hrCanvas);
    const hrPlane = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.32), new THREE.MeshBasicMaterial({ map: hrTex }));
    hrPlane.position.set(0.21, 0, 0.045);
    mon.add(hrPlane);
    this.ecg = { tex, hrCanvas, hrTex };
    this.drawHr();
    add(rod(new THREE.Vector3(1.45, 0.38, -0.2), new THREE.Vector3(1.28, 0.38, -0.32), 0.02, metal));

    // ---------- the rest of the fit-out: cabinets, oxygen, a defibrillator, a jump seat
    const cab = std(0xe6e3dc, { roughness: 0.55 });
    for (const x of [-1, 1]) {
      const unit = add(soft(0.55, 1.4, 1.6, 0.03, cab), x * 1.08, FLOOR + 0.7, -4.6);
      unit.rotation.y = 0;
      for (let k = 0; k < 4; k++) {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.012, 0.5), metal), x * 0.8, FLOOR + 0.25 + k * 0.32, -4.6);
        add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.005, 1.5), std(0x9a968e)), x * 0.805, FLOOR + 0.1 + k * 0.32, -4.6);
      }
    }
    const o2 = std(0x2c7a3f, { roughness: 0.35, metalness: 0.3, envMap: env });
    for (let i = 0; i < 3; i++) {
      const b = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.62, 6, 16), o2), -1.12, FLOOR + 0.45, -2.7 + i * 0.2);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.076, 0.076, 0.12, 16), std(0xf0f0f0)), -1.12, FLOOR + 0.8, b.position.z);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.08, 10), metal), -1.12, FLOOR + 0.88, b.position.z);
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.04, 0.75), metal), -1.12, FLOOR + 0.55, -2.5);
    const aed = add(soft(0.32, 0.26, 0.12, 0.02, std(0xa88a3c, { roughness: 0.7 })), -1.36, 0.0, 1.9);
    aed.rotation.y = Math.PI / 2;
    const aedLabel = add(new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.06), new THREE.MeshBasicMaterial({ map: canvasTex(128, 40, (q) => {
      q.fillStyle = "#1f8f3a";
      q.fillRect(0, 0, 128, 40);
      q.fillStyle = "#fff";
      q.font = "bold 26px Arial";
      q.textAlign = "center";
      q.fillText("AED", 64, 29);
    }) })), -1.29, 0.04, 1.9);
    aedLabel.rotation.y = Math.PI / 2;
    // fold-down attendant seat on the right sidewall
    const jump = add(soft(0.5, 0.08, 0.42, 0.03, leather), -1.1, FLOOR + 0.5, 3.4);
    jump.rotation.y = Math.PI / 2;
    const jumpBack = add(soft(0.5, 0.6, 0.08, 0.03, leather), -1.36, FLOOR + 0.88, 3.4);
    jumpBack.rotation.y = Math.PI / 2;
    // a medical bag on the floor, Rhea's
    add(soft(0.5, 0.26, 0.3, 0.06, std(0x7a2622, { roughness: 0.85 })), -0.9, FLOOR + 0.13, 1.0).rotation.y = 0.3; // worn, sun-faded

    // ---------- cockpit: tapering walls, side glass, roof
    const narrow = (z: number) => {
      const k = THREE.MathUtils.clamp((z - 5.4) / 3.0, 0, 1);
      return { sx: 1 - k * 0.3, sy: 1 - k * 0.38 };
    };
    const lowProf: [number, number][] = [
      [0.95, FLOOR],
      [1.25, -0.75],
      [1.4, -0.3],
      [1.44, -0.05],
    ];
    add(new THREE.Mesh(shell(lowProf, 5.4, 7.9, narrow), panelGrey));
    const roofProf: [number, number][] = [
      [1.3, 0.92],
      [1.05, 1.2],
      [0.6, 1.4],
      [0.0, 1.44],
    ];
    add(new THREE.Mesh(shell(roofProf, 5.4, 7.15, narrow), panelGrey));
    // solid sidewall behind the seats, glass ahead of it
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x9fb8cc, transparent: true, opacity: 0.08, roughness: 0.04, metalness: 0.9, envMap: env, side: THREE.DoubleSide, depthWrite: false });
    const frameMat = std(0x16181b, { roughness: 0.55 });
    for (const s of [-1, 1]) {
      const a = narrow(5.4);
      const b = narrow(6.2);
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.98), panelGrey);
      sw.position.set(s * 1.4 * (a.sx + b.sx) * 0.5, 0.43, 5.8);
      sw.rotation.y = -s * Math.PI / 2;
      g.add(sw);
      // side window: a quad from z 6.2 to 7.15 between sill and roof
      const p = (z: number, y: number) => {
        const t = narrow(z);
        return new THREE.Vector3(s * 1.42 * t.sx, FLOOR + (y - FLOOR) * t.sy, z);
      };
      const quad = new THREE.BufferGeometry().setFromPoints([p(6.2, -0.05), p(7.15, -0.05), p(7.15, 0.95), p(6.2, -0.05), p(7.15, 0.95), p(6.2, 0.95)]);
      quad.computeVertexNormals();
      g.add(new THREE.Mesh(quad, glassMat));
      g.add(rod(p(6.2, -0.05), p(6.2, 0.95), 0.035, frameMat));
      g.add(rod(p(6.65, -0.05), p(6.65, 0.95), 0.022, frameMat));
      g.add(rod(p(6.2, 0.95), p(7.15, 0.95), 0.03, frameMat));
      g.add(rod(p(6.2, -0.05), p(7.9, -0.05), 0.04, frameMat));
    }
    // windshield: four panes in a shallow V, raked back to the roof
    const wsBottom = (x: number) => new THREE.Vector3(x, -0.02, 7.95 - Math.abs(x) * 0.42);
    const wsTop = (x: number) => new THREE.Vector3(x * 0.92, 0.92, 7.15 - Math.abs(x) * 0.25);
    const posts = [-1.0, -0.55, 0, 0.55, 1.0];
    for (let i = 0; i < posts.length - 1; i++) {
      const a = posts[i];
      const b = posts[i + 1];
      const geo = new THREE.BufferGeometry().setFromPoints([wsBottom(a), wsBottom(b), wsTop(b), wsBottom(a), wsTop(b), wsTop(a)]);
      geo.computeVertexNormals();
      g.add(new THREE.Mesh(geo, glassMat));
    }
    for (const x of posts) g.add(rod(wsBottom(x), wsTop(x), x === 0 ? 0.014 : 0.024, frameMat));
    g.add(rod(wsTop(-1), wsTop(0), 0.022, frameMat), rod(wsTop(0), wsTop(1), 0.022, frameMat));
    // nose below the glass
    const nose = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), panelGrey);
    nose.scale.set(1.0, 1.0, 0.7);
    nose.rotation.x = -Math.PI / 2;
    add(nose, 0, -0.06, 7.9);

    // glareshield and the main instrument panel
    const glare = add(soft(2.1, 0.1, 0.42, 0.04, std(0x15171a, { roughness: 0.9 })), 0, -0.07, 7.62);
    glare.rotation.x = 0.08;
    const panel = add(soft(2.0, 0.62, 0.12, 0.03, std(0x2a2d31, { roughness: 0.65 })), 0, -0.42, 7.62);
    panel.rotation.x = -0.18;
    // master warning / caution lights either side
    this.masterWarn = new THREE.MeshStandardMaterial({ color: 0x2a0606, emissive: 0xff2010, emissiveIntensity: 0 });
    for (const x of [-0.72, 0.72]) add(soft(0.07, 0.045, 0.03, 0.008, this.masterWarn), x, -0.035, 7.44);
    // autopilot panel on the glareshield
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.08), new THREE.MeshBasicMaterial({ map: canvasTex(512, 48, (q) => {
      q.fillStyle = "#121417";
      q.fillRect(0, 0, 512, 48);
      q.fillStyle = "#3be37a";
      q.font = "bold 22px monospace";
      q.fillText("HDG 274", 18, 31);
      q.fillText("ALT 41000", 150, 31);
      q.fillText("VS +0", 310, 31);
      q.fillStyle = "#c9c9c9";
      q.font = "12px Arial";
      q.fillText("AP1   YD   NAV   ALT", 400, 30);
    }) })), 0, -0.012, 7.43).rotation.x = -Math.PI / 2 + 0.6;
    // displays: PFD, MFD, EICAS, MFD, PFD
    const dsp: [Display["kind"], number][] = [
      ["pfd", -0.78],
      ["nd", -0.4],
      ["eicas", 0],
      ["nd", 0.4],
      ["pfd", 0.78],
    ];
    for (const [kind, x] of dsp) {
      const cv = document.createElement("canvas");
      cv.width = 256;
      cv.height = 220;
      const t = new THREE.CanvasTexture(cv);
      t.colorSpace = THREE.SRGBColorSpace;
      const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.33, 0.28), new THREE.MeshBasicMaterial({ map: t, toneMapped: false }));
      scr.position.set(x, -0.38, 7.49);
      scr.rotation.set(-0.18, Math.PI, 0);
      g.add(scr);
      const bezel = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.32), std(0x101113));
      bezel.position.set(x, -0.38, 7.495);
      bezel.rotation.set(-0.18, Math.PI, 0);
      g.add(bezel);
      this.displays.push({ kind, g: cv.getContext("2d")!, tex: t });
    }
    // centre pedestal with the thrust levers and radio panels
    const ped = add(soft(0.36, 0.55, 0.9, 0.03, std(0x2a2d31)), 0, FLOOR + 0.28, 7.05);
    ped.rotation.x = 0;
    add(new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.7), new THREE.MeshStandardMaterial({ map: canvasTex(128, 300, (q) => {
      q.fillStyle = "#24272b";
      q.fillRect(0, 0, 128, 300);
      for (let y = 20; y < 300; y += 46) {
        q.fillStyle = "#0b0c0d";
        q.fillRect(12, y, 104, 26);
        q.fillStyle = "#ffb54a";
        q.font = "16px monospace";
        q.fillText(["121.50", "COM2 118.7", "XPDR 7700", "NAV 110.3", "ADF 344", "--"][Math.floor(y / 46)] ?? "", 18, y + 19);
      }
    }), emissive: 0xffffff, emissiveIntensity: 0.25, emissiveMap: null })), 0, FLOOR + 0.56, 7.05).rotation.x = -Math.PI / 2;
    for (const x of [-0.06, 0.06]) {
      const lever = add(new THREE.Group(), x, FLOOR + 0.57, 7.25);
      lever.rotation.x = 0.45;
      lever.add(rod(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.22, 0), 0.012, metal));
      const knob = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.05), std(0x1a1a1a, { roughness: 0.4 }));
      knob.position.y = 0.23;
      lever.add(knob);
    }
    // overhead panel: rows of backlit switches
    const over = add(soft(0.9, 0.04, 0.7, 0.02, std(0x2d3034)), 0, 1.22, 6.55);
    over.rotation.x = 0.3;
    const sw = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.008, 0.008, 0.04, 6), metal, 60);
    const mtx = new THREE.Matrix4();
    let n = 0;
    for (let r = 0; r < 5; r++)
      for (let k = 0; k < 12; k++) {
        const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.3 + Math.PI, 0, 0));
        mtx.compose(new THREE.Vector3(-0.38 + k * 0.07, 1.19 - r * 0.04, 6.3 + r * 0.12), q, new THREE.Vector3(1, 1, 1));
        sw.setMatrixAt(n++, mtx);
      }
    g.add(sw);
    // yokes
    for (const x of [-0.5, 0.5]) {
      add(rod(new THREE.Vector3(x, FLOOR, 7.35), new THREE.Vector3(x, -0.3, 7.15), 0.03, charcoal));
      const yoke = add(new THREE.Group(), x, -0.18, 7.08);
      yoke.rotation.x = -0.25;
      const hub = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.05), charcoal);
      yoke.add(hub);
      for (const s of [-1, 1]) {
        const horn = new THREE.Mesh(new THREE.CapsuleGeometry(0.022, 0.12, 4, 8), leather);
        horn.position.set(s * 0.15, 0.03, 0);
        horn.rotation.z = s * 0.25;
        yoke.add(horn);
        yoke.add(rod(new THREE.Vector3(s * 0.05, 0, 0), new THREE.Vector3(s * 0.14, -0.02, 0), 0.02, charcoal));
      }
    }
    // pilot seats
    for (const x of [-0.5, 0.5]) {
      const seat = add(new THREE.Group(), x, 0, 6.62);
      const cushion = soft(0.5, 0.12, 0.5, 0.04, leather);
      cushion.position.y = FLOOR + 0.42;
      seat.add(cushion);
      const back = soft(0.5, 0.75, 0.12, 0.05, leather);
      back.position.set(0, FLOOR + 0.85, -0.3);
      back.rotation.x = -0.15;
      seat.add(back);
      const head = soft(0.3, 0.2, 0.1, 0.04, leather);
      head.position.set(0, FLOOR + 1.32, -0.37);
      seat.add(head);
      for (const s of [-1, 1]) {
        const arm = soft(0.06, 0.05, 0.32, 0.02, leather);
        arm.position.set(s * 0.28, FLOOR + 0.65, -0.05);
        seat.add(arm);
      }
      const base = soft(0.36, 0.3, 0.4, 0.03, charcoal);
      base.position.y = FLOOR + 0.2;
      seat.add(base);
    }

    // ---------- people
    const make = (id: "PILOT" | "DEZ" | "RHEA", p: Person, pose: Actor["pose"], toward: number) => {
      g.add(p.root);
      this.actors[id] = { m: p, talk: 0, pose, toward };
      return p;
    };
    const headset = (p: Person) => accessorize({ ...DEFAULT_LOOK, extra: 6 }, p.head, p.head, p.torso, 1, charcoal);
    const epaulettes = (p: Person, bars: number) => {
      for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.01, 0.12), std(0x111318));
        e.position.set(s * 0.15, 0.56, -0.02);
        e.rotation.z = -s * 0.25;
        p.torso.add(e);
        for (let b = 0; b < bars; b++) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.062, 0.012, 0.012), std(0xd4a83a, { metalness: 0.8, roughness: 0.3 }));
          bar.position.set(s * 0.15, 0.565, 0.02 - b * 0.022);
          bar.rotation.z = -s * 0.25;
          p.torso.add(bar);
        }
      }
    };
    const shirt = 0xeef0f2;
    const navy = 0x1b2333;
    const ok = make("PILOT", new Person({ sex: "m", skin: 5, hair: "buzzed", hairColor: 0x8c8984, beard: true, top: shirt, sleeves: false, pants: navy, shoes: 0x111111, belt: 0x111111, width: 1.06 }), "fly", -0.5);
    ok.root.position.set(0.5, FLOOR, 6.95);
    headset(ok);
    epaulettes(ok, 4);
    const dez = make("DEZ", new Person({ sex: "m", skin: 2, hair: "simpleparted", hairColor: 0x16120f, top: shirt, sleeves: false, pants: navy, shoes: 0x111111, belt: 0x111111, width: 0.96 }), "fly", 0.5);
    dez.root.position.set(-0.5, FLOOR, 6.95);
    headset(dez);
    epaulettes(dez, 3);
    const rhea = make("RHEA", new Person({ sex: "f", skin: 1, hair: "buns", hairColor: 0x74331f, top: 0x2b3f57, pants: 0x2b3f57, shoes: 0x1a1a1a, boots: true, belt: 0x1a1a1a, jacket: 0x22324a, width: 0.88 }), "stand", 0.3);
    rhea.root.position.set(-0.32, FLOOR, 0.05);
    rhea.root.rotation.y = Math.PI / 2;
    for (const a of Object.values(this.actors)) a?.m.setBase(a.pose === "fly" ? "drive" : "idle", 1, 0);

    // ---------- light
    // a night flight: cabin lights dimmed, the reading light over the patient carries the scene
    const cabin = [new THREE.PointLight(0xdfe6f5, 1.5, 7, 1.6), new THREE.PointLight(0xdfe6f5, 0.8, 7, 1.6), new THREE.PointLight(0xffe6c4, 2.1, 3.6, 1.4)];
    cabin[0].position.set(0, 1.1, 0.6);
    cabin[1].position.set(0, 1.1, -3.6);
    cabin[2].position.set(0.42, 1.2, -0.2); // reading light over the patient
    const cockpit = new THREE.PointLight(0x8fb4ff, 1.2, 3, 1.5);
    cockpit.position.set(0, -0.15, 7.2);
    const alarm = [new THREE.PointLight(0xff2a1a, 0, 7, 1.5), new THREE.PointLight(0xff2a1a, 0, 4, 1.5)];
    alarm[0].position.set(0, 1.2, 0.8);
    alarm[1].position.set(0, 0.6, 6.9);
    const flood = new THREE.PointLight(0xffffff, 0, 30, 1);
    flood.position.set(0, 0.5, 9.5);
    g.add(...cabin, cockpit, ...alarm, flood);
    this.lights = { cabin, alarm, flood, cockpit };
    g.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.castShadow = false;
    });

    // ---------- the light ahead
    this.riftMat = (world.skyTearMat as THREE.ShaderMaterial).clone();
    this.riftMat.uniforms = { uTime: { value: 0 }, uOpen: { value: 0 } };
    this.rift = new THREE.Mesh(new THREE.CircleGeometry(30, 64), this.riftMat);
    this.rift.position.copy(SET).add(new THREE.Vector3(0, 25, 420));
    this.rift.lookAt(SET);
    this.rift.scale.setScalar(0.01);
    scene.add(this.rift);

    // ---------- clouds: a moonlit sea far below, and scraps streaming past
    this.sea = cloudSea(matchMedia("(pointer: coarse)").matches);
    this.sea.mesh.position.set(SET.x, SET.y - 90, SET.z + 400);
    scene.add(this.sea.mesh);
    const tex3 = puffTextures();
    for (let i = 0; i < 40; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex3[i % 3], color: 0x9aa6bc, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
      const sc = 18 + Math.random() * 40;
      s.scale.set(sc * 1.9, sc, 1);
      s.position.set(SET.x - 90 + Math.random() * 240, SET.y - 30 + Math.random() * 26, SET.z - 200 + Math.random() * 600);
      scene.add(s);
      this.puffs.push(s);
    }

    // ---------- the exterior jet, cruising (no fire yet)
    const p = world.fallingPlane;
    p.position.copy(EXT);
    p.rotation.set(0, 0, 0);
    p.visible = true;
    world.planeTrail = false;
    world.aircraft.cabin(1);

    scene.add(g);
    active = this;
    this.drawDisplays(0);
  }

  // ------------------------------------------------------------------ cues
  cue(c: string) {
    switch (c) {
      case "alarm":
        this.alarm = true;
        this.world.aircraft.cabin(1, true);
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

  /** Okafor alone at the controls, alarms, the light pouring in. */
  private flashbackMode = false;
  flashback() {
    this.flashbackMode = true;
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
    g.fillStyle = "#020608";
    g.fillRect(0, 0, 128, 128);
    const fast = this.hr > 100;
    g.fillStyle = fast ? "#ff6a4a" : "#39ff8a";
    g.font = "bold 14px monospace";
    g.fillText("HR", 8, 18);
    g.font = "bold 46px monospace";
    g.fillText(String(this.hr), 8, 62);
    g.fillStyle = "#4fd6ff";
    g.font = "bold 14px monospace";
    g.fillText("SpO2", 8, 86);
    g.font = "bold 30px monospace";
    g.fillText(fast ? "88" : "97", 8, 118);
    this.ecg.hrTex.needsUpdate = true;
  }

  /** The glass cockpit: attitude, map and engines, redrawn a few times a second. */
  private drawDisplays(t: number) {
    const lost = this.riftK > 0.25;
    for (const d of this.displays) {
      const g = d.g;
      const W = 256;
      const H = 220;
      g.save();
      g.fillStyle = "#05070a";
      g.fillRect(0, 0, W, H);
      if (d.kind === "pfd") {
        // attitude: sky and ground split by the horizon, banked and pitched
        g.save();
        g.beginPath();
        g.rect(40, 20, 176, 150);
        g.clip();
        g.translate(128, 95 + this.pitch * 300);
        g.rotate(-this.bank);
        g.fillStyle = "#1f6fc4";
        g.fillRect(-300, -400, 600, 400);
        g.fillStyle = "#7a4a22";
        g.fillRect(-300, 0, 600, 400);
        g.strokeStyle = "#fff";
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(-300, 0);
        g.lineTo(300, 0);
        g.stroke();
        for (let k = -3; k <= 3; k++) {
          if (!k) continue;
          const w = k % 2 ? 18 : 34;
          g.beginPath();
          g.moveTo(-w, -k * 22);
          g.lineTo(w, -k * 22);
          g.stroke();
        }
        g.restore();
        // aircraft symbol
        g.strokeStyle = "#ffd23a";
        g.lineWidth = 5;
        g.beginPath();
        g.moveTo(80, 95);
        g.lineTo(112, 95);
        g.lineTo(120, 104);
        g.moveTo(176, 95);
        g.lineTo(144, 95);
        g.lineTo(136, 104);
        g.stroke();
        // speed and altitude tapes
        g.fillStyle = "rgba(40,44,52,0.9)";
        g.fillRect(0, 20, 38, 150);
        g.fillRect(218, 20, 38, 150);
        g.fillStyle = "#fff";
        g.font = "bold 15px monospace";
        g.fillText(String(Math.round(262 + Math.sin(t) * 2)), 2, 100);
        g.fillText(lost ? "----" : "4100", 220, 100);
        g.font = "11px monospace";
        g.fillStyle = "#3be37a";
        g.fillText("M.78", 4, 186);
        g.fillText("AP1 ALT NAV", 80, 14);
        // heading
        g.fillStyle = "#fff";
        g.font = "bold 14px monospace";
        g.fillText(lost ? "HDG ---" : "HDG 274", 92, 205);
        if (lost || this.alarm) {
          g.fillStyle = "#ff3a2a";
          g.font = "bold 16px monospace";
          g.fillText(lost ? "ATT" : "", 48, 40);
          if (lost) g.fillText("GPS", 180, 40);
        }
      } else if (d.kind === "nd") {
        g.strokeStyle = "#e8e8e8";
        g.lineWidth = 2;
        g.beginPath();
        g.arc(128, 200, 150, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
        g.strokeStyle = "rgba(220,220,220,0.4)";
        g.beginPath();
        g.arc(128, 200, 80, Math.PI * 1.15, Math.PI * 1.85);
        g.stroke();
        if (lost) {
          g.fillStyle = "#ff3a2a";
          g.font = "bold 18px monospace";
          g.fillText("MAP INVALID", 70, 110);
          g.fillText("GPS LOST", 84, 134);
        } else {
          g.strokeStyle = "#ff4fe0";
          g.lineWidth = 3;
          g.beginPath();
          g.moveTo(128, 200);
          g.lineTo(140, 120);
          g.lineTo(170, 60);
          g.stroke();
          g.fillStyle = "#ff4fe0";
          g.font = "12px monospace";
          g.fillText("KMED", 176, 58);
          g.fillStyle = "#3be37a";
          g.fillText("TGT 1h12", 8, 16);
        }
        g.fillStyle = "#fff";
        g.beginPath();
        g.moveTo(128, 190);
        g.lineTo(120, 208);
        g.lineTo(136, 208);
        g.fill();
      } else {
        // engines: two N1 arcs, ITT, fuel, and the warning list
        for (const [i, x] of [
          [0, 70],
          [1, 186],
        ]) {
          const n1 = 0.86 + Math.sin(t * 0.7 + i) * 0.005;
          g.strokeStyle = "#555";
          g.lineWidth = 6;
          g.beginPath();
          g.arc(x, 62, 38, Math.PI * 0.8, Math.PI * 2.1);
          g.stroke();
          g.strokeStyle = "#3be37a";
          g.beginPath();
          g.arc(x, 62, 38, Math.PI * 0.8, Math.PI * (0.8 + 1.3 * n1));
          g.stroke();
          g.fillStyle = "#fff";
          g.font = "bold 16px monospace";
          g.fillText((n1 * 100).toFixed(1), x - 22, 68);
        }
        g.fillStyle = "#aaa";
        g.font = "12px monospace";
        g.fillText("N1", 120, 66);
        g.fillText("FUEL 5420 LB   CAB 6200 FT", 10, 128);
        if (this.alarm) {
          g.fillStyle = Math.sin(t * 7) > 0 ? "#ff3a2a" : "#7a1a12";
          g.font = "bold 15px monospace";
          g.fillText("MASTER WARNING", 60, 156);
          g.fillStyle = "#ffb000";
          g.font = "13px monospace";
          g.fillText("NAV DATA INVALID", 64, 178);
          g.fillText("ELEC BUS 2 FAULT", 64, 196);
        } else {
          g.fillStyle = "#3be37a";
          g.font = "13px monospace";
          g.fillText("NO MESSAGES", 82, 168);
        }
      }
      g.restore();
      d.tex.needsUpdate = true;
    }
  }

  // ------------------------------------------------------------------ shots
  /** Named camera moves, in world space. */
  shot(id: string): { from: CamKey; to: CamKey; dur: number; track?: () => THREE.Vector3 } {
    const L = (x: number, y: number, z: number) => SET.clone().add(new THREE.Vector3(x, y, z));
    // the jet outside only exists for the exterior shot: never through our own window
    this.world.fallingPlane.visible = id === "exterior" && !this.flashbackMode;
    switch (id) {
      case "exterior": {
        const p = this.world.fallingPlane.position;
        const P = (x: number, y: number, z: number) => p.clone().add(new THREE.Vector3(x, y, z));
        return { from: key(P(-30, 7, 34), P(0, 0, 3)), to: key(P(-20, 2.5, -2), P(0, 0.6, 5)), dur: 9 };
      }
      case "cockpitWide":
        return { from: key(L(0.0, 0.62, 5.7), L(0, 0.15, 9.5)), to: key(L(0.0, 0.58, 6.0), L(0, 0.2, 9.5)), dur: 9 };
      case "cockpitFaces":
        return { from: key(L(0.12, 0.25, 7.45), L(0, 0.12, 6.6)), to: key(L(-0.08, 0.27, 7.4), L(0, 0.14, 6.6)), dur: 10 };
      case "okaforClose":
        return { from: key(L(-0.05, 0.25, 7.4), L(0.5, 0.15, 6.65)), to: key(L(0.02, 0.24, 7.3), L(0.5, 0.15, 6.65)), dur: 8 };
      case "dezSeat":
        return { from: key(L(0.1, 0.25, 7.4), L(-0.5, 0.12, 6.65)), to: key(L(0.03, 0.24, 7.3), L(-0.5, 0.12, 6.65)), dur: 7 };
      case "cabinWide":
        return { from: key(L(-0.85, 0.85, 4.6), L(0.25, -0.3, -0.3)), to: key(L(-0.75, 0.8, 4.2), L(0.2, -0.3, -0.4)), dur: 9 };
      case "monitor":
        return { from: key(L(0.55, 0.45, 0.35), L(1.22, 0.38, -0.35)), to: key(L(0.68, 0.42, 0.15), L(1.22, 0.38, -0.35)), dur: 6 };
      case "rheaClose":
        return { from: key(L(1.2, 0.5, 1.45), L(-0.32, 0.5, 0.05)), to: key(L(1.12, 0.46, 1.2), L(-0.32, 0.48, 0.05)), dur: 10 };
      case "windshield":
        return { from: key(L(0.0, 0.3, 6.2), L(0, 1.6, 20)), to: key(L(0.0, 0.28, 6.9), L(0, 1.8, 20)), dur: 9 };
      case "cabinAlarm":
        return { from: key(L(-0.9, 0.95, 3.8), L(0.25, -0.3, -0.2)), to: key(L(-0.7, 0.75, 2.6), L(0.25, -0.3, -0.4)), dur: 8 };
      default:
        return { from: key(L(0, 0.5, 5), L(0, 0.3, 10)), to: key(L(0, 0.5, 5.5), L(0, 0.3, 10)), dur: 6 };
    }
  }

  // ------------------------------------------------------------------ per frame
  update(dt: number, t: number, speaking: boolean) {
    // flight: the cloud sea drifts under us, scraps of cloud stream past
    this.sea.mat.uniforms.uTime.value = t;
    this.sea.mat.uniforms.uFlash.value = this.riftK * 0.35 + this.floodK;
    for (const s of this.puffs) {
      s.position.z -= dt * 75;
      if (s.position.z < SET.z - 200) s.position.z += 600;
    }
    const p = this.world.fallingPlane;
    if (p.visible && !this.world.planeTrail) {
      p.position.y = EXT.y + Math.sin(t * 0.8) * 0.4;
      p.rotation.z = Math.sin(t * 0.5) * 0.04;
    }
    this.view.uniforms.uTime.value = t;

    // the light ahead
    this.riftK += (this.riftTarget - this.riftK) * Math.min(1, dt * 0.35);
    this.rift.scale.setScalar(0.01 + this.riftK * 1.2);
    this.riftMat.uniforms.uTime.value = t;
    this.riftMat.uniforms.uOpen.value = this.riftK;
    if (this.flooding) this.floodK = Math.min(1, this.floodK + dt * 0.35);
    this.lights.flood.intensity = this.riftK * 6 + this.floodK * 120;
    this.view.uniforms.uFlood.value = this.floodK;

    // alarm lights, flicker and turbulence
    const on = this.alarm && Math.sin(t * 7) > 0;
    for (const a of this.lights.alarm) a.intensity = on ? 9 : 0.6 * (this.alarm ? 1 : 0);
    for (const c of this.lights.cabin) {
      const base = c === this.lights.cabin[2] ? 2.1 : c === this.lights.cabin[0] ? 1.5 : 0.8;
      c.intensity = this.alarm ? (Math.random() < 0.05 ? 0 : base * 0.4) : base;
    }
    this.strips.emissiveIntensity = this.alarm ? (Math.random() < 0.05 ? 0.1 : 0.4) : 0.9;
    this.masterWarn.emissiveIntensity = on ? 3 : 0;
    this.view.uniforms.uAlarm.value = on ? 1 : 0;
    const sh = this.shaking * (0.6 + Math.sin(t * 13) * 0.4);
    this.group.position.set(SET.x + (Math.random() - 0.5) * 0.05 * sh, SET.y + (Math.random() - 0.5) * 0.06 * sh, SET.z);
    this.bank = Math.sin(t * 0.4) * 0.03 + sh * Math.sin(t * 5) * 0.2;
    this.pitch = Math.sin(t * 0.3) * 0.01 + sh * Math.sin(t * 3.1) * 0.04;
    this.drawT -= dt;
    if (this.drawT <= 0) {
      this.drawT = 0.12;
      this.drawDisplays(t);
    }

    // heart monitor
    this.ecg.tex.offset.x += dt * (this.hr / 60) * 0.5;
    this.beatT -= dt;
    if (this.beatT <= 0) {
      this.beatT = 60 / this.hr;
      this.onBeat?.();
    }

    // people
    for (const a of Object.values(this.actors)) {
      if (!a) continue;
      if (!speaking) a.talk = 0;
      a.talk = Math.max(0, a.talk - dt);
      const m = a.m;
      const talking = a.talk > 0;
      if (a.pose === "fly") {
        // hands on the yoke; a hand comes off it to talk. Look across while
        // the other pilot speaks, otherwise out at the sky.
        m.setBase(talking ? "sitTalk" : "drive", this.alarm ? 1.6 : 1, 0.4);
        const other = Object.values(this.actors).some((o) => o && o !== a && o.talk > 0 && o.pose === "fly");
        m.lookYaw = talking ? a.toward : other ? a.toward * 0.7 : this.riftK > 0.3 ? 0 : Math.sin(t * 0.3 + a.toward) * 0.12;
        m.lookPitch = talking || other ? 0 : -0.05;
      } else {
        // Rhea over the stretcher, hours into the shift: eyes on the patient,
        // up to the monitor; every so often she reaches to check the line or
        // the screen, then settles back, a little slower than she'd like.
        m.setBase(talking ? "talk" : "idle", talking ? 1 : 0.75, 0.4);
        m.body.rotation.x = 0.05;
        a.busy = (a.busy ?? 4) - dt;
        const checking = a.busy < 1.6 && !talking;
        if (a.busy <= 0) {
          a.busy = 6 + ((t * 7.3) % 4);
          if (!talking && !this.alarm) void m.play("interact", 0.8);
        }
        m.lookPitch = talking ? 0.15 : checking ? -0.1 : 0.35;
        m.lookYaw = checking ? -0.45 : Math.sin(t * 0.25) > 0.6 ? -0.4 : 0.05;
      }
    }
  }

  dispose() {
    this.scene.remove(this.group, this.rift, this.sea.mesh);
    for (const c of this.puffs) this.scene.remove(c);
    this.world.fallingPlane.visible = false;
    this.world.planeTrail = true;
    this.world.aircraft.cabin(1);
    if (active === this) active = null;
  }
}
