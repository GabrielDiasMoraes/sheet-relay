// Character creation using the 2024 rules: name and attributes (standard array, point buy or rolling), class,
// background and species; then each one's choices through the advancement system (AdvanceFlow).
// Empty GM sheet or interrupted creation: resumes only what is missing.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { AdvanceFlow } from "./Advance";
import { onErr } from "../../../shared/errors";
import { Auth, CreationOptions, Origin, createCharacter, creationOptions } from "./api";
import { abilities, abilityLabel, C, F } from "./theme";
import { t } from "../../../shared/i18n";
import { Chip, Field, Infernal, More, Ornament, Seal, u } from "./ui";

const STANDARD = [15, 14, 13, 12, 10, 8];
const COST: Record<number, number> = { 8: 0, 9: 1, 10: 2, 11: 3, 12: 4, 13: 5, 14: 7, 15: 9 };
type Method = "standard" | "points" | "roll";
export type Existing = { id: string; name: string; hasClass: boolean; hasBackground: boolean; hasSpecies: boolean };

export function CreateScreen({ auth, existing, onCancel, onCreated, onAuthError }: { auth: Auth; existing?: Existing; onCancel: () => void; onCreated: (id: string) => void; onAuthError: () => void }) {
  const [opts, setOpts] = useState<CreationOptions | null>(null);
  const [step, setStep] = useState(!existing ? 0 : !existing.hasClass ? 1 : !existing.hasBackground ? 2 : !existing.hasSpecies ? 3 : 4);
  const [name, setName] = useState(existing?.name ?? "");
  const [method, setMethod] = useState<Method>("standard");
  const [scores, setScores] = useState<Record<string, number>>({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 });
  const [assign, setAssign] = useState<Record<string, number | null>>({ str: null, dex: null, con: null, int: null, wis: null, cha: null });
  const [pick, setPick] = useState<{ class?: Origin; background?: Origin; species?: Origin }>({});
  const [actorId, setActorId] = useState(existing?.id ?? "");
  const [stage, setStage] = useState(0); // index into `queue` during the choices
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fail = (e: any) => onErr(e, onAuthError, setErr);
  useEffect(() => { creationOptions(auth).then(setOpts).catch(fail); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const need = { background: !existing?.hasBackground, species: !existing?.hasSpecies, class: !existing?.hasClass };
  const parts = (["background", "species", "class"] as const).filter((k) => need[k]);
  // order of the choices: background (attributes), species, class (HP use the final CON)
  const queue = parts.map((k) => ({ k, o: pick[k]! }));
  const final = method === "standard" ? Object.fromEntries(abilities().map(([k]) => [k, assign[k] ?? 0])) : scores;
  const pointsUsed = Object.values(scores).reduce((n, v) => n + (COST[v] ?? 99), 0);
  const abilitiesOk = method === "standard" ? abilities().every(([k]) => assign[k]) : method === "points" ? pointsUsed <= 27 && Object.values(scores).every((v) => v >= 8 && v <= 15) : Object.values(scores).every((v) => v >= 3 && v <= 18);

  const start = async () => {
    if (!existing) {
      if (!name.trim()) return setErr(t("dnd.create.needName"));
      if (!abilitiesOk) return setErr(t("dnd.create.needAbilities"));
    }
    if (parts.some((k) => !pick[k])) return setErr(t("dnd.create.choose", { list: parts.filter((k) => !pick[k]).map((k) => t(`dnd.create.the.${k}`)).join(", ") }));
    setBusy(true); setErr("");
    try {
      if (!actorId) setActorId((await createCharacter(auth, name.trim(), final)).id);
      setStep(5);
    } catch (e) { fail(e); } finally { setBusy(false); }
  };

  if (!opts) return <Infernal title={t("dnd.create.new")}>{err ? <Text style={u.err}>{err}</Text> : <ActivityIndicator color={C.red} />}<Seal ghost label={t("dnd.cancel")} onPress={onCancel} /></Infernal>;

  if (step === 5 && actorId) {
    const cur = queue[stage];
    if (!cur) return <Infernal title={t("dnd.create.ready")}><Seal label={t("dnd.create.openSheet")} onPress={() => onCreated(actorId)} /></Infernal>;
    return (
      <Infernal title={`${name || existing?.name} — ${stage + 1}/${queue.length}`} wide>
        <AdvanceFlow key={cur.k} auth={auth} actorId={actorId} target={{ uuid: cur.o.uuid }} onAuthError={onAuthError}
          title={`${t(`dnd.part.${cur.k}`)}: ${cur.o.name}`}
          onDone={() => (stage + 1 < queue.length ? setStage(stage + 1) : onCreated(actorId))} />
        <Text style={u.hint}>{t("dnd.create.leaveHint")}</Text>
      </Infernal>
    );
  }

  const tabs = [!existing && t("dnd.create.tab.name"), need.class && t("dnd.part.class"), need.background && t("dnd.part.background"), need.species && t("dnd.part.species"), t("dnd.create.tab.review")];
  const list = (k: "class" | "background" | "species", items: Origin[]) => items.map((o) => (
    <OriginCard key={o.uuid} o={o} on={pick[k]?.uuid === o.uuid} onPress={() => setPick({ ...pick, [k]: o })} />
  ));
  return (
    <Infernal title={existing ? t("dnd.create.sheetOf", { name: existing.name }) : t("dnd.create.new")} wide>
      <View style={s.steps}>
        {tabs.map((l, i) => l && (
          <Pressable key={l} accessibilityRole="tab" accessibilityState={{ selected: step === i }} onPress={() => setStep(i)} style={[s.step, step === i && s.stepOn]}>
            <Text style={[s.stepL, step === i && { color: "#fff" }]}>{l}</Text>
          </Pressable>
        ))}
      </View>

      {step === 0 && !existing && <>
        <Field label={t("dnd.create.name")} value={name} onChangeText={setName} placeholder={t("dnd.create.namePh")} />
        <Text style={u.label}>{t("dnd.create.how")}</Text>
        <View style={u.chips}>
          <Chip label={t("dnd.create.standard")} on={method === "standard"} onPress={() => setMethod("standard")} />
          <Chip label={t("dnd.create.points")} on={method === "points"} onPress={() => { setMethod("points"); setScores({ str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 }); }} />
          <Chip label={t("dnd.create.rolled")} on={method === "roll"} onPress={() => { setMethod("roll"); setScores({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }); }} />
        </View>
        {method === "standard" ? abilities().map(([k, l]) => (
          <View key={k} style={{ gap: 4 }}>
            <Text style={u.p}>{l}{assign[k] ? `: ${assign[k]}` : ""}</Text>
            <View style={u.chips}>{STANDARD.map((v) => {
              const taken = Object.entries(assign).some(([kk, vv]) => kk !== k && vv === v);
              return <Chip key={v} label={String(v)} on={assign[k] === v} disabled={taken} onPress={() => setAssign({ ...assign, [k]: assign[k] === v ? null : v })} />;
            })}</View>
          </View>
        )) : <>
          {method === "points" && <Text style={u.p}>{t("dnd.create.used1")}<Text style={u.b}>{pointsUsed}/27</Text>{t("dnd.create.used2")}</Text>}
          {abilities().map(([k, l]) => {
            const v = scores[k], min = method === "points" ? 8 : 3, max = method === "points" ? 15 : 18;
            return (
              <View key={k} style={s.row}>
                <Text style={[u.p, { flex: 1 }]}>{l}</Text>
                <Pressable accessibilityLabel={t("dnd.dec", { name: l })} disabled={v <= min} onPress={() => setScores({ ...scores, [k]: v - 1 })} style={s.btn}><Text style={s.btnT}>−</Text></Pressable>
                <Text style={s.val}>{v}</Text>
                <Pressable accessibilityLabel={t("dnd.inc", { name: l })} disabled={v >= max} onPress={() => setScores({ ...scores, [k]: v + 1 })} style={s.btn}><Text style={s.btnT}>+</Text></Pressable>
              </View>
            );
          })}
        </>}
        <Text style={u.hint}>{t("dnd.create.bgHint")}</Text>
      </>}
      {step === 1 && need.class && list("class", opts.classes)}
      {step === 2 && need.background && list("background", opts.backgrounds)}
      {step === 3 && need.species && list("species", opts.species)}
      {step === 4 && <>
        {!existing && <Text style={u.p}><Text style={u.b}>{name || "—"}</Text> · {abilities().map(([k, , ab]) => `${ab} ${final[k] || "—"}`).join("  ")}</Text>}
        {parts.map((k) => <Text key={k} style={u.p}>{t(`dnd.part.${k}`)}: <Text style={u.b}>{pick[k]?.name ?? "—"}</Text></Text>)}
        <Text style={u.hint}>{t("dnd.create.reviewHint")}</Text>
      </>}
      <Ornament />
      {!!err && <Text style={u.err}>{err}</Text>}
      <View style={u.row}>
        {step > (existing ? 1 : 0) && <View style={{ flex: 1 }}><Seal ghost label={t("dnd.prev")} onPress={() => { let n = step - 1; while (n > 0 && !tabs[n]) n--; setStep(n); }} /></View>}
        <View style={{ flex: 1 }}>{step < 4
          ? <Seal label={t("dnd.create.next")} onPress={() => { let n = step + 1; while (n < 4 && !tabs[n]) n++; setStep(n); }} />
          : <Seal label={busy ? t("dnd.create.creating") : t("dnd.create.go")} onPress={start} disabled={busy} />}</View>
      </View>
      <Seal ghost label={t("dnd.cancel")} onPress={onCancel} disabled={busy} />
    </Infernal>
  );
}

function OriginCard({ o, on, onPress }: { o: Origin; on: boolean; onPress: () => void }) {
  const facts = [
    o.hitDie && t("dnd.create.hitDie", { d: o.hitDie }), o.primaryAbility.length && t("dnd.create.primary", { list: o.primaryAbility.map((k) => abilityLabel(k)).join(t("dnd.or")) }),
    o.asi && t("dnd.create.asi", { a: o.asi.cap, b: o.asi.points - o.asi.cap, list: abilities().filter(([k]) => !o.asi!.locked.includes(k)).map(([, l]) => l).join(", ") }),
    o.speed && t("dnd.create.speed", { n: o.speed }),
  ].filter(Boolean) as string[];
  return (
    <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={onPress} style={[s.card, on && s.cardOn]}>
      <Text style={s.cardTitle}>{on ? "◉ " : "○ "}{o.name}</Text>
      {facts.map((f) => <Text key={f} style={s.meta}>{f}</Text>)}
      {o.traits.map((tr) => <Text key={tr.title} style={s.meta}>{tr.title}: {[...tr.grants, tr.choose ? t("dnd.create.choose1", { n: tr.choose }) : ""].filter(Boolean).join(", ")}</Text>)}
      {o.features.length > 0 && <Text style={s.meta}>{t("dnd.create.grants", { list: o.features.join(", ") })}</Text>}
      {on && !!o.description && <More text={o.description} lines={6} />}
    </Pressable>
  );
}

const s = StyleSheet.create({
  steps: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  step: { borderWidth: 1.5, borderColor: C.red, borderRadius: 14, paddingVertical: 4, paddingHorizontal: 10 },
  stepOn: { backgroundColor: C.red },
  stepL: { fontFamily: F.title, fontSize: 13, color: C.red, fontWeight: "700" },
  card: { borderWidth: 1.5, borderColor: "#a88a5c", borderRadius: 6, padding: 12, gap: 3, backgroundColor: "#f6e9c9" },
  cardOn: { borderColor: C.red, borderWidth: 2.5, backgroundColor: "#f8e3d0" },
  cardTitle: { fontFamily: F.title, fontSize: 18, color: C.ink, fontWeight: "700" },
  meta: { fontFamily: F.body, fontSize: 14, color: C.soft },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  btn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: C.red, alignItems: "center", justifyContent: "center" },
  btnT: { fontSize: 18, color: C.red, fontWeight: "700" },
  val: { fontFamily: F.body, fontSize: 18, fontWeight: "800", width: 30, textAlign: "center", color: C.ink },
});
