// Other survivors in a co-op room: their own look and name, smoothed from the
// ~12 Hz state stream, animated like the local player.

import * as THREE from "three";
import type { PlayerLike } from "./enemies";
import { buildAxe, buildPlayerModel, DEFAULT_LOOK, type Humanoid, type Look } from "./models";
import { net } from "./net";
import { heightAt } from "./world";

export interface RemoteState {
  p: [number, number, number];
  f: number; // facing
  a: number; // swing progress 0..1, -1 when idle
  c: number; // combo index (2 = heavy)
  air: boolean;
  dn: boolean; // down
  iv: boolean; // dodging / invulnerable
  hp: number;
  mh: number;
  rb: boolean; // rift-bound
}

function tagTexture(name: string, speaking: boolean) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 96;
  const g = c.getContext("2d")!;
  g.font = '600 46px "Barlow Condensed", "Arial Narrow", sans-serif';
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.shadowColor = "rgba(0,0,0,0.9)";
  g.shadowBlur = 8;
  const label = name.toUpperCase();
  g.fillStyle = "#e9e6df";
  g.fillText(label, 256, 48);
  if (speaking) {
    // a small speaker mark left of the name, in the accent colour
    const w = g.measureText(label).width;
    const x = 256 - w / 2 - 30;
    g.fillStyle = "#d9643a";
    g.fillRect(x - 10, 38, 8, 20);
    g.beginPath();
    g.moveTo(x - 2, 38);
    g.lineTo(x + 10, 28);
    g.lineTo(x + 10, 68);
    g.lineTo(x - 2, 58);
    g.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function nameTag(name: string) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tagTexture(name, false), transparent: true, depthWrite: false, fog: false }));
  s.scale.set(2.6, 0.49, 1);
  s.renderOrder = 10;
  return s;
}

export class RemoteAvatar {
  id: number;
  name: string;
  model: Humanoid;
  tag: THREE.Sprite;
  hpBar: THREE.Mesh;
  pos = new THREE.Vector3();
  target = new THREE.Vector3();
  facing = 0;
  targetFacing = 0;
  state: RemoteState | null = null;
  walk = 0;
  private rb = false;
  private speaking = false;
  private tagTex: THREE.Texture[] = [];
  private axe?: THREE.Group;
  private scene: THREE.Scene;
  private seen = false;

  /** What the host's Hollow chase and hit. */
  proxy: PlayerLike;

  constructor(scene: THREE.Scene, id: number, name: string, look: Look | null) {
    this.scene = scene;
    this.id = id;
    this.name = name;
    this.model = buildPlayerModel(look ?? DEFAULT_LOOK);
    this.model.root.visible = false;
    this.tag = nameTag(name);
    this.tagTex = [this.tag.material.map!, tagTexture(name, true)];
    this.hpBar = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.035), new THREE.MeshBasicMaterial({ color: 0xe9e6df, depthWrite: false, fog: false }));
    this.hpBar.renderOrder = 10;
    scene.add(this.model.root, this.tag, this.hpBar);
    this.setAxe(false);
    const self = this;
    this.proxy = {
      pos: this.pos,
      get invuln() {
        return self.state?.iv ? 1 : 0;
      },
      get airborne() {
        return !!self.state?.air;
      },
      get down() {
        return !self.seen || !!self.state?.dn;
      },
      damage(n: number, from: THREE.Vector3) {
        net.send({ t: "dmg", to: self.id, n: Math.round(n * 10) / 10, x: from.x, z: from.z });
      },
    };
  }

  private setAxe(rb: boolean) {
    if (this.axe) this.model.weapon.remove(this.axe);
    this.rb = rb;
    this.axe = buildAxe(rb);
    this.model.weapon.add(this.axe);
  }

  apply(s: RemoteState) {
    this.state = s;
    this.target.set(s.p[0], s.p[1], s.p[2]);
    this.targetFacing = s.f;
    if (!this.seen) {
      this.seen = true;
      this.pos.copy(this.target);
      this.facing = s.f;
      this.model.root.visible = true;
    }
    if (s.rb !== this.rb) this.setAxe(s.rb);
  }

  update(dt: number, camera: THREE.Camera) {
    if (!this.seen || !this.state) return;
    const s = this.state;
    const k = Math.min(1, dt * 12);
    const ox = this.pos.x;
    const oz = this.pos.z;
    this.pos.lerp(this.target, k);
    if (this.pos.distanceTo(this.target) > 8) this.pos.copy(this.target); // teleport (respawn)
    const speed = Math.hypot(this.pos.x - ox, this.pos.z - oz) / Math.max(dt, 1e-3);
    let d = this.targetFacing - this.facing;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.facing += d * Math.min(1, dt * 14);

    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.set(0, this.facing, 0);
    this.walk += dt * speed * 1.6;
    const sw = Math.sin(this.walk) * Math.min(1, speed / 4) * 0.8;
    m.legL.rotation.x = s.air ? -0.5 : sw;
    m.legR.rotation.x = s.air ? 0.3 : -sw;
    m.armL.rotation.x = -sw * 0.7;
    m.body.rotation.set(0, 0, 0);
    if (s.a >= 0) {
      const raise = s.a < 0.4 ? s.a / 0.4 : 1 - (s.a - 0.4) / 0.6;
      if (s.c === 2) {
        m.armR.rotation.x = -0.3 - raise * 3.0 + (s.a > 0.4 ? (s.a - 0.4) * 2.2 : 0);
        m.armL.rotation.x = m.armR.rotation.x;
        m.body.rotation.x = s.a > 0.4 ? 0.4 : -0.25;
      } else {
        m.armR.rotation.x = -0.4 - raise * 2.4 + (s.a > 0.4 ? (s.a - 0.4) * 1.5 : 0);
        m.armR.rotation.z = s.c ? -0.3 : 0.3;
        m.body.rotation.y = (s.c ? 1 : -1) * (s.a - 0.5) * 0.8;
      }
    } else {
      m.armR.rotation.x += (-0.5 + sw * 0.5 - m.armR.rotation.x) * Math.min(1, dt * 10);
      m.armR.rotation.z = 0;
      if (s.iv && speed > 8) m.body.rotation.x = 0.35;
    }
    if (s.dn) {
      // down in the dirt until Rhea talks them back up
      m.root.rotation.x = -Math.PI / 2 + 0.15;
      m.root.position.y = heightAt(this.pos.x, this.pos.z) + 0.2;
    }

    const headY = this.pos.y + (s.dn ? 0.8 : 2.2);
    this.tag.position.set(this.pos.x, headY + 0.12, this.pos.z);
    this.hpBar.position.set(this.pos.x, headY - 0.08, this.pos.z);
    this.hpBar.quaternion.copy(camera.quaternion);
    const f = Math.max(0, s.hp / Math.max(1, s.mh));
    this.hpBar.scale.x = Math.max(0.001, f);
    (this.hpBar.material as THREE.MeshBasicMaterial).color.set(f < 0.3 ? 0xc4473a : 0xe9e6df);
  }

  setSpeaking(on: boolean) {
    if (on === this.speaking) return;
    this.speaking = on;
    this.tag.material.map = this.tagTex[on ? 1 : 0];
    this.tag.material.needsUpdate = true;
  }

  dispose() {
    this.scene.remove(this.model.root, this.tag, this.hpBar);
  }
}
