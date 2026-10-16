// Build the game's people from Quaternius' CC0 "Universal Base Characters" and
// "Universal Animation Library" (https://quaternius.com, public domain).
//
//   SRC_UBC=".../Universal Base Characters[Standard]" \
//   SRC_UAL=".../Universal Animation Library[Standard]" \
//   GT=/path/to/node_modules  (with @gltf-transform/{core,functions,extensions}, meshoptimizer, sharp)
//   node tools/people/build.mjs
//
// Writes public/people/:
//   male.glb, female.glb   body + eyes + brows, skinned; webp textures, meshopt
//   skin-dark-m.webp, skin-dark-f.webp   the darker base colour (light is in the glb)
//   hair.glb               every hairstyle and the beard, skinned to the same rig
//   anims.glb              the clips the game uses, no mesh
import path from "path";
import fs from "fs";
import { createRequire } from "module";

const req = createRequire(path.join(process.env.GT, "x.js"));
const { NodeIO } = req("@gltf-transform/core");
const { ALL_EXTENSIONS, EXTMeshoptCompression } = req("@gltf-transform/extensions");
const { prune, dedup, textureCompress, meshopt, resample, weld, unpartition } = req("@gltf-transform/functions");
const { MeshoptEncoder, MeshoptDecoder } = req("meshoptimizer");
const sharp = req("sharp");

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const OUT = path.join(ROOT, "public/people");
fs.mkdirSync(OUT, { recursive: true });
const UBC = process.env.SRC_UBC;
const UAL = process.env.SRC_UAL;

await MeshoptEncoder.ready;
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });

/** Drop vertex attributes the game never reads (extra UV sets, vertex colours). */
function slim(doc) {
  for (const mesh of doc.getRoot().listMeshes())
    for (const prim of mesh.listPrimitives())
      for (const sem of prim.listSemantics())
        if (/^(TEXCOORD_[1-9]|COLOR_\d)$/.test(sem)) prim.setAttribute(sem, null);
}

async function finish(doc, file, size = 1024) {
  slim(doc);
  await doc.transform(
    unpartition(),
    prune({ keepLeaves: true }),
    dedup(),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [size, size], quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  await io.write(path.join(OUT, file), doc);
  console.log(file, (fs.statSync(path.join(OUT, file)).size / 1e6).toFixed(2), "MB");
}

// ---------------------------------------------------------------- bodies
const BODY = path.join(UBC, "Base Characters/Godot - UE");
const TEX = path.join(UBC, "Base Characters/Textures");
for (const [sex, name, light, dark] of [
  ["m", "Male", "T_Superhero_Male_Ligh.png", "T_Superhero_Male_Dark.png"],
  ["f", "Female", "T_Superhero_Female_Light_BaseColor.png", "T_Superhero_Female_Dark_BaseColor.png"],
]) {
  const doc = await io.read(path.join(BODY, `Superhero_${name}_FullBody.gltf`));
  // the glTF ships the dark skin; swap in the light one (tinted per survivor at runtime)
  for (const t of doc.getRoot().listTextures()) {
    if (/Superhero_.*(Dark|Ligh)/.test(t.getURI())) t.setImage(fs.readFileSync(path.join(TEX, light))).setMimeType("image/png");
  }
  await finish(doc, sex === "m" ? "male.glb" : "female.glb");
  await sharp(path.join(TEX, dark)).resize(1024, 1024).webp({ quality: 82 }).toFile(path.join(OUT, `skin-dark-${sex}.webp`));
}

// ---------------------------------------------------------------- hair
// One small file per style; each is skinned to the same rig, and the game
// rebinds it to the wearer's skeleton by bone name.
{
  const HAIR = path.join(UBC, "Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)");
  for (const n of ["Hair_Buzzed", "Hair_BuzzedFemale", "Hair_SimpleParted", "Hair_Long", "Hair_Buns", "Hair_Beard"]) {
    const doc = await io.read(path.join(HAIR, n + ".gltf"));
    await finish(doc, n.toLowerCase().replace("hair_", "hair-") + ".glb", 512);
  }
}

// ---------------------------------------------------------------- animations
{
  const KEEP = [
    "Idle_Loop", "Idle_Talking_Loop", "Walk_Loop", "Jog_Fwd_Loop", "Sprint_Loop", "Sword_Attack", "Sword_Idle",
    "Punch_Jab", "Punch_Cross", "Hit_Chest", "Hit_Head", "Death01", "Roll", "Jump_Start", "Jump_Loop", "Jump_Land",
    "Sitting_Idle_Loop", "Sitting_Talking_Loop", "Driving_Loop", "Spell_Simple_Shoot", "Spell_Simple_Idle_Loop",
    "Crouch_Idle_Loop", "Fixing_Kneeling", "Interact", "PickUp_Table", "Walk_Formal_Loop",
  ];
  const doc = await io.read(path.join(UAL, "Unreal-Godot/UAL1_Standard.glb"));
  for (const a of doc.getRoot().listAnimations()) if (!KEEP.includes(a.getName())) a.dispose();
  // no mesh: the clips drive the bodies above (same rig)
  for (const n of doc.getRoot().listNodes()) {
    n.setMesh(null);
    n.setSkin(null);
  }
  for (const m of doc.getRoot().listMeshes()) m.dispose();
  for (const s of doc.getRoot().listSkins()) s.dispose();
  await doc.transform(resample(), prune({ keepLeaves: true }), dedup(), meshopt({ encoder: MeshoptEncoder, level: "medium" }));
  await io.write(path.join(OUT, "anims.glb"), doc);
  console.log("anims.glb", (fs.statSync(path.join(OUT, "anims.glb")).size / 1e6).toFixed(2), "MB", doc.getRoot().listAnimations().length, "clips");
}

fs.writeFileSync(
  path.join(OUT, "LICENSE.txt"),
  "People and animations: Quaternius, \"Universal Base Characters\" and \"Universal Animation Library\".\nCC0 1.0 Universal (public domain). https://quaternius.com\nOptimized for the web by tools/people/build.mjs.\n",
);
