// RobCo terminal pieces (green phosphor on black): frame, menu options with arrows, field and cursor.
import { StyleSheet, Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { ReactNode, useEffect, useState } from "react";
import { onErr } from "../../../shared/errors";
import { LANGS, langLocked, t, useLang } from "../../../shared/i18n";

export const T = { bg: "#050d07", panel: "#07140b", fg: "#3dff7a", dim: "#1f9a4a", bad: "#ff5c5c" };
export const HAS_KEYBOARD = Platform.OS === "web" && typeof matchMedia !== "undefined" && matchMedia("(pointer: fine)").matches;
const NARROW = typeof window !== "undefined" && window.innerWidth < 600;
const MONO = Platform.select({ web: "'Courier New', Courier, monospace", default: "monospace" });

export function Cursor() {
  const [on, setOn] = useState(true);
  useEffect(() => { const t = setInterval(() => setOn((v) => !v), 530); return () => clearInterval(t); }, []);
  return <Text style={[s.t, { opacity: on ? 1 : 0 }]}>█</Text>;
}
export const Line = ({ children, dim, bad }: { children: ReactNode; dim?: boolean; bad?: boolean }) => (
  <Text style={[s.t, dim && { color: T.dim }, bad && { color: T.bad }]}>{children}</Text>
);
// Menu option: "> TEXT", inverted on tap/hover, as in the game's terminal.
type PressState = { pressed: boolean; hovered?: boolean; focused?: boolean };
const OPT_DATA = { dataSet: { opt: "1" } } as object; // becomes data-opt="1" in the HTML: this is how the arrows find the options
export function Opt({ label, onPress, disabled, right }: { label: string; onPress: () => void; disabled?: boolean; right?: string }) {
  return (
    <Pressable {...OPT_DATA} accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed, hovered, focused }: PressState) => [s.opt, (pressed || hovered || focused) && !disabled && s.optOn, disabled && { opacity: 0.4 }]}>
      {({ pressed, hovered, focused }: PressState) => {
        const on = (pressed || hovered || focused) && !disabled;
        return (
          <View style={s.optRow}>
            <Text style={[s.t, on && { color: T.bg }]} numberOfLines={1}>{"> "}{label}</Text>
            {!!right && <Text style={[s.t, { color: on ? T.bg : T.dim }]}>{right}</Text>}
          </View>
        );
      }}
    </Pressable>
  );
}

// Keyboard on web: ↑/↓ move between the "> ..." options (wrapping around), Enter opens (default of the focused button).
// Inside a text field or selector the arrows stay with the field.
export function useArrowMenu() {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const active = document.activeElement as HTMLElement | null;
      if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return;
      const opts = [...document.querySelectorAll<HTMLElement>('[data-opt="1"]')].filter((el) => el.getAttribute("aria-disabled") !== "true");
      if (!opts.length) return;
      e.preventDefault();
      const i = opts.indexOf(active as HTMLElement);
      const next = i < 0 ? (e.key === "ArrowDown" ? 0 : opts.length - 1) : (i + (e.key === "ArrowDown" ? 1 : -1) + opts.length) % opts.length;
      opts[next].focus();
      opts[next].scrollIntoView({ block: "nearest" });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
}
export const Field = (p: { value: string; onChangeText: (v: string) => void; placeholder: string; secure?: boolean; onSubmit?: () => void }) => (
  <TextInput style={s.input} value={p.value} onChangeText={p.onChangeText} placeholder={p.placeholder} placeholderTextColor={T.dim}
    secureTextEntry={p.secure} autoCapitalize="none" onSubmitEditing={p.onSubmit} />
);
// Language selector in terminal style: "[X] EN  [ ] PT" (hidden when the language is locked).
function LangRow() {
  const [lang, setLang] = useLang();
  if (langLocked) return null;
  return (
    <View style={s.chips}>{LANGS.map((l) => (
      <Pressable key={l.code} accessibilityRole="radio" accessibilityState={{ checked: lang === l.code }} onPress={() => setLang(l.code)} style={[s.chip, lang === l.code && s.chipOn]}>
        <Text style={[s.t, lang === l.code && { color: T.bg }]}>{lang === l.code ? "[X]" : "[ ]"} {l.label}</Text>
      </Pressable>
    ))}</View>
  );
}
export function Terminal({ title, children }: { title: string; children: ReactNode }) {
  useArrowMenu();
  useLang(); // re-render the terminal when the language changes
  return (
    <ScrollView contentContainerStyle={s.screen}>
      <View style={s.crt}>
        <Line>ROBCO INDUSTRIES (TM) TERMLINK PROTOCOL</Line>
        <Line dim>{t("fallout.term.sub")}</Line>
        {HAS_KEYBOARD && <Line dim>{t("fallout.term.keys")}</Line>}
        {!langLocked && <Line dim>{t("fallout.term.lang")}</Line>}
        <LangRow />
        <View style={s.rule} />
        <Line>{title}</Line>
        <View style={{ height: 8 }} />
        {children}
      </View>
    </ScrollView>
  );
}

const glow = Platform.OS === "web" ? { textShadowColor: "rgba(61,255,122,0.55)", textShadowRadius: 6 } : {};
export const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.bg },
  screen: { padding: 16, minHeight: "100%", justifyContent: "center" },
  crt: { borderWidth: 2, borderColor: T.fg, backgroundColor: T.panel, padding: 18, gap: 4, maxWidth: 720, width: "100%", alignSelf: "center", borderRadius: 6 },
  t: { color: T.fg, fontFamily: MONO, fontSize: NARROW ? 14 : 16, ...glow },
  rule: { height: 1, backgroundColor: T.dim, marginVertical: 10 },
  opt: { paddingVertical: 6, paddingHorizontal: 6, borderRadius: 2, ...(Platform.OS === "web" ? { outlineStyle: "none" } : {}) } as object,
  optOn: { backgroundColor: T.fg },
  optRow: { flexDirection: "row", justifyContent: "space-between", gap: 12, flexWrap: "wrap" },
  input: { borderWidth: 1, borderColor: T.dim, backgroundColor: "#03080a", color: T.fg, fontFamily: MONO, fontSize: 16, padding: 8, marginBottom: 6 },
  picker: { color: T.fg, backgroundColor: "#03080a", fontFamily: MONO, fontSize: 16, borderWidth: 0 },
  sub: { borderLeftWidth: 2, borderColor: T.dim, paddingLeft: 10, marginVertical: 6, gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 6 },
  chip: { borderWidth: 1, borderColor: T.dim, paddingVertical: 4, paddingHorizontal: 8 },
  chipOn: { backgroundColor: T.fg, borderColor: T.fg },
  statRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  step: { paddingHorizontal: 6, paddingVertical: 4 },
  statVal: { width: 32, textAlign: "center", fontSize: 18, fontWeight: "700" },
});

// Loads a piece of data; 401 logs out, anything else becomes a message.
export function useLoad<T>(fn: () => Promise<T>, onAuthError: () => void, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => {
    fn().then(setData).catch((e) => onErr(e, onAuthError, setErr));
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return { data, setData, err, setErr };
}
