// Module i18n (no Foundry dependency: testable in node). Flat en / pt-BR dictionaries; `tr(key, params, lang?)`.
// An unknown key comes back as the text itself, so messages not yet migrated keep working.
import en from "./locales/en.js";
import ptBR from "./locales/pt-BR.js";

const dicts = { en: { ...en }, "pt-BR": { ...ptBR } };
let lang = "en";
export const LANGS = ["en", "pt-BR"];
export const addLocale = (l, dict) => { if (dict) Object.assign((dicts[l] ??= {}), dict); };
export const setLang = (l) => { lang = LANGS.includes(l) ? l : "en"; };
export const curLang = () => lang;
export const asLang = (l) => (typeof l === "string" && l.toLowerCase().startsWith("pt") ? "pt-BR" : "en");
export const tr = (key, params, l = lang) => {
  const s = dicts[l]?.[key] ?? dicts.en[key] ?? key;
  return params ? s.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`)) : s;
};
