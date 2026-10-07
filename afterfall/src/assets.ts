// Loading .glb models, with a fallback for hosts that won't serve .glb (the
// published artifact): each model folder can ship a pack.js holding the same
// files as base64 (tools/pack.mjs), registered under window.__packs[folder].

const packs = new Map<string, Promise<Record<string, string>>>();
const packOnly = new Set<string>();

function loadPack(dir: string) {
  let p = packs.get(dir);
  if (!p) {
    p = new Promise((ok, fail) => {
      const s = document.createElement("script");
      s.src = dir + "pack.js";
      s.onload = () => ok((window as unknown as { __packs: Record<string, Record<string, string>> }).__packs?.[dir.replace(/^\.\//, "")] ?? {});
      s.onerror = fail;
      document.head.appendChild(s);
    });
    packs.set(dir, p);
  }
  return p;
}

/** The bytes of `dir + file` (dir like "./people/"). */
export async function fetchModel(dir: string, file: string): Promise<ArrayBuffer> {
  if (!packOnly.has(dir))
    try {
      const r = await fetch(dir + file);
      const buf = r.ok ? await r.arrayBuffer() : null;
      // a real glb starts with "glTF"
      if (buf && buf.byteLength > 12 && new DataView(buf).getUint32(0, true) === 0x46546c67) return buf;
    } catch {
      /* fall through to the pack */
    }
  packOnly.add(dir);
  const b64 = (await loadPack(dir))[file];
  if (!b64) throw new Error(`missing model ${dir}${file}`);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out.buffer;
}
