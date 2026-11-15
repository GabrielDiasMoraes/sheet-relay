// Validates that each system's manifest (systems/<id>/system.json) matches the hand-written infrastructure:
// docker-compose, Caddy snippet, .mcp.json and README. Writes nothing.  Usage: node scripts/check-systems.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { manifests } from "./system-info.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(root, f), "utf8");
const bad = [];
const need = ["id", "name", "app", "instance", "container", "domain", "relayUser", "web", "mcpPort"];
const ms = manifests();

// folders with a module need a manifest, and the manifest id is the folder name
const dirs = readdirSync(join(root, "systems"), { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("_") && existsSync(join(root, "systems", e.name, "module")));
for (const d of dirs) if (!ms.some((m) => m.id === d.name)) bad.push(`systems/${d.name}: falta system.json`);
for (const m of ms) {
  for (const k of need) if (m[k] === undefined || m[k] === "") bad.push(`${m.id}: system.json missing "${k}"`);
  if (m.dir.split("/").pop() !== m.id) bad.push(`${m.id}: the id must be the folder name`);
}
for (const k of ["app", "instance", "web", "mcpPort", "relayUser", "domain"]) {
  const seen = new Map();
  for (const m of ms) { if (seen.has(m[k])) bad.push(`"${k}" repetido: ${m[k]} (${seen.get(m[k])} e ${m.id})`); seen.set(m[k], m.id); }
}

const compose = read("deploy/docker-compose.yml"), caddy = read("deploy/Caddyfile.snippet"), mcp = JSON.parse(read(".mcp.json")).mcpServers ?? {}, readme = read("README.md");
const block = (name) => { const m = compose.match(new RegExp(`^  ${name}:\\n((?:    .*\\n|\\n)*)`, "m")); return m ? m[1] : null; };
for (const m of ms) {
  const relay = block(`relay-${m.app}`), head = block(`headless-${m.app}`), web = block(m.web);
  if (relay == null) bad.push(`${m.id}: compose missing service relay-${m.app}`);
  if (head == null) bad.push(`${m.id}: compose missing service headless-${m.app}`);
  else {
    if (!head.includes(`FOUNDRY_HOST: ${m.container}`)) bad.push(`${m.id}: headless-${m.app} deve ter FOUNDRY_HOST: ${m.container}`);
    if (!head.includes(`FOUNDRY_USER: ${m.relayUser}`)) bad.push(`${m.id}: headless-${m.app} deve ter FOUNDRY_USER: ${m.relayUser}`);
  }
  if (web == null) bad.push(`${m.id}: compose missing service ${m.web}`);
  else if (!web.includes(`../apps/${m.app}/dist:`)) bad.push(`${m.id}: ${m.web} deve montar ../apps/${m.app}/dist`);
  if (!caddy.includes(`relay-${m.app}:8787`)) bad.push(`${m.id}: Caddyfile.snippet missing relay-${m.app}:8787`);
  if (!caddy.includes(`${m.web}:80`)) bad.push(`${m.id}: Caddyfile.snippet missing ${m.web}:80`);
  const srv = mcp[`foundry-${m.app}`];
  if (!srv) bad.push(`${m.id}: .mcp.json missing server foundry-${m.app}`);
  else if (String(srv.env?.FOUNDRY_MCP_PORT) !== String(m.mcpPort)) bad.push(`${m.id}: .mcp.json foundry-${m.app} usa a porta ${srv.env?.FOUNDRY_MCP_PORT}, o manifesto diz ${m.mcpPort}`);
  if (!new RegExp(`\\|\\s*\`?${m.relayUser}\`?\\s*\\|\\s*${m.mcpPort}\\s*\\|`).test(readme)) bad.push(`${m.id}: the README table "Relay user per world" has no ${m.relayUser} with port ${m.mcpPort}`);
}
if (bad.length) { console.error(bad.map((b) => `- ${b}`).join("\n")); process.exit(1); }
console.log(`manifests ok: ${ms.map((m) => m.id).join(", ")}`);
