// Builds the AFTERFALL game (afterfall/, its own Vite project) and copies the
// output into public/afterfall so Next serves it as static files at /afterfall/.
import { execSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const game = join(root, "afterfall");
const out = join(root, "public", "afterfall");
const run = (cmd) => execSync(cmd, { cwd: game, stdio: "inherit" });

if (!existsSync(join(game, "node_modules"))) {
  // Vercel builds with NODE_ENV=production; vite and typescript are devDependencies.
  run("npm ci --include=dev --no-audit --no-fund");
}
run("npx vite build");

rmSync(out, { recursive: true, force: true });
cpSync(join(game, "dist"), out, { recursive: true });
console.log("AFTERFALL copied to public/afterfall");
