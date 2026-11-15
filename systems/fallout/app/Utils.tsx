// Table utilities (port of the ammo and loot macros).
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { AmmoType, Auth, LootTable,  ammoTypes, getAmmo, lootTables, rollLoot,  } from "./api";
import { Result } from "./RollResult";
import { t } from "../../../shared/i18n";

export type UtilKind = "ammo" |  "loot";
type Props = { auth: Auth; id: string; onDone: (r?: Result) => void; onAuthError: () => void };
const P = { paper: "#ecebe7", ink: "#111", line: "#c9c7c0", cell: "#fff", dim: "#6b6b66", ok: "#00933B", bad: "#b3261e", gold: "#DDB724" };
const handle = (setErr: (m: string) => void, onAuthError: () => void) => (e: any) => (e.status === 401 ? onAuthError() : setErr(e.message));

function Screen({ title, sub, onBack, children, footer }: { title: string; sub: string; onBack: () => void; children: React.ReactNode; footer: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: P.paper }}>
      <ScrollView contentContainerStyle={s.page}>
        <Pressable accessibilityRole="button" onPress={onBack}><Text style={s.back}>{t("fallout.common.backSheet")}</Text></Pressable>
        <View style={s.black}><Text style={s.blackTitle}>{title}</Text><Text style={s.blackText}>{sub}</Text></View>
        {children}
      </ScrollView>
      <View style={s.footer}>{footer}</View>
    </View>
  );
}
const Card = ({ on, onPress, title, sub, children }: { on?: boolean; onPress?: () => void; title: string; sub?: string; children?: React.ReactNode }) => (
  <Pressable accessibilityRole={onPress ? "radio" : undefined} accessibilityState={{ checked: !!on }} onPress={onPress} style={[s.card, on && s.cardOn]}>
    <Text style={s.cardTitle}>{title}</Text>{!!sub && <Text style={s.sub}>{sub}</Text>}{children}
  </Pressable>
);
function Stepper({ label, value, set, min, max }: { label: string; value: number; set: (n: number) => void; min: number; max: number }) {
  return (
    <View style={s.stepRow}>
      <Text style={s.stepLabel}>{label}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.common.decrease", { label })} onPress={() => set(Math.max(min, value - 1))} style={s.stepBtn}><Text style={s.stepTxt}>−</Text></Pressable>
      <Text style={s.stepVal}>{value}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.common.increase", { label })} onPress={() => set(Math.min(max, value + 1))} style={s.stepBtn}><Text style={s.stepTxt}>+</Text></Pressable>
    </View>
  );
}
const Go = ({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) => (
  <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.go, disabled && { opacity: 0.4 }]}><Text style={s.goTxt}>{label}</Text></Pressable>
);

export function AmmoScreen({ auth, id, onDone, onAuthError }: Props) {
  const [list, setList] = useState<AmmoType[] | null>(null);
  const [q, setQ] = useState("");
  const [pick, setPick] = useState<AmmoType | null>(null);
  const [dice, setDice] = useState(0);
  const [fixed, setFixed] = useState(0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { ammoTypes(auth).then(setList).catch(handle(setErr, onAuthError)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const go = async () => {
    if (!pick) return;
    setBusy(true);
    try { const r = await getAmmo(auth, id, pick.id, dice, fixed); onDone({ kind: "lines", title: t("fallout.util.ammoTitle"), lines: r.lines }); }
    catch (e) { handle(setErr, onAuthError)(e); setBusy(false); }
  };
  const shown = (list ?? []).filter((a) => a.name.toLowerCase().includes(q.toLowerCase()));
  return (
    <Screen title={t("fallout.sheet.ammo")} sub={t("fallout.util.ammoSub")} onBack={() => onDone()}
      footer={<Go label={busy ? t("fallout.common.rolling") : pick ? t("fallout.util.get", { name: pick.name }) : t("fallout.util.pickAmmo")} onPress={go} disabled={!pick || busy} />}>
      {!!err && <Text style={s.err}>{err}</Text>}
      <Text style={s.h2}>{t("fallout.util.extras")}</Text>
      <View style={s.box}>
        <Stepper label={t("fallout.util.extraDice")} value={dice} set={setDice} min={0} max={10} />
        <Stepper label={t("fallout.util.fixed")} value={fixed} set={setFixed} min={-20} max={50} />
      </View>
      <Text style={s.h2}>{t("fallout.util.ammoType")}</Text>
      <TextInput style={s.input} placeholder={t("fallout.add.search")} placeholderTextColor={P.dim} value={q} onChangeText={setQ} />
      {!list ? <ActivityIndicator color={P.ink} /> : (
        <View style={s.grid}>
          {shown.map((a) => <Card key={a.id} on={pick?.id === a.id} onPress={() => setPick(a)} title={a.name} sub={t("fallout.util.qty", { q: a.quantityRoll })} />)}
        </View>
      )}
    </Screen>
  );
}



export function LootScreen({ auth, id, onDone, onAuthError }: Props) {
  const [tables, setTables] = useState<LootTable[] | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { lootTables(auth).then(setTables).catch(handle(setErr, onAuthError)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const go = async () => {
    setBusy(true);
    try { const r = await rollLoot(auth, id, counts); onDone({ kind: "lines", title: "Loot", lines: r.lines }); }
    catch (e) { handle(setErr, onAuthError)(e); setBusy(false); }
  };
  const group = (mag: boolean) => (tables ?? []).filter((tb) => tb.magazine === mag).map((tb) => (
    <Card key={tb.id} on={(counts[tb.id] ?? 0) > 0} title={tb.name} sub={mag ? t("fallout.util.magazine") : "Loot"}>
      <Stepper label={t("fallout.util.rolls")} value={counts[tb.id] ?? 0} set={(n) => setCounts((c) => ({ ...c, [tb.id]: n }))} min={0} max={20} />
    </Card>
  ));
  return (
    <Screen title={t("fallout.sheet.loot")} sub={t("fallout.util.lootSub")} onBack={() => onDone()}
      footer={<Go label={busy ? t("fallout.common.rolling") : total ? t("fallout.util.rollTimes", { n: total }) : t("fallout.util.pickTables")} onPress={go} disabled={!total || busy} />}>
      {!!err && <Text style={s.err}>{err}</Text>}
      {!tables ? <ActivityIndicator color={P.ink} /> : (
        <>
          <Text style={s.h2}>Loot</Text><View style={s.grid}>{group(false)}</View>
          {tables.some((t) => t.magazine) && <><Text style={s.h2}>{t("fallout.util.magazines")}</Text><View style={s.grid}>{group(true)}</View></>}
        </>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  page: { padding: 14, paddingBottom: 90, gap: 10, width: "100%", maxWidth: 1100, alignSelf: "center" },
  back: { color: P.ink, fontWeight: "700", paddingVertical: 4 },
  black: { backgroundColor: P.ink, padding: 12, gap: 4 }, blackTitle: { color: "#fff", fontSize: 22, fontWeight: "900" }, blackText: { color: "#ddd" },
  h2: { color: P.ink, fontSize: 16, fontWeight: "900", marginTop: 6, borderBottomWidth: 2, borderColor: P.ink, paddingBottom: 4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { backgroundColor: P.cell, borderWidth: 1, borderColor: P.ink, padding: 10, gap: 4, flexGrow: 1, flexBasis: 220, minWidth: 150 },
  cardOn: { borderColor: P.gold, borderWidth: 3, backgroundColor: "#fffbea" },
  cardTitle: { color: P.ink, fontWeight: "900", fontSize: 14 }, sub: { color: "#8a6d00", fontWeight: "800", fontSize: 12 },
  desc: { color: "#333", fontSize: 12 }, dimTxt: { color: P.dim }, err: { color: P.bad, fontWeight: "700" },
  box: { backgroundColor: P.cell, borderWidth: 1, borderColor: P.ink, padding: 8, gap: 6 },
  input: { backgroundColor: P.cell, borderWidth: 1, borderColor: P.ink, padding: 10, color: P.ink },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepLabel: { flex: 1, color: P.ink, fontWeight: "700" },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 2, borderColor: P.ink, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  stepTxt: { color: P.ink, fontSize: 20, fontWeight: "900", lineHeight: 22 }, stepVal: { minWidth: 30, textAlign: "center", fontSize: 18, fontWeight: "900", color: P.ink },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 10, backgroundColor: "rgba(236,235,231,0.95)", borderTopWidth: 2, borderColor: P.ink, alignItems: "center" },
  go: { backgroundColor: P.ok, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 4, width: "100%", maxWidth: 520, alignItems: "center" },
  goTxt: { color: "#fff", fontWeight: "900", fontSize: 16 }
});
