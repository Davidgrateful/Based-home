// Phone and tablet controls. Left thumb: a floating stick (push to the edge
// to sprint). Right thumb: drag anywhere to look, buttons for the actions.
// No pointer lock on touch; a Pause button stands in for Esc.

import { $, cine, input, sfx, state, TOUCH, voice } from "./ctx";
import { net } from "./net";
import { voiceChat } from "./voicechat";

const R = 56; // stick radius in px

function el<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, string> = {}, text = "") {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (text) e.textContent = text;
  return e;
}

export function initTouch(onPause: () => void) {
  if (!TOUCH) return;

  const root = el("div", { id: "touch" });
  const stickZone = el("div", { id: "t-stick-zone" });
  const lookZone = el("div", { id: "t-look-zone" });
  const stick = el("div", { id: "t-stick" });
  const knob = el("div", { id: "t-knob" });
  stick.appendChild(knob);
  const btns = el("div", { id: "t-btns" });
  const mk = (act: string, label: string) => {
    const b = el("button", { "data-act": act, "aria-label": label }, label);
    btns.appendChild(b);
    return b;
  };
  const attack = mk("attack", "Swing");
  mk("dodge", "Dodge");
  mk("jump", "Jump");
  const use = mk("use", "Use");
  mk("heal", "Heal");
  const talk = mk("talk", "Talk");
  const pause = el("button", { id: "t-pause", "aria-label": "Pause" }, "Pause");
  root.append(stickZone, lookZone, stick, btns, pause);
  document.body.appendChild(root);
  document.body.appendChild(el("div", { id: "rotate" }, "Turn your phone sideways to play"));
  void attack;

  // ---- stick
  let stickId = -1;
  let ox = 0;
  let oy = 0;
  stickZone.addEventListener("pointerdown", (e) => {
    if (stickId !== -1) return;
    stickId = e.pointerId;
    ox = e.clientX;
    oy = e.clientY;
    stick.style.left = `${ox}px`;
    stick.style.top = `${oy}px`;
    stick.classList.add("on");
    stickZone.setPointerCapture(e.pointerId);
  });
  stickZone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== stickId) return;
    let dx = (e.clientX - ox) / R;
    let dy = (e.clientY - oy) / R;
    const m = Math.hypot(dx, dy);
    if (m > 1) {
      dx /= m;
      dy /= m;
    }
    const dead = m < 0.12;
    input.moveX = dead ? 0 : dx;
    input.moveY = dead ? 0 : -dy;
    knob.style.transform = `translate(${dx * R}px, ${dy * R}px)`;
  });
  const stickUp = (e: PointerEvent) => {
    if (e.pointerId !== stickId) return;
    stickId = -1;
    input.moveX = input.moveY = 0;
    knob.style.transform = "";
    stick.classList.remove("on");
  };
  stickZone.addEventListener("pointerup", stickUp);
  stickZone.addEventListener("pointercancel", stickUp);

  // ---- look
  let lookId = -1;
  let lx = 0;
  let ly = 0;
  lookZone.addEventListener("pointerdown", (e) => {
    if (lookId !== -1) return;
    lookId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
    lookZone.setPointerCapture(e.pointerId);
  });
  lookZone.addEventListener("pointermove", (e) => {
    if (e.pointerId !== lookId) return;
    input.mdx += (e.clientX - lx) * 1.7;
    input.mdy += (e.clientY - ly) * 1.3;
    lx = e.clientX;
    ly = e.clientY;
  });
  const lookUp = (e: PointerEvent) => {
    if (e.pointerId === lookId) lookId = -1;
  };
  lookZone.addEventListener("pointerup", lookUp);
  lookZone.addEventListener("pointercancel", lookUp);

  // ---- buttons
  btns.addEventListener("pointerdown", (e) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    e.preventDefault();
    b.classList.add("down");
    switch (b.dataset.act) {
      case "attack":
        input.attack = true;
        break;
      case "dodge":
        input.dash = true;
        break;
      case "jump":
        input.pressed.add("Space");
        break;
      case "use":
        input.pressed.add("KeyE");
        break;
      case "heal":
        input.pressed.add("KeyQ");
        break;
      case "talk":
        voiceChat.setPtt(true);
        break;
    }
  });
  const release = (e: PointerEvent) => {
    const b = (e.target as HTMLElement).closest("button");
    if (!b) return;
    b.classList.remove("down");
    if (b.dataset.act === "talk") voiceChat.setPtt(false);
  };
  btns.addEventListener("pointerup", release);
  btns.addEventListener("pointercancel", release);
  btns.addEventListener("pointerleave", release);
  pause.addEventListener("click", onPause);

  // iOS only starts audio inside a touch: resume everything on any tap
  addEventListener(
    "pointerdown",
    () => {
      if (sfx.ctx?.state === "suspended") sfx.ctx.resume().catch(() => {});
      voiceChat.resumeAudio();
      voice.unlock();
    },
    { passive: true },
  );

  // per-frame state: show while playing, highlight Use when something's in reach
  const update = () => {
    requestAnimationFrame(update);
    const overlay = ["shop", "end", "pause", "creator"].some((id) => $(id)?.classList.contains("show"));
    const playing = state.mode !== "title" && !cine.active && !overlay && !state.dead;
    document.body.classList.toggle("playing", state.mode !== "title");
    root.classList.toggle("on", playing);
    use.classList.toggle("ready", $("prompt").classList.contains("show"));
    talk.hidden = !net.active || voiceChat.mode === "off";
    talk.classList.toggle("live", voiceChat.transmitting);
  };
  update();
}

/** Go fullscreen and landscape where the browser allows it (Android). */
export function goFullscreen() {
  if (!TOUCH) return;
  const d = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  const p = d.requestFullscreen?.() ?? d.webkitRequestFullscreen?.();
  Promise.resolve(p)
    .then(() => (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.("landscape"))
    .catch(() => {});
}
