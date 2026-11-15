// D&D 5.5e: special feat cases — pending choices (long rest, new feat), Aura of Protection on allies
// and own actions (Campeão Ancestral). Everything is stored in actor and item flags; the app only shows and answers.
import { ID, fail, keyOf, ownedActor, ownedItem, tr } from "../../api.js";

const TYPES = ["acid", "cold", "fire", "lightning", "poison"]; // labels in dnd.dmg.<type>
// Choices per feat (key = item source id). per: "lr" = again on every long rest; without per = once, when receiving the feat.
const CHOICES = {
  "0wwvNaQLy0KsCiPD": { per: "lr", kind: "skill", title: "dnd.choice.dream" },
  phbscrElementalA: { kind: "damageType", title: "dnd.choice.elemental" }
};
// Feats' own actions, shown as a button on the sheet.
export const SPECIAL = { tvTQeGJ2gkDRvpM8: "dnd.special.ancestral", mTV6sYKB67TZlnE6: "dnd.special.starry", "1ilNUYx2WfAruEM5": "dnd.special.martial" }; // values = locale keys
// Actions with an option chosen on activation: the choice becomes a temporary effect with a `form` flag ("group:option"), read by the rules via when.requires.
const FORMS = {
  mTV6sYKB67TZlnE6: { group: "estrelada", res: ["phbdrdWildShape0", "dnd.res.wildShape"], img: "icons/magic/light/orbs-hand-gray.webp", seconds: 600,
    options: ["arqueiro", "dragao", "taca"] }, // name in dnd.form.<group>; option in dnd.form.<group>.<value> (+ .desc)
  "1ilNUYx2WfAruEM5": { group: "marcial", res: ["phbmnkMonksFocus", "dnd.res.focus"], img: "icons/skills/melee/unarmed-punch-fist-yellow-red.webp", seconds: 600,
    options: ["coracao", "lamina", "manto", "fera"] }
};
const formLabel = (f, v) => tr(`dnd.form.${f.group}.${v}`);
export const choicesOf = (i) => { const f = FORMS[keyOf(i)]; return f?.options.map((value) => ({ value, label: formLabel(f, value) })) ?? null; };
// Actor's active forms (unexpired effects), for the `requires` filter of the roll rules: ["estrelada:dragao", ...].
export const fxOf = (a) => a.effects.filter((e) => !e.disabled && !e.duration?.expired).map((e) => e.getFlag?.(ID, "form")).filter(Boolean);
// Healing dice pools (the item sheet has no uses configured): Campeão dos Deuses and Luz Medicinal. cap = maximum dice per use.
const POOL = {
  W19FNscPx092qWP6: { die: 12, max: (a) => { const l = a.system.details?.level ?? 0; return l >= 17 ? 7 : l >= 12 ? 6 : l >= 6 ? 5 : 4; }, cap: () => Infinity },
  crrkhK2KuyHi1iP6: { die: 6, max: (a) => 1 + (a.classes?.warlock?.system?.levels ?? 0), cap: (a) => Math.max(1, a.system.abilities.cha.mod) }
};
// Use counter: the item's system.uses when configured (the sheet and native rest see it); otherwise the flag. The old flag (`legacy`) still counts.
const useLeft = (i, max, legacy) => Math.max(0, max - (i.system.uses?.max > 0 ? i.system.uses.spent ?? 0 : 0) - legacy);
export const poolOf = (a, i) => { const p = POOL[keyOf(i)]; if (!p) return null; const max = i.system.uses?.max > 0 ? i.system.uses.max : p.max(a); return { die: p.die, max, left: useLeft(i, max, i.getFlag(ID, "pool") ?? 0), cap: Math.min(p.cap(a), max) }; };
// Spends n uses: on the item (carrying over what was left in the old flag) or, with no uses on the item, on the flag.
const spend = async (i, flag, n, key) => {
  const old = key ? (i.getFlag(ID, flag)?.[key] ?? 0) : (i.getFlag(ID, flag) ?? 0), u = i.system.uses;
  if (!(u?.max > 0)) return key ? i.setFlag(ID, flag, { ...i.getFlag(ID, flag), [key]: old + n }) : i.setFlag(ID, flag, old + n);
  await i.update({ "system.uses.spent": Math.min(u.max, (u.spent ?? 0) + old + n) });
  if (old) await (key ? i.setFlag(ID, flag, { ...i.getFlag(ID, flag), [key]: 0 }) : i.unsetFlag(ID, flag));
};
// Healing target: active scene token with HP. The caller (player) does not need to be the owner: the relay is a GM.
export function healTarget(tokenId) {
  const t = game.scenes.active?.tokens.get(tokenId);
  if (!t?.actor?.system.attributes?.hp) throw fail(404, "dnd.err.targetNotInScene");
  return t;
}
export async function healApply(user, token, total, label) {
  const a = token.actor, before = a.system.attributes.hp.value;
  await a.applyDamage([{ value: Math.max(0, total), type: "healing" }]);
  const hp = a.system.attributes.hp, applied = hp.value - before, e = foundry.utils.escapeHTML;
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<p>${tr("dnd.chat.healed", { label: e(label), user: e(user.name ?? ""), name: `<b>${e(token.name)}</b>`, applied, total, hp: hp.value, max: hp.max })}</p>` });
  return { name: token.name, applied, hp: { value: hp.value, max: hp.max } };
}
export const specialOf = (i) => { const k = SPECIAL[keyOf(i)] ?? (POOL[keyOf(i)] ? "dnd.special.pool" : null); return k ? tr(k) : null; };

const skillLabel = (k) => game.i18n.localize(CONFIG.DND5E.skills[k]?.label ?? k);
const options = (a, c) => c.kind === "skill"
  ? Object.keys(a.system.skills).filter((k) => !(a.system.skills[k].value > 0)).map((k) => ({ value: k, label: skillLabel(k) }))
  : TYPES.map((value) => ({ value, label: tr(`dnd.dmg.${value}`) }));
export const pending = (a) => a.getFlag(ID, "pending") ?? [];
const addPending = async (a, item) => {
  const c = CHOICES[keyOf(item)], cur = pending(a);
  if (!c || cur.some((p) => p.itemId === item.id)) return;
  await a.setFlag(ID, "pending", [...cur, { id: foundry.utils.randomID(), itemId: item.id, kind: c.kind, title: tr(c.title), options: options(a, c) }]);
};

// Relay hooks: a long rest reopens the Apartado dos Sonhos choice (and removes the previous proficiency); a new feat asks for the choice.
export function registerExtras(mine) {
  Hooks.on("dnd5e.restCompleted", async (a, result) => {
    if (!mine() || !result.longRest) return;
    for (const i of a.items) if (POOL[keyOf(i)] && i.getFlag(ID, "pool")) await i.unsetFlag(ID, "pool"); // the pool resets on a long rest
    for (const i of a.items) {
      if (CHOICES[keyOf(i)]?.per !== "lr") continue;
      const prev = i.getFlag(ID, "granted");
      if (prev) { await a.update({ [`system.skills.${prev}.value`]: 0 }); await i.unsetFlag(ID, "granted"); }
      await addPending(a, i);
    }
  });
  Hooks.on("createItem", async (i) => { if (mine() && i.parent?.documentName === "Actor" && CHOICES[keyOf(i)] && !CHOICES[keyOf(i)].per) await addPending(i.parent, i); });
  Hooks.on("deleteActiveEffect", async (e) => { // the Campeão Ancestral ring disappears along with the effect
    const t = e.getFlag?.(ID, "template");
    if (mine() && t) await game.scenes.get(t.scene)?.templates.get(t.id)?.delete();
  });
}

// Ally auras: a nearby Paladin with Aura of Protection becomes a "borrowed" feat in the character's list (saving throws only).
const AURA = "phbpdnProtection";
const feet = (sc, d) => (/^m/i.test(sc.grid.units ?? "") ? d / 0.3048 : d); // scene distance in feet
export function auraItems(a) {
  const sc = game.scenes.active, me = sc?.tokens.find((t) => t.actor?.id === a.id);
  if (!me) return [];
  const center = (t) => [t.x + (t.width * sc.grid.size) / 2, t.y + (t.height * sc.grid.size) / 2];
  const out = [];
  for (const t of sc.tokens) {
    const p = t.actor, feat = p?.items.find((i) => keyOf(i) === AURA);
    if (!feat || p.id === a.id || t.disposition !== me.disposition || ["incapacitated", "unconscious", "dead"].some((s) => p.statuses.has(s))) continue;
    const [x1, y1] = center(me), [x2, y2] = center(t), dist = feet(sc, (Math.hypot(x1 - x2, y1 - y2) / sc.grid.size) * sc.grid.distance);
    if (dist <= ((p.system.details?.level ?? 0) >= 18 ? 30 : 10)) out.push({ id: `aura:${t.id}`, name: `${feat.name} (${t.name})`, type: "feat", _stats: feat._stats, flags: {}, srcActor: p });
  }
  return out;
}

export const handlers = {
  // Active scene tokens with HP, to pick the target of a heal (any player).
  healTargets() {
    return (game.scenes.active?.tokens.contents ?? []).filter((t) => t.actor?.system.attributes?.hp && !t.hidden).map((t) => { const hp = t.actor.system.attributes.hp; return { tokenId: t.id, actorId: t.actor.id, name: t.name, hp: { value: hp.value, max: hp.max } }; });
  },
  async resolvePending(user, { actorId, choiceId, value }) { // "id" is reserved by the relay (message id): it cannot be the argument name
    const a = ownedActor(user, actorId), p = pending(a).find((x) => x.id === choiceId);
    if (!p) throw fail(404, "dnd.err.choiceNotFound");
    if (!p.options.some((o) => o.value === value)) throw fail(400, "dnd.err.badOption");
    const item = ownedItem(a, p.itemId);
    if (p.kind === "skill") {
      await a.update({ [`system.skills.${value}.value`]: 1 }, { sheetRelayUser: user.id });
      await item.setFlag(ID, "granted", value);
    } else {
      const dr = new Set(a.system.traits.dr.value ?? []);
      if (!dr.has(value)) { dr.add(value); await a.update({ "system.traits.dr.value": [...dr] }, { sheetRelayUser: user.id }); }
      await item.setFlag(ID, "choice", value);
    }
    await a.setFlag(ID, "pending", pending(a).filter((x) => x.id !== choiceId));
    return { ok: true };
  },
  // Healing dice pool: rolls N dice, heals the character itself and spends N from the pool.
  async pool(user, { actorId, itemId, dice, targetTokenId }) {
    const a = ownedActor(user, actorId), item = ownedItem(a, itemId), p = poolOf(a, item);
    if (!p) throw fail(400, "dnd.err.noPool");
    if (!Number.isInteger(dice) || dice < 1 || dice > p.left || dice > p.cap) throw fail(400, "dnd.err.pickDice", { max: Math.min(p.left, p.cap) });
    const target = targetTokenId ? healTarget(targetTokenId) : null, r = await new Roll(`${dice}d${p.die}`).evaluate(), hp = a.system.attributes.hp, hp0 = hp.value;
    await r.toMessage({ speaker: ChatMessage.getSpeaker({ actor: a }), flavor: tr("dnd.chat.healFlavor", { name: item.name }) });
    const healed = target ? await healApply(user, target, r.total, item.name) : await a.update({ "system.attributes.hp.value": Math.min(hp.max, hp.value + r.total) }, { sheetRelayUser: user.id }).then(() => ({ name: a.name, applied: a.system.attributes.hp.value - hp0, hp: { value: a.system.attributes.hp.value, max: hp.max } }));
    await spend(item, "pool", dice);
    return { kind: "heal", label: item.name, healed, total: r.total, formula: r.formula, dice: r.dice.flatMap((d) => d.results.map((x) => ({ faces: d.faces, result: x.result, active: true }))) };
  },
  // Campeão Ancestral: effect with an icon for 1 minute and the aura ring on the map; spends the use (1 per long rest).
  async special(user, { actorId, itemId, choice }) { // "id" is reserved by the relay: the option comes in `choice`
    const a = ownedActor(user, actorId), item = ownedItem(a, itemId);
    if (!specialOf(item) || poolOf(a, item)) throw fail(400, "dnd.err.noSpecial");
    const form = FORMS[keyOf(item)];
    if (form) { // Starry Form / Martial Form: spends 1 use of the resource item (Wild Shape / Monk's Focus); switching form replaces the previous one
      const opt = form.options.find((v) => v === choice);
      if (!opt) throw fail(400, "dnd.err.pickOption");
      const fname = tr(`dnd.form.${form.group}`), rname = tr(form.res[1]), olabel = formLabel(form, opt), odesc = tr(`dnd.form.${form.group}.${opt}.desc`);
      const res = a.items.find((i) => keyOf(i) === form.res[0]), u = res?.system.uses; // no item on the sheet: does not block, only warns on the card
      if (res && (u.max ?? 0) > 0 && (u.value ?? u.max - u.spent) < 1) throw fail(409, "dnd.err.noResUses", { res: rname });
      const left = res ? u.max - u.spent - 1 : 0, max = res ? u.max : 0, cost = res && max > 0 ? (await res.update({ "system.uses.spent": u.spent + 1 }), tr("dnd.chat.spentUse", { res: rname, left, max })) : tr("dnd.chat.resMissing", { res: rname });
      for (const e of a.effects.filter((e) => e.getFlag(ID, "form")?.startsWith(`${form.group}:`))) await e.delete();
      await a.createEmbeddedDocuments("ActiveEffect", [{ name: `${fname}: ${olabel}`, img: form.img, description: odesc, duration: { seconds: form.seconds, rounds: form.seconds / 6 }, flags: { [ID]: { form: `${form.group}:${opt}` } } }]);
      await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<p>${tr("dnd.chat.formAssumed", { name: `<b>${foundry.utils.escapeHTML(a.name)}</b>`, form: foundry.utils.escapeHTML(fname), opt: `<b>${foundry.utils.escapeHTML(olabel)}</b>` })}</p><p><em>${foundry.utils.escapeHTML(odesc)}</em></p><p>${foundry.utils.escapeHTML(cost)}</p>` });
      return { ok: true };
    }
    if (useLeft(item, item.system.uses?.max > 0 ? item.system.uses.max : 1, item.getFlag(ID, "used")?.["ancestral-champion"] ?? 0) < 1) throw fail(409, "dnd.err.noUsesLr");
    const sc = game.scenes.active, tok = sc?.tokens.find((t) => t.actor?.id === a.id), ft = (a.system.details?.level ?? 0) >= 18 ? 30 : 10;
    let tpl = null;
    if (sc && tok) { // aura ring: circle centered on the token, in the scene's unit
      const r = sc.grid.units && /^m/i.test(sc.grid.units) ? ft * 0.3048 : ft;
      [tpl] = await sc.createEmbeddedDocuments("MeasuredTemplate", [{ t: "circle", user: user.id, x: tok.x + (tok.width * sc.grid.size) / 2, y: tok.y + (tok.height * sc.grid.size) / 2, distance: r, fillColor: "#ddb724", borderColor: "#ddb724", flags: { [ID]: { aura: a.id } } }]);
    }
    await a.createEmbeddedDocuments("ActiveEffect", [{ name: tr("dnd.ancestral.name"), img: "icons/svg/aura.svg", description: tr("dnd.ancestral.desc"),
      duration: { seconds: 60, rounds: 10 }, flags: { [ID]: tpl ? { template: { scene: sc.id, id: tpl.id } } : {} } }]);
    await spend(item, "used", 1, "ancestral-champion");
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<p>${tr("dnd.chat.ancestral", { name: `<b>${foundry.utils.escapeHTML(a.name)}</b>` })}</p><p><em>${tr("dnd.chat.ancestralDesc")}</em></p>` });
    return { ok: true };
  }
};
