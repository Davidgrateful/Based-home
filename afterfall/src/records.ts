// The Meridian subject registry, found open beside the fire pit. Printed rows
// type in; thousands are skipped; the last line is handwritten.

import { $, sfx, TOUCH } from "./ctx";

interface Row {
  id: string;
  intake: string;
  status: string;
  note?: string;
}

// Statuses line up with the Echoes and the first Hollow's wristband.
const ROWS: Row[] = [
  { id: "0001", intake: "—", status: "NOT RECOVERED", note: "First transit. Do not engage." },
  { id: "0007", intake: "09 APR", status: "TERMINATED" },
  { id: "0017", intake: "21 APR", status: "TERMINATED" },
  { id: "0412", intake: "02 SEP", status: "TERMINATED" },
  { id: "1123", intake: "17 JAN", status: "MISSING" },
  { id: "2291", intake: "30 JUN", status: "TERMINATED" },
  { id: "3344", intake: "11 NOV", status: "TRANSFERRED" },
  { id: "4382", intake: "05 MAR", status: "MISSING" },
  { id: "5063", intake: "19 AUG", status: "TERMINATED" },
  { id: "6071", intake: "28 FEB", status: "UNKNOWN" },
  { id: "7291", intake: "14 OCT", status: "TRANSFERRED" },
];
const TAIL: Row[] = [
  { id: "9843", intake: "22 FEB", status: "UNKNOWN" },
  { id: "9999", intake: "27 FEB", status: "TERMINATED" },
  { id: "10000", intake: "02 MAR", status: "TERMINATED", note: "Final transit. Programme closed." },
];

const tr = (r: Row, cls = "") =>
  `<div class="rec-row ${cls}"><span>${r.id}</span><span>${r.intake}</span><span class="st-${r.status.split(" ")[0].toLowerCase()}">${r.status}</span><span class="rec-note">${r.note ?? ""}</span></div>`;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Keep the newest line in view on short screens. */
function add(body: HTMLElement, html: string) {
  body.insertAdjacentHTML("beforeend", html);
  const sheet = body.parentElement!;
  sheet.scrollTop = sheet.scrollHeight;
}

/** Show the registry. Resolves when the player closes it. */
export async function showRecords(): Promise<void> {
  const el = $("records");
  const body = $("rec-body");
  const hint = $("rec-hint");
  body.innerHTML = "";
  hint.textContent = "";
  el.classList.add("show");
  let fast = false;
  const speedUp = () => (fast = true);
  el.addEventListener("pointerdown", speedUp);
  addEventListener("keydown", speedUp);
  const step = async (ms: number) => {
    if (!fast) await sleep(ms);
  };
  await step(500);
  for (const r of ROWS) {
    add(body, tr(r));
    sfx.monitor();
    await step(160);
  }
  add(body, `<div class="rec-gap">· · ·  2,551 further entries  · · ·</div>`);
  await step(900);
  for (const r of TAIL) {
    add(body, tr(r));
    sfx.monitor();
    await step(260);
  }
  await step(1400);
  // Not printed. Written in by hand, below the line where the programme closed.
  add(
    body,
    `<div class="rec-row rec-hand"><span>10001</span><span>11 MAR</span><span class="st-active">ACTIVE</span><span class="rec-note">Flight 14 MAR.</span></div>`,
  );
  sfx.sting();
  el.removeEventListener("pointerdown", speedUp);
  removeEventListener("keydown", speedUp);
  await sleep(1200);
  hint.textContent = TOUCH ? "Tap to close" : "Press E to close";
  body.parentElement!.scrollTop = 1e6;
  await new Promise<void>((done) => {
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent && !["KeyE", "Space", "Escape", "Enter"].includes(e.code)) return;
      removeEventListener("keydown", close);
      el.removeEventListener("pointerdown", close);
      done();
    };
    addEventListener("keydown", close);
    el.addEventListener("pointerdown", close);
  });
  el.classList.remove("show");
  await sleep(300);
}
