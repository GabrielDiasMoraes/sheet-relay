// Level up screens (macro port) and add-items-from-compendium screens. Same paper look as the sheet.
import { Picker } from "@react-native-picker/picker";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { t } from "../../../shared/i18n";
import { Auth, Entry, LevelUp, Pack, Sheet, addItem, levelUp, levelUpOptions, listPacks, searchCompendium } from "./api";

const P = { paper: "#ecebe7", ink: "#111", line: "#c9c7c0", cell: "#fff", dim: "#6b6b66", ok: "#00933B", bad: "#b3261e", gold: "#DDB724" };
type Props = { auth: Auth; id: string; onDone: (sh?: Sheet) => void; onAuthError: () => void };
const handle = (setErr: (m: string) => void, onAuthError: () => void) => (e: any) => (e.status === 401 ? onAuthError() : setErr(e.message));
const Btn = ({ label, onPress, disabled, light }: { label: string; onPress: () => void; disabled?: boolean; light?: boolean }) => (
  <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[s.btn, light && s.btnLight, disabled && { opacity: 0.4 }]}>
    <Text style={[s.btnText, light && { color: P.ink }]}>{label}</Text>
  </Pressable>
);

export function LevelUpScreen({ auth, id, onDone, onAuthError }: Props) {
  const [data, setData] = useState<LevelUp | null>(null);
  const [skill, setSkill] = useState<string | null>(null);
  const [step, setStep] = useState(1);
  const [tagPerk, setTagPerk] = useState<string | null>(null); // Tag! perk chosen: still need to say which skill becomes TAG
  const [hide, setHide] = useState(true);
  const [q, setQ] = useState(""); // perk search
  const [tq, setTq] = useState(""); // search in the Tag! skill choice
  const [pending, setPending] = useState<{ perk: string | null; perkName: string; extra?: string; extraName?: string } | null>(null); // choice awaiting confirmation
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { levelUpOptions(auth, id).then(setData).catch(handle(setErr, onAuthError)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const apply = async (perk: string | null, extra?: string) => {
    if (!skill) return;
    setBusy(true);
    try { onDone(await levelUp(auth, id, skill, perk, extra)); } catch (e) { handle(setErr, onAuthError)(e); setBusy(false); }
  };
  if (!data) return <View style={s.paper}>{err ? <><Text style={s.err}>{err}</Text><Btn label={t("fallout.common.back")} onPress={() => onDone()} /></> : <ActivityIndicator color={P.ink} />}</View>;
  const chosen = data.skills.find((k) => k.id === skill);

  return (
    <ScrollView contentContainerStyle={s.paper}>
      <Pressable onPress={() => (step === 2 ? setStep(1) : onDone())}><Text style={s.back}>{t("fallout.common.backArrow")}</Text></Pressable>
      <View style={s.black}><Text style={s.blackTitle}>LEVEL UP: {data.next}</Text>
        <Text style={s.blackText}>{t("fallout.lvl.xp", { xp: data.xp, req: data.required })}</Text></View>
      {!data.canLevel && <Text style={s.err}>{t("fallout.lvl.noXp", { n: data.next })}</Text>}
      {!!err && <Text style={s.err}>{err}</Text>}

      {pending ? (
        <>
          <Text style={s.h2}>{t("fallout.lvl.confirmTitle", { n: data.next })}</Text>
          <View style={s.card}>
            <Text style={s.cardTitle}>{t("fallout.lvl.skill", { name: chosen?.name ?? "", a: chosen?.rank ?? "", b: (chosen?.rank ?? 0) + 1 })}</Text>
            <Text style={s.cardTitle}>{t("fallout.lvl.perk", { name: pending.perkName })}</Text>
            {!!pending.extraName && <Text style={s.cardTitle}>{t("fallout.lvl.tagged", { name: pending.extraName })}</Text>}
            <Text style={s.dim}>{t("fallout.lvl.final")}</Text>
          </View>
          <View style={s.footer}>
            <Btn label={busy ? t("fallout.common.applying") : t("fallout.lvl.confirm")} disabled={busy} onPress={() => apply(pending.perk, pending.extra)} />
            <Btn label={t("fallout.common.back")} light disabled={busy} onPress={() => setPending(null)} />
          </View>
        </>
      ) : tagPerk ? (
        <>
          <Text style={s.h2}>{t("fallout.lvl.tagWhich")}</Text>
          <Text style={s.dim}>{t("fallout.lvl.tagInfo")}</Text>
          <TextInput value={tq} onChangeText={setTq} placeholder={t("fallout.lvl.skillPh")} accessibilityLabel={t("fallout.lvl.skillLbl")} style={s.search} />
          <View style={s.grid}>
            {data.tagCandidates.filter((k) => !tq.trim() || `${k.name} ${k.attr}`.toLowerCase().includes(tq.trim().toLowerCase())).map((k) => (
              <Pressable key={k.id} disabled={busy} onPress={() => { setPending({ perk: tagPerk, perkName: "Tag!", extra: k.id, extraName: `${k.name} (${k.rank} → ${Math.min(6, k.rank + 2)})` }); setTagPerk(null); setTq(""); }} style={s.card}>
                <Text style={s.cardTitle}>{k.name}</Text>
                <Text style={s.dim}>{k.attr?.toUpperCase()} · {k.rank} → {Math.min(6, k.rank + 2)}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.footer}><Btn label={t("fallout.common.back")} light disabled={busy} onPress={() => { setTagPerk(null); setTq(""); }} /></View>
        </>
      ) : step === 1 ? (
        <>
          <Text style={s.h2}>{t("fallout.lvl.upgrade")}</Text>
          <View style={s.grid}>
            {data.skills.map((k) => (
              <Pressable key={k.id} disabled={!k.canUpgrade} onPress={() => setSkill(k.id)}
                style={[s.card, skill === k.id && { borderColor: P.gold, borderWidth: 3 }, !k.canUpgrade && { opacity: 0.4 }]}>
                <Text style={s.cardTitle}>{k.name}{k.tag ? "  [TAG]" : ""}</Text>
                <Text style={s.dim}>{k.attr?.toUpperCase()} · {k.canUpgrade ? `${k.rank} → ${k.rank + 1}` : `${k.rank} (MAX)`}</Text>
              </Pressable>
            ))}
          </View>
          <View style={s.footer}><Btn label={t("fallout.lvl.selectPerk")} disabled={!skill || !data.canLevel} onPress={() => setStep(2)} /></View>
        </>
      ) : (
        <>
          <Text style={s.h2}>{t("fallout.lvl.chosen", { name: chosen?.name ?? "", a: chosen?.rank ?? "", b: (chosen?.rank ?? 0) + 1 })}</Text>
          <TextInput value={q} onChangeText={setQ} placeholder={t("fallout.lvl.perkPh")} accessibilityLabel={t("fallout.lvl.perkLbl")} style={s.search} />
          <View style={s.toggle}><Switch value={hide} onValueChange={setHide} /><Text style={s.dim}>{t("fallout.lvl.hide")}</Text></View>
          {data.perks.filter((p) => (!hide || !p.reasons.length) && (!q.trim() || `${p.name} ${p.requirements} ${p.description} ${p.primary}`.toLowerCase().includes(q.trim().toLowerCase()))).sort((a, b) => a.reasons.length - b.reasons.length || a.requiredLevel - b.requiredLevel).map((p) => (
            <View key={p.uuid} style={[s.card, { borderTopWidth: 4, borderTopColor: p.reasons.length ? P.bad : P.ok }]}>
              <Text style={s.cardTitle}>{p.name} <Text style={s.dim}>· rank {p.rank}/{p.rankMax} · {p.primary === "OTHERS" ? t("fallout.lvl.general") : p.primary}</Text></Text>
              <Text style={s.req}>{p.requirements ? `${p.requirements} · ` : ""}{t("fallout.lvl.level", { n: p.requiredLevel })}</Text>
              <Text style={s.desc}>{p.description}</Text>
              {p.reasons.length ? <Text style={s.err}>🔒 {p.reasons.join(", ")}</Text> : <Btn label={p.needsTag ? t("fallout.lvl.chooseNext") : t("fallout.lvl.choose")} disabled={busy} onPress={() => (p.needsTag ? setTagPerk(p.uuid) : setPending({ perk: p.uuid, perkName: p.name }))} />}
            </View>
          ))}
          <View style={s.footer}><Btn label={t("fallout.lvl.skip")} light disabled={busy} onPress={() => setPending({ perk: null, perkName: t("fallout.lvl.none") })} /></View>
        </>
      )}
    </ScrollView>
  );
}

export function AddItemScreen({ auth, id, onDone, onAuthError }: Props) {
  const [packs, setPacks] = useState<Pack[]>([]);
  const [pack, setPack] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Entry[] | null>(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { listPacks(auth).then((p) => { setPacks(p); setPack(p.find((x) => x.id.endsWith("perks"))?.id ?? p[0]?.id ?? ""); }).catch(handle(setErr, onAuthError)); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!pack) return;
    const t = setTimeout(() => searchCompendium(auth, pack, q).then(setResults).catch(handle(setErr, onAuthError)), 300); // waits for typing to stop
    return () => clearTimeout(t);
  }, [pack, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const add = async (e: Entry) => {
    setErr(""); setMsg("");
    try { await addItem(auth, id, e.uuid); setMsg(t("fallout.add.added", { name: e.name })); } catch (x) { handle(setErr, onAuthError)(x); }
  };
  return (
    <ScrollView contentContainerStyle={s.paper}>
      <Pressable onPress={() => onDone()}><Text style={s.back}>{t("fallout.common.backSheet")}</Text></Pressable>
      <View style={s.black}><Text style={s.blackTitle}>{t("fallout.add.title")}</Text></View>
      <View style={s.input}>
        <Picker selectedValue={pack} onValueChange={setPack} style={{ color: P.ink, backgroundColor: "transparent" }}>
          {packs.map((p) => <Picker.Item key={p.id} label={p.label} value={p.id} />)}
        </Picker>
      </View>
      <TextInput style={s.input} placeholder={t("fallout.add.search")} placeholderTextColor={P.dim} value={q} onChangeText={setQ} autoCapitalize="none" />
      {!!msg && <Text style={{ color: P.ok, fontWeight: "700" }}>{msg}</Text>}
      {!!err && <Text style={s.err}>{err}</Text>}
      {!results ? <ActivityIndicator color={P.ink} /> : results.length === 0 ? <Text style={s.dim}>{t("fallout.add.none")}</Text> :
        results.map((e) => (
          <View key={e.uuid} style={s.row}>
            <Text style={{ flex: 1, color: P.ink }}>{e.name} <Text style={s.dim}>({e.type})</Text></Text>
            <Btn label={t("fallout.add.add")} onPress={() => add(e)} />
          </View>
        ))}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  search: { borderWidth: 2, borderColor: P.ink, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, color: P.ink },
  paper: { backgroundColor: P.paper, padding: 14, gap: 10, width: "100%", maxWidth: 1100, alignSelf: "center", minHeight: "100%" },
  // footer stuck to the bottom of the scroll: the continue button is always within reach on a phone
  footer: { ...({ position: "sticky", bottom: 0 } as object), backgroundColor: "rgba(236,235,231,0.95)", borderTopWidth: 2, borderColor: P.ink, paddingVertical: 10, alignItems: "flex-start" },
  back: { color: P.ink, fontWeight: "700", paddingVertical: 4 },
  black: { backgroundColor: P.ink, padding: 12, gap: 4 }, blackTitle: { color: "#fff", fontSize: 22, fontWeight: "900" }, blackText: { color: "#ddd" },
  h2: { color: P.ink, fontSize: 17, fontWeight: "800", marginTop: 6 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  card: { backgroundColor: P.cell, borderWidth: 1, borderColor: P.line, padding: 10, gap: 4, minWidth: 140, flexBasis: 160, flexGrow: 1 }, // 2 colunas no celular
  cardTitle: { color: P.ink, fontWeight: "800", fontSize: 15 }, dim: { color: P.dim }, req: { color: "#8a6d00", fontWeight: "700", fontSize: 12 },
  desc: { color: P.ink, fontSize: 13 }, err: { color: P.bad, fontWeight: "700" },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { backgroundColor: P.ink, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 4, alignItems: "center", alignSelf: "flex-start" },
  btnLight: { backgroundColor: P.cell, borderWidth: 1, borderColor: P.ink }, btnText: { color: "#fff", fontWeight: "800" },
  input: { backgroundColor: P.cell, borderWidth: 1, borderColor: P.ink, padding: 8, color: P.ink },
  row: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: P.cell, borderBottomWidth: 1, borderColor: P.line, padding: 6 }
});
