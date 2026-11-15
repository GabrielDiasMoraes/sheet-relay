// Plugin D&D 5.5e (game.system.id "dnd5e"): atividades nativas, talentos, curas, reservas, formas, descansos.
import { defineSystem } from "../../api.js";
import * as d from "./dnd5e.js";
import locales from "./locales.js";

export default defineSystem({
  id: "dnd5e", api: 1, locales,
  listedTypes: d.LISTED, summary: d.summary, handlers: d.handlers,
  modContext: d.modContext, modPreview: d.modPreview, register: d.register,
  catalogUrl: new URL("./catalog.json", import.meta.url).href,
  rulePacks: [{ pack: "dnd5e.feats24", types: ["feat"] }, { pack: "dnd5e.classes24", types: ["feat"] }],
  ruleItemTypes: ["feat"],
  vocab: {
    rolls: ["death", "special"],
    effects: ["mode"],
    periods: ["sr", "lr", "turn"]
  }
});
