// Scanned rocks, stumps, logs and ferns for the forest floor, from Poly Haven
// (CC0, https://polyhaven.com), simplified for a browser game.
//
//   SRC=<dir with one folder per asset, each holding <name>_1k.gltf + textures/>
//   GT=/path/to/node_modules  (@gltf-transform/{core,functions,extensions}, meshoptimizer, sharp)
//   node tools/world/build.mjs
//
// Writes public/world/<name>.glb: geometry simplified, textures 512px webp.
import path from "path";
import fs from "fs";
import { createRequire } from "module";

const req = createRequire(path.join(process.env.GT, "x.js"));
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS } = req("@gltf-transform/extensions");
const { prune, dedup, textureCompress, meshopt, weld, simplify, unpartition, flatten, join } = req("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder, MeshoptSimplifier } = req("meshoptimizer");
const sharp = req("sharp");

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(ROOT, "public/world");
await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
await MeshoptSimplifier.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

// name: fraction of triangles to keep (cards like ferns can't lose much)
const ASSETS = {
  rock_07: 0.06,
  rock_09: 0.07,
  rock_moss_set_01: 0.12,
  tree_stump_01: 0.1,
  dead_tree_trunk: 0.05,
  fern_02: 0.7,
};
for (const [name, ratio] of Object.entries(ASSETS)) {
  const doc = await io.read(path.join(process.env.SRC, name, `${name}_1k.gltf`));
  const before = count(doc);
  await doc.transform(
    unpartition(),
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.004 }),
    prune(),
    dedup(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [512, 512], quality: 78 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  const file = path.join(OUT, `${name.replace(/_/g, "-")}.glb`);
  await io.write(file, doc);
  console.log(name, before, "->", count(doc), "tris", (fs.statSync(file).size / 1024).toFixed(0), "KB");
}

function count(doc) {
  let t = 0;
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) t += (p.getIndices()?.getCount() ?? p.getAttribute("POSITION").getCount()) / 3;
  return Math.round(t);
}
