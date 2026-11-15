// Look of the official Avatar Legends sheet: light paper, navy frames, drop-cap titles and brush.
import { Platform } from "react-native";
import { t } from "../../../shared/i18n";

export const FONTS_CSS = "https://fonts.googleapis.com/css2?family=Marcellus+SC&family=Kaushan+Script&family=Ma+Shan+Zheng&family=Spectral:ital,wght@0,400;0,600;0,700;1,400&display=swap";
const web = (f: string, fallback: string) => Platform.select({ web: `'${f}', ${fallback}`, default: fallback === "serif" ? "serif" : undefined });
export const F = {
  title: web("Marcellus SC", "serif"), // the PDF's Albertus Nova
  brush: web("Kaushan Script", "cursive"), // "Moves", "Fighting Techniques"
  han: web("Ma Shan Zheng", "serif"), // banner ideograms
  body: web("Spectral", "serif"),
  num: web("Spectral", "serif"), // numbers: the drop caps' "0" looks like "O"
};
export const C = {
  night: "#1d2433", paper: "#f7f2e4", paper2: "#ece3cc", page: "#fcfaf4", desk: "#2a3142", ink: "#26262e", soft: "#6b6878",
  navy: "#3b4a7a", frame: "#8a93c0", maroon: "#7a2323", sky: "#dfe6f3",
  water: "#2f6fb0", earth: "#3f7d3a", fire: "#b8322a", air: "#c08a1e", weapons: "#2b2a33", technology: "#7d3c98",
};
export const STATS = ["creativity", "focus", "harmony", "passion"];
// Translated texts: always read at render time (never at module top level), so the language switches without reloading.
export const statLabel = (k: string, fallback = "") => (STATS.includes(k) ? t(`legends.stat.${k}`) : fallback);
// Training banners: ideogram, second ideogram (as in the PDF) and element color.
const TRAINING_DEF: [string, string, string, string][] = [
  ["water", "水", "善", C.water], ["earth", "土", "強", C.earth], ["fire", "火", "烈", C.fire],
  ["air", "气", "和", C.air], ["weapons", "武", "精", C.weapons], ["technology", "技", "智", C.technology],
];
export const TRAINING = TRAINING_DEF.map(([key, han, han2, color]) => ({ key, han, han2, color, get label() { return t(`legends.training.${key}`); } }));
const APPROACH_DEF: [string, string][] = [["defend-maneuver", C.earth], ["advance-attack", C.fire], ["evade-observe", C.water]];
export const APPROACH: Record<string, { label: string; color: string }> = Object.fromEntries(APPROACH_DEF.map(([k, color]) => [k, { color, get label() { return t(`legends.approach.${k}`); } }]));
// Creator/sheet options: ids; the text (and the value stored on the sheet) comes from the current language.
export const DEMEANORS = ["impulsive", "serene", "determined", "gentle", "aloof", "diplomatic", "ambitious"];
export const BACKGROUNDS = ["military", "monastic", "outlaw", "privileged", "urban", "wilderness"];
export const CITIES = ["republic-city", "zaofu", "ba-sing-se", "omashu", "northern-water-tribe", "southern-water-tribe", "yu-dao", "ember-island"];
export const opts = (group: string, ids: string[]) => ids.map((id) => t(`legends.${group}.${id}`));
export const sign = (n: number) => (n > 0 ? `+${n}` : String(n));
