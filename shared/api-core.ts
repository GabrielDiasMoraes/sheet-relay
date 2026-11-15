import { getLang, t } from "./i18n";
// API core shared by the apps (Fallout, Avatar…): session, login, password, sheet list and live notices.
// Each app has its own api.ts with its system's types and commands.
export type Auth = { token: string; name: string; gm?: boolean }; // gm: only the GM sees "delete sheet" (the module checks too)

// The API is hidden from the user: on web it is the same host (via Caddy); on native it comes from the build (EXPO_PUBLIC_API_URL).
export const BASE = (process.env.EXPO_PUBLIC_API_URL ?? (typeof location !== "undefined" ? `${location.origin}/sheet-api` : "")).replace(/\/$/, "");

export async function call<T>(auth: Pick<Auth, "token"> | null, path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { ...(auth && { authorization: `Bearer ${auth.token}` }), "content-type": "application/json" }
  });
  const body = await r.json().catch(() => ({}));
  // 503: Foundry (headless) is restarting or down; the action was not performed.
  const msg = r.status === 503 ? t("err.worldDown") : (typeof body.code === "string" && body.code.startsWith("relay.") ? t("err." + body.code.slice(6)) : body.error) ?? `error ${r.status}`;
  if (!r.ok) throw Object.assign(new Error(msg), { status: r.status });
  return body;
}
export const post = (body: unknown) => ({ method: "POST", body: JSON.stringify(body) });
export const patch = (body: unknown) => ({ method: "PATCH", body: JSON.stringify(body) });
// Any module command through the relay's generic route (/api/call/<command>).
export const rpc = <T>(a: Auth, command: string, args: Record<string, unknown> = {}) => call<T>(a, `/call/${command}`, post({ ...args, lang: getLang() })); // lang: the module translates errors into this language

export const listUsers = () => call<string[]>(null, "/users");
export const login = (username: string, password: string) => call<Auth>(null, "/login", post({ username, password }));
export const changePassword = (a: Auth, oldPassword: string, newPassword: string) => call<{ ok: true }>(a, "/password", post({ oldPassword, newPassword }));
// Removes the sheet from the app (the GM can restore it). Asks for the typed name to confirm.
export const deleteCharacter = (a: Auth, actorId: string, confirmName: string) => rpc<{ ok: true }>(a, "deleteCharacter", { actorId, confirmName });
export const listCharacters = <S>(a: Auth) => call<S[]>(a, "/characters");
// Sheet notice stream (SSE): EventSource cannot send headers, so the token goes in the URL.
export const eventsUrl = (a: Auth, id: string) => `${BASE}/events?actor=${encodeURIComponent(id)}&t=${encodeURIComponent(a.token)}`;

// Roll rules and modifiers (same module commands in systems with the rollmods engine).
export type RuleCost = { uses?: { max: number | string; per?: string }; resource?: string; ap?: number | string; luck?: number | string }; // ap/luck: Fallout
export type Rule = { id: string; label: string; text?: string; auto?: string; when?: { rolls?: string[]; skills?: string[]; attributes?: string[]; situation?: string; requires?: string[]; item?: Record<string, string[]> }; effects: Record<string, unknown>[]; cost?: RuleCost };
export type RuleItem = { key: string; name: string; count: number; source: string };
export type RollMod = { key: string; itemName: string; label: string; text: string; cost?: RuleCost; auto?: string; usesLeft: number | null; usesMax?: number | null; effects?: Record<string, unknown>[]; preview?: string };
// ctx: what the roll is (each system defines the keys: itemId, stat, kind, key, activityId, action…).
export const listRollMods = (a: Auth, actorId: string, ctx: Record<string, unknown>) => rpc<RollMod[]>(a, "listRollMods", { actorId, ...ctx });
export const resetModUses = (a: Auth, actorId: string) => rpc<{ ok: true }>(a, "resetModUses", { actorId });
export const listRuleItems = (a: Auth, q: string) => rpc<RuleItem[]>(a, "listRuleItems", { q });
export const getRules = (a: Auth, key: string) => rpc<{ key: string; name: string; source: RuleItem["source"]; regras: Rule[]; padrao: Rule[] }>(a, "getRules", { key });
export const saveRules = (a: Auth, key: string, name: string, regras: Rule[]) => rpc<{ ok: true }>(a, "saveRules", { key, name, regras });
export const resetRules = (a: Auth, key: string) => rpc<{ ok: true }>(a, "resetRules", { key });
