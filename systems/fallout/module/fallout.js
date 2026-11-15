// Fallout 2d20 system adapter (game.system.id === "fallout"): sheet, rolls, level up, compendia and utilities.
import { ID, availableMods, chooseMods, fail, isRelay, num, ownedActor, ownedItem, pick, playersFolder, resetUses, spendUses, text, tr, tryOr } from "../../api.js";

export const LISTED = ["character", "robot", "creature", "npc"];
export const summary = (a) => ({ id: a.id, name: a.name, type: a.type, hp: a.system.health ?? a.system.attributes?.hp ?? null });

const GEAR = ["apparel", "consumable", "miscellany", "books_and_magz", "robot_armor", "robot_mod", "weapon_mod", "apparel_mod"];
const active = (obj = {}) => Object.entries(obj).filter(([, v]) => v?.value > 0).map(([k]) => k);

// Sheet for the app. Specific to Fallout 2d20; in other systems the specific fields come empty.
const sheet = (a) => {
  const sys = a.system, byType = (...t) => a.items.filter((i) => t.includes(i.type));
  return {
    ...summary(a),
    level: { value: sys.level?.value ?? null, xp: sys.level?.currentXP ?? null, next: sys.level?.nextLevelXP ?? null },
    origin: sys.origin ?? "",
    complication: parseInt(sys.complication) || 20,
    luck: num(sys.luckPoints),
    caps: num(sys.currency?.caps),
    initiative: num(sys.initiative), defense: num(sys.defense), meleeDamage: num(sys.meleeDamage),
    carry: { value: sys.carryWeight?.value ?? null, total: sys.carryWeight?.total ?? null },
    attributes: Object.fromEntries(Object.entries(sys.attributes ?? {}).filter(([, v]) => v?.value != null).map(([k, v]) => [k, v.value])),
    skills: byType("skill").map((i) => ({ id: i.id, name: i.name, rank: i.system.value, tag: !!i.system.tag, attr: i.system.defaultAttribute })),
    bodyType: sys.bodyType,
    // Creatures have no S.P.E.C.I.A.L. or skills as items: Body/Mind and Melee/Guns/Other live on the actor itself.
    creature: a.type === "creature" ? Object.fromEntries(["body", "mind", "melee", "guns", "other"].map((k) => [k, sys[k]?.value ?? 0])) : null,
    // creatures store resistances as { value, locations }; characters, as a number
    poisonDR: num(sys.resistance?.poison) ?? 0,
    body: Object.entries(sys.body_parts ?? {}).map(([k, v]) => ({ key: k, physical: num(v.resistance?.physical) ?? 0, energy: num(v.resistance?.energy) ?? 0, radiation: num(v.resistance?.radiation) ?? 0,
      poison: num(v.resistance?.poison) ?? 0, injuries: Array.isArray(v.injuries) ? v.injuries : [], status: v.status ?? "healthy" })),
    weapons: byType("weapon").map((i) => ({ id: i.id, name: i.name, skill: i.system.weaponType,
      roll: tryOr(() => weaponBase(a, i), null), damageDice: tryOr(() => i.currentWeaponDamage, null), ammoPerShot: i.system.ammoPerShot ?? 0, // roll popup defaults
      damage: i.system.damage?.rating, types: active(Object.fromEntries(Object.entries(i.system.damage?.damageType ?? {}).map(([k, v]) => [k, { value: v ? 1 : 0 }]))),
      effects: active(i.system.damage?.damageEffect), qualities: active(i.system.damage?.weaponQuality), range: i.system.range, rate: i.system.damage?.fireRate ?? i.system.fireRate, ammo: i.system.ammo, weight: i.system.weight, equipped: !!i.system.equipped })),
    // ammo with several shots per unit (e.g. Fusion Cell 20): the system spends the current charge before the quantity
    ammo: byType("ammo").map((i) => ({ id: i.id, name: i.name, quantity: i.system.quantity,
      shots: i.system.shots?.max > 1 ? { current: i.system.shots.current, max: i.system.shots.max } : null })),
    gear: byType(...GEAR).map((i) => ({ id: i.id, name: i.name, type: i.type, quantity: i.system.quantity, weight: i.system.weight, equipped: !!i.system.equipped })),
    perks: byType("perk", "trait", "special_ability").map((i) => ({ id: i.id, name: i.name, type: i.type, rank: i.system.rank?.value ?? null, effect: text(i.system.description) }))
  };
};



// ---------- Rolls: same API as the system's sheet; the card goes to the Foundry chat ----------
const MAX_D20 = 6; // 2d20 base; extras (perk, AP) up to 6d20
const diceNum = (d = 2) => { if (!Number.isInteger(d) || d < 1 || d > MAX_D20) throw fail(400, "fallout.err.diceCount", { max: MAX_D20 }); return d; };
// Same data as the roll2d20.hbs card: successes, TN, complications, dice and hit location (read from the card the system just posted).
const d20Result = (dice, { rollname, tn, located, difficulty, baseDifficulty } = {}) => {
  const card = located ? game.messages.contents.findLast((m) => (m.author ?? m.user)?.id === game.user.id && m.flags?.falloutroll)?.flags.falloutroll : null;
  const loc = card?.hitLocation;
  return {
    rollname, tn, difficulty, baseDifficulty,
    dice: dice.map((d) => ({ result: d.result, success: d.success, complication: d.complication })),
    successes: dice.reduce((n, d) => n + d.success, 0), complications: dice.reduce((n, d) => n + d.complication, 0),
    hitLocation: loc ? game.i18n.localize(CONFIG.FALLOUT.BODY_LOCATION_LABELS?.[loc] ?? loc) : null, hitLocationResult: card?.hitLocationResult ?? null
  };
};


// ---------- Roll modifiers (perks): context, effect application and costs ----------

// ---------- Effects on targets (e.g. Suppressor, Tenderizer): ActiveEffect with icon, value and turns ----------
export const FX = { suppressed: { name: "fallout.fx.suppressed", img: "icons/svg/downgrade.svg" }, vulnerable: { name: "fallout.fx.vulnerable", img: "icons/svg/target.svg" } };
export const fxOf = (e) => e.getFlag(ID, "fx");
// Effects placed by this actor on some token of the active scene: ["vulnerable", ...]. Rules with `requires` only appear if a target is selected.
const fxList = (a) => a.effects.filter((e) => fxOf(e)).map((e) => ({ id: e.id, name: e.name, img: e.img }));
const fxOn = (a) => [...new Set((game.scenes.active?.tokens.contents ?? []).flatMap((t) => (t.actor?.effects ?? []).map(fxOf).filter((f) => f?.by === a.id).map((f) => f.status)))];
async function putFx(target, fx) {
  const def = FX[fx.status];
  for (const e of target.effects.filter((e) => fxOf(e)?.status === fx.status && fxOf(e)?.by === fx.by)) await e.delete(); // reaplicar renova
  await target.createEmbeddedDocuments("ActiveEffect", [{ name: `${tr(def.name)} (${fx.value})`, img: def.img, statuses: [`sr-${fx.status}`], description: tr(def.name), flags: { [ID]: { fx: { status: fx.status, value: fx.value, by: fx.by, turnsLeft: fx.turns ?? 1 } } } }]);
}
const MELEE = ["meleeWeapons", "unarmed"];
// Context the engine uses to find the rules that apply; it comes from the actor and item, never from the app.
// The system has no "shotgun", "laser", "pipe"…: the tags come from the weapon's name and ammo, plus its qualities and rate of fire.
const camel = (k) => k.replace(/_(\w)/g, (_, c) => c.toUpperCase());
function weaponTags(w) {
  const t = w.system.weaponType, name = `${w.name} ${w.system.ammo ?? ""}`, melee = MELEE.includes(t);
  const q = Object.entries(w.system.damage?.weaponQuality ?? {}).filter(([, v]) => v?.value).map(([k]) => camel(k));
  const rate = Number(w.system.damage?.fireRate ?? w.system.fireRate) || 0, tags = new Set([t, melee ? "melee" : "ranged", ...q]);
  for (let k = 1; k <= rate; k++) tags.add(`fireRate>=${k}`);
  for (let k = rate; k <= 10; k++) tags.add(`fireRate<=${k}`);
  if (!q.includes("twoHanded")) tags.add("oneHanded");
  if (t === "bigGuns" || q.includes("heavy")) tags.add("heavy");
  const types = Object.entries(w.system.damage?.damageType ?? {}).filter(([, v]) => v).map(([k]) => k);
  if (types.includes("radiation")) tags.add("radioactive");
  for (const [tag, re] of [["shotgun", /shotgun/i], ["laser", /laser/i], ["plasma", /plasma/i], ["knife", /knife|knives|switchblade/i], ["bow", /\bbow\b/i], ["crossbow", /crossbow/i], ["fire", /flamer|molotov|incendiary/i]]) if (re.test(name)) tags.add(tag);
  if (!melee && /\bpipe\b/i.test(w.name)) tags.add("pipe");
  return { tags: [...tags], types: [...types, ...(tags.has("plasma") ? ["plasma"] : []), ...(tags.has("fire") ? ["fire"] : [])] };
}
export function modContext(a, { roll, skillId, itemId }) {
  if (roll === "skill" && skillId) { const sk = ownedItem(a, skillId, "skill"); return { roll, skill: sk.name, attribute: sk.system.defaultAttribute }; }
  if (itemId) {
    const w = ownedItem(a, itemId, "weapon"), t = w.system.weaponType, { tags, types } = weaponTags(w), melee = MELEE.includes(t);
    const attr = w.isOwnedByCreature ? undefined : CONFIG.FALLOUT.WEAPON_ATTRIBUTE_OVERRIDE[t] ?? a.items.find((i) => i.type === "skill" && i.name === CONFIG.FALLOUT.WEAPON_SKILLS[t])?.system.defaultAttribute;
    return { roll, fx: fxOn(a), attribute: attr, item: { weaponType: [t, melee ? "melee" : "ranged"], range: [melee ? "melee" : "ranged", ...(t === "throwing" || tags.includes("thrown") ? ["thrown"] : [])], damageType: types, tags } };
  }
  return { roll };
}
// Test difficulty: the one the player/GM chose (default 1) plus what the perks change, never below 0.
const difficultyOf = (chosen, m) => {
  const base = chosen === undefined || chosen === null ? 1 : pick(chosen, 1, 0, 5, "dificuldade");
  return { base, final: Math.max(0, base + m.diffDelta) };
};
const rankOf = (a, itemId) => Math.max(1, a.items.get(itemId)?.system.rank?.value ?? 1); // a perk with no stored rank counts as rank 1
const calc = (f, rank) => { try { return Roll.create(String(f).replace(/@rank/g, rank)).evaluateSync().total; } catch { return null; } };
// Validates the selected rules and returns what changes in the roll (adjusted base, extra dice, extra CD) and what only becomes a warning.
// Perks the GM decided to leave as a message only (no calculation): the text shows in the result and in the chat.
const MSG_ONLY = new Set(["fail-ap", "tinkerer", "meltdown", "radicool", "terrify", "discrim"]);
async function modsFor(a, ctx, keys, base) {
  if (!keys?.length) return { base, extraDice: 0, extraCD: 0, used: [], notes: [], cost: { ap: 0, luck: 0, uses: [] } };
  const m = await chooseMods(a, ctx, keys, { ap: game.settings.get("fallout", "partyAP"), luck: num(a.system.luckPoints) ?? 0 }, (v, r) => calc(v, rankOf(a, r.itemId)));
  const out = { base: { ...base }, extraDice: 0, extraCD: 0, diffDelta: 0, used: m.chosen, notes: m.notes.map((n) => n.other), cost: m.cost };
  for (const e of m.effects) {
    const rank = rankOf(a, e.from.split(":")[0]);
    if (MSG_ONLY.has(e.from.split(":")[1])) { const c = m.chosen.find((x) => x.key === e.from), note = `${c.itemName}: ${c.text}`; if (!out.notes.includes(note)) out.notes.push(note); continue; }
    if (e.set === "attribute" && Number.isFinite(e.value)) out.base.attribute = e.value;
    else if (e.set === "rank" && Number.isFinite(e.value)) out.base.rank = e.value;
    else if (e.set === "tag" && typeof e.value === "boolean") out.base.tag = e.value;
    else if (e.add === "rank" && calc(parseInt(e.formula), rank) != null) out.base.rank = Math.min(parseInt(String(e.formula).match(/máx\.?\s*(\d+)/)?.[1] ?? 10), out.base.rank + parseInt(e.formula));
    else if (Number.isInteger(e.dice)) out.extraDice += e.dice;
    else if (e.autoCrit) out.crit = true;
    else if (e.add === "difficulty" && calc(String(e.formula), rank) != null) out.diffDelta += calc(String(e.formula), rank);
    else if (e.applyEffect) (out.applyFx ??= []).push({ status: e.applyEffect.status, value: calc(String(e.applyEffect.value), rank) ?? 1, turns: e.applyEffect.turns ?? 1, by: a.id });
    else if (e.add === "damage") { const n = calc(String(e.formula).replace(/\s*CD\s*$/, ""), rank); if (n == null) out.notes.push(`${m.chosen.find((x) => x.key === e.from).itemName}: ${m.chosen.find((x) => x.key === e.from).text}`); else out.extraCD += n; }
    else { // reroll, quality, difficulty etc.: the player applies it; warns once per rule, with the perk's text
      const c = m.chosen.find((x) => x.key === e.from), note = `${c.itemName}: ${c.text}`;
      if (!out.notes.includes(note)) out.notes.push(note);
    }
  }
  if (out.extraCD && ctx.roll !== "damage") { // extra CD only counts on the damage test: on the others, it becomes a warning
    out.notes.push(...m.chosen.filter((c) => m.effects.some((e) => e.from === c.key && e.add === "damage")).map((c) => `${c.itemName}: ${c.text}`));
    out.extraCD = 0;
  }
  out.effects = m.effects;
  return out;
}
// Spends AP, Luck and uses after the roll has actually happened.
async function pay(a, user, m) {
  const cost = m.cost;
  if (cost.ap) await game.settings.set("fallout", "partyAP", game.settings.get("fallout", "partyAP") - cost.ap);
  if (cost.luck) await a.update({ "system.luckPoints": (num(a.system.luckPoints) ?? 0) - cost.luck }, { sheetRelayUser: user.id });
  await spendUses(a, cost);
  await announce(a, m);
}
const announce = (a, m) => (m.used.length || m.notes.length) && ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }),
  content: `<p><b>${tr("mod.used")}:</b> ${m.used.map((u) => `${u.itemName}: ${u.label}`).join("; ") || "—"}</p>${m.notes.map((n) => `<p><em>${n}</em></p>`).join("")}` });
// For the "Dano ou Cura" macro: validates the attacker's "apply" phase rules (e.g. automatic crit), charges costs and warns in the chat.
export async function applyMods(a, ctx, keys, user = game.user) {
  const m = await modsFor(a, { ...modContext(a, { ...ctx, roll: "apply" }), roll: "apply" }, keys, {});
  await pay(a, user, m);
  return m;
}

// ---------- "Dano ou Cura" macro: target defense (extra DR) and extra dice on kill ----------
const PHYS_EN = ["physical", "energy"], ALL_DR = ["physical", "energy", "radiation"];
// Each defense perk: DR types it raises, when it really applies (applies), when it kicks in by itself (auto). c = attack context.
const SOAK = {
  "bullet-shield": { dr: PHYS_EN, auto: (c) => c.heldBig },
  blocker: { dr: PHYS_EN, applies: (c) => c.melee, auto: () => true },
  antirobot: { dr: PHYS_EN, applies: (c) => c.attackerRobot, auto: () => true },
  "science-gone-mad": { dr: ["energy"], applies: (c) => c.dmg === "energy", auto: () => true },
  "giant-insects": { dr: ["radiation"], applies: (c) => c.dmg === "radiation", auto: () => true },
  "nerd-rage": { dr: PHYS_EN, auto: (c) => c.lowHp },
  "duck-and-cover": { dr: ALL_DR, applies: (c) => c.blast, auto: () => false },
  "ux-ron": { zero: true, applies: (c) => c.dmg === "energy", auto: () => false }
};
const soakCtx = (def, c) => {
  const held = def.items.filter((i) => i.type === "weapon" && i.system.equipped).map((i) => i.system.weaponType), hp = def.system.health;
  return { ...c, held, heldBig: held.includes("bigGuns"), lowHp: hp && hp.value < hp.max / 4 };
};
// Engine context for defense: weapons wielded by the defender, damage type and whether the attack is Blast.
const soakItem = (x) => x ? { weaponType: x.held, damageType: [x.dmg], tags: x.blast ? ["blast"] : [] } : { weaponType: ["bigGuns"], damageType: ["physical", "energy", "radiation"], tags: ["blast"] };
// Target's defense perks for this attack: [{ key, itemName, label, text, dr:{tipo:valor}, zero, auto, cost, usesLeft }].
// c = { dmg, melee, blast, attackerRobot }; without c, returns all (so the macro lists the ones that depend on the defender's choice).
export async function soakOptions(def, c = null) {
  const x = c ? soakCtx(def, c) : null, out = [];
  for (const m of await availableMods(def, { roll: "soak", item: soakItem(x) })) {
    const rule = SOAK[m.id]; if (!rule) continue;
    if (x && rule.applies && !rule.applies(x)) continue;
    const rank = rankOf(def, m.itemId), v = (m.effects ?? []).map((e) => e.add && calc(String(e.formula), rank)).find((n) => n != null) ?? 0;
    out.push({ key: m.key, id: m.id, itemName: m.itemName, label: m.label, text: m.text, dr: rule.dr ? Object.fromEntries(rule.dr.map((t) => [t, v])) : null, zero: !!rule.zero, auto: x ? !!rule.auto(x) : false, cost: m.cost, usesLeft: m.usesLeft });
  }
  return out;
}
export const soakManual = async (def) => (await soakOptions(def)).filter((o) => ["duck-and-cover", "ux-ron"].includes(o.id));
// Charges what the chosen options cost and returns the extra DR per type (or "zero" to nullify the damage).
export async function applySoak(def, c, keys, user = game.user) {
  const opts = (await soakOptions(def, c)).filter((o) => keys.includes(o.key));
  if (!opts.length) return { extra: {}, zero: false, used: [] };
  const m = await modsFor(def, { roll: "soak", item: soakItem(soakCtx(def, c)) }, opts.map((o) => o.key), {});
  await pay(def, user, m);
  const extra = {};
  for (const o of opts) for (const [t, v] of Object.entries(o.dr ?? {})) extra[t] = (extra[t] ?? 0) + v;
  return { extra, zero: opts.some((o) => o.zero), used: opts.map((o) => `${o.itemName}: ${o.label}`) };
}
// Extra dice on kill (Psychopath, Meltdown, Grim Reaper's Sprint): rolls in CD and returns the lines for the report.
export async function rollKill(a, ctx, keys, { damage = 0, user = game.user } = {}) {
  const m = await modsFor(a, { ...modContext(a, { ...ctx, roll: "kill" }), roll: "kill" }, keys, {}), w = ownedItem(a, ctx.itemId, "weapon"), lines = [];
  for (const e of m.effects.filter((x) => x.extraRoll)) {
    const f = String(e.extraRoll.formula).replace(/@weaponDamage/g, damage).replace(/@rank/g, rankOf(a, e.from.split(":")[0])).replace(/(CD|dc)\s*$/i, ""), n = Math.max(1, Math.floor(Roll.create(f).evaluateSync().total));
    const rolled = await fallout.Roller2D20.rollD6({ actor: a.token?.uuid ?? a.uuid, dicenum: n, weapon: w, rollname: e.extraRoll.label });
    const fx = rolled.reduce((t, d) => t + d.effect, 0), rule = e.from.split(":")[1];
    let extra = "";
    if (rule === "psychopath" && fx) { // each Effect returns 1 Luck, up to the maximum (LUCK)
      const max = a.system.attributes?.luc?.value ?? 10, now = num(a.system.luckPoints) ?? 0, to = Math.min(max, now + fx);
      if (to > now) await a.update({ "system.luckPoints": to }, { sheetRelayUser: user.id });
      extra = tr("fallout.kill.luck", { from: now, to });
    }
    if (rule === "grim-reapers-sprint" && fx) { // with Effect: +2 AP to the group pool (up to the maximum)
      const ap = game.settings.get("fallout", "partyAP"), to = Math.min(game.settings.get("fallout", "maxAP"), ap + 2);
      if (to > ap) await game.settings.set("fallout", "partyAP", to);
      extra = tr("fallout.kill.ap", { from: ap, to });
    }
    lines.push(tr("fallout.kill.line", { label: e.extraRoll.label, n, damage: rolled.reduce((t, d) => t + d.result, 0), fx, extra }));
  }
  await pay(a, user, m);
  return { lines, used: m.used };
}

// ---------- Deal damage (the "Dano ou Cura" macro and the GM panel use this same function) ----------
const LOCS = ["torso", "head", "armL", "armR", "legL", "legR"];
const locName = (k) => tr(`fallout.loc.${k}`);
const DMG_TYPES = ["physical", "energy", "radiation", "poison"];
const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
const sceneToken = (sceneId, tokenId) => {
  const t = (sceneId ? game.scenes.get(sceneId) : game.scenes.active)?.tokens.get(tokenId);
  if (!t?.actor) throw fail(404, "fallout.err.token");
  return t;
};
// Perks the attacker can select when dealing damage with a weapon: { apply: [...], kill: [...] }.
export async function damagePerks(user, { actorId, tokenId, itemId }) {
  if (!user.isGM) throw fail(403, "fallout.err.gmOnly");
  const a = ownedActor(user, actorId, tokenId), pick = ({ key, itemName, label, text, usesLeft, auto }) => ({ key, itemName, label, text, usesLeft, auto });
  return { apply: (await availableMods(a, modContext(a, { roll: "apply", itemId }))).map(pick), kill: (await availableMods(a, modContext(a, { roll: "kill", itemId }))).map(pick) };
}
// Targets' defense perks that depend on the defender's choice (Duck and Cover, Ux-Ron): [{ tokenId, name, key, label }].
export async function defensePerks(user, { sceneId, tokenIds }) {
  if (!user.isGM) throw fail(403, "fallout.err.gmOnly");
  const out = [];
  for (const id of tokenIds ?? []) { const t = sceneToken(sceneId, id); for (const o of await soakManual(t.actor)) out.push({ tokenId: id, name: t.name, key: o.key, label: `${o.itemName}: ${o.label}` }); }
  return out;
}
// Applies the damage to each target: location DR, extra DR from defense perks, Power Armor, death, crit and dice on kill.
// args: { sceneId, attacker: { actorId, tokenId? } | null, weaponId, amount, dmgType, location, targets: [{ tokenId, defKeys }], perkKeys, killKeys }
export async function applyDamage(user, { sceneId, attacker = null, weaponId, amount, dmgType, location, targets, perkKeys = [], killKeys = [] }) {
  if (!user.isGM) throw fail(403, "fallout.err.gmOnly");
  if (!Number.isInteger(amount) || amount < 1 || amount > 500) throw fail(400, "fallout.err.damageRange");
  if (!DMG_TYPES.includes(dmgType)) throw fail(400, "fallout.err.damageType");
  if (!LOCS.includes(location)) throw fail(400, "fallout.err.location");
  if (!Array.isArray(targets) || !targets.length || targets.length > 20) throw fail(400, "fallout.err.targets");
  const atk = attacker ? ownedActor(user, attacker.actorId, attacker.tokenId) : null;
  const tags = atk && weaponId ? modContext(atk, { roll: "apply", itemId: weaponId }).item.tags : [];
  const base = { melee: tags.includes("melee"), blast: tags.includes("blast"), attackerRobot: atk?.type === "robot" };
  let perk = null, perkErr = "", report = "", lines = [];
  for (const { tokenId, defKeys = [] } of targets) {
    const token = sceneToken(sceneId, tokenId), actor = token.actor, isPC = ["character", "robot"].includes(actor.type), oldHp = Number(actor.system.health?.value ?? 0), maxHp = Number(actor.system.health?.max ?? 10);
    let defense = num(actor.system.body_parts?.[location]?.resistance?.[dmgType]) || num(actor.system.resistance?.[dmgType]) || 0, soakNote = "", zero = false;
    try { // extra DR from the defender's perks: automatic ones apply by themselves, choice ones only if selected
      const sc = { ...base, dmg: dmgType }, opts = await soakOptions(actor, sc), keys = opts.filter((o) => o.auto || defKeys.includes(o.key)).map((o) => o.key);
      if (keys.length) { const r = await applySoak(actor, sc, keys, user); defense += r.extra[dmgType] ?? 0; zero = r.zero; soakNote = `<div style="opacity:.8;font-size:.9em">${tr("fallout.dmg.soak", { list: esc(r.used.join("; ")) })}${r.zero ? tr("fallout.dmg.soakZero") : ` (+${r.extra[dmgType] ?? 0})`}</div>`; }
    } catch (e) { soakNote = `<div style="color:#ffb300">${tr("fallout.dmg.soakFail", { error: esc(e.message) })}</div>`; }
    let dmg = zero ? 0 : Math.max(0, amount - defense);
    if (dmg === 0) { report += `<div style="padding:5px;"><b>${esc(token.name)}</b>: ${tr("fallout.dmg.resisted")}${soakNote}</div>`; lines.push(tr("fallout.dmg.lineResisted", { name: token.name })); continue; }
    if (!["radiation", "poison"].includes(dmgType)) { // Power Armor equipped on the location absorbs before HP
      const pa = actor.items.find((i) => i.type === "apparel" && i.system.apparelType?.toLowerCase() === "powerarmor" && i.system.equipped && i.system.location?.[location]);
      if (pa && pa.system.health?.value > 0) { const ab = Math.min(pa.system.health.value, dmg); await actor.updateEmbeddedDocuments("Item", [{ _id: pa.id, "system.health.value": pa.system.health.value - ab }]); dmg -= ab; }
    }
    const newHp = Math.max(0, oldHp - dmg);
    await actor.update({ "system.health.value": newHp }, { sheetRelayUser: user.id });
    let extra = "";
    if (newHp === 0 && oldHp > 0) {
      if (!actor.effects.some((e) => e.statuses?.has("dead"))) await actor.toggleStatusEffect("dead", { overlay: true, active: true });
      extra += `<div style="color:#ff5252; font-weight:bold; margin-top:5px;"><i class="fas fa-skull"></i> ${tr("fallout.dmg.dead")}</div>`;
      if (killKeys.length && atk) {
        try { const r = await rollKill(atk, { itemId: weaponId }, killKeys, { damage: dmg, user }); extra += r.lines.map((l) => `<div style="color:#ffb300;margin-top:3px;">${esc(l)}</div>`).join(""); }
        catch (e) { extra += `<div style="color:#ffb300;margin-top:3px;">${tr("fallout.dmg.killFail", { error: esc(e.message) })}</div>`; }
      }
    }
    if (perkKeys.length && atk) {
      try {
        perk ??= await applyMods(atk, { itemId: weaponId }, perkKeys, user);
        for (const fx of perk.applyFx ?? []) { await putFx(actor, fx); extra += `<div style="color:#ffb300;margin-top:5px;">${tr("fallout.dmg.effect", { name: tr(FX[fx.status].name), value: fx.value, target: esc(token.name) })}</div>`; }
        if (perk.crit) {
          const inj = actor.system.body_parts?.[location]?.injuries, slot = Array.isArray(inj) ? inj.indexOf(0) : -1;
          if (slot >= 0) {
            const next = [...inj]; next[slot] = 1;
            await actor.update({ [`system.body_parts.${location}.injuries`]: next, [`system.body_parts.${location}.status`]: "wounded" }, { sheetRelayUser: user.id });
            extra += `<div style="color:#ffb300;margin-top:5px;"><i class="fas fa-bolt"></i> ${tr("fallout.dmg.crit", { perks: esc(perk.used.map((u) => u.itemName).join(", ")), loc: locName(location) })}</div>`;
          } else extra += `<div style="color:#ffb300;margin-top:5px;">${tr("fallout.dmg.critNoSlot", { loc: locName(location) })}</div>`;
        }
      } catch (e) { perkErr ||= e.message; extra += `<div style="color:#ffb300;margin-top:5px;">${tr("fallout.dmg.perkFail", { error: esc(e.message) })}</div>`; perkKeys = []; }
    }
    report += `<div style="margin-bottom:8px; border-left:4px solid #ff5252; padding-left:8px;"><b>${esc(token.name)}</b> ${tr("fallout.dmg.took", { dmg })}${soakNote}${isPC ? `<br>❤️ HP: ${newHp}/${maxHp}` : ""}${extra}</div>`;
    lines.push(tr("fallout.dmg.line", { name: token.name, dmg }) + (newHp === 0 ? tr("fallout.dmg.lineDead") : ""));
  }
  await ChatMessage.create({ content: `<div style="background:#1a1a1a; color:#eee; padding:10px; border:2px solid #ff5252; border-radius:5px;">${report}</div>` });
  return { lines, perkErr };
}
const modInfo = (m) => ({ used: m.used.map((u) => `${u.itemName}: ${u.label}`), notes: m.notes });

// Default values of each test (the same as the system's sheet). The app popup shows them and the player can adjust
// (perk bonus, difficulty etc.), as in Foundry's Dialog2d20.
const baseComplication = (a) => parseInt(a.system.complication) || 20;
const skillBase = (a, sk) => ({
  attribute: a.system.attributes?.[sk.system.defaultAttribute]?.value ?? 0, rank: sk.system.value ?? 0, tag: !!sk.system.tag, complication: baseComplication(a)
});
// Same rules as FalloutPcSheet._onWeaponRoll (weapon skill/attribute, creature, unreliable).
function weaponBase(a, w) {
  let sk, attribute;
  if (w.isOwnedByCreature) { // creature: attribute and skill come from the actor itself, the skill counts as TAG
    const ca = w.system.creatureAttribute ?? "", cs = w.system.creatureSkill ?? "";
    if (!ca || !cs) throw fail(409, "fallout.err.creatureWeapon");
    attribute = a.system[ca]?.value;
    sk = { value: a.system[cs]?.value ?? 0, tag: true };
  } else {
    const type = w.system.weaponType;
    const skillName = type === "custom" ? w.system.skill ?? "" : CONFIG.FALLOUT.WEAPON_SKILLS[type];
    if (!skillName) throw fail(409, "fallout.err.weaponSkill");
    sk = a.items.find((i) => i.type === "skill" && i.name === skillName)?.system ?? { value: 0, tag: false, defaultAttribute: "str" };
    const attrKey = type === "custom" ? w.system.attribute : CONFIG.FALLOUT.WEAPON_ATTRIBUTE_OVERRIDE[type] ?? sk.defaultAttribute;
    attribute = a.system.attributes?.[attrKey]?.value;
  }
  if (attribute == null) throw fail(409, "fallout.err.weaponAttr");
  const complication = baseComplication(a) - (w.system.damage?.weaponQuality?.unreliable?.value ? 1 : 0);
  return { attribute, rank: sk.value ?? 0, tag: !!sk.tag, complication };
}
const withOverrides = (base, o) => ({
  attribute: pick(o.attribute, base.attribute, 0, 20, tr("fallout.label.attribute")), rank: pick(o.rank, base.rank, 0, 10, tr("fallout.label.rank")),
  tag: typeof o.tag === "boolean" ? o.tag : base.tag, complication: pick(o.complication, base.complication, 1, 20, tr("fallout.label.complication"))
});

async function rollSkill(user, { actorId, tokenId, skillId, dice, mods, difficulty, ...o }) {
  const a = ownedActor(user, actorId, tokenId), sk = ownedItem(a, skillId, "skill");
  const m = await modsFor(a, { roll: "skill", ...modContext(a, { roll: "skill", skillId }) }, mods, withOverrides(skillBase(a, sk), o)), r = m.base;
  const diff = difficultyOf(difficulty, m);
  const { dicesRolled } = await fallout.Roller2D20.rollD20({
    actor: a, rollname: sk.name, dicenum: diceNum(Math.min(MAX_D20, (dice ?? 2) + m.extraDice)), attribute: r.attribute, skill: r.rank, tag: r.tag, complication: r.complication, difficulty: diff.final
  });
  await pay(a, user, m);
  return { ...d20Result(dicesRolled, { rollname: sk.name, tn: r.attribute + r.rank, difficulty: diff.final, baseDifficulty: diff.base }), mods: modInfo(m) };
}

// Same rules as Dialog2d20: checks and spends ammo.
async function rollWeapon(user, { actorId, tokenId, itemId, dice, mods, difficulty, ...o }) {
  const a = ownedActor(user, actorId, tokenId), w = ownedItem(a, itemId, "weapon");
  if (w.isWeaponBroken) throw fail(409, "fallout.err.weaponBroken");
  const m = await modsFor(a, modContext(a, { roll: "attack", itemId }), mods, withOverrides(weaponBase(a, w), o)), r = m.base;
  const useAmmo = game.settings.get("fallout", "automaticAmmunitionCalculation") && ["character", "robot"].includes(a.type) && w.system.ammo !== "";
  if (useAmmo) {
    const [ammo, shots] = a._getAvailableAmmoType(w.system.ammo);
    if (!ammo || shots < w.system.ammoPerShot) throw fail(409, "fallout.err.noAmmo", { ammo: w.system.ammo });
  } else if (w.system.consumedOnUse && w.system.quantity < 1) throw fail(409, "fallout.err.noItem", { name: w.name });
  const diff = difficultyOf(difficulty, m);
  const { dicesRolled } = await fallout.Roller2D20.rollD20({
    actor: a, item: w, rollname: w.name, dicenum: diceNum(Math.min(MAX_D20, (dice ?? 2) + m.extraDice)), attribute: r.attribute, skill: r.rank, tag: r.tag, complication: r.complication, difficulty: diff.final, rollLocation: true
  });
  if (useAmmo) await a.reduceAmmo(w.system.ammo, w.system.ammoPerShot);
  await pay(a, user, m);
  return { ...d20Result(dicesRolled, { rollname: w.name, tn: r.attribute + r.rank, located: true, difficulty: diff.final, baseDifficulty: diff.base }), mods: modInfo(m) };
}

// Same rule as DialogD6.checkAmmo: each die above the weapon's base damage (without the melee bonus) spends
// ammoPerShot of ammo; gatling spends half. Without enough ammo, it does not roll.
async function rollDamage(user, { actorId, tokenId, itemId, dice, mods }) {
  const a = ownedActor(user, actorId, tokenId), w = ownedItem(a, itemId, "weapon");
  if (w.isWeaponBroken) throw fail(409, "fallout.err.weaponBroken");
  const m = await modsFor(a, modContext(a, { roll: "damage", itemId }), mods, {});
  const sup = a.effects.map(fxOf).find((f) => f?.status === "suppressed"); // suprimido: −rank CD no dano causado
  if (sup) m.notes.push(tr("fallout.note.suppressed", { value: sup.value }));
  const n = Math.max(1, Math.min(30, pick(dice, w.currentWeaponDamage, 1, 30, tr("fallout.label.damageDice")) + m.extraCD - (sup?.value ?? 0)));
  let ammoSpent = 0;
  if (game.settings.get("fallout", "automaticAmmunitionCalculation") && w.system.ammo && ["character", "robot", "vehicle"].includes(a.type)) {
    const melee = ["meleeWeapons", "unarmed"].includes(w.system.weaponType) ? a.system.meleeDamage?.value ?? 0 : 0;
    ammoSpent = Math.max(0, n - parseInt(w.system.damage.rating) - melee) * w.system.ammoPerShot;
    if (w.hasWeaponQuality("gatling")) ammoSpent = Math.floor(ammoSpent * 0.5);
    if (ammoSpent > 0) {
      const [ammo, shots] = a._getAvailableAmmoType(w.system.ammo);
      if (!ammo || shots < ammoSpent) throw fail(409, "fallout.err.ammoShort", { spent: ammoSpent, ammo: w.system.ammo, n });
    }
  }
  const rolled = await fallout.Roller2D20.rollD6({ actor: a.token?.uuid ?? a.uuid, dicenum: n, weapon: w, rollname: w.name });
  if (ammoSpent > 0) await a.reduceAmmo(w.system.ammo, ammoSpent);
  await pay(a, user, m);
  return { mods: modInfo(m), rollname: w.name, dice: rolled.map((d) => ({ face: d.face, result: d.result, effect: d.effect })), total: rolled.reduce((t, d) => t + d.result, 0),
    effects: rolled.reduce((t, d) => t + d.effect, 0), types: Object.entries(w.system.damage?.damageType ?? {}).filter(([, v]) => v).map(([k]) => k), ammoSpent, ammo: w.system.ammo };
}

// ---------- Level up: port of the "Level Up" macro (Combate folder). Every rule is checked here, not in the app. ----------
const xpFor = (lvl) => (lvl * (lvl + 1) / 2) * 100;
async function levelUpData(a) {
  if (!["character", "robot"].includes(a.type)) throw fail(409, "fallout.err.levelType");
  const level = Number(a.system.level?.value || 0), xp = Number(a.system.level?.currentXP || 0);
  let required = Number(a.system.level?.nextLevelXP || 0);
  if (required === 0 && level > 0) required = xpFor(level);
  const next = level + 1;
  const origin = (a.system.origin || "").toLowerCase();
  const isRobot = a.type === "robot" || origin.includes("robot") || origin.includes("handy");
  const isGhoul = origin.includes("ghoul"), isMutant = origin.includes("mutant"), isHuman = !isRobot && !isGhoul && !isMutant;
  const forcedEvo = a.items.some((i) => i.type === "trait" && i.name.startsWith("Forced Evolution"));
  const nightkin = a.items.some((i) => i.type === "trait" && i.name === "Forced Evolution: Safra Nightkin");
  const maxSkill = forcedEvo ? 4 : 6;
  const skills = a.items.filter((i) => i.type === "skill").sort((x, y) => x.name.localeCompare(y.name)).map((i) => {
    const rank = Number(i.system.value || 0);
    return { id: i.id, name: i.name, rank, attr: i.system.defaultAttribute, tag: !!i.system.tag, canUpgrade: rank < maxSkill };
  });
  const pack = game.packs.get("fallout.perks");
  if (!pack) throw fail(500, "fallout.err.noPerkPack");
  const readMags = a.system.readMagazines ?? [];
  const perks = (await pack.getDocuments()).flatMap((perk) => {
    const sys = perk.system, req = sys.requirementsEx || {};
    if ((req.magazineUuids ?? []).some((u) => !readMags.includes(u))) return []; // a magazine perk only shows up after it has been read
    const rankMax = sys.rank?.max || 1;
    const owned = a.items.find((i) => i.type === "perk" && i.name === perk.name);
    const rank = owned ? owned.system.rank?.value || 1 : 0;
    const requiredLevel = (req.level || 1) + rank * (req.levelIncrease || 0);
    const reasons = [];
    if (rank >= rankMax) reasons.push(tr("fallout.reason.maxRank"));
    if (next < requiredLevel) reasons.push(tr("fallout.reason.level", { level: requiredLevel }));
    let primary = "OTHERS", highest = 0;
    for (const [stat, d] of Object.entries(req.attributes ?? {})) {
      if (!(d.value > 0)) continue;
      if ((a.system.attributes?.[stat]?.value ?? 0) < d.value) reasons.push(`${stat.toUpperCase()} ${d.value}`);
      if (d.value > highest) { highest = d.value; primary = stat.toUpperCase(); }
    }
    if (req.notRobot && isRobot) reasons.push(tr("fallout.reason.noRobot"));
    if (req.notGhoul && isGhoul) reasons.push(tr("fallout.reason.noGhoul"));
    if (req.notSupermutant && isMutant) reasons.push(tr("fallout.reason.noMutant"));
    if (req.notHuman && isHuman) reasons.push(tr("fallout.reason.noHuman"));
    return [{ uuid: perk.uuid, name: perk.name, rank, rankMax, requiredLevel, primary, reasons, ownedId: owned?.id ?? null,
      requirements: text(sys.requirements), description: text(sys.description) }];
  });
  // Tag!: the perk turns one more skill into TAG (+2 rank, max 6); the player chooses which one at level up.
  const tagCandidates = skills.filter((k) => !k.tag && k.rank < 6).map(({ id, name, rank, attr }) => ({ id, name, rank, attr }));
  for (const p of perks) if (p.name === "Tag!") p.needsTag = true;
  return { level, next, xp, required, nextThreshold: xpFor(next), canLevel: xp >= required, maxSkill, forcedEvo, maxMental: nightkin ? 8 : 6, skills, perks, tagCandidates };
}

// Perks that change the sheet when chosen: Pain Train gains the "Charge" attack (rank 2: +1 CD and Stun).
async function grantPerk(a, name, rank) {
  if (name !== "Pain Train") return;
  const mine = a.items.find((i) => i.type === "weapon" && i.getFlag(ID, "grant") === "pain-train");
  const stun = rank >= 2;
  if (mine) { await mine.update({ "system.damage.rating": mine.getFlag(ID, "baseRating") + (stun ? 1 : 0), "system.damage.damageEffect.stun.value": stun ? 1 : 0 }); return; }
  const pack = game.packs.get("fallout.weapons"), e = (await pack.getIndex()).find((x) => x.name === "Unarmed Strike");
  if (!e) throw fail(500, "fallout.err.noUnarmed");
  const d = (await pack.getDocument(e._id)).toObject(), base = d.system.damage.rating;
  delete d._id;
  Object.assign(d, { name: "Charge (Pain Train)", flags: { [ID]: { grant: "pain-train", baseRating: base } } });
  Object.assign(d.system, { weaponType: "custom", skill: "Athletics", attribute: "str", equipped: true,
    description: tr("fallout.painTrain.desc") });
  d.system.damage.rating = base + (stun ? 1 : 0);
  d.system.damage.damageEffect.stun.value = stun ? 1 : 0;
  await a.createEmbeddedDocuments("Item", [d]);
}

async function applyLevelUp(user, a, { skillId, perkUuid, extraSkillId }) {
  const data = await levelUpData(a);
  if (!data.canLevel) throw fail(409, "fallout.err.xp", { xp: data.xp, required: data.required });
  const skill = data.skills.find((k) => k.id === skillId);
  if (!skill?.canUpgrade) throw fail(400, "fallout.err.skillUpgrade");
  const perk = perkUuid ? data.perks.find((p) => p.uuid === perkUuid) : null;
  if (perkUuid && (!perk || perk.reasons.length)) throw fail(400, "fallout.err.perkUnavailable");
  const tagSkill = perk?.needsTag ? data.tagCandidates.find((k) => k.id === extraSkillId) : null;
  if (perk?.needsTag && !tagSkill) throw fail(400, "fallout.err.tagSkill");

  await a.update({ "system.level.value": data.next, "system.level.nextLevelXP": data.nextThreshold }, { sheetRelayUser: user.id });
  await a.updateEmbeddedDocuments("Item", [{ _id: skill.id, "system.value": skill.rank + 1 }]);
  const hpEffect = a.effects.find((e) => e.name === "Bônus de Level Up (HP)");
  if (hpEffect) {
    const changes = foundry.utils.deepClone(hpEffect.changes);
    changes[0].value = String(parseInt(changes[0].value) + 1);
    await hpEffect.update({ changes });
  } else {
    await a.createEmbeddedDocuments("ActiveEffect", [{ name: "Bônus de Level Up (HP)", icon: "icons/svg/health.svg", transfer: true,
      changes: [{ key: "system.health.bonus", mode: CONST.ACTIVE_EFFECT_MODES.ADD, value: "1" }] }]);
  }
  if (perk?.ownedId) await a.updateEmbeddedDocuments("Item", [{ _id: perk.ownedId, "system.rank.value": perk.rank + 1 }]);
  else if (perk) {
    const itemData = (await fromUuid(perk.uuid)).toObject();
    if (itemData.system?.rank) itemData.system.rank.value = 1;
    await a.createEmbeddedDocuments("Item", [itemData]);
  }
  if (perk) await grantPerk(a, perk.name, perk.ownedId ? perk.rank + 1 : 1);
  if (tagSkill) { // becomes TAG and gains +2 rank (counts the level up's +1, if it is the same skill)
    const cur = a.items.get(tagSkill.id);
    await cur.update({ "system.tag": true, "system.value": Math.min(6, Number(cur.system.value) + 2) });
  }
  const esc = foundry.utils.escapeHTML;
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: a }), whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<div style="border-left:4px solid #DDB724;padding:8px"><h3>${tr("fallout.lvl.title", { level: data.next })}</h3><p><b>${esc(a.name)}</b> ${tr("fallout.lvl.via", { user: esc(user.name) })}</p>
      <ul><li><b>HP:</b> ${tr("fallout.lvl.hp")}</li><li><b>${tr("fallout.lvl.skill")}:</b> ${esc(skill.name)} (+1)</li><li><b>${tr("fallout.lvl.perk")}:</b> ${perk ? esc(perk.name) : tr("fallout.lvl.none")}</li>${tagSkill ? `<li><b>TAG (Tag!):</b> ${esc(tagSkill.name)} (+2)</li>` : ""}</ul></div>`
  });
}

// ---------- Compendia: search and add items/perks to the sheet ----------
const ADDABLE = ["ammo", "apparel", "apparel_mod", "books_and_magz", "consumable", "miscellany", "weapon", "weapon_mod", "robot_armor", "robot_mod", "perk"];
const itemPack = (id) => { const p = game.packs.get(id); if (p?.documentName !== "Item") throw fail(404, "fallout.err.noPack"); return p; };


// ---------- Utilities: port of the ammo and loot macros ----------
// The character comes from the sheet open in the app (in the macro it was game.user.character); the choices come from the app instead of the dialog.
const ammoPack = () => game.packs.get("fallout.ammunition");
async function ammoTypes() {
  const all = (await ammoPack().getDocuments()).sort((x, y) => x.name.localeCompare(y.name));
  const seen = new Set();
  return all.filter((x) => !seen.has(x.name) && seen.add(x.name)).map((x) => ({ id: x.id, name: x.name, quantityRoll: x.system.quantityRoll || "1" }));
}
async function getAmmo(user, { actorId, ammoId, dice, fixed }) {
  const actor = ownedActor(user, actorId);
  const src = typeof ammoId === "string" ? await ammoPack().getDocument(ammoId) : null;
  if (!src) throw fail(404, "fallout.err.noAmmoType");
  const d = pick(dice, 0, 0, 10, tr("fallout.label.extraDice")), f = pick(fixed, 0, -20, 50, tr("fallout.label.fixedBonus"));
  let formula = src.system.quantityRoll || "1";
  if (d > 0) formula += ` + ${d}dc`;
  if (f) formula += ` + ${f}`;
  const roll = await new Roll(formula).evaluate();
  fallout.Roller2D20.showDiceSoNice?.(roll);
  const total = Math.max(1, roll.total);
  const owned = actor.items.find((i) => i.type === "ammo" && i.name === src.name);
  if (owned) await owned.update({ "system.quantity": (owned.system.quantity ?? 0) + total });
  else { const data = game.items.fromCompendium(src); data.system.quantity = total; await actor.createEmbeddedDocuments("Item", [data]); }
  await roll.toMessage({ speaker: ChatMessage.getSpeaker({ actor }), flavor: tr("fallout.ammo.got", { actor: foundry.utils.escapeHTML(actor.name), total, name: src.name, formula }) });
  return { lines: [`${total}x ${src.name} (${formula})`] };
}


const skillLabel = (sk) => tr(`fallout.skill.${sk}`);
const attrLabel = (k) => tr(`fallout.attr.${k}`);


const lootPack = () => game.packs.get("fallout.rollable_tables");
const lootShort = (n) => n.replace(/^(Loot|Revista): /, "");
const isMag = (t) => /^Revista:/.test(t.name) || /Revistas|Magazine/i.test(t.name);
async function lootTablesOf() {
  return (await lootPack().getDocuments())
    .filter((t) => /^(Loot:|Revista:)/.test(t.name) && !/\(Tipo\)/.test(t.name) && t.results.some((r) => r.documentUuid))
    .sort((x, y) => x.name.localeCompare(y.name));
}
async function lootTables() { return (await lootTablesOf()).map((t) => ({ id: t.id, name: lootShort(t.name), magazine: isMag(t) })); }

// Logic of the "Rolar Loot" macro, unchanged except for the received character.
function lootRunner(actor) {
  const STACK = ["ammo", "consumable", "miscellany"];
  const norm = (s) => String(s || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[-_]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  let nameIdx = null;
  const findByName = async (name) => {
    if (!nameIdx) { nameIdx = []; for (const k of ["consumables", "miscellany"]) { const idx = await game.packs.get("fallout." + k).getIndex(); for (const e of idx) nameIdx.push({ n: norm(e.name), uuid: `Compendium.fallout.${k}.Item.${e._id}` }); } }
    const n = norm(name); let best = null, bd = 99;
    for (const e of nameIdx) { const d = e.n === n ? 0 : lev(e.n, n); if (d < bd) { bd = d; best = e; } }
    return bd <= 2 ? best : null;
  };
  const giveDoc = async (doc, qty = null) => {
    if (qty === null) {
      qty = 1;
      if (doc.type === "ammo" && doc.system.quantityRoll) { const r = await new Roll(doc.system.quantityRoll).evaluate(); fallout.Roller2D20.showDiceSoNice?.(r); qty = Math.max(1, r.total); }
    }
    const owned = STACK.includes(doc.type) ? actor.items.find((i) => i.type === doc.type && i.name === doc.name) : null;
    if (owned) await owned.update({ "system.quantity": (owned.system.quantity ?? 0) + qty });
    else { const data = game.items.fromCompendium(doc); data.system.quantity = qty; await actor.createEmbeddedDocuments("Item", [data]); }
    return qty;
  };
  const qtyOf = async (s) => { const f = s.replace(/\s+/g, "").replace(/cd/gi, "dc"); const r = await new Roll(f).evaluate(); if (/dc/i.test(f)) fallout.Roller2D20.showDiceSoNice?.(r); return Math.max(1, r.total); };
  const giveBottles = async (qty) => {
    const junk = (await game.packs.get("fallout.miscellany").getDocuments()).find((d) => d.name === "Junk");
    const NAME = "Garrafa de Vidro (Sucata)";
    const owned = actor.items.find((i) => i.name === NAME);
    if (owned) { await owned.update({ "system.quantity": (owned.system.quantity ?? 0) + qty }); return; }
    const data = junk ? game.items.fromCompendium(junk) : { type: "miscellany", name: NAME, system: {} };
    data.name = NAME; data.system.quantity = qty;
    data.system.description = tr("fallout.loot.junkDesc");
    await actor.createEmbeddedDocuments("Item", [data]);
  };
  const rollTable = async (table, depth, lines) => {
    if (depth > 6) { lines.push(tr("fallout.loot.chain")); return false; }
    for (let tries = 0; tries < 6; tries++) {
      const draw = await table.draw({ displayChat: false, recursive: false });
      fallout.Roller2D20.showDiceSoNice?.(draw.roll);
      const r = draw.results[0];
      if (!r) continue;
      return await resolveResult(table, r, depth, lines);
    }
    lines.push(tr("fallout.loot.noResult", { table: lootShort(table.name) }));
    return false;
  };
  const resolveResult = async (table, r, depth, lines) => {
    const raw = String(r.name || r.text || "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").trim();
    if (r.documentUuid) {
      const doc = await fromUuid(r.documentUuid);
      if (doc instanceof RollTable) { lines.push(tr("fallout.loot.drew", { table: lootShort(doc.name).replace(" (Issues)", "") })); return await rollTable(doc, depth + 1, lines); }
      if (doc) { const qf = r.flags?.world?.qty; const q = await giveDoc(doc, qf ? await qtyOf(qf) : null); lines.push(`${q}x ${doc.name}`); return true; }
    }
    const t = norm(raw);
    if (/^re ?roll/.test(t)) { lines.push(tr("fallout.loot.reroll")); return await rollTable(table, depth + 1, lines); }
    if (/^vazia|^empty/.test(t)) { lines.push(tr("fallout.loot.nothing")); return true; }
    const cm = raw.match(/(\d+d\d+)\s*caps/i);
    if (cm) { const rc = await new Roll(cm[1]).evaluate(); fallout.Roller2D20.showDiceSoNice?.(rc); const add = Math.max(1, rc.total); await actor.update({ "system.currency.caps": (actor.system.currency?.caps ?? 0) + add }); lines.push(tr("fallout.loot.caps", { n: add })); return true; }
    const parts = raw.replace(/\(.*?\)/g, "").split(/\s+e\s+|,\s*/i).map((x) => x.trim()).filter(Boolean);
    const got = [];
    for (const p of parts) {
      const m = p.match(/^(\d+(?:\s*\+\s*\d+\s*cd)?)\s+(.+)$/i);
      if (!m) continue;
      const name = m[2];
      if (/garrafa/i.test(name)) { const q = await qtyOf(m[1]); await giveBottles(q); got.push(`${q}x Garrafa de Vidro (Sucata)`); continue; }
      const hit = await findByName(name);
      if (hit) { const d = await fromUuid(hit.uuid); const q = await qtyOf(m[1]); await giveDoc(d, q); got.push(`${q}x ${d.name}`); }
    }
    if (got.length) { lines.push(got.join(tr("fallout.loot.and"))); return true; }
    lines.push(tr("fallout.loot.manual", { raw }));
    return true;
  };
  return rollTable;
}
async function rollLoot(user, { actorId, counts }) {
  const actor = ownedActor(user, actorId);
  if (!counts || typeof counts !== "object") throw fail(400, "fallout.err.pickTables");
  const tables = new Map((await lootTablesOf()).map((t) => [t.id, t]));
  const plan = Object.entries(counts).map(([id, n]) => [tables.get(id), pick(n, 0, 0, 20, tr("fallout.label.rollsPerTable"))]).filter(([, n]) => n > 0);
  if (plan.some(([t]) => !t)) throw fail(400, "fallout.err.badTable");
  if (!plan.length) throw fail(400, "fallout.err.pickRoll");
  if (plan.reduce((t, [, n]) => t + n, 0) > 40) throw fail(400, "fallout.err.maxRolls");
  const rollTable = lootRunner(actor), summary = [];
  for (const [table, n] of plan) for (let i = 0; i < n; i++) {
    const lines = [];
    await rollTable(table, 0, lines);
    summary.push(`<li><i>${lootShort(table.name)}:</i> ${lines.join(" → ")}</li>`);
  }
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor }), content: `<div style="border-left:4px solid #DDB724;padding:6px 10px">${tr("fallout.loot.rolled", { actor: foundry.utils.escapeHTML(actor.name) })}<ul style="margin:4px 0">${summary.join("")}</ul></div>` });
  return { lines: summary.map(text) };
}


export const handlers = {
  rollSkill, rollWeapon, rollDamage,
  levelUpOptions: async (user, { actorId }) => levelUpData(ownedActor(user, actorId)),
  async levelUp(user, { actorId, skillId, perkUuid, extraSkillId }) {
    const a = ownedActor(user, actorId);
    await applyLevelUp(user, a, { skillId, perkUuid, extraSkillId });
    return sheet(a);
  },
  // Direct sheet edits (the player trusts the table; limits only prevent absurd values).
  async setLuck(user, { actorId, value }) {
    const a = ownedActor(user, actorId), max = a.system.attributes?.luc?.value ?? 10;
    await a.update({ "system.luckPoints": pick(value, null, 0, max, tr("fallout.label.luck", { max })) }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  async setAttribute(user, { actorId, key, value }) {
    const a = ownedActor(user, actorId);
    if (!["str", "per", "end", "cha", "int", "agi", "luc"].includes(key)) throw fail(400, "fallout.err.badAttr");
    await a.update({ [`system.attributes.${key}.value`]: pick(value, null, 1, 15, tr("fallout.label.attribute")) }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  async setSkillTag(user, { actorId, skillId, tag }) {
    const a = ownedActor(user, actorId), sk = ownedItem(a, skillId, "skill");
    if (typeof tag !== "boolean") throw fail(400, "fallout.err.tagBool");
    await sk.update({ "system.tag": tag }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  async setCaps(user, { actorId, value }) {
    const a = ownedActor(user, actorId);
    await a.update({ "system.currency.caps": pick(value, null, 0, 1_000_000, tr("fallout.label.caps")) }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  async setQuantity(user, { actorId, itemId, quantity }) {
    const a = ownedActor(user, actorId), it = ownedItem(a, itemId);
    if (!["ammo", "consumable", "miscellany"].includes(it.type)) throw fail(400, "fallout.err.qtyType");
    await it.update({ "system.quantity": pick(quantity, null, 0, 99_999, tr("fallout.label.quantity")) }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  // Injury mark: 0 = no injury, 1 = treated, 2 = open. Part state same as the system sheet's _getBodyPartStatus.
  async setInjury(user, { actorId, part, index, value }) {
    const a = ownedActor(user, actorId);
    const injuries = a.system.body_parts?.[part]?.injuries;
    if (!Array.isArray(injuries)) throw fail(400, "fallout.err.badBodyPart");
    if (!Number.isInteger(index) || index < 0 || index >= injuries.length) throw fail(400, "fallout.err.badInjury");
    if (![0, 1, 2].includes(value)) throw fail(400, "fallout.err.injuryValue");
    const next = [...injuries]; next[index] = value;
    const worst = Math.max(...next);
    await a.update({ [`system.body_parts.${part}.injuries`]: next, [`system.body_parts.${part}.status`]: worst === 2 ? "crippled" : worst === 1 ? "wounded" : "healthy" }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  ammoTypes: () => ammoTypes(), getAmmo,  lootTables: () => lootTables(), rollLoot,
  listPacks: () => game.packs.filter((p) => p.documentName === "Item").map((p) => ({ id: p.collection, label: p.metadata.label })),
  async searchCompendium(user, { pack, query = "" }) {
    const q = String(query).toLowerCase();
    const idx = await itemPack(pack).getIndex({ fields: ["type"] });
    return idx.filter((e) => ADDABLE.includes(e.type) && e.name.toLowerCase().includes(q))
      .sort((x, y) => x.name.localeCompare(y.name)).slice(0, 50).map((e) => ({ uuid: e.uuid, name: e.name, type: e.type }));
  },
  async addItem(user, { actorId, uuid }) {
    const a = ownedActor(user, actorId);
    if (typeof uuid !== "string" || !uuid.startsWith("Compendium.")) throw fail(400, "fallout.err.badItem");
    const doc = await fromUuid(uuid);
    if (doc?.documentName !== "Item" || !ADDABLE.includes(doc.type)) throw fail(400, "fallout.err.itemType");
    if (doc.type === "perk" && a.items.some((i) => i.type === "perk" && i.name === doc.name)) throw fail(409, "fallout.err.perkOwned");
    await a.createEmbeddedDocuments("Item", [doc.toObject()], { sheetRelayUser: user.id });
    return sheet(a);
  },
  getCharacter: (user, { actorId }) => sheet(ownedActor(user, actorId)),
  // GM panel: active scene NPCs (tokens of actors with no player owner), with what the app needs to roll for them.
  damagePerks, defensePerks, applyDamage,
  // Possible damage targets: all tokens of the active scene.
  sceneTargets(user) {
    if (!user.isGM) throw fail(403, "fallout.err.gmOnly");
    const sc = game.scenes.active;
    return { sceneId: sc?.id ?? null, targets: (sc?.tokens.contents ?? []).filter((t) => t.actor).map((t) => ({ tokenId: t.id, actorId: t.actor.id, name: t.name, type: t.actor.type, weapons: t.actor.items.filter((i) => i.type === "weapon").map((i) => ({ id: i.id, name: i.name })), hp: t.actor.system.health ? { value: t.actor.system.health.value, max: t.actor.system.health.max } : null, dead: t.actor.effects.some((e) => e.statuses?.has("dead")), fx: fxList(t.actor) })) };
  },
  sceneNpcs(user) {
    if (!user.isGM) throw fail(403, "fallout.err.gmOnly");
    const folder = playersFolder(), inPlayers = (a) => !!folder && (a.folder === folder || !!a.folder?.ancestors?.includes(folder)); // player = actor in the players' folder
    const scene = game.scenes.active;
    const npcs = (scene?.tokens.contents ?? []).filter((t) => t.actor && LISTED.includes(t.actor.type)).map((t) => {
      const sh = sheet(t.actor);
      return { tokenId: t.id, actorId: t.actor.id, name: t.name, type: t.actor.type, player: t.actorLink && inPlayers(t.actor), disposition: t.disposition, hp: sh.hp, hidden: t.hidden, dead: t.actor.effects.some((e) => e.statuses?.has("dead")), fx: fxList(t.actor), conditions: [...t.actor.statuses].filter((c) => !c.startsWith("sr-")),
        weapons: sh.weapons, skills: sh.skills, creature: sh.creature };
    });
    return { scene: scene?.name ?? null, npcs, statuses: CONFIG.statusEffects.filter((x) => !String(x.id).startsWith("sr-")).map((x) => ({ id: x.id, name: game.i18n.localize(x.name ?? x.label ?? x.id) })) };
  },
  // Condition (Foundry status) on a scene NPC: GM only.
  async npcStatus(user, { actorId, tokenId, condition, active }) {
    const a = ownedActor(user, actorId, tokenId);
    if (!tokenId || !CONFIG.statusEffects.some((x) => x.id === condition)) throw fail(400, "fallout.err.badCondition");
    await a.toggleStatusEffect(condition, { active: !!active });
    return { ok: true };
  },
  // Only HP is editable: the Relay is a GM, so what the app can change has to be a fixed list.
  async updateCharacter(user, { actorId, tokenId, hp }) {
    const a = ownedActor(user, actorId, tokenId);
    if (!Number.isInteger(hp)) throw fail(400, "fallout.err.hpInt");
    await a.update({ "system.health.value": Math.clamp(hp, 0, a.system.health.max) }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  // New player sheet: name, type, origin, S.P.E.C.I.A.L. and up to 3 TAG skills (rank 2, book rule).
  async createCharacter(user, { name, actorType: type, origin = "", attributes = {}, tags = [] }) { // "type" is already the command name
    name = typeof name === "string" ? name.trim() : "";
    if (!name || name.length > 60) throw fail(400, "fallout.err.badName");
    if (!["character", "robot"].includes(type)) throw fail(400, "fallout.err.badType");
    if (typeof origin !== "string" || origin.length > 60) throw fail(400, "fallout.err.badOrigin");
    const KEYS = ["str", "per", "end", "cha", "int", "agi", "luc"];
    for (const k of KEYS) if (!Number.isInteger(attributes[k]) || attributes[k] < 1 || attributes[k] > 12) throw fail(400, "fallout.err.attrInvalid", { key: k });
    if (!Array.isArray(tags) || tags.length > 3 || tags.some((t) => typeof t !== "string")) throw fail(400, "fallout.err.tagsMax");
    const folder = playersFolder();
    const a = await Actor.create({
      name, type, folder: folder?.id ?? null,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER, [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }, // same as the other sheets in the folder
      system: { origin, attributes: Object.fromEntries(KEYS.map((k) => [k, { value: attributes[k] }])), ...(type === "robot" ? { bodyType: "robot" } : {}) }
    }, { sheetRelayUser: user.id });
    // the system adds the 17 skills on creation; waits for them to exist before marking the TAG ones
    for (let i = 0; i < 20 && !a.items.some((it) => it.type === "skill"); i++) await new Promise((r) => setTimeout(r, 150));
    if (/super mutant/i.test(origin)) { // Super Mutant trait (skills up to 4 at level up)
      const fe = await fromUuid("Compendium.fallout.traits.Item.3W3LSN9wwD48gaaL");
      if (fe) await a.createEmbeddedDocuments("Item", [fe.toObject()]);
    }
    const tagged = a.items.filter((it) => it.type === "skill" && tags.includes(it.name));
    if (tagged.length) await a.updateEmbeddedDocuments("Item", tagged.map((it) => ({ _id: it.id, "system.tag": true, "system.value": 2 })));
    await a.update({ "system.health.value": a.system.health?.max ?? 0 }); // the system creates with HP 0; a new sheet starts with full HP
    return summary(a);
  },
};

// ---------- Fallout hooks (called on ready by the core) ----------
// Effects placed by perks on targets (Suppressor, Tenderizer) last until the end of the target's next turn and vanish on scene change or
// end of combat (only the relay client deletes them). The system's "New Scene (GM)" and "New Session (GM)" macros also reset the uses
// per scene and clear these effects (runs on the client of the GM who ran the macro).
export function register() {
  const clearFx = () => Promise.all((game.scenes.active?.tokens.contents ?? []).flatMap((t) => (t.actor?.effects ?? []).filter((e) => e.getFlag(ID, "fx")).map((e) => e.delete())));
  Hooks.on("updateScene", (s, d) => d.active && isRelay() && clearFx());
  Hooks.on("deleteCombat", () => isRelay() && clearFx());
  Hooks.on("combatTurnChange", async (combat, prior) => {
    if (!isRelay()) return;
    const a = combat.combatants.get(prior.combatantId)?.actor; // the turn that just ended
    for (const e of a?.effects ?? []) {
      const fx = e.getFlag(ID, "fx"); if (!fx) continue;
      if ((fx.turnsLeft ?? 1) <= 1) await e.delete(); else await e.setFlag(ID, "fx", { ...fx, turnsLeft: fx.turnsLeft - 1 });
    }
  });
  const mac = globalThis.fallout?.macros;
  if (!game.user.isGM || !mac) return;
  for (const k of ["newScene", "newSession"]) {
    const orig = mac[k];
    if (typeof orig !== "function") continue;
    mac[k] = async function (...args) {
      const r = await orig.apply(this, args);
      await Promise.all(game.actors.filter((a) => a.items.some((i) => i.getFlag(ID, "used"))).map((a) => resetUses(a, "scene")));
      await clearFx();
      return r;
    };
  }
}
