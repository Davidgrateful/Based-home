// Chapter One set dressing that tells the player something happened AFTER the
// crash: bare footprints that circle the ambulance and lead to a fire pit
// nobody on the plane built, tally marks gouged into the hull, a Meridian
// records case carried to the stones, and a figure that stands at the tree
// line and is gone when you look again.

import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { buildHumanoid, buildSpear, type Humanoid } from "./models";
import { CAMP, glowTexture, heightAt } from "./world";

export const CASE_POS = new THREE.Vector3(CAMP.x + 1.5, 0, CAMP.z - 0.9);
/** Where the figure stands: in front of the burning nose of the wreck, so the
 *  fire behind it cuts a silhouette and only the eyes catch any light. */
export const SHAPE_POS = new THREE.Vector3(0.5, 0, 27);
CASE_POS.y = heightAt(CASE_POS.x, CASE_POS.z);
SHAPE_POS.y = heightAt(SHAPE_POS.x, SHAPE_POS.z);

const BAR = new THREE.BoxGeometry(0.01, 0.26, 0.014);
const SLASH = new THREE.BoxGeometry(0.012, 0.34, 0.02);
const BASE_GROUPS = 40;
/** Where tally group g goes on the flank: 10 to a row, rows from the roof down
 *  (the loop's extra marks carry on below, then wrap back over the top). */
function groupAt(g: number): [number, number] {
  const col = g % 10;
  const row = Math.floor(g / 10) % 5;
  return [2.25 - row * 0.32, -2.35 + col * 0.42 + (Math.floor(g / 50) % 2) * 0.2];
}

/** The track: tree line → around the ambulance → the fire pit → back into the trees. */
function trackPath(): THREE.Vector3[] {
  const pts: THREE.Vector3[] = [];
  const line = (a: [number, number], b: [number, number]) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.72);
    for (let i = 0; i < n; i++) pts.push(new THREE.Vector3(a[0] + ((b[0] - a[0]) * i) / n, 0, a[1] + ((b[1] - a[1]) * i) / n));
  };
  line([SHAPE_POS.x - 3, SHAPE_POS.z - 2], [3.2, -4]);
  // a full lap of the ambulance, close enough to have looked in the windows
  const lap = Math.ceil((2 * Math.PI * 3.6) / 0.72);
  for (let i = 0; i <= lap; i++) {
    const a = -Math.PI / 2 - 0.3 + (i / lap) * Math.PI * 2;
    pts.push(new THREE.Vector3(Math.cos(a) * 2.7, 0, -1 + Math.sin(a) * 5.4));
  }
  line([2.4, 4.6], [CAMP.x - 1.2, CAMP.z - 0.4]);
  line([CAMP.x + 1.1, CAMP.z + 0.8], [SHAPE_POS.x, SHAPE_POS.z]);
  return pts;
}

export class Signs {
  group = new THREE.Group();
  track: THREE.Vector3[];
  shape: Humanoid;
  caseLid: THREE.Mesh;
  shapeT = 0;
  private tally!: THREE.Group;
  private gouge!: THREE.MeshStandardMaterial;
  private extraMarks = 0;

  constructor(scene: THREE.Scene, ambulance: THREE.Group) {
    // ---- footprints: one instanced mesh, alternating left/right
    this.track = trackPath();
    const geo = new THREE.CircleGeometry(0.5, 10);
    geo.rotateX(-Math.PI / 2);
    const prints = new THREE.InstancedMesh(
      geo,
      // pressed dark into the ash and dirt: you notice them, they don't shine
      new THREE.MeshStandardMaterial({ color: 0x24201c, roughness: 1, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
      this.track.length * 2,
    );
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let k = 0;
    this.track.forEach((p, i) => {
      const next = this.track[Math.min(i + 1, this.track.length - 1)];
      const prev = this.track[Math.max(i - 1, 0)];
      const yaw = Math.atan2(next.x - prev.x, next.z - prev.z);
      const side = i % 2 ? 1 : -1;
      const x = p.x + Math.cos(yaw) * 0.13 * side;
      const z = p.z - Math.sin(yaw) * 0.13 * side;
      const y = heightAt(x, z) + 0.035;
      q.setFromAxisAngle(up, yaw);
      // heel and forefoot
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(0.15, 1, 0.2));
      prints.setMatrixAt(k++, m);
      m.compose(new THREE.Vector3(x + Math.sin(yaw) * 0.16, y, z + Math.cos(yaw) * 0.16), q, new THREE.Vector3(0.19, 1, 0.25));
      prints.setMatrixAt(k++, m);
    });
    prints.receiveShadow = true;
    this.group.add(prints);

    // ---- tally marks gouged through the paint on the right flank: hundreds,
    // in rows from the roofline down, straight across the window
    const gouge = new THREE.MeshStandardMaterial({ color: 0x5d6064, roughness: 0.5, metalness: 0.7 });
    const tally = new THREE.Group();
    for (let g = 0; g < BASE_GROUPS; g++) {
      const [oy, ox] = groupAt(g);
      const marks = g === BASE_GROUPS - 1 ? 3 : 4; // the last group is unfinished
      for (let i = 0; i < marks; i++) {
        const b = new THREE.Mesh(BAR, gouge);
        b.position.set(0, oy + Math.sin(g * 7 + i) * 0.015, ox + i * 0.065);
        b.rotation.x = Math.sin(g * 3 + i) * 0.08;
        tally.add(b);
      }
      if (marks === 4) {
        const sl = new THREE.Mesh(SLASH, gouge);
        sl.position.set(0, oy, ox + 0.1);
        sl.rotation.x = 1.0;
        tally.add(sl);
      }
    }
    tally.position.set(1.42, 0, 0.3);
    ambulance.add(tally);
    this.tally = tally;
    this.gouge = gouge;
    // and under all of them, below the lettering, one word
    const scratch = document.createElement("canvas");
    scratch.width = 512;
    scratch.height = 96;
    const sg = scratch.getContext("2d")!;
    sg.font = '600 70px "IBM Plex Mono", monospace';
    sg.strokeStyle = "rgba(225,228,230,0.95)";
    sg.lineWidth = 3;
    sg.textAlign = "center";
    sg.strokeText("HUNDRED", 256, 74);
    const word = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 0.37),
      new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(scratch), transparent: true, roughness: 0.4, metalness: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }),
    );
    word.position.set(1.43, 0.5, -0.3);
    word.rotation.y = Math.PI / 2;
    ambulance.add(word);
    this.tally = tally;
    this.gouge = gouge;

    // ---- the records case, lid up, papers out
    const caseG = new THREE.Group();
    caseG.position.copy(CASE_POS);
    caseG.rotation.y = -0.5;
    // a scuffed field case (olive polymer, not metal: metal reads black at night)
    const shell = new THREE.MeshStandardMaterial({ color: 0x4d5247, roughness: 0.62, metalness: 0.05 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.2, 0.44, 3, 0.035), shell);
    body.position.y = 0.1;
    body.castShadow = true;
    caseG.add(body);
    this.caseLid = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.05, 0.44, 3, 0.02), shell);
    this.caseLid.geometry.translate(0, 0, -0.22);
    this.caseLid.position.set(0, 0.21, 0.22);
    this.caseLid.rotation.x = -1.9;
    caseG.add(this.caseLid);
    const label = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.005), new THREE.MeshStandardMaterial({ color: 0xc4161c }));
    label.position.set(0, 0.12, 0.222);
    caseG.add(label);
    const steel = new THREE.MeshStandardMaterial({ color: 0x8a8d90, roughness: 0.35, metalness: 0.8 });
    for (const x of [-0.2, 0.2]) {
      const latch = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.02), steel);
      latch.position.set(x, 0.15, 0.225);
      caseG.add(latch);
    }
    const rim = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.025, 0.46), new THREE.MeshStandardMaterial({ color: 0x33362f, roughness: 0.8 }));
    rim.position.y = 0.2;
    caseG.add(rim);
    const paper = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.21, 0.29), paper);
      sheet.rotation.set(-Math.PI / 2, 0, i * 0.7 - 1);
      sheet.position.set(0.45 + Math.cos(i * 2.1) * 0.25, 0.012 + i * 0.002, 0.15 + Math.sin(i * 2.1) * 0.25);
      caseG.add(sheet);
    }
    this.group.add(caseG);

    // ---- the figure at the tree line
    this.shape = buildHumanoid({ cloth: 0x2e241d, skin: 0x7a5e4a, pants: 0x221b16, mask: 0xe0d8c4, eye: 0xff6a20 });
    this.shape.weapon.add(buildSpear());
    this.shape.root.position.copy(SHAPE_POS);
    this.shape.root.rotation.y = Math.atan2(CAMP.x - SHAPE_POS.x, CAMP.z - SHAPE_POS.z);
    this.shape.armR.rotation.x = -0.3;
    // heat haze off the wreck behind it, so it reads as a cut-out, not a blur
    const haze = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xff8a3a, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending }));
    haze.scale.set(3.2, 5, 1);
    haze.position.set(0, 1.4, -1.6);
    this.shape.root.add(haze);
    this.shape.root.scale.setScalar(1.12);
    this.shape.root.visible = false;
    this.group.add(this.shape.root);

    scene.add(this.group);
  }

  /** Every loop leaves more marks on the ambulance. Somebody keeps counting. */
  addTally(groups: number) {
    for (; this.extraMarks < groups; this.extraMarks++) {
      const [oy, ox] = groupAt(BASE_GROUPS + this.extraMarks);
      for (let i = 0; i < 5; i++) {
        const b = new THREE.Mesh(i < 4 ? BAR : SLASH, this.gouge);
        b.position.set(0, oy, ox + (i < 4 ? i * 0.065 : 0.1));
        if (i === 4) b.rotation.x = 1.0;
        this.tally.add(b);
      }
    }
  }

  /** Stand the figure somewhere else, facing a point (Long Night sightings). */
  placeShape(p: THREE.Vector3, face: THREE.Vector3) {
    this.shape.root.position.set(p.x, heightAt(p.x, p.z), p.z);
    this.shape.root.rotation.y = Math.atan2(face.x - p.x, face.z - p.z);
  }

  showShape(on: boolean) {
    this.shape.root.visible = on;
    this.shapeT = 0;
  }

  /** Is the figure on screen and roughly in the middle of it? */
  shapeSeen(camera: THREE.Camera) {
    if (!this.shape.root.visible) return false;
    const v = this.shape.root.position.clone().setY(this.shape.root.position.y + 1.4).project(camera);
    return v.z < 1 && Math.abs(v.x) < 0.55 && Math.abs(v.y) < 0.8;
  }

  /** Nearest footprint distance, for the "you notice the tracks" beat. */
  nearTrack(p: THREE.Vector3) {
    let best = Infinity;
    for (const t of this.track) best = Math.min(best, Math.hypot(t.x - p.x, t.z - p.z));
    return best;
  }

  update(dt: number, t: number) {
    if (!this.shape.root.visible) return;
    this.shapeT += dt;
    // breathing, a slight sway, the head tracking the fire
    this.shape.body.position.y = Math.sin(t * 1.7) * 0.008;
    this.shape.head.rotation.y = Math.sin(t * 0.4) * 0.25;
    this.shape.eyes.emissiveIntensity = 1.5 + Math.sin(t * 3) * 0.5;
  }

  dispose(scene: THREE.Scene) {
    scene.remove(this.group);
  }
}
