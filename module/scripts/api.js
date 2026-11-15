// Core public API for system plugins (version 1). A plugin imports ONLY from here (and from its own directory):
//   import { defineSystem, fail, ownedActor, ... } from "../../api.js";
// In the repo the plugin lives in systems/<id>/module/ and the systems/api.js bridge re-exports this file; in Foundry the deploy
// puts the plugin in scripts/systems/<id>/, where "../../api.js" is this file.
import { ID, esc, fail, isRelay, num, ownedActor, ownedItem, pick, playersFolder, text, tryOr } from "./core.js";
import { availableMods, chooseMods, resetUses, spendUses } from "./mods.js";
import { keyOf } from "./rules.js";
import { curLang, tr } from "./i18n.js";
import { defineSystem } from "./registry.js";

/** Appends `t` to the list only if not already there (repeated warnings from several rules). */
export const noteOnce = (list, t) => { if (!list.includes(t)) list.push(t); return list; };

/** Chat message with what the selected rules did: "Used" (effect applied), "Warning" (reminder only) and notes. All escaped. */
export async function announceMods(a, { used = [], warn = [], notes = [] }) {
  const content = (used.length ? `<p><b>${tr("mod.used")}:</b> ${used.map(esc).join("; ")}</p>` : "") + (warn.length ? `<p><b>${tr("mod.warn")}:</b> ${warn.map(esc).join("; ")}</p>` : "") + notes.map((n) => `<p><em>${esc(n)}</em></p>`).join("");
  if (content) await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: a }), content });
}

/** "Per scene" uses reset when the GM changes the active scene or a combat ends (only the relay client does this). */
export const newScene = () => isRelay() && Promise.all(game.actors.filter((a) => a.items.some((i) => i.getFlag(ID, "used"))).map((a) => resetUses(a, "scene")));

export { tr, curLang, ID, esc, fail, isRelay, num, ownedActor, ownedItem, pick, playersFolder, text, tryOr, keyOf, availableMods, chooseMods, spendUses, resetUses, defineSystem };
