// Echoes: ghostly recordings of subjects who fell before you.

import { $, persist, say, sfx, voice, wait, world } from "./ctx";
import { buildHumanoid } from "./models";
import { save } from "./save";
import { ECHO_FIRST_FIND, ECHO_FRAGMENTS, ECHOES } from "./script";
import type { Ghost } from "./world";

export function spawnEcho(id: number, x: number, z: number) {
  const h = buildHumanoid({ cloth: 0xffffff, skin: 0xffffff, pants: 0xffffff, hair: 0xffffff });
  return world.spawnGhost(id, x, z, h.root);
}

export function echoProgress() {
  return `${save.echoes.length}/${ECHOES.length}`;
}

/** Ids that can still appear. #12 (your own voice) waits for the other eleven. */
export function unfoundEchoes() {
  return ECHOES.map((e) => e.id).filter((id) => !save.echoes.includes(id) && (id !== 11 || save.echoes.length >= 11));
}

/** An Echo: the picture slips, one sentence surfaces, a voice, then nothing.
 *  Not a cutscene. You keep walking. */
export async function listenEcho(g: Ghost) {
  world.removeGhost(g);
  sfx.ghost();
  const first = save.echoes.length === 0;
  const isNew = !save.echoes.includes(g.echoId);
  if (isNew) {
    save.echoes.push(g.echoId);
    persist();
  }
  const echo = ECHOES[g.echoId];
  $("echo-count").textContent = echoProgress();
  document.body.classList.remove("echoing");
  void document.body.offsetWidth;
  document.body.classList.add("echoing");
  window.setTimeout(() => document.body.classList.remove("echoing"), 1700);
  const frag = $("fragment");
  frag.innerHTML = `${ECHO_FRAGMENTS[g.echoId] ?? ""}<small>Patient ${echo.patient} · ${echoProgress()}</small>`;
  frag.classList.add("show");
  window.setTimeout(() => frag.classList.remove("show"), 4200);
  voice.interrupt();
  await wait(1400);
  if (first) await say(ECHO_FIRST_FIND);
  await say(echo.lines);
}
