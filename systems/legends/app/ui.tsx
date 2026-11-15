// Common visual pieces: parchment, seal (button), chips, fields and collapsible text.
import { ReactNode, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { UI } from "../../../shared/types";
import { t } from "../../../shared/i18n";
import { C, F, TRAINING } from "./theme";

// Parchment: wooden rods on top and bottom, paper that unrolls.
export function Scroll({ title, children, wide }: { title?: string; children: ReactNode; wide?: boolean }) {
  const open = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(open, { toValue: 1, duration: 650, useNativeDriver: false }).start(); }, [open]);
  return (
    <ScrollView contentContainerStyle={u.scrollPage}>
      <View style={[u.scroll, wide && { maxWidth: 820 }]}>
        <Rod />
        <Animated.View style={[u.parchment, { opacity: open, transform: [{ scaleY: open.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) }] }]}>
          <View style={u.nations}>
            {TRAINING.slice(0, 4).map((t) => <View key={t.key} style={[u.nation, { borderColor: t.color }]}><Text style={[u.han, { color: t.color }]}>{t.han}</Text></View>)}
          </View>
          <Text style={u.logo}>Avatar Legends</Text>
          {!!title && <Text style={u.scrollTitle}>{title}</Text>}
          <Ornament />
          {children}
        </Animated.View>
        <Rod />
      </View>
    </ScrollView>
  );
}
const Rod = () => <View style={u.rodRow}><View style={u.knob} /><View style={u.rod} /><View style={u.knob} /></View>;
export const Ornament = () => <View style={u.ornament}><View style={u.line} /><View style={u.diamond} /><View style={u.line} /></View>;

// Button shaped like a red seal (stamp).
export function Seal({ label, onPress, disabled, ghost }: { label: string; onPress: () => void; disabled?: boolean; ghost?: boolean }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      style={({ pressed }) => [u.seal, ghost && u.sealGhost, pressed && { opacity: 0.75 }, disabled && { opacity: 0.45 }]}>
      <Text style={[u.sealText, ghost && { color: C.maroon }]}>{label}</Text>
    </Pressable>
  );
}
export function Chip({ label, on, onPress, color = C.navy }: { label: string; on: boolean; onPress: () => void; color?: string }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={[u.chip, { borderColor: color }, on && { backgroundColor: color }]}>
      <Text style={[u.chipText, { color: on ? C.paper : color }]}>{label}</Text>
    </Pressable>
  );
}
export const Field = (p: { value: string; onChangeText: (v: string) => void; placeholder?: string; secure?: boolean; onSubmit?: () => void; label: string; multiline?: boolean }) => (
  <View style={{ gap: 4 }}>
    <Text style={u.label}>{p.label}</Text>
    <TextInput style={[u.input, p.multiline && { minHeight: 80, textAlignVertical: "top" }]} value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} placeholderTextColor={C.soft}
      secureTextEntry={p.secure} autoCapitalize={p.secure ? "none" : "sentences"} onSubmitEditing={p.onSubmit} accessibilityLabel={p.label} multiline={p.multiline} />
  </View>
);
// Long text collapsed; tap to read it all.
export function More({ text, lines, style }: { text: string; lines: number; style?: object }) {
  const [open, setOpen] = useState(false);
  const long = text.split("\n").length > lines || text.length > lines * 60;
  return (
    <Pressable disabled={!long} accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}>
      <Text style={[u.p, style]} numberOfLines={open || !long ? undefined : lines}>{text}</Text>
      {long && <Text style={u.more}>{open ? t("legends.ui.less") : t("legends.ui.more")}</Text>}
    </Pressable>
  );
}

export const u = StyleSheet.create({
  scrollPage: { padding: 16, minHeight: "100%", justifyContent: "center" },
  scroll: { width: "100%", maxWidth: 460, alignSelf: "center" },
  rodRow: { flexDirection: "row", alignItems: "center", zIndex: 2 },
  rod: { flex: 1, height: 20, backgroundColor: "#6b3f1f", borderRadius: 10, borderWidth: 2, borderColor: "#3e2410", marginHorizontal: -4 },
  knob: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#8a5a2b", borderWidth: 2, borderColor: "#3e2410" },
  parchment: { backgroundColor: C.paper, marginHorizontal: 14, marginVertical: -6, paddingVertical: 28, paddingHorizontal: 22, gap: 12, borderLeftWidth: 1, borderRightWidth: 1, borderColor: C.paper2, boxShadow: "inset 0 10px 14px -8px rgba(80,50,20,.35), inset 0 -10px 14px -8px rgba(80,50,20,.35)" } as object,
  nations: { flexDirection: "row", justifyContent: "center", gap: 10 },
  nation: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#fffaf0" },
  han: { fontFamily: F.han, fontSize: 24, lineHeight: 30 },
  logo: { fontFamily: F.title, fontSize: 30, color: C.ink, textAlign: "center", letterSpacing: 1 },
  scrollTitle: { fontFamily: F.brush, fontSize: 22, color: C.maroon, textAlign: "center", marginTop: -6 },
  ornament: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 2 },
  line: { flex: 1, height: 1, backgroundColor: C.maroon },
  diamond: { width: 8, height: 8, backgroundColor: C.maroon, transform: [{ rotate: "45deg" }] },
  p: { fontFamily: F.body, fontSize: 15, color: C.ink, lineHeight: 21 },
  b: { fontWeight: "700" },
  hint: { fontFamily: F.body, fontSize: 13, color: C.soft, fontStyle: "italic" },
  more: { fontFamily: F.title, fontSize: 12, color: C.navy, marginTop: 4 },
  label: { fontFamily: F.title, fontSize: 15, color: C.navy },
  err: { fontFamily: F.body, fontSize: 15, color: C.fire, fontWeight: "600" },
  input: { borderWidth: 1.5, borderColor: C.frame, borderRadius: 4, backgroundColor: "#fffdf7", fontFamily: F.body, fontSize: 16, color: C.ink, padding: 8 },
  seal: { backgroundColor: C.maroon, borderRadius: 3, paddingVertical: 10, paddingHorizontal: 18, alignItems: "center", borderWidth: 2, borderColor: "#5a1414", alignSelf: "stretch" },
  sealGhost: { backgroundColor: "transparent", borderColor: C.maroon, borderWidth: 1 },
  sealText: { fontFamily: F.title, fontSize: 17, color: C.paper, letterSpacing: 1 },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 11 },
  chipText: { fontFamily: F.body, fontSize: 14, fontWeight: "600" },
});

// Core UI slots (shared/): the Avatar parchment and seals.
const k = StyleSheet.create({
  night: { flex: 1, backgroundColor: C.night, justifyContent: "center" },
  picker: { fontFamily: F.body, fontSize: 16, color: C.ink, backgroundColor: "transparent", borderWidth: 0 },
  box: { borderWidth: 1.5, borderColor: C.frame, borderRadius: 4, padding: 12, gap: 10 },
  item: { borderBottomWidth: 1, borderColor: C.frame, paddingVertical: 10, paddingHorizontal: 6 },
  itemName: { fontFamily: F.title, fontSize: 20, color: C.ink },
  itemSub: { fontFamily: F.body, fontSize: 14, color: C.soft, fontStyle: "italic" },
  hover: { backgroundColor: C.paper2 },
});
export const kit: UI = {
  Frame: Scroll, Button: Seal, Chip, Field, Spinner: () => <ActivityIndicator color={C.navy} />, Ornament, night: k.night, splash: C.paper,
  t: { p: u.p, hint: u.hint, err: u.err, label: u.label, row: u.row, chips: u.chips, input: u.input, picker: k.picker, box: k.box, item: k.item, itemName: k.itemName, itemSub: k.itemSub, hover: k.hover },
  c: { warn: C.maroon, danger: C.fire, mundo: C.earth, ok: C.earth, border: C.frame },
};
