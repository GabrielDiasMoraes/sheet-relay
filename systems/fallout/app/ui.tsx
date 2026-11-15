// "Paper" visual kit (black on light gray) for the core screens in shared/ (today: the rules editor). The green terminal lives in Terminal.tsx.
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import type { UI } from "../../../shared/types";
import { T } from "./Terminal";

const P = { paper: "#ecebe7", ink: "#111", dim: "#6b6b66", ok: "#00933B", bad: "#b3261e" };

const Frame: UI["Frame"] = ({ title, children }) => (
  <View style={{ flex: 1, backgroundColor: P.paper }}>
    <ScrollView contentContainerStyle={s.page}>
      {!!title && <View style={s.black}><Text style={s.blackTitle}>{title}</Text></View>}
      {children}
    </ScrollView>
  </View>
);
const Button: UI["Button"] = ({ label, onPress, disabled, ghost }) => (
  <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
    style={[ghost ? s.back : s.btn, !ghost && { backgroundColor: P.ok, borderColor: P.ok }, disabled && { opacity: 0.45 }]}>
    <Text style={ghost ? s.backTxt : [s.btnTxt, { color: "#fff" }]}>{label}</Text>
  </Pressable>
);
const Chip: UI["Chip"] = ({ label, on, onPress }) => (
  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={[s.chip, on && s.chipOn]}>
    <Text style={[s.chipTxt, on && { color: "#fff" }]}>{on ? "■" : "□"} {label}</Text>
  </Pressable>
);
const Field: UI["Field"] = ({ label, value, onChangeText, placeholder, secure, onSubmit, multiline }) => (
  <View>
    <Text style={s.lab}>{label}</Text>
    <TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} multiline={multiline} secureTextEntry={secure} onSubmitEditing={onSubmit}
      accessibilityLabel={label} autoCapitalize="none" autoCorrect={false} style={[s.input, multiline && { minHeight: 72, textAlignVertical: "top" }]} />
  </View>
);

const s = StyleSheet.create({
  page: { padding: 14, gap: 10, maxWidth: 760, width: "100%", alignSelf: "center" },
  back: { paddingVertical: 6 }, backTxt: { color: P.ink, fontWeight: "700" },
  black: { backgroundColor: P.ink, padding: 10 }, blackTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  input: { borderWidth: 2, borderColor: P.ink, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, color: P.ink },
  lab: { color: P.ink, fontWeight: "800", marginBottom: 2 }, hint: { color: P.dim }, err: { color: "#fff", backgroundColor: P.bad, padding: 8, fontWeight: "700" },
  row: { flexDirection: "row", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: { borderWidth: 2, borderColor: P.ink, backgroundColor: "#fff", paddingVertical: 5, paddingHorizontal: 9 }, chipOn: { backgroundColor: P.ink }, chipTxt: { color: P.ink, fontWeight: "700" },
  btn: { alignSelf: "flex-start", borderWidth: 2, borderColor: P.ink, paddingVertical: 10, paddingHorizontal: 16, backgroundColor: "#fff" }, btnTxt: { color: P.ink, fontWeight: "900" },
  box: { backgroundColor: "#fff", borderWidth: 2, borderColor: P.ink, padding: 10, gap: 8 },
  itemName: { color: P.ink, fontSize: 17, fontWeight: "900" },
});

export const kit: UI = {
  Frame, Button, Chip, Field, Spinner: () => <ActivityIndicator color={P.ink} />, Ornament: () => <View />,
  night: { flex: 1, backgroundColor: T.bg }, splash: T.fg,
  t: { p: s.hint, hint: s.hint, err: s.err, label: s.lab, row: s.row, chips: s.chips, input: s.input, picker: s.input, box: s.box, item: s.box, itemName: s.itemName, itemSub: s.hint, hover: s.box },
  c: { warn: P.bad, danger: P.bad, mundo: P.ok, ok: P.ok, border: "#c9c7c0" },
};
