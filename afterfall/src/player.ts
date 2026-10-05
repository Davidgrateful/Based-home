// Player controller: first-person while trapped in the ambulance, then a
// third-person over-the-shoulder camera once outside.

import * as THREE from "three";
import { buildAxe, buildHumanoid, type Humanoid } from "./models";

export class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mdx = 0;
  mdy = 0;
  attack = false;
  dash = false;
  locked = false;
  private el: HTMLElement;

  constructor(el: HTMLElement) {
    this.el = el;
    addEventListener("keydown", (e) => {
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
      if (["Space", "Tab", "ArrowUp", "ArrowDown"].includes(e.code)) e.preventDefault();
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => this.keys.clear());
    el.addEventListener("mousedown", (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.attack = true;
      if (e.button === 2) this.dash = true;
    });
    addEventListener("contextmenu", (e) => e.preventDefault());
    document.addEventListener("pointerlockchange", () => {
      this.locked = document.pointerLockElement === el;
    });
    addEventListener("mousemove", (e) => {
      if (!this.locked) return;
      this.mdx += e.movementX;
      this.mdy += e.movementY;
    });
  }

  lock() {
    const p = this.el.requestPointerLock() as unknown as Promise<void> | undefined;
    p?.catch?.(() => {});
  }

  down(c: string) {
    return this.keys.has(c);
  }
  tap(c: string) {
    return this.pressed.has(c);
  }
  endFrame() {
    this.mdx = this.mdy = 0;
    this.pressed.clear();
    this.attack = this.dash = false;
  }
}

export interface Bounds {
  groundAt(x: number, z: number): number;
  constrain(p: THREE.Vector3, r: number): void;
}

export class Player {
  model: Humanoid;
  pos = new THREE.Vector3(0, 0.36, -1.2);
  vy = 0;
  yaw = 0;
  pitch = 0.05;
  facing = 0;
  hp = 100;
  maxHp = 100;
  stamina = 100;
  medkits = 2;
  invuln = 0;
  hurtFlash = 0;
  airborne = false;
  hasAxe = false;
  riftBound = false; // token-holder perk
  firstPerson = true;
  camDist = 0;
  frozen = false;
  attackT = 0; // >0 while swinging
  attackCd = 0;
  combo = 0;
  comboWindow = 0;
  swingDur = 0.34;
  // stats (set from Memories upgrades)
  dmgMul = 1;
  regenMul = 1;
  dodgeCost = 25;
  pickupBonus = 0;
  dashT = 0;
  dashDir = new THREE.Vector3();
  walk = 0;
  shake = 0;
  onSwingHit?: (facing: number, dmg: number, heavy: boolean) => number;
  onHurt?: () => void;
  cameraBlockers: THREE.Object3D[] = [];
  private ray = new THREE.Raycaster();
  private swingDone = false;
  private axe?: THREE.Group;

  constructor(scene: THREE.Scene) {
    this.model = buildHumanoid({ cloth: 0x2f6f73, skin: 0xc79a7a, pants: 0x2c2c3a, eye: 0x111111, hair: 0x2a1a12 });
    // hospital wristband
    const band = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    band.position.y = -0.55;
    this.model.armL.add(band);
    scene.add(this.model.root);
  }

  equipAxe() {
    this.hasAxe = true;
    this.refreshAxe();
  }

  setRiftBound(on: boolean) {
    if (this.riftBound === on) return;
    this.riftBound = on;
    if (on) this.medkits += 1;
    this.refreshAxe();
  }

  private refreshAxe() {
    if (this.axe) this.model.weapon.remove(this.axe);
    if (!this.hasAxe) return;
    this.axe = buildAxe(this.riftBound);
    this.model.weapon.add(this.axe);
  }

  damage(n: number, from: THREE.Vector3) {
    if (this.invuln > 0 || this.hp <= 0) return;
    this.hp = Math.max(0, this.hp - n);
    this.invuln = 0.6;
    this.hurtFlash = 1;
    this.shake = 0.35;
    const k = new THREE.Vector3(this.pos.x - from.x, 0, this.pos.z - from.z).normalize();
    this.dashDir.copy(k).multiplyScalar(9);
    this.dashT = -0.18; // negative dashT = knockback, no i-frames from it
    this.onHurt?.();
  }

  heal() {
    if (this.medkits <= 0 || this.hp >= this.maxHp) return false;
    this.medkits--;
    this.hp = Math.min(this.maxHp, this.hp + 45);
    return true;
  }

  get damagePerHit() {
    return (this.riftBound ? 1.5 : 1) * this.dmgMul;
  }

  update(dt: number, input: Input, bounds: Bounds, camera: THREE.PerspectiveCamera) {
    // ---- look
    const turnKeys = (input.down("ArrowLeft") ? 1 : 0) - (input.down("ArrowRight") ? 1 : 0);
    const pitchKeys = (input.down("ArrowDown") ? 1 : 0) - (input.down("ArrowUp") ? 1 : 0);
    this.yaw -= input.mdx * 0.0024 - turnKeys * dt * 2.4;
    this.pitch = THREE.MathUtils.clamp(this.pitch + input.mdy * 0.0022 + pitchKeys * dt * 1.5, -0.7, 1.1);

    this.invuln = Math.max(0, this.invuln - dt);
    this.hurtFlash = Math.max(0, this.hurtFlash - dt * 2);
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.shake = Math.max(0, this.shake - dt);

    // ---- move
    const fwd = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (!this.frozen) {
      if (input.down("KeyW")) wish.add(fwd);
      if (input.down("KeyS")) wish.sub(fwd);
      if (input.down("KeyD")) wish.add(right);
      if (input.down("KeyA")) wish.sub(right);
    }
    const moving = wish.lengthSq() > 0;
    if (moving) wish.normalize();
    const sprint = moving && input.down("ShiftLeft") && this.stamina > 1 && !this.firstPerson;
    this.stamina = THREE.MathUtils.clamp(this.stamina + (sprint ? -22 : 18 * this.regenMul) * dt, 0, 100);
    let speed = this.firstPerson ? 2.4 : sprint ? 9.5 : 5.6;
    if (this.attackT > 0) speed *= 0.45;

    // dash / dodge
    if (!this.frozen && !this.firstPerson && (input.dash || input.tap("KeyC")) && this.stamina >= this.dodgeCost && this.dashT === 0) {
      this.stamina -= this.dodgeCost;
      this.dashT = 0.28;
      this.invuln = Math.max(this.invuln, 0.32);
      this.dashDir.copy(moving ? wish : fwd).multiplyScalar(19);
      this.onDash?.();
    }
    const vel = wish.multiplyScalar(speed);
    if (this.dashT > 0) {
      vel.copy(this.dashDir);
      this.dashT = Math.max(0, this.dashT - dt);
    } else if (this.dashT < 0) {
      vel.add(this.dashDir);
      this.dashT = Math.min(0, this.dashT + dt);
    }
    this.pos.x += vel.x * dt;
    this.pos.z += vel.z * dt;
    bounds.constrain(this.pos, 0.45);

    // jump + gravity
    const ground = bounds.groundAt(this.pos.x, this.pos.z);
    if (!this.frozen && !this.firstPerson && input.tap("Space") && !this.airborne) {
      this.vy = 7.5;
      this.airborne = true;
    }
    this.vy -= 22 * dt;
    this.pos.y += this.vy * dt;
    if (this.pos.y <= ground) {
      this.pos.y = ground;
      this.vy = 0;
      this.airborne = false;
    }

    // ---- attack
    // 3-hit combo: left, right, then an overhead heavy that hits harder.
    this.comboWindow = Math.max(0, this.comboWindow - dt);
    if (!this.frozen && this.hasAxe && (input.attack || input.tap("KeyF")) && this.attackCd <= 0) {
      this.combo = this.comboWindow > 0 ? (this.combo + 1) % 3 : 0;
      const heavy = this.combo === 2;
      this.swingDur = heavy ? 0.5 : 0.34;
      this.attackT = this.swingDur;
      this.attackCd = heavy ? 0.62 : 0.38;
      this.comboWindow = this.attackCd + 0.45;
      this.swingDone = false;
      this.facing = this.yaw;
      this.onSwing?.(heavy);
    }
    if (this.attackT > 0) {
      this.attackT = Math.max(0, this.attackT - dt);
      if (!this.swingDone && this.attackT < this.swingDur * 0.5) {
        this.swingDone = true;
        const heavy = this.combo === 2;
        const hits = this.onSwingHit?.(this.facing, this.damagePerHit * (heavy ? 2 : 1), heavy) ?? 0;
        if (hits) this.shake = Math.max(this.shake, heavy ? 0.25 : 0.12);
      }
    }

    // ---- facing & animation
    if (this.attackT > 0) this.facing = lerpAngle(this.facing, this.yaw, dt * 20);
    else if (moving && !this.firstPerson) this.facing = lerpAngle(this.facing, Math.atan2(vel.x, vel.z), dt * 12);
    else if (this.firstPerson) this.facing = this.yaw;

    const m = this.model;
    m.root.position.copy(this.pos);
    m.root.rotation.y = this.facing;
    const stride = moving ? speed : 0;
    this.walk += dt * stride * 1.6;
    const sw = Math.sin(this.walk) * Math.min(1, stride / 4) * 0.8;
    m.legL.rotation.x = this.airborne ? -0.5 : sw;
    m.legR.rotation.x = this.airborne ? 0.3 : -sw;
    m.armL.rotation.x = -sw * 0.7;
    m.body.rotation.y = 0;
    if (this.attackT > 0) {
      const k = 1 - this.attackT / this.swingDur; // 0→1
      const raise = k < 0.4 ? k / 0.4 : 1 - (k - 0.4) / 0.6;
      if (this.combo === 2) {
        m.armR.rotation.x = -0.3 - raise * 3.0 + (k > 0.4 ? (k - 0.4) * 2.2 : 0);
        m.armL.rotation.x = m.armR.rotation.x;
        m.armR.rotation.z = 0;
        m.body.rotation.x = k > 0.4 ? 0.4 : -0.25;
      } else {
        m.armR.rotation.x = -0.4 - raise * 2.4 + (k > 0.4 ? (k - 0.4) * 1.5 : 0);
        m.armR.rotation.z = this.combo ? -0.3 : 0.3;
        m.body.rotation.y = (this.combo ? 1 : -1) * (k - 0.5) * 0.8;
        m.body.rotation.x = k > 0.4 ? 0.2 : -0.1;
      }
    } else {
      m.armR.rotation.x += ((this.hasAxe ? -0.5 : 0) + sw * 0.5 - m.armR.rotation.x) * Math.min(1, dt * 10);
      m.armR.rotation.z = 0;
      m.body.rotation.x = this.dashT > 0 ? 0.35 : 0;
    }
    m.root.visible = !this.firstPerson || this.camDist > 0.8;

    // ---- camera
    this.camDist += ((this.firstPerson ? 0 : 5.6) - this.camDist) * Math.min(1, dt * 2.2);
    const head = new THREE.Vector3(this.pos.x, this.pos.y + 1.7 + Math.min(1, this.camDist / 5.2) * 0.55, this.pos.z);
    const dir = new THREE.Vector3(
      Math.sin(this.yaw) * Math.cos(this.pitch),
      -Math.sin(this.pitch),
      Math.cos(this.yaw) * Math.cos(this.pitch),
    );
    const side = Math.min(1, this.camDist / 5.2) * 0.7;
    let dist = this.camDist;
    if (this.cameraBlockers.length && dist > 0.5) {
      // pull the camera in front of walls/wrecks instead of clipping through them
      const back = dir.clone().multiplyScalar(-dist).addScaledVector(right, side);
      const len = back.length();
      this.ray.camera = camera;
      this.ray.set(head, back.normalize());
      this.ray.far = len;
      const hit = this.ray.intersectObjects(this.cameraBlockers, true)[0];
      if (hit) dist *= Math.max(0.1, (hit.distance - 0.3) / len);
    }
    const camPos = head.clone().addScaledVector(dir, -dist).addScaledVector(right, side * (dist / Math.max(0.01, this.camDist)));
    camPos.y = Math.max(camPos.y, bounds.groundAt(camPos.x, camPos.z) + 0.4);
    camera.position.copy(camPos);
    if (this.shake > 0) {
      const s = this.shake * 0.4;
      camera.position.add(new THREE.Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s));
    }
    if (this.firstPerson && moving) camera.position.y += Math.sin(this.walk * 2) * 0.03;
    camera.lookAt(head.clone().addScaledVector(dir, 10).addScaledVector(right, side));
  }

  onSwing?: (heavy: boolean) => void;
  onDash?: () => void;
}

function lerpAngle(a: number, b: number, k: number) {
  let d = b - a;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return a + d * Math.min(1, k);
}
