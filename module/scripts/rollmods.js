// Roll modifier engine: no Foundry dependency, to test with node.
// Regra: { id, label, text, when:{rolls,skills,attributes,item:{...}}, effects:[...], cost:{uses,ap,luck,resource}, auto }.
import { fail } from "./core.js";
const low = (v) => String(v).toLowerCase();
const list = (v) => (v == null ? [] : [v].flat());
// "!x" = the item must NOT have x; other values: it must have at least one.
const hit = (want, have) => {
  const w = list(want).map(low), h = list(have).map(low), yes = w.filter((x) => !x.startsWith("!")), no = w.filter((x) => x.startsWith("!")).map((x) => x.slice(1));
  return (!yes.length || h.some((x) => yes.includes(x))) && !h.some((x) => no.includes(x));
};

// ctx = { roll, skill?, attribute?, item?: { weaponType, tags, damageType, range } }. What the rule requires and the context lacks = does not apply.
export function applies(rule, ctx) {
  const w = rule.when ?? {};
  if (["apply", "kill"].includes(ctx.roll) && !w.rolls?.includes(ctx.roll)) return false; // damage macro phases only run rules that ask for them
  if (w.rolls?.length && !hit(w.rolls, ctx.roll)) return false;
  if (w.requires?.length && !w.requires.every((x) => list(ctx.fx).includes(x))) return false; // effect the target must have (e.g. vulnerable)
  if (w.skills?.length && !hit(w.skills, ctx.skill)) return false;
  if (w.attributes?.length && !hit(w.attributes, ctx.attribute)) return false;
  for (const [k, want] of Object.entries(w.item ?? {})) {
    if (k === "tags") { // tags: the item must have all of them ("!x" = must not have); tagsAny: one is enough
      const have = list(ctx.item?.tags).map(low);
      if (!list(want).map(low).every((x) => (x.startsWith("!") ? !have.includes(x.slice(1)) : have.includes(x)))) return false;
    } else if (!hit(want, k === "tagsAny" ? ctx.item?.tags : ctx.item?.[k])) return false;
  }
  return true;
}

// An item's rules: the item's own (flag) wins over the catalog's. Catalog: by source id, then by name (only if unique).
const entryOf = (item, catalog) => catalog.byId[(item._stats?.compendiumSource ?? item.flags?.core?.sourceId ?? "").split(".").pop()] ?? catalog.byName[low(item.name)];
export function rulesOf(item, catalog) {
  const own = item.flags?.["sheet-relay"]?.rollMods;
  const rules = Array.isArray(own) ? own : entryOf(item, catalog)?.regras ?? [];
  // "$choice": what the player chose for this item (e.g. damage type of Elemental Affinity); with no choice, the rule does not apply.
  const choice = item.flags?.["sheet-relay"]?.choice ?? "§sem-escolha§";
  return rules.map((r) => (JSON.stringify(r).includes("$choice") ? JSON.parse(JSON.stringify(r).replaceAll("$choice", choice)) : r));
}
// Display name: the catalog's when it only adds a suffix (e.g. "Lock And Load (Settler's Guide)").
const shownName = (item, catalog) => { const n = entryOf(item, catalog)?.name; return n && low(n).startsWith(low(item.name)) ? n : item.name; };

export function indexCatalog(raw) {
  const byName = {}, seen = {};
  for (const e of Object.values(raw)) seen[low(e.name)] = (seen[low(e.name)] ?? 0) + 1;
  for (const e of Object.values(raw)) if (seen[low(e.name)] === 1) byName[low(e.name)] = e;
  return { byId: raw, byName };
}

// Spent uses live on the item: flags.sheet-relay.used = { <ruleId>: n }. Resetting is up to the system (phase 1).
// evalMax (optional, from the system) computes maxima written as formulas (e.g. "@abilities.cha.mod").
// cost.uses.fromItem: the spend lives in the item's system.uses (the sheet and the system's native rest see it); with no uses configured on the item, falls back to the flag.
export const itemUses = (item, rule) => { const u = item.system?.uses; return rule.cost?.uses?.fromItem && u?.max > 0 ? u : null; };
export const usesMax = (rule, evalMax, item) => {
  const iu = item && itemUses(item, rule); if (iu) return iu.max;
  const m = rule.cost?.uses?.max; return typeof m === "number" ? m : m != null ? evalMax?.(m) ?? null : null;
};
export const usesLeft = (item, rule, evalMax) => {
  const max = usesMax(rule, evalMax, item), iu = itemUses(item, rule), flag = item.flags?.["sheet-relay"]?.used?.[rule.id] ?? 0; // the old flag from whoever spent before fromItem still counts
  return typeof max === "number" ? Math.max(0, max - (iu ? (iu.spent ?? 0) : 0) - flag) : null;
};

// Applicable rules from all of the actor's items, ready for the app: [{ key, itemId, itemName, ...rule, usesLeft }].
export function available(items, catalog, ctx) {
  const out = [], seen = new Set(), hidden = new Set(), cand = [];
  for (const item of items) for (const rule of rulesOf(item, catalog)) {
    if (!applies(rule, ctx) || (ctx.keep && !ctx.keep(rule))) continue; // keep: the system discards rules with no effect on this roll
    for (const id of rule.supersedes ?? []) hidden.add(id); // supersedes: the greater rule hides the lesser one (rule ids from other items)
    cand.push([item, rule]);
  }
  for (const [item, rule] of cand) {
    if (hidden.has(rule.id)) continue;
    const dup = `${low(item.name)}:${rule.id}`; // the same perk repeated on the sheet does not count twice
    if (seen.has(dup)) continue;
    seen.add(dup);
    out.push({ key: `${item.id}:${rule.id}`, itemId: item.id, itemName: shownName(item, catalog), ...rule, usesLeft: usesLeft(item, rule, ctx.evalMax), usesMax: usesMax(rule, ctx.evalMax, item) });
  }
  return out;
}

// Validates the keys selected by the app against the rules actually available and sums effects and costs.
// calcCost(value, rule) resolves costs written as formulas (e.g. "@rank"); without it, a non-numeric cost is 0.
export function resolve(avail, keys, wallet = {}, calcCost) {
  const n = (v, r) => { const x = typeof v === "number" ? v : calcCost?.(v, r); return Number.isFinite(x) && x > 0 ? x : 0; };
  const chosen = [];
  for (const k of new Set(keys ?? [])) {
    const r = avail.find((a) => a.key === k);
    if (!r) throw fail(400, "err.mod.unavailable", { key: k });
    if (r.usesLeft === 0) throw fail(400, "err.mod.noUses", { label: r.label });
    chosen.push(r);
  }
  const cost = { ap: 0, luck: 0, uses: [] }, effects = [], notes = [];
  for (const r of chosen) {
    cost.ap += n(r.cost?.ap, r); cost.luck += n(r.cost?.luck, r);
    if (r.cost?.uses) cost.uses.push({ itemId: r.itemId, ruleId: r.id, fromItem: !!r.cost.uses.fromItem });
    for (const e of r.effects ?? []) (e.other || e.grant ? notes : effects).push({ ...e, from: r.key });
    if (r.auto) notes.push({ other: r.auto, from: r.key });
  }
  if (cost.ap > (wallet.ap ?? Infinity)) throw fail(400, "err.mod.noAp");
  if (cost.luck > (wallet.luck ?? Infinity)) throw fail(400, "err.mod.noLuck");
  return { chosen: chosen.map((r) => ({ key: r.key, label: r.label, text: r.text, itemName: r.itemName })), effects, notes, cost };
}
