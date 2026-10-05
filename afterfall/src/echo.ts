// Echoes: ghostly recordings of the 99 patients who fell before you.

import { $, card, persist, say, sfx, voice, world } from "./ctx";
import { buildHumanoid } from "./models";
import { save } from "./save";
import { ECHO_FIRST_FIND, ECHOES } from "./script";
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
  card("ECHO RECOVERED", `PATIENT ${echo.patient}`, `${echoProgress()} echoes found`, 2600);
  $("echo-count").textContent = echoProgress();
  voice.interrupt();
  if (first) await say(ECHO_FIRST_FIND);
  await say(echo.lines);
}
