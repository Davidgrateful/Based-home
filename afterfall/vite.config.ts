import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { chunkSizeWarningLimit: 1200 },
  resolve: {
    // ez-tree from source, so its bark/leaf textures ship as image files
    // instead of 4 MB of base64 inside the bundle
    alias: { "ez-tree": fileURLToPath(new URL("./node_modules/@dgreenheck/ez-tree/src/lib/index.js", import.meta.url)) },
  },
  // `npm run dev` + `npm start` in another terminal: co-op works through the dev server
  server: { proxy: { "/ws": { target: "ws://localhost:8787", ws: true } } },
});
