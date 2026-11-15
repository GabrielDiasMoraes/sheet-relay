// Result in the footer in the format of Foundry's chat card (roll2d20.hbs / rollD6.hbs), with the system's own dice images.
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { D20, D6 } from "./api";
import { t } from "../../../shared/i18n";

export type Result = { kind: "d20"; r: D20 } | { kind: "d6"; r: D6 } | { kind: "lines"; title: string; lines: string[] } | { kind: "busy"; title: string } | { kind: "error"; title: string; message: string };

// The app is served on the same domain as Foundry, which publishes the system's assets.
const ASSETS = Platform.OS === "web" && typeof location !== "undefined" ? `${location.origin}/systems/fallout/assets/chat` : "";
const d20Img = (d: D20["dice"][number]) => `${ASSETS}/d20-${d.complication ? "complication" : d.success >= 2 ? "crit" : d.success === 1 ? "success" : "white"}.svg`;
const d20Color = (d: D20["dice"][number]) => (d.complication ? "#f0fff0" : d.success >= 2 ? "#ffd700" : "#111");
const typeName = (k: string) => (["physical", "energy", "radiation", "poison"].includes(k) ? t(`fallout.dmg.${k}`) : k);

export function RollResult({ res, onClose }: { res: Result; onClose: () => void }) {
  const title = res.kind === "d20" || res.kind === "d6" ? res.r.rollname ?? t("fallout.result.roll") : res.title;
  return (
    <View style={s.wrap} pointerEvents="box-none">
      <View style={s.card} accessibilityLiveRegion="polite">
        <View style={s.head}>
          <Text style={s.title} numberOfLines={2}>{title}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.result.close")} onPress={onClose} style={s.close}><Text style={s.closeTxt}>✕</Text></Pressable>
        </View>
        {res.kind === "busy" && <Text style={s.line}>{t("fallout.common.rolling")}</Text>}
        {res.kind === "error" && <Text style={[s.plaq, s.bad]}>{res.message}</Text>}
        {res.kind === "d20" && (
          <>
            <Text style={[s.plaq, res.r.difficulty == null || res.r.successes >= res.r.difficulty ? s.ok : s.bad]}>
              {t("fallout.result.successes", { n: res.r.successes })}{res.r.tn != null ? `   (TN ${res.r.tn})` : ""}
              {res.r.difficulty != null ? `   ·   ${t("fallout.result.diff", { d: res.r.difficulty, was: res.r.baseDifficulty != null && res.r.baseDifficulty !== res.r.difficulty ? t("fallout.result.was", { n: res.r.baseDifficulty }) : "", res: res.r.successes >= res.r.difficulty ? t("fallout.result.success") : t("fallout.result.fail") })}` : ""}
            </Text>
            {res.r.complications > 0 && <Text style={[s.plaq, s.bad]}>{t("fallout.result.complications", { n: res.r.complications })}</Text>}
            <View style={s.dice}>
              {res.r.dice.map((d, i) => (
                <View key={i} style={s.d20} accessibilityLabel={`d20: ${d.result}`}>
                  {!!ASSETS && <Image source={{ uri: d20Img(d) }} style={StyleSheet.absoluteFill} resizeMode="contain" />}
                  <Text style={[s.d20Txt, { color: d20Color(d) }]}>{d.result}</Text>
                </View>
              ))}
            </View>
            {!!res.r.hitLocation && <Text style={s.line}><Text style={s.bold}>{t("fallout.result.hit", { r: res.r.hitLocationResult ?? "" })}</Text> {res.r.hitLocation}</Text>}
          </>
        )}
        {res.kind === "d6" && (
          <>
            <Text style={[s.plaq, s.ok]}>{t("fallout.result.dmg", { total: res.r.total, fx: res.r.effects })}{res.r.types?.length ? `   (${res.r.types.map(typeName).join(", ")})` : ""}</Text>
            <View style={s.dice}>
              {res.r.dice.map((d, i) => (
                <View key={i} style={s.d6} accessibilityLabel={t("fallout.result.die", { r: d.result, fx: d.effect ? t("fallout.result.dieFx") : "" })}>
                  {ASSETS ? <Image source={{ uri: `${ASSETS}/d${d.face}.webp` }} style={StyleSheet.absoluteFill} resizeMode="contain" /> : <Text style={s.d20Txt}>{d.result}</Text>}
                </View>
              ))}
            </View>
            {res.r.ammoSpent > 0 && <Text style={s.line}>{t("fallout.result.spent", { n: res.r.ammoSpent, ammo: res.r.ammo })}</Text>}
          </>
        )}
        {(res.kind === "d20" || res.kind === "d6") && !!res.r.mods && (res.r.mods.used.length > 0 || res.r.mods.notes.length > 0) && (
          <View>
            {res.r.mods.used.length > 0 && <Text style={s.line}><Text style={s.bold}>{t("fallout.result.used")}</Text> {res.r.mods.used.join("; ")}</Text>}
            {res.r.mods.notes.map((n, i) => <Text key={i} style={[s.line, { fontStyle: "italic" }]}>{n}</Text>)}
          </View>
        )}
        {res.kind === "lines" && (
          <ScrollView style={{ maxHeight: 220 }}>{res.lines.map((l, i) => <Text key={i} style={s.line}>• {l}</Text>)}</ScrollView>
        )}
        {res.kind !== "error" && res.kind !== "busy" && <Text style={s.foot}>{t("fallout.result.foot")}</Text>}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { position: "absolute", left: 10, right: 10, bottom: 10, alignItems: "center" },
  card: { width: "100%", maxWidth: 520, backgroundColor: "#f4f1e8", borderWidth: 2, borderColor: "#111", padding: 10, gap: 6,
    shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 12, elevation: 8 },
  head: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  title: { flex: 1, color: "#111", fontSize: 17, fontWeight: "900" },
  close: { paddingHorizontal: 6 }, closeTxt: { color: "#111", fontSize: 18, fontWeight: "900" },
  plaq: { color: "#fff", fontWeight: "800", paddingVertical: 4, paddingHorizontal: 8, borderRadius: 3 },
  ok: { backgroundColor: "#2b6b3f" }, bad: { backgroundColor: "#a32020" },
  dice: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  d20: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  d20Txt: { fontWeight: "900", fontSize: 15 },
  d6: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  line: { color: "#222", fontSize: 13 }, bold: { fontWeight: "800" },
  foot: { color: "#777", fontSize: 11 }
});
