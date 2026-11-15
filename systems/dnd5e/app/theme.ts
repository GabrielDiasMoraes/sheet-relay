// Official D&D 2024 sheet (pt-BR): light gray paper, stone frames, drop-cap titles; infernal login.
import { Platform } from "react-native";
import { t } from "../../../shared/i18n";

export const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Alegreya+Sans:ital,wght@0,400;0,500;0,700;0,800;1,400&family=Grenze+Gotisch:wght@500;700&display=swap";
const web = (f: string, fallback: string) => Platform.select({ web: `'${f}', ${fallback}`, default: undefined });
export const F = {
  title: web("Cinzel", "serif"), // sheet box titles
  body: web("Alegreya Sans", "sans-serif"),
  gothic: web("Grenze Gotisch", "serif"), // login infernal
};
export const C = {
  desk: "#1d0f0d", page: "#f4f3f0", panel: "#fbfaf8", stone: "#a19d97", stoneDark: "#5b5753", ink: "#262424", soft: "#6f6b66",
  red: "#7a1712", ember: "#c2410c", gold: "#c9a227", parchment: "#e9d6ab", burnt: "#3b1c0e", good: "#2f6b3a", sky: "#e8edf3",
};
// Displayed texts come from t() on every call (current language); the keys (Foundry ids) do not change.
const AB = ["str", "dex", "con", "int", "wis", "cha"];
export const abilities = (): [string, string, string][] => AB.map((k) => [k, t(`dnd.ab.${k}`), t(`dnd.ab.${k}.abbr`)]);
export const abilityLabel = (k: string) => (AB.includes(k) ? t(`dnd.ab.${k}`) : k);
const SK = ["acr", "ani", "arc", "ath", "dec", "his", "ins", "itm", "inv", "med", "nat", "prc", "prf", "per", "rel", "slt", "ste", "sur"];
export const skillName = (k: string): string | undefined => (SK.includes(k) ? t(`dnd.skill.${k}`) : undefined);
// Conditions from the 2024 book (dnd5e ids) and some useful states
const COND = ["blinded", "charmed", "deafened", "frightened", "grappled", "incapacitated", "invisible", "paralyzed", "petrified", "poisoned", "prone", "restrained", "stunned", "unconscious", "concentrating", "dodging", "hiding", "bloodied"];
export const conditions = (): [string, string][] => COND.map((k) => [k, t(`dnd.cond.${k}`)]);
export const coins = (): [string, string][] => ["cp", "sp", "ep", "gp", "pp"].map((k) => [k, t(`dnd.coin.${k}`)]);
export const sign = (n: number) => (n >= 0 ? `+${n}` : String(n));
export const armor = (): [string, string][] => ["lgt", "med", "hvy", "shl"].map((k) => [k, t(`dnd.armor.${k}`)]);
export const sizeName = (z: string) => (["Tiny", "Small", "Medium", "Large", "Huge", "Gargantuan"].includes(z) ? t(`dnd.size.${z}`) : z);
export const damageName = (id: string, fallback: string) => (["acid", "bludgeoning", "cold", "fire", "force", "lightning", "necrotic", "piercing", "poison", "psychic", "radiant", "slashing", "thunder"].includes(id) ? t(`dnd.dmg.${id}`) : fallback);
