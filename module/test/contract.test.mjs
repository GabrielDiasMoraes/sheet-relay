// System plugin contract (systems/<id>/module/index.js): loads without Foundry, descriptor format, commands that must NOT disappear
// in a folder change, no collision with the core and no import outside "../../api.js" or the own directory.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { mount } from "../scripts/registry.js";

// Core commands (main.js and rules.js); login and listUsers are "open" and nobody overrides them.
const CORE = ["listRuleItems", "getRules", "saveRules", "resetRules", "listRollMods", "resetModUses", "subscribe", "changePassword", "listCharacters", "deleteCharacter"];
const core = Object.fromEntries(CORE.map((n) => [n, () => n]));

// Snapshot of each plugin's commands: if a name disappears (or appears), this test warns. Update on purpose when adding/removing commands.
// Commands that may not exist in the public version (house rules removed by the export).
const OPTIONAL = ["travel", "travelOptions"];
const SNAP = {
  fallout: ["addItem", "ammoTypes", "applyDamage", "createCharacter", "damagePerks", "defensePerks", "getAmmo", "getCharacter", "levelUp", "levelUpOptions", "listPacks", "lootTables", "npcStatus", "rollDamage", "rollLoot", "rollSkill", "rollWeapon", "sceneNpcs", "sceneTargets", "searchCompendium", "setAttribute", "setCaps", "setInjury", "setLuck", "setQuantity", "setSkillTag", "travel", "travelOptions", "updateCharacter"],
  dnd5e: ["activity", "addItem", "advance", "condition", "conditions", "createCharacter", "creationOptions", "describeItem", "drawTable", "getCharacter", "healTargets", "hp", "levelUpOptions", "packs", "pool", "removeItem", "resolvePending", "rest", "roll", "sceneInit", "sceneTokens", "search", "setItem", "special", "tokenActivity", "tokenEffect", "tokenHp", "update"],
  legends: ["applyGrowth", "createCharacter", "creationData", "getCharacter", "growthOptions", "playbook", "roll", "sceneTokens", "setItem", "setItemText", "toggleMark", "tokenBalance", "tokenFatigue", "tokenMark", "tokenRoll", "tokenTechnique", "update"]
};

const root = new URL("../../systems/", import.meta.url);
const ids = readdirSync(root, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith("_")).map((e) => e.name);
assert.deepEqual([...ids].sort(), Object.keys(SNAP).sort(), "new or removed plugin: update SNAP");

for (const id of ids) {
  const dir = new URL(`${id}/module/`, root);
  const { default: d } = await import(new URL("index.js", dir).href);
  assert.equal(d.id, id, `${id}: the descriptor id must be the folder name`);
  assert.deepEqual(Object.keys(d.handlers).filter((n) => !OPTIONAL.includes(n)).sort(), SNAP[id].filter((n) => !OPTIONAL.includes(n)), `${id}: comandos mudaram`);
  const m = mount(core, d); // throws if a plugin command collides with the core
  for (const n of CORE) assert.equal(typeof m[n], "function");
  assert.ok(new URL(d.catalogUrl).pathname.endsWith(`/systems/${id}/module/catalog.json`), `${id}: catalogUrl`);
  JSON.parse(readFileSync(new URL("catalog.json", dir))); // catalog exists and is JSON
  // allowed imports: "../../api.js" or the plugin's own files ("./x.js")
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const [, spec] of src.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+["']([^"']+)["']/gm)) assert.ok(spec === "../../api.js" || spec.startsWith("./"), `${id}/${f}: forbidden import "${spec}" (only ../../api.js and files in the plugin's own directory)`);
    for (const [, spec] of src.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) assert.ok(spec.startsWith("./"), `${id}/${f}: forbidden dynamic import "${spec}"`);
  }
}
// The example system (systems/_template) must also pass, so the guide does not rot: the descriptor id does NOT have to be the folder name.
{
  const dir = new URL("_template/module/", root);
  const { default: d } = await import(new URL("index.js", dir).href);
  assert.deepEqual(Object.keys(d.handlers).sort(), ["getCharacter", "roll", "update"], "_template: comandos mudaram");
  mount(core, d);
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".js"))) {
    const src = readFileSync(new URL(f, dir), "utf8");
    for (const [, spec] of src.matchAll(/^\s*(?:import|export)\b[^;]*?from\s+["']([^"']+)["']/gm)) assert.ok(spec === "../../api.js" || spec.startsWith("./"), `_template/${f}: import proibido "${spec}"`);
  }
}
console.log("contract ok:", ids.join(", "), "+ _template");
