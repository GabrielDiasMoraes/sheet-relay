// Merges each system's scan JSONs into systems/<system>/module/catalog.private.json: { "<compendium item id>": { name, rules } }.
// Sources: systems/<id>/content/<prefix>_<n>.json; system tweaks: systems/<id>/content/fixes.mjs (optional; see docs/create-system.md).
// Uso: node content/roll-mods/build-catalog.mjs [--check]   (prints what still needs validation; --check only compares with the committed catalogs)
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const CHECK = process.argv.includes("--check");
const root = join(dirname(fileURLToPath(import.meta.url)), "../../systems");

const TAG = { "one-handed": "oneHanded", "two-handed": "twoHanded" }; // weapon tags: agents write them hyphenated; the engine uses camelCase
// GENERIC cleanup (applies to any system). System-specific cleanup lives in systems/<id>/content/fixes.mjs:
//   before(r) and afterClean(r) mutate the rule in place; fix(r) returns the rules that replace it (or undefined to follow the default).
const clean = (r, sys) => {
  sys.before?.(r);
  const it = r.when?.item;
  if (it) for (const k of Object.keys(it)) { // descriptive filters ("pact weapon", "chosen (…)") and "any" never match: they are dropped and the rule stays visible (the text explains the condition)
    const v = [it[k]].flat().filter((x) => typeof x === "string" && /^[\w<>=!$-]+$/.test(x) && x !== "any");
    if (v.length) it[k] = Array.isArray(it[k]) ? v : v[0]; else delete it[k];
  }
  if (it?.tags) it.tags = it.tags.map((t) => TAG[t] ?? t);
  if (r.when?.skills?.length && r.when.attributes) delete r.when.attributes; // the player can change the attribute in the popup: the filter only gets in the way
  sys.afterClean?.(r);
  return r;
};
const fix = (r0, sys) => {
  const r = clean(r0, sys);
  const own = sys.fix?.(r);
  if (own) return own;
  if (r.effects.some((e) => e.extraRoll) && /mat(ou|ar)/i.test(r.when?.situation ?? "")) return [{ ...r, when: { ...r.when, rolls: ["kill"] } }]; // extra dice on kill: damage macro
  return [r];
};

const ids = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("_") && existsSync(join(root, e.name, "module"))).map((e) => e.name).sort();
for (const sys of ids) {
  const dir = join(root, sys, "content"), fx = existsSync(join(dir, "fixes.mjs")) ? await import(pathToFileURL(join(dir, "fixes.mjs")).href) : {};
  const pre = fx.prefix ?? sys, cat = {}, vars = new Set(), tags = new Set(), rolls = new Set();
  const files = existsSync(dir) ? readdirSync(dir).filter((f) => f.startsWith(pre + "_") && f.endsWith(".json")).sort() : [];
  for (const f of files) {
    for (const [name, v] of Object.entries(JSON.parse(readFileSync(join(dir, f), "utf8")))) {
      if (name === "_resumo" || !v.uuid) continue;
      const id = v.uuid.split(".").pop();
      const e = (cat[id] ??= { name: fx.names?.[id] ?? name, regras: [] });
      for (const r of v.regras.flatMap((x) => fix(x, fx))) {
        if (!e.regras.some((x) => x.id === r.id)) e.regras.push(r);
        for (const m of JSON.stringify(r.effects).matchAll(/@[\w.]+/g)) vars.add(m[0]);
        for (const t of [r.when?.item?.tags, r.when?.item?.weaponType].flat().filter(Boolean)) tags.add(t);
        for (const x of r.when?.rolls ?? []) rolls.add(x);
      }
    }
  }
  const text = JSON.stringify(cat), file = join(root, sys, "module/catalog.private.json");
  if (CHECK) { // --check: does not write; fails if the generated catalog differs from the committed one (someone edited the catalog by hand or the generator changed)
    if (readFileSync(file, "utf8") !== text) { console.error(`DIFFERS: ${sys}/module/catalog.private.json does not match what the generator produces`); process.exitCode = 1; } else console.log(`${sys}: ok`);
    continue;
  }
  writeFileSync(file, text);
  console.log(`${sys}: ${Object.keys(cat).length} itens\n  rolls: ${[...rolls]}\n  tags: ${[...tags]}\n  vars: ${[...vars]}`);
}
