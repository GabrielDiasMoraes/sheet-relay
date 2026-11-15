// Avatar Legends (system "legends"): sheet, 2d6 rolls with the system's card, game state, texts and creation.
// Creation follows the table's "Character Manager" macro (same compendium folders, same sheet format).
import { chooseMods, fail, ownedActor, ownedItem, pick, playersFolder, spendUses, text, tr } from "../../api.js";

export const LISTED = ["player"];
const PACK = "legends.playbooks"; // the table's pt-BR playbooks and items
const STATS = ["creativity", "focus", "harmony", "passion"];
const TRAINING = ["water", "earth", "fire", "air", "weapons", "technology"];
// journal page names (lookup identifier); the displayed label comes from legends.training.<key>
const TRAINING_LABEL = { water: "Dobra de Água", earth: "Dobra de Terra", fire: "Dobra de Fogo", air: "Dobra de Ar", weapons: "Armas", technology: "Tecnologia" };
const SUBTRAINING_JOURNAL = "Dominações Especializadas"; // one page per training, each <h3> is an option (as in the macro)
const ADV = ["playbook-move", "other-move", "shift-center", "moment"];
const MARK = /\(\s*[xX]?\s*\)/g; // "( )" and "(x)" of the playbook choices
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
const render = (...a) => (foundry.applications?.handlebars?.renderTemplate ?? renderTemplate)(...a); // late lookup: the file loads outside Foundry
const byType = (a, t) => a.items.filter((i) => i.type === t).sort((x, y) => (x.sort - y.sort) || x.name.localeCompare(y.name));
// description without HTML, but with one line per paragraph/list item (Avatar sheets have long lists)
const lines = (html) => text(String(html ?? "").replace(/<\/(p|li|h\d)>|<br\s*\/?>/gi, "$&\n")).replace(/\n\s*\n+/g, "\n");
const paragraphs = (t) => String(t).split(/\n+/).filter((l) => l.trim()).map((l) => `<p>${esc(l)}</p>`).join("\n");

// The macro stores appearance, history and connections in the description: "<p>Aparência: …</p><p>História: …</p><p>Conexões: …</p>".
const PROFILE = { look: "Aparência", history: "História", connections: "Conexões" };
function profile(s) {
  const t = lines(s.description);
  const marks = [...t.matchAll(/^(Aparência|História|Conexões):[ \t]*/gm)];
  const part = (label) => { const i = marks.findIndex((m) => m[1] === label); return i < 0 ? null : t.slice(marks[i].index + marks[i][0].length, marks[i + 1]?.index ?? t.length).trim(); };
  if (!marks.length) return { look: s.look ?? "", history: t, connections: s.connections ?? "" };
  return { look: s.look || part("Aparência") || "", history: part("História") ?? "", connections: s.connections || part("Conexões") || "" };
}
const profileHtml = (p) => Object.entries(PROFILE).map(([k, label]) => `<p>${label}: ${esc(p[k]).replace(/\n/g, "<br>")}</p>`).join("\n\n");

export const summary = (a) => ({ id: a.id, name: a.name, type: a.type, playbook: a.system.playbook ?? "", fatigue: a.system.fatigue ?? null });

const textItem = (i) => (i ? { id: i.id, name: i.name, description: lines(i.system.description) } : null);
const sheet = (a) => {
  const s = a.system;
  return {
    ...summary(a), ...profile(s),
    background: s.background ?? "", demeanor: s.demeanor ?? "", hometown: s.hometown ?? "", fightingStyle: s.fighting_style ?? "", notes: s.notes ?? "",
    training: s.training, stats: s.stats, balance: s.balance,
    growth: { value: s.growth?.value ?? 0, max: s.growth?.max ?? 4, advancements: Object.fromEntries(ADV.map((k) => [k, s.growth?.advancements?.[k] ?? { value: 0, max: 0 }])) },
    feature: textItem(byType(a, "feature")[0]),
    momentOfBalance: textItem(byType(a, "moment-of-balance")[0]),
    growthQuestions: byType(a, "growth-question").map(textItem),
    conditions: byType(a, "condition").map((i) => ({ id: i.id, name: i.name, checked: !!i.system.checked, description: lines(i.system.description) })),
    statuses: byType(a, "status").map((i) => ({ id: i.id, name: i.name, checked: !!i.system.checked, positive: i.system.type !== "negative", description: lines(i.system.description) })),
    moves: byType(a, "move").map((i) => ({ id: i.id, name: i.name, category: i.system.category || "playbook", rollable: !!i.system.rollable || !!i.system.rollStat, rollStat: i.system.rollStat || "", description: lines(i.system.description) })),
    techniques: byType(a, "technique").map((i) => ({
      id: i.id, name: i.name, approach: i.system.approach, basic: !!i.system.basic, training: i.system.training || "",
      learned: !!i.system.learned, practiced: !!i.system.practiced, mastered: !!i.system.mastered, description: lines(i.system.description)
    }))
  };
};

// Fields the app can change (the relay user is a GM: everything outside this is refused). Value validated here, not in the app.
const int = (min, max) => (v, label) => pick(v, undefined, min, max, label) ?? (() => { throw fail(400, "legends.err.valueMissing", { label }); })();
const str = (max) => (v, label) => { if (typeof v !== "string" || v.length > max) throw fail(400, "legends.err.badText", { label }); return v; };
const bool = (v, label) => { if (typeof v !== "boolean") throw fail(400, "legends.err.badBool", { label }); return v; };
const FIELDS = {
  name: (v) => { v = str(60)(v, tr("legends.lbl.name")).trim(); if (!v) throw fail(400, "legends.err.nameEmpty"); return v; },
  "system.fatigue.value": int(0, 5),
  "system.balance.value": int(-3, 3),
  "system.balance.center": int(-3, 3),
  "system.growth.value": int(0, 4),
  ...Object.fromEntries(ADV.map((k) => [`system.growth.advancements.${k}.value`, int(0, 2)])),
  ...Object.fromEntries(STATS.map((k) => [`system.stats.${k}`, int(-3, 4)])),
  ...Object.fromEntries(TRAINING.map((k) => [`system.training.${k}`, bool])),
  ...Object.fromEntries(["background", "demeanor", "hometown", "fighting_style"].map((k) => [`system.${k}`, str(200)])),
  "system.notes": str(10000),
  ...Object.fromEntries(Object.keys(PROFILE).map((k) => [`profile.${k}`, str(10000)])) // appearance/history/connections, in the macro's format
};
const ITEM_FIELDS = { condition: ["checked"], status: ["checked"], technique: ["learned", "practiced", "mastered"] };
const TEXT_ITEMS = ["feature", "moment-of-balance", "growth-question", "move"]; // texts with "( )" choices or "____" blanks

// Engine context for the roll requested by the app (move or stat/principle directly).
// Combat approaches (defaults checked against the world texts: Advance=Passion, Defend=Focus, Evade=Creativity or Harmony): they roll the default stat (the player changes it in the popup) and the move and technique rules apply.
const APPROACH = { "advance-attack": ["Avançar e Atacar", "passion"], "defend-maneuver": ["Defender e Manobrar", "focus"], "evade-observe": ["Evadir e Observar", "creativity"] };
export function modContext(a, { itemId, stat, approach }) {
  if (approach) {
    if (!APPROACH[approach]) throw fail(400, "legends.err.badApproach");
    return { roll: ["technique", "move"], skill: [APPROACH[approach][0], "qualquer"], attribute: stat || APPROACH[approach][1], evalMax: () => null, itemFilter: (i) => i.type === "condition" ? false : i.type === "status" ? !!i.system.checked : i.type !== "move" || !["basic", "balance"].includes(i.system.category) };
  }
  const item = itemId ? ownedItem(a, itemId, "move") : null;
  const st = stat || item?.system.rollStat || undefined;
  const roll = item ? ["move", ...(/resistir/i.test(item.name) ? ["resist", "balance"] : [])] : st === "top" || st === "bottom" ? ["principle"] : ["stat"];
  // Conditions the system already applies by itself (getConditionForMove); statuses only count when marked; a basic/balance move only counts when it is the one being rolled.
  const itemFilter = (i) => i.type === "condition" ? false : i.type === "status" ? !!i.system.checked : i.type !== "move" || !["basic", "balance"].includes(i.system.category) || i.id === itemId;
  return { roll, skill: item ? [item.name, "qualquer"] : undefined, attribute: st, evalMax: () => null, itemFilter };
}
// Selected rules: stat swap, fixed stat, +1 up to the maximum, add to the result, forced result; the rest becomes a chat warning.
async function applyMods(a, ctx, keys) {
  const m = await chooseMods(a, ctx, keys, {}, () => NaN);
  const out = { stat: null, fixed: null, attr: [], add: 0, forced: null, notes: m.notes.map((n) => n.other), used: m.chosen, cost: m.cost };
  for (const e of m.effects) {
    const rule = m.chosen.find((c) => c.key === e.from), note = () => { const n = `${rule.itemName}: ${rule.text}`; if (!out.notes.includes(n)) out.notes.push(n); };
    const v = String(e.value ?? e.formula ?? "").trim();
    if (e.set === "attribute" && STATS.includes(v)) out.stat = v;
    else if (e.set === "attribute" && /^-?\d+$/.test(v)) out.fixed = Number(v);
    else if (e.set === "result" && /^\d+\+?$/.test(v)) out.forced = parseInt(v, 10);
    else if (typeof e.add === "string" && e.add.startsWith("attribute:") && /^[+-]?\d+$/.test(v)) out.attr.push({ stat: e.add.slice(10), n: Number(v), max: e.max ?? 99 });
    else if (e.add === "result" && /^[+-]?\d+$/.test(v)) out.add += Number(v);
    else note(); // principle swap, per-condition value, free text…: the player applies it
  }
  return out;
}
const NO_MODS = { stat: null, fixed: null, attr: [], add: 0, forced: null, notes: [], used: [], cost: { ap: 0, luck: 0, uses: [] } };

async function postRoll(a, { item, label, stat, bonus, penalty, m = NO_MODS }) {
  const s = a.system, npc = stat === "npc"; // NPC: plain 2d6, only bonus and penalty
  stat = m.stat ?? stat;
  const principle = stat === "top" ? s.balance.topTrack : stat === "bottom" ? s.balance.bottomTrack : null;
  if (!npc && !principle && !STATS.includes(stat)) throw fail(400, "legends.err.pickStat");
  let value = npc ? 0 : principle ? a.getPrincipleValue(principle) ?? 0 : s.stats[stat] ?? 0;
  if (m.fixed != null) value = m.fixed;
  for (const x of m.attr) if (x.stat === stat && value < x.max) value = Math.min(x.max, value + x.n);
  const condition = item ? a.getConditionForMove(item.name) : null;
  const cond = Number(condition?.penalty?.penalty ?? 0);
  bonus = pick(bonus, 0, 0, 9, tr("legends.lbl.bonus")); penalty = pick(penalty, 0, 0, 9, tr("legends.lbl.penalty"));
  if (m.add > 0) bonus += m.add; else penalty += -m.add;
  // same formula as the system's dice.js: 2d6 ± stat ± condition + bonus − penalty
  const formula = ["2d6", `${value < 0 ? "-" : "+"} ${Math.abs(value)}`, cond ? `${cond < 0 ? "-" : "+"} ${Math.abs(cond)}` : "", bonus ? `+ ${bonus}` : "", penalty ? `- ${penalty}` : ""].filter(Boolean).join(" ");
  const roll = await new Roll(formula).evaluate();
  const name = npc ? a.name : principle ?? game.i18n.localize(`legends.stats.${stat}`);
  const total = m.forced ?? roll.total; // "treat as 10+": the dice stay as rolled, the total is the forced one
  const content = await render("systems/legends/templates/partials/chat/stat-roll.hbs", { name, move: item?.name ?? label, roll: await roll.render(), total });
  await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), rolls: [roll], content, sound: CONFIG.sounds.dice });
  if (m.used.length || m.notes.length) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<p><b>${tr("mod.used")}:</b> ${m.used.map((x) => `${esc(x.itemName)}: ${esc(x.label)}`).join("; ") || "—"}${m.forced != null ? tr("legends.chat.forced", { n: m.forced }) : ""}</p>${m.notes.map((n) => `<p><em>${esc(n)}</em></p>`).join("")}` });
  await spendUses(a, m.cost);
  return {
    move: item?.name ?? label ?? null, approach: item ? undefined : label, stat, statName: principle ?? stat, statValue: value, formula, total,
    dice: roll.dice[0].results.map((r) => r.result), condition: condition ? { name: condition.name, value: cond } : null, bonus, penalty,
    outcome: total >= 10 ? "full" : total >= 7 ? "hit" : "miss", mods: m.used.length || m.notes.length ? { used: m.used.map((x) => `${x.itemName}: ${x.label}`), notes: m.notes } : undefined
  };
}

// ---------- Compendium (same folders the macro uses) ----------
async function compendium() {
  const pack = game.packs.get(PACK) ?? (() => { throw fail(500, "legends.err.noPack", { pack: PACK }); })();
  const idx = await pack.getIndex({ fields: ["system.category", "system.basic", "system.training", "system.approach", "system.rollStat", "folder"] });
  const folder = (name) => pack.folders.find((f) => f.name.localeCompare(name, "pt", { sensitivity: "base" }) === 0);
  const tree = (f) => (f ? [f.id, ...pack.folders.filter((c) => c.folder?.id === f.id).flatMap(tree)] : []);
  const inFolder = (f) => { const ids = tree(f); return idx.filter((e) => ids.includes(e.folder)); };
  return { pack, idx, folder, inFolder };
}
const docs = (pack, entries) => Promise.all(entries.map((e) => pack.getDocument(e._id)));
const subTrainings = () => {
  const j = game.journal.getName(SUBTRAINING_JOURNAL);
  return Object.fromEntries(TRAINING.map((k) => {
    const html = j?.pages.getName(TRAINING_LABEL[k])?.text?.content ?? "";
    return [k, [...html.matchAll(/<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3|$)/gi)].map((m) => ({ name: text(m[1]), description: lines(m[2]) })).filter((x) => x.name)];
  }));
};
// Playbook options: items of the folder with its name + items attached to the playbook (without repeating names).
async function playbookParts(c, id) {
  const e = c.idx.find((x) => x._id === id && x.type === "playbook") ?? (() => { throw fail(400, "legends.err.badPlaybook"); })();
  const playbook = await c.pack.getDocument(e._id);
  const fromFolder = await docs(c.pack, c.inFolder(c.folder(e.name)).filter((x) => x.type !== "playbook"));
  const attached = (await Promise.all(playbook.system.attachedItems.map((u) => fromUuid(u).catch(() => null)))).filter(Boolean);
  const seen = new Map();
  for (const d of [...fromFolder, ...attached]) if (!seen.has(d.name)) seen.set(d.name, d);
  return { playbook, items: [...seen.values()] };
}
// ---------- Growth (port of the macro's "Gerenciador de Crescimento") ----------
const GROWTH = ["playbook-move", "other-move", "raise-stat", "shift-center", "moment"]; // labels in legends.growth.<key>
const MAX_RAISED_STAT = 2; // book rule: the advance does not take a stat above +2
const slug = (v) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
const moveOut = (d, playbook) => ({ id: d.id, name: d.name, playbook, rollStat: d.system.rollStat || "", description: lines(d.system.description) });
async function growthState(a) {
  const c = await compendium();
  const g = a.system.growth ?? {}, have = new Set(a.items.map((i) => i.name));
  const pbs = c.idx.filter((e) => e.type === "playbook");
  const mine = pbs.find((e) => slug(e.name) === slug(a.system.playbook));
  const movesOf = async (e) => (await playbookParts(c, e._id)).items.filter((d) => d.type === "move" && !have.has(d.name));
  const playbookMoves = mine ? (await movesOf(mine)).map((d) => moveOut(d, mine.name)) : [];
  const otherMoves = (await Promise.all(pbs.filter((e) => e !== mine).map(async (e) => (await movesOf(e)).map((d) => moveOut(d, e.name))))).flat()
    .filter((m, i, l) => l.findIndex((x) => x.name === m.name) === i).sort((x, y) => x.playbook.localeCompare(y.playbook) || x.name.localeCompare(y.name));
  const momentDoc = a.items.find((i) => i.type === "moment-of-balance") ?? (mine ? (await playbookParts(c, mine._id)).items.find((d) => d.type === "moment-of-balance") : null);
  const eligible = (k) => {
    const adv = g.advancements?.[k] ?? {}, used = Number(adv.value ?? 0), max = Number(adv.max ?? 0);
    if (k === "raise-stat") return STATS.some((s) => (a.system.stats[s] ?? 0) < MAX_RAISED_STAT);
    if (k === "playbook-move") return used < max && playbookMoves.length > 0;
    if (k === "other-move") return used < max && otherMoves.length > 0;
    if (k === "moment") return used < Math.max(max, 1);
    return used < max;
  };
  return {
    value: Number(g.value ?? 0), max: Number(g.max ?? 4), available: Number(g.max ?? 4) > 0 && Number(g.value ?? 0) >= Number(g.max ?? 4),
    advancements: GROWTH.map((key) => ({ key, label: tr(`legends.growth.${key}`), used: Number(g.advancements?.[key]?.value ?? 0), max: Number(g.advancements?.[key]?.max ?? 0), eligible: eligible(key) })),
    stats: a.system.stats, balance: a.system.balance, playbookMoves, otherMoves, moment: momentDoc ? lines(momentDoc.system.description) : null, momentDoc
  };
}

const learnable = (c) => c.inFolder(c.folder("Tecnicas de Combate")).filter((e) => e.type === "technique" && e.system?.training !== "group"); // group techniques belong to NPCs

// Localized names of the NPCs' conditions and statuses (compendium items in English).
const NAMED = ["Afraid", "Angry", "Guilty", "Insecure", "Troubled", "Doomed", "Empowered", "Favored", "Impaired", "Inspired", "Prepared", "Stunned", "Trapped"]; // names displayed in legends.cond.<name>
const ptName = (n) => (NAMED.includes(n) ? tr(`legends.cond.${n}`) : n);
export const handlers = {
  // ---- GM panel: active scene tokens (GM only) ----
  sceneTokens(user) {
    if (!user.isGM) throw fail(403, "err.gmOnly");
    const sc = game.scenes.active, mark = (i) => ({ id: i.id, name: ptName(i.name), checked: !!i.system.checked });
    return { scene: sc?.name ?? null, tokens: (sc?.tokens.contents ?? []).filter((t) => t.actor && t.actor.system.fatigue).map((t) => ({
      tokenId: t.id, actorId: t.actor.id, name: t.name, kind: t.actor.type, disposition: t.disposition, hidden: t.hidden, stats: t.actor.type === "player" ? t.actor.system.stats : null, principles: t.actor.type === "player" ? [["top", t.actor.system.balance.topTrack, t.actor.system.balance.value], ["bottom", t.actor.system.balance.bottomTrack, -t.actor.system.balance.value]] : [], fatigue: { value: t.actor.system.fatigue.value ?? 0, max: t.actor.system.fatigue.max ?? 5 },
      balance: t.actor.type === "player" ? (({ topTrack, bottomTrack, center, value }) => ({ topTrack, bottomTrack, center, value }))(t.actor.system.balance) : null,
      techniques: t.actor.type === "player" ? [] : byType(t.actor, "technique").map((i) => ({ id: i.id, name: i.name, approach: i.system.approach, description: lines(i.system.description) })),
      conditions: byType(t.actor, "condition").map(mark), statuses: byType(t.actor, "status").map((i) => ({ ...mark(i), positive: i.system.type !== "negative" })) })) };
  },
  async tokenFatigue(user, { actorId, tokenId, value }) {
    const a = ownedActor(user, actorId, tokenId), max = a.system.fatigue?.max ?? 5;
    value = pick(value, undefined, 0, max, tr("legends.lbl.fatigue")) ?? (() => { throw fail(400, "legends.err.fatigueMissing"); })();
    await a.update({ "system.fatigue.value": value, "system.fatigueRemaining.value": max - value }, { sheetRelayUser: user.id });
    return { ok: true };
  },
  async tokenMark(user, { actorId, tokenId, itemId, checked }) {
    const a = ownedActor(user, actorId, tokenId), i = a.items.get(itemId);
    if (!i || !["condition", "status"].includes(i.type)) throw fail(404, "legends.err.condNotFound");
    await i.update({ "system.checked": !!checked }, { sheetRelayUser: user.id });
    return { ok: true };
  },
  async tokenBalance(user, { actorId, tokenId, value }) {
    const a = ownedActor(user, actorId, tokenId);
    if (a.type !== "player") throw fail(400, "legends.err.balancePlayerOnly");
    await a.update({ "system.balance.value": FIELDS["system.balance.value"](value, tr("legends.lbl.balance")) }, { sheetRelayUser: user.id });
    return { ok: true };
  },
  // Posts the name and description of an NPC technique to the chat.
  async tokenTechnique(user, { actorId, tokenId, itemId }) {
    const a = ownedActor(user, actorId, tokenId), i = ownedItem(a, itemId, "technique");
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<div class="legends"><h3>${esc(i.name)}</h3>${paragraphs(lines(i.system.description))}</div>` });
    return { ok: true };
  },
  getCharacter: (user, { actorId }) => sheet(ownedActor(user, actorId)),
  // Roll a move (itemId) or a stat/principle directly (without itemId).
  async roll(user, { actorId, itemId, stat, bonus, penalty, mods, approach }) {
    const a = ownedActor(user, actorId);
    const item = itemId ? ownedItem(a, itemId, "move") : null;
    stat = stat || item?.system.rollStat || (approach ? APPROACH[approach]?.[1] : undefined);
    const m = mods?.length ? await applyMods(a, modContext(a, { itemId, stat, approach }), mods) : undefined;
    return postRoll(a, { item, label: approach ? tr(`legends.approach.${approach}`) : undefined, stat, bonus, penalty, m });
  },
  // GM panel: rolls for a scene token (player: stat or principle; NPC: stat "npc" = 2d6 with bonus and penalty).
  tokenRoll(user, { actorId, tokenId, stat, bonus, penalty }) {
    const a = ownedActor(user, actorId, tokenId);
    if (stat === "npc" && a.type === "player") throw fail(400, "legends.err.playerRoll");
    return postRoll(a, { stat, bonus, penalty });
  },
  async update(user, { actorId, changes }) {
    const a = ownedActor(user, actorId);
    if (!changes || typeof changes !== "object") throw fail(400, "legends.err.nothingToChange");
    const data = {}, prof = {};
    for (const [k, v] of Object.entries(changes)) {
      if (!Object.hasOwn(FIELDS, k)) throw fail(400, "legends.err.fieldNotEditable", { field: k });
      const val = FIELDS[k](v, k.split(".").at(-1));
      if (k.startsWith("profile.")) prof[k.slice(8)] = val; else data[k] = val;
    }
    if ("system.fatigue.value" in data) data["system.fatigueRemaining.value"] = (a.system.fatigue?.max ?? 5) - data["system.fatigue.value"]; // as the system's sheet does
    if (Object.keys(prof).length) {
      const p = { ...profile(a.system), ...prof };
      Object.assign(data, { "system.description": profileHtml(p), "system.look": p.look, "system.connections": p.connections });
    }
    await a.update(data, { sheetRelayUser: user.id });
    return sheet(a);
  },
  async setItem(user, { actorId, itemId, field, value }) {
    const a = ownedActor(user, actorId);
    const i = ownedItem(a, itemId);
    if (!ITEM_FIELDS[i.type]?.includes(field)) throw fail(400, "legends.err.itemFieldNotEditable");
    await i.update({ [`system.${field}`]: bool(value, field) }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  // Marks/unmarks the n-th "( )" choice in the text, as the player does in Foundry by editing it to "(x)". The rest of the HTML stays the same.
  async toggleMark(user, { actorId, itemId, index }) {
    const a = ownedActor(user, actorId);
    const i = ownedItem(a, itemId);
    if (!TEXT_ITEMS.includes(i.type)) throw fail(400, "legends.err.noChoices");
    let n = -1, found = false;
    const html = String(i.system.description ?? "").replace(MARK, (m) => (++n === index ? ((found = true), /x/i.test(m) ? "( )" : "(x)") : m));
    if (!found) throw fail(400, "legends.err.choiceNotFound");
    await i.update({ "system.description": html }, { sheetRelayUser: user.id });
    return sheet(a);
  },
  // Resource/moment/question/move text edited in the app (for the "____" blanks). Each line becomes a paragraph.
  async setItemText(user, { actorId, itemId, value }) {
    const a = ownedActor(user, actorId);
    const i = ownedItem(a, itemId);
    if (!TEXT_ITEMS.includes(i.type)) throw fail(400, "legends.err.textNotEditable");
    await i.update({ "system.description": paragraphs(str(20000)(value, tr("legends.lbl.text"))) }, { sheetRelayUser: user.id });
    return sheet(a);
  },

  // ---------- Growth: with growth full (4/4), picks an advance; growth goes back to 0 ----------
  async growthOptions(user, { actorId }) {
    const { momentDoc: _m, ...st } = await growthState(ownedActor(user, actorId));
    return st;
  },
  async applyGrowth(user, { actorId, advancement, choice }) {
    const a = ownedActor(user, actorId);
    const st = await growthState(a);
    if (!st.available) throw fail(400, "legends.err.growthFull", { max: st.max });
    if (!st.advancements.find((x) => x.key === advancement)?.eligible) throw fail(400, "legends.err.advUnavailable");
    const c = await compendium();
    const update = {}, items = [];
    let detail = tr(`legends.growth.${advancement}`);
    if (advancement === "playbook-move" || advancement === "other-move") {
      const m = (advancement === "playbook-move" ? st.playbookMoves : st.otherMoves).find((x) => x.id === choice) ?? (() => { throw fail(400, "legends.err.pickMove"); })();
      const d = await c.pack.getDocument(m.id) ?? (await playbookParts(c, c.idx.find((e) => e.type === "playbook" && e.name === m.playbook)._id)).items.find((x) => x.id === m.id);
      const o = d.toObject(); delete o._id; delete o.folder; delete o.sort; delete o.ownership;
      items.push(o); detail = advancement === "other-move" ? tr("legends.growth.newMoveFrom", { playbook: m.playbook, name: m.name }) : tr("legends.growth.newMove", { name: m.name });
    } else if (advancement === "raise-stat") {
      if (!STATS.includes(choice) || (a.system.stats[choice] ?? 0) >= MAX_RAISED_STAT) throw fail(400, "legends.err.pickStatBelow", { max: MAX_RAISED_STAT });
      update[`system.stats.${choice}`] = (a.system.stats[choice] ?? 0) + 1;
      detail = tr("legends.growth.statUp", { stat: tr(`legends.stat.${choice}`) });
    } else if (advancement === "shift-center") {
      if (!["top", "bottom"].includes(choice)) throw fail(400, "legends.err.pickPrinciple");
      const d = choice === "top" ? 1 : -1, b = a.system.balance;
      update["system.balance.center"] = Math.clamp((b.center ?? 0) + d, -3, 3);
      update["system.balance.value"] = Math.clamp((b.value ?? 0) + d, -3, 3);
      detail = tr("legends.growth.shifted", { principle: choice === "top" ? b.topTrack : b.bottomTrack });
    } else if (advancement === "moment" && !a.items.some((i) => i.type === "moment-of-balance") && st.momentDoc) {
      const o = st.momentDoc.toObject(); delete o._id; delete o.folder; delete o.sort; delete o.ownership; items.push(o);
    }
    const g = a.system.growth, adv = g.advancements?.[advancement] ?? {};
    update[`system.growth.advancements.${advancement}.value`] = Number(adv.value ?? 0) + 1;
    update["system.growth.value"] = Math.max(0, Number(g.value ?? 0) - Number(g.max ?? 4));
    await a.update(update, { sheetRelayUser: user.id });
    if (items.length) await a.createEmbeddedDocuments("Item", items, { sheetRelayUser: user.id });
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<div class="legends"><h3>${tr("legends.chat.growth")}</h3><p><strong>${esc(a.name)}</strong>: ${esc(detail)}</p></div>` });
    return sheet(a);
  },

  // ---------- Creation (port of the Character Manager) ----------
  // Light list of playbooks, trainings with sub-trainings and learnable techniques per training.
  async creationData() {
    const c = await compendium();
    const pbs = c.idx.filter((e) => e.type === "playbook").sort((x, y) => x.name.localeCompare(y.name));
    const playbooks = await Promise.all(pbs.map(async (e) => {
      const d = await c.pack.getDocument(e._id);
      const feature = c.inFolder(c.folder(e.name)).find((x) => x.type === "feature");
      return { id: e._id, name: e.name, stats: d.system.stats, balance: d.system.balance, feature: feature?.name ?? "" };
    }));
    const subs = subTrainings();
    const techniques = (await docs(c.pack, learnable(c))).map((d) => ({ id: d.id, name: d.name, approach: d.system.approach, training: d.system.training, description: lines(d.system.description) }));
    return { playbooks, trainings: TRAINING.map((k) => ({ key: k, label: tr(`legends.training.${k}`), subs: subs[k] })), techniques };
  },
  // A playbook's detail: resource, moment of balance, growth question, moves and own techniques.
  async playbook(_user, { playbookId }) {
    const c = await compendium();
    const { playbook, items } = await playbookParts(c, playbookId);
    const one = (t) => textItem(items.find((d) => d.type === t));
    return {
      id: playbook.id, name: playbook.name, stats: playbook.system.stats, balance: playbook.system.balance,
      feature: one("feature"), momentOfBalance: one("moment-of-balance"), growthQuestion: one("growth-question"),
      moves: items.filter((d) => d.type === "move").map((d) => ({ id: d.id, name: d.name, rollStat: d.system.rollStat || "", description: lines(d.system.description) })),
      techniques: items.filter((d) => d.type === "technique").map((d) => ({ id: d.id, name: d.name, approach: d.system.approach, training: "playbook", description: lines(d.system.description) }))
    };
  },
  // Full sheet like the macro: fills one of your sheets (deleting its items) or creates a new one in the players' folder.
  async createCharacter(user, { actorId, name, playbookId, training, subTraining = "", statBonus, moveIds = [], masteredId, learnedId, background = "", demeanor = "", hometown = "", look = "", history = "", connections = "" }) {
    name = FIELDS.name(name);
    if (!TRAINING.includes(training)) throw fail(400, "legends.err.pickTraining");
    if (!STATS.includes(statBonus)) throw fail(400, "legends.err.pickStatBonus");
    for (const [k, v] of Object.entries({ subTraining, background, demeanor, hometown })) str(200)(v, k);
    for (const [k, v] of Object.entries({ look, history, connections })) str(10000)(v, k);
    if (!demeanor.trim()) throw fail(400, "legends.err.pickDemeanor");
    const target = actorId ? ownedActor(user, actorId) : null;
    if (target && target.type !== "player") throw fail(400, "legends.err.badSheet");

    const c = await compendium();
    const { playbook, items } = await playbookParts(c, playbookId);
    const moves = items.filter((d) => d.type === "move");
    if (!Array.isArray(moveIds) || moveIds.length !== 2 || new Set(moveIds).size !== 2 || moveIds.some((id) => !moves.some((m) => m.id === id))) throw fail(400, "legends.err.pickMoves");
    const techOk = [...items.filter((d) => d.type === "technique").map((d) => d.id), ...learnable(c).filter((e) => [training, "universal"].includes(e.system?.training)).map((e) => e._id)];
    if (!techOk.includes(masteredId) || !techOk.includes(learnedId) || masteredId === learnedId) throw fail(400, "legends.err.pickTechs");

    const get = async (id) => items.find((d) => d.id === id) ?? (await c.pack.getDocument(id));
    const clean = (d, system = {}) => { const o = d.toObject(); delete o._id; delete o.folder; delete o.sort; delete o.ownership; return foundry.utils.mergeObject(o, { system }); };
    const out = [], names = new Set();
    const add = (o) => { if (!names.has(o.name)) { names.add(o.name); out.push(o); } };
    for (const id of moveIds) add(clean(await get(id)));
    add(clean(await get(masteredId), { basic: false, learned: true, practiced: false, mastered: true }));
    add(clean(await get(learnedId), { basic: false, learned: true, practiced: false, mastered: false }));
    const common = [...c.inFolder(c.folder("Técnicas de Combate (Comuns)")), ...c.inFolder(c.folder("Condições")), ...c.inFolder(c.folder("Status")), ...c.inFolder(c.folder("Movimentos Básicos")), ...c.inFolder(c.folder("Movimentos de Equilíbrio"))];
    for (const d of await docs(c.pack, common)) add(clean(d));
    for (const d of items.filter((x) => !["move", "technique"].includes(x.type))) add(clean(d)); // recurso, momento, pergunta

    const stats = { ...playbook.system.stats, [statBonus]: (playbook.system.stats[statBonus] ?? 0) + 1 };
    const prof = { look, history, connections };
    const system = {
      playbook: playbook.name, stats, balance: { ...(target?.system.balance ?? { center: 0, value: 0 }), ...playbook.system.balance },
      background, hometown, demeanor, fighting_style: subTraining, look, connections, description: profileHtml(prof),
      training: Object.fromEntries(TRAINING.map((k) => [k, k === training]))
    };
    const opts = { sheetRelayUser: user.id };
    let a = target;
    if (a) {
      if (a.items.size) await a.deleteEmbeddedDocuments("Item", a.items.map((i) => i.id), opts);
      await a.update({ name, system }, opts);
    } else {
      a = await Actor.create({
        name, type: "player", img: "systems/legends/images/tokens/player.webp", folder: playersFolder()?.id ?? null,
        ownership: { default: 0, [user.id]: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER }, system
      }, opts);
    }
    await a.createEmbeddedDocuments("Item", out, opts);
    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content: `<div class="legends"><h3>${tr("legends.chat.created")}</h3><p><strong>${esc(a.name)}</strong> — ${esc(playbook.name)}, ${esc(tr(`legends.training.${training}`))}${subTraining ? ` (${esc(subTraining)})` : ""}</p></div>` });
    return summary(a);
  }
};
