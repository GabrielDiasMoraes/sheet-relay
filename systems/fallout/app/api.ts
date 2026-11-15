export type Summary = { id: string; name: string; type: string; hp: { value: number; max: number } | null };
export type RollBase = { attribute: number; rank: number; tag: boolean; complication: number };
export type Sheet = Summary & {
  level: { value: number | null; xp: number | null; next: number | null };
  origin: string; complication: number; luck: number | null; caps: number | null;
  initiative: number | null; defense: number | null; meleeDamage: number | null;
  carry: { value: number | null; total: number | null };
  attributes: Record<string, number>;
  skills: { id: string; name: string; rank: number; tag: boolean; attr: string }[];
  bodyType: string; poisonDR: number;
  creature: Record<"body" | "mind" | "melee" | "guns" | "other", number> | null;
  body: { key: string; physical: number; energy: number; radiation: number; poison: number; injuries: number[]; status: "healthy" | "wounded" | "crippled" }[];
  weapons: { id: string; name: string; skill: string; roll: RollBase | null; damageDice: number | null; ammoPerShot: number; damage: number; types: string[]; effects: string[]; qualities: string[]; range: string; rate: number | null; ammo: string; weight: number; equipped: boolean }[];
  ammo: { id: string; name: string; quantity: number; shots: { current: number; max: number } | null }[];
  gear: { id: string; name: string; type: string; quantity: number; weight: number; equipped: boolean }[];
  perks: { id: string; name: string; type: string; rank: number | null; effect: string }[];
};
import { Auth, listCharacters as listAll, rpc } from "../../../shared/api-core";
export { changePassword, deleteCharacter, eventsUrl, getRules, listRollMods, listRuleItems, listUsers, login, resetModUses, resetRules, saveRules } from "../../../shared/api-core";
export type { Auth, RollMod, Rule, RuleItem } from "../../../shared/api-core";
import type { RollMod } from "../../../shared/api-core";

export const listCharacters = (a: Auth) => listAll<Summary>(a);
export const getCharacter = (a: Auth, id: string) => rpc<Sheet>(a, "getCharacter", { actorId: id });
export const setHp = (a: Auth, id: string, hp: number) => rpc<Sheet>(a, "updateCharacter", { actorId: id, hp });

export type ModInfo = { used: string[]; notes: string[] };
export type D20 = { difficulty?: number; baseDifficulty?: number; mods?: ModInfo; rollname?: string; tn?: number; dice: { result: number; success: number; complication: number }[]; successes: number; complications: number; hitLocation?: string | null; hitLocationResult?: number | null };
export type D6 = { mods?: ModInfo; rollname?: string; dice: { face: number; result: number; effect: number }[]; total: number; effects: number; types?: string[]; ammoSpent: number; ammo: string };
export type LevelUp = {
  level: number; next: number; xp: number; required: number; canLevel: boolean; maxSkill: number;
  skills: { id: string; name: string; rank: number; attr: string; tag: boolean; canUpgrade: boolean }[];
  perks: { uuid: string; name: string; rank: number; rankMax: number; requiredLevel: number; primary: string; reasons: string[]; requirements: string; description: string; needsTag?: boolean }[];
  tagCandidates: { id: string; name: string; rank: number; attr: string }[]; // skills that Tag! can turn into TAG
};
export type Pack = { id: string; label: string };
export type Entry = { uuid: string; name: string; type: string };

export type D20Opts = RollBase & { dice: number; mods?: string[]; difficulty?: number };
export const rollSkill = (a: Auth, id: string, skillId: string, o: D20Opts) => rpc<D20>(a, "rollSkill", { actorId: id, skillId, ...o });
export const rollWeapon = (a: Auth, id: string, itemId: string, o: D20Opts) => rpc<D20>(a, "rollWeapon", { actorId: id, itemId, ...o });
export const rollDamage = (a: Auth, id: string, itemId: string, dice: number, mods?: string[]) => rpc<D6>(a, "rollDamage", { actorId: id, itemId, dice, mods });
export const levelUpOptions = (a: Auth, id: string) => rpc<LevelUp>(a, "levelUpOptions", { actorId: id });
export const levelUp = (a: Auth, id: string, skillId: string, perkUuid: string | null, extraSkillId?: string) => rpc<Sheet>(a, "levelUp", { actorId: id, skillId, perkUuid, extraSkillId });
export const listPacks = (a: Auth) => rpc<Pack[]>(a, "listPacks");
export const searchCompendium = (a: Auth, pack: string, q: string) => rpc<Entry[]>(a, "searchCompendium", { pack, query: q });
export const addItem = (a: Auth, id: string, uuid: string) => rpc<Sheet>(a, "addItem", { actorId: id, uuid });
export const createCharacter = (a: Auth, body: { name: string; type: "character" | "robot"; origin: string; attributes: Record<string, number>; tags: string[] }) =>
  rpc<Summary>(a, "createCharacter", { name: body.name, actorType: body.type, origin: body.origin, attributes: body.attributes, tags: body.tags }); // "type" is reserved by the relay: becomes actorType
export const setInjury = (a: Auth, id: string, part: string, index: number, value: 0 | 1 | 2) =>
  rpc<Sheet>(a, "setInjury", { actorId: id, part, index, value });

// Utilities (port of the table macros)
export type AmmoType = { id: string; name: string; quantityRoll: string };

export type LootTable = { id: string; name: string; magazine: boolean };
export type Lines = { lines: string[] };
export const ammoTypes = (a: Auth) => rpc<AmmoType[]>(a, "ammoTypes");
export const getAmmo = (a: Auth, id: string, ammoId: string, dice: number, fixed: number) => rpc<Lines>(a, "getAmmo", { actorId: id, ammoId, dice, fixed });

export const lootTables = (a: Auth) => rpc<LootTable[]>(a, "lootTables");
export const rollLoot = (a: Auth, id: string, counts: Record<string, number>) => rpc<Lines>(a, "rollLoot", { actorId: id, counts });

// Direct sheet edits
export const setLuck = (a: Auth, id: string, value: number) => rpc<Sheet>(a, "setLuck", { actorId: id, value });
export const setAttribute = (a: Auth, id: string, key: string, value: number) => rpc<Sheet>(a, "setAttribute", { actorId: id, key, value });
export const setSkillTag = (a: Auth, id: string, skillId: string, tag: boolean) => rpc<Sheet>(a, "setSkillTag", { actorId: id, skillId, tag });
export const setCaps = (a: Auth, id: string, value: number) => rpc<Sheet>(a, "setCaps", { actorId: id, value });
export const setQuantity = (a: Auth, id: string, itemId: string, quantity: number) => rpc<Sheet>(a, "setQuantity", { actorId: id, itemId, quantity });

// GM panel: active scene NPCs. Rolls use the token (the actor may belong only to the token).
export type Fx = { id: string; name: string; img: string }; // efeito posto por perk (Suppressor, Tenderizer…)
export type Npc = { tokenId: string; actorId: string; name: string; type: string; player?: boolean; disposition: number; // -1 hostile, 0 neutral, 1 friendly (from the token in Foundry)
  hp: { value: number; max: number } | null; hidden: boolean; dead: boolean; fx: Fx[]; conditions: string[]; weapons: Sheet["weapons"]; skills: Sheet["skills"]; creature: Sheet["creature"] };
export const sceneNpcs = (a: Auth) => rpc<{ scene: string | null; npcs: Npc[]; statuses: { id: string; name: string }[] }>(a, "sceneNpcs");
export const npcStatus = (a: Auth, n: Npc, condition: string, active: boolean) => rpc<{ ok: true }>(a, "npcStatus", { actorId: n.actorId, tokenId: n.tokenId, condition, active });
export const npcSetHp = (a: Auth, n: Npc, hp: number) => rpc<unknown>(a, "updateCharacter", { actorId: n.actorId, tokenId: n.tokenId, hp });
export const npcRollWeapon = (a: Auth, n: Npc, itemId: string, o: D20Opts) => rpc<D20>(a, "rollWeapon", { actorId: n.actorId, tokenId: n.tokenId, itemId, ...o });
export const npcRollDamage = (a: Auth, n: Npc, itemId: string, dice: number, mods?: string[]) => rpc<D6>(a, "rollDamage", { actorId: n.actorId, tokenId: n.tokenId, itemId, dice, mods });
export const npcListMods = (a: Auth, n: Npc, ctx: { roll: string; skillId?: string; itemId?: string }) => rpc<RollMod[]>(a, "listRollMods", { actorId: n.actorId, tokenId: n.tokenId, ...ctx });

// Deal damage: the same function as Foundry's "Dano ou Cura" macro.
export type SceneTarget = { tokenId: string; actorId: string; weapons: { id: string; name: string }[]; name: string; type: string; hp: { value: number; max: number } | null; dead: boolean };
export type DmgPerk = { key: string; itemName: string; label: string; text: string; usesLeft: number | null; auto?: string };
export type DefPerk = { tokenId: string; name: string; key: string; label: string };
export const sceneTargets = (a: Auth) => rpc<{ sceneId: string | null; targets: SceneTarget[] }>(a, "sceneTargets");
export const damagePerks = (a: Auth, n: { actorId: string; tokenId: string }, itemId: string) => rpc<{ apply: DmgPerk[]; kill: DmgPerk[] }>(a, "damagePerks", { actorId: n.actorId, tokenId: n.tokenId, itemId });
export const defensePerks = (a: Auth, sceneId: string | null, tokenIds: string[]) => rpc<DefPerk[]>(a, "defensePerks", { sceneId, tokenIds });
export type ApplyDamage = { sceneId: string | null; attacker: { actorId: string; tokenId: string } | null; weaponId: string | null; amount: number; dmgType: string; location: string; targets: { tokenId: string; defKeys: string[] }[]; perkKeys: string[]; killKeys: string[] };
export const applyDamage = (a: Auth, body: ApplyDamage) => rpc<{ lines: string[]; perkErr: string }>(a, "applyDamage", body);
