// sheet-relay core: login, sessions, relay connection and change notices. Each system's specifics live in systems/.
import { ID, fail, ownedActor, playersFolder } from "./core.js";
import { availableMods, resetUses } from "./mods.js";
import { handlers as ruleHandlers, keyOf, validateRules } from "./rules.js";
import { mount, setCurrent } from "./registry.js";
import { newScene } from "./api.js";
import localeCfg from "./locale.config.js";
import { LANGS, addLocale, asLang, curLang, setLang, tr } from "./i18n.js";

// The active system's plugin (systems/<id>/index.js, see docs/create-system.md) is loaded at init; a broken plugin only takes down its own world.
let SYS = null, HANDLERS = null, loading = null;
const sys = () => SYS ?? (() => { throw fail(501, "err.systemUnsupported", { id: game.system.id }); })();

Hooks.once("init", () => {
  loading = import(`./systems/${game.system.id}/index.js`)
    .then((m) => { SYS = m.default; setCurrent(SYS); for (const l of LANGS) addLocale(l, SYS.locales?.[l]); HANDLERS = mount(handlers, SYS); })
    .catch((e) => console.error(`${ID} | sistema ${game.system.id}`, e));
  // Language of the chat and module messages: "auto" follows the Foundry language of the relay user.
  game.settings.register(ID, "lang", { name: tr("set.lang.name", null, asLang(game.i18n.lang)), hint: tr("set.lang.hint", null, asLang(game.i18n.lang)), scope: "world", config: !localeCfg.locked, type: String, default: "auto",
    choices: { auto: tr("set.lang.auto", null, asLang(game.i18n.lang)), en: "English", "pt-BR": "Português (Brasil)" } });
  const chosen = game.settings.get(ID, "lang");
  setLang(localeCfg.locked && localeCfg.default ? localeCfg.default : !chosen || chosen === "auto" ? asLang(game.i18n.lang) : chosen);
  game.settings.register(ID, "relaySecret", { name: tr("set.relaySecret.name"), hint: tr("set.relaySecret.hint"), scope: "world", config: true, type: String, default: "" });
  game.settings.register(ID, "relayUrl", { name: tr("set.relayUrl.name"), hint: tr("set.relayUrl.hint"), scope: "world", config: true, type: String, default: "ws://localhost:8787" });
  game.settings.register(ID, "relayUser", { name: tr("set.relayUser.name"), scope: "world", config: true, type: String, default: "Relay" });
  game.settings.register(ID, "playersFolder", { name: tr("set.playersFolder.name"), hint: tr("set.playersFolder.hint"), scope: "world", config: true, type: String, default: curLang() === "pt-BR" ? "Jogadores" : "Players" });
  game.settings.register(ID, "hiddenUsers", { name: tr("set.hiddenUsers.name"), hint: tr("set.hiddenUsers.hint"), scope: "world", config: true, type: String, default: "Helper" });
  // { sha256(session token): userId }. The raw token only exists in the player's app.
  // { itemKey: { name, regras } } — roll rules edited in the world (on top of the repository catalog).
  game.settings.register(ID, "rollRules", { scope: "world", config: false, type: Object, default: {} });
  game.settings.register(ID, "tokens", { scope: "world", config: false, type: Object, default: {} });
  // { userId: { salt, hash } } — app password (PBKDF2), independent of the Foundry password.
  game.settings.register(ID, "creds", { scope: "world", config: false, type: Object, default: {} });
});

const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const unhex = (h) => Uint8Array.from(h.match(/../g), (b) => parseInt(b, 16));
const enc = (t) => new TextEncoder().encode(t);
const sha256 = async (t) => hex(await crypto.subtle.digest("SHA-256", enc(t)));
const MAX_SESSIONS = 5;
const MIN_PASSWORD = 8;

const kdf = async (password, saltHex) => hex(await crypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: 200_000 },
  await crypto.subtle.importKey("raw", enc(password), "PBKDF2", false, ["deriveBits"]), 256));
const sameHex = (a, b) => a.length === b.length && [...a].reduce((d, c, i) => d | (c.charCodeAt(0) ^ b.charCodeAt(i)), 0) === 0;
const DUMMY_SALT = "00".repeat(16); // used when the user does not exist, so the response time does not reveal it

async function setPassword(userId, password) {
  if (typeof password !== "string" || password.length < MIN_PASSWORD) throw fail(400, "err.passwordShort", { min: MIN_PASSWORD });
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
  const creds = { ...game.settings.get(ID, "creds"), [userId]: { salt, hash: await kdf(password, salt) } };
  await game.settings.set(ID, "creds", creds);
}
async function checkPassword(userId, password) {
  const c = game.settings.get(ID, "creds")[userId];
  const hash = await kdf(String(password), c?.salt ?? DUMMY_SALT);
  return !!c && sameHex(hash, c.hash);
}
async function newSession(userId) {
  const token = hex(crypto.getRandomValues(new Uint8Array(32)));
  const entries = Object.entries(game.settings.get(ID, "tokens"));
  const mine = entries.filter(([, u]) => u === userId);
  const drop = new Set(mine.slice(0, Math.max(0, mine.length - (MAX_SESSIONS - 1))).map(([h]) => h)); // drops the oldest
  const tokens = Object.fromEntries(entries.filter(([h]) => !drop.has(h)));
  tokens[await sha256(token)] = userId;
  await game.settings.set(ID, "tokens", tokens);
  return token;
}

// API for the GM (console): game.modules.get("sheet-relay").api.setPassword(userId, "initial-password")
// shortcut: no settings screen, API only; build the UI if GMs complain about the console.
const api = {
  async setPassword(userId, password) {
    if (!game.users.get(userId)) throw new Error(tr("api.userNotFound"));
    await setPassword(userId, password);
  },
  // Undoes the app's "delete": restores the previous folder and owners.
  async restoreCharacter(actorId) {
    const a = game.actors.get(actorId), d = a?.getFlag(ID, "deleted");
    if (!d) throw new Error(tr("api.notDeleted"));
    await a.update({ folder: d.folder && game.folders.get(d.folder) ? d.folder : null, ownership: d.ownership, [`flags.${ID}.-=deleted`]: null });
  },
  async revokeSessions(userId) {
    const tokens = Object.fromEntries(Object.entries(game.settings.get(ID, "tokens")).filter(([, u]) => u !== userId));
    await game.settings.set(ID, "tokens", tokens);
  }
};
Hooks.once("ready", () => { game.modules.get(ID).api = api; });

// Sheets the user sees in the app. The GM owns everything (~150 NPCs/creatures): for them, only the players' folder.
function listed(user, a) {
  const folder = playersFolder();
  const inFolder = !!folder && (a.folder === folder || !!a.folder?.ancestors?.includes(folder));
  return sys().listedTypes.includes(a.type) && a.testUserPermission(user, "OWNER") && (!user.isGM || inFolder);
}

const hasPassword = (userId) => !!game.settings.get(ID, "creds")[userId];
// Accounts the app accepts: without the relay user and without the hidden ones.
const appUsers = () => {
  const hidden = [game.settings.get(ID, "relayUser"), ...game.settings.get(ID, "hiddenUsers").split(",")].map((n) => n.trim());
  return game.users.filter((u) => !hidden.includes(u.name));
};

// Commands without a session. Same message for a wrong user or password.
const open = {
  // No session: says which system and plugin this world loaded (used to verify installs and publishes).
  status: () => ({ ok: true, system: game.system.id, plugin: SYS?.id ?? null, api: SYS?.api ?? null }),
  listUsers: () => appUsers().map((u) => u.name).sort((a, b) => a.localeCompare(b)),
  // An account without an app password logs in directly (GM's decision: trusts the players). With a password set, it is required.
  async login({ username, password }) {
    const user = appUsers().find((u) => u.name === username);
    const ok = user && (!hasPassword(user.id) || (await checkPassword(user.id, password)));
    if (!ok) { if (!user) await checkPassword(null, password); throw fail(401, "err.invalidLogin"); }
    return { token: await newSession(user.id), name: user.name, gm: user.isGM };
  }
};

const handlers = {
  ...ruleHandlers,
  // Modifiers applicable to the roll described in args; the system fills in the context (skill, weapon) in modContext.
  listRollMods: async (user, { actorId, tokenId, ...args }) => {
    const a = ownedActor(user, actorId, tokenId);
    return (await availableMods(a, (await sys().modContext?.(a, args)) ?? args)).map(({ key, itemName, label, text, effects, cost, auto, usesLeft, usesMax }) => ({ key, itemName, label, text, effects, cost, auto, usesLeft, usesMax, preview: sys().modPreview?.(a, effects) ?? undefined }));
  },
  resetModUses: async (user, { actorId }) => (await resetUses(ownedActor(user, actorId)), { ok: true }), // shortcut: manual reset until the per-scene/rest reset phase
  subscribe: (user, { actorId }) => (ownedActor(user, actorId), { ok: true }), // only the owner listens to the sheet
  async changePassword(user, { oldPassword, newPassword }) {
    if (hasPassword(user.id) && !(await checkPassword(user.id, oldPassword))) throw fail(403, "err.wrongPassword");
    await setPassword(user.id, newPassword);
    return { ok: true };
  },
  listCharacters: (user) => game.actors.filter((a) => listed(user, a)).sort((x, y) => x.name.localeCompare(y.name)).map(sys().summary),
  // Only the GM deletes. Non-destructive: the sheet leaves the players and goes to the TRASH folder; the GM restores it with api.restoreCharacter.
  async deleteCharacter(user, { actorId, confirmName }) {
    if (!user.isGM) throw fail(403, "err.gmDelete");
    const a = ownedActor(user, actorId);
    if (!listed(user, a)) throw fail(403, "err.notListed");
    if (typeof confirmName !== "string" || confirmName.trim().toLowerCase() !== a.name.trim().toLowerCase()) throw fail(400, "err.confirmName");
    const trash = game.folders.find((f) => f.type === "Actor" && f.name === tr("trash.folder") && !f.folder) ?? (await Folder.implementation.create({ name: tr("trash.folder"), type: "Actor", color: "#5c1010" }));
    await a.update({
      folder: trash.id,
      ownership: Object.fromEntries(Object.keys(a.ownership).map((k) => [k, 0])),
      [`flags.${ID}.deleted`]: { by: user.name, at: new Date().toISOString(), folder: a.folder?.id ?? null, ownership: a.ownership }
    });
    return { ok: true };
  }
};

async function authenticate(token) {
  const userId = token && game.settings.get(ID, "tokens")[await sha256(token)];
  const user = userId && appUsers().find((u) => u.id === userId);
  if (!user) throw fail(401, "err.invalidToken");
  return user;
}

// Notice to the relay when a sheet changes in Foundry (actor, items or effects), so the app reloads by itself.
let relaySocket = null, notifyTimer = null;
const changed = new Set();
function notify(doc) {
  const actor = doc?.documentName === "Actor" ? doc : doc?.parent?.documentName === "Actor" ? doc.parent : doc?.parent?.parent; // efeito pode estar num item
  if (actor?.documentName !== "Actor" || !actor.id) return;
  changed.add(actor.id);
  clearTimeout(notifyTimer);
  notifyTimer = setTimeout(() => { // batches several consecutive changes (e.g. level up) into a single notice
    if (relaySocket?.readyState === WebSocket.OPEN) for (const actorId of changed) relaySocket.send(JSON.stringify({ event: "actor", actorId }));
    changed.clear();
  }, 200);
}
for (const h of ["updateActor", "createItem", "updateItem", "deleteItem", "createActiveEffect", "updateActiveEffect", "deleteActiveEffect"]) Hooks.on(h, notify);

function connect() {
  const secret = game.settings.get(ID, "relaySecret"), base = game.settings.get(ID, "relayUrl");
  const ws = new WebSocket(secret ? `${base}${base.includes("?") ? "&" : "?"}secret=${encodeURIComponent(secret)}` : base);
  relaySocket = ws;
  ws.onopen = () => console.log(`${ID} | conectado`);
  ws.onmessage = async ({ data }) => {
    const { id, type, token, ...args } = JSON.parse(data);
    let res;
    try {
      if (Object.hasOwn(open, type)) res = { id, ok: true, data: await open[type](args) };
      else {
        const user = await authenticate(token);
        const all = HANDLERS ?? handlers; // without a plugin only the core commands apply
        const h = Object.hasOwn(all, type) ? all[type] : null;
        if (!h) throw fail(400, "err.unknownCommand");
        res = { id, ok: true, data: await h(user, args) };
      }
    } catch (e) { res = { id, ok: false, status: e.status ?? 500, error: e.key ? tr(e.key, e.params, asLang(args.lang)) : e.message, code: e.key }; }
    ws.send(JSON.stringify(res));
  };
  ws.onclose = () => setTimeout(connect, 3000);
}

// "Per scene" uses reset when the GM changes the active scene or a combat ends (only the relay client does this).
Hooks.on("updateScene", (s, d) => d.active && newScene());
Hooks.on("deleteCombat", newScene);

// "Roll rules" section on the perk sheet (GM only): the rules apply to all characters that have this perk.
Hooks.on("renderItemSheet", async (app, html) => {
  const item = app.item ?? app.document;
  if (!game.user.isGM || !item || !SYS?.ruleItemTypes.includes(item.type)) return;
  const root = html.closest(".app").find(".window-content").first(), key = keyOf(item);
  if (!root.length || root.find(".sr-rules").length) return;
  const box = $(`<details class="sr-rules" style="margin-top:8px;border:1px solid #888;padding:6px"><summary><b>${tr("sheet.title")}</b> <span class="sr-src" style="opacity:.7"></span></summary>
    <p style="opacity:.75;font-size:.9em">${tr("sheet.help")}</p>
    <textarea class="sr-json" rows="12" style="width:100%;font-family:monospace;font-size:12px"></textarea>
    <div><button type="button" class="sr-save">${tr("sheet.save")}</button> <button type="button" class="sr-reset">${tr("sheet.reset")}</button> <span class="sr-msg"></span></div></details>`);
  root.append(box);
  const load = async () => { const r = await ruleHandlers.getRules(game.user, { key }); box.find(".sr-json").val(JSON.stringify(r.regras, null, 1)); box.find(".sr-src").text(`(${r.source})`); };
  const say = (t, bad) => box.find(".sr-msg").text(t).css("color", bad ? "#b3261e" : "#1c7a4a");
  box.find(".sr-save").on("click", async () => {
    try { await ruleHandlers.saveRules(game.user, { key, name: item.name, regras: validateRules(JSON.parse(box.find(".sr-json").val())) }); await load(); say(tr("sheet.saved")); }
    catch (e) { say(e.message, true); }
  });
  box.find(".sr-reset").on("click", async () => { await ruleHandlers.resetRules(game.user, { key }); await load(); say(tr("sheet.resetDone")); });
  await load();
});

Hooks.once("ready", async () => {
  await loading;
  try { SYS?.register?.(); } catch (e) { console.error(`${ID} | register of ${game.system.id}`, e); } // plugin hooks (e.g. use reset on rest); an error here must not prevent the relay connection
  // only the dedicated user connects; other clients ignore the module
  if (game.user.name === game.settings.get(ID, "relayUser")) connect();
});
