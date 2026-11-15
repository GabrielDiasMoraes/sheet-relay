#!/usr/bin/env node
// Prepares relay/ for `npm pack`/`npm publish`: builds the apps into relay/apps/<system> and copies the headless one.
// Usage: node scripts/prepare-npm.mjs [systems...]   (default: all systems/*/app except _template)
import { copyFileSync, mkdirSync, readdirSync, rmSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const all = readdirSync(path.join(root, "systems")).filter((s) => s !== "_template" && existsSync(path.join(root, "systems", s, "app", "app.json")));
const systems = process.argv.length > 2 ? process.argv.slice(2) : all;
rmSync(path.join(root, "relay/apps"), { recursive: true, force: true });
for (const s of systems) {
  console.log(`== ${s}`);
  const r = spawnSync("node", ["scripts/build-app.mjs", s, `relay/apps/${s}`, "--base", "/ficha"], { cwd: root, stdio: "inherit" });
  if (r.status) process.exit(r.status);
}
copyFileSync(path.join(root, "headless/login.mjs"), path.join(root, "relay/headless.mjs"));
copyFileSync(path.join(root, "LICENSE"), path.join(root, "relay/LICENSE"));
copyFileSync(path.join(root, "NOTICE"), path.join(root, "relay/NOTICE"));
mkdirSync(path.join(root, "relay/apps"), { recursive: true });
console.log("relay/ ready for npm pack");
