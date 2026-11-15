import { Auth, rpc } from "../../../shared/api-core";
export { changePassword, deleteCharacter, getRules, listRollMods, listRuleItems, listUsers, login, resetRules, saveRules } from "../../../shared/api-core";
export type { Auth, RollMod, Rule, RuleItem } from "../../../shared/api-core";

export type Summary = { id: string; name: string; type: string; playbook: string; fatigue: { value: number; max: number } | null };
export type Check = { id: string; name: string; checked: boolean; description: string };
export type TextItem = { id: string; name: string; description: string };
export type Move = TextItem & { category: string; rollable: boolean; rollStat: string };
export type Technique = TextItem & { approach: string; basic: boolean; training: string; learned: boolean; practiced: boolean; mastered: boolean };
export type Sheet = Summary & {
  background: string; demeanor: string; hometown: string; fightingStyle: string; look: string; connections: string; notes: string; history: string;
  training: Record<string, boolean>; stats: Record<string, number>;
  balance: { topTrack: string; bottomTrack: string; center: number; value: number };
  growth: { value: number; max: number; advancements: Record<string, { value?: number; max: number }> };
  feature: TextItem | null; momentOfBalance: TextItem | null; growthQuestions: TextItem[];
  conditions: Check[]; statuses: (Check & { positive: boolean })[]; moves: Move[]; techniques: Technique[];
};
export type RollOpts = { itemId?: string; approach?: string; stat?: string; bonus: number; penalty: number; mods?: string[] };
export type RollOut = { move: string | null; stat: string; statName: string; statValue: number; formula: string; total: number; dice: number[]; approach?: string; condition: { name: string; value: number } | null; bonus: number; penalty: number; mods?: { used: string[]; notes: string[] }; outcome: "full" | "hit" | "miss" };

// Creation (port of the Character Manager macro)
export type PlaybookSummary = { id: string; name: string; stats: Record<string, number>; balance: { topTrack: string; bottomTrack: string }; feature: string };
export type CreationTechnique = { id: string; name: string; approach: string; training: string; description: string };
export type CreationData = { playbooks: PlaybookSummary[]; trainings: { key: string; label: string; subs: { name: string; description: string }[] }[]; techniques: CreationTechnique[] };
export type PlaybookDetail = Omit<PlaybookSummary, "feature"> & {
  feature: TextItem | null; momentOfBalance: TextItem | null; growthQuestion: TextItem | null;
  moves: (TextItem & { rollStat: string })[]; techniques: CreationTechnique[];
};
export type NewCharacter = {
  actorId?: string; name: string; playbookId: string; training: string; subTraining: string; statBonus: string; moveIds: string[];
  masteredId: string; learnedId: string; background: string; demeanor: string; hometown: string; look: string; history: string; connections: string;
};

export const getCharacter = (a: Auth, actorId: string) => rpc<Sheet>(a, "getCharacter", { actorId });
export const roll = (a: Auth, actorId: string, o: RollOpts) => rpc<RollOut>(a, "roll", { actorId, ...o });
// changes: { "system.fatigue.value": 2, "profile.look": "..." } — the module only accepts a fixed list of fields
export const update = (a: Auth, actorId: string, changes: Record<string, unknown>) => rpc<Sheet>(a, "update", { actorId, changes });
export const setItem = (a: Auth, actorId: string, itemId: string, field: string, value: boolean) => rpc<Sheet>(a, "setItem", { actorId, itemId, field, value });
export const toggleMark = (a: Auth, actorId: string, itemId: string, index: number) => rpc<Sheet>(a, "toggleMark", { actorId, itemId, index });
export const setItemText = (a: Auth, actorId: string, itemId: string, value: string) => rpc<Sheet>(a, "setItemText", { actorId, itemId, value });
export const creationData = (a: Auth) => rpc<CreationData>(a, "creationData");
export const playbook = (a: Auth, playbookId: string) => rpc<PlaybookDetail>(a, "playbook", { playbookId });
export const createCharacter = (a: Auth, c: NewCharacter) => rpc<Summary>(a, "createCharacter", c);

// Growth (port of the macro's "Gerenciador de Crescimento")
export type GrowthMove = { id: string; name: string; playbook: string; rollStat: string; description: string };
export type GrowthOptions = {
  value: number; max: number; available: boolean;
  advancements: { key: string; label: string; used: number; max: number; eligible: boolean }[];
  stats: Record<string, number>; balance: Sheet["balance"]; playbookMoves: GrowthMove[]; otherMoves: GrowthMove[]; moment: string | null;
};
export const growthOptions = (a: Auth, actorId: string) => rpc<GrowthOptions>(a, "growthOptions", { actorId });
export const applyGrowth = (a: Auth, actorId: string, advancement: string, choice?: string) => rpc<Sheet>(a, "applyGrowth", { actorId, advancement, choice });

// GM panel
export type MarkItem = { id: string; name: string; checked: boolean };
export type SceneToken = { tokenId: string; actorId: string; name: string; kind: string; disposition: number; hidden: boolean; stats: Record<string, number> | null; principles: [string, string, number][]; fatigue: { value: number; max: number }; balance: { topTrack: string; bottomTrack: string; center: number; value: number } | null; techniques: { id: string; name: string; approach: string; description: string }[]; conditions: MarkItem[]; statuses: (MarkItem & { positive: boolean })[] };
export const sceneTokens = (a: Auth) => rpc<{ scene: string | null; tokens: SceneToken[] }>(a, "sceneTokens", {});
export const tokenFatigue = (a: Auth, t: SceneToken, value: number) => rpc<{ ok: true }>(a, "tokenFatigue", { actorId: t.actorId, tokenId: t.tokenId, value });
export const tokenMark = (a: Auth, t: SceneToken, itemId: string, checked: boolean) => rpc<{ ok: true }>(a, "tokenMark", { actorId: t.actorId, tokenId: t.tokenId, itemId, checked });

export const tokenBalance = (a: Auth, t: SceneToken, value: number) => rpc<{ ok: true }>(a, "tokenBalance", { actorId: t.actorId, tokenId: t.tokenId, value });
export const tokenTechnique = (a: Auth, t: SceneToken, itemId: string) => rpc<{ ok: true }>(a, "tokenTechnique", { actorId: t.actorId, tokenId: t.tokenId, itemId });
export const tokenRoll = (a: Auth, t: SceneToken, o: { stat: string; bonus: number; penalty: number }) => rpc<RollOut>(a, "tokenRoll", { actorId: t.actorId, tokenId: t.tokenId, ...o });
