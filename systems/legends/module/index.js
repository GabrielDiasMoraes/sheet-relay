// Avatar Legends plugin (game.system.id "legends"): 2d6 with stat, approaches, principles and balance.
import { defineSystem } from "../../api.js";
import * as l from "./legends.js";
import locales from "./locales.js";

export default defineSystem({
  id: "legends", api: 1, locales,
  listedTypes: l.LISTED, summary: l.summary, handlers: l.handlers,
  modContext: l.modContext,
  catalogUrl: new URL("./catalog.json", import.meta.url).href,
  rulePacks: [{ pack: "legends.playbooks", types: ["move", "feature", "status", "technique"] }],
  ruleItemTypes: [],
  vocab: {
    rolls: ["move", "technique", "principle", "stat", "resist", "balance", "status"],
    effects: ["max"],
    periods: ["session"]
  }
});
