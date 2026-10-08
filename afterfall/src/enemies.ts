// The Hollow (masked patients who fell before you) and their Warden.
// Readable state machines: chase → telegraphed wind-up → strike → recover.
//   hollow  — the baseline spearman
//   runner  — fast, fragile, short wind-up
//   brute   — slow, armored, ignores staggers, goes for the campfire
//   shaman  — keeps its distance and throws rift bolts you can dodge
//   warden  — Patient One: big swings, telegraphed ground slam, summons
//   thing   — not a patient: a native. Territorial, fears firelight, lunges

import * as THREE from "three";
import { Person } from "./people";
import { buildClub, buildGreatAxe, buildHumanoid, buildSpear, buildStaff, buildThing, type Humanoid } from "./models";
import { type Circle, glowTexture, heightAt } from "./world";

export type EnemyKind = "hollow" | "runner" | "brute" | "shaman" | "warden" | "thing";
export type State = "spawn" | "chase" | "windup" | "strike" | "recover" | "slamUp" | "dead";

export interface PlayerLike {
  pos: THREE.Vector3;
  /** where they're looking (a stalker moves in when your back is turned) */
  yaw?: number;
  invuln: number;
  airborne: boolean;
  down?: boolean;
  damage(n: number, from: THREE.Vector3): void;
}

// Order is the network id: only ever append.
export const KINDS: EnemyKind[] = ["hollow", "runner", "brute", "shaman", "warden", "thing"];
export const STATES: State[] = ["spawn", "chase", "windup", "strike", "recover", "slamUp", "dead"];

/** Compact network form: [id, kind, x, z, yaw, state, timer, hp, maxHp] */
export type EnemySnap = [number, number, number, number, number, number, number, number, number];

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
  thing: { hp: 4, speed: 6.4, range: 2.8, dmg: 10, scale: 1.15, windup: 0.5 },
};

export class Enemy {
  id = 0;
  netPos: THREE.Vector3 | null = null;
  netYaw = 0;
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
  /** Natives: where they range from, and whether you've given them a reason. */
  home = new THREE.Vector3();
  provoked = false;
  noticed = false;
  wanderT = 0;
  wanderYaw = 0;
  /** The state the body last animated (real people play clips on changes). */
  animState: State | "" = "";
  /** Stalker (Chapter One's Hollow): circles, hesitates, waits for an opening,
   *  rushes in, then backs off. Afraid of firelight. */
  stalk = false;
  courage = 0;
  committed = false;
  pausing = false;
  burstT = 0;
  strafe = Math.random() < 0.5 ? 1 : -1;
  flee = 0;
  murmurT = 2 + Math.random() * 4;
  /** how quickly this one works itself up (the first Hollow is bolder) */
  bold = 1;

  constructor(kind: EnemyKind, at: THREE.Vector3, o: SpawnOpts) {
    this.kind = kind;
    const st = STATS[kind];
    const looks: Record<Exclude<EnemyKind, "thing">, Parameters<typeof buildHumanoid>[0]> = {
      hollow: { cloth: 0x3b2e24, skin: 0x8a6a52, pants: 0x2a221c, mask: 0xe8e0cc, eye: 0xff3a1a },
      runner: { cloth: 0x6b6f78, skin: 0x9a7a62, pants: 0x3a3c44, mask: 0xf4efe2, eye: 0xffe040 },
      brute: { cloth: 0x1f1a17, skin: 0x6a4a3a, pants: 0x151210, mask: 0xbfb49c, eye: 0xff3010, bones: true },
      shaman: { cloth: 0x2a1640, skin: 0x7a6a70, pants: 0x1a1024, mask: 0xd8d0f0, eye: 0x5ee0ff },
      warden: { cloth: 0x2a0d14, skin: 0x5a4a44, pants: 0x1a1214, mask: 0xd9cfb8, eye: 0xff1030, bones: true },
    };
    this.model = kind === "thing" ? buildThing() : buildHumanoid(looks[kind]);
    if (kind === "thing") {
      /* no weapon: it is the weapon */
    } else if (kind === "warden") this.model.weapon.add(buildGreatAxe());
    else if (kind === "brute") this.model.weapon.add(buildClub());
    else if (kind === "shaman") {
      const s = buildStaff();
      this.model.weapon.add(s.group);
      this.orb = s.orbMat;
    } else this.model.weapon.add(buildSpear());
    this.scale = st.scale;
    this.model.root.scale.setScalar(this.scale);
    this.pos = at.clone();
    this.home.copy(at);
    this.wanderYaw = Math.random() * Math.PI * 2;
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
      new THREE.MeshBasicMaterial({ color: kind === "warden" ? 0xff2040 : kind === "thing" ? 0xc8e8d0 : 0xff8a5a, depthWrite: false }),
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
  /** Co-op client: enemies are puppets driven by the host's snapshots. */
  puppet = false;
  /** Other players the Hollow can target (co-op). */
  others: PlayerLike[] = [];
  private nextId = 1;
  fire: FireLike | null = null;
  /** Seconds the Hollow hold at the edge of the firelight (a stand-off). */
  holdT = 0;
  /** Lit fires: natives won't come into their light. */
  lights: THREE.Vector3[] = [];
  /** Firelight the Hollow are afraid of: centre, radius, strength 0..1. */
  fear: { pos: THREE.Vector3; r: number; k: number } | null = null;
  /** How many may be committed to an attack at once (the rest circle). */
  maxAttackers = Infinity;
  /** Scales how quickly stalkers work up to an attack (the storm raises it). */
  aggression = 1;
  /** Dawn: the Hollow give up and walk back into the trees. */
  retreat = false;
  onWindup?: (e: Enemy) => void;
  onMurmur?: (e: Enemy) => void;
  /** A native has noticed someone (first growl, first sighting line). */
  onNotice?: (e: Enemy) => void;
  onHitPlayer?: () => void;
  onDeath?: (e: Enemy) => void;
  onSlam?: (e: Enemy) => void;
  onSummon?: (e: Enemy) => void;
  onHit?: (e: Enemy, dmg: number, heavy: boolean) => void;
  onCast?: (e: Enemy, to: THREE.Vector3) => void;
  private bolts: Bolt[] = [];
  private scene: THREE.Scene;
  private colliders: Circle[];
  private boltMat = new THREE.SpriteMaterial({ map: glowTexture(), color: 0x6fe6ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });

  constructor(scene: THREE.Scene, colliders: Circle[]) {
    this.scene = scene;
    this.colliders = colliders;
  }

  spawn(kind: EnemyKind, at: THREE.Vector3, o: SpawnOpts = {}) {
    const e = new Enemy(kind, at, o);
    e.id = this.nextId++;
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

  /** Living Hollow. Natives are wildlife, not a wave: they don't count. */
  get aliveCount() {
    return this.list.filter((e) => e.alive && e.kind !== "thing").length;
  }

  /** Quietly drop an enemy (wildlife that wandered out of range). */
  remove(e: Enemy) {
    this.scene.remove(e.model.root, e.bar);
    this.list = this.list.filter((q) => q !== e);
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
  hit(from: THREE.Vector3, facing: number, reach: number, arc: number, dmg: number, heavy: boolean, apply = true) {
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
      e.flash = 0.15;
      e.provoked = true;
      if (e.stalk && apply) {
        // hurt, it backs off: it wants you, but it doesn't want this
        e.committed = false;
        e.courage = Math.min(e.courage, 0.2) - 0.25;
        e.flee = heavy ? 0.9 : 0.55;
      }
      if (!apply) {
        this.onHit?.(e, dmg, heavy);
        n++;
        continue;
      }
      e.hp -= dmg;
      const k = e.kind === "warden" ? (heavy ? 3 : 1.5) : e.kind === "brute" ? (heavy ? 5 : 2) : heavy ? 13 : 7;
      e.knock.set(dx, 0, dz).normalize().multiplyScalar(k);
      const staggers = e.kind !== "brute" && e.kind !== "warden";
      if (staggers && (e.state === "windup" || e.state === "chase")) {
        e.state = "recover";
        e.timer = heavy ? 0.8 : 0.45;
      }
      this.onHit?.(e, dmg, heavy);
      if (e.hp > 0 && e.model instanceof Person && (e.state === "chase" || e.state === "recover")) void e.model.play(heavy ? "hitHead" : "hitChest", 1.1);
      if (e.hp <= 0) this.kill(e);
      n++;
    }
    return n;
  }

  private kill(e: Enemy) {
    if (e.model instanceof Person) void e.model.play("die", 1.25, true);
    e.state = "dead";
    e.deadFor = 0;
    e.bar.visible = false;
    if (e.ring) (e.ring.material as THREE.MeshBasicMaterial).opacity = 0;
    this.kills++;
    this.onDeath?.(e);
  }

  update(dt: number, t: number, me: PlayerLike, camera: THREE.Camera) {
    const fire = this.fire && this.fire.alive ? this.fire : null;
    this.holdT = Math.max(0, this.holdT - dt);
    const targets = [me, ...this.others].filter((p) => !p.down);
    if (!targets.length) targets.push(me);
    const gone: Enemy[] = [];
    for (const e of this.list) {
      const m = e.model;
      const ground = heightAt(e.pos.x, e.pos.z);
      // nearest standing survivor
      let player = targets[0];
      let best = Infinity;
      for (const p of targets) {
        const d = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
        if (d < best) {
          best = d;
          player = p;
        }
      }

      // choose a target: brutes go for the fire; others do when you wander off
      let goFire = false;
      if (fire) {
        const dPlayerFire = Math.hypot(player.pos.x - fire.pos.x, player.pos.z - fire.pos.z);
        const dMeFire = Math.hypot(e.pos.x - fire.pos.x, e.pos.z - fire.pos.z);
        const dMePlayer = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
        goFire = e.kind !== "thing" && ((e.targetFire && dMePlayer > 4) || (dPlayerFire > 22 && dMeFire < dMePlayer && e.kind !== "warden"));
      }
      const tgt = goFire && fire ? fire.pos : player.pos;
      const dx = tgt.x - e.pos.x;
      const dz = tgt.z - e.pos.z;
      const dist = Math.hypot(dx, dz) - (goFire ? 0.8 : 0);
      let want = Math.atan2(dx, dz);

      // hit flash
      e.flash = Math.max(0, e.flash - dt);
      for (const mm of m.mats) mm.emissive.setRGB(e.flash > 0 ? 1 : 0, e.flash > 0 ? 0.3 : 0, e.flash > 0 ? 0.3 : 0);

      if (e.state === "dead") {
        e.deadFor += dt;
        if (e.kind === "thing") m.root.rotation.z = Math.min(Math.PI / 2, m.root.rotation.z + dt * 4);
        else if (m instanceof Person) m.root.position.y = ground - Math.max(0, e.deadFor - 2.4) * 0.5;
        else m.root.rotation.x = Math.min(Math.PI / 2, m.root.rotation.x + dt * 4);
        if (!(m instanceof Person)) m.root.position.y = ground + 0.2 * e.scale - Math.max(0, e.deadFor - 2) * 0.6;
        if (e.deadFor > 4) {
          this.scene.remove(m.root, e.bar);
          if (e.ring) this.scene.remove(e.ring);
        }
        continue;
      }

      e.timer -= dt;
      let move = 0;
      if (this.puppet) {
        // mirror the host: glide to its position, keep its state for animation
        if (e.netPos) {
          const k = Math.min(1, dt * 10);
          const ox = e.pos.x;
          const oz = e.pos.z;
          e.pos.x += (e.netPos.x - e.pos.x) * k;
          e.pos.z += (e.netPos.z - e.pos.z) * k;
          move = Math.hypot(e.pos.x - ox, e.pos.z - oz) / Math.max(dt, 1e-3);
        }
        let dy = e.netYaw - e.yaw;
        dy = Math.atan2(Math.sin(dy), Math.cos(dy));
        e.yaw += dy * Math.min(1, dt * 10);
        e.pos.y = e.state === "spawn" ? Math.min(ground, e.pos.y + dt * 2.6 * e.scale) : heightAt(e.pos.x, e.pos.z);
        if (e.state === "slamUp" && e.ring) {
          const k = 1 - Math.max(0, e.timer) / 1.3;
          e.ring.position.set(e.pos.x, ground + 0.1, e.pos.z);
          e.ring.scale.setScalar(0.2 + k * 0.8);
          (e.ring.material as THREE.MeshBasicMaterial).opacity = 0.2 + k * 0.5;
        } else if (e.ring) (e.ring.material as THREE.MeshBasicMaterial).opacity = 0;
      } else {
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
              if (player === me) this.onHitPlayer?.();
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
            if (e.kind === "thing") {
              // its own ecosystem: keep out of firelight, range near home,
              // and only hunt what comes close or hurts it
              const light = this.lights.find((l) => Math.hypot(e.pos.x - l.x, e.pos.z - l.z) < 14);
              if (light) {
                want = Math.atan2(e.pos.x - light.x, e.pos.z - light.z);
                turn(5);
                move = e.speed * 0.8;
                break;
              }
              if (!e.provoked && best > 13) {
                e.wanderT -= dt;
                if (e.wanderT <= 0) {
                  e.wanderT = 2 + Math.random() * 3;
                  const home = Math.atan2(e.home.x - e.pos.x, e.home.z - e.pos.z);
                  const far = Math.hypot(e.home.x - e.pos.x, e.home.z - e.pos.z) > 12;
                  e.wanderYaw = far ? home : e.yaw + (Math.random() - 0.5) * 2.4;
                }
                want = e.wanderYaw;
                turn(2);
                move = e.wanderT > 1 ? e.speed * 0.22 : 0;
                break;
              }
              if (!e.noticed) {
                e.noticed = true;
                this.onNotice?.(e);
              }
            }
            if (this.retreat && e.kind !== "warden") {
              // dawn: back into the trees, not running, and gone
              want = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
              turn(3);
              move = e.speed * 0.55;
              if (best > 34) gone.push(e);
              break;
            }
            const fearHold = this.fear ?? (fire ? { pos: fire.pos, r: 22, k: 1 } : null);
            if (this.holdT > 0 && fearHold && e.kind !== "warden" && Math.hypot(e.pos.x - fearHold.pos.x, e.pos.z - fearHold.pos.z) < fearHold.r + 8) {
              want = Math.atan2(fearHold.pos.x - e.pos.x, fearHold.pos.z - e.pos.z);
              turn(4);
              move = 0; // standing at the edge of the light, staring in
              break;
            }
            if (e.stalk && e.kind !== "warden") {
              const st = this.stalkStep(e, dt, player, dist, want);
              want = st.want;
              turn(st.rate);
              move = st.move;
              if (st.attack) {
                e.state = "windup";
                e.timer = e.windup;
                this.onWindup?.(e);
              }
              break;
            }
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
                this.onWindup?.(e);
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
              // natives lunge through the bite
              if (e.kind === "thing") e.knock.set(Math.sin(e.yaw), 0, Math.cos(e.yaw)).multiplyScalar(9);
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
              for (const p of targets) {
                const pd = Math.hypot(p.pos.x - e.pos.x, p.pos.z - e.pos.z);
                if (pd < 7 && !p.airborne && p.invuln <= 0) {
                  p.damage(e.dmg * 1.2, e.pos);
                  if (p === me) this.onHitPlayer?.();
                }
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
            if (e.timer <= 0) {
              e.state = "chase";
              if (e.stalk) {
                // it struck (or was struck): back off and start working up to it again
                e.committed = false;
                e.courage = Math.min(e.courage, 0) - Math.random() * 0.3;
                e.flee = Math.max(e.flee, 0.7);
              }
            }
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
      }

      // animation
      m.root.position.copy(e.pos);
      m.root.rotation.y = e.yaw;
      const am = Math.abs(move);
      e.walk += dt * am * 2.2;
      const sw = Math.sin(e.walk) * Math.min(1, am / 3) * 0.7;
      if (m instanceof Person) {
        animatePerson(e, m, am);
        m.root.rotation.y = e.yaw;
        e.bar.visible = e.hp < e.maxHp && e.kind !== "warden";
        if (e.bar.visible) {
          e.bar.position.set(e.pos.x, e.pos.y + 2.25 * e.scale, e.pos.z);
          e.bar.quaternion.copy(camera.quaternion);
          const f = Math.max(0, e.hp / e.maxHp);
          e.barFill.scale.x = f;
          e.barFill.position.x = -0.43 * (1 - f);
        }
        continue;
      }
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
      if (e.kind === "thing") {
        // trot: diagonal pairs together
        const g = Math.sin(e.walk * 1.4) * Math.min(1, am / 2) * 0.6;
        m.legL.rotation.x = g;
        m.armR.rotation.x = g;
        m.legR.rotation.x = -g;
        m.armL.rotation.x = -g;
        const k = e.state === "windup" ? 1 - e.timer / e.windup : 0;
        m.body.rotation.x = e.state === "windup" ? 0.22 * k : e.state === "strike" ? -0.18 : 0;
        m.head.rotation.x = e.state === "windup" ? 0.3 * k : Math.sin(t * 2 + e.walk) * 0.05;
        m.body.position.y = 0.72 + Math.abs(g) * 0.05;
      }
      m.head.rotation.y = Math.sin(t * 1.3 + e.walk) * 0.1;

      // health bar
      e.bar.visible = e.hp < e.maxHp && e.kind !== "warden";
      if (e.bar.visible) {
        e.bar.position.set(e.pos.x, e.pos.y + (e.kind === "thing" ? 1.35 : 2.25) * e.scale, e.pos.z);
        e.bar.quaternion.copy(camera.quaternion);
        const f = Math.max(0, e.hp / e.maxHp);
        e.barFill.scale.x = f;
        e.barFill.position.x = -0.43 * (1 - f);
      }
    }
    for (const e of gone) this.remove(e);
    this.list = this.list.filter((e) => e.alive || e.deadFor <= 4);
    this.updateBolts(dt, targets, me, fire);
  }

  /** One frame of a stalker's chase: hold a ring outside the light (or around
   *  you), move in bursts, stop and stare, switch sides, and only rush in once
   *  it has worked itself up to it and nobody else is already attacking. */
  private stalkStep(e: Enemy, dt: number, player: PlayerLike, dist: number, toward: number) {
    e.murmurT -= dt;
    if (e.murmurT <= 0) {
      e.murmurT = 5 + Math.random() * 7;
      this.onMurmur?.(e);
    }
    if (e.flee > 0) {
      e.flee -= dt;
      return { want: toward + Math.PI + (e.strafe * 0.5), move: e.speed * 0.7, rate: 6, attack: false };
    }
    const fear = this.fear;
    const dFire = fear ? Math.hypot(e.pos.x - fear.pos.x, e.pos.z - fear.pos.z) : Infinity;
    const playerInLight = !!fear && Math.hypot(player.pos.x - fear.pos.x, player.pos.z - fear.pos.z) < fear.r;
    let look = Math.atan2(e.pos.x - player.pos.x, e.pos.z - player.pos.z) - (player.yaw ?? 0);
    look = Math.atan2(Math.sin(look), Math.cos(look));
    const watched = Math.abs(look) < 0.65;

    let rate = 0.12 * this.aggression * e.bold;
    if (!watched) rate *= 1.9; // it comes when you aren't looking
    if (playerInLight && fear) rate *= 1 - 0.75 * fear.k;
    e.courage += rate * dt;

    if (e.committed) {
      // and still, right at the fire, it can lose its nerve
      if (fear && dFire < fear.r * 0.55 && fear.k > 0.55 && Math.random() < dt * 1.2) {
        e.committed = false;
        e.courage = -0.2;
        e.flee = 0.8;
        return { want: toward + Math.PI, move: e.speed * 0.7, rate: 7, attack: false };
      }
      if (dist < e.range) return { want: toward, move: 0, rate: 8, attack: true };
      return { want: toward, move: e.speed * 1.15, rate: 7, attack: false };
    }
    const busy = this.list.filter((o) => o.alive && (o.committed || o.state === "windup" || o.state === "strike")).length;
    if (e.courage >= 1 && busy < this.maxAttackers) {
      e.committed = true;
      e.pausing = false;
      return { want: toward, move: e.speed * 1.15, rate: 7, attack: false };
    }

    // circle: the edge of the light if you're in it, else a few metres off you
    const c = playerInLight && fear ? fear.pos : player.pos;
    const ringR = playerInLight && fear ? fear.r + 1.5 : 6.5 + (e.id % 3);
    const dc = Math.hypot(e.pos.x - c.x, e.pos.z - c.z);
    const radial = dc - ringR;
    const out = Math.atan2(e.pos.x - c.x, e.pos.z - c.z);
    let want = out + (e.strafe * Math.PI) / 2;
    if (radial > 1.5) want = out + Math.PI + e.strafe * 0.35;
    else if (radial < -1.2) want = out + e.strafe * 0.35;

    e.burstT -= dt;
    if (e.burstT <= 0) {
      e.pausing = !e.pausing;
      e.burstT = e.pausing ? 0.5 + Math.random() * 1.4 : 0.5 + Math.random() * 1.3;
      if (!e.pausing && Math.random() < 0.3) e.strafe *= -1;
      if (e.pausing && Math.random() < 0.18 && e.model instanceof Person) void e.model.play("hitHead", 0.45);
    }
    if (e.pausing) return { want: toward, move: 0, rate: 3, attack: false }; // stop, and stare
    return { want, move: e.speed * (Math.abs(radial) > 1.5 ? 0.55 : 0.38), rate: 5, attack: false };
  }

  /** Host: compact snapshot of every enemy (incl. the recently dead). */
  snapshot(): EnemySnap[] {
    const r = (v: number) => Math.round(v * 100) / 100;
    return this.list.map((e) => [e.id, KINDS.indexOf(e.kind), r(e.pos.x), r(e.pos.z), r(e.yaw), STATES.indexOf(e.state), r(e.timer), r(e.hp), r(e.maxHp)]);
  }

  /** Client: make the local puppets match the host. */
  applySnapshot(snap: EnemySnap[]) {
    const seen = new Set<number>();
    for (const [id, k, x, z, yaw, st, timer, hp, maxHp] of snap) {
      seen.add(id);
      const state = STATES[st];
      let e = this.list.find((q) => q.id === id);
      if (!e) {
        if (state === "dead") continue;
        e = this.spawn(KINDS[k], new THREE.Vector3(x, 0, z), { rise: state === "spawn" });
        e.id = id;
        e.yaw = yaw;
      }
      e.netPos = new THREE.Vector3(x, 0, z);
      e.netYaw = yaw;
      e.maxHp = maxHp;
      if (hp < e.hp) e.flash = 0.15;
      e.hp = hp;
      if (!e.alive) continue;
      if (state === "dead") this.kill(e);
      else {
        e.state = state;
        e.timer = timer;
      }
    }
    for (const e of this.list) {
      if (!seen.has(e.id) && e.alive) {
        this.scene.remove(e.model.root, e.bar);
        if (e.ring) this.scene.remove(e.ring);
        e.state = "dead";
        e.deadFor = 99;
      }
    }
  }

  /** Client: show a bolt the host's shaman cast (visual only). */
  castBoltFrom(id: number, to: THREE.Vector3) {
    const e = this.list.find((q) => q.id === id);
    if (!e) return;
    const from = new THREE.Vector3(e.pos.x, e.pos.y + 2.0, e.pos.z);
    const s = new THREE.Sprite(this.boltMat);
    s.scale.setScalar(1.1);
    s.position.copy(from);
    this.scene.add(s);
    this.bolts.push({ mesh: s, vel: to.clone().sub(from).normalize().multiplyScalar(15), life: 3, dmg: 0 });
  }

  private castBolt(e: Enemy, player: PlayerLike) {
    const from = new THREE.Vector3(e.pos.x, e.pos.y + 2.0, e.pos.z);
    const to = new THREE.Vector3(player.pos.x, player.pos.y + 1.1, player.pos.z);
    const s = new THREE.Sprite(this.boltMat);
    s.scale.setScalar(1.1);
    s.position.copy(from);
    this.scene.add(s);
    this.onCast?.(e, to.clone());
    this.bolts.push({ mesh: s, vel: to.sub(from).normalize().multiplyScalar(15), life: 3, dmg: e.dmg });
  }

  private updateBolts(dt: number, players: PlayerLike[], me: PlayerLike, fire: FireLike | null) {
    for (const b of this.bolts) {
      b.life -= dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.scale.setScalar(1 + Math.sin(b.life * 30) * 0.15);
      const p = b.mesh.position;
      const hitP = players.find((pl) => Math.hypot(p.x - pl.pos.x, p.y - (pl.pos.y + 1.1), p.z - pl.pos.z) < 0.9);
      if (hitP) {
        if (hitP.invuln <= 0 && !this.puppet) {
          hitP.damage(b.dmg, p);
          if (hitP === me) this.onHitPlayer?.();
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

/** Real people: a base loop from the ground speed and a clip on each change
 *  of state, timed to the AI's windups. */
function animatePerson(e: Enemy, m: Person, am: number) {
  const fresh = e.state !== e.animState;
  e.animState = e.state;
  if (e.orb) e.orb.emissiveIntensity = 1.5;
  m.eyes.emissiveIntensity = 2;
  switch (e.state) {
    case "spawn":
      m.setBase("crouch", 1, 0.1);
      break;
    case "windup": {
      const k = 1 - e.timer / e.windup;
      m.eyes.emissiveIntensity = 2 + k * 8;
      if (e.kind === "shaman") {
        if (e.orb) e.orb.emissiveIntensity = 1.5 + k * 10;
        if (fresh) void m.play("cast", 0.5 / Math.max(0.2, e.windup));
      } else if (fresh) {
        // the swing lands ~0.62s into the clip: line that up with the strike
        void m.play(e.kind === "runner" ? "jab" : "attack", Math.max(0.6, 0.62 / Math.max(0.15, e.windup)));
      }
      break;
    }
    case "slamUp": {
      const k = 1 - e.timer / 1.3;
      m.eyes.emissiveIntensity = 2 + k * 10;
      m.root.position.y = e.pos.y + Math.sin(k * Math.PI) * 0.6;
      if (fresh) void m.play("jumpStart", 1.05);
      break;
    }
    case "strike":
    case "recover":
      m.move(am * 0.6, true);
      break;
    default: {
      const run = e.kind === "runner" || e.kind === "brute" ? 1.35 : 1;
      m.move(am * run, true);
    }
  }
}
