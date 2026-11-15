// Utilities used by the core and by all systems.
import { tr } from "./i18n.js";
export const ID = "sheet-relay";
// fail(status, key, params): the message comes out in the module's language; dispatch redoes it in the language the app asked for (key/params).
export const fail = (status, key, params) => Object.assign(new Error(tr(key, params)), { status, key, params });
export const text = (html) => new DOMParser().parseFromString(html ?? "", "text/html").body.textContent.trim(); // description without HTML
export const tryOr = (f, def) => { try { return f(); } catch { return def; } };
export const num = (v) => (typeof v === "number" ? v : v?.value ?? null);
export const ownedActor = (user, actorId, tokenId) => {
  if (tokenId) { // NPC loose in the scene (token actor): only the GM touches it
    if (!user.isGM) throw fail(403, "err.gmOnly");
    const t = game.scenes.active?.tokens.get(tokenId);
    if (!t?.actor || t.actor.id !== actorId) throw fail(404, "err.tokenNotFound");
    return t.actor;
  }
  const a = game.actors.get(actorId);
  if (!a) throw fail(404, "err.actorNotFound");
  if (!a.testUserPermission(user, "OWNER")) throw fail(403, "err.noAccess");
  return a;
};
export const ownedItem = (a, itemId, type) => { const i = a.items.get(itemId); if (!i || (type && i.type !== type)) throw fail(404, "err.itemNotFound"); return i; };
// Adjustment coming from the app: integer within the limit; absent = default.
export const pick = (v, def, min, max, label) => {
  if (v === undefined || v === null) return def;
  if (!Number.isInteger(v) || v < min || v > max) throw fail(400, "err.range", { label, min, max });
  return v;
};
export const playersFolder = () => game.folders.find((f) => f.type === "Actor" && f.name === game.settings.get(ID, "playersFolder"));
// The Foundry client logged in as the relay user (headless or tab): only it reacts to hooks that change data.
export const isRelay = () => game.user.name === game.settings.get(ID, "relayUser");
export const esc = (s) => foundry.utils.escapeHTML(String(s ?? ""));
