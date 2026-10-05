import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  build: { chunkSizeWarningLimit: 1200 },
  // `npm run dev` + `npm start` in another terminal: co-op works through the dev server
  server: { proxy: { "/ws": { target: "ws://localhost:8787", ws: true } } },
});
