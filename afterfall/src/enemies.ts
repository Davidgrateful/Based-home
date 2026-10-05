// The Hollow (masked patients who fell before you) and their Warden.
// Readable state machines: chase → telegraphed wind-up → strike → recover.
//   hollow  — the baseline spearman
//   runner  — fast, fragile, short wind-up
//   brute   — slow, armored, ignores staggers, goes for the campfire
//   shaman  — keeps its distance and throws rift bolts you can dodge
//   warden  — Patient One: big swings, telegraphed ground slam, summons

import * as THREE from "three";
import { buildClub, buildGreatAxe, buildHumanoid, buildSpear, buildStaff, type Humanoid } from "./models";
import { type Circle, glowTexture, heightAt } from "./world";

export type EnemyKind = "hollow" | "runner" | "brute" | "shaman" | "warden";
type State = "spawn" | "chase" | "windup" | "strike" | "recover" | "slamUp" | "dead";

export interface PlayerLike {
  pos: THREE.Vector3;
  invuln: number;
  airborne: boolean;
  damage(n: number, from: THREE.Vector3): void;
}

export interface FireLike {
  pos: THREE.Vector3;
  alive: boolean;
  damage(n: number): void;
}

export interface SpawnOpts {
  hpMul?: number;
  dmgMul?: number;
  speedMul?: number;
  rise?: boolean;
}

const STATS: Record<EnemyKind, { hp: number; speed: number; range: number; dmg: number; scale: number; windup: number }> = {
  hollow: { hp: 3, speed: 4.4, range: 2.0, dmg: 12, scale: 1, windup: 0.55 },
  runner: { hp: 2, speed: 7.2, range: 1.8, dmg: 8, scale: 0.9, windup: 0.38 },
  brute: { hp: 9, speed: 3.0, range: 2.6, dmg: 22, scale: 1.45, windup: 0.85 },
  shaman: { hp: 3, speed: 4.0, range: 16, dmg: 11, scale: 1, windup: 0.9 },
  warden: { hp: 34, speed: 3.4, range: 4.2, dmg: 26, scale: 2.3, windup: 0.8 },
};

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
  windup: number;
  flash = 0;
  knock = new THREE.Vector3();
  walk = Math.random() * 10;
  slamCount = 0;
  summons = 0;
  castCd = 1.5 + Math.random();
  ring?: THREE.Mesh;
  orb?: THREE.MeshStandardMaterial;
  bar: THREE.Group;
  barFill: THREE.Mesh;
  deadFor = 0;
  targetFire = false;

  constructor(kind: EnemyKind, at: THREE.Vector3, o: SpawnOpts) {
    this.kind = kind;
    const st = STATS[kind];
    const looks: Record<EnemyKind, Parameters<typeof buildHumanoid>[0]> = {
      hollow: { cloth: 0x3b2e24, skin: 0x8a6a52, pants: 0x2a221c, mask: 0xe8e0cc, eye: 0xff6a20 },
      runner: { cloth: 0x6b6f78, skin: 0x9a7a62, pants: 0x3a3c44, mask: 0xf4efe2, eye: 0xffe040 },
      brute: { cloth: 0x1f1a17, skin: 0x6a4a3a, pants: 0x151210, mask: 0xbfb49c, eye: 0xff3010, bones: true },
      shaman: { cloth: 0x2a1640, skin: 0x7a6a70, pants: 0x1a1024, mask: 0xd8d0f0, eye: 0xc070ff },
      warden: { cloth: 0x2a0d14, skin: 0x5a4a44, pants: 0x1a1214, mask: 0xd9cfb8, eye: 0xff1030, bones: true },
    };
    this.model = buildHumanoid(looks[kind]);
    if (kind === "warden") this.model.weapon.add(buildGreatAxe());
    else if (kind === "brute") this.model.weapon.add(buildClub());
    else if (kind === "shaman") {
      const s = buildStaff();
      this.model.weapon.add(s.group);
      this.orb = s.orbMat;
    } else this.model.weapon.add(buildSpear());
    this.scale = st.scale;
    this.model.root.scale.setScalar(this.scale);
    this.pos = at.clone();
    this.maxHp = this.hp = st.hp * (o.hpMul ?? 1);
    this.speed = st.speed * (o.speedMul ?? 1) * (0.92 + Math.random() * 0.16);
    this.range = st.range;
    this.dmg = st.dmg * (o.dmgMul ?? 1);
    this.windup = st.windup;
    this.targetFire = kind === "brute";
    if (kind === "warden") {
      const ring = new THREE.Mesh(
        new THREE.RingGeometry(0.1, 7, 48),
        new THREE.MeshBasicMaterial({ color: 0xff2040, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
      );
      ring.rotation.x = -Math.PI / 2;
      this.ring = ring;
    }
    // floating health bar
    this.bar = new THREE.Group();
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.09), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6, depthWrite: false }));
    this.barFill = new THREE.Mesh(
      new THREE.PlaneGeometry(0.86, 0.06),
      new THREE.MeshBasicMaterial({ color: kind === "warden" ? 0xff2040 : 0xff8a5a, depthWrite: false }),
    );
    this.barFill.position.z = 0.001;
    this.bar.add(bg, this.barFill);
    this.bar.visible = false;
  }

  get alive() {
    return this.state !== "dead";
  }
}

interface Bolt {
  mesh: THREE.Sprite;
  vel: THREE.Vector3;
  life: number;
  dmg: number;
}

export class EnemyManager {
  list: Enemy[] = [];
  kills = 0;
  fire: FireLike | null = null;
  onHitPlayer?: () => void;
  onDeath?: (e: Enemy) => void;
  onSlam?: (e: Enemy) => void;
  onSummon?: (e: Enemy) => void;
  onHit?: (e: Enemy, dmg: number, heavy: boolean) => void;
  onCast?: () => void;
  private bolts: Bolt[] = [];
  private scene: THREE.Scene;
  private colliders: Circle[];
  private boltMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0xc070ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  constructor(scene: THREE.Scene, colliders: Circle[]) {
    this.scene = scene;
    this.colliders = colliders;
  }

  spawn(kind: EnemyKind, at: THREE.Vector3, o: SpawnOpts = {}) {
    const e = new Enemy(kind, at, o);
    const ground = heightAt(at.x, at.z);
    e.pos.y = o.rise === false ? ground : ground - 2 * e.scale;
    if (o.rise === false) e.timer = 0.6;
    e.model.root.position.copy(e.pos);
    this.scene.add(e.model.root, e.bar);
    if (e.ring) this.scene.add(e.ring);
    this.list.push(e);
    return e;
  }

  /** Spawn just out of sight around a point (they rise out of the ground). */
  spawnAround(center: THREE.Vector3, n: number, minR = 14, maxR = 20, kind: EnemyKind = "hollow", o: SpawnOpts = {}) {
    const out: Enemy[] = [];
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = minR + Math.random() * (maxR - minR);
      out.push(this.spawn(kind, new THREE.Vector3(center.x + Math.cos(a) * r, 0, center.z + Math.sin(a) * r), o));
    }
    return out;
  }

  get aliveCount() {
    return this.list.filter((e) => e.alive).length;
  }

  clear() {
    for (const e of this.list) {
      this.scene.remove(e.model.root, e.bar);
      if (e.ring) this.scene.remove(e.ring);
    }
    for (const b of this.bolts) this.scene.remove(b.mesh);
    this.bolts = [];
    this.list = [];
  }

  /** Player swing: returns number of enemies hit. */
  hit(from: THREE.Vector3, facing: number, reach: number, arc: number, dmg: number, heavy: boolean) {
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
      const k = e.kind === "warden" ? (heavy ? 3 : 1.5) : e.kind === "brute" ? (heavy ? 5 : 2) : heavy ? 13 : 7;
      e.knock.set(dx, 0, dz).normalize().multiplyScalar(k);
      const staggers = e.kind !== "brute" && e.kind !== "warden";
      if (staggers && (e.state === "windup" || e.state === "chase")) {
        e.state = "recover";
        e.timer = heavy ? 0.8 : 0.45;
      }
      this.onHit?.(e, dmg, heavy);
      if (e.hp <= 0) this.kill(e);
      n++;
    }
    return n;
  }

  private kill(e: Enemy) {
    e.state = "dead";
    e.deadFor = 0;
    e.bar.visible = false;
    if (e.ring) (e.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    this.kills++;
    this.onDeath?.(e);
  }

  update(dt: number, t: number, player: PlayerLike, camera: THREE.Camera) {
    const fire = this.fire && this.fire.alive ? this.fire : null;
    for (const e of this.list) {
      const m = e.model;
      const ground = heightAt(e.pos.x, e.pos.z);

      // choose a target: brutes go for the fire; others do when you wander off
      let goFire = false;
      if (fire) {
        const dPlayerFire = Math.hypot(player.pos.x - fire.pos.x, player.pos.z - fire.pos.z);
        const dMeFire = Math.hypot(e.pos.x - fire.pos.x, e.pos.z - fire.pos.z);
        const dMePlayer = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
        goFire = (e.targetFire && dMePlayer > 4) || (dPlayerFire > 22 && dMeFire < dMePlayer && e.kind !== "warden");
      }
      const tgt = goFire && fire ? fire.pos : player.pos;
      const dx = tgt.x - e.pos.x;
      const dz = tgt.z - e.pos.z;
      const dist = Math.hypot(dx, dz) - (goFire ? 0.8 : 0);
      const want = Math.atan2(dx, dz);

      // hit flash
      e.flash = Math.max(0, e.flash - dt);
      for (const mm of m.mats) mm.emissive.setRGB(e.flash > 0 ? 1 : 0, e.flash > 0 ? 0.3 : 0, e.flash > 0 ? 0.3 : 0);

      if (e.state === "dead") {
        e.deadFor += dt;
        m.root.rotation.x = Math.min(Math.PI / 2, m.root.rotation.x + dt * 4);
        m.root.position.y = ground + 0.2 * e.scale - Math.max(0, e.deadFor - 2) * 0.6;
        if (e.deadFor > 4) {
          this.scene.remove(m.root, e.bar);
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
      const strikeTarget = (mul = 1) => {
        let da = want - e.yaw;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (dist < e.range + 0.7 && Math.abs(da) < 1.0) {
          if (goFire && fire) fire.damage(e.dmg * 0.7 * mul);
          else if (player.invuln <= 0) {
            player.damage(e.dmg * mul, e.pos);
            this.onHitPlayer?.();
          }
        }
      };

      switch (e.state) {
        case "spawn":
          e.pos.y = Math.min(ground, e.pos.y + dt * 2.6 * e.scale);
          turn(4);
          if (e.timer <= 0 && e.pos.y >= ground - 0.01) e.state = "chase";
          break;
        case "chase":
          turn(6);
          if (e.kind === "shaman" && !goFire) {
            // kite at mid range, cast when ready
            move = dist > 13 ? e.speed : dist < 8 ? -e.speed * 0.8 : 0;
            e.castCd -= dt;
            if (e.castCd <= 0 && dist < 18) {
              e.state = "windup";
              e.timer = e.windup;
            }
            break;
          }
          move = e.speed;
          if (dist < (e.kind === "shaman" ? 2 : e.range)) {
            if (e.kind === "warden" && e.slamCount++ % 3 === 2) {
              e.state = "slamUp";
              e.timer = 1.3;
            } else {
              e.state = "windup";
              e.timer = e.windup;
            }
          } else if (e.kind === "warden" && dist > 14 && Math.random() < dt * 0.4) {
            e.state = "slamUp";
            e.timer = 1.3;
          }
          break;
        case "windup":
          turn(e.kind === "shaman" ? 8 : 3);
          if (e.timer <= 0) {
            e.state = "strike";
            e.timer = 0.15;
            if (e.kind === "shaman" && !goFire) {
              this.castBolt(e, player);
              e.castCd = 2.6 + Math.random() * 1.2;
            } else strikeTarget();
          }
          break;
        case "strike":
          if (e.timer <= 0) {
            e.state = "recover";
            e.timer = e.kind === "warden" ? 0.9 : e.kind === "runner" ? 0.5 : 0.8;
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
            const pd = Math.hypot(player.pos.x - e.pos.x, player.pos.z - e.pos.z);
            if (pd < 7 && !player.airborne && player.invuln <= 0) {
              player.damage(e.dmg * 1.2, e.pos);
              this.onHitPlayer?.();
            }
            if (fire && Math.hypot(fire.pos.x - e.pos.x, fire.pos.z - e.pos.z) < 7) fire.damage(e.dmg);
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

      // Warden summons when wounded
      if (e.kind === "warden") {
        const f = e.hp / e.maxHp;
        if ((f < 0.66 && e.summons === 0) || (f < 0.33 && e.summons === 1)) {
          e.summons++;
          this.spawnAround(e.pos, 3, 8, 12);
          this.onSummon?.(e);
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
      const pdx = player.pos.x - e.pos.x;
      const pdz = player.pos.z - e.pos.z;
      const pd = Math.hypot(pdx, pdz);
      if (pd < 0.9 * e.scale && pd > 0.001) {
        vx -= (pdx / pd) * 3;
        vz -= (pdz / pd) * 3;
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
      const am = Math.abs(move);
      e.walk += dt * am * 2.2;
      const sw = Math.sin(e.walk) * Math.min(1, am / 3) * 0.7;
      m.legL.rotation.x = sw;
      m.legR.rotation.x = -sw;
      m.armL.rotation.x = -sw * 0.8;
      m.eyes.emissiveIntensity = 2;
      if (e.orb) e.orb.emissiveIntensity = 1.5;
      if (e.state === "windup") {
        const k = 1 - e.timer / e.windup;
        if (e.kind === "shaman") {
          m.armR.rotation.x = -k * 2.6;
          if (e.orb) e.orb.emissiveIntensity = 1.5 + k * 10;
        } else {
          m.armR.rotation.x = -0.6 - k * 1.8;
          m.body.rotation.x = -0.15 * k;
        }
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
      if (e.kind === "runner") m.body.rotation.x = Math.max(m.body.rotation.x, am > 1 ? 0.35 : 0);
      m.head.rotation.y = Math.sin(t * 1.3 + e.walk) * 0.1;

      // health bar
      e.bar.visible = e.hp < e.maxHp && e.kind !== "warden";
      if (e.bar.visible) {
        e.bar.position.set(e.pos.x, e.pos.y + 2.25 * e.scale, e.pos.z);
        e.bar.quaternion.copy(camera.quaternion);
        const f = Math.max(0, e.hp / e.maxHp);
        e.barFill.scale.x = f;
        e.barFill.position.x = -0.43 * (1 - f);
      }
    }
    this.list = this.list.filter((e) => e.alive || e.deadFor <= 4);
    this.updateBolts(dt, player, fire);
  }

  private castBolt(e: Enemy, player: PlayerLike) {
    const from = new THREE.Vector3(e.pos.x, e.pos.y + 2.0, e.pos.z);
    const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.1, player.pos.z);
    const s = new THREE.Sprite(this.boltMat);
    s.scale.setScalar(1.1);
    s.position.copy(from);
    this.scene.add(s);
    this.bolts.push({ mesh: s, vel: to.sub(from).normalize().multiplyScalar(15), life: 3, dmg: e.dmg });
    this.onCast?.();
  }

  private updateBolts(dt: number, player: PlayerLike, fire: FireLike | null) {
    for (const b of this.bolts) {
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.scale.setScalar(1 + Math.sin(b.life * 30) * 0.15);
      const p = b.mesh.position;
      const dp = Math.hypot(p.x - player.pos.x, p.y - (player.pos.y + 1.1), p.z - player.pos.z);
      if (dp < 0.9) {
        if (player.invuln <= 0) {
          player.damage(b.dmg, p);
          this.onHitPlayer?.();
        }
        b.life = 0;
      } else if (fire && Math.hypot(p.x - fire.pos.x, p.z - fire.pos.z) < 1.3) {
        fire.damage(b.dmg * 0.5);
        b.life = 0;
      } else if (p.y < heightAt(p.x, p.z)) b.life = 0;
      if (b.life <= 0) this.scene.remove(b.mesh);
    }
    this.bolts = this.bolts.filter((b) => b.life > 0);
  }
}
