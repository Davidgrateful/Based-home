// For hosts that don't serve .glb: bundle public/people/*.glb into one script,
// base64, that the game falls back to (src/people.ts). Usage:
//   node tools/people/pack.mjs <dir with the .glb files> > pack.js
import fs from "fs";
import path from "path";
const dir = process.argv[2];
const out = {};
for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".glb")).sort()) out[f] = fs.readFileSync(path.join(dir, f)).toString("base64");
process.stdout.write(`window.__peoplePack=${JSON.stringify(out)};\n`);
