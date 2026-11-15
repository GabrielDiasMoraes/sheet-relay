// Minimal app i18n: en / pt-BR dictionaries, `t(key, params)` and a hook that re-renders when the language changes.
// Each system registers its dictionary with `addLocale` (systems/<id>/app/locales). The chosen language is kept in
// AsyncStorage (key "sheet-lang"); with no choice, the browser's applies. `locale.config.json` can lock the language
// (fork privado: { "default": "pt-BR", "locked": true }).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useSyncExternalStore } from "react";
import cfg from "./locale.config.json";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";

export type Lang = "en" | "pt-BR";
export const LANGS: { code: Lang; label: string }[] = [{ code: "en", label: "EN" }, { code: "pt-BR", label: "PT" }];
export const LANG_KEY = "sheet-lang";
export const langLocked: boolean = !!(cfg as { locked?: boolean }).locked;

const dicts: Record<Lang, Record<string, string>> = { en: { ...en }, "pt-BR": { ...ptBR } };
export const addLocale = (lang: Lang, dict: Record<string, string>) => { Object.assign(dicts[lang], dict); emit(); };

const detect = (): Lang => {
  const forced = (cfg as { default?: Lang | null }).default;
  if (forced) return forced;
  const nav = typeof navigator !== "undefined" ? navigator.language ?? "" : "";
  return nav.toLowerCase().startsWith("pt") ? "pt-BR" : "en";
};
let current: Lang = detect();
const listeners = new Set<() => void>();
let version = 0;
const emit = () => { version++; listeners.forEach((l) => l()); };

if (!langLocked) AsyncStorage.getItem(LANG_KEY).then((v) => { if ((v === "en" || v === "pt-BR") && v !== current) { current = v; emit(); } }).catch(() => {});

export const getLang = (): Lang => current;
export function setLang(l: Lang) {
  if (langLocked || l === current) return;
  current = l; AsyncStorage.setItem(LANG_KEY, l).catch(() => {}); emit();
}

/** Translates `key` in the current language (falls back to en and finally to the key itself); `{name}` is replaced by params.name. */
export function t(key: string, params?: Record<string, string | number>): string {
  const s = dicts[current][key] ?? dicts.en[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : s;
}

/** Hook: re-renders the component when the language changes and returns [language, switch]. */
export function useLang(): [Lang, (l: Lang) => void] {
  useSyncExternalStore((cb) => { listeners.add(cb); return () => listeners.delete(cb); }, () => version);
  return [current, setLang];
}
