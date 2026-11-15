// Fallout plugin (game.system.id "fallout"): 2d20 rolls, perks, damage by location and utilities.
import { defineSystem } from "../../api.js";
import * as f from "./fallout.js";
import locales from "./locales.js";

export default defineSystem({
  id: "fallout", api: 1,
  listedTypes: f.LISTED, summary: f.summary, handlers: f.handlers,
  modContext: f.modContext, register: f.register, locales,
  catalogUrl: new URL("./catalog.json", import.meta.url).href,
  rulePacks: [{ pack: "fallout.perks" }, { pack: "fallout.traits" }],
  ruleItemTypes: ["perk", "trait", "special_ability"],
  vocab: {
    rolls: ["apply", "kill", "defense"],
    effects: ["applyEffect", "complication", "quality", "unit"],
    costs: ["ap", "luck"],
    periods: ["once"]
  }
});
