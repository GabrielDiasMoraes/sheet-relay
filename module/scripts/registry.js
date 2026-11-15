// System registry: validates a plugin's descriptor and builds the command map (core + system).
// No Foundry dependency: the contract is testable in node (module/test/contract.test.mjs).
const FN = (v) => typeof v === "function";
const STRS = (v) => Array.isArray(v) && v.every((x) => typeof x === "string" && x);
const OPEN = ["login", "listUsers"]; // commands without a session: no system replaces them

/**
* System descriptor (API version 1).
 * @typedef {object} SystemDescriptor
 * @property {string} id                       game.system.id(also the name of the systems/<id> folder)
 * @property {1} api                           contract version
 * @property {string[]} listedTypes            actor types that appear in the app (was LISTED)
 * @property {(actor) => object} summary       sheet list row
 * @property {Record<string,(user, args, base?) => any>} handlers  system commands; the 3rd argument is the core handler when the name is in `overrides`
 * @property {string[]} [overrides]            names of core commands this system overrides ON PURPOSE
 * @property {(actor, args) => object} [modContext]   rule engine context for the roll described in args (see ModCtx in the guide)
 * @property {(actor, effects) => string|undefined} [modPreview]  short preview of a rule's formula
 * @property {() => void} [register]           own hooks; called on `ready` (the hooks check isRelay())
 * @property {string} [catalogUrl]             URL of the repository rule catalog (default: the core one by game.system.id)
 * @property {{pack:string,types?:string[]}[]} [rulePacks]  compendia the rule editor lists
 * @property {string[]} [ruleItemTypes]        item types with the "Roll rules" section on the sheet
 * @property {{rolls?:string[],itemFilters?:string[],effects?:string[],costs?:string[],periods?:string[]}} [vocab]  rule vocabulary the system adds to the core one
 */
export function defineSystem(d) {
  const bad = (m) => { throw new Error(`defineSystem(${d?.id ?? "?"}): ${m}`); };
  if (!d || typeof d.id !== "string" || !/^[\w-]+$/.test(d.id)) bad("id is required (letters, numbers, - and _)");
  if (d.api !== 1) bad("api must be 1");
  if (!STRS(d.listedTypes) || !d.listedTypes.length) bad("listedTypes: non-empty list of strings");
  if (!FN(d.summary)) bad("summary must be a function");
  if (!d.handlers || typeof d.handlers !== "object") bad("handlers must be an object");
  for (const [n, h] of Object.entries(d.handlers)) { if (!FN(h)) bad(`handler "${n}" must be a function`); if (OPEN.includes(n)) bad(`"${n}" cannot be overridden`); }
  for (const k of ["modContext", "modPreview", "register"]) if (d[k] !== undefined && !FN(d[k])) bad(`${k} must be a function`);
  if (d.catalogUrl !== undefined && typeof d.catalogUrl !== "string") bad("catalogUrl must be a string");
  const overrides = d.overrides ?? [], ruleItemTypes = d.ruleItemTypes ?? [], rulePacks = d.rulePacks ?? [];
  if (!STRS(overrides)) bad("overrides: list of names");
  if (!STRS(ruleItemTypes)) bad("ruleItemTypes: list of types");
  if (!Array.isArray(rulePacks) || rulePacks.some((p) => typeof p?.pack !== "string" || (p.types !== undefined && !STRS(p.types)))) bad("rulePacks: [{pack, types?}]");
  const vocab = { rolls: [], itemFilters: [], effects: [], costs: [], periods: [], ...(d.vocab ?? {}) };
  for (const [k, v] of Object.entries(vocab)) if (!STRS(v)) bad(`vocab.${k}: list of strings`);
  return Object.freeze({ ...d, overrides, ruleItemTypes, rulePacks, vocab });
}

/** Merges the core commands with the system's. A name collision without `overrides` is an error (nothing is hidden silently). */
export function mount(core, sys) {
  const out = { ...core };
  for (const o of sys.overrides) {
    if (!Object.hasOwn(core, o)) throw new Error(`${sys.id}: overrides lists "${o}", which does not exist in the core`);
    if (OPEN.includes(o)) throw new Error(`${sys.id}: "${o}" cannot be overridden`);
  }
  for (const [name, h] of Object.entries(sys.handlers)) {
    if (Object.hasOwn(core, name)) {
      if (!sys.overrides.includes(name)) throw new Error(`${sys.id}: command "${name}" already exists in the core (declare it in overrides to replace it)`);
      const base = core[name];
      out[name] = (user, args) => h(user, args, base);
    } else out[name] = h;
  }
  return out;
}

// Active system of this world (set by main.js after loading the plugin). Core (mods.js, rules.js) reads from here.
let CURRENT = null;
export const setCurrent = (sys) => { CURRENT = sys; };
export const current = () => CURRENT;
