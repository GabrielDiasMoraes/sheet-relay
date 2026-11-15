// Example plugin. The descriptor `id` is the system's game.system.id (and the folder name in systems/).
import { defineSystem } from "../../api.js";
import * as t from "./template.js";

export default defineSystem({
  id: "template", api: 1,
  listedTypes: t.LISTED, summary: t.summary, handlers: t.handlers,
  catalogUrl: new URL("./catalog.json", import.meta.url).href,
  rulePacks: [],            // compendia the rules editor lists: [{ pack: "my-package.items", types: ["feat"] }]
  ruleItemTypes: [],        // item types that get the "Roll rules" section on the item sheet
  vocab: {}                 // what your system adds to the rules vocabulary: { rolls: [...], effects: [...], costs: [...], periods: [...] }
});
