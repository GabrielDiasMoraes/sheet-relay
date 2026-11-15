// Connects the modifier engine (rollmods.js) to Foundry: system catalog, actor rules and use spending.
import { loadCatalog } from "./catalog.js";
import { ID } from "./core.js";
import { current } from "./registry.js";
import { available, indexCatalog, resolve, rulesOf } from "./rollmods.js";

let repoRaw = null;
// shortcut: if the catalog fails to load, it stays empty until the world is reloaded.
// Rules edited in the world (rollRules setting) apply on top of the repository's, for everyone who has the perk.
const rollCatalog = async () => indexCatalog({ ...(repoRaw ??= await loadCatalog(current()?.catalogUrl ?? `modules/${ID}/scripts/systems/${game.system.id}/catalog.json`)), ...(game.settings.get(ID, "rollRules") ?? {}) });

export const availableMods = async (a, ctx) => available([...(ctx.itemFilter ? a.items.filter(ctx.itemFilter) : a.items), ...(ctx.virtual ?? [])], await rollCatalog(), ctx); // virtual: "borrowed" items (e.g. ally aura)
export const chooseMods = async (a, ctx, keys, wallet, calcCost) => resolve(await availableMods(a, ctx), keys, wallet, calcCost);

// Charges what the chosen rules cost: uses live on the item (system.uses.spent with cost.uses.fromItem; otherwise flags.sheet-relay.used), AP and Luck via the system.
export async function spendUses(a, cost) {
  const by = {};
  for (const u of cost.uses) (by[u.itemId] ??= []).push(u);
  for (const [itemId, uses] of Object.entries(by)) {
    const item = a.items.get(itemId), used = { ...(item.getFlag(ID, "used") ?? {}) }, before = JSON.stringify(used);
    let spent = item.system.uses?.spent ?? 0, sys = false;
    for (const { ruleId: r, fromItem } of uses) {
      if (fromItem && item.system.uses?.max > 0) { spent += 1 + (used[r] ?? 0); delete used[r]; sys = true; } // what was already in the flag moves to the item
      else used[r] = (used[r] ?? 0) + 1;
    }
    if (sys) await item.update({ "system.uses.spent": Math.min(spent, item.system.uses.max) });
    if (JSON.stringify(used) !== before) await (Object.keys(used).length ? item.setFlag(ID, "used", used) : item.unsetFlag(ID, "used"));
  }
}
// Resets spent uses; with `per` (a period or a list, e.g. ["sr", "lr"]), only for rules of those periods. Without `per`, everything.
export async function resetUses(a, per) {
  const cat = await rollCatalog();
  for (const i of a.items) {
    const used = i.getFlag(ID, "used");
    if (!used) continue;
    const left = per ? Object.fromEntries(Object.entries(used).filter(([id]) => ![per].flat().includes(rulesOf(i, cat).find((r) => r.id === id)?.cost?.uses?.per))) : {};
    if (Object.keys(left).length === Object.keys(used).length) continue;
    await (Object.keys(left).length ? i.setFlag(ID, "used", left) : i.unsetFlag(ID, "used"));
  }
}
