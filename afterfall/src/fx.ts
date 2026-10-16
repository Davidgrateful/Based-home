// Combat juice: floating damage numbers and spark bursts.

import * as THREE from "three";
import { glowTexture } from "./world";

interface Num {
  el: HTMLElement;
  pos: THREE.Vector3;
  life: number;
}
interface Spark {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
}

const MAX_SPARKS = 220;

export class FX {
  private nums: Num[] = [];
  private layer: HTMLElement;
  private live: Spark[] = [];
  private points: THREE.Points;
  private v = new THREE.Vector3();

  constructor(scene: THREE.Scene) {
    this.layer = document.getElementById("numbers")!;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_SPARKS * 3), 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffd08a, size: 0.16, map: glowTexture(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
  }

  number(pos: THREE.Vector3, text: string, cls = "") {
    const el = document.createElement("div");
    el.className = `num ${cls}`;
    el.textContent = text;
    this.layer.appendChild(el);
    this.nums.push({ el, pos: pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.6, 0, 0)), life: 0.9 });
  }

  sparks(at: THREE.Vector3, n = 14, speed = 6) {
    for (let i = 0; i < n && this.live.length < MAX_SPARKS; i++) {
      this.live.push({
        pos: at.clone(),
        vel: new THREE.Vector3((Math.random() - 0.5) * speed, Math.random() * speed * 0.8, (Math.random() - 0.5) * speed),
        life: 0.35 + Math.random() * 0.3,
      });
    }
  }

  update(dt: number, camera: THREE.Camera) {
    for (const n of this.nums) {
      n.life -= dt;
      n.pos.y += dt * 1.4;
      this.v.copy(n.pos).project(camera);
      const hidden = this.v.z > 1;
      n.el.style.transform = `translate(${((this.v.x + 1) / 2) * innerWidth}px, ${((1 - this.v.y) / 2) * innerHeight}px) translate(-50%,-50%) scale(${0.8 + n.life * 0.4})`;
      n.el.style.opacity = hidden ? "0" : String(Math.min(1, n.life * 2.5));
      if (n.life <= 0) n.el.remove();
    }
    this.nums = this.nums.filter((n) => n.life > 0);

    const attr = this.points.geometry.attributes.position as THREE.BufferAttribute;
    for (const s of this.live) {
      s.life -= dt;
      s.vel.y -= 14 * dt;
      s.pos.addScaledVector(s.vel, dt);
    }
    this.live = this.live.filter((s) => s.life > 0);
    for (let i = 0; i < MAX_SPARKS; i++) {
      const s = this.live[i];
      if (s) attr.setXYZ(i, s.pos.x, s.pos.y, s.pos.z);
      else attr.setXYZ(i, 0, -999, 0);
    }
    attr.needsUpdate = true;
  }
}
