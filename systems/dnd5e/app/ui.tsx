// Common visual pieces. Login, list and creation use the infernal parchment; the sheet uses the 2024 sheet style.
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Auth, describeItem, drawTable } from "./api";
import type { UI } from "../../../shared/types";
import { C, F } from "./theme";
import { t } from "../../../shared/i18n";

// Session available to the compendium links inside the texts (App provides it).
export const AuthCtx = createContext<Auth | null>(null);
// Open sheet (to roll link tables on behalf of the character).
export const ActorCtx = createContext<string | null>(null);
const LINK = /⟦([^|⟧]+)\|([^⟧]+)⟧/g;
// Text with "⟦Name|uuid⟧" links (from Foundry's @UUID): the link opens the item description right below.
export function Rich({ text, lines, style }: { text: string; lines?: number; style?: object }) {
  const auth = useContext(AuthCtx), actorId = useContext(ActorCtx);
  const [open, setOpen] = useState<{ uuid: string; name: string; text?: string; table?: boolean; rolled?: string } | null>(null);
  const roll = (uuid: string) => auth && actorId && drawTable(auth, actorId, uuid)
    .then((r) => setOpen((o) => (o?.uuid === uuid ? { ...o, rolled: `${r.formula} = ${r.total}\n${r.results.join("\n")}` } : o)))
    .catch((e) => setOpen((o) => (o?.uuid === uuid ? { ...o, rolled: e.message } : o)));
  const parts: ReactNode[] = []; let last = 0, m: RegExpExecArray | null; LINK.lastIndex = 0;
  while ((m = LINK.exec(text))) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    const [, name, uuid] = m;
    parts.push(<Text key={m.index} accessibilityRole="link" style={u.link} onPress={() => {
      if (open?.uuid === uuid) return setOpen(null);
      setOpen({ uuid, name });
      if (auth) describeItem(auth, uuid).then((d) => setOpen((o) => (o?.uuid === uuid ? { ...o, text: d.description || "—", table: d.type === "table" } : o))).catch(() => setOpen((o) => (o?.uuid === uuid ? { ...o, text: t("dnd.ui.notFound") } : o)));
    }}>{name}</Text>);
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return (
    <View>
      <Text style={[u.p, style]} numberOfLines={lines}>{parts}</Text>
      {open && <View style={u.linkBox}>
        <Text style={u.label}>{open.name}</Text>
        {open.table && !!actorId && <Seal small label={t("dnd.ui.rollTable")} onPress={() => roll(open.uuid)} />}
        {!!open.rolled && <Text style={[u.p, u.b]}>{open.rolled}</Text>}
        {open.text ? <More text={open.text} lines={open.table ? 3 : 40} /> : <ActivityIndicator color={C.red} />}
      </View>}
    </View>
  );
}

// Burnt parchment with a wax seal; appears rising from the embers.
export function Infernal({ title, children, wide }: { title?: string; children: ReactNode; wide?: boolean }) {
  const show = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(show, { toValue: 1, duration: 600, useNativeDriver: false }).start(); }, [show]);
  return (
    <ScrollView contentContainerStyle={u.page}>
      <Animated.View style={[u.sheetWrap, wide && { maxWidth: 820 }, { opacity: show, transform: [{ translateY: show.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }]}>
        <View style={u.parchment}>
          <View style={u.seal}><View style={u.sealRing}><Text style={u.sealAmp}>&</Text></View></View>
          <Text style={u.kicker}>Dungeons & Dragons</Text>
          <Text style={u.logo}>{t("dnd.ui.logo")}</Text>
          {!!title && <Text style={u.title}>{title}</Text>}
          <Ornament />
          {children}
        </View>
      </Animated.View>
    </ScrollView>
  );
}
export const Ornament = () => <View style={u.ornament}><View style={u.line} /><Text style={u.flame}>✦</Text><View style={u.line} /></View>;

export function Seal({ label, onPress, disabled, ghost, small }: { label: string; onPress: () => void; disabled?: boolean; ghost?: boolean; small?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [u.btn, ghost && u.btnGhost, small && u.btnSmall, pressed && { opacity: 0.75 }, disabled && { opacity: 0.45 }]}>
      <Text style={[u.btnText, ghost && { color: C.red }, small && { fontSize: 14 }]}>{label}</Text>
    </Pressable>
  );
}
export function Chip({ label, on, onPress, color = C.red, disabled }: { label: string; on: boolean; onPress: () => void; color?: string; disabled?: boolean }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }} disabled={disabled} onPress={onPress}
      style={[u.chip, { borderColor: color }, on && { backgroundColor: color }, disabled && { opacity: 0.35 }]}>
      <Text style={[u.chipText, { color: on ? "#fff" : color }]}>{label}</Text>
    </Pressable>
  );
}
export const Field = (p: { value: string; onChangeText: (v: string) => void; placeholder?: string; secure?: boolean; onSubmit?: () => void; label: string; multiline?: boolean; numeric?: boolean }) => (
  <View style={{ gap: 4 }}>
    <Text style={u.label}>{p.label}</Text>
    <TextInput style={[u.input, p.multiline && { minHeight: 80, textAlignVertical: "top" }]} value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} placeholderTextColor={C.soft}
      secureTextEntry={p.secure} autoCapitalize={p.secure ? "none" : "sentences"} onSubmitEditing={p.onSubmit} accessibilityLabel={p.label} multiline={p.multiline}
      keyboardType={p.numeric ? "numeric" : "default"} />
  </View>
);
export function More({ text, lines, style }: { text: string; lines: number; style?: object }) {
  const [open, setOpen] = useState(false);
  const long = text.split("\n").length > lines || text.length > lines * 70;
  return (
    <Pressable disabled={!long} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}>
      <Rich text={text} style={style} lines={open || !long ? undefined : lines} />
      {long && <Text style={u.more}>{open ? t("dnd.ui.collapse") : t("dnd.ui.showAll")}</Text>}
    </Pressable>
  );
}

export const u = StyleSheet.create({
  page: { padding: 16, minHeight: "100%", justifyContent: "center", backgroundColor: C.desk, backgroundImage: "radial-gradient(ellipse at 50% 110%, rgba(194,65,12,.45), transparent 60%)" } as object,
  sheetWrap: { width: "100%", maxWidth: 480, alignSelf: "center", paddingTop: 30 },
  parchment: { backgroundColor: C.parchment, borderRadius: 6, paddingTop: 44, paddingBottom: 26, paddingHorizontal: 22, gap: 12, boxShadow: "inset 0 0 38px rgba(59,28,14,.85), inset 0 0 8px rgba(59,28,14,.9), 0 10px 40px rgba(0,0,0,.6)" } as object,
  seal: { position: "absolute", top: -30, alignSelf: "center", width: 64, height: 64, borderRadius: 32, backgroundColor: C.red, alignItems: "center", justifyContent: "center", boxShadow: "0 3px 8px rgba(0,0,0,.5), inset 0 -4px 8px rgba(0,0,0,.35)" } as object,
  sealRing: { width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: C.gold, alignItems: "center", justifyContent: "center" },
  sealAmp: { fontFamily: F.title, fontSize: 26, color: "#e8c766", fontWeight: "700", lineHeight: 30 },
  kicker: { fontFamily: F.title, fontSize: 12, letterSpacing: 3, color: C.burnt, textAlign: "center" },
  logo: { fontFamily: F.gothic, fontSize: 38, color: C.red, textAlign: "center", lineHeight: 42 },
  title: { fontFamily: F.title, fontSize: 18, color: C.burnt, textAlign: "center" },
  ornament: { flexDirection: "row", alignItems: "center", gap: 8 },
  line: { flex: 1, height: 1, backgroundColor: C.burnt, opacity: 0.6 },
  flame: { color: C.ember, fontSize: 14 },
  p: { fontFamily: F.body, fontSize: 15.5, color: C.ink, lineHeight: 21 },
  b: { fontWeight: "700" },
  hint: { fontFamily: F.body, fontSize: 13.5, color: C.soft, fontStyle: "italic" },
  more: { fontFamily: F.title, fontSize: 11.5, color: C.red, marginTop: 4 },
  link: { color: C.red, textDecorationLine: "underline", fontWeight: "700" },
  linkBox: { borderLeftWidth: 3, borderColor: C.red, paddingLeft: 10, marginTop: 6, gap: 4 },
  label: { fontFamily: F.title, fontSize: 13.5, color: C.burnt, fontWeight: "700" },
  err: { fontFamily: F.body, fontSize: 15, color: C.red, fontWeight: "700" },
  input: { borderWidth: 1.5, borderColor: "#a88a5c", borderRadius: 4, backgroundColor: "#f7ecd2", fontFamily: F.body, fontSize: 16, color: C.ink, padding: 8 },
  btn: { backgroundColor: C.red, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 18, alignItems: "center", borderWidth: 2, borderColor: "#4a0c09", alignSelf: "stretch" },
  btnGhost: { backgroundColor: "transparent", borderColor: C.red, borderWidth: 1.5 },
  btnSmall: { paddingVertical: 6, paddingHorizontal: 12, alignSelf: "flex-start" },
  btnText: { fontFamily: F.title, fontSize: 16, color: "#fbeee0", fontWeight: "700", letterSpacing: 0.5 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 11 },
  chipText: { fontFamily: F.body, fontSize: 14.5, fontWeight: "700" },
});

// Core UI slots (shared/): the infernal parchment and the D&D seals.
const k = StyleSheet.create({
  night: { flex: 1, backgroundColor: C.desk, justifyContent: "center" },
  picker: { fontFamily: F.body, fontSize: 16, color: C.ink, backgroundColor: "transparent", borderWidth: 0 },
  box: { borderWidth: 1.5, borderColor: "#a88a5c", borderRadius: 4, padding: 12, gap: 10 },
  item: { borderBottomWidth: 1, borderColor: "#a88a5c", paddingVertical: 10, paddingHorizontal: 6 },
  itemName: { fontFamily: F.title, fontSize: 20, color: C.ink, fontWeight: "700" },
  itemSub: { fontFamily: F.body, fontSize: 14.5, color: C.soft, fontStyle: "italic" },
  hover: { backgroundColor: "#e4cd9c" },
});
export const kit: UI = {
  Frame: Infernal, Button: Seal, Chip, Field, Spinner: () => <ActivityIndicator color={C.red} />, Ornament, night: k.night, splash: C.ember,
  t: { p: u.p, hint: u.hint, err: u.err, label: u.label, intro: { textAlign: "center", fontStyle: "italic" }, row: u.row, chips: u.chips, input: u.input, picker: k.picker, box: k.box, item: k.item, itemName: k.itemName, itemSub: k.itemSub, hover: k.hover },
  c: { warn: C.red, danger: C.red, mundo: C.red, ok: C.good, border: "#a88a5c55" },
};
