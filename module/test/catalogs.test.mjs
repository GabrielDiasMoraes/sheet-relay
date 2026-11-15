// node module/test/catalogs.test.mjs — safety net: every catalog passes the editor's validator (with its system's vocabulary) and uses a known `per`.
import { existsSync, readFileSync } from "node:fs";
import { validateRules } from "../scripts/rules.js";

const PER = ["scene", "sr", "lr", "turn", "session", "once"];
const bad = [];
for (const sys of ["fallout", "dnd5e", "legends"]) {
  const { default: d } = await import(`../../systems/${sys}/module/index.js`);
  const cat = {};
  for (const f of ["catalog.json", "catalog.private.json"]) { // public (SRD) + private (private forks only)
    const u = new URL(`../../systems/${sys}/module/${f}`, import.meta.url);
    if (existsSync(u)) Object.assign(cat, JSON.parse(readFileSync(u)));
  }
  const per = new Set([...PER, ...d.vocab.periods]);
  for (const [key, it] of Object.entries(cat)) for (const r of it.regras ?? []) {
    try { validateRules([r], d.vocab); } catch (e) { bad.push(`${sys}/${it.name} (${key}) regra "${r.id}": ${e.message}`); }
    const p = r.cost?.uses?.per;
    if (p !== undefined && !per.has(p) && !/^[\d+\-*/().\s]+$|^@\w+$/.test(p)) bad.push(`${sys}/${it.name} regra "${r.id}": per "${p}" desconhecido`);
  }
}
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log("catalogs ok");
