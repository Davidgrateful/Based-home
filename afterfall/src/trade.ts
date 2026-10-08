// THE TRADING POST — a table on the path between the fire and the Old Camp.
//
// Survivors built it from what was lying around: planks on two trestles, a
// tarp strung over, crates, fuel cans, a radio hissing to itself, a lantern,
// prices chalked on a board and a tin with a note: TAKE WHAT YOU NEED. LEAVE
// WHAT IT'S WORTH. Nobody's ever there. It's always stocked.
//
// Walk up, USE, choose, confirm. Close it and you're standing at the table.

import * as THREE from "three";
import { $, cine, enemies, type Interact, input, LOW, persist, player, say, sfx, state, voice } from "./ctx";
import { CATALOG, inStock, purchase, quote } from "./economy";
import { save } from "./save";
import * as S from "./script";
import { heightAt, TRADE, type World } from "./world";

const mat = (color: number, rough = 0.9, metal = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...extra });

/** Chalk on a board: the prices, straight from the catalog. */
function priceBoard() {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 384;
  const g = c.getContext("2d")!;
  g.fillStyle = "#3b3128";
  g.fillRect(0, 0, 512, 384);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = `rgba(0,0,0,${0.12 + (i % 2) * 0.08})`;
    g.fillRect(0, i * 77, 512, 2); // plank seams
  }
  g.fillStyle = "rgba(236,230,214,0.92)";
  g.font = '600 40px "Barlow Condensed", sans-serif';
  g.save();
  g.translate(30, 56);
  g.rotate(-0.025);
  g.fillText("TRADE · SHARDS", 0, 0);
  g.restore();
  g.font = '500 34px "Barlow Condensed", sans-serif';
  CATALOG.forEach((it, i) => {
    g.save();
    g.translate(36 + (i % 2) * 6, 112 + i * 44);
    g.rotate((i % 3) * 0.012 - 0.012);
    g.fillText(it.name.toUpperCase(), 0, 0);
    g.textAlign = "right";
    g.fillText(String(it.price()), 440, 0);
    g.restore();
  });
  g.strokeStyle = "rgba(236,230,214,0.5)";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(30, 72);
  g.lineTo(470, 68);
  g.stroke();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function noteTex() {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 160;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d9d1bd";
  g.fillRect(0, 0, 256, 160);
  g.fillStyle = "#2a2622";
  g.font = '600 26px "Barlow Condensed", sans-serif';
  g.fillText("TAKE WHAT YOU NEED.", 14, 58);
  g.fillText("LEAVE WHAT IT'S WORTH.", 14, 100);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Build the post into the world (once). */
export function buildTradingPost(world: World) {
  const g = new THREE.Group();
  const P = TRADE;
  g.position.set(P.x, heightAt(P.x, P.z), P.z);
  g.rotation.y = 0.35; // facing the path
  const wood = mat(0x5a4836, 1);
  const dark = mat(0x3a2f26, 1);
  const add = (m: THREE.Object3D, x: number, y: number, z: number, ry = 0) => {
    m.position.set(x, y, z);
    m.rotation.y = ry;
    g.add(m);
    return m;
  };
  // the table: three planks on two trestles
  for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.045, 0.26), i === 1 ? dark : wood), 0, 0.86, -0.27 + i * 0.27, (i - 1) * 0.015);
  for (const x of [-0.75, 0.75]) {
    for (const s of [-1, 1]) {
      const leg = add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.95, 6), dark), x, 0.43, s * 0.22);
      leg.rotation.x = s * 0.28;
    }
    add(new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.6), dark), x, 0.8, 0);
  }
  // on the table: a radio, a lantern, the tin and its note, a few of what's for sale
  const radio = new THREE.Group();
  radio.add(new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.16), mat(0x3d4232, 0.7, 0.2)));
  const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 12), mat(0x8a8470, 0.5, 0.4));
  dial.rotation.x = Math.PI / 2;
  dial.position.set(0.1, 0, 0.085);
  radio.add(dial);
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12), mat(0x1d1f1a, 1));
  grille.position.set(-0.06, 0, 0.081);
  radio.add(grille);
  const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5), mat(0x8a8d90, 0.4, 0.8));
  ant.position.set(0.13, 0.33, -0.04);
  ant.rotation.z = -0.3;
  radio.add(ant);
  add(radio, -0.6, 0.98, -0.12, 0.3);
  // the lantern: the one light here, low and warm
  const lantern = new THREE.Group();
  lantern.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.04, 10), mat(0x2a2522, 0.6, 0.6)));
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.14, 10), mat(0x2a1f10, 0.3, 0, { emissive: 0xffb860, emissiveIntensity: 1.6 }));
  glass.position.y = 0.09;
  lantern.add(glass);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.06, 10), mat(0x2a2522, 0.6, 0.6));
  cap.position.y = 0.19;
  lantern.add(cap);
  add(lantern, 0.62, 0.9, 0.12);
  const light = new THREE.PointLight(0xffc98a, LOW ? 2.2 : 2.8, 9, 1.8);
  light.position.set(0.62, 1.15, 0.12);
  g.add(light);
  const tin = add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 12), mat(0x8a7a5a, 0.5, 0.6)), 0.15, 0.94, 0.15);
  void tin;
  const note = add(new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.16), new THREE.MeshStandardMaterial({ map: noteTex(), roughness: 1 })), 0.15, 0.885, -0.08);
  note.rotation.x = -Math.PI / 2;
  note.rotation.z = 0.15;
  const med = new THREE.Group();
  med.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.2), mat(0xd8d4c8, 0.7)));
  const cross = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.002, 0.03), mat(0xa02a22, 0.7));
  cross.position.y = 0.061;
  med.add(cross, cross.clone().rotateY(Math.PI / 2));
  add(med, -0.15, 0.95, 0.1, -0.2);
  for (let i = 0; i < 3; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.11, 10), mat(0x8a8d84, 0.4, 0.7)), -0.35 + i * 0.08, 0.94, -0.18);
  for (let i = 0; i < 2; i++) add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.24, 10), mat(0x6e8796, 0.25, 0, { transparent: true, opacity: 0.85 })), 0.38 + i * 0.09, 1.0, -0.15);
  // crates and fuel beside it
  for (const [x, z, y, ry] of [[1.45, -0.2, 0.2, 0.2], [1.5, 0.45, 0.2, -0.1], [1.45, 0.1, 0.6, 0.35]] as const) {
    const c = new THREE.Group();
    c.add(new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.4, 0.45), mat(0x4a4f3a, 0.9)));
    const rc = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.002), mat(0x9a2a22, 0.8));
    rc.position.z = 0.226;
    c.add(rc, rc.clone().rotateZ(Math.PI / 2));
    add(c, x, y, z, ry);
  }
  for (const [x, z, ry] of [[-1.35, 0.35, 0.4], [-1.55, 0.05, -0.3]] as const) {
    const can = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.46, 0.17), mat(0x7a2418, 0.6, 0.35));
    body.position.y = 0.23;
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.05, 0.05), mat(0x2a2522, 0.6, 0.5));
    h.position.y = 0.49;
    can.add(body, h);
    add(can, x, 0, z, ry);
  }
  // a tarp strung over the table from two poles and the trees behind
  for (const x of [-1.1, 1.1]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.3, 6), dark), x, 1.15, 0.55);
  const tarp = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6, 6, 4), mat(0x3d4a44, 1, 0, { side: THREE.DoubleSide }));
  const tp = tarp.geometry.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < tp.count; i++) tp.setZ(i, Math.sin(tp.getX(i) * 1.6) * 0.05 - Math.abs(tp.getY(i)) * 0.06); // sags
  tarp.geometry.computeVertexNormals();
  tarp.rotation.x = -Math.PI / 2 + 0.38;
  add(tarp, 0, 2.15, -0.05);
  // a line between the poles, things hung on it
  const lineMat = new THREE.LineBasicMaterial({ color: 0x8a8270 });
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-1.1, 2.0, 0.55), new THREE.Vector3(0, 1.88, 0.58), new THREE.Vector3(1.1, 2.0, 0.55)]), lineMat));
  const coil = add(new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14), mat(0x8a7a5a, 1)), -0.5, 1.75, 0.57);
  coil.rotation.x = 0.2;
  add(new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.12, 10, 1, true), mat(0x2a2826, 0.5, 0.6, { side: THREE.DoubleSide })), 0.45, 1.74, 0.57);
  // the board
  const board = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.75), new THREE.MeshStandardMaterial({ map: priceBoard(), roughness: 1 }));
  board.add(face);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.04, 0.79, 0.03), dark);
  back.position.z = -0.02;
  board.add(back);
  const stake = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.6, 6), dark);
  stake.position.set(0, -0.6, -0.04);
  board.add(stake);
  add(board, -1.9, 1.4, -0.4, 0.5);
  g.traverse((m) => ((m as THREE.Mesh).isMesh && ((m.castShadow = !LOW), (m.receiveShadow = true))));
  world.scene.add(g);
  world.colliders.push({ x: P.x, z: P.z, r: 1.15 });
  const crates = new THREE.Vector3(1.48, 0, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35).add(P);
  world.colliders.push({ x: crates.x, z: crates.z, r: 0.45 });
  return { glass, light };
}

// ------------------------------------------------------------------ the post in play
class TradingPost {
  open = false;
  private built: ReturnType<typeof buildTradingPost> | null = null;
  private pending = "";
  private pendingT = 0;
  private hissT = 2;
  /** Where to stand: in front of the table, on the path side. */
  private spot = new THREE.Vector3();

  build(world: World) {
    if (this.built) return;
    this.built = buildTradingPost(world);
    this.spot.set(0, 0, -1.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.35).add(TRADE);
    $("tr-close").addEventListener("click", () => this.close());
    addEventListener("keydown", (e) => {
      if (!this.open) return;
      if (e.code === "Escape" || e.code === "KeyE") {
        e.preventDefault();
        this.close();
      }
    });
  }

  private threat() {
    return enemies.list.some((e) => e.alive && e.kind !== "thing" && Math.hypot(e.pos.x - TRADE.x, e.pos.z - TRADE.z) < 16);
  }

  interact(): Interact {
    return {
      pos: () => this.spot,
      r: 2.4,
      label: () => `Trade <span class="dim">${save.bank} shards</span>`,
      when: () => state.exited && !cine.active && !this.threat(),
      run: () => this.show(),
    };
  }

  /** Per frame (story): the radio mutters, and the first time you come near, you say so. */
  update(dt: number) {
    if (!this.built) return;
    const d = Math.hypot(player.pos.x - TRADE.x, player.pos.z - TRADE.z);
    this.built.light.intensity = (LOW ? 2.2 : 2.8) * (0.9 + Math.sin(performance.now() * 0.009) * 0.05 + Math.random() * 0.05);
    if (d < 12) {
      this.hissT -= dt;
      if (this.hissT <= 0) {
        this.hissT = 2.5 + Math.random() * 4;
        sfx.staticBurst(0.3 + Math.random() * 0.4, 0.04 * (1 - d / 12) + 0.01);
      }
    }
    if (d < 7 && !save.flags.tradeFound && !voice.busy && state.exited) {
      save.flags.tradeFound = true;
      persist();
      void say(S.TRADE_FIRST);
    }
    if (this.pendingT > 0) {
      this.pendingT -= dt;
      if (this.pendingT <= 0) {
        this.pending = "";
        if (this.open) this.render();
      }
    }
  }

  show() {
    this.open = true;
    state.paused = true;
    document.exitPointerLock?.();
    $("trade").classList.add("show");
    $("tr-msg").textContent = "";
    sfx.rummage();
    this.render();
  }

  close() {
    if (!this.open) return;
    this.open = false;
    this.pending = "";
    $("trade").classList.remove("show");
    input.pressed.delete("KeyE"); // the E that closed it mustn't open it again
    state.paused = false;
    input.lock();
  }

  private render() {
    $("tr-bank").textContent = String(save.bank);
    const list = $("tr-list");
    list.innerHTML = "";
    for (const it of CATALOG) {
      const q = quote(it.id)!;
      const left = inStock(it.id);
      const li = document.createElement("li");
      li.className = "tr-item" + (q.ok ? "" : " off");
      li.innerHTML = `
        <div class="tr-info"><b>${it.name}</b><span>${it.desc}</span>
          <em>You have ${it.owned()} · ${left > 0 ? `${left} on the table` : "none left"}</em></div>
        <div class="tr-price">${q.price}<small>shards</small></div>`;
      const btn = document.createElement("button");
      const confirming = this.pending === it.id;
      btn.className = "btn" + (confirming ? " primary" : "");
      btn.textContent = confirming ? "Confirm" : "Buy";
      btn.disabled = !q.ok;
      btn.title = q.reason ?? "";
      btn.onclick = () => this.press(it.id);
      li.appendChild(btn);
      list.appendChild(li);
    }
  }

  /** BUY → CONFIRM → done. */
  private async press(id: string) {
    const q = quote(id);
    if (!q) return;
    if (!q.ok) {
      $("tr-msg").textContent = q.reason ?? "";
      return;
    }
    if (this.pending !== id) {
      this.pending = id;
      this.pendingT = 3.5;
      $("tr-msg").textContent = `${q.item.name} for ${q.price} shards. Press again to confirm.`;
      this.render();
      return;
    }
    this.pending = "";
    const r = await purchase(id);
    if (r.ok) {
      sfx.coin();
      window.setTimeout(() => sfx.pickup(), 120);
      $("tr-msg").textContent = `You leave ${q.price} shards in the tin and take the ${q.item.name.toLowerCase()}.`;
    } else {
      $("tr-msg").textContent = r.reason ?? "";
    }
    this.render();
  }
}

export const tradingPost = new TradingPost();
