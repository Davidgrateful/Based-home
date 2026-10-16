// The ambulance you wake up in: a Type III box ambulance, torn out of the
// medevac jet's hold. A van cab up front, the patient module behind it with
// rounded corners, a painted livery, compartment doors, a light bar, dual rear
// wheels, and a proper treatment room inside.
//
// Same frame as the old box (the story, the doors, the axe on the wall and
// the tally marks scratched into the side all rely on it): the module's floor
// is at y 0.3, it runs z -3.25..3.25 with the rear doors at +z, the cab ahead
// at -z, and the outside of the side walls is at x = ±1.40.

import * as THREE from "three";
import { moonSky } from "./aircraft";

const W = 2.7;
const H = 2.6;
const L = 6.5;
const FLOOR = 0.3;

const std = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function canvasTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

/** A rounded box (bevelled extrusion). */
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
  const geo = new THREE.ExtrudeGeometry(shape, { depth: Math.max(0.001, d - r * 2), bevelEnabled: true, bevelThickness: r, bevelSize: r * 0.9, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -(d - r * 2) / 2);
  return new THREE.Mesh(geo, m);
}

/** The module's side livery: white with a red band, a blue pinstripe, the
 *  word AMBULANCE, a star of life, compartment doors and a scrape or two. */
function sideLivery(flip: boolean) {
  return canvasTex(1300, 520, (g) => {
    const Wd = 1300;
    const Hd = 520;
    g.clearRect(0, 0, Wd, Hd);
    // grime toward the bottom
    const dirt = g.createLinearGradient(0, Hd * 0.55, 0, Hd);
    dirt.addColorStop(0, "rgba(60,50,40,0)");
    dirt.addColorStop(1, "rgba(60,50,40,0.45)");
    g.fillStyle = dirt;
    g.fillRect(0, 0, Wd, Hd);
    // red band and blue pinstripe
    g.fillStyle = "#c4161c";
    g.fillRect(0, Hd * 0.52, Wd, Hd * 0.11);
    g.fillStyle = "#1d58b8";
    g.fillRect(0, Hd * 0.65, Wd, Hd * 0.025);
    g.save();
    if (flip) {
      g.translate(Wd, 0);
      g.scale(-1, 1);
    }
    // compartment doors (toward the cab end) with chrome handles
    g.strokeStyle = "rgba(70,74,80,0.85)";
    g.lineWidth = 4;
    for (const [x0, w] of [
      [40, 230],
      [285, 170],
    ]) {
      g.strokeRect(x0, Hd * 0.12, w, Hd * 0.74);
      g.fillStyle = "#b9bec4";
      g.fillRect(x0 + w - 40, Hd * 0.42, 26, 10);
    }
    // a side window, frosted
    g.fillStyle = "#2a3540";
    g.fillRect(560, Hd * 0.13, 230, Hd * 0.3);
    g.fillStyle = "rgba(220,230,235,0.25)";
    g.fillRect(560, Hd * 0.13, 230, Hd * 0.3);
    g.restore();
    // AMBULANCE, always reading forwards
    g.fillStyle = "#c4161c";
    g.font = "bold 92px Arial, Helvetica, sans-serif";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText("AMBULANCE", flip ? Wd * 0.36 : Wd * 0.64, Hd * 0.79 + 18);
    // star of life
    const sx = flip ? 160 : Wd - 160;
    const sy = Hd * 0.3;
    g.fillStyle = "#1d58b8";
    for (let k = 0; k < 3; k++) {
      g.save();
      g.translate(sx, sy);
      g.rotate((k * Math.PI) / 3);
      g.fillRect(-18, -62, 36, 124);
      g.restore();
    }
    g.fillStyle = "#ffffff";
    g.fillRect(sx - 4, sy - 44, 8, 88);
    // scrapes from the crash
    g.strokeStyle = "rgba(40,40,44,0.55)";
    g.lineWidth = 2;
    for (let i = 0; i < 14; i++) {
      const y = Hd * (0.25 + Math.random() * 0.6);
      const x = Math.random() * Wd;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 80 + Math.random() * 160, y + (Math.random() - 0.5) * 30);
      g.stroke();
    }
  });
}

export interface AmbulanceParts {
  group: THREE.Group;
  doorL: THREE.Group;
  doorR: THREE.Group;
  light: THREE.PointLight;
  monitor: THREE.MeshStandardMaterial;
  axe: THREE.Group;
  /** red / blue light-bar materials, flashed by the world */
  roofLights: THREE.MeshStandardMaterial[];
}

export function buildAmbulance(glowTexture: () => THREE.Texture): AmbulanceParts {
  const g = new THREE.Group();
  const env = moonSky();
  const paint = std(0xeef0f1, { roughness: 0.35, metalness: 0.15, envMap: env, envMapIntensity: 0.7 });
  const chrome = std(0xc9ced4, { roughness: 0.2, metalness: 0.9, envMap: env });
  const black = std(0x16181a, { roughness: 0.7 });
  const rubber = std(0x101112, { roughness: 0.9 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x1a2530, roughness: 0.05, metalness: 0.7, envMap: env, envMapIntensity: 1.2 });
  const add = <T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0, parent: THREE.Object3D = g) => {
    o.position.set(x, y, z);
    o.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = m.receiveShadow = true;
    });
    parent.add(o);
    return o;
  };

  // ---------- the patient module: rounded shell, open at the back
  {
    const outer = new THREE.Shape();
    const r = 0.16;
    const hw = W / 2 + 0.05;
    const y0 = FLOOR - 0.06;
    const y1 = FLOOR + H + 0.06;
    outer.moveTo(-hw + r, y0);
    outer.lineTo(hw - r, y0);
    outer.quadraticCurveTo(hw, y0, hw, y0 + r);
    outer.lineTo(hw, y1 - r);
    outer.quadraticCurveTo(hw, y1, hw - r, y1);
    outer.lineTo(-hw + r, y1);
    outer.quadraticCurveTo(-hw, y1, -hw, y1 - r);
    outer.lineTo(-hw, y0 + r);
    outer.quadraticCurveTo(-hw, y0, -hw + r, y0);
    const hole = new THREE.Path();
    const iw = W / 2 - 0.06;
    hole.moveTo(-iw, FLOOR);
    hole.lineTo(-iw, FLOOR + H - 0.04);
    hole.lineTo(iw, FLOOR + H - 0.04);
    hole.lineTo(iw, FLOOR);
    hole.lineTo(-iw, FLOOR);
    outer.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(outer, { depth: L, bevelEnabled: false, curveSegments: 6 });
    geo.translate(0, 0, -L / 2);
    add(new THREE.Mesh(geo, paint));
    // front wall of the module (toward the cab), with a pass-through window
    add(new THREE.Mesh(new THREE.BoxGeometry(W + 0.1, H + 0.1, 0.08), paint), 0, FLOOR + H / 2, -L / 2 - 0.02);
    // livery decals on both sides
    for (const s of [-1, 1]) {
      const dec = new THREE.Mesh(new THREE.PlaneGeometry(L - 0.2, H - 0.1), new THREE.MeshStandardMaterial({ map: sideLivery(s < 0), transparent: true, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }));
      dec.rotation.y = (s * Math.PI) / 2;
      add(dec, s * (W / 2 + 0.056), FLOOR + H / 2, 0);
    }
    // roof: a star of life, an AC unit, the light bar
    const roofStar = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({ map: canvasTex(256, 256, (q) => {
      q.translate(128, 128);
      q.fillStyle = "#1d58b8";
      for (let k = 0; k < 3; k++) {
        q.save();
        q.rotate((k * Math.PI) / 3);
        q.fillRect(-26, -100, 52, 200);
        q.restore();
      }
    }), transparent: true }));
    roofStar.rotation.x = -Math.PI / 2;
    add(roofStar, 0, FLOOR + H + 0.065, 0.6);
    add(soft(1.0, 0.22, 0.9, 0.05, std(0xd6d9dc, { roughness: 0.5 })), 0.5, FLOOR + H + 0.17, -1.6);
    // drip rails and corner markers
    for (const s of [-1, 1]) {
      add(new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, L), chrome), s * (W / 2 + 0.04), FLOOR + H + 0.04, 0);
      for (const z of [-L / 2 + 0.12, L / 2 - 0.12]) {
        const warn = std(0x330000, { emissive: 0xff2a1a, emissiveIntensity: 0.6 });
        add(soft(0.08, 0.28, 0.2, 0.02, warn), s * (W / 2 + 0.07), FLOOR + H - 0.25, z);
      }
    }
    // underbody: frame rails, a step bumper at the back
    add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.5, 0.18, L + 1.5), black), 0, FLOOR - 0.15, -0.6);
    add(soft(W + 0.1, 0.12, 0.3, 0.03, std(0x2a2c2e, { roughness: 0.5, metalness: 0.4 })), 0, FLOOR - 0.12, L / 2 + 0.12);
  }

  // ---------- the cab: a van front with a sloped hood and a raked windshield
  {
    const prof = new THREE.Shape();
    // side profile in (z, y): back of cab at z=0, nose at z=-2.3
    prof.moveTo(0, 0.05);
    prof.lineTo(0, 2.15);
    prof.lineTo(-0.85, 2.15);
    prof.quadraticCurveTo(-1.05, 2.12, -1.25, 1.55); // windshield rake
    prof.lineTo(-1.9, 1.32); // hood
    prof.quadraticCurveTo(-2.25, 1.25, -2.3, 1.0);
    prof.lineTo(-2.32, 0.35); // grille face
    prof.quadraticCurveTo(-2.3, 0.08, -2.0, 0.05);
    prof.lineTo(0, 0.05);
    const cw = W - 0.15;
    const geo = new THREE.ExtrudeGeometry(prof, { depth: cw - 0.12, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.06, bevelSegments: 3, curveSegments: 8 });
    geo.translate(0, 0, -(cw - 0.12) / 2);
    const cab = new THREE.Mesh(geo, paint);
    cab.rotation.y = -Math.PI / 2; // shape x -> world z, extrusion -> world x
    const cabG = new THREE.Group();
    cabG.add(cab);
    add(cabG, 0, FLOOR - 0.1, -L / 2 - 0.06);
    // windshield and side windows, sunk into the shell
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(cw - 0.2, 0.8), glass);
    ws.rotation.x = -1.0;
    ws.rotation.y = Math.PI;
    add(ws, 0, FLOOR - 0.1 + 1.86, -L / 2 - 0.06 - 1.07);
    for (const s of [-1, 1]) {
      const sw = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.55), glass);
      sw.rotation.y = (s * Math.PI) / 2;
      add(sw, s * (cw / 2 + 0.065), FLOOR - 0.1 + 1.72, -L / 2 - 0.06 - 0.5);
      // red stripe continues along the cab doors
      const band = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 0.27), std(0xc4161c, { roughness: 0.4 }));
      band.rotation.y = (s * Math.PI) / 2;
      add(band, s * (cw / 2 + 0.066), FLOOR + 1.32, -L / 2 - 1.1);
      // mirrors on arms
      add(soft(0.08, 0.32, 0.2, 0.03, black), s * (cw / 2 + 0.32), FLOOR + 1.6, -L / 2 - 1.15);
      add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 6), chrome), s * (cw / 2 + 0.18), FLOOR + 1.6, -L / 2 - 1.15).rotation.z = Math.PI / 2;
      // headlights and indicators
      const head = add(soft(0.42, 0.2, 0.06, 0.03, std(0xf2f4f6, { emissive: 0xfff1d0, emissiveIntensity: 0.5, roughness: 0.1 })), s * 0.82, FLOOR + 0.75, -L / 2 - 2.38);
      head.rotation.x = 0.05;
      add(soft(0.14, 0.08, 0.05, 0.02, std(0xffa020, { emissive: 0xff8000, emissiveIntensity: 0.3 })), s * 1.1, FLOOR + 0.6, -L / 2 - 2.37);
    }
    // grille and bumper
    add(soft(1.0, 0.36, 0.05, 0.03, black), 0, FLOOR + 0.62, -L / 2 - 2.41);
    for (let i = 0; i < 4; i++) add(new THREE.Mesh(new THREE.BoxGeometry(0.92, 0.02, 0.02), chrome), 0, FLOOR + 0.5 + i * 0.08, -L / 2 - 2.44);
    add(soft(W - 0.05, 0.22, 0.24, 0.06, std(0x2a2c2e, { roughness: 0.5, metalness: 0.3 })), 0, FLOOR + 0.18, -L / 2 - 2.38);
  }

  // ---------- wheels: tyres with real sidewalls, steel rims, duals at the back
  {
    const tyreGeo = new THREE.TorusGeometry(0.33, 0.13, 12, 28);
    const rimGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.2, 20);
    rimGeo.rotateZ(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.24, 12);
    hubGeo.rotateZ(Math.PI / 2);
    const rim = std(0xa4a9ae, { metalness: 0.8, roughness: 0.35, envMap: env });
    const wheel = (x: number, z: number) => {
      const w = new THREE.Group();
      const tyre = new THREE.Mesh(tyreGeo, rubber);
      tyre.rotation.y = Math.PI / 2;
      tyre.scale.z = 1.5;
      w.add(tyre, new THREE.Mesh(rimGeo, rim), new THREE.Mesh(hubGeo, chrome));
      add(w, x, 0.46, z);
    };
    for (const s of [-1, 1]) {
      wheel(s * 1.12, -L / 2 - 1.55);
      wheel(s * 1.02, 2.0);
      wheel(s * 1.32, 2.0);
      // wheel arches
      const arch = new THREE.Mesh(new THREE.TorusGeometry(0.56, 0.06, 6, 20, Math.PI), black);
      arch.rotation.y = Math.PI / 2;
      add(arch, s * (W / 2 + 0.06), 0.46, 2.0);
    }
  }

  // ---------- light bar and the roof lights the world flashes
  const roofLights: THREE.MeshStandardMaterial[] = [];
  {
    add(soft(1.9, 0.12, 0.34, 0.05, black), 0, FLOOR + H + 0.12, -L / 2 + 0.25);
    for (const [x, col] of [
      [-0.55, 0xff1a2a],
      [0.55, 0x1a6bff],
    ] as const) {
      const m = std(col, { emissive: col, emissiveIntensity: 2, roughness: 0.15, transparent: true, opacity: 0.92 });
      roofLights.push(m);
      add(soft(0.78, 0.13, 0.28, 0.05, m), x, FLOOR + H + 0.24, -L / 2 + 0.25);
    }
    // the cab's own bar
    add(soft(1.5, 0.1, 0.26, 0.04, std(0x991015, { emissive: 0xff1a1a, emissiveIntensity: 0.8 })), 0, FLOOR - 0.1 + 2.22, -L / 2 - 0.5);
  }

  // ---------- inside: the treatment room
  const inner = std(0xd9dcd8, { roughness: 0.8 });
  const panel = std(0xc3c9c8, { roughness: 0.7 });
  const floorM = std(0x3a4247, { roughness: 0.85 });
  add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.12, 0.04, L - 0.1), floorM), 0, FLOOR + 0.02, 0);
  for (const s of [-1, 1]) add(new THREE.Mesh(new THREE.BoxGeometry(0.02, H - 0.2, L - 0.2), inner), s * (W / 2 - 0.07), FLOOR + H / 2, 0);
  add(new THREE.Mesh(new THREE.BoxGeometry(W - 0.14, 0.02, L - 0.2), inner), 0, FLOOR + H - 0.07, 0);
  // ceiling light panels and a grab rail
  for (const z of [-1.8, 0, 1.8]) add(soft(0.9, 0.03, 0.5, 0.01, std(0xffffff, { emissive: 0xdde8ff, emissiveIntensity: 0.5 })), 0, FLOOR + H - 0.09, z);
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, L - 0.8, 8), chrome);
  rail.rotation.x = Math.PI / 2;
  add(rail, -0.25, FLOOR + H - 0.32, 0);
  // the cot: frame, mattress, a pillow, straps
  {
    const cot = new THREE.Group();
    for (const [x, z] of [
      [-0.28, -0.85],
      [0.28, -0.85],
      [-0.28, 0.85],
      [0.28, 0.85],
    ]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.5, 8), chrome);
      leg.position.set(x, FLOOR + 0.3, z);
      cot.add(leg);
    }
    const frame = soft(0.66, 0.06, 2.0, 0.02, chrome);
    frame.position.y = FLOOR + 0.58;
    cot.add(frame);
    const mat = soft(0.62, 0.11, 1.95, 0.045, std(0x2f4a62, { roughness: 0.45 }));
    mat.position.y = FLOOR + 0.66;
    cot.add(mat);
    const pillow = soft(0.44, 0.08, 0.32, 0.035, std(0xe8eaec, { roughness: 0.9 }));
    pillow.position.set(0, FLOOR + 0.74, -0.75);
    pillow.rotation.x = 0.15;
    cot.add(pillow);
    // a rumpled blanket, thrown back
    const bl = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9, 10, 10), std(0x7a96ad, { roughness: 1, side: THREE.DoubleSide }));
    const bp = bl.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.sin(bp.getY(i) * 9) * 0.03 + Math.cos(bp.getX(i) * 7) * 0.02);
    bl.geometry.computeVertexNormals();
    bl.rotation.x = -Math.PI / 2;
    bl.position.set(0.02, FLOOR + 0.74, 0.55);
    cot.add(bl);
    add(cot, -0.55, 0, -0.6);
  }
  // cabinets along the right wall: doors, handles, a sharps box, gloves
  {
    const cab = new THREE.Group();
    const body = soft(0.4, 1.4, 2.2, 0.03, panel);
    body.position.y = FLOOR + 1.6;
    cab.add(body);
    for (const z of [-0.75, 0, 0.75]) {
      const door = soft(0.02, 0.62, 0.68, 0.01, std(0xe9ece9, { roughness: 0.5 }));
      door.position.set(-0.21, FLOOR + 1.85, z);
      cab.add(door);
      const h = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.02, 0.14), chrome);
      h.position.set(-0.23, FLOOR + 1.6, z);
      cab.add(h);
      const door2 = soft(0.02, 0.6, 0.68, 0.01, std(0xe9ece9, { roughness: 0.5 }));
      door2.position.set(-0.21, FLOOR + 1.2, z);
      cab.add(door2);
    }
    const sharps = soft(0.12, 0.2, 0.16, 0.02, std(0xd8241a, { roughness: 0.5 }));
    sharps.position.set(-0.27, FLOOR + 0.78, 0.9);
    cab.add(sharps);
    const gloves = soft(0.12, 0.12, 0.24, 0.015, std(0x3a6ad8, { roughness: 0.6 }));
    gloves.position.set(-0.27, FLOOR + 0.95, 0.5);
    cab.add(gloves);
    // bench seat below, vinyl
    const bench = soft(0.5, 0.12, 1.8, 0.04, std(0x2f4a62, { roughness: 0.45 }));
    bench.position.set(-0.05, FLOOR + 0.48, 0.4);
    cab.add(bench);
    add(cab, 1.05, 0, -1.0);
  }
  // heart monitor on its bracket (the world flickers it)
  const monitor = std(0x001a08, { emissive: 0x19ff6a, emissiveIntensity: 1.2 });
  add(soft(0.08, 0.5, 0.6, 0.02, std(0x222222)), 1.08, FLOOR + 1.4, 1.0);
  add(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.38, 0.48), monitor), 1.03, FLOOR + 1.4, 1.0);
  // oxygen, fallen over, and a dropped kit bag
  const tank = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.62, 6, 14), std(0x2c7a3f, { metalness: 0.3, roughness: 0.35, envMap: env }));
  tank.rotation.z = 1.35;
  add(tank, 0.55, FLOOR + 0.13, 2.2);
  add(soft(0.5, 0.26, 0.32, 0.06, std(0xb3241f, { roughness: 0.6 })), 0.3, FLOOR + 0.14, 1.2).rotation.y = 0.5;

  // fire axe on the wall bracket
  const axe = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.03, 0.95, 10), std(0xb52b20, { roughness: 0.4 }));
  axe.add(handle);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.2, 0.28), std(0xc9ccd2, { metalness: 0.85, roughness: 0.3, envMap: env }));
  blade.position.set(0, 0.38, 0.13);
  axe.add(blade);
  axe.position.set(-1.2, 1.7, 1.6);
  axe.rotation.y = Math.PI / 2;
  g.add(axe);
  for (const y of [-0.3, 0.25]) add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.04, 0.08), chrome), -1.27, 1.7 + y, 1.6);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffcc66, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.scale.setScalar(1.1);
  axe.add(glow);

  // rear doors (hinged), with windows and reflective chevrons
  const chevrons = canvasTex(256, 256, (q) => {
    q.fillStyle = "#eef0f1";
    q.fillRect(0, 0, 256, 256);
    q.save();
    q.beginPath();
    q.rect(0, 150, 256, 106);
    q.clip();
    for (let i = -4; i < 8; i++) {
      q.fillStyle = i % 2 ? "#d61f1f" : "#f2d21c";
      q.beginPath();
      q.moveTo(i * 40, 256);
      q.lineTo(i * 40 + 40, 256);
      q.lineTo(i * 40 + 140, 150);
      q.lineTo(i * 40 + 100, 150);
      q.fill();
    }
    q.restore();
    q.fillStyle = "#c4161c";
    q.fillRect(0, 120, 256, 22);
  });
  const doorMat = std(0xffffff, { map: chevrons, roughness: 0.4 });
  const mkDoor = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set((W / 2) * side, FLOOR, L / 2);
    // the outside face gets the chevrons, everything else is plain paint
    const geo = new THREE.BoxGeometry(W / 2 - 0.02, H, 0.08);
    const mats = [paint, paint, paint, paint, doorMat, inner];
    const door = new THREE.Mesh(geo, mats);
    door.position.set((-W / 4) * side, H / 2, 0);
    door.castShadow = door.receiveShadow = true;
    pivot.add(door);
    const win = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.48), glass);
    win.position.set((-W / 4) * side, 1.85, 0.045);
    pivot.add(win);
    const handle2 = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.04), chrome);
    handle2.position.set(-0.12 * side, 1.25, 0.06);
    pivot.add(handle2);
    for (const y of [0.35, H - 0.35]) {
      const hinge = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8), chrome);
      hinge.position.set(0, y, 0.03);
      pivot.add(hinge);
    }
    g.add(pivot);
    return pivot;
  };
  const doorL = mkDoor(-1);
  const doorR = mkDoor(1);

  const light = new THREE.PointLight(0xff3030, 3.2, 7, 1.6);
  light.position.set(0, 2.5, 0.5);
  g.add(light);

  return { group: g, doorL, doorR, light, monitor, axe, roofLights };
}
