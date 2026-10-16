// For hosts that don't serve .glb: bundle a folder's .glb files into one
// script, base64, that the game falls back to (src/assets.ts). Usage:
//   node tools/pack.mjs public/people people/ > people/pack.js
import fs from "fs";
import path from "path";
const [dir, key] = process.argv.slice(2);
const out = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".glb")).sort()) out[f] = fs.readFileSync(path.join(dir, f)).toString("base64");
process.stdout.write(`(window.__packs=window.__packs||{})[${JSON.stringify(key)}]=${JSON.stringify(out)};\n`);
