// D&D 5.5e (system "dnd5e" 5.x, 2024 rules): sheet, native rolls (the system's chat card), game state,
// inventory and spells. Creation and level up (advancements) come in another step.
import { ID, chooseMods, fail, ownedActor, ownedItem, pick, playersFolder, resetUses, spendUses, text, tr } from "../../api.js";
import { auraItems, choicesOf, fxOf, handlers as extraHandlers, healTarget, healApply, pending, poolOf, registerExtras, specialOf } from "./dnd5e-extras.js";

export const LISTED = ["character"];
const ABILITIES = ["str", "dex", "con", "int", "wis", "cha"];
const CURRENCY = ["pp", "gp", "ep", "sp", "cp"];
const GEAR = ["weapon", "equipment", "consumable", "tool", "loot", "container"];
// Foundry enrichers as readable text. A compendium link becomes "⟦Name|uuid⟧", which the app shows as a link to the item.
const coin = (c) => { const k = `dnd.coin.${c}`, v = tr(k); return v === k ? c : v; }; // coin abbreviations (dnd.coin.<pp|gp|ep|sp|cp>)
const nameOf = (uuid) => { try { return fromUuidSync(uuid)?.name; } catch { return null; } };
// &Reference[condition=bloodied] / [Bloodied]: with no label, looks up lowercase in the dnd5e conditions and properties and localizes; otherwise returns the readable name.
const refLabel = (inner) => {
  const k = inner.trim().split(/\s+/)[0].replace(/^\w+=/, ""), low = k.toLowerCase(), D = CONFIG.DND5E;
  const l = D.conditionTypes?.[low]?.label ?? D.conditionTypes?.[k]?.label ?? D.itemProperties?.[low]?.label ?? D.weaponProperties?.[low]?.label;
  return l ? game.i18n.localize(l) : k.replace(/([a-z])([A-Z])/g, "$1 $2");
};
const enrich = (s) => String(s ?? "")
  .replace(/@Embed\[[^\]]*\](\{[^}]*\})?/g, "")
  .replace(/@UUID\[([^\]]+)\](?:\{([^}]*)\})?/g, (_, uuid, label) => { const n = label || nameOf(uuid) || uuid.split(".").pop(); return uuid.startsWith("Compendium.") ? `⟦${n}|${uuid}⟧` : n; })
  .replace(/\[\[\/award\s+([^\]]+)\]\]/gi, (_, a) => a.replace(/(\d+)\s*(pp|gp|ep|sp|cp)\b/gi, (m, n, c) => `${n} ${coin(c.toLowerCase())}`).replace(/\bxp\b/i, "XP"))
  .replace(/\[\[\/\w+\s+([^\]]*?)\]\](?:\{([^}]*)\})?/g, (_, f, label) => label || f.replace(/\s*\b(type|average|extended|format)=\S+/gi, "").trim())
  .replace(/\[\[([^\]]+)\]\]/g, "$1")
  .replace(/&(?:amp;)?Reference\[([^\]]*)\](?:\{([^}]*)\})?/g, (_, inner, label) => label || refLabel(inner))
  .replace(/@(?:Check|Save|Attack|Damage|Item|Lookup)\[([^\]]+)\](?:\{([^}]*)\})?/g, (_, inner, label) => label || inner.replace(/\s*\b\w+=/g, " ").trim());
const lines = (html) => text(enrich(html).replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, "$&\n")).replace(/\n\s*\n+/g, "\n");
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const sorted = (a, type) => a.items.filter((i) => (Array.isArray(type) ? type.includes(i.type) : i.type === type)).sort((x, y) => (x.sort - y.sort) || x.name.localeCompare(y.name));

const classes = (a) => Object.values(a.classes ?? {}).map((c) => ({
  id: c.id, name: c.name, identifier: c.identifier, level: c.system.levels, subclass: c.subclass?.name ?? null,
  hd: { denomination: c.system.hd?.denomination ?? "", value: c.system.hd?.value ?? 0, max: c.system.hd?.max ?? 0 }
}));
export const summary = (a) => ({
  id: a.id, name: a.name, type: a.type, level: a.system.details?.level ?? 0,
  classes: classes(a).map((c) => `${c.name} ${c.level}`).join(" / "),
  hp: { value: a.system.attributes.hp.value ?? 0, max: a.system.attributes.hp.max ?? 0 }
});

const uses = (u) => (u?.max ? { value: u.value ?? 0, max: u.max, spent: u.spent ?? 0 } : null);
const activities = (i) => (i.system.activities?.contents ?? []).map((x) => ({
  id: x.id, type: x.type, name: x.name || x.constructor.metadata?.label || x.type, activation: x.labels?.activation ?? "",
  toHit: x.labels?.toHit ?? null, damage: (x.labels?.damage ?? []).map((d) => d.label), save: x.save?.dc?.value ? { ability: [...(x.save.ability ?? [])], dc: x.save.dc.value } : null
}));
// Attacks of the sheet and the GM panel: items with an attack activity (weapon only if equipped, no spells).
const attacksOf = (a) => a.items.filter((i) => i.system.activities?.some?.((x) => x.type === "attack") && (i.type !== "weapon" || i.system.equipped) && i.type !== "spell")
  .map((i) => ({ id: i.id, name: i.name, activities: activities(i).filter((x) => x.type === "attack") }));
// Icons allowed in the GM panel effects (Foundry core) and timed effects (no conditions or passive item effects).
const FX_ICONS = ["aura", "angel", "fire", "shield", "mage-shield", "sword", "skull", "poison", "lightning", "ice-aura", "heal", "eye", "upgrade", "downgrade", "sleep", "paralysis", "regen", "degen", "target", "net"].map((n) => `icons/svg/${n}.svg`);
const timedFx = (a) => a.effects.filter((e) => e.isTemporary && !e.statuses.size && !e.disabled);
const fxLeft = (e) => { const d = e.duration, r = d.remaining; return r == null || !Number.isFinite(r) ? null : Math.max(0, d.type === "seconds" ? Math.ceil(r / 6) : Math.ceil(r)); };
const sheet = (a) => {
  const s = a.system, at = s.attributes, d = s.details;
  return {
    ...summary(a),
    classes: classes(a), species: d.race?.name ?? (typeof d.race === "string" ? d.race : ""), background: d.background?.name ?? (typeof d.background === "string" ? d.background : ""),
    alignment: d.alignment ?? "", xp: { value: d.xp?.value ?? 0, max: d.xp?.max ?? null }, prof: at.prof,
    abilities: ABILITIES.map((k) => ({ key: k, value: s.abilities[k].value, mod: s.abilities[k].mod, save: s.abilities[k].save?.value ?? s.abilities[k].mod, saveProf: !!s.abilities[k].proficient })),
    skills: Object.entries(s.skills).map(([k, v]) => ({ key: k, ability: v.ability, prof: v.value ?? 0, total: v.total, passive: v.passive })),
    ac: at.ac?.value ?? 10, init: at.init?.total ?? at.init?.mod ?? 0, speed: { walk: at.movement?.walk ?? 0, fly: at.movement?.fly ?? 0, swim: at.movement?.swim ?? 0, climb: at.movement?.climb ?? 0, units: at.movement?.units ?? "ft" },
    darkvision: at.senses?.darkvision ?? 0, size: CONFIG.DND5E.actorSizes[s.traits?.size]?.label ?? s.traits?.size ?? "",
    hp: { value: at.hp.value ?? 0, max: at.hp.max ?? 0, temp: at.hp.temp ?? 0, tempmax: at.hp.tempmax ?? 0 },
    hd: { value: at.hd?.value ?? 0, max: at.hd?.max ?? 0 },
    death: { success: at.death?.success ?? 0, failure: at.death?.failure ?? 0 },
    inspiration: !!at.inspiration, exhaustion: at.exhaustion ?? 0,
    conditions: [...a.statuses],
    spellcasting: at.spellcasting ? { ability: at.spellcasting, dc: at.spell?.dc ?? null, attack: at.spell?.attack ?? null } : null,
    slots: [...Array.fromRange(9, 1).map((l) => ({ key: `spell${l}`, level: l, value: s.spells[`spell${l}`]?.value ?? 0, max: s.spells[`spell${l}`]?.max ?? 0 })),
      { key: "pact", level: s.spells.pact?.level ?? 0, value: s.spells.pact?.value ?? 0, max: s.spells.pact?.max ?? 0 }].filter((x) => x.max > 0),
    spells: sorted(a, "spell").map((i) => ({
      id: i.id, name: i.name, level: i.system.level, school: i.labels?.school ?? "", prepared: i.system.prepared ?? 0, method: i.system.method ?? "",
      components: i.labels?.components?.vsm ?? "", concentration: i.system.properties?.has?.("concentration") ?? false, ritual: i.system.properties?.has?.("ritual") ?? false,
      activation: i.labels?.activation ?? "", range: i.labels?.range ?? "", duration: i.labels?.duration ?? "", activities: activities(i), description: lines(i.system.description?.value)
    })),
    attacks: attacksOf(a),
    gear: sorted(a, GEAR).map((i) => ({
      id: i.id, name: i.name, type: i.type, quantity: i.system.quantity ?? 1, equipped: !!i.system.equipped, weight: i.system.weight?.value ?? 0,
      attuned: !!i.system.attuned, attunement: i.system.attunement ?? "", uses: uses(i.system.uses), activities: activities(i), description: lines(i.system.description?.value)
    })),
    pending: pending(a),
    features: sorted(a, "feat").map((i) => ({ id: i.id, name: i.name, special: specialOf(i), choices: choicesOf(i), pool: poolOf(a, i), kind: i.system.type?.value ?? "", uses: uses(i.system.uses), activities: activities(i), description: lines(i.system.description?.value) })),
    currency: Object.fromEntries(CURRENCY.map((k) => [k, s.currency?.[k] ?? 0])),
    encumbrance: { value: at.encumbrance?.value ?? 0, max: at.encumbrance?.max ?? 0 },
    languages: s.traits.languages?.labels?.languages ?? [],
    traits: { armor: [...(s.traits.armorProf?.value ?? [])], weapons: [...(s.traits.weaponProf?.value ?? [])], tools: Object.keys(s.tools ?? {}) },
    bio: {
      biography: lines(d.biography?.value), appearance: d.appearance ?? "", trait: d.trait ?? "", ideal: d.ideal ?? "", bond: d.bond ?? "", flaw: d.flaw ?? "",
      age: d.age ?? "", height: d.height ?? "", weight: d.weight ?? "", eyes: d.eyes ?? "", skin: d.skin ?? "", hair: d.hair ?? "", gender: d.gender ?? "", faith: d.faith ?? ""
    }
  };
};

// Fields the app can change (the relay user is a GM: everything outside this is refused).
const int = (min, max) => (v, l) => pick(v, undefined, min, max, l) ?? (() => { throw fail(400, "dnd.err.valueMissing", { label: l }); })();
const str = (max) => (v, l) => { if (typeof v !== "string" || v.length > max) throw fail(400, "dnd.err.badText", { label: l }); return v; };
const bool = (v, l) => { if (typeof v !== "boolean") throw fail(400, "dnd.err.badBool", { label: l }); return v; };
const BIO = ["appearance", "trait", "ideal", "bond", "flaw", "age", "height", "weight", "eyes", "skin", "hair", "gender", "faith", "alignment"];
const fields = (a) => ({
  name: (v) => { v = str(80)(v, tr("dnd.lbl.name")).trim(); if (!v) throw fail(400, "dnd.err.nameEmpty"); return v; },
  "system.attributes.hp.value": int(0, Math.max(0, a.system.attributes.hp.max ?? 0)),
  "system.attributes.hp.temp": int(0, 999),
  "system.attributes.hp.tempmax": int(-999, 999),
  "system.attributes.inspiration": bool,
  "system.attributes.death.success": int(0, 3),
  "system.attributes.death.failure": int(0, 3),
  "system.attributes.exhaustion": int(0, 6),
  "system.details.xp.value": int(0, 999999),
  ...Object.fromEntries(ABILITIES.map((k) => [`system.abilities.${k}.value`, int(1, 30)])),
  ...Object.fromEntries(CURRENCY.map((k) => [`system.currency.${k}`, int(0, 9999999)])),
  ...Object.fromEntries([...Array.fromRange(9, 1).map((l) => `spell${l}`), "pact"].map((k) => [`system.spells.${k}.value`, int(0, a.system.spells[k]?.max ?? 0)])),
  ...Object.fromEntries(BIO.map((k) => [`system.details.${k}`, str(5000)])),
  // biography: the system stores HTML; the app sends text and each line becomes a paragraph
  "system.details.biography.value": (v, l) => str(20000)(v, l).split(/\n+/).filter((x) => x.trim()).map((x) => `<p>${esc(x)}</p>`).join("\n")
});
const ITEM_FIELDS = {
  equipped: (i, v) => { if (!GEAR.includes(i.type)) throw fail(400, "dnd.err.notEquippable"); return { "system.equipped": bool(v, tr("dnd.lbl.equipped")) }; },
  attuned: (i, v) => { if (!i.system.attunement) throw fail(400, "dnd.err.noAttunement"); return { "system.attuned": bool(v, tr("dnd.lbl.attuned")) }; },
  quantity: (i, v) => { if (!GEAR.includes(i.type)) throw fail(400, "dnd.err.noQuantity"); return { "system.quantity": int(0, 99999)(v, tr("dnd.lbl.quantity")) }; },
  prepared: (i, v) => { if (i.type !== "spell" || i.system.prepared === 2) throw fail(400, "dnd.err.notPreparable"); return { "system.prepared": bool(v, tr("dnd.lbl.prepared")) ? 1 : 0 }; },
  usesSpent: (i, v) => { if (!i.system.uses?.max) throw fail(400, "dnd.err.noUses"); return { "system.uses.spent": int(0, i.system.uses.max)(v, tr("dnd.lbl.usesSpent")) }; }
};

// Roll result for the app (the full card goes to the Foundry chat).
const CRIT_KINDS = ["attack", "death"];
const out = (r, kind, label) => {
  const rolls = [r].flat().filter(Boolean), roll = rolls[0]; // damage with several parts (or a bonus die) comes in more than one roll: sums everything
  if (!roll) return { kind, label, cancelled: true };
  const d20 = roll.dice?.find((d) => d.faces === 20);
  return { kind, label, total: rolls.reduce((t, x) => t + x.total, 0), formula: rolls.map((x) => x.formula).join(" + "), dice: rolls.flatMap((x) => x.dice ?? []).flatMap((d) => d.results.map((x) => ({ faces: d.faces, result: x.result, active: x.active !== false }))),
    critical: !!(d20 && roll.isCritical && CRIT_KINDS.includes(kind)), fumble: !!(d20 && roll.isFumble && CRIT_KINDS.includes(kind)) }; // only attack and death saves have "critical/fumble"; a 1 on a skill check is just a 1
};
const modeOf = (mode) => ({ advantage: mode === "adv", disadvantage: mode === "dis" });
const situational = (bonus) => (bonus ? { rolls: [{ data: { situational: Number(bonus) }, parts: ["@situational"] }] } : {});
const DIALOG = { configure: false }, MESSAGE = { create: true };


// ---------- Roll modifiers (feats and features) ----------
const PROP = { fin: "finesse", lgt: "light", two: "twoHanded", ver: "versatile", hvy: "heavy", thr: "thrown", rch: "reach", amm: "ammunition", mgc: "magical", ret: "returning" };
const WTYPE = { simpleM: ["simpleMelee", "melee"], martialM: ["martialMelee", "melee"], simpleR: ["simpleRanged", "ranged"], martialR: ["martialRanged", "ranged"] };
// Which rules apply to each roll: attacks only the ones that touch the d20; damage only the ones that touch the damage or create rolls.
const HEALDICE = (v) => typeof v === "string" && /dados de cura/i.test(v); // Healer (reroll 1) and Supreme Healing (maximum): applied to the healing roll
const touchesDamage = (r) => r.effects.some((e) => (e.add === "damage") || e.extraRoll || e.autoCrit || e.replace || HEALDICE(e.reroll));
const touchesD20 = (r) => r.effects.some((e) => e.mode || (e.add && e.add !== "damage") || e.reroll || e.set || e.dice);
const keepFor = (isDamage) => (r) => (isDamage ? touchesDamage(r) : touchesD20(r)) || r.effects.every((e) => e.other || e.grant);

// Engine context for the roll requested by the app (never comes ready-made from the app).
export function modContext(a, { kind, key, itemId, activityId, action }) {
  const S = a.system, fx = fxOf(a); // fx: active forms (Starry/Martial Form) for when.requires
  if (itemId) {
    const i = ownedItem(a, itemId), act = activityId ? i.system.activities?.get(activityId) : i.system.activities?.contents[0];
    const save = act?.type === "save" || !!act?.save, heal = action === "heal", dmg = action === "damage" || heal, spell = i.type === "spell", w = i.type === "weapon";
    const props = [...(i.system.properties ?? [])].map((p) => PROP[p] ?? p), wt = w ? WTYPE[i.system.type?.value] ?? [] : [];
    const range = act?.attack?.type?.value ?? (wt.includes("ranged") ? "ranged" : "melee");
    const types = [...new Set((heal ? [act?.healing] : act?.damage?.parts ?? []).flatMap((p) => [...(p.types ?? [])]))];
    const natural = w && i.system.type?.value === "natural" || /desarmado|unarmed/i.test(i.name);
    const school = spell ? [i.system.school].filter(Boolean) : [];
    return { fx, evalMax: maxOf(a), keep: keepFor(dmg), roll: [heal ? "heal" : dmg ? "damage" : "attack", ...(spell ? ["spell"] : [])], attribute: act?.ability || i.system.ability || undefined,
      item: { weaponType: [...(w ? ["weapon", ...wt] : []), ...(natural ? ["unarmed"] : []), ...(spell ? ["spell"] : [])], range: [range], damageType: types,
        tags: [...props, range, ...(w ? ["weapon"] : []), ...(save ? ["salvaguarda"] : []), ...(spell ? ["spell", "magia", ...school, ...(i.system.level === 0 ? ["cantrip"] : [])] : [])] } };
  }
  const ev = { fx, evalMax: maxOf(a), ...(kind === "save" ? { virtual: auraItems(a) } : {}) }; // a nearby allied Paladin's aura comes in as a borrowed feat
  if (kind === "skill") return { ...ev, roll: ["skill", "check"], skill: key, attribute: S.skills[key]?.ability };
  if (kind === "init") return { ...ev, roll: "initiative", attribute: "dex" };
  return { ...ev, roll: kind === "death" ? "death" : kind, attribute: key };
}

// Formula variables (@prof, @int, @bardicDie…) resolved with the actor's data; dice (1d6) stay as they are. null = could not compute.
const ALIAS = [[/@(str|dex|con|int|wis|cha)\b/g, "@abilities.$1.mod"], [/@level\b/g, "@details.level"], [/@(bardicDie|bardicInspiration)\b/g, "@scale.bard.inspiration"], [/@(martialArtsDie|martialArts|scale\.monk\.die)\b/g, "@scale.monk.die"],
  [/@rageDamage\b/g, "@scale.barbarian.rage-damage"], [/@scale\.barbarian\.brutal\b/g, "@scale.barbarian.golpe-brutal"], [/@scale\.barbarian\.rage\b/g, "@scale.barbarian.usos-de-furia"], [/@scale\.rogue\.sneak\b/g, "@scale.rogue.ataque-furtivo"]];
function formulaFor(a, f) {
  let t = String(f).replace(/\s+\([^()]*\s[^()]*\)\s*$/, "").replace(/1d@bardicDie/g, "@bardicDie"); // a trailing " (explanation with spaces)" is dropped, "floor(@x/2)" stays; the scale die already carries the "d"
  const lv = (c) => a.classes?.[c]?.system?.levels ?? 0; // dnd5e 5.x: levels live on the class item, not in system.classes
  t = t.replace(/@starD8\b/g, (a.system.details?.level ?? 0) >= 10 ? "2d8" : "1d8").replace(/@(superiorityDie|sd)\b/g, lv("fighter") >= 18 ? "1d12" : lv("fighter") >= 10 ? "1d10" : "1d8").replace(/@(psionicDie|psi)\b/g, lv("fighter") >= 17 ? "1d12" : lv("fighter") >= 11 ? "1d10" : lv("fighter") >= 5 ? "1d8" : "1d6");
  for (const [re, to] of ALIAS) t = t.replace(re, to);
  t = Roll.replaceFormulaData(t, a.getRollData(), { missing: "?" });
  return /[?@]/.test(t) || !Roll.validate(t) ? null : t;
}
// The rule's resolved formula to show in the popup ("1d8 + 3"); only when it differs from the original text. null = nothing to show.
export const modPreview = (a, effects) => { const raw = (effects ?? []).map((e) => e.formula ?? e.extraRoll?.formula).filter(Boolean).map(String), f = raw.map((r) => formulaFor(a, r)); return f.every((x) => x != null) && f.join(" + ") !== raw.join(" + ") && f.length ? f.join(" + ") : null; };
const maxOf = (a) => (v) => { const n = calcNum(a)(v); return Number.isFinite(n) ? Math.max(1, Math.floor(n)) : null; }; // maximum uses as a formula (minimum 1)
const calcNum = (a) => (v) => { const t = formulaFor(a, v); try { return t == null ? NaN : Roll.create(t).evaluateSync().total; } catch { return NaN; } };

// Validates the selected rules and turns them into: mode (advantage/disadvantage), parts to add, automatic crit, extra rolls and warnings.
async function applyMods(a, ctx, keys) {
  const srcOf = (e) => ctx.virtual?.find((v) => e.from.startsWith(`${v.id}:`))?.srcActor; // aura effect: the formula uses the data of whoever emits the aura
  const m = await chooseMods(a, ctx, keys, {}, calcNum(a));
  const onlyNote = (k) => !m.effects.some((e) => e.from === k) && !m.cost.uses.some((u) => `${u.itemId}:${u.ruleId}` === k) ; // no applied effect or cost: warning only
  const out = { adv: false, dis: false, parts: [], crit: false, healMax: false, healR1: false, extra: [], notes: m.notes.map((n) => n.other), used: m.chosen.map((c) => ({ ...c, onlyNote: onlyNote(c.key) })), cost: m.cost };
  const dmgCtx = [ctx.roll].flat().some((r) => ["damage", "heal", "soak"].includes(r));
  for (const e of m.effects) {
    const rule = m.chosen.find((c) => c.key === e.from), note = () => { const n = `${rule.itemName}: ${rule.text}`; if (!out.notes.includes(n)) out.notes.push(n); };
    if (e.mode === "adv") out.adv = true;
    else if (e.mode === "dis") out.dis = true;
    else if (e.autoCrit) out.crit = true;
    else if ([ctx.roll].flat().includes("heal") && HEALDICE(e.reroll) && /\b1\b/.test(e.reroll)) out.healR1 = true;
    else if ([ctx.roll].flat().includes("heal") && HEALDICE(e.replace) && /m[aá]ximo/i.test(e.replace)) out.healMax = true;
    else if (e.add && e.formula != null) {
      const f = formulaFor(srcOf(e) ?? a, e.formula);
      if (f == null) note();
      else if ((e.add === "damage") === dmgCtx || (dmgCtx && e.add === "result")) out.parts.push(f); // damage adds to damage; the rest adds to the d20
      else if (e.add !== "damage") out.parts.push(f);
    } else if (e.extraRoll) { const f = formulaFor(a, e.extraRoll.formula); if (f == null) note(); else out.extra.push({ label: e.extraRoll.label, formula: f }); }
    else note(); // value swap, reroll, die replacement…: the player applies it
  }
  return out;
}
// Extra rolls and chat warning; then charges the uses.
async function finishMods(a, m, user) {
  const extra = [];
  for (const x of m.extra) { const r = await new Roll(x.formula, a.getRollData()).evaluate(); await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: a }), flavor: x.label }); extra.push({ label: x.label, total: r.total, formula: r.formula }); }
  const E = foundry.utils.escapeHTML, used = m.used.filter((u) => !u.onlyNote), warn = m.used.filter((u) => u.onlyNote).map((u) => `${u.itemName}: ${u.label}`);
  if (m.used.length || m.notes.length) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `${used.length ? `<p><b>${tr("mod.used")}:</b> ${used.map((u) => `${E(u.itemName)}: ${E(u.label)}`).join("; ")}</p>` : ""}${warn.length ? `<p><b>${tr("mod.warn")}:</b> ${warn.map(E).join("; ")}</p>` : ""}${m.notes.map((n) => `<p><em>${E(n)}</em></p>`).join("")}` });
  await spendUses(a, m.cost);
  return { mods: { used: used.map((u) => `${u.itemName}: ${u.label}`), warn, notes: m.notes, extra } };
}
// Healer/Supreme Healing: rewrites the dice of the healing parts for this roll only (r1 = reroll 1 once; maximum swaps NdF for (N*F)).
// API doubt (dnd5e 5.3.3 is not local): assumes the dnd5e.preRollDamageV2 hook with config.rolls[].parts; if no part matches, it becomes a chat warning.
async function withHealDice(act, m, fn) {
  if (!m.healMax && !m.healR1) return fn();
  let hit = false;
  const id = Hooks.on("dnd5e.preRollDamageV2", (config) => {
    if (config.subject && config.subject.uuid !== act.uuid) return;
    for (const r of config.rolls ?? []) r.parts = (r.parts ?? []).map((p) => String(p).replace(/(\d+)d(\d+)(?![\dr])/g, (_, n, f) => { hit = true; return m.healMax ? `(${n}*${f})` : `${n}d${f}r1`; }));
  });
  try { return await fn(); } finally {
    Hooks.off("dnd5e.preRollDamageV2", id);
    if (!hit) m.notes.push(tr(m.healMax ? "dnd.note.healMax" : "dnd.note.healR1"));
  }
}
const modeWith = (mode, m) => ({ advantage: (mode === "adv" || m.adv) && !(mode === "dis" || m.dis), disadvantage: (mode === "dis" || m.dis) && !(mode === "adv" || m.adv) });
const withParts = (bonus, parts) => (bonus || parts.length ? { rolls: [{ parts: [...(bonus ? ["@situational"] : []), ...parts], data: bonus ? { situational: Number(bonus) } : {} }] } : {});

// Use reset on rest and per turn (only the relay client does it, to avoid repeating).
export function register() {
  const mine = () => game.user.name === game.settings.get(ID, "relayUser");
  registerExtras(mine);
  Hooks.on("dnd5e.restCompleted", async (actor, result) => { if (mine()) await resetUses(actor, result.longRest ? ["sr", "lr", "turn"] : ["sr"]); });
  Hooks.on("combatTurnChange", async (combat, prior, current) => { const a = mine() && combat.combatants.get(current.combatantId)?.actor; if (a) await resetUses(a, ["turn"]); });
}

// ---------- Creation and level up through dnd5e's Advancement system, without UI ----------
// Stateless protocol: the app sends the choices made so far ({ "<advId>.<level>": data }); the module redoes everything on a
// clone of the actor (AdvancementManager), returns the next pending choice and, with commit, saves like the system's #complete.
const MGR = () => dnd5e.applications.advancement.AdvancementManager;
// World content compendium: translated copies keep the original UUID in flags.world.conteudo2024.source.
// The app hides the originals that were already copied so nothing shows up duplicated in creation, level up and search.
const sourceOf = (d) => d?.flags?.world?.conteudo2024?.source ?? null; // which system item the world content came from
// All content comes from the world compendia; the system packs are no longer read.
const ORIGIN_PACKS = () => game.packs.filter((p) => p.documentName === "Item" && p.collection.startsWith("world."));
async function catalog(types) {
  const out = [];
  for (const p of ORIGIN_PACKS()) {
    const idx = await p.getIndex({ fields: ["type", "system.classIdentifier", "system.identifier", "system.type", "system.prerequisites"] });
    for (const e of idx) if (types.includes(e.type)) out.push({ uuid: e.uuid, name: e.name, type: e.type, classIdentifier: e.system?.classIdentifier ?? null, featType: e.system?.type ?? null, prerequisites: e.system?.prerequisites ?? null });
  }
  return out.sort((x, y) => x.name.localeCompare(y.name));
}
const leaves = (choices, out = []) => {
  for (const [k, v] of Object.entries(choices ?? {})) {
    if (v.children && Object.keys(v.children).length) leaves(v.children, out);
    if (v.selectable !== false && !v.chosen && !(v.children && Object.keys(v.children).length)) out.push({ key: k, label: v.label });
  }
  return out;
};
const advKey = (adv, lvl) => `${adv.id}.${lvl}`;
// ItemChoice with an empty list: the options come from the restriction (class spell lists + level, or feat type).
async function restrictedPool(cfg, clone) {
  const r = cfg.restriction ?? {};
  if (cfg.type === "spell") {
    const uuids = new Set([...(r.list ?? [])].flatMap((k) => { const [type, id] = k.split(":"); try { return [...(dnd5e.registry.spellLists.forType(type, id)?.uuids ?? [])]; } catch { return []; } }));
    const maxLevel = Math.max(0, ...Object.values(clone.system.spells ?? {}).filter((s) => s?.max > 0).map((s) => s.level ?? 0));
    const want = r.level === "available" ? (l) => l > 0 && l <= maxLevel : r.level !== "" && r.level != null ? (l) => l === Number(r.level) : () => true;
    const out = [];
    for (const p of game.packs.filter((p) => p.documentName === "Item" && p.collection.startsWith("world."))) {
      const idx = await p.getIndex({ fields: ["type", "system.level", "flags.world.conteudo2024.source"] });
      // the system's spell lists point to the originals: the copy counts by its source UUID
      for (const e of idx) if (e.type === "spell" && (!uuids.size || uuids.has(e.uuid) || uuids.has(sourceOf(e))) && want(e.system?.level ?? 0)) out.push({ uuid: e.uuid, source: sourceOf(e), name: e.name, level: e.system?.level ?? 0 });
    }
    return out.sort((x, y) => x.level - y.level || x.name.localeCompare(y.name));
  }
  if (cfg.type === "feat") return (await catalog(["feat"])).filter((f) => f.featType?.value === (r.type || "feat") && (!r.subtype || f.featType?.subtype === r.subtype)).map(({ uuid, name }) => ({ uuid, name }));
  return [];
}
const typeOf = (adv) => adv.constructor.name.replace("Advancement", "");

async function describe(adv, lvl, clone) {
  const base = { key: advKey(adv, lvl), type: typeOf(adv), title: adv.title, item: adv.item.name, level: lvl, hint: lines(adv.hint ?? "") };
  const cfg = adv.configuration;
  switch (base.type) {
    case "HitPoints": return { ...base, die: adv.hitDieValue, average: Math.floor(adv.hitDieValue / 2) + 1, con: clone.system.abilities.con.mod };
    case "Trait": {
      const av = await adv.availableChoices();
      const count = (cfg.choices ?? []).reduce((n, c) => n + (c.count ?? 0), 0);
      const granted = new Set(cfg.grants ?? []);
      return { ...base, label: av?.label ?? "", count, options: leaves(av?.choices).filter((o) => !granted.has(o.key)), grants: [...(cfg.grants ?? [])].map((k) => dnd5e.documents.Trait.keyLabel(k)) };
    }
    case "ItemChoice": {
      const count = cfg.choices?.[lvl]?.count ?? 0;
      // Like the AdvancementManager: what the actor already has does not come back as an option, unless it is repeatable (e.g. Agonizing Blast).
      // (applies to items from the original or the translated copy: compares both UUIDs)
      const owned = new Set([...clone.items].flatMap((i) => [i._stats?.compendiumSource, i.flags?.core?.sourceId, sourceOf(i)]).filter(Boolean));
      const has = (uuid, src) => owned.has(uuid) || (!!src && owned.has(src));
      const options = (cfg.pool?.length
        ? (await Promise.all(cfg.pool.map(async ({ uuid }) => { const d = await fromUuid(uuid); return d && (!has(uuid, sourceOf(d)) || d.system.prerequisites?.repeatable) ? { uuid, name: d.name, description: lines(d.system.description?.value).slice(0, 1200) } : null; }))).filter(Boolean)
        : (await restrictedPool(cfg, clone)).filter((o) => !has(o.uuid, o.source))); // long lists (spells): name and level only; the app fetches the text if needed
      const abilities = [...(cfg.spell?.ability ?? [])];
      return { ...base, count, options, spellAbilities: abilities.length > 1 ? abilities : [] };
    }
    case "ItemGrant": {
      const abilities = [...(cfg.spell?.ability ?? [])];
      return { ...base, spellAbilities: abilities.length > 1 ? abilities : [], options: (await Promise.all((cfg.items ?? []).map(async ({ uuid, optional }) => { const d = await fromUuid(uuid); return d ? { uuid, name: d.name, optional: !!(cfg.optional && optional), description: lines(d.system.description?.value).slice(0, 1200) } : null; }))).filter(Boolean) };
    }
    case "AbilityScoreImprovement": {
      const feats = adv.allowFeat ? (await catalog(["feat"])).filter((f) => f.featType?.value === "feat" && ["general", ""].includes(f.featType?.subtype ?? "") && (f.prerequisites?.level ?? 0) <= (clone.system.details.level || 1)) : [];
      return { ...base, points: cfg.points, cap: cfg.cap, locked: [...(cfg.locked ?? [])], abilities: ABILITIES.map((k) => ({ key: k, value: clone.system.abilities[k].value, max: Math.max(clone.system.abilities[k].max ?? 20, cfg.max ?? 0), canImprove: adv.canImprove(k) })), allowFeat: !!adv.allowFeat, feats: feats.map(({ uuid, name }) => ({ uuid, name })) };
    }
    case "Subclass": return { ...base, options: (await catalog(["subclass"])).filter((s) => s.classIdentifier === adv.item.identifier).map(({ uuid, name }) => ({ uuid, name })) };
    case "Size": return { ...base, options: [...(cfg.sizes ?? [])].map((k) => ({ key: k, label: CONFIG.DND5E.actorSizes[k]?.label ?? k })) };
    default: return base;
  }
}
// Validates the app's choice and turns it into the format of each type's apply().
async function decide(adv, lvl, dec, clone, commit) {
  const d = await describe(adv, lvl, clone), bad = (k, p) => fail(400, `dnd.err.${k}`, { title: adv.title, ...p });
  switch (d.type) {
    case "HitPoints": {
      if (dec?.mode === "roll") {
        if (!commit) return { [lvl]: "avg" }; // only really rolls when saving (otherwise every query would roll again)
        const r = await new Roll(`1d${d.die}`).evaluate();
        await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: clone }), flavor: tr("dnd.chat.hpLevel", { item: adv.item.name, level: lvl }) });
        return { [lvl]: r.total };
      }
      if (dec?.mode !== "avg") throw bad("advMode");
      return { [lvl]: "avg" };
    }
    case "Trait": {
      const chosen = Array.isArray(dec?.chosen) ? [...new Set(dec.chosen)] : [];
      if (chosen.length !== d.count || chosen.some((k) => !d.options.some((o) => o.key === k))) throw bad("advPick", { n: d.count });
      return { chosen: [...(adv.configuration.grants ?? []), ...chosen] };
    }
    case "ItemChoice": {
      const sel = Array.isArray(dec?.selected) ? [...new Set(dec.selected)] : [];
      if (sel.length !== d.count || sel.some((u) => !d.options.some((o) => o.uuid === u))) throw bad("advPick", { n: d.count });
      if (d.spellAbilities.length && !d.spellAbilities.includes(dec?.ability)) throw bad("advSpellAbility");
      return { selected: sel, ...(d.spellAbilities.length ? { ability: dec.ability } : {}) };
    }
    case "ItemGrant": {
      const sel = Array.isArray(dec?.selected) ? dec.selected : [];
      if (sel.some((u) => !d.options.some((o) => o.uuid === u))) throw bad("advOption");
      if (d.spellAbilities.length && !d.spellAbilities.includes(dec?.ability)) throw bad("advSpellAbility");
      return { selected: [...new Set([...d.options.filter((o) => !o.optional).map((o) => o.uuid), ...sel])], ...(d.spellAbilities.length ? { ability: dec.ability } : {}) };
    }
    case "AbilityScoreImprovement": {
      if (dec?.type === "feat") {
        if (!d.allowFeat || !d.feats.some((f) => f.uuid === dec.uuid)) throw bad("advFeat");
        return { type: "feat", uuid: dec.uuid };
      }
      const asg = dec?.assignments ?? {}, vals = Object.entries(asg).filter(([, v]) => v);
      const sum = vals.reduce((n, [, v]) => n + v, 0);
      if (sum !== d.points || vals.some(([k, v]) => !Number.isInteger(v) || v < 0 || v > d.cap || d.locked.includes(k) || !d.abilities.find((x) => x.key === k)?.canImprove)) throw bad("advAsi", { points: d.points, cap: d.cap });
      return { type: "asi", assignments: Object.fromEntries(vals) };
    }
    case "Subclass": if (!d.options.some((o) => o.uuid === dec?.uuid)) throw bad("advSubclass"); return { uuid: dec.uuid };
    case "Size": if (!d.options.some((o) => o.key === dec?.size)) throw bad("advSize"); return { size: dec.size };
    default: return {};
  }
}
async function runAdvancement(user, a, { uuid, classId }, decisions = {}, commit = false) {
  let m;
  if (classId) m = MGR().forLevelChange(a, ownedItem(a, classId, "class").id, 1);
  else {
    const doc = typeof uuid === "string" && uuid.startsWith("Compendium.") ? await fromUuid(uuid) : null;
    if (!doc || !["class", "background", "race"].includes(doc.type)) throw fail(400, "dnd.err.pickOrigin");
    if (doc.type !== "class" && a.items.some((i) => i.type === doc.type)) throw fail(400, doc.type === "race" ? "dnd.err.hasSpecies" : "dnd.err.hasBackground");
    if (doc.type === "class" && a.items.some((i) => i.type === "class" && i.identifier === doc.system.identifier)) throw fail(400, "dnd.err.hasClass");
    m = MGR().forNewItem(a, game.items.fromCompendium(doc));
  }
  const clone = m.clone, steps = [...m.steps], done = [];
  for (let i = 0; i < steps.length; i++) {
    const st = steps[i];
    if (st.class) st.class.item.updateSource({ "system.levels": st.class.level });
    const f = st.flow; if (!f) continue;
    const adv = f.advancement, lvl = f.level, key = advKey(adv, lvl), before = new Set(clone.items.keys());
    let data = await adv.automaticApplicationValue?.(lvl);
    // ItemChoice with no choice at this level (only the option to swap an old choice): proceeds without asking.
    // shortcut: swapping old choices (replacement) is not offered in the app; use the Foundry sheet for that.
    if ((data === false || data == null) && typeOf(adv) === "ItemChoice" && !(adv.configuration.choices?.[lvl]?.count)) data = { selected: [] };
    if (data === false || data == null) {
      if (!Object.hasOwn(decisions, key)) return { pending: await describe(adv, lvl, clone), done, remaining: steps.length - i };
      data = await decide(adv, lvl, decisions[key], clone, commit);
    }
    await adv.apply(lvl, data);
    done.push({ key, title: adv.title, item: adv.item.name });
    // new items with their own advancements (subclass, granted feat) get their steps, like #synthesizeSteps
    for (const id of clone.items.keys()) {
      if (before.has(id)) continue;
      const it = clone.items.get(id);
      if (!it.advancement?.byId || !Object.keys(it.advancement.byId).length) continue;
      const cur = it.type === "subclass" ? (it.class?.system.levels ?? 1) : MGR().currentLevel(it, clone);
      steps.splice(i + 1, 0, ...Array.fromRange(cur + 1).flatMap((l) => MGR().flowsForLevel(it, l)).map((flow) => ({ type: "forward", flow })));
    }
  }
  if (!commit) return { pending: null, done, remaining: 0 };
  const updates = clone.toObject(), items = updates.items; delete updates.items;
  const toCreate = [], toUpdate = [], toDelete = new Set(a.items.map((i) => i.id));
  for (const it of items) { if (a.items.get(it._id)) { toUpdate.push(it); toDelete.delete(it._id); } else toCreate.push(it); }
  const o = { isAdvancement: true, sheetRelayUser: user.id };
  const slotsBefore = Object.fromEntries(Object.entries(a.system.spells ?? {}).map(([k, s]) => [k, s?.max ?? 0]));
  await a.update(updates, o);
  if (toCreate.length) await a.createEmbeddedDocuments("Item", toCreate, { ...o, keepId: true });
  if (toUpdate.length) await a.updateEmbeddedDocuments("Item", toUpdate, { ...o, diff: false, recursive: false });
  if (toDelete.size) await a.deleteEmbeddedDocuments("Item", [...toDelete], o);
  // Spell slots gained at the level arrive available (the system only raises the maximum; otherwise they would start spent).
  const gain = Object.fromEntries(Object.entries(a.system.spells ?? {}).filter(([k, s]) => (s?.max ?? 0) > (slotsBefore[k] ?? 0))
    .map(([k, s]) => [`system.spells.${k}.value`, Math.min(s.max, (s.value ?? 0) + s.max - (slotsBefore[k] ?? 0))]));
  if (Object.keys(gain).length) await a.update(gain, o);
  return { pending: null, done, committed: true, sheet: sheet(a) };
}

async function rollBase(a, kind, key, cfg) {
  if (kind === "check" || kind === "save") {
    if (!ABILITIES.includes(key)) throw fail(400, "dnd.err.badAbility");
    const r = await (kind === "check" ? a.rollAbilityCheck({ ability: key, ...cfg }, DIALOG, MESSAGE) : a.rollSavingThrow({ ability: key, ...cfg }, DIALOG, MESSAGE));
    return out(r, kind, key);
  }
  if (kind === "skill") {
    if (!a.system.skills[key]) throw fail(400, "dnd.err.badSkill");
    return out(await a.rollSkill({ skill: key, ...cfg }, DIALOG, MESSAGE), kind, key);
  }
  if (kind === "death") return out(await a.rollDeathSave({ ...cfg }, DIALOG, MESSAGE), kind, "death");
  if (kind === "init") {
    // with an active combat it goes into the tracker; with no combat, it only posts the roll
    if (game.combat) { await a.rollInitiative({ createCombatants: true }); return { kind, label: "init", total: game.combat.getCombatantsByActor(a)[0]?.initiative ?? null }; }
    const roll = a.getInitiativeRoll(cfg); await roll.evaluate();
    await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor: a }), flavor: game.i18n.localize("DND5E.Initiative") });
    return out(roll, kind, "init");
  }
  if (kind === "hitDie") {
    const r = await a.rollHitDie({ denomination: key }, DIALOG, MESSAGE);
    if (!r) throw fail(400, "dnd.err.noHitDie");
    return out(r, kind, key);
  }
  throw fail(400, "dnd.err.badRollKind");
}

export const handlers = {
  ...extraHandlers,
  // Creation options: classes, backgrounds and species (the system's 2024 rules + world compendia).
  async creationOptions() {
    const all = await catalog(["class", "background", "race"]);
    const detail = async (e) => {
      const d = await fromUuid(e.uuid), s = d.system;
      // only what applies at level 1 (class) / level 0 (origin), without the reduced multiclass proficiencies
      const adv = (t) => Object.values(d.advancement?.byId ?? {}).filter((x) => typeOf(x) === t && (x.level ?? 0) <= 1 && x.classRestriction !== "secondary");
      const traits = adv("Trait").map((x) => ({ title: x.title, grants: [...(x.configuration.grants ?? [])].map((k) => dnd5e.documents.Trait.keyLabel(k)), choose: (x.configuration.choices ?? []).reduce((n, c) => n + (c.count ?? 0), 0) }));
      const grants = (await Promise.all(adv("ItemGrant").flatMap((x) => x.configuration.items ?? []).map(async ({ uuid }) => (await fromUuid(uuid))?.name))).filter(Boolean);
      const asi = e.type === "background" ? adv("AbilityScoreImprovement")[0] : null;
      return {
        uuid: e.uuid, name: e.name, type: e.type, description: lines(s.description?.value).slice(0, 2500),
        hitDie: s.hd?.denomination ?? null, primaryAbility: s.primaryAbility?.value ? [...s.primaryAbility.value] : [],
        traits, features: grants, asi: asi ? { points: asi.configuration.points, cap: asi.configuration.cap, locked: [...(asi.configuration.locked ?? [])] } : null,
        speed: s.movement?.walk ?? null
      };
    };
    const out = { classes: [], backgrounds: [], species: [] };
    for (const e of all) out[e.type === "class" ? "classes" : e.type === "background" ? "backgrounds" : "species"].push(await detail(e));
    return out;
  },
  // Creation step 1: new actor with name and base attributes (8–15 for point buy / standard array; 3–18 for rolling).
  async createCharacter(user, { name, abilities }) {
    name = typeof name === "string" ? name.trim() : "";
    if (!name || name.length > 80) throw fail(400, "dnd.err.badName");
    for (const k of ABILITIES) if (!Number.isInteger(abilities?.[k]) || abilities[k] < 3 || abilities[k] > 18) throw fail(400, "dnd.err.badAbilityScore", { ability: k });
    const a = await Actor.create({
      name, type: "character", folder: playersFolder()?.id ?? null, prototypeToken: { actorLink: true, name },
      ownership: { default: 0, [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER },
      system: { abilities: Object.fromEntries(ABILITIES.map((k) => [k, { value: abilities[k] }])) }
    }, { sheetRelayUser: user.id });
    return summary(a);
  },
  // Background, species, first class, multiclass (uuid) or +1 level in a class it already has (classId).
  async advance(user, { actorId, uuid, classId, decisions, commit }) {
    const a = ownedActor(user, actorId);
    if (decisions != null && (typeof decisions !== "object" || Array.isArray(decisions))) throw fail(400, "dnd.err.badDecisions");
    const r = await runAdvancement(user, a, { uuid, classId }, decisions ?? {}, !!commit);
    if (commit && r.pending) throw fail(400, "dnd.err.pendingChoice", { title: r.pending.title });
    return r;
  },
  async describeItem(user, { uuid }) {
    if (typeof uuid !== "string" || !uuid.startsWith("Compendium.")) throw fail(400, "dnd.err.badItem");
    const d = await fromUuid(uuid);
    if (d?.documentName === "RollTable") return { uuid, name: d.name, type: "table", formula: d.formula, description: [lines(d.description), ...d.results.contents.sort((a, b) => a.range[0] - b.range[0]).map((r) => `${r.name || r.range.join("–")}: ${text(r.description)}`)].filter(Boolean).join("\n") };
    if (!d || d.documentName !== "Item") throw fail(404, "dnd.err.itemNotFound");
    // SRD weapons and equipment come without text: builds a line with the numbers (damage, properties, mastery, AC, weight, price)
    const s = d.system, D = CONFIG.DND5E, stats = [];
    if (d.type === "weapon") {
      const dmg = s.damage?.base; if (dmg?.formula || dmg?.number) stats.push(`${dmg.formula || `${dmg.number}d${dmg.denomination}`} ${[...(dmg.types ?? [])].map((k) => D.damageTypes[k]?.label ?? k).join("/")}`.trim());
      const props = [...(s.properties ?? [])].map((k) => D.itemProperties[k]?.label).filter(Boolean); if (props.length) stats.push(props.join(", "));
      if (s.mastery) stats.push(tr("dnd.stat.mastery", { name: D.weaponMasteries?.[s.mastery]?.label ?? s.mastery }));
      if (s.range?.value) stats.push(tr("dnd.stat.range", { range: `${s.range.value}${s.range.long ? `/${s.range.long}` : ""} ${s.range.units ?? ""}`.trim() }));
    }
    if (d.type === "equipment" && s.armor?.value) stats.push(s.armor.dex != null ? tr("dnd.stat.acDex", { ac: s.armor.value, max: s.armor.dex }) : tr("dnd.stat.ac", { ac: s.armor.value }));
    if (s.weight?.value) stats.push(`${s.weight.value} ${s.weight.units ?? "lb"}`);
    if (s.price?.value) stats.push(`${s.price.value} ${coin(s.price.denomination)}`);
    const desc = lines(s.description?.value);
    return { uuid, name: d.name, type: d.type, level: s.level ?? null, school: d.labels?.school ?? "", activation: d.labels?.activation ?? "", range: d.labels?.range ?? "", components: d.labels?.components?.vsm ?? "",
      description: [stats.join(" · "), desc].filter(Boolean).join("\n") };
  },
  // Rolls a compendium table (e.g. Wild Magic Surge) on behalf of the character; the card goes to the chat.
  async drawTable(user, { actorId, uuid }) {
    const a = ownedActor(user, actorId);
    if (typeof uuid !== "string" || !uuid.startsWith("Compendium.")) throw fail(400, "dnd.err.badTable");
    const t = await fromUuid(uuid);
    if (t?.documentName !== "RollTable") throw fail(404, "dnd.err.tableNotFound");
    const { roll, results } = await t.roll();
    await t.toMessage(results, { roll, messageData: { speaker: ChatMessage.getSpeaker({ actor: a }) } });
    return { total: roll.total, formula: roll.formula, results: results.map((r) => `${r.name ? `${r.name}: ` : ""}${text(r.description)}`) };
  },
  levelUpOptions(user, { actorId }) {
    const a = ownedActor(user, actorId);
    return { level: a.system.details.level, xp: a.system.details.xp, classes: classes(a) };
  },

  getCharacter: (user, { actorId }) => sheet(ownedActor(user, actorId)),

  // kind: check|save|skill|death|init|hitDie. mode: normal|adv|dis. bonus: inteiro (opcional).
  async roll(user, { actorId, kind, key, mode = "normal", bonus = 0, mods }) {
    const a = ownedActor(user, actorId);
    bonus = pick(bonus, 0, -20, 20, tr("dnd.lbl.bonus"));
    const m = mods?.length ? await applyMods(a, modContext(a, { kind, key }), mods) : { adv: false, dis: false, parts: [], extra: [], notes: [], used: [], cost: { ap: 0, luck: 0, uses: [] } };
    if (kind === "soak") { // reaction that reduces the damage taken: the parts come negative; the returned total is how much the damage drops
      if (!m.parts.length) throw fail(400, "dnd.err.pickDefense");
      const r = await new Roll(m.parts.join(" + "), a.getRollData()).evaluate();
      await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: a }), flavor: tr("dnd.chat.soak") });
      return { kind, label: "soak", total: Math.max(0, -r.total), formula: r.formula, ...(await finishMods(a, m, user)) };
    }
    const cfg = { ...modeWith(mode, m), ...withParts(bonus, m.parts) };
    const res = await rollBase(a, kind, key, cfg);
    return { ...res, ...(m.used.length || m.notes.length ? await finishMods(a, m, user) : {}) };
  },

  // Item activity: attack (attack only), damage (damage only) or use (casts/uses, spending slot/uses like the system).
  async activity(user, { actorId, tokenId, itemId, activityId, action = "use", mode = "normal", bonus = 0, slot, critical = false, mods, targetTokenId }) {
    const a = ownedActor(user, actorId, tokenId), i = ownedItem(a, itemId);
    const act = activityId ? i.system.activities?.get(activityId) : i.system.activities?.contents[0];
    if (!act) throw fail(404, "dnd.err.activityNotFound");
    bonus = pick(bonus, 0, -20, 20, tr("dnd.lbl.bonus"));
    const m = mods?.length && ["attack", "damage", "heal"].includes(action) ? await applyMods(a, modContext(a, { itemId, activityId, action }), mods) : { adv: false, dis: false, parts: [], crit: false, healMax: false, healR1: false, extra: [], notes: [], used: [], cost: { ap: 0, luck: 0, uses: [] } };
    const extra = async (res) => ({ ...res, ...(m.used.length || m.notes.length ? await finishMods(a, m, user) : {}) });
    if (action === "attack") {
      if (act.type !== "attack") throw fail(400, "dnd.err.notAttack");
      return extra(out(await act.rollAttack({ ...modeWith(mode, m), ...withParts(bonus, m.parts) }, DIALOG, MESSAGE), "attack", i.name));
    }
    if (action === "damage") {
      if (!act.rollDamage) throw fail(400, "dnd.err.noDamage");
      return extra(out(await act.rollDamage({ isCritical: !!critical || m.crit, ...(m.parts.length ? { rolls: [{ parts: m.parts }] } : {}) }, DIALOG, MESSAGE), "damage", i.name));
    }
    if (action === "heal") {
      if (act.type !== "heal") throw fail(400, "dnd.err.notHeal");
      const target = targetTokenId ? healTarget(targetTokenId) : null; // validates before rolling
      const res = out(await withHealDice(act, m, () => act.rollDamage({ ...(m.parts.length ? { rolls: [{ parts: m.parts }] } : {}) }, DIALOG, MESSAGE)), "heal", i.name);
      if (target && !res.cancelled) { // the extra rolls (Chalice, Improved Blast) go into the healing applied to the target
        const fin = m.used.length || m.notes.length ? await finishMods(a, m, user) : null;
        res.healed = await healApply(user, target, res.total + (fin?.mods.extra ?? []).reduce((t, x) => t + x.total, 0), i.name);
        return { ...res, ...(fin ?? {}) };
      }
      return extra(res);
    }
    if (slot && !/^(spell[1-9]|pact)$/.test(slot)) throw fail(400, "dnd.err.badSlot");
    if (slot && !(a.system.spells[slot]?.value > 0)) throw fail(400, "dnd.err.noSlot");
    const res = await act.use(slot ? { spell: { slot } } : {}, DIALOG, MESSAGE);
    if (!res) throw fail(400, "dnd.err.cannotUse");
    return { kind: "use", label: i.name, sheet: sheet(a) };
  },

  async update(user, { actorId, changes }) {
    const a = ownedActor(user, actorId), F = fields(a);
    if (!changes || typeof changes !== "object") throw fail(400, "dnd.err.nothingToChange");
    const data = {};
    for (const [k, v] of Object.entries(changes)) {
      if (!Object.hasOwn(F, k)) throw fail(400, "dnd.err.fieldNotEditable", { field: k });
      data[k] = F[k](v, k.split(".").at(-1));
    }
    await a.update(data, { sheetRelayUser: user.id });
    return sheet(a);
  },
  // Damage and healing as on the sheet: damage uses up temporary HP first.
  async hp(user, { actorId, amount, heal = false }) {
    const a = ownedActor(user, actorId), hp = a.system.attributes.hp;
    amount = pick(amount, undefined, 1, 9999, tr("dnd.lbl.quantity")) ?? (() => { throw fail(400, "dnd.err.amountMissing"); })();
    let data;
    if (heal) data = { "system.attributes.hp.value": Math.min(hp.max, hp.value + amount) };
    else { const fromTemp = Math.min(hp.temp ?? 0, amount); data = { "system.attributes.hp.temp": (hp.temp ?? 0) - fromTemp, "system.attributes.hp.value": Math.max(0, hp.value - (amount - fromTemp)) }; }
    await a.update(data, { sheetRelayUser: user.id });
    return sheet(a);
  },
  async setItem(user, { actorId, itemId, field, value }) {
    const a = ownedActor(user, actorId), i = ownedItem(a, itemId);
    if (!Object.hasOwn(ITEM_FIELDS, field)) throw fail(400, "dnd.err.itemFieldNotEditable");
    await i.update(ITEM_FIELDS[field](i, value), { sheetRelayUser: user.id });
    return sheet(a);
  },
  async removeItem(user, { actorId, itemId }) {
    const a = ownedActor(user, actorId), i = ownedItem(a, itemId);
    if (![...GEAR, "spell"].includes(i.type)) throw fail(400, "dnd.err.removeOnly");
    await i.delete({ sheetRelayUser: user.id });
    return sheet(a);
  },
  // ---- GM panel: active scene tokens (GM only) ----
  sceneTokens(user) {
    if (!user.isGM) throw fail(403, "err.gmOnly");
    const sc = game.scenes.active, c = game.combat;
    return { scene: sc?.name ?? null, combat: !!c,
      damageTypes: Object.entries(CONFIG.DND5E.damageTypes).map(([id, v]) => ({ id, name: game.i18n.localize(v.label) })),
      conditions: CONFIG.statusEffects.filter((x) => x.id !== "dead").map((x) => ({ id: x.id, name: game.i18n.localize(x.name) })),
      tokens: (sc?.tokens.contents ?? []).filter((t) => t.actor?.system.attributes?.hp).map((t) => { const hp = t.actor.system.attributes.hp;
        return { tokenId: t.id, actorId: t.actor.id, name: t.name, kind: t.actor.type, disposition: t.disposition, hidden: t.hidden, hp: { value: hp.value, max: hp.max, temp: hp.temp ?? 0 },
          dead: t.actor.statuses.has("dead"), conditions: [...t.actor.statuses], player: t.actor.type === "character", attacks: attacksOf(t.actor),
          fx: timedFx(t.actor).map((e) => ({ id: e.id, name: e.name, img: e.img, left: fxLeft(e) })), init: c?.combatants.find((x) => x.tokenId === t.id)?.initiative ?? null }; }) };
  },
  // Damage by the dnd5e rules (target's resistances and vulnerabilities), healing and temp HP. One token per call; the app repeats for the selected ones.
  async tokenHp(user, { actorId, tokenId, amount, mode, damageType }) {
    if (!user.isGM) throw fail(403, "err.gmOnly");
    const a = ownedActor(user, actorId, tokenId);
    amount = pick(amount, undefined, 1, 9999, tr("dnd.lbl.quantity")) ?? (() => { throw fail(400, "dnd.err.amountMissing"); })();
    if (!["damage", "heal", "temp"].includes(mode)) throw fail(400, "dnd.err.badMode");
    if (damageType && !CONFIG.DND5E.damageTypes[damageType]) throw fail(400, "dnd.err.badDamageType");
    const type = mode === "heal" ? "healing" : mode === "temp" ? "temphp" : damageType;
    await a.applyDamage([{ value: amount, ...(type ? { type } : {}) }]);
    const hp = a.system.attributes.hp;
    return { name: a.name, hp: { value: hp.value, max: hp.max, temp: hp.temp ?? 0 } };
  },
  // Attack or damage of a scene NPC (same logic as the `activity` handler, which accepts tokenId and only lets the GM use it that way).
  tokenActivity(user, { actorId, tokenId, itemId, activityId, action, mode }) {
    if (!user.isGM || !tokenId) throw fail(403, "err.gmOnly");
    if (!["attack", "damage"].includes(action) || !["normal", "adv", "dis", undefined].includes(mode)) throw fail(400, "dnd.err.badAction");
    return handlers.activity(user, { actorId, tokenId, itemId, activityId, action, mode });
  },
  // Timed effect in rounds on a token (or removal of an effect). Name up to 60 characters, rounds 1 to 100, icon only from the list.
  async tokenEffect(user, { actorId, tokenId, action = "add", name, rounds, icon, effectId }) {
    if (!user.isGM) throw fail(403, "err.gmOnly");
    const a = ownedActor(user, actorId, tokenId); // exige GM
    if (action === "remove") {
      const e = timedFx(a).find((x) => x.id === effectId);
      if (!e) throw fail(404, "dnd.err.effectNotFound");
      await e.delete();
      return { ok: true };
    }
    if (action !== "add") throw fail(400, "dnd.err.badAction");
    name = typeof name === "string" ? name.trim() : "";
    if (!name || name.length > 60) throw fail(400, "dnd.err.effectName");
    rounds = pick(rounds, undefined, 1, 100, tr("dnd.lbl.rounds")) ?? (() => { throw fail(400, "dnd.err.roundsMissing"); })();
    if (!FX_ICONS.includes(icon)) throw fail(400, "dnd.err.badIcon");
    await a.createEmbeddedDocuments("ActiveEffect", [{ name, img: icon, duration: { rounds, seconds: 6 * rounds } }]);
    return { ok: true };
  },
  // Initiative of the selected tokens; creates the scene's combat if there is none.
  async sceneInit(user, { tokenIds }) {
    if (!user.isGM) throw fail(403, "err.gmOnly");
    const sc = game.scenes.active;
    if (!sc || !Array.isArray(tokenIds) || !tokenIds.length) throw fail(400, "dnd.err.pickTokens");
    const ts = tokenIds.map((id) => sc.tokens.get(id)).filter((t) => t?.actor);
    if (!ts.length) throw fail(404, "dnd.err.tokensNotFound");
    if (!game.combat) await Combat.create({ scene: sc.id, active: true });
    const c = game.combat;
    await c.createEmbeddedDocuments("Combatant", ts.filter((t) => !c.combatants.some((x) => x.tokenId === t.id)).map((t) => ({ tokenId: t.id, actorId: t.actor.id, sceneId: sc.id })));
    await c.rollInitiative(c.combatants.filter((x) => tokenIds.includes(x.tokenId)).map((x) => x.id), { messageOptions: {} });
    return { ok: true };
  },
  // (the relay's generic route reserves "type", "id" and "token": hence condition/kind/itemType)
  async condition(user, { actorId, tokenId, condition, active }) {
    const a = ownedActor(user, actorId, tokenId);
    if (!CONFIG.statusEffects.some((s) => s.id === condition)) throw fail(400, "dnd.err.badCondition");
    await a.toggleStatusEffect(condition, { active: bool(active, tr("dnd.lbl.active")) });
    return tokenId ? { ok: true } : sheet(a);
  },
  conditions: () => CONFIG.statusEffects.map((s) => ({ id: s.id, name: game.i18n.localize(s.name) })),
  async rest(user, { actorId, kind }) {
    const a = ownedActor(user, actorId);
    if (!["short", "long"].includes(kind)) throw fail(400, "dnd.err.pickRest");
    const r = await (kind === "short" ? a.shortRest({ dialog: false, chat: true }) : a.longRest({ dialog: false, chat: true, newDay: true }));
    if (r === false) throw fail(400, "dnd.err.restCancelled");
    return sheet(a);
  },

  // Item and spell compendia (world compendia). Class, species, background and
  // feats with advancements do not come through here (they would lack the choices): only through creation/level up.
  packs: () => game.packs.filter((p) => p.documentName === "Item" && p.collection.startsWith("world."))
    .map((p) => ({ id: p.collection, label: p.title })),
  async search(user, { pack, query = "", itemType = "" }) {
    const p = game.packs.get(pack);
    if (!p || p.documentName !== "Item") throw fail(404, "dnd.err.packNotFound");
    const q = String(query).toLowerCase().trim();
    const idx = await p.getIndex({ fields: ["type", "system.level", "system.price"] });
    return idx.filter((e) => [...GEAR, "spell"].includes(e.type) && (!itemType || e.type === itemType) && (!q || e.name.toLowerCase().includes(q)))
      .slice(0, 60).map((e) => ({ uuid: e.uuid, name: e.name, type: e.type, level: e.system?.level ?? null }));
  },
  async addItem(user, { actorId, uuid }) {
    const a = ownedActor(user, actorId);
    if (typeof uuid !== "string" || !uuid.startsWith("Compendium.")) throw fail(400, "dnd.err.badItem");
    const doc = await fromUuid(uuid);
    if (!doc || doc.documentName !== "Item" || ![...GEAR, "spell"].includes(doc.type)) throw fail(400, "dnd.err.onlyItemsSpells");
    await a.createEmbeddedDocuments("Item", [game.items.fromCompendium(doc)], { sheetRelayUser: user.id });
    return sheet(a);
  }
};
