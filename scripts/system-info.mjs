// Reads a system's manifest (systems/<id>/system.json) by id or by app name.
// Usage: node scripts/system-info.mjs <id|app> [field]   (without a field prints the JSON; with a field, only the value)
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../systems");
export const manifests = () => readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("_") && existsSync(join(root, e.name, "system.json")))
  .map((e) => ({ ...JSON.parse(readFileSync(join(root, e.name, "system.json"), "utf8")), dir: join(root, e.name) }));

if (import.meta.url === `file://${process.argv[1]}`) {
  const [key, field] = process.argv.slice(2);
  const m = manifests().find((x) => x.id === key || x.app === key);
  if (!m) { console.error(`system "${key}" not found (known: ${manifests().map((x) => `${x.app}/${x.id}`).join(", ")})`); process.exit(1); }
  console.log(field ? (m[field] ?? "") : JSON.stringify(m, null, 1));
}
