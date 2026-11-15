import { Auth, rpc } from "../../../shared/api-core";
export { changePassword, deleteCharacter, getRules, listRollMods, listRuleItems, listUsers, login, resetRules, saveRules } from "../../../shared/api-core";
export type { Auth, RollMod, Rule, RuleItem } from "../../../shared/api-core";

export type Summary = { id: string; name: string; type: string; level: number; classes: string; hp: { value: number; max: number } };
export type Activity = { id: string; type: string; name: string; activation: string; toHit: string | null; damage: string[]; save: { ability: string[]; dc: number } | null };
export type Uses = { value: number; max: number; spent: number } | null;
export type Klass = { id: string; name: string; identifier: string; level: number; subclass: string | null; hd: { denomination: string; value: number; max: number } };
export type Spell = { id: string; name: string; level: number; school: string; prepared: number; method: string; components: string; concentration: boolean; ritual: boolean; activation: string; range: string; duration: string; activities: Activity[]; description: string };
export type Gear = { id: string; name: string; type: string; quantity: number; equipped: boolean; weight: number; attuned: boolean; attunement: string; uses: Uses; activities: Activity[]; description: string };
export type Feature = { special?: string | null; choices?: { value: string; label: string }[] | null; pool?: { die: number; max: number; left: number; cap: number } | null; id: string; name: string; kind: string; uses: Uses; activities: Activity[]; description: string };
export type Sheet = Summary & {
  classes: Klass[]; species: string; background: string; alignment: string; xp: { value: number; max: number | null }; prof: number;
  abilities: { key: string; value: number; mod: number; save: number; saveProf: boolean }[];
  skills: { key: string; ability: string; prof: number; total: number; passive: number }[];
  ac: number; init: number; speed: { walk: number; fly: number; swim: number; climb: number; units: string }; darkvision: number; size: string;
  hp: { value: number; max: number; temp: number; tempmax: number }; hd: { value: number; max: number };
  death: { success: number; failure: number }; inspiration: boolean; exhaustion: number; conditions: string[];
  spellcasting: { ability: string; dc: number | null; attack: number | null } | null;
  slots: { key: string; level: number; value: number; max: number }[];
  spells: Spell[]; attacks: { id: string; name: string; activities: Activity[] }[]; gear: Gear[]; features: Feature[]; pending?: Choice[];
  currency: Record<string, number>; encumbrance: { value: number; max: number }; languages: string[];
  traits: { armor: string[]; weapons: string[]; tools: string[] };
  bio: Record<"biography" | "appearance" | "trait" | "ideal" | "bond" | "flaw" | "age" | "height" | "weight" | "eyes" | "skin" | "hair" | "gender" | "faith", string>;
};
export type RollOut = { kind: string; label: string; total?: number; formula?: string; dice?: { faces: number; result: number; active: boolean }[]; critical?: boolean; fumble?: boolean; cancelled?: boolean; healed?: { name: string; applied?: number; hp: { value: number; max: number } } | null; mods?: { used: string[]; warn?: string[]; notes: string[]; extra: { label: string; total: number; formula: string }[] } };
export type Choice = { id: string; itemId: string; kind: string; title: string; options: { value: string; label: string }[] }; // choice awaiting the player (e.g. the "Apartado dos Sonhos" skill)
export const resolvePending = (a: Auth, actorId: string, id: string, value: string) => rpc<{ ok: true }>(a, "resolvePending", { actorId, choiceId: id, value });
export type HealTarget = { tokenId: string; actorId: string; name: string; hp: { value: number; max: number } };
export const healTargets = (a: Auth) => rpc<HealTarget[]>(a, "healTargets", {});
export const pool = (a: Auth, actorId: string, itemId: string, dice: number, targetTokenId?: string) => rpc<RollOut>(a, "pool", { actorId, itemId, dice, targetTokenId });
export const special = (a: Auth, actorId: string, itemId: string, choice?: string) => rpc<{ ok: true }>(a, "special", { actorId, itemId, choice }); // choice: option chosen on activation (Starry/Martial Form); "id" is reserved by the relay
export type Mode = "normal" | "adv" | "dis";

// Creation and level up (dnd5e advancements)
export type Option = { key?: string; uuid?: string; name?: string; label?: string; level?: number; optional?: boolean; description?: string };
export type Pending = {
  key: string; type: string; title: string; item: string; level: number; hint: string;
  label?: string; count?: number; options?: Option[]; grants?: string[]; spellAbilities?: string[];
  die?: number; average?: number; con?: number;
  points?: number; cap?: number; locked?: string[]; abilities?: { key: string; value: number; max: number; canImprove: boolean }[]; allowFeat?: boolean; feats?: Option[];
};
export type AdvanceOut = { pending: Pending | null; done: { key: string; title: string; item: string }[]; committed?: boolean; sheet?: Sheet };
export type Origin = { uuid: string; name: string; type: string; description: string; hitDie: string | null; primaryAbility: string[]; traits: { title: string; grants: string[]; choose: number }[]; features: string[]; asi: { points: number; cap: number; locked: string[] } | null; speed: number | null };
export type CreationOptions = { classes: Origin[]; backgrounds: Origin[]; species: Origin[] };

export const getCharacter = (a: Auth, actorId: string) => rpc<Sheet>(a, "getCharacter", { actorId });
export const roll = (a: Auth, actorId: string, o: { kind: string; key?: string; mode?: Mode; bonus?: number; mods?: string[] }) => rpc<RollOut>(a, "roll", { actorId, ...o });
export const activity = (a: Auth, actorId: string, o: { itemId: string; activityId?: string; action: "use" | "attack" | "damage" | "heal"; mode?: Mode; bonus?: number; mods?: string[]; slot?: string; critical?: boolean; targetTokenId?: string }) =>
  rpc<RollOut & { sheet?: Sheet }>(a, "activity", { actorId, ...o });
export const update = (a: Auth, actorId: string, changes: Record<string, unknown>) => rpc<Sheet>(a, "update", { actorId, changes });
export const hp = (a: Auth, actorId: string, amount: number, heal: boolean) => rpc<Sheet>(a, "hp", { actorId, amount, heal });
export const setItem = (a: Auth, actorId: string, itemId: string, field: string, value: unknown) => rpc<Sheet>(a, "setItem", { actorId, itemId, field, value });
export const removeItem = (a: Auth, actorId: string, itemId: string) => rpc<Sheet>(a, "removeItem", { actorId, itemId });
export const condition = (a: Auth, actorId: string, cond: string, active: boolean) => rpc<Sheet>(a, "condition", { actorId, condition: cond, active });
export const rest = (a: Auth, actorId: string, kind: "short" | "long") => rpc<Sheet>(a, "rest", { actorId, kind });
export const packs = (a: Auth) => rpc<{ id: string; label: string }[]>(a, "packs");
export const search = (a: Auth, pack: string, query: string, itemType = "") => rpc<{ uuid: string; name: string; type: string; level: number | null }[]>(a, "search", { pack, query, itemType });
export const addItem = (a: Auth, actorId: string, uuid: string) => rpc<Sheet>(a, "addItem", { actorId, uuid });
export const drawTable = (a: Auth, actorId: string, uuid: string) => rpc<{ total: number; formula: string; results: string[] }>(a, "drawTable", { actorId, uuid });
export const describeItem = (a: Auth, uuid: string) => rpc<{ uuid: string; name: string; type: string; level: number | null; school: string; activation: string; range: string; components: string; description: string }>(a, "describeItem", { uuid });
export const creationOptions = (a: Auth) => rpc<CreationOptions>(a, "creationOptions");
export const createCharacter = (a: Auth, name: string, abilities: Record<string, number>) => rpc<Summary>(a, "createCharacter", { name, abilities });
export const advance = (a: Auth, actorId: string, target: { uuid?: string; classId?: string }, decisions: Record<string, unknown>, commit = false) =>
  rpc<AdvanceOut>(a, "advance", { actorId, ...target, decisions, commit });

// GM panel
export type SceneToken = { tokenId: string; actorId: string; name: string; kind: string; disposition: number; hidden: boolean; hp: { value: number; max: number; temp: number }; dead: boolean; conditions: string[]; init: number | null; player: boolean; attacks: { id: string; name: string; activities: Activity[] }[]; fx: { id: string; name: string; img: string; left: number | null }[] };
export type SceneData = { scene: string | null; combat: boolean; damageTypes: { id: string; name: string }[]; conditions: { id: string; name: string }[]; tokens: SceneToken[] };
export const sceneTokens = (a: Auth) => rpc<SceneData>(a, "sceneTokens", {});
export const tokenHp = (a: Auth, t: SceneToken, amount: number, mode: "damage" | "heal" | "temp", damageType?: string) => rpc<{ name: string; hp: SceneToken["hp"] }>(a, "tokenHp", { actorId: t.actorId, tokenId: t.tokenId, amount, mode, damageType });
export const tokenCondition = (a: Auth, t: SceneToken, cond: string, active: boolean) => rpc<{ ok: true }>(a, "condition", { actorId: t.actorId, tokenId: t.tokenId, condition: cond, active });
export const sceneInit = (a: Auth, tokenIds: string[]) => rpc<{ ok: true }>(a, "sceneInit", { tokenIds });
export const tokenActivity = (a: Auth, t: SceneToken, itemId: string, activityId: string, action: "attack" | "damage", mode: Mode = "normal") => rpc<RollOut>(a, "tokenActivity", { actorId: t.actorId, tokenId: t.tokenId, itemId, activityId, action, mode });
export const tokenEffect = (a: Auth, t: SceneToken, o: { action: "add"; name: string; rounds: number; icon: string } | { action: "remove"; effectId: string }) => rpc<{ ok: true }>(a, "tokenEffect", { actorId: t.actorId, tokenId: t.tokenId, ...o });

