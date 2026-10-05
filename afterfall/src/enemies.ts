// The Hollow (masked natives of the Drop) and their Warden. Simple readable
// state machines: chase → wind-up (telegraphed) → strike → recover.

import * as THREE from "three";
import { buildGreatAxe, buildHumanoid, buildSpear, type Humanoid } from "./models";
import { type Circle, heightAt } from "./world";

export type EnemyKind = "hollow" | "warden";
type State = "spawn" | "chase" | "windup" | "strike" | "recover" | "slamUp" | "dead";

export interface PlayerLike {
  pos: THREE.Vector3;
  invuln: number;
  airborne: boolean;
  damage(n: number, from: THREE.Vector3): void;
}

export class Enemy {
  kind: EnemyKind;
  model: Humanoid;
  pos: THREE.Vector3;
  yaw = 0;
  hp: number;
  maxHp: number;
  state: State = "spawn";
  timer = 0.9;
  speed: number;
  range: number;
  dmg: number;
  scale: number;
  flash = 0;
  knock = new THREE.Vector3();
  walk = Math.random() * 10;
  slamCount = 0;
  summons = 0;
  ring?: THREE.Mesh;
  deadFor = 0;

  constructor(kind: EnemyKind, at: THREE.Vector3) {
    this.kind = kind;
    const boss = kind === "warden";
    this.model = buildHumanoid(
      boss
        ? { cloth: 0x2a0d14, skin: 0x5a4a44, pants: 0x1a1214, mask: 0xd9cfb8, eye: 0xff1030, bones: true }
        : { cloth: 0x3b2e24, skin: 0x8a6a52, pants: 0x2a221c, mask: 0xe8e0cc, eye: 0xff6a20 },
    );
    this.model.weapon.add(boss ? buildGreatAxe() : buildSpear());
    this.scale = boss ? 2.3 : 1;
    this.model.root.scale.setScalar(this.scale);
    this.pos = at.clone();
    this.maxHp = this.hp = boss ? 34 : 3;
    this.speed = boss ? 3.4 : 4.3 + Math.random() * 0.8;
    this.range = boss ? 4.2 : 2.0;
    this.dmg = boss ? 26 : 12;
    if (boss) {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 7, 48),
        new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.ring = ring;
    }
  }

  get alive() {
    return this.state !== "dead";
  }
}

export class EnemyManager {
  list: Enemy[] = [];
  kills = 0;
  onHitPlayer?: () => void;
  onDeath?: (e: Enemy) => void;
  onSlam?: (e: Enemy) => void;
  onSummon?: () => void;
  private scene: THREE.Scene;
  private colliders: Circle[];

  constructor(scene: THREE.Scene, colliders: Circle[]) {
    this.scene = scene;
    this.colliders = colliders;
  }

  spawn(kind: EnemyKind, at: THREE.Vector3) {
    const e = new Enemy(kind, at);
    e.pos.y = heightAt(at.x, at.z) - 2 * e.scale; // rises out of the ground
    e.model.root.position.copy(e.pos);
    this.scene.add(e.model.root);
    if (e.ring) this.scene.add(e.ring);
    this.list.push(e);
    return e;
  }

  /** Spawn just out of sight around a point. */
  spawnAround(center: THREE.Vector3, n: number, minR = 14, maxR = 20) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      this.spawn("hollow", new THREE.Vector3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r));
    }
  }

  get aliveCount() {
    return this.list.filter((e) => e.alive).length;
  }

  clear() {
    for (const e of this.list) {
      this.scene.remove(e.model.root);
      if (e.ring) this.scene.remove(e.ring);
    }
    this.list = [];
  }

  /** Player swing: returns number of enemies hit. */
  hit(from: THREE.Vector3, facing: number, reach: number, arc: number, dmg: number) {
    let n = 0;
    for (const e of this.list) {
      if (!e.alive || e.state === "spawn") continue;
      const dx = e.pos.x - from.x;
      const dz = e.pos.z - from.z;
      const dist = Math.hypot(dx, dz) - (e.scale - 1) * 0.8;
      if (dist > reach) continue;
      let da = Math.atan2(dx, dz) - facing;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) > arc && dist > 1.0) continue;
      e.hp -= dmg;
      e.flash = 0.15;
      const k = e.kind === "warden" ? 1.5 : 7;
      e.knock.set(dx, 0, dz).normalize().multiplyScalar(k);
      if (e.kind === "hollow" && (e.state === "windup" || e.state === "chase")) {
        e.state = "recover"; // stagger
        e.timer = 0.45;
      }
      if (e.hp <= 0) this.kill(e);
      n++;
    }
    return n;
  }

  private kill(e: Enemy) {
    e.state = "dead";
    e.deadFor = 0;
    if (e.ring) (e.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    this.kills++;
    this.onDeath?.(e);
  }

  update(dt: number, t: number, player: PlayerLike) {
    for (const e of this.list) {
      const m = e.model;
      const ground = heightAt(e.pos.x, e.pos.z);
      const dx = player.pos.x - e.pos.x;
      const dz = player.pos.z - e.pos.z;
      const dist = Math.hypot(dx, dz);
      const want = Math.atan2(dx, dz);

      // hit flash
      e.flash = Math.max(0, e.flash - dt);
      for (const mm of m.mats) mm.emissive.setRGB(e.flash > 0 ? 1 : 0, e.flash > 0 ? 0.3 : 0, e.flash > 0 ? 0.3 : 0);

      if (e.state === "dead") {
        e.deadFor += dt;
        m.root.rotation.x = Math.min(Math.PI / 2, m.root.rotation.x + dt * 4);
        m.root.position.y = ground + 0.2 * e.scale - Math.max(0, e.deadFor - 2) * 0.6;
        if (e.deadFor > 4) {
          this.scene.remove(m.root);
          if (e.ring) this.scene.remove(e.ring);
        }
        continue;
      }

      e.timer -= dt;
      let move = 0;
      const turn = (rate: number) => {
        let d = want - e.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.yaw += d * Math.min(1, dt * rate);
      };

      switch (e.state) {
        case "spawn":
          e.pos.y = Math.min(ground, e.pos.y + dt * 2.6 * e.scale);
          turn(4);
          if (e.timer <= 0 && e.pos.y >= ground - 0.01) e.state = "chase";
          break;
        case "chase":
          turn(6);
          move = e.speed;
          if (dist < e.range) {
            if (e.kind === "warden" && (e.slamCount++ % 3 === 2)) {
              e.state = "slamUp";
              e.timer = 1.3;
            } else {
              e.state = "windup";
              e.timer = e.kind === "warden" ? 0.8 : 0.55;
            }
          } else if (e.kind === "warden" && dist > 14 && Math.random() < dt * 0.4) {
            e.state = "slamUp";
            e.timer = 1.3;
          }
          break;
        case "windup":
          turn(3);
          if (e.timer <= 0) {
            e.state = "strike";
            e.timer = 0.15;
            let da = want - e.yaw;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            if (dist < e.range + 0.7 && Math.abs(da) < 1.0 && player.invuln <= 0) {
              player.damage(e.dmg, e.pos);
              this.onHitPlayer?.();
            }
          }
          break;
        case "strike":
          if (e.timer <= 0) {
            e.state = "recover";
            e.timer = e.kind === "warden" ? 0.9 : 0.8;
          }
          break;
        case "slamUp": {
          // telegraphed ground slam: get out of the red ring or jump
          const ring = e.ring!;
          ring.position.set(e.pos.x, ground + 0.1, e.pos.z);
          const k = 1 - e.timer / 1.3;
          ring.scale.setScalar(0.2 + k * 0.8);
          (ring.material as THREE.MeshBasicMaterial).opacity = 0.2 + k * 0.5;
          if (e.timer <= 0) {
            (ring.material as THREE.MeshBasicMaterial).opacity = 0;
            this.onSlam?.(e);
            if (dist < 7 && !player.airborne && player.invuln <= 0) {
              player.damage(e.dmg * 1.2, e.pos);
              this.onHitPlayer?.();
            }
            e.state = "recover";
            e.timer = 1.1;
          }
          break;
        }
        case "recover":
          turn(2);
          move = e.speed * 0.15;
          if (e.timer <= 0) e.state = "chase";
          break;
      }

      // boss summons when wounded
      if (e.kind === "warden") {
        const f = e.hp / e.maxHp;
        if ((f < 0.66 && e.summons === 0) || (f < 0.33 && e.summons === 1)) {
          e.summons++;
          this.spawnAround(e.pos, 3, 8, 12);
          this.onSummon?.();
        }
      }

      // movement + separation
      const fx = Math.sin(e.yaw);
      const fz = Math.cos(e.yaw);
      let vx = fx * move + e.knock.x;
      let vz = fz * move + e.knock.z;
      e.knock.multiplyScalar(Math.max(0, 1 - dt * 8));
      for (const o of this.list) {
        if (o === e || !o.alive) continue;
        const ox = e.pos.x - o.pos.x;
        const oz = e.pos.z - o.pos.z;
        const d = Math.hypot(ox, oz);
        const min = 0.9 * (e.scale + o.scale) * 0.6;
        if (d < min && d > 0.001) {
          vx += (ox / d) * (min - d) * 6;
          vz += (oz / d) * (min - d) * 6;
        }
      }
      if (dist < 0.9 * e.scale && dist > 0.001) {
        vx -= (dx / dist) * 3;
        vz -= (dz / dist) * 3;
      }
      e.pos.x += vx * dt;
      e.pos.z += vz * dt;
      for (const c of this.colliders) {
        const cx = e.pos.x - c.x;
        const cz = e.pos.z - c.z;
        const d = Math.hypot(cx, cz);
        const min = c.r + 0.4 * e.scale;
        if (d < min && d > 0.001) {
          e.pos.x = c.x + (cx / d) * min;
          e.pos.z = c.z + (cz / d) * min;
        }
      }
      if (e.state !== "spawn") e.pos.y = heightAt(e.pos.x, e.pos.z);

      // animation
      m.root.position.copy(e.pos);
      m.root.rotation.y = e.yaw;
      e.walk += dt * move * 2.2;
      const sw = Math.sin(e.walk) * Math.min(1, move / 3) * 0.7;
      m.legL.rotation.x = sw;
      m.legR.rotation.x = -sw;
      m.armL.rotation.x = -sw * 0.8;
      m.eyes.emissiveIntensity = 2;
      if (e.state === "windup") {
        const k = 1 - e.timer / (e.kind === "warden" ? 0.8 : 0.55);
        m.armR.rotation.x = -0.6 - k * 1.8;
        m.body.rotation.x = -0.15 * k;
        m.eyes.emissiveIntensity = 2 + k * 8;
      } else if (e.state === "strike") {
        m.armR.rotation.x = -0.9;
        m.body.rotation.x = 0.25;
      } else if (e.state === "slamUp") {
        const k = 1 - e.timer / 1.3;
        m.armR.rotation.x = -k * 3;
        m.armL.rotation.x = -k * 3;
        m.eyes.emissiveIntensity = 2 + k * 10;
        m.root.position.y = e.pos.y + Math.sin(k * Math.PI) * 0.6;
      } else {
        m.armR.rotation.x += (-0.5 - m.armR.rotation.x) * Math.min(1, dt * 8);
        m.body.rotation.x += (0 - m.body.rotation.x) * Math.min(1, dt * 8);
      }
      m.head.rotation.y = Math.sin(t * 1.3 + e.walk) * 0.1;
    }
    this.list = this.list.filter((e) => e.alive || e.deadFor <= 4);
  }
}
