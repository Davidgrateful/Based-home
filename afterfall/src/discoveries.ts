// SMALL DISCOVERIES — the world telling its own story, quietly.
//
// Ten things lying where somebody left them, off the paths but near them, so
// you come across them rather than go looking. Each answers one small question
// and leaves another. No glow, no markers: you notice, or you don't. Reading
// one goes into what you know (the evidence flags), like everything else the
// others left behind.

import * as THREE from "three";
import { LOW, sfx, world } from "./ctx";
import { EVIDENCE } from "./history";
import { heightAt, MAST } from "./world";

const mat = (color: number, rough = 0.9, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

const place = (o: THREE.Object3D, x: number, z: number, ry = 0, lift = 0) => {
  o.position.set(x, heightAt(x, z) + lift, z);
  o.rotation.y = ry;
  o.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = !LOW), (m.receiveShadow = true))));
  world.scene.add(o);
  return o;
};
const at = (x: number, z: number) => new THREE.Vector3(x, heightAt(x, z), z);

/** A flat decal on the ground (prints, stains), from a canvas. */
function decal(draw: (g: CanvasRenderingContext2D) => void, w: number, h: number, x: number, z: number, ry: number) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = Math.round((256 * h) / w);
  draw(c.getContext("2d")!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, transparent: true, depthWrite: false, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 }));
  m.rotation.set(-Math.PI / 2, 0, ry);
  m.position.set(x, heightAt(x, z) + 0.04, z);
  m.renderOrder = 1;
  world.scene.add(m);
}

export function buildDiscoveries() {
  // 1. A radio, smashed, by the mast. Its dial taped down.
  {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.16), mat(0x3d4232, 0.7, 0.2));
    body.rotation.set(0.3, 0, 1.2);
    body.position.y = 0.12;
    g.add(body);
    for (let i = 0; i < 4; i++) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.06 + i * 0.02, 0.01, 0.04), mat(0x2a2c26, 0.6));
      sh.position.set(0.25 + i * 0.1, 0.01, (i % 2) * 0.1 - 0.05);
      sh.rotation.y = i;
      g.add(sh);
    }
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.5, 0), mat(0x4a4744, 1, 0, { flatShading: true }));
    rock.position.set(-0.4, 0.25, 0);
    g.add(rock);
    place(g, MAST.x + 3, MAST.z + 2, 0.6);
  }
  // 2. A blood trail out of the wreck, to a bandage tied on a branch.
  {
    const pts: [number, number][] = [[-11, 27.5], [-9.6, 30.6], [-8.2, 33.8], [-7, 37], [-5.8, 40]];
    pts.forEach(([x, z], i) =>
      decal(
        (g) => {
          g.fillStyle = `rgba(52,12,10,${0.55 - i * 0.06})`;
          for (let k = 0; k < 9; k++) {
            g.beginPath();
            g.ellipse(60 + Math.random() * 140, 30 + Math.random() * 60, 6 + Math.random() * 12, 3 + Math.random() * 6, Math.random() * 3, 0, Math.PI * 2);
            g.fill();
          }
        },
        1.4,
        0.6,
        x,
        z,
        1.2,
      ),
    );
    const g = new THREE.Group();
    const branch = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.6, 6), mat(0x3a2f26, 1));
    branch.rotation.z = 1.2;
    branch.position.set(0, 1.5, 0);
    g.add(branch);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8, 1, true), mat(0xcfc6b4, 1, 0, { side: THREE.DoubleSide }));
    band.rotation.z = 1.2;
    band.position.set(0.25, 1.6, 0);
    g.add(band);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 2.4, 7), mat(0x3a3029, 1));
    post.position.set(-0.6, 1.2, 0);
    g.add(post);
    place(g, -5.2, 41.2, 0.4);
  }
  // 3. A photograph under a stone.
  {
    const g = new THREE.Group();
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.1), mat(0xb8b0a0, 0.6));
    photo.rotation.x = -Math.PI / 2;
    photo.position.y = 0.012;
    g.add(photo);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), mat(0x55524e, 1, 0, { flatShading: true }));
    stone.scale.y = 0.6;
    stone.position.set(0.04, 0.05, 0.02);
    g.add(stone);
    place(g, -25.4, 55.2, 1.1);
  }
  // 4. A burned truck, the doors chained from outside.
  {
    const g = new THREE.Group();
    const soot = mat(0x161412, 1, 0.25);
    const steel = mat(0x2a2624, 0.8, 0.5);
    const scorch = (() => {
      // the box's sides: paint burned back to primer and rust, soot climbing from below
      const c = document.createElement("canvas");
      c.width = 256;
      c.height = 128;
      const q = c.getContext("2d")!;
      q.fillStyle = "#6a3a24";
      q.fillRect(0, 0, 256, 128);
      for (let i = 0; i < 260; i++) {
        q.fillStyle = `rgba(${30 + Math.random() * 60},${18 + Math.random() * 30},${10 + Math.random() * 20},${0.25 + Math.random() * 0.4})`;
        q.fillRect(Math.random() * 256, Math.random() * 128, 2 + Math.random() * 18, 1 + Math.random() * 6);
      }
      const gr = q.createLinearGradient(0, 128, 0, 0);
      gr.addColorStop(0, "rgba(10,8,7,0.95)");
      gr.addColorStop(0.55, "rgba(10,8,7,0.55)");
      gr.addColorStop(1, "rgba(10,8,7,0.1)");
      q.fillStyle = gr;
      q.fillRect(0, 0, 256, 128);
      q.strokeStyle = "rgba(0,0,0,0.35)";
      for (let x = 8; x < 256; x += 12) {
        q.beginPath();
        q.moveTo(x, 0);
        q.lineTo(x, 128);
        q.stroke();
      }
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return mat(0xffffff, 0.95, 0.35, { map: t });
    })();
    // chassis rails, sagging at the front where the tyres burned away
    for (const z of [-0.55, 0.55]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.18, 0.12), steel);
      rail.position.set(-0.1, 0.5, z);
      g.add(rail);
    }
    // the cab, in profile: bumper, bonnet, windscreen, roof, back wall
    const prof = new THREE.Shape();
    prof.moveTo(0, 0);
    prof.lineTo(1.75, 0);
    prof.lineTo(1.8, 0.75);
    prof.lineTo(1.25, 0.95);
    prof.lineTo(0.95, 1.65);
    prof.lineTo(0.05, 1.7);
    prof.lineTo(0, 0);
    const cabGeo = new THREE.ExtrudeGeometry(prof, { depth: 1.9, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 2 });
    cabGeo.translate(0, 0, -0.95);
    const cab = new THREE.Mesh(cabGeo, soot);
    cab.position.set(1.15, 0.55, 0);
    g.add(cab);
    // empty window frames, blackened inside
    const hole = mat(0x050505, 1);
    const ws = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 1.6), hole);
    ws.position.set(1.15 + 1.11, 0.55 + 1.31, 0);
    ws.rotation.set(0, Math.PI / 2, -0.4);
    g.add(ws);
    for (const sd of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.55), hole);
      side.position.set(1.15 + 0.52, 0.55 + 1.3, sd * 1.0);
      side.rotation.y = sd > 0 ? 0 : Math.PI;
      g.add(side);
    }
    // the box: ribbed sides, a roof that's started to buckle
    const box = new THREE.Mesh(new THREE.BoxGeometry(3.9, 2.0, 2.1), [scorch, scorch, soot, soot, scorch, scorch]);
    box.position.set(-1.0, 1.65, 0);
    g.add(box);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 2.1, 6, 3), soot);
    const rp = roof.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < rp.count; i++) rp.setZ(i, -Math.max(0, 1 - Math.abs(rp.getX(i) + 0.4) / 1.4) * 0.22);
    roof.geometry.computeVertexNormals();
    roof.rotation.x = -Math.PI / 2;
    roof.position.set(-1.0, 2.66, 0);
    g.add(roof);
    // rear doors, a chain through the handles, padlocked
    for (const sd of [-1, 1]) {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.85, 1.0), soot);
      door.position.set(-2.97, 1.65, sd * 0.52);
      g.add(door);
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 6), steel);
      bar.position.set(-3.0, 1.62, sd * 0.12);
      g.add(bar);
    }
    const chainMat = mat(0x8a8a84, 0.45, 0.85);
    for (let i = 0; i < 7; i++) {
      const link = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.011, 5, 10), chainMat);
      link.position.set(-3.03, 1.35 + Math.sin(i * 0.9) * 0.03, -0.18 + i * 0.06);
      link.rotation.set(i % 2 ? Math.PI / 2 : 0, Math.PI / 2, 0);
      g.add(link);
    }
    const lock = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.06), mat(0x6a5a3a, 0.4, 0.8));
    lock.position.set(-3.05, 1.24, 0.24);
    g.add(lock);
    // bare rims, the rubber long gone
    for (const [x, z] of [[2.2, 1.0], [2.2, -1.0], [-1.9, 1.0], [-1.9, -1.0], [-2.6, 1.0], [-2.6, -1.0]] as const) {
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.22, 14, 1, true), mat(0x3a3430, 0.7, 0.6, { side: THREE.DoubleSide }));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(x, x > 0 ? 0.3 : 0.38, z);
      g.add(rim);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 0.24, 8), steel);
      hub.rotation.x = Math.PI / 2;
      hub.position.copy(rim.position);
      g.add(hub);
    }
    // a mirror on the ground, glass gone
    const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.28, 0.05), soot);
    mirror.position.set(2.6, 0.05, 1.7);
    mirror.rotation.set(Math.PI / 2, 0, 0.6);
    g.add(mirror);
    place(g, 44, 46, 2.3, -0.12).rotation.z = 0.06; // nose down
    world.colliders.push({ x: 44, z: 46, r: 2.6 });
  }
  // 5. Shoes, side by side, laces tied together.
  {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
      const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.08, 0.27), mat(0x2a2520, 0.8));
      shoe.position.set(s * 0.08, 0.04, 0);
      g.add(shoe);
    }
    const lace = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.006, 4, 10), mat(0xcfc6b4, 1));
    lace.position.set(0, 0.09, 0.05);
    g.add(lace);
    place(g, -22.2, 46.4, 0.9);
  }
  // 6. A mark painted on the rocks that face the Blue Scar.
  {
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const g2 = c.getContext("2d")!;
    g2.strokeStyle = "rgba(225,220,205,0.85)";
    g2.lineWidth = 9;
    g2.beginPath();
    g2.arc(64, 64, 40, 0, Math.PI * 2);
    g2.moveTo(30, 98);
    g2.lineTo(98, 30);
    g2.stroke();
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    for (const [x, z, ry] of [[21, 27.5, 0.9], [38.5, 42.5, -2.3]] as const) {
      const g = new THREE.Group();
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.75, 0), mat(0x504c48, 1, 0, { flatShading: true }));
      rock.scale.set(1.2, 0.9, 0.8);
      rock.position.y = 0.55;
      g.add(rock);
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 1 }));
      sign.position.set(0, 0.62, 0.62);
      g.add(sign);
      place(g, x, z, ry);
      world.colliders.push({ x, z, r: 0.8 });
    }
  }
  // 7. A pocket recorder in the wreck. It still plays.
  {
    const g = new THREE.Group();
    const rec = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.11), mat(0x1d1f22, 0.5, 0.3));
    rec.position.y = 0.01;
    g.add(rec);
    place(g, -17.5, 26.5, 0.4);
  }
  // 8. A shelter built for two. One side slept in.
  {
    const g = new THREE.Group();
    const wood = mat(0x4a3d32, 1);
    const dry = mat(0x5a4c3c, 1);
    // two forked uprights, a ridge pole, branches leaned along one side
    for (const s of [-1, 1]) {
      const up = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 1.5, 6), wood);
      up.position.set(s * 1.15, 0.72, 0.55);
      up.rotation.z = s * 0.05;
      g.add(up);
      const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.35, 5), wood);
      fork.position.set(s * 1.15 + s * 0.06, 1.5, 0.55);
      fork.rotation.z = s * -0.5;
      g.add(fork);
    }
    const ridge = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 2.6, 6), wood);
    ridge.rotation.z = Math.PI / 2;
    ridge.position.set(0, 1.45, 0.55);
    g.add(ridge);
    for (let i = 0; i < 13; i++) {
      const x = -1.15 + i * 0.19 + (Math.sin(i * 7.1) * 0.04);
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.032, 2.0 + (i % 3) * 0.12, 5), i % 3 ? wood : dry);
      br.position.set(x, 0.78, -0.25);
      br.rotation.set(-0.86 + Math.sin(i * 3.3) * 0.05, 0, Math.sin(i * 2.1) * 0.06);
      g.add(br);
    }
    // a scrap of tarp on top, weighted with a stone
    const tarp = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.1, 3, 3), mat(0x3a3a2e, 1, 0, { side: THREE.DoubleSide }));
    tarp.rotation.set(-0.72, 0, 0.05);
    tarp.position.set(0.35, 0.95, -0.2);
    g.add(tarp);
    const stone = new THREE.Mesh(new THREE.DodecahedronGeometry(0.1, 0), mat(0x5a5754, 1, 0, { flatShading: true }));
    stone.position.set(0.5, 1.3, 0.12);
    g.add(stone);
    // two beds of bracken: one flattened, a blanket thrown back; one never lain on
    const used = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.04, 1.8), mat(0x4a4436, 1));
    used.position.set(-0.45, 0.02, -0.05);
    used.rotation.y = 0.05;
    const blanket = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.9, 3, 3), mat(0x5a3a2e, 1, 0, { side: THREE.DoubleSide }));
    const bp = blanket.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < bp.count; i++) bp.setZ(i, Math.abs(Math.sin(bp.getX(i) * 6 + bp.getY(i) * 4)) * 0.06);
    blanket.geometry.computeVertexNormals();
    blanket.rotation.x = -Math.PI / 2;
    blanket.position.set(-0.42, 0.06, 0.35);
    const unused = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.12, 1.8), mat(0x5a5a48, 1));
    unused.position.set(0.45, 0.06, -0.05);
    g.add(used, blanket, unused);
    place(g, -44, -12, 0.3);
  }
  // 9. Restraint straps, cut through, by a tree south of the ambulance.
  {
    const g = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const strap = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.008, 0.5 + i * 0.1), mat(0x2a2a2c, 0.7));
      strap.position.set(i * 0.12 - 0.12, 0.01, i * 0.05);
      strap.rotation.y = i * 0.6 - 0.4;
      g.add(strap);
      const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.015, 0.05), mat(0x8a8d90, 0.4, 0.8));
      buckle.position.set(i * 0.12 - 0.12, 0.014, i * 0.05 + 0.25);
      g.add(buckle);
    }
    place(g, 4, -15, 0.7);
  }
  // 10. Two sets of prints: old boots, and bare feet stepping exactly in them.
  {
    for (let i = 0; i < 6; i++) {
      const x = -60 + i * 0.75;
      const z = 29 + Math.sin(i * 0.8) * 0.4;
      decal(
        (g) => {
          g.fillStyle = "rgba(24,20,16,0.45)"; // the boot, old, filled with leaf
          g.beginPath();
          g.ellipse(128, 64, 46, 24, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "rgba(18,14,11,0.8)"; // the bare foot, fresh, inside it
          g.beginPath();
          g.ellipse(124, 64, 30, 14, 0, 0, Math.PI * 2);
          g.fill();
          for (let t = 0; t < 5; t++) {
            g.beginPath();
            g.arc(160 + t * 0, 50 + t * 7, 4, 0, Math.PI * 2);
            g.fill();
          }
        },
        0.42,
        0.21,
        x,
        z + (i % 2 ? 0.18 : -0.18),
        Math.PI / 2,
      );
    }
  }
}

// What you find when you look. One answer; another question.
const near = (x: number, z: number) => at(x, z);
EVIDENCE.push(
  {
    id: "d-radio",
    label: "Look at the radio",
    text: ["A field radio, smashed against the rock. Not dropped: smashed.", "The dial's taped down on one frequency.", "It's the one Rhea talks on."],
    patients: [],
    where: "The mast",
    at: near(MAST.x + 3, MAST.z + 2),
  },
  {
    id: "d-blood",
    label: "Look at the branch",
    text: ["The blood stops here.", "Somebody tied a bandage round this branch.", "Neatly. Like they wanted it found."],
    patients: [],
    where: "Fallsite",
    at: near(-5.2, 41.2),
  },
  {
    id: "d-photo",
    label: "Look under the stone",
    text: ["A photograph: a beach, a family, everyone squinting.", "On the back, in pen: FOR WHEN YOU FORGET.", "The faces have been rubbed away by a thumb."],
    patients: [],
    where: "Dead Tree path",
    at: near(-25.4, 55.2),
  },
  {
    id: "d-truck",
    label: "Look at the truck",
    text: ["A Meridian truck, burned down to the frame.", "The back doors were chained shut. From the outside.", "The chain's been cut. Recently."],
    patients: [],
    where: "Tower Fields",
    at: near(41.2, 46.8),
  },
  {
    id: "d-shoes",
    label: "Look at the shoes",
    text: ["A pair of shoes, set side by side. Laces tied together.", "Whoever left them walked on barefoot.", "They're your size."],
    patients: [],
    where: "Dead Tree path",
    at: near(-22.2, 46.4),
  },
  {
    id: "d-sign",
    label: "Look at the mark",
    text: ["A circle with a line through it, painted on the rock.", "Every rock that faces the Scar has one.", "Every rock that faces away has been left clean."],
    patients: [],
    where: "Blue Scar",
    at: near(20.2, 28.6),
  },
  {
    id: "d-recorder",
    label: "Play the recorder",
    text: ["A pocket recorder. It still plays.", "Wind. Somebody breathing, close to it.", "Then a click, as if they'd heard you pick it up."],
    patients: [],
    where: "Fallsite",
    at: near(-17.5, 26.5),
    onRead: () => {
      sfx.staticBurst(0.4, 0.1);
      window.setTimeout(() => sfx.breath(2), 500);
      window.setTimeout(() => sfx.click(), 5600);
    },
  },
  {
    id: "d-shelter",
    label: "Look at the shelter",
    text: ["A shelter built for two.", "One mat is flattened from weeks of sleeping.", "The other has never been lain on. They kept it for someone."],
    patients: [],
    where: "Blackwood edge",
    at: near(-44, -10.6),
  },
  {
    id: "d-straps",
    label: "Look at the straps",
    text: ["Restraint straps. Meridian issue.", "Not unbuckled: cut.", "From the inside."],
    patients: [],
    where: "South of the ambulance",
    at: near(4, -15),
  },
  {
    id: "d-prints",
    label: "Look at the prints",
    text: ["Two sets of prints. Old boots, half full of leaves.", "Bare feet, fresh, stepping exactly where the boots stepped.", "Following them. Or learning how they walked."],
    patients: [],
    where: "Blackwood edge",
    at: near(-58, 29),
  },
);
