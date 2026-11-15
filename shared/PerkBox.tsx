// Modifiers box of the roll popup: what changes this roll, with search; the server revalidates whatever is selected.
// `load` fetches the list; `deps` changes when the roll changes (reloads). What to show on each item is up to the system (`extra`).
import { ReactNode, useEffect, useRef, useState } from "react";
import { ScrollView, StyleProp, Text, TextInput, TextStyle, View, ViewStyle } from "react-native";
import type { RollMod } from "./api-core";
import { t } from "./i18n";
import type { UI } from "./types";

export type PerkLook = { title: string; search: string; color?: string; maxHeight: number; searchStyle: StyleProp<TextStyle>; modStyle: StyleProp<ViewStyle> };
type P<M extends RollMod> = {
  ui: UI; look: PerkLook; load: () => Promise<M[]>; deps: string; picked: string[]; setPicked: (k: string[]) => void;
  initial?: (mods: M[]) => string[]; // what comes pre-selected on load (default: keeps the selected items that still exist)
  chipLabel?: (m: M) => string; extra?: (m: M) => ReactNode;
};

export function PerkBox<M extends RollMod>({ ui, look, load, deps, picked, setPicked, initial, chipLabel, extra }: P<M>) {
  const [mods, setMods] = useState<M[] | null>(null);
  const [q, setQ] = useState("");
  const cur = useRef(picked); cur.current = picked; // the response arrives later: prunes what is selected now, not what was at the start
  useEffect(() => {
    let on = true;
    load().catch(() => [] as M[]).then((m) => { if (on) { setMods(m); setPicked(initial ? initial(m) : cur.current.filter((k) => m.some((x) => x.key === k))); } });
    return () => { on = false; };
  }, [deps]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mods?.length) return null;
  const shown = mods.filter((m) => !q.trim() || `${m.itemName} ${m.label} ${m.text}`.toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <View style={{ gap: 6 }}>
      <Text style={ui.t.label}>{look.title}{picked.length ? ` · ${picked.length} marcado${picked.length > 1 ? "s" : ""}` : ""}</Text>
      {mods.length > 4 && <TextInput value={q} onChangeText={setQ} placeholder="Buscar…" accessibilityLabel={look.search} style={look.searchStyle} />}
      <ScrollView style={{ maxHeight: look.maxHeight }} nestedScrollEnabled contentContainerStyle={{ gap: 6 }}>
        {shown.map((m) => {
          const on = picked.includes(m.key), out = m.usesLeft === 0;
          return (
            <View key={m.key} style={look.modStyle}>
              <ui.Chip label={chipLabel ? chipLabel(m) : `${m.itemName}: ${m.label}${out ? ` (${t("perk.noUses")})` : ""}`} on={on} disabled={out} color={look.color}
                onPress={() => !out && setPicked(on ? picked.filter((k) => k !== m.key) : [...picked, m.key])} />
              {!!m.text && <Text style={ui.t.hint}>{m.text}</Text>}
              {extra?.(m)}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
