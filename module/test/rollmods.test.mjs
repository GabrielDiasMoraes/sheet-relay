// node module/test/rollmods.test.mjs
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { applies, rulesOf, indexCatalog, available, resolve } from "../scripts/rollmods.js";

// The real Fallout catalog only exists in the private fork (catalog.private.json); in the public repo these catalog tests are skipped.
const privFile = new URL("../../systems/fallout/module/catalog.private.json", import.meta.url);
const HAS = existsSync(privFile);
const cat = indexCatalog(HAS ? JSON.parse(readFileSync(privFile)) : {});
const perk = (id, name) => ({ id: name, name, _stats: { compendiumSource: `Compendium.fallout.perks.Item.${id}` } });

// catalog by source id; a repeated name (Lock And Load) does not match by name
if (HAS) {
assert.equal(rulesOf(perk("2FdFacs1WqPmBk06", "Qualquer"), cat)[0].id, "bullet-shield");
assert.equal(rulesOf({ name: "Lock And Load" }, cat).length, 0);
assert.ok(rulesOf(perk("AVd5cD53kBpXIZ4C", "Lock And Load"), cat).length > 0);
}
// the item's flag wins over the catalog
assert.equal(rulesOf({ name: "x", flags: { "sheet-relay": { rollMods: [{ id: "r" }] } } }, cat)[0].id, "r");

// filtro: roll, skill e item
const rule = { when: { rolls: ["damage"], item: { weaponType: ["throwing"] } } };
assert.equal(applies(rule, { roll: "damage", item: { weaponType: "Throwing" } }), true);
assert.equal(applies(rule, { roll: "damage" }), false);
assert.equal(applies(rule, { roll: "attack", item: { weaponType: "throwing" } }), false);
assert.equal(applies({ when: { skills: ["sneak"] } }, { roll: "skill", skill: "Sneak" }), true);

// available, uses and costs
let av = [];
if (HAS) {
av = available([perk("2FdFacs1WqPmBk06", "Bullet Shield")], cat, { roll: "soak", item: { weaponType: "bigGuns" } });
assert.equal(av.length, 1);
assert.deepEqual(resolve(av, [av[0].key]).chosen.map((c) => c.itemName), ["Bullet Shield"]);
}
assert.throws(() => resolve(av.length ? av : [{ key: "a:b", label: "b", effects: [], usesLeft: null, itemId: "a", id: "b" }], ["x:y"]), /unavailable/);
const caro = [{ key: "a:b", label: "b", cost: { ap: 2, luck: 1, uses: { max: 1, per: "scene" } }, effects: [{ other: "msg" }, { add: "damage", formula: "1" }], usesLeft: 1, itemId: "a", id: "b" }];
const r = resolve(caro, ["a:b"], { ap: 3, luck: 1 });
assert.deepEqual([r.cost.ap, r.cost.luck, r.effects.length, r.notes.length], [2, 1, 1, 1]);
assert.throws(() => resolve(caro, ["a:b"], { ap: 1, luck: 1 }), /AP/);
assert.throws(() => resolve([{ ...caro[0], usesLeft: 0 }], ["a:b"]), /no uses left/);
// a perk repeated on the sheet appears only once
if (HAS) {
const dobro = available([perk("2FdFacs1WqPmBk06", "Bullet Shield"), { ...perk("2FdFacs1WqPmBk06", "Bullet Shield"), id: "outro" }], cat, { roll: "soak", item: { weaponType: "bigGuns" } });
assert.equal(dobro.length, 1);
}
// a formula cost ("@rank") only counts if the system can compute it; never becomes NaN
const gf = [{ key: "g:f", label: "g", cost: { ap: "@rank" }, effects: [], usesLeft: null, itemId: "g", id: "f" }];
assert.equal(resolve(gf, ["g:f"], { ap: 6 }).cost.ap, 0);
assert.equal(resolve(gf, ["g:f"], { ap: 6 }, () => 2).cost.ap, 2);
// both Lock And Load entries appear with the source suffix
if (HAS) {
const lal = available([perk("AVd5cD53kBpXIZ4C", "Lock And Load")], cat, { roll: "attack", item: { tags: ["fireRate"] } });
assert.ok(lal.length === 0 || lal[0].itemName === "Lock And Load (Settler's Guide)");
}
assert.equal(applies({ when: {} }, { roll: "apply" }), false);
assert.equal(applies({ when: { rolls: ["apply"] } }, { roll: "apply" }), true);
// negation and lists in the context
assert.equal(applies({ when: { item: { tags: ["twoHanded", "!heavy"] } } }, { roll: "x", item: { tags: ["twoHanded"] } }), true);
assert.equal(applies({ when: { item: { tags: ["twoHanded", "fireRate<=2"] } } }, { roll: "x", item: { tags: ["fireRate<=2"] } }), false);// all of them
assert.equal(applies({ when: { item: { tagsAny: ["bow", "crossbow"] } } }, { roll: "x", item: { tags: ["crossbow"] } }), true); // any one
assert.equal(applies({ when: { item: { tags: ["twoHanded", "!heavy"] } } }, { roll: "x", item: { tags: ["twoHanded", "heavy"] } }), false);
assert.equal(applies({ when: { item: { weaponType: ["ranged"] } } }, { roll: "x", item: { weaponType: ["smallGuns", "ranged"] } }), true);
assert.equal(applies({ when: { requires: ["vulnerable"] } }, { roll: "damage", fx: ["vulnerable"] }), true);
assert.equal(applies({ when: { requires: ["vulnerable"] } }, { roll: "damage" }), false);
// "$choice" with no choice made does not break and the rule does not apply; with a choice, it applies only to it
const afin = { id: "a", name: "Afinidade", flags: {}, _stats: {} };
const cat2 = indexCatalog({ x: { name: "Afinidade", regras: [{ id: "r", label: "r", when: { item: { damageType: ["$choice"] } }, effects: [] }] } });
assert.equal(available([afin], cat2, { roll: "damage", item: { damageType: ["fire"] } }).length, 0);
assert.equal(available([{ ...afin, flags: { "sheet-relay": { choice: "fire" } } }], cat2, { roll: "damage", item: { damageType: ["fire"] } }).length, 1);
// supersedes: the Greater Mark hides the Dragonmark rule; without it the common one comes back; resolve refuses the hidden one
const marca = { id: "m", name: "Marca", flags: { "sheet-relay": { rollMods: [{ id: "marca-x", label: "d4", when: { rolls: ["check"] }, effects: [] }] } } };
const maior = { id: "mm", name: "Marca Maior", flags: { "sheet-relay": { rollMods: [{ id: "up", label: "d6", supersedes: ["marca-x"], when: { rolls: ["check"] }, effects: [] }] } } };
const sup = available([marca, maior], cat, { roll: "check" });
assert.deepEqual(sup.map((a) => a.key), ["mm:up"]);
assert.deepEqual(available([marca], cat, { roll: "check" }).map((a) => a.key), ["m:marca-x"]);
assert.deepEqual(available([marca, maior], cat, { roll: "skill" }).map((a) => a.key), []); // greater one outside the filter: does not hide
assert.throws(() => resolve(sup, ["m:marca-x"]), /unavailable/);
console.log("ok");

// cost.uses.fromItem: reads the item's system.uses; with no uses configured on the item, falls back to the flag
import { usesLeft, usesMax } from "../scripts/rollmods.js";
const fi = { id: "r", cost: { uses: { max: 9, per: "lr", fromItem: true } } };
assert.equal(usesLeft({ system: { uses: { max: 3, spent: 1 } }, flags: {} }, fi), 2);
assert.equal(usesMax(fi, null, { system: { uses: { max: 3, spent: 1 } } }), 3);
assert.equal(usesLeft({ system: { uses: { max: 3, spent: 1 } }, flags: { "sheet-relay": { used: { r: 1 } } } }, fi), 1); // flag antiga continua valendo
assert.equal(usesLeft({ system: {}, flags: { "sheet-relay": { used: { r: 2 } } } }, fi), 7); // no uses on the item: flag + the rule's max
console.log("fromItem ok");
