// The system's types and commands. What is common (login, list, rules, password) comes from the core in shared/api-core.
import { Auth, rpc } from "../../../shared/api-core";
export { changePassword, deleteCharacter, getRules, listRollMods, listRuleItems, listUsers, login, resetRules, saveRules } from "../../../shared/api-core";
export type { Auth, RollMod, Rule, RuleItem } from "../../../shared/api-core";

export type Summary = { id: string; name: string; type: string; hp: { value: number; max: number } | null };
export type Sheet = Summary & { img: string; biography: string };
export type RollOut = { formula: string; total: number; dice: number[] };

export const getCharacter = (a: Auth, actorId: string) => rpc<Sheet>(a, "getCharacter", { actorId });
export const rename = (a: Auth, actorId: string, name: string) => rpc<Sheet>(a, "update", { actorId, name });
export const roll = (a: Auth, actorId: string, bonus = 0) => rpc<RollOut>(a, "roll", { actorId, formula: "1d20", bonus });
