#!/usr/bin/env node
// npm package CLI: `sheet-relay serve` (relay + app) and `sheet-relay headless` (relay user without Docker).
import { existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const pkg = path.resolve(here, "..");
const [cmd, ...args] = process.argv.slice(2);
const opt = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : def; };
const apps = path.join(pkg, "apps");

const help = () => {
  console.log(`sheet-relay <command>

  serve     Run the relay and serve the web app.
              --system <id>   dnd5e | fallout | legends        (env SYSTEM, default dnd5e)
              --port <n>      (env PORT, default 8787)         --host <h>  (env HOST, default 127.0.0.1)
              --base <path>   where the app is served (env BASE_PATH, default /ficha; must match the build)
            Env: RELAY_SECRET (shared secret with the module setting "Relay secret"), TRUST_PROXY=1 behind a reverse proxy.
  headless  Keep the relay user logged in to your Foundry world (needs: npm i playwright && npx playwright install chromium).
            Env: FOUNDRY_URL, FOUNDRY_USER, FOUNDRY_PASSWORD, [FOUNDRY_HOST]`);
};

if (cmd === "serve") {
  const system = opt("system", process.env.SYSTEM ?? "dnd5e");
  const dir = path.join(apps, system);
  if (!existsSync(dir)) { console.error(`No bundled app for "${system}". Available: ${existsSync(apps) ? readdirSync(apps).join(", ") : "none"}`); process.exit(1); }
  process.env.STATIC_DIR = dir;
  process.env.BASE_PATH = opt("base", process.env.BASE_PATH ?? "/ficha");
  const { server } = await import("../server.js");
  const port = Number(opt("port", process.env.PORT ?? 8787)), host = opt("host", process.env.HOST ?? "127.0.0.1");
  if (!process.env.RELAY_SECRET) console.warn("WARNING: RELAY_SECRET is not set; anyone who can reach this port can impersonate Foundry.");
  server.listen(port, host, () => console.log(`sheet-relay on http://${host}:${port}${process.env.BASE_PATH}/ (system ${system})`));
} else if (cmd === "headless") {
  await import("../headless.mjs");
} else { help(); process.exit(cmd ? 1 : 0); }
