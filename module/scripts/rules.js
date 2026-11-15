// Roll rules editor: world rules (rollRules setting) apply on top of the repository's (catalog), for everyone who has the perk.
import { ID, fail } from "./core.js";
import { indexCatalog } from "./rollmods.js";
import { loadCatalog } from "./catalog.js";
import { current } from "./registry.js";

export const WORLD = "rollRules";
// BASE vocabulary (common to all systems). System-specific terms only come from its descriptor's `vocab` (defineSystem).
const ROLLS = ["skill", "attack", "damage", "check", "save", "initiative", "spell", "heal", "soak"];
const WHEN = ["rolls", "skills", "attributes", "item", "situation", "requires"];
const ITEM = ["weaponType", "tags", "tagsAny", "damageType", "range"];
const EFFECT = ["set", "add", "dice", "extraRoll", "reroll", "autoCrit", "replace", "other", "grant", "value", "formula", "target"];
const COST = ["uses", "resource"];
const RULE = ["id", "label", "text", "when", "effects", "cost", "auto", "supersedes"];
const str = (v, max) => typeof v === "string" && v.length <= max;
const strs = (v) => Array.isArray(v) && v.length <= 20 && v.every((x) => str(x, 60));
const only = (o, keys, n, sec) => { for (const k of Object.keys(o)) if (!keys.includes(k)) throw fail(400, `err.rule.unknownField.${sec}`, { n, k }); };
const obj = (v, n, sec) => { if (!v || typeof v !== "object" || Array.isArray(v)) throw fail(400, `err.rule.notObject.${sec}`, { n }); return v; };

// Checks the shape of the rules before saving (the app and the item sheet send what the user typed).
export function validateRules(regras, vocab = current()?.vocab ?? {}) {
  const V = { rolls: [...ROLLS, ...(vocab.rolls ?? [])], item: [...ITEM, ...(vocab.itemFilters ?? [])], effect: [...EFFECT, ...(vocab.effects ?? [])], cost: [...COST, ...(vocab.costs ?? [])] };
  if (!Array.isArray(regras) || regras.length > 12) throw fail(400, "err.rules.list");
  const ids = new Set();
  return regras.map((r, i) => {
    const n = i + 1;
    obj(r, n, "rule"); only(r, RULE, n, "rule");
    if (!str(r.id, 60) || !/^[\w-]+$/.test(r.id) || ids.has(r.id)) throw fail(400, "err.rule.id", { n });
    ids.add(r.id);
    if (!str(r.label, 80) || !r.label) throw fail(400, "err.rule.label", { n });
    if (r.text !== undefined && !str(r.text, 500)) throw fail(400, "err.rule.text", { n });
    if (r.auto !== undefined && !str(r.auto, 120)) throw fail(400, "err.rule.auto", { n });
    if (r.supersedes !== undefined && (!strs(r.supersedes) || r.supersedes.length > 10 || r.supersedes.some((x) => !/^[\w-]+$/.test(x)))) throw fail(400, "err.rule.supersedes", { n });
    const w = obj(r.when ?? {}, n, "when"); only(w, WHEN, n, "when");
    if (w.rolls && (!strs(w.rolls) || w.rolls.some((x) => !V.rolls.includes(x)))) throw fail(400, "err.rule.rolls", { n, list: V.rolls.join(", ") });
    for (const k of ["skills", "attributes", "requires"]) if (w[k] !== undefined && !strs(w[k])) throw fail(400, "err.rule.textList", { n, k });
    if (w.situation !== undefined && !str(w.situation, 200)) throw fail(400, "err.rule.situation", { n });
    if (w.item) { const it = obj(w.item, n, "item"); only(it, V.item, n, "item"); for (const [k, v] of Object.entries(it)) if (!(str(v, 60) || strs(v))) throw fail(400, "err.rule.itemField", { n, k }); }
    if (!Array.isArray(r.effects) || r.effects.length > 12) throw fail(400, "err.rule.effects", { n });
    for (const e of r.effects) { obj(e, n, "effect"); only(e, V.effect, n, "effect"); if (JSON.stringify(e).length > 600) throw fail(400, "err.rule.effectBig", { n }); }
    if (r.cost) { const c = obj(r.cost, n, "cost"); only(c, V.cost, n, "cost"); for (const k of ["ap", "luck"]) if (c[k] !== undefined && !(Number.isFinite(c[k]) || str(c[k], 30))) throw fail(400, "err.rule.costField", { n, k }); if (c.uses) { obj(c.uses, n, "uses"); if (!(Number.isFinite(c.uses.max) || str(c.uses.max, 30))) throw fail(400, "err.rule.usesMax", { n }); } }
    return r;
  });
}

const gm = (user) => { if (!user.isGM) throw fail(403, "err.gmOnly"); };
const world = () => game.settings.get(ID, WORLD) ?? {};
const repo = () => loadCatalog(current()?.catalogUrl ?? `modules/${ID}/scripts/systems/${game.system.id}/catalog.json`);
export const keyOf = (item) => { const src = (item._stats?.compendiumSource ?? item.flags?.core?.sourceId ?? "").split(".").pop(); return src || `name:${item.name.toLowerCase()}`; };

export const handlers = {
  // Perks that can have a rule: the catalog's, those already edited in the world and those from the system compendia.
  async listRuleItems(user, { q = "" }) {
    gm(user);
    const w = world(), base = await repo(), out = new Map(), s = String(q).toLowerCase();
    for (const [k, e] of Object.entries(base)) out.set(k, { key: k, name: e.name, count: e.regras.length, source: "default" });
    for (const [k, e] of Object.entries(w)) out.set(k, { key: k, name: e.name, count: e.regras.length, source: "world" });
    for (const { pack: id, types: type } of current()?.rulePacks ?? []) for (const e of (await game.packs.get(id)?.getIndex({ fields: ["type"] })) ?? []) if ((!type || [type].flat().includes(e.type)) && !out.has(e._id)) out.set(e._id, { key: e._id, name: e.name, count: 0, source: "none" });
    return [...out.values()].filter((e) => !s || e.name.toLowerCase().includes(s)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 60);
  },
  async getRules(user, { key }) {
    gm(user);
    const w = world()[key], d = (await repo())[key];
    return { key, name: (w ?? d)?.name ?? "", source: w ? "world" : d ? "default" : "none", regras: (w ?? d)?.regras ?? [], padrao: d?.regras ?? [] };
  },
  async saveRules(user, { key, name, regras }) {
    gm(user);
    if (!str(key, 80) || !key || !str(name, 120) || !name) throw fail(400, "err.rules.keyName");
    await game.settings.set(ID, WORLD, { ...world(), [key]: { name, regras: validateRules(regras) } });
    return { ok: true };
  },
  async resetRules(user, { key }) {
    gm(user);
    const { [key]: _, ...rest } = world();
    await game.settings.set(ID, WORLD, rest);
    return { ok: true };
  }
};
