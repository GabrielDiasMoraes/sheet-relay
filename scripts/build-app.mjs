#!/usr/bin/env node
// Builds a system's web app (expo export) into <output folder> with the chosen base path.
// Usage: node scripts/build-app.mjs <system id> <output folder> [--base /ficha]
// The base path goes into app.json (baseUrl), the PWA's manifest.json and EXPO_PUBLIC_BASE_PATH (shared/pwa.ts);
// the original files are restored at the end, even if the build fails.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";

const [id, outArg, ...rest] = process.argv.slice(2);
if (!id || !outArg) { console.error("usage: node scripts/build-app.mjs <system id> <output folder> [--base /ficha]"); process.exit(1); }
const bi = rest.indexOf("--base");
const base = "/" + (bi >= 0 ? rest[bi + 1] ?? "" : "/ficha").replace(/^\/+|\/+$/g, ""); // "/ficha" (or "/" if empty)
const root = path.resolve(new URL("..", import.meta.url).pathname);
const app = path.join(root, "systems", id, "app");
if (!existsSync(path.join(app, "app.json"))) { console.error(`system without an app: ${app}`); process.exit(1); }
const prefix = base === "/" ? "/" : base + "/";

const files = [path.join(app, "app.json"), path.join(app, "public", "manifest.json")].filter(existsSync);
const originals = files.map((f) => readFileSync(f, "utf8"));
try {
  const aj = JSON.parse(originals[0]); aj.expo.experiments = { ...aj.expo.experiments, baseUrl: base === "/" ? "" : base };
  writeFileSync(files[0], JSON.stringify(aj, null, 2));
  if (files[1]) writeFileSync(files[1], originals[1].replaceAll("/ficha/", prefix));
  const r = spawnSync("node", ["node_modules/expo/bin/cli", "export", "--platform", "web", "--output-dir", path.resolve(outArg)], { cwd: app, stdio: "inherit", env: { ...process.env, EXPO_PUBLIC_BASE_PATH: prefix } });
  process.exitCode = r.status ?? 1;
} finally { files.forEach((f, i) => writeFileSync(f, originals[i])); }
