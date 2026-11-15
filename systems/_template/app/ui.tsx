// Minimal visual kit (the core's UI slots). Replace with components that fit your system.
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { UI } from "../../../shared/types";

const C = { bg: "#20242b", card: "#f4f1e8", ink: "#1b1d22", soft: "#666c78", accent: "#2a5f8f", danger: "#a3322a", ok: "#2f7a3e" };
const s = StyleSheet.create({
  night: { flex: 1, backgroundColor: C.bg, justifyContent: "center" },
  page: { padding: 16, minHeight: "100%", justifyContent: "center" },
  card: { width: "100%", maxWidth: 460, alignSelf: "center", backgroundColor: C.card, padding: 20, gap: 12, borderRadius: 6 },
  title: { fontSize: 22, fontWeight: "700", color: C.ink },
  p: { fontSize: 15, color: C.ink }, hint: { fontSize: 13, color: C.soft, fontStyle: "italic" }, err: { fontSize: 15, color: C.danger, fontWeight: "600" }, label: { fontSize: 15, fontWeight: "600", color: C.accent },
  row: { flexDirection: "row", gap: 10, flexWrap: "wrap" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  input: { borderWidth: 1.5, borderColor: C.soft, borderRadius: 4, backgroundColor: "#fff", fontSize: 16, color: C.ink, padding: 8 },
  btn: { backgroundColor: C.accent, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 16, alignItems: "center", alignSelf: "stretch" },
  btnGhost: { backgroundColor: "transparent", borderWidth: 1.5, borderColor: C.accent },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
  chip: { borderWidth: 1.5, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 11 },
  box: { borderWidth: 1.5, borderColor: C.soft, borderRadius: 4, padding: 12, gap: 10 },
  item: { borderBottomWidth: 1, borderColor: C.soft, paddingVertical: 10, paddingHorizontal: 6 }, itemName: { fontSize: 20, color: C.ink }, itemSub: { fontSize: 14, color: C.soft }, hover: { backgroundColor: "#e6e2d6" }
});

export const kit: UI = {
  Frame: ({ title, children }) => <ScrollView contentContainerStyle={s.page}><View style={s.card}>{!!title && <Text style={s.title}>{title}</Text>}{children}</View></ScrollView>,
  Button: ({ label, onPress, disabled, ghost }) => <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={[s.btn, ghost && s.btnGhost, disabled && { opacity: 0.45 }]}><Text style={[s.btnText, ghost && { color: C.accent }]}>{label}</Text></Pressable>,
  Chip: ({ label, on, onPress, color = C.accent, disabled }) => <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled }} disabled={disabled} onPress={onPress} style={[s.chip, { borderColor: color }, on && { backgroundColor: color }]}><Text style={{ color: on ? "#fff" : color, fontWeight: "600" }}>{label}</Text></Pressable>,
  Field: (p) => <View style={{ gap: 4 }}><Text style={s.label}>{p.label}</Text><TextInput style={[s.input, p.multiline && { minHeight: 80 }]} value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} secureTextEntry={p.secure} onSubmitEditing={p.onSubmit} accessibilityLabel={p.label} multiline={p.multiline} /></View>,
  Spinner: () => <ActivityIndicator color={C.accent} />, Ornament: () => <View />,
  night: s.night, splash: "#fff",
  t: { p: s.p, hint: s.hint, err: s.err, label: s.label, row: s.row, chips: s.chips, input: s.input, picker: s.input, box: s.box, item: s.item, itemName: s.itemName, itemSub: s.itemSub, hover: s.hover },
  c: { warn: C.danger, danger: C.danger, mundo: C.ok, ok: C.ok, border: C.soft }
};
