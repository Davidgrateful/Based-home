// Collect every spoken line in the game for the voice recording pass.
// Writes tools/voice/lines.json: one entry per (speaker, radio, text) with the
// text to *speak* (player-name lines get a spoken variant; see AUDIO below)
// and the pack it ships in (packs load on demand, per part of the game).
//
//   node tools/voice/extract.mjs        (needs `typescript` resolvable, or TS=path)
import fs from "fs";
import path from "path";
import { createRequire } from "module";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const require = createRequire(import.meta.url);
const ts = require(process.env.TS || "typescript");

const src = fs.readFileSync(path.join(ROOT, "src/script.ts"), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const S = await import("data:text/javascript;base64," + Buffer.from(js).toString("base64"));

// Speakers who are on the radio unless a line says otherwise (voice.ts).
const RADIO = { RHEA: true, PILOT: true };
const SPEAKERS = ["RHEA", "YOU", "PILOT", "DEZ", "HOLLOW", "WARDEN", "CHOIR", "ECHO", "INES", "TEO"];

// Which download each part of the script lives in.
const PACK = (name) =>
  /^(COLD_OPEN|WAKE|TAKE_AXE|REVEAL|FIRST_SHARD|BLACK_BOX|SIGN_|FIRE_FOUND|FIRE_LIT|RECORDS_READ|FIRST_HOLLOW)/.test(name) ? "intro"
  : /^(AMBUSH|PYLON|WARDEN_|EPILOGUE)/.test(name) ? "story"
  : /^(INES|CHANGED|SETTLEMENT|WRISTBAND|FIRE_TALK|CHOICE|BASIN|CHOIR_|ENDING)/.test(name) ? "late"
  : /^(NIGHT|LOOP|DAWN|FIRE_LOW|MEM_)/.test(name) ? "night"
  : /^(ECHO)/.test(name) ? "echo"
  : "common";

// Recorded audio can't say a name the player typed. Rhea has a nickname for
// her patient ("sleeper"); everyone else's lines get a spoken variant. The
// subtitle still shows the player's name.
const AUDIO = {
  "{name}. That's what your wristband says. Hi, {name}. I'm Rhea. I've been talking to you for six hours and you never once talked back.":
    "That's what your wristband says. Hi. I'm Rhea. I've been talking to you for six hours and you never once talked back.",
  "{name}. Not ten thousand and one. Just {name}.": "My name. Not ten thousand and one. Just my name.",
  "{name}. You came with a name. You are the first who did.": "You came with a name. You are the first who did.",
  "{name}. Again.": "You. Again.",
  "Ten thousand and one. {name}. If you're hearing this, it's already happened. I've done this before. Many times.":
    "Ten thousand and one. If you're hearing this, it's already happened. I've done this before. Many times.",
};
const spoken = (id, text) => {
  if (AUDIO[text]) return AUDIO[text];
  if (!text.includes("{name}")) return text;
  return text
    .replace(/^\{name\}/, "Sleeper")
    .replace(/([.!?]\s+)\{name\}/g, "$1Sleeper")
    .replace(/\{name\}/g, "sleeper");
};

const out = new Map();
const add = (id, text, o = {}, pack, from) => {
  if (!SPEAKERS.includes(id) || !text.trim()) return;
  const radio = o.radio ?? !!RADIO[id];
  const key = `${id}|${radio ? 1 : 0}|${text}`;
  if (out.has(key)) return;
  out.set(key, { key, id, radio, text, say: spoken(id, text), name: o.name ?? "", pitch: o.pitch ?? null, rate: o.rate ?? null, pack, from });
};
const isLine = (v) => Array.isArray(v) && typeof v[0] === "string" && SPEAKERS.includes(v[0]) && typeof v[1] === "string";
const walk = (v, name) => {
  if (isLine(v)) return add(v[0], v[1], v[2] ?? {}, PACK(name), name);
  if (Array.isArray(v)) return v.forEach((x) => walk(x, name));
  if (v && typeof v === "object") for (const x of Object.values(v)) walk(x, name);
};
for (const [name, v] of Object.entries(S)) {
  if (name === "HOLLOW_BARKS") v.forEach((t) => add("HOLLOW", t, {}, "common", name));
  else walk(v, name);
}

// Lines written inline outside script.ts.
for (const f of fs.readdirSync(path.join(ROOT, "src"))) {
  if (!f.endsWith(".ts") || f === "script.ts") continue;
  const code = fs.readFileSync(path.join(ROOT, "src", f), "utf8");
  for (const m of code.matchAll(/\["(RHEA|YOU|PILOT|DEZ|HOLLOW|WARDEN|CHOIR|ECHO|INES|TEO)",\s*"((?:[^"\\]|\\.)*)"/g)) add(m[1], m[2], {}, "night", f);
  // Rhea's storm warnings come from a pick() list
  for (const m of code.matchAll(/\["RHEA", pick\(\[([^\]]*)\]\)\]/g))
    for (const t of m[1].matchAll(/"((?:[^"\\]|\\.)*)"/g)) add("RHEA", t[1], {}, "night", f);
}
// memory.ts: the remembered direction, one line per bearing
for (const where of ["the wreck", "the Blackwood", "the mast", "the field station", "the stone circle"])
  add("YOU", `They came from ${where} last time. They'll come from ${where} again.`, {}, "night", "memory.ts");

const lines = [...out.values()];
fs.writeFileSync(path.join(ROOT, "tools/voice/lines.json"), JSON.stringify(lines, null, 1));
const by = {};
for (const l of lines) by[l.pack] = (by[l.pack] ?? 0) + 1;
console.log(lines.length, "lines", by);
