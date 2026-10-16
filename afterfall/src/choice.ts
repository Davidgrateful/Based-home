// A two-way decision, on screen. Keys 1/2 (or click/tap). Resolves 0 or 1.

import { $, input, TOUCH } from "./ctx";

export function choose(prompt: string, a: string, b: string): Promise<0 | 1> {
  const el = $("choice");
  $("choice-prompt").textContent = prompt;
  const [ba, bb] = [$("choice-a"), $("choice-b")];
  ba.innerHTML = `<kbd>1</kbd>${a}`;
  bb.innerHTML = `<kbd>2</kbd>${b}`;
  el.classList.add("show");
  if (!TOUCH) document.exitPointerLock?.();
  return new Promise((done) => {
    const finish = (n: 0 | 1) => {
      removeEventListener("keydown", key);
      ba.onclick = bb.onclick = null;
      el.classList.remove("show");
      if (!TOUCH) input.lock();
      done(n);
    };
    const key = (e: KeyboardEvent) => {
      if (e.code === "Digit1") finish(0);
      if (e.code === "Digit2") finish(1);
    };
    addEventListener("keydown", key);
    ba.onclick = () => finish(0);
    bb.onclick = () => finish(1);
  });
}
