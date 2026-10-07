// The medevac jet, built properly: a lathe-turned fuselage (drooped nose,
// upswept tail cone), airfoil-section wings with sweep, dihedral and
// winglets, a T-tail, two rear-mounted turbofans, a painted livery (with the
// cabin windows lit from inside), nav lights and strobes, and a moonlit sky
// reflected in the paint. The same parts build the wreck on the ground.
//
// Axes: nose toward +z, up +y, the left (port) wing toward +x.

import * as THREE from "three";

export const FUSE = {
  /** fuselage radius and the stations of nose tip and tail tip (m) */
  r: 1.62,
  nose: 12,
  tail: -12,
  /** where the parallel section ends at each end */
  noseStart: 7.2,
  tailStart: -4.6,
};

// ------------------------------------------------------------------ the sky in the paint
let skyEnv: THREE.CubeTexture | null = null;
/** A small moonlit sky (deep blue above, a silver cloud sea below, a bright
 *  moon to one side) for reflections on paint, glass and metal. */
export function moonSky(): THREE.CubeTexture {
  if (skyEnv) return skyEnv;
  const S = 64;
  const face = (kind: "top" | "bottom" | "side", moon = false) => {
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    if (kind === "top") {
      g.fillStyle = "#0b1426";
      g.fillRect(0, 0, S, S);
    } else if (kind === "bottom") {
      g.fillStyle = "#5d6878";
      g.fillRect(0, 0, S, S);
    } else {
      const gr = g.createLinearGradient(0, 0, 0, S);
      gr.addColorStop(0, "#0c1628");
      gr.addColorStop(0.45, "#25344c");
      gr.addColorStop(0.52, "#7d8aa0"); // the cloud tops at the horizon
      gr.addColorStop(1, "#525d6e");
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
      if (moon) {
        const m = g.createRadialGradient(S * 0.6, S * 0.28, 0, S * 0.6, S * 0.28, S * 0.3);
        m.addColorStop(0, "rgba(235,240,255,1)");
        m.addColorStop(0.15, "rgba(200,215,240,0.8)");
        m.addColorStop(1, "rgba(120,140,180,0)");
        g.fillStyle = m;
        g.fillRect(0, 0, S, S);
      }
    }
    return c;
  };
  // +x -x +y -y +z -z
  skyEnv = new THREE.CubeTexture([face("side", true), face("side"), face("top"), face("bottom"), face("side"), face("side")]);
  skyEnv.colorSpace = THREE.SRGBColorSpace;
  skyEnv.needsUpdate = true;
  return skyEnv;
}

// ------------------------------------------------------------------ livery
const LIV_W = 1024; // around the fuselage
const LIV_H = 2048; // along it, tail (row 0) to nose
const pxZ = (z: number) => ((z - FUSE.tail) / (FUSE.nose - FUSE.tail)) * LIV_H;
/** u (0..1 around, 0 = belly, .25 = port side, .5 = top) for a height y on the side. */
const uAt = (y: number, port: boolean) => {
  const phi = Math.acos(THREE.MathUtils.clamp(-y / FUSE.r, -1, 1));
  return (port ? phi : Math.PI * 2 - phi) / (Math.PI * 2);
};
/** Cabin windows: stations along the fuselage. */
export const WINDOWS = [-3.4, -2.55, -1.7, -0.85, 0, 0.85, 1.7, 2.55, 3.4, 4.25];
const WIN_Y = 0.42;

interface Livery {
  map: THREE.CanvasTexture;
  glow: THREE.CanvasTexture;
}
let livery: Livery | null = null;
function makeLivery(): Livery {
  if (livery) return livery;
  const c = document.createElement("canvas");
  c.width = LIV_W;
  c.height = LIV_H;
  const g = c.getContext("2d")!;
  const e = document.createElement("canvas");
  e.width = LIV_W;
  e.height = LIV_H;
  const ge = e.getContext("2d")!;
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, LIV_W, LIV_H);

  // white over a grey belly
  g.fillStyle = "#eceef0";
  g.fillRect(0, 0, LIV_W, LIV_H);
  const belly = g.createLinearGradient(0, 0, LIV_W, 0);
  belly.addColorStop(0, "#8f969d");
  belly.addColorStop(0.1, "#8f969d");
  belly.addColorStop(0.135, "#eceef0");
  belly.addColorStop(0.865, "#eceef0");
  belly.addColorStop(0.9, "#8f969d");
  belly.addColorStop(1, "#8f969d");
  g.fillStyle = belly;
  g.fillRect(0, 0, LIV_W, LIV_H);

  // panel lines: frames around, stringers along
  g.strokeStyle = "rgba(60,70,80,0.1)";
  g.lineWidth = 1.5;
  for (let z = FUSE.tail + 1; z < FUSE.nose; z += 1.15) {
    g.beginPath();
    g.moveTo(0, pxZ(z));
    g.lineTo(LIV_W, pxZ(z));
    g.stroke();
  }
  for (const u of [0.18, 0.33, 0.5, 0.67, 0.82]) {
    g.beginPath();
    g.moveTo(u * LIV_W, 0);
    g.lineTo(u * LIV_W, LIV_H);
    g.stroke();
  }

  for (const port of [true, false]) {
    const col = (y: number) => uAt(y, port) * LIV_W;
    // the cheatline: medevac blue with a red pinstripe, sweeping up at the tail
    const band = (y0: number, y1: number, color: string) => {
      g.fillStyle = color;
      g.beginPath();
      const a = col(y0);
      const b = col(y1);
      g.moveTo(a, pxZ(FUSE.nose - 2.2));
      g.lineTo(b, pxZ(FUSE.nose - 2.6));
      g.lineTo(b, pxZ(FUSE.tail + 4));
      g.lineTo(a, pxZ(FUSE.tail + 5.2));
      g.closePath();
      g.fill();
    };
    band(-0.05, -0.42, "#1d58b8");
    band(-0.46, -0.52, "#c4161c");

    // cabin windows: dark glass, lit from inside
    for (const z of WINDOWS) {
      const x = col(WIN_Y);
      const y = pxZ(z);
      const w = 0.36 * (LIV_W / (Math.PI * 2 * FUSE.r));
      const h = 0.3 * (LIV_H / (FUSE.nose - FUSE.tail));
      g.fillStyle = "#c9ccd0";
      rrect(g, x - w / 2 - 4, y - h / 2 - 4, w + 8, h + 8, 14);
      g.fillStyle = "#141a22";
      rrect(g, x - w / 2, y - h / 2, w, h, 11);
      ge.fillStyle = "#ffcf94";
      rrect(ge, x - w / 2 + 2, y - h / 2 + 2, w - 4, h - 4, 10);
    }
    // the cockpit glazing: a side window and a sliding direct-vision window
    g.fillStyle = "#10151c";
    for (const [z0, z1, y0, y1] of [
      [9.15, 10.0, 0.55, 1.0],
      [8.25, 9.0, 0.5, 0.95],
    ] as const) {
      g.beginPath();
      g.moveTo(col(y0), pxZ(z0));
      g.lineTo(col(y0 + 0.08), pxZ(z1));
      g.lineTo(col(y1), pxZ(z1 - 0.18));
      g.lineTo(col(y1 - 0.05), pxZ(z0));
      g.closePath();
      g.fill();
    }
    // forward airstair door, outlined
    g.strokeStyle = "rgba(40,48,56,0.65)";
    g.lineWidth = 2.5;
    if (port) {
      rrect(g, col(0.95), pxZ(6.2), col(-0.75) - col(0.95), pxZ(7.05) - pxZ(6.2), 10, true);
      // the stretcher-loading door, aft
      rrect(g, col(0.85), pxZ(-4.3), col(-0.55) - col(0.85), pxZ(-2.9) - pxZ(-4.3), 10, true);
    }
    // titles along the side, above the windows
    g.save();
    g.translate(col(0.95), pxZ(0.6));
    g.rotate(-Math.PI / 2);
    g.scale(port ? 1 : -1, port ? -1 : 1);
    g.fillStyle = "#1d58b8";
    g.font = "bold 66px Arial, Helvetica, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("AIR AMBULANCE", 0, 0);
    g.restore();
    // registration by the tail
    g.save();
    g.translate(col(0.25), pxZ(-6.6));
    g.rotate(-Math.PI / 2);
    g.scale(port ? 1 : -1, port ? -1 : 1);
    g.fillStyle = "#3a3f45";
    g.font = "bold 44px Arial, Helvetica, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("N10001", 0, 0);
    g.restore();
    // a red cross aft of the door
    g.save();
    g.translate(col(0.15), pxZ(5.35));
    g.fillStyle = "#ffffff";
    g.fillRect(-44, -44, 88, 88);
    g.fillStyle = "#c4161c";
    g.fillRect(-12, -36, 24, 72);
    g.fillRect(-36, -12, 72, 24);
    g.restore();
  }
  // the windshield across the top of the nose
  g.fillStyle = "#10151c";
  g.beginPath();
  g.moveTo(uAt(0.95, true) * LIV_W, pxZ(10.05));
  g.lineTo(uAt(1.25, true) * LIV_W, pxZ(10.95));
  g.lineTo(uAt(1.25, false) * LIV_W, pxZ(10.95));
  g.lineTo(uAt(0.95, false) * LIV_W, pxZ(10.05));
  g.closePath();
  g.fill();
  g.fillStyle = "#c9ccd0";
  g.fillRect(LIV_W / 2 - 3, pxZ(10.05), 6, pxZ(10.95) - pxZ(10.05));
  // the radome: a slightly different white
  g.fillStyle = "#dfe2e4";
  g.fillRect(0, pxZ(11.35), LIV_W, LIV_H - pxZ(11.35));

  const map = new THREE.CanvasTexture(c);
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = false;
  map.anisotropy = 8;
  const glow = new THREE.CanvasTexture(e);
  glow.colorSpace = THREE.SRGBColorSpace;
  glow.flipY = false;
  livery = { map, glow };
  return livery;
}

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, stroke = false) {
  if (w < 0) {
    x += w;
    w = -w;
  }
  if (h < 0) {
    y += h;
    h = -h;
  }
  r = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
  if (stroke) g.stroke();
  else g.fill();
}

// ------------------------------------------------------------------ materials
export interface AirMats {
  paint: THREE.MeshStandardMaterial;
  wing: THREE.MeshStandardMaterial;
  metal: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  fin: THREE.MeshStandardMaterial;
  /** plain light grey (fairings) */
  grey: THREE.MeshStandardMaterial;
}
let mats: AirMats | null = null;
export function airMats(): AirMats {
  if (mats) return mats;
  const env = moonSky();
  const L = makeLivery();
  mats = {
    paint: new THREE.MeshStandardMaterial({
      map: L.map,
      emissiveMap: L.glow,
      emissive: 0xffffff,
      emissiveIntensity: 0.9,
      metalness: 0.25,
      roughness: 0.32,
      envMap: env,
      envMapIntensity: 1.1,
    }),
    wing: new THREE.MeshStandardMaterial({ color: 0xc8ccd1, metalness: 0.35, roughness: 0.4, envMap: env, envMapIntensity: 1, vertexColors: true }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb4b9bf, metalness: 0.85, roughness: 0.28, envMap: env }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1d21, metalness: 0.4, roughness: 0.55, envMap: env, envMapIntensity: 0.6 }),
    fin: new THREE.MeshStandardMaterial({ color: 0xeceef0, metalness: 0.25, roughness: 0.32, envMap: env, envMapIntensity: 1.1, vertexColors: true }),
    grey: new THREE.MeshStandardMaterial({ color: 0xbfc4ca, metalness: 0.3, roughness: 0.4, envMap: env, envMapIntensity: 1 }),
  };
  return mats;
}

// ------------------------------------------------------------------ fuselage
/** Fuselage radius and centre-line height at a station z. */
function section(z: number) {
  const { r, nose, tail, noseStart, tailStart } = FUSE;
  if (z > noseStart) {
    const t = (nose - z) / (nose - noseStart); // 1 at the shoulder, 0 at the tip
    const k = Math.pow(1 - Math.pow(1 - t, 2.1), 0.55);
    return { r: Math.max(0.02, r * k), y: -0.32 * Math.pow(1 - t, 1.6) };
  }
  if (z < tailStart) {
    const t = (z - tail) / (tailStart - tail); // 1 at the shoulder, 0 at the tip
    const k = 0.1 + 0.9 * Math.pow(1 - Math.pow(1 - t, 2), 0.75);
    // the belly sweeps up toward the tail; the crown stays nearly level
    return { r: r * k, y: 1.05 * Math.pow(1 - t, 1.35) };
  }
  return { r, y: 0 };
}

/** The fuselage between two stations (default: all of it), as a lathe with the
 *  centre-line bent for the drooped nose and upswept tail. `tear` roughens the
 *  cut ends (the wreck). */
export function fuselageGeometry(z0 = FUSE.tail, z1 = FUSE.nose, tear = 0) {
  const n = Math.max(8, Math.round((z1 - z0) * 6));
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= n; i++) {
    const z = z0 + ((z1 - z0) * i) / n;
    pts.push(new THREE.Vector2(section(z).r, z));
  }
  const seg = 48;
  const geo = new THREE.LatheGeometry(pts, seg);
  geo.rotateX(Math.PI / 2); // lathe y -> z
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    pos.setY(i, pos.getY(i) + section(z).y);
    // livery v runs tail -> nose over the whole aircraft, whatever piece this is
    uv.setY(i, (z - FUSE.tail) / (FUSE.nose - FUSE.tail));
    // lathe u starts at the belly: matches the livery's u
    if (tear) {
      // jagged but continuous: the edge wanders with the angle around the hull
      const ang = Math.atan2(pos.getX(i), -(pos.getY(i) - section(z).y));
      for (const end of [z0, z1]) {
        const inner = end === z0 ? end > FUSE.tail + 0.1 : end < FUSE.nose - 0.1;
        const a = Math.abs(z - end);
        if (!inner || a > 0.7) continue;
        const k = (1 - a / 0.7) * tear;
        const n = Math.sin(ang * 5 + end) * 0.5 + Math.sin(ang * 11 + end * 3) * 0.3 + Math.sin(ang * 23) * 0.15;
        pos.setZ(i, z + n * 0.55 * k * (end === z0 ? 1 : -1));
        // the skin crumples inward a little near the break
        const s = 1 - Math.max(0, n) * 0.08 * k;
        pos.setX(i, pos.getX(i) * s);
        pos.setY(i, (pos.getY(i) - section(z).y) * s + section(z).y);
      }
    }
  }
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ lifting surfaces
/** A smooth airfoil (NACA 00xx thickness, a touch of camber), chord 0..1. */
function airfoil(thick: number, camber: number, n = 14) {
  const up: [number, number][] = [];
  const lo: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const x = (1 - Math.cos((i / n) * Math.PI)) / 2; // bunched at the edges
    const t = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const c = camber * 4 * x * (1 - x);
    up.push([x, c + t]);
    lo.push([x, c - t]);
  }
  // around the section: trailing edge over the top to the nose, back underneath
  return [...up.reverse(), ...lo.slice(1)];
}

export interface Surface {
  /** chords at root and tip (m), span (m) */
  root: number;
  tip: number;
  span: number;
  /** leading-edge sweep: how far the tip's leading edge sits behind the root's */
  sweep: number;
  /** degrees */
  dihedral: number;
  thick: number;
  camber?: number;
  /** "h": span runs along +x (wings, stabiliser); "v": along +y (the fin) */
  axis?: "h" | "v";
  stations?: number;
  /** colour the leading edge and a control-surface line */
  trim?: boolean;
}

/** One wing (or fin): root at the origin's leading edge, chord running back (-z). */
export function surfaceGeometry(s: Surface) {
  const foil = airfoil(s.thick, s.camber ?? 0.015);
  const st = s.stations ?? 8;
  const verts: number[] = [];
  const cols: number[] = [];
  const idx: number[] = [];
  const dih = THREE.MathUtils.degToRad(s.dihedral);
  const ring = foil.length;
  for (let j = 0; j <= st; j++) {
    const f = j / st;
    const c = THREE.MathUtils.lerp(s.root, s.tip, f);
    const le = -s.sweep * f;
    const sp = s.span * f;
    for (const [x, y] of foil) {
      const z = le - x * c;
      const t = y * c;
      if (s.axis === "v") verts.push(t, sp, z);
      else verts.push(sp * Math.cos(dih), t + sp * Math.sin(dih), z);
      // leading edge a touch darker (de-ice boots), the aileron/flap line too
      const lead = x < 0.06 ? 0.72 : 1;
      const flap = s.trim && Math.abs(x - 0.74) < 0.012 ? 0.6 : 1;
      const k = lead * flap;
      cols.push(k, k, k);
    }
  }
  for (let j = 0; j < st; j++)
    for (let i = 0; i < ring - 1; i++) {
      const a = j * ring + i;
      const b = a + ring;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  // close the tip
  const tip = st * ring;
  for (let i = 1; i < ring / 2 - 1; i++) {
    idx.push(tip + i, tip + i + 1, tip + ring - 1 - i, tip + i + 1, tip + ring - 2 - i, tip + ring - 1 - i);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Mirror a geometry across x (the other wing). */
function mirrorX(g: THREE.BufferGeometry) {
  const m = g.clone();
  m.scale(-1, 1, 1);
  const i = m.index!;
  for (let k = 0; k < i.count; k += 3) {
    const a = i.getX(k + 1);
    i.setX(k + 1, i.getX(k + 2));
    i.setX(k + 2, a);
  }
  m.computeVertexNormals();
  return m;
}

// ------------------------------------------------------------------ engines
function nacelle(m: AirMats) {
  const g = new THREE.Group();
  const L = 3.5;
  const pts: THREE.Vector2[] = [];
  // outer skin from the intake lip back to the exhaust
  const prof: [number, number][] = [
    [0.5, L / 2],
    [0.6, L / 2 - 0.08],
    [0.66, L / 2 - 0.35],
    [0.68, L / 2 - 1.0],
    [0.64, -L / 2 + 0.9],
    [0.5, -L / 2 + 0.1],
    [0.46, -L / 2],
  ];
  for (const [r, z] of prof) pts.push(new THREE.Vector2(r, z));
  const skin = new THREE.LatheGeometry(pts, 32);
  skin.rotateX(Math.PI / 2);
  const body = new THREE.Mesh(skin, m.metal.clone());
  (body.material as THREE.MeshStandardMaterial).color.setHex(0xe4e7ea);
  (body.material as THREE.MeshStandardMaterial).metalness = 0.3;
  (body.material as THREE.MeshStandardMaterial).roughness = 0.3;
  g.add(body);
  // polished intake lip
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.055, 10, 32), m.metal);
  lip.position.z = L / 2 - 0.03;
  g.add(lip);
  // the inside of the intake, the fan and its spinner
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 32, 1, true), m.dark);
  inner.rotation.x = Math.PI / 2;
  inner.position.z = L / 2 - 0.3;
  (inner.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  g.add(inner);
  const fan = new THREE.Mesh(new THREE.CircleGeometry(0.5, 32), new THREE.MeshStandardMaterial({ color: 0x2a2d31, metalness: 0.7, roughness: 0.45 }));
  fan.position.z = L / 2 - 0.55;
  g.add(fan);
  const blades = new THREE.Group();
  for (let i = 0; i < 18; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.44, 0.01), m.metal);
    b.position.y = 0.26;
    b.rotation.y = 0.5;
    const arm = new THREE.Group();
    arm.rotation.z = (i / 18) * Math.PI * 2;
    arm.add(b);
    blades.add(arm);
  }
  blades.position.z = L / 2 - 0.52;
  g.add(blades);
  g.userData.fan = blades;
  const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.32, 20), m.metal);
  spinner.rotation.x = Math.PI / 2;
  spinner.position.z = L / 2 - 0.4;
  g.add(spinner);
  // exhaust: dark hot section and a plug
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.46, 0.3, 28, 1, true), m.dark);
  nozzle.rotation.x = Math.PI / 2;
  nozzle.position.z = -L / 2 - 0.1;
  (nozzle.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  g.add(nozzle);
  const plug = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.7, 20), new THREE.MeshStandardMaterial({ color: 0x3a3632, metalness: 0.6, roughness: 0.5 }));
  plug.rotation.x = -Math.PI / 2;
  plug.position.z = -L / 2 - 0.3;
  g.add(plug);
  return g;
}

// ------------------------------------------------------------------ lights
let glowTex: THREE.Texture | null = null;
function glow() {
  if (glowTex) return glowTex;
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.15, "rgba(255,255,255,0.75)");
  r.addColorStop(0.45, "rgba(255,255,255,0.12)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 64, 64);
  glowTex = new THREE.CanvasTexture(c);
  return glowTex;
}
function lamp(color: number, size: number) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  s.scale.setScalar(size);
  return s;
}

// ------------------------------------------------------------------ the aircraft
export interface Aircraft {
  group: THREE.Group;
  /** nav lights steady, strobes and beacons blink; fans turn */
  update(dt: number, t: number): void;
  /** inside lights (window glow): 0 dark .. 1 normal; alarm tints red */
  cabin(level: number, alarm?: boolean): void;
  lights: THREE.Sprite[];
}

export function buildAircraft(opts: { lights?: boolean } = {}): Aircraft {
  const m = airMats();
  const g = new THREE.Group();
  const R = FUSE.r;

  const fus = new THREE.Mesh(fuselageGeometry(), m.paint);
  g.add(fus);

  // wings: low, swept, with dihedral and winglets
  const wingSpec: Surface = { root: 3.9, tip: 1.25, span: 8.6, sweep: 3.3, dihedral: 3, thick: 0.13, camber: 0.02, trim: true };
  const wingL = surfaceGeometry(wingSpec);
  const wingR = mirrorX(wingL);
  for (const [geo, side] of [
    [wingL, 1],
    [wingR, -1],
  ] as const) {
    const w = new THREE.Mesh(geo, m.wing);
    w.position.set(side * R * 0.62, -R * 0.68, 2.1);
    g.add(w);
    // winglet: canted up and out at the tip
    const wl = new THREE.Mesh(surfaceGeometry({ root: 1.2, tip: 0.5, span: 1.35, sweep: 0.9, dihedral: 0, thick: 0.1, axis: "v", stations: 4 }), m.fin);
    const tipX = side * (R * 0.62 + 8.6 * Math.cos(THREE.MathUtils.degToRad(3)));
    wl.position.set(tipX, -R * 0.68 + 8.6 * Math.sin(THREE.MathUtils.degToRad(3)) + 0.05, 2.1 - 3.3);
    wl.rotation.z = -side * 0.22;
    g.add(wl);
    // flap-track fairings under the wing
    for (const f of [0.28, 0.55]) {
      const fair = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.9, 4, 8), m.grey);
      fair.rotation.x = Math.PI / 2;
      fair.position.set(side * (R * 0.62 + 8.6 * f), -R * 0.68 + 8.6 * f * 0.052 - 0.12, 2.1 - 3.3 * f - THREE.MathUtils.lerp(3.9, 1.25, f) * 0.85);
      g.add(fair);
    }
  }
  // the wing-to-body fairing
  const belly = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 16), m.grey);
  belly.scale.set(R * 0.86, 0.42, 3.4);
  belly.position.set(0, -R * 0.78, 0.4);
  g.add(belly);

  // T-tail: swept fin and the stabiliser on top
  const fin = new THREE.Mesh(surfaceGeometry({ root: 4.1, tip: 2.3, span: 3.4, sweep: 2.9, dihedral: 0, thick: 0.1, axis: "v" }), m.fin);
  fin.position.set(0, 1.05 + R * 0.62, -7.0);
  g.add(fin);
  const stab = surfaceGeometry({ root: 2.1, tip: 0.95, span: 3.6, sweep: 1.5, dihedral: 2, thick: 0.09, trim: true });
  for (const geo of [stab, mirrorX(stab)]) {
    const s = new THREE.Mesh(geo, m.wing);
    s.position.set(0, 1.05 + R * 0.62 + 3.35, -7.0 - 2.85);
    g.add(s);
  }
  // fin bullet fairing
  const bullet = new THREE.Mesh(new THREE.CapsuleGeometry(0.16, 1.6, 6, 12), m.grey);
  bullet.rotation.x = Math.PI / 2;
  bullet.position.set(0, 1.05 + R * 0.62 + 3.38, -10.4);
  g.add(bullet);

  // engines on pylons either side of the rear fuselage
  const fans: THREE.Object3D[] = [];
  for (const side of [1, -1]) {
    const n = nacelle(m);
    n.position.set(side * (R + 0.95), 0.55, -5.6);
    g.add(n);
    fans.push(n.userData.fan);
    const pg = surfaceGeometry({ root: 2.0, tip: 1.6, span: 0.75, sweep: 0.25, dihedral: 0, thick: 0.12, stations: 2 });
    const pylon = new THREE.Mesh(side > 0 ? pg : mirrorX(pg), m.wing);
    pylon.position.set(side * R * 0.78, 0.55, -4.5);
    g.add(pylon);
  }

  // small things that say "real": antennas, pitot tubes, a beacon on each side
  const blade = (x: number, y: number, z: number, rz = 0) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.28, 0.22), m.dark);
    b.geometry.translate(0, 0.14, 0);
    b.position.set(x, y, z);
    b.rotation.set(-0.35, 0, rz);
    g.add(b);
  };
  blade(0, R + 0.02, 3.5);
  blade(0, R + 0.02, -1.5);
  blade(0, -R + 0.02, 1.0, Math.PI);
  for (const s of [1, -1]) {
    const pitot = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.22, 6), m.metal);
    pitot.rotation.x = Math.PI / 2;
    pitot.position.set(s * 0.92, -0.05, 9.8);
    g.add(pitot);
  }

  // lights
  const lights: THREE.Sprite[] = [];
  const steady: THREE.Sprite[] = [];
  const strobes: THREE.Sprite[] = [];
  const beacons: THREE.Sprite[] = [];
  if (opts.lights !== false) {
    const tipY = -R * 0.68 + 8.6 * Math.sin(THREE.MathUtils.degToRad(3));
    const tipX = R * 0.62 + 8.6 * Math.cos(THREE.MathUtils.degToRad(3));
    const add = (s: THREE.Sprite, x: number, y: number, z: number, list: THREE.Sprite[]) => {
      s.position.set(x, y, z);
      g.add(s);
      list.push(s);
      lights.push(s);
    };
    add(lamp(0xff2a22, 1.6), tipX + 0.1, tipY + 0.15, -1.6, steady); // port: red
    add(lamp(0x2aff6a, 1.6), -tipX - 0.1, tipY + 0.15, -1.6, steady); // starboard: green
    add(lamp(0xffffff, 1.2), 0, 1.05 + R * 0.62 + 3.4, -11.3, steady); // tail: white
    add(lamp(0xffffff, 3.2), tipX + 0.15, tipY + 0.2, -1.9, strobes);
    add(lamp(0xffffff, 3.2), -tipX - 0.15, tipY + 0.2, -1.9, strobes);
    add(lamp(0xff3020, 1.8), 0, R + 0.12, 0.5, beacons);
    add(lamp(0xff3020, 1.8), 0, -R - 0.85, -0.5, beacons);
  }
  // logo light: the fin lit from the stabiliser
  const logo = new THREE.SpotLight(0xffffff, opts.lights === false ? 0 : 40, 8, 0.6, 0.6, 1);
  logo.position.set(0, 1.05 + R * 0.62 + 3.3, -9.6);
  logo.target.position.set(0, 1.05 + R * 0.62 + 1.2, -7.5);
  g.add(logo, logo.target);

  const ac: Aircraft = {
    group: g,
    lights,
    update(dt, t) {
      const flash = t % 1.25 < 0.06 || (t % 1.25 > 0.16 && t % 1.25 < 0.2);
      for (const s of strobes) s.visible = flash;
      const b = 0.5 + 0.5 * Math.sin(t * 6.5);
      for (const s of beacons) (s.material as THREE.SpriteMaterial).opacity = b * b;
      for (const s of steady) s.visible = true;
      for (const f of fans) f.rotation.z += dt * 40;
    },
    cabin(level, alarm = false) {
      m.paint.emissiveIntensity = 0.9 * level;
      m.paint.emissive.setHex(alarm ? 0xff6050 : 0xffffff);
    },
  };
  return ac;
}

// ------------------------------------------------------------------ the wreck
/** Pieces of the same aircraft, torn apart: fuselage sections, a wing, the tail. */
export function wreckPieces() {
  const m = airMats();
  const scorch = new THREE.MeshStandardMaterial({ color: 0x14110f, roughness: 1 });
  const dirty = m.paint.clone();
  dirty.emissiveIntensity = 0;
  dirty.color.setHex(0x74726e); // soot and mud over the paint (white paint glares in firelight)
  dirty.roughness = 0.6;
  dirty.envMapIntensity = 0.5;
  const inside = new THREE.MeshStandardMaterial({ color: 0x2a2724, roughness: 0.95, side: THREE.BackSide });
  const piece = (z0: number, z1: number) => {
    const gr = new THREE.Group();
    const geo = fuselageGeometry(z0, z1, 1);
    gr.add(new THREE.Mesh(geo, dirty));
    // the inside: bare, dark, insulation and frames
    gr.add(new THREE.Mesh(geo, inside));
    // soot around the torn ends
    for (const z of [z0, z1]) {
      if (z <= FUSE.tail + 0.1 || z >= FUSE.nose - 0.1) continue;
      const s = section(z);
      const ring = new THREE.Mesh(new THREE.CylinderGeometry(s.r + 0.02, s.r + 0.02, 1.1, 32, 1, true), scorch);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, s.y, z + (z === z0 ? 0.45 : -0.45));
      (ring.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      gr.add(ring);
    }
    return gr;
  };
  const wing = new THREE.Mesh(surfaceGeometry({ root: 3.9, tip: 1.25, span: 8.6, sweep: 3.3, dihedral: 3, thick: 0.13, trim: true }), m.wing);
  const tail = new THREE.Group();
  const tg = fuselageGeometry(FUSE.tail, -6.2, 1);
  tail.add(new THREE.Mesh(tg, dirty), new THREE.Mesh(tg, inside));
  const fin = new THREE.Mesh(surfaceGeometry({ root: 4.1, tip: 2.3, span: 3.4, sweep: 2.9, dihedral: 0, thick: 0.1, axis: "v" }), m.fin);
  fin.position.set(0, 1.05 + FUSE.r * 0.62, -7.0);
  tail.add(fin);
  const eng = nacelle(m);
  return { piece, wing, tail, engine: eng };
}

// ------------------------------------------------------------------ clouds
const NOISE = /* glsl */ `
  float h21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
  float vnoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(h21(i), h21(i + vec2(1, 0)), u.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0, a = 0.5;
    for (int i = 0; i < OCT; i++) { v += a * vnoise(p); p = p * 2.03 + vec2(17.1, 9.2); a *= 0.5; }
    return v;
  }
`;

/** A moonlit sea of cloud tops far below, drifting under the aircraft. */
export function cloudSea(low = false) {
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    fog: false,
    defines: { OCT: low ? 4 : 6 },
    uniforms: {
      uTime: { value: 0 },
      uSpeed: { value: 70 },
      uMoon: { value: new THREE.Vector2(0.55, 0.35).normalize() },
      uLit: { value: new THREE.Color(0xb7c3d8) },
      uShade: { value: new THREE.Color(0x2b3549) },
      uHaze: { value: new THREE.Color(0x1b263a) },
      uFlash: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime, uSpeed, uFlash;
      uniform vec2 uMoon;
      uniform vec3 uLit, uShade, uHaze;
      varying vec3 vW;
      ${NOISE}
      void main() {
        vec2 p = vW.xz * 0.0045 + vec2(0.0, uTime * uSpeed * 0.0045);
        vec2 q = vec2(fbm(p + 3.1), fbm(p + 7.7));
        float d = fbm(p + q * 0.9);
        float dens = smoothstep(0.38, 0.72, d);
        // light: brighter where the cloud rises toward the moon
        float d2 = fbm(p + q * 0.9 + uMoon * 0.06);
        float lit = clamp(0.55 + (d - d2) * 6.0, 0.0, 1.0);
        vec3 col = mix(uShade, uLit, lit * (0.4 + dens * 0.6));
        col += uFlash * vec3(0.6, 0.85, 1.0) * dens;
        float dist = length(vW.xz - cameraPosition.xz);
        float fade = 1.0 - smoothstep(900.0, 2600.0, dist);
        col = mix(uHaze, col, fade);
        gl_FragColor = vec4(col, (0.25 + dens * 0.75) * (0.35 + fade * 0.65));
        #include <colorspace_fragment>
      }
    `,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6000, 6000, 1, 1), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = -1;
  return { mesh, mat };
}

/** Soft cloud puffs (procedural, a few variants) for streaming past. */
let puffTex: THREE.Texture[] | null = null;
export function puffTextures() {
  if (puffTex) return puffTex;
  puffTex = [];
  for (let v = 0; v < 3; v++) {
    const S = 128;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d")!;
    // a cluster of soft blobs, brighter on top (moonlit)
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * S * 0.26;
      const x = S / 2 + Math.cos(a) * r * 1.3;
      const y = S / 2 + Math.sin(a) * r * 0.7;
      const rad = S * (0.1 + Math.random() * 0.16);
      const k = 0.55 + 0.45 * (1 - (y - S * 0.25) / (S * 0.5));
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const l = Math.round(150 + 105 * Math.max(0, Math.min(1, k)));
      gr.addColorStop(0, `rgba(${l},${l + 4},${l + 12},0.32)`);
      gr.addColorStop(1, `rgba(${l},${l + 4},${l + 12},0)`);
      g.fillStyle = gr;
      g.fillRect(0, 0, S, S);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    puffTex.push(t);
  }
  return puffTex;
}
