// en and pt-BR dictionaries: same keys in each pair, and every static t("...") key used in the app exists in en.
import assert from "node:assert";
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const root = new URL("../../", import.meta.url).pathname;
const load = (p) => JSON.parse(readFileSync(p, "utf8"));
const dirs = [join(root, "shared/locales"), ...readdirSync(join(root, "systems")).map((s) => join(root, "systems", s, "app/locales"))].filter(existsSync);
const known = new Set();
for (const d of dirs) {
  const en = load(join(d, "en.json")), pt = load(join(d, "pt-BR.json"));
  assert.deepEqual(Object.keys(en).sort(), Object.keys(pt).sort(), `different keys in ${d}`);
  for (const k of Object.keys(en)) known.add(k);
}
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return f === "node_modules" || f === "dist" ? [] : statSync(p).isDirectory() ? walk(p) : /\.(tsx?|js)$/.test(f) ? [p] : []; });
const used = [];
for (const base of [join(root, "shared"), ...readdirSync(join(root, "systems")).map((s) => join(root, "systems", s, "app"))]) {
  if (!existsSync(base)) continue;
  for (const f of walk(base)) for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*["'`]([\w.]+)["'`]/g)) used.push([f, m[1]]);
}
const missing = used.filter(([, k]) => !known.has(k) && !k.endsWith(".") && !k.includes("${"));
assert.deepEqual(missing.map(([f, k]) => `${f.replace(root, "")}: ${k}`), [], "t() keys without translation");
console.log(`i18n ok: ${known.size} keys, ${used.length} uses`);
