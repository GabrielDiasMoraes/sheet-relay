// EN | PT selector (hidden when the language is locked by locale.config.json).
import { View } from "react-native";
import { LANGS, langLocked, useLang } from "./i18n";
import type { UI } from "./types";

export function LangSwitch({ ui }: { ui: UI }) {
  const [lang, setLang] = useLang();
  if (langLocked) return null;
  return <View style={ui.t.chips}>{LANGS.map((l) => <ui.Chip key={l.code} label={l.label} on={lang === l.code} onPress={() => setLang(l.code)} />)}</View>;
}
