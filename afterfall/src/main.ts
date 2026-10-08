// AFTERFALL — bootstrap: menus, mode switching, combat feel, render loop.

import "./style.css";
import * as THREE from "three";
import { coopSwing, coopUpdate, inviteLink, joinRoom, renderVoiceHud } from "./coop";
import { goFullscreen, initTouch } from "./touch";
import { voiceChat } from "./voicechat";
import { castLine } from "./cinesets";
import { applySaved, creator, menuCamera, menuLightOff, openCreator } from "./creator";
import {
  $,
  applyMemories,
  bounds,
  camera,
  cine,
  enemies,
  farlands,
  fx,
  hud,
  hurtFlash,
  input,
  player,
  post,
  say,
  TOUCH,
  sfx,
  state,
  toast,
  token,
  voice,
  world,
} from "./ctx";
import { echoProgress } from "./echo";
import { night, nightDebug, nightOnDeath, nightTarget, nightUpdate, renderShop, startLongNight } from "./night";
import { playerName, resetSave, save } from "./save";
import { CHAPTER_NAMES, resumeStory, story, storyOnDeath, storyOnSummon, storySkip, storyTarget, storyUpdate, startStory } from "./story";
import { net, randomRoom } from "./net";
import { LINKS } from "./token";
import { initMap, mapUpdate } from "./map";
import { regionsUpdate } from "./regions";
import * as S from "./script";
import { historyUpdate, renderDesignation } from "./history";
import { faunaUpdate } from "./fauna";
import { setMemoryCamera } from "./memory";
import { Person, peopleReady, track, updatePeople } from "./people";
import { PlaneSet } from "./cinesets";

// ------------------------------------------------------------------ hooks
voice.onLine = (id, radio) => {
  if (radio) sfx.beep();
  castLine(id);
  farlands.onLine(id);
};
player.onSwing = () => sfx.swing();
player.onDash = () => sfx.dash();
player.onHurt = () => {
  sfx.hurt();
  hurtFlash();
};
const reach = TOUCH ? 0.4 : 0; // thumbs are less precise than a mouse
player.onSwingHit = (facing, dmg, heavy) =>
  net.isClient ? coopSwing(facing, dmg, heavy) : enemies.hit(player.pos, facing, (heavy ? 3.2 : 2.7) + reach, heavy ? 1.5 : 1.2, dmg, heavy);
// touch: swings turn toward the nearest Hollow within reach
player.aimAssist = (from) => {
  let best = null as number | null;
  let bd = 4.5;
  for (const e of enemies.list) {
    if (!e.alive || e.state === "spawn") continue;
    const d = Math.hypot(e.pos.x - from.x, e.pos.z - from.z);
    if (d < bd) {
      bd = d;
      best = Math.atan2(e.pos.x - from.x, e.pos.z - from.z);
    }
  }
  return best;
};
enemies.onHit = (e, _dmg, heavy) => {
  const at = e.pos.clone().add(new THREE.Vector3(0, 1.4 * e.scale, 0));
  fx.sparks(at, heavy ? 18 : 9, heavy ? 7 : 5);
  sfx.hit(heavy);
  if (!state.remoteSwing) state.hitStop = heavy ? 0.08 : 0.045;
};
enemies.onSlam = (e) => {
  sfx.slam();
  player.shake = 0.5;
  fx.sparks(e.pos.clone().add(new THREE.Vector3(0, 0.3, 0)), 30, 10);
};
enemies.onSummon = () => {
  if (state.mode === "story") storyOnSummon();
};
enemies.onDeath = (e) => {
  sfx.kill();
  fx.sparks(e.pos.clone().add(new THREE.Vector3(0, 1, 0)), 20, 6);
  storyOnDeath(e);
  nightOnDeath(e);
};

// ------------------------------------------------------------------ main menu
function renderMenu() {
  const ch = typeof save.flags.chapter === "string" && !save.storyDone ? save.flags.chapter : "";
  $("btn-continue").hidden = !CHAPTER_NAMES[ch];
  $("continue-sub").textContent = CHAPTER_NAMES[ch] ?? "";
  queueMicrotask(menuDesc);
  $("stat-best").textContent = save.bestNight ? `Night ${save.bestNight}` : "None";
  $("stat-loops").textContent = String(save.loops);
  $("stat-echoes").textContent = echoProgress();
  $("stat-bank").textContent = String(save.bank);
  $("echo-count").textContent = echoProgress();
  $("night-sub").textContent = save.bestNight
    ? `Best: night ${save.bestNight}. ${save.loops} loop${save.loops === 1 ? "" : "s"} so far.`
    : save.storyDone
      ? "Survive until dawn. Then do it again."
      : "Survive until dawn. Best played after Chapter One.";
}

// one quiet line under the menu: whatever's under the cursor or focus
const menuDesc = () => {
  const first = [...document.querySelectorAll<HTMLElement>("#title .mi")].find((b) => !b.hidden);
  $("menu-desc").textContent = first?.querySelector(".mi-d")?.textContent ?? "";
};
for (const b of document.querySelectorAll<HTMLElement>("#title .mi")) {
  const show = () => ($("menu-desc").textContent = b.querySelector(".mi-d")?.textContent ?? "");
  b.addEventListener("pointerenter", show);
  b.addEventListener("focus", show);
  b.addEventListener("pointerleave", menuDesc);
}

function showScreen(id: "title" | "wallet" | "coop") {
  $("title").classList.toggle("hidden", id !== "title");
  $("wallet").classList.toggle("show", id === "wallet");
  $("coop").classList.toggle("show", id === "coop");
}

function leaveMenu() {
  sfx.init();
  voice.unlock();
  goFullscreen();
  $("title").classList.add("hidden");
  $("wallet").classList.remove("show");
  $("coop").classList.remove("show");
  menuLightOff();
  input.lock();
}

/** First time through, make a survivor before playing. */
function withSurvivor(then: () => void) {
  sfx.init();
  voice.unlock();
  if (save.look) then();
  else openCreator(then);
}

$("btn-continue").addEventListener("click", () =>
  withSurvivor(() => {
    leaveMenu();
    resumeStory(save.flags.chapter as Parameters<typeof resumeStory>[0]);
  }),
);
$("btn-story").addEventListener("click", () =>
  withSurvivor(() => {
    leaveMenu();
    startStory();
  }),
);
$("btn-night").addEventListener("click", () =>
  withSurvivor(() => {
    leaveMenu();
    hud.blackout.style.transition = "none";
    hud.blackout.style.opacity = "1";
    startLongNight(false);
  }),
);
$("btn-character").addEventListener("click", () => {
  sfx.init();
  openCreator();
});
$("btn-wallet").addEventListener("click", () => showScreen("wallet"));

// ------------------------------------------------------------------ co-op lobby
const coopCode = $<HTMLInputElement>("coop-code");
coopCode.addEventListener("keydown", (e) => e.stopPropagation());
$("btn-coop").addEventListener("click", () => {
  sfx.init();
  showScreen("coop");
});
async function enterRoom(code: string) {
  const status = $("coop-status");
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  if (!clean) {
    status.textContent = "Type a room code, or create a room.";
    return;
  }
  status.textContent = `Connecting to ${clean}…`;
  if (voiceChat.mode !== "off") voiceChat.enableMic(); // ask while we still have the click
  try {
    await joinRoom(clean);
  } catch (e) {
    status.textContent = (e as Error).message;
    return;
  }
  history.replaceState(null, "", `?room=${net.room}`);
  $("btn-voice-mode").hidden = false;
  $("btn-voice-mute").hidden = false;
  renderVoiceHud();
  status.textContent = "";
  leaveMenu();
  hud.blackout.style.transition = "none";
  hud.blackout.style.opacity = "1";
  startLongNight(false);
  toast(net.isHost ? `Room ${net.room} is open. Share the invite link from the pause menu.` : `Joined room ${net.room}`, 4500);
}
$("btn-coop-join").addEventListener("click", () => withSurvivor(() => enterRoom(coopCode.value)));
$("btn-coop-create").addEventListener("click", () => withSurvivor(() => enterRoom(randomRoom())));
$("btn-voice-mode").addEventListener("click", () => voiceChat.cycleMode());
$("btn-voice-mute").addEventListener("click", () => voiceChat.setOthersMuted(!voiceChat.othersMuted));
$("btn-invite").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(inviteLink());
    toast("Invite link copied");
  } catch {
    toast(inviteLink(), 6000);
  }
});
{
  const room = new URLSearchParams(location.search).get("room");
  if (room) {
    coopCode.value = room.toUpperCase();
    showScreen("coop");
    $("coop-status").textContent = "You've been invited. Join when you're ready.";
  }
}
for (const b of document.querySelectorAll<HTMLElement>("[data-back]")) b.addEventListener("click", () => showScreen("title"));
$("btn-mute").addEventListener("click", () => {
  voice.muted = !voice.muted;
  sfx.setMuted(voice.muted);
  $("mute-sub").textContent = voice.muted ? "Off" : "On";
});
$("btn-reset").addEventListener("click", () => {
  if (confirm("Erase your survivor and all AFTERFALL progress on this browser?")) {
    resetSave();
    applySaved();
    renderDesignation();
    renderMenu();
  }
});
$("pause").addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("button")) return;
  if (TOUCH) resume();
  else input.lock();
});
function resume() {
  state.paused = false;
  $("pause").classList.remove("show");
}
initMap();
setMemoryCamera(camera);
initTouch(() => {
  state.paused = true;
  $("pause").classList.add("show");
});
document.addEventListener("pointerlockchange", () => {
  const overlay = $("shop").classList.contains("show") || $("end").classList.contains("show");
  const playing = state.mode !== "title" && !cine.active && !overlay;
  state.paused = !input.locked && playing;
  $("pause").classList.toggle("show", state.paused);
});
$("btn-nolock").addEventListener("click", () => {
  state.paused = false;
  $("pause").classList.remove("show");
});
$("btn-title").addEventListener("click", () => location.reload());

// ------------------------------------------------------------------ wallet
function renderToken() {
  const info = token.info;
  const sym = info ? `$${info.symbol}` : "";
  for (const el of document.querySelectorAll<HTMLElement>("[data-token-sym]")) el.textContent = sym;
  const status = $("token-status");
  const trade = $<HTMLAnchorElement>("btn-trade");
  const launch = $<HTMLAnchorElement>("btn-launch");
  const chip = $("wallet-chip");
  trade.hidden = !token.tokenAddress;
  launch.hidden = !!token.tokenAddress;
  if (token.tokenAddress) trade.href = LINKS.token(token.tokenAddress);
  const short = token.account ? `${token.account.slice(0, 6)}…${token.account.slice(-4)}` : "";
  if (!token.tokenAddress) {
    status.innerHTML = `No game token is set yet. Launch one on vibe/vibe, then set <code>VITE_TOKEN_ADDRESS</code> or open the game with <code>?token=0x…</code>.`;
    $("wallet-sub").textContent = "Token not launched yet";
  } else if (!token.account) {
    status.textContent = `Holders of ${sym || "the token"} on Robinhood Chain Testnet start every run Rift-bound.`;
    $("wallet-sub").textContent = "Not connected";
  } else {
    status.innerHTML = token.holder
      ? `<span class="ok">${short}</span> holds ${token.balanceText} ${sym}. You are Rift-bound.`
      : `<span class="warn">${short}</span> holds no ${sym}. Pick some up on vibe/vibe to unlock the Rift axe.`;
    $("wallet-sub").textContent = token.holder ? `${short}. Rift-bound` : `${short}. No ${sym}`;
  }
  $("btn-connect").textContent = token.account ? "Refresh balance" : "Connect wallet";
  chip.hidden = !token.account;
  chip.textContent = token.account ? `${short} · ${token.balanceText} ${sym}` : "";
  player.setRiftBound(token.holder);
  hud.perk.hidden = !token.holder;
}
token.onChange = renderToken;
$("btn-launch").setAttribute("href", LINKS.create);
$("btn-faucet").setAttribute("href", LINKS.faucet);
$("btn-connect").addEventListener("click", async () => {
  const err = token.account ? (await token.refresh(), null) : await token.connect();
  if (err) toast(err, 4000);
  else if (token.holder) toast("Rift-bound. Your axe hums with rift energy.");
});

async function signRun(out: HTMLElement) {
  try {
    if (!token.account) {
      const err = await token.connect();
      if (err) throw new Error(err);
    }
    const sig = await token.signRun({
      name: playerName(),
      shards: state.runShards,
      kills: enemies.kills,
      seconds: Math.round(state.elapsed - state.runStart),
      night: save.bestNight,
      echoes: save.echoes.length,
    });
    out.textContent = `Signed ${sig.slice(0, 18)}…${sig.slice(-8)} (copied)`;
    navigator.clipboard?.writeText(sig).catch(() => {});
  } catch (e) {
    out.textContent = (e as Error).message.split("\n")[0];
  }
}
$("btn-sign").addEventListener("click", () => signRun($("sign-out")));
$("shop-sign").addEventListener("click", () => signRun($("shop-sign-out")));
$("btn-again").addEventListener("click", () => location.reload());
$("btn-end-night").addEventListener("click", () => {
  $("end").classList.remove("show");
  hud.blackout.style.transition = "none";
  hud.blackout.style.opacity = "1";
  input.lock();
  startLongNight(false);
});

story.onComplete = () => {
  document.exitPointerLock?.();
  hud.root.classList.remove("show");
  const secs = Math.round(state.elapsed - state.runStart);
  $("end-name").textContent = save.name ? `${playerName()}'s` : "your";
  $("end-shards").textContent = String(state.runShards);
  $("end-kills").textContent = String(enemies.kills);
  $("end-time").textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  $("end-echoes").textContent = echoProgress();
  $("end").classList.add("show");
};

// ------------------------------------------------------------------ objective marker
const v = new THREE.Vector3();
// The story doesn't hang a diamond on every objective: you find your way by
// the world. The marker shows only close up (to pin the exact thing), or once
// you've gone a while without getting any nearer; then Rhea gives directions
// by what you can see, once per objective.
let navTarget: THREE.Vector3 | null = null;
let navBest = Infinity;
let navSince = 0;
const navSaid = new Set<string>();
function updateMarker() {
  const t = state.mode === "story" ? storyTarget() : state.mode === "night" ? nightTarget() : null;
  if (!t || cine.active) {
    hud.marker.style.display = "none";
    return;
  }
  const dist = Math.hypot(t.x - player.pos.x, t.z - player.pos.z);
  if (state.mode === "story") {
    if (t !== navTarget) {
      navTarget = t;
      navBest = dist;
      navSince = state.elapsed;
    }
    if (dist < navBest - 3) {
      navBest = dist;
      navSince = state.elapsed; // getting closer: not lost
    }
    const lost = state.elapsed - navSince > 40;
    const nav = S.NAV[story.stage];
    if (lost && nav && !navSaid.has(story.stage) && !voice.busy) {
      navSaid.add(story.stage);
      void say(nav);
    }
    if (dist > 30 && !lost) {
      hud.marker.style.display = "none";
      return;
    }
  }
  hud.marker.style.display = "block";
  v.set(t.x, t.y + 3, t.z).project(camera);
  const behind = v.z > 1;
  let x = v.x;
  let y = v.y;
  if (behind) {
    x = -x;
    y = -y;
  }
  const m = 0.88;
  if (behind || Math.abs(x) > m || Math.abs(y) > m) {
    const s = m / Math.max(Math.abs(x), Math.abs(y), 1e-3);
    x *= s;
    y *= s;
  }
  hud.marker.style.left = `${((x + 1) / 2) * innerWidth}px`;
  hud.marker.style.top = `${((1 - y) / 2) * innerHeight}px`;
  hud.markerDist.textContent = `${Math.round(Math.hypot(t.x - player.pos.x, t.z - player.pos.z))} m`;
}

// ------------------------------------------------------------------ main loop
const timer = new THREE.Timer();
let healCd = 0;
let wasDead = false;

function tick(now?: number) {
  requestAnimationFrame(tick);
  timer.update(now);
  let dt = Math.min(timer.getDelta(), 1 / 20);
  if (state.hitStop > 0) {
    state.hitStop -= dt;
    dt *= 0.06;
  }
  dt *= state.slowMo;
  const t = timer.getElapsed();
  const running = !state.paused && !state.dead && state.mode !== "title" && !cine.active;
  // in co-op the world keeps going while you're paused or down
  const simulate = state.mode !== "title" && !cine.active && (running || (net.active && state.mode === "night"));
  if (running) state.elapsed += dt;

  if (state.mode === "title" && !cine.active) {
    menuCamera(dt, t);
  } else if (cine.active) {
    cine.update(dt, camera);
    player.invuln = Math.max(player.invuln, 0.3);
    enemies.update(dt, t, player, camera);
  } else if (!state.paused || simulate) {
    if (state.dead !== wasDead && player.model instanceof Person) {
      if (state.dead) void player.model.play("die", 1, true);
      else player.model.clear();
    }
    wasDead = state.dead;
    player.danger = enemies.list.some((e) => e.alive && e.kind !== "thing" && e.pos.distanceTo(player.pos) < 14);
    if (!state.dead && !state.paused) player.update(dt, input, bounds, camera);
    else if (state.dead) camera.position.y += (player.pos.y + 0.6 - camera.position.y) * dt;
    if (running) {
      healCd -= dt;
      if (input.tap("KeyQ") && healCd <= 0) {
        if (player.heal()) {
          sfx.heal();
          toast("Medkit used");
        }
        healCd = 0.6;
      }
    }
    if (simulate) {
      if (state.mode === "story") storyUpdate(dt);
      else if (state.mode === "night") nightUpdate(dt);
      if (state.exited) faunaUpdate(dt);
    }
    enemies.update(simulate ? dt : 0, t, player, camera);
  }
  coopUpdate(dt, camera);
  world.update(dt, t, player.pos, camera);
  updatePeople(dt);
  farlands.update(dt, t, player);
  fx.update(dt, camera);
  if (state.mode !== "title") {
    mapUpdate(dt, running && state.exited !== false);
    if (running && state.exited) {
      regionsUpdate(dt, player.pos.x, player.pos.z);
      historyUpdate(dt);
    }
  }
  // the fire is the one warm sound out here
  if (world.campfire.lit && state.mode !== "title") {
    const d = world.campfire.group.position.distanceTo(player.pos);
    if (d < 14 && Math.random() < dt * 7 * (1 - d / 14)) sfx.crackle(0.05 + 0.2 * (1 - d / 14));
  }

  hud.hp.style.width = `${(player.hp / player.maxHp) * 100}%`;
  hud.st.style.width = `${player.stamina}%`;
  hud.med.textContent = String(player.medkits);
  hud.shards.textContent = String(state.runShards);
  hud.root.classList.toggle("low", player.hp < player.maxHp * 0.3);
  updateMarker();

  post.render();
  input.endFrame();
}

applySaved();
renderDesignation();
applyMemories();
world.setCampfire(true);
renderMenu();
renderToken();
renderShop();
token.loadInfo();
tick();

// debug / testing hook
(window as unknown as Record<string, unknown>).__afterfall = {
  get stage() {
    return state.mode === "night" ? `night:${night.n}:${night.phase}` : story.stage;
  },
  state,
  player,
  enemies,
  world,
  save,
  cine,
  night,
  creator,
  openCreator,
  story: (to?: Parameters<typeof storySkip>[0]) => {
    leaveMenu();
    state.mode = "story";
    if (to) storySkip(to);
    else startStory();
  },
  longNight: () => {
    leaveMenu();
    startLongNight(false);
  },
  nightDebug,
  farlands,
  people: { Person, track, ready: peopleReady },
  PlaneSet,
  scene: world.scene,
  camera,
  spawn: (kind: Parameters<typeof enemies.spawn>[0], x: number, z: number) => enemies.spawn(kind, new THREE.Vector3(x, 0, z), { rise: false }),
  say,
  net,
  enterRoom,
  voiceChat,
  regions: { regionsUpdate, historyUpdate },
};
