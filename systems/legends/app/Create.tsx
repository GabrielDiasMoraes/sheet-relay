// Character creator in 5 steps, following the table's "Character Manager" macro flow:
// 1 start (name, demeanor, appearance, history, connections) · 2 playbook (with each one's detail)
// 3 training (sub-training, origin, hometown) · 4 +1 stat and 2 moves · 5 mastered and learned technique.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { onErr } from "../../../shared/errors";
import { t } from "../../../shared/i18n";
import { Auth, CreationData, CreationTechnique, NewCharacter, PlaybookDetail, createCharacter, creationData, playbook } from "./api";
import { APPROACH, BACKGROUNDS, C, CITIES, DEMEANORS, F, STATS, TRAINING, opts, sign, statLabel } from "./theme";
import { Chip, Field, More, Ornament, Scroll, Seal, u } from "./ui";

const STEPS = ["start", "playbook", "training", "moves", "techniques"];

// Choice from a list with an "Other" option that opens a text field.
function Pick({ label, options, value, onChange, color }: { label: string; options: string[]; value: string; onChange: (v: string) => void; color?: string }) {
  const custom = !!value && !options.includes(value);
  const [other, setOther] = useState(custom);
  return (
    <View style={{ gap: 6 }}>
      <Text style={u.label}>{label}</Text>
      <View style={u.chips}>
        {options.map((o) => <Chip key={o} label={o} on={!other && value === o} onPress={() => { setOther(false); onChange(o); }} color={color} />)}
        <Chip label={t("legends.create.other")} on={other} onPress={() => { setOther(true); onChange(""); }} color={color} />
      </View>
      {other && <Field label={t("legends.create.otherField", { label })} value={value} onChangeText={onChange} />}
    </View>
  );
}

export function CreateScreen({ auth, target, onCancel, onCreated, onAuthError }: { auth: Auth; target: { id: string; name: string } | null; onCancel: () => void; onCreated: (id: string) => void; onAuthError: () => void }) {
  const [data, setData] = useState<CreationData | null>(null);
  const [details, setDetails] = useState<Record<string, PlaybookDetail>>({});
  const [step, setStep] = useState(0);
  const [f, setF] = useState<NewCharacter>({
    actorId: target?.id, name: target?.name ?? "", playbookId: "", training: "", subTraining: "", statBonus: "", moveIds: [],
    masteredId: "", learnedId: "", background: "", demeanor: "", hometown: "", look: "", history: "", connections: ""
  });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fail = (e: any) => onErr(e, onAuthError, setErr);
  useEffect(() => { creationData(auth).then(setData).catch(fail); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (p: Partial<NewCharacter>) => { setF((v) => ({ ...v, ...p })); setErr(""); };
  const pb = details[f.playbookId];
  const choosePlaybook = (id: string) => {
    set({ playbookId: id, moveIds: [], masteredId: "", learnedId: "" });
    if (!details[id]) playbook(auth, id).then((d) => setDetails((m) => ({ ...m, [id]: d }))).catch(fail);
  };

  // Step 5 techniques: the playbook's + the chosen training's + universal ones (like the macro).
  const techniques: (CreationTechnique & { source: string })[] = [
    ...(pb?.techniques ?? []).map((tc) => ({ ...tc, source: pb!.name })),
    ...(data?.techniques ?? []).filter((tc) => tc.training === f.training || tc.training === "universal")
      .sort((a, b) => a.training.localeCompare(b.training) || a.name.localeCompare(b.name))
      .map((tc) => ({ ...tc, source: tc.training === "universal" ? t("legends.create.universal") : data!.trainings.find((x) => x.key === tc.training)?.label ?? tc.training })),
  ];
  // What is missing in each step ("Next" does not block; "Create" shows what is missing).
  const missing = [
    [!f.name.trim() && t("legends.create.missName"), !f.demeanor.trim() && t("legends.create.missDemeanor")],
    [!f.playbookId && t("legends.create.missPlaybook")],
    [!f.training && t("legends.create.missTraining")],
    [!f.statBonus && t("legends.create.missStat"), f.moveIds.length !== 2 && t("legends.create.missMoves")],
    [!f.masteredId && t("legends.create.missMastered"), !f.learnedId && t("legends.create.missLearned")],
  ].map((l) => l.filter(Boolean) as string[]);
  const allMissing = missing.flat();

  const submit = async () => {
    if (allMissing.length) return setErr(t("legends.create.missing", { list: allMissing.join(", ") }));
    setBusy(true);
    try { onCreated((await createCharacter(auth, { ...f, name: f.name.trim() })).id); } catch (e) { fail(e); setBusy(false); }
  };

  if (!data) return <Scroll title={t("legends.create.new")}>{err ? <Text style={u.err}>{err}</Text> : <ActivityIndicator color={C.navy} />}<Seal ghost label={t("legends.cancel")} onPress={onCancel} /></Scroll>;
  const training = data.trainings.find((tc) => tc.key === f.training);
  const sub = training?.subs.find((s) => s.name === f.subTraining);

  return (
    <Scroll title={target ? t("legends.create.forSheet", { name: target.name }) : t("legends.create.new")} wide>
      <View style={s.steps}>
        {STEPS.map((l, i) => (
          <Pressable key={l} accessibilityRole="tab" accessibilityState={{ selected: step === i }} onPress={() => setStep(i)} style={[s.step, step === i && s.stepOn]}>
            <Text style={[s.stepN, step === i && { color: C.paper }]}>{missing[i].length ? i + 1 : "✓"}</Text>
            <Text style={[s.stepL, step === i && { color: C.paper }]}>{t(`legends.step.${l}`)}</Text>
          </Pressable>
        ))}
      </View>

      {step === 0 && <>
        <Field label={t("legends.create.name")} value={f.name} onChangeText={(name) => set({ name })} placeholder={t("legends.create.namePh")} />
        <Pick label={t("legends.create.demeanor")} options={opts("demeanor", DEMEANORS)} value={f.demeanor} onChange={(demeanor) => set({ demeanor })} />
        <Field label={t("legends.create.look")} value={f.look} onChangeText={(look) => set({ look })} multiline />
        <Field label={t("legends.create.history")} value={f.history} onChangeText={(history) => set({ history })} multiline />
        <Field label={t("legends.create.connections")} value={f.connections} onChangeText={(connections) => set({ connections })} multiline />
      </>}

      {step === 1 && <>
        <Text style={u.hint}>{t("legends.create.pickPlaybook")}</Text>
        {data.playbooks.map((p) => {
          const on = f.playbookId === p.id, d = details[p.id];
          return (
            <View key={p.id} style={[s.card, on && s.cardOn]}>
              <Pressable accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => choosePlaybook(p.id)} style={{ gap: 2 }}>
                <Text style={s.cardTitle}>{p.name}</Text>
                <Text style={s.cardMeta}>{t("legends.create.principles", { top: p.balance.topTrack, bottom: p.balance.bottomTrack })}</Text>
                <Text style={s.cardMeta}>{STATS.map((k) => `${statLabel(k)} ${sign(p.stats[k])}`).join(" · ")}</Text>
                {!!p.feature && <Text style={s.cardMeta}>{t("legends.create.feature", { feature: p.feature })}</Text>}
              </Pressable>
              {on && (!d ? <ActivityIndicator color={C.navy} /> : <PlaybookInfo d={d} />)}
            </View>
          );
        })}
      </>}

      {step === 2 && <>
        <Text style={u.label}>{t("legends.create.training")}</Text>
        <View style={u.chips}>
          {data.trainings.map((tc) => <Chip key={tc.key} label={`${TRAINING.find((x) => x.key === tc.key)?.han ?? ""} ${tc.label}`} on={f.training === tc.key}
            onPress={() => set({ training: tc.key, subTraining: "", masteredId: "", learnedId: "" })} color={TRAINING.find((x) => x.key === tc.key)?.color} />)}
        </View>
        {training && training.subs.length > 0 && <>
          <Pick label={t("legends.create.subTraining")} options={training.subs.map((x) => x.name)} value={f.subTraining} onChange={(subTraining) => set({ subTraining })}
            color={TRAINING.find((x) => x.key === f.training)?.color} />
          {sub && <View style={s.box}><More text={sub.description} lines={6} /></View>}
        </>}
        <Pick label={t("legends.create.background")} options={opts("background", BACKGROUNDS)} value={f.background} onChange={(background) => set({ background })} />
        <Pick label={t("legends.create.hometown")} options={opts("city", CITIES)} value={f.hometown} onChange={(hometown) => set({ hometown })} />
      </>}

      {step === 3 && (!pb ? <Text style={u.hint}>{t("legends.create.needPlaybook")}</Text> : <>
        <Text style={u.label}>{t("legends.create.statPick")}</Text>
        <View style={u.chips}>
          {STATS.map((k) => <Chip key={k} label={`${statLabel(k)} ${sign(pb.stats[k] + (f.statBonus === k ? 1 : 0))}`} on={f.statBonus === k} onPress={() => set({ statBonus: k })} color={C.maroon} />)}
        </View>
        <Text style={u.label}>{t("legends.create.movesPick", { name: pb.name, n: f.moveIds.length })}</Text>
        {pb.moves.map((m) => {
          const on = f.moveIds.includes(m.id);
          return (
            <Pressable key={m.id} accessibilityRole="checkbox" accessibilityState={{ checked: on }} style={[s.card, on && s.cardOn]}
              onPress={() => set({ moveIds: on ? f.moveIds.filter((x) => x !== m.id) : f.moveIds.length < 2 ? [...f.moveIds, m.id] : f.moveIds })}>
              <Text style={s.cardTitle}>{on ? "☑" : "☐"} {m.name}</Text>
              <Text style={s.cardMeta}>{m.rollStat ? t("legends.create.rolls", { stat: statLabel(m.rollStat) }) : t("legends.create.noRoll")}</Text>
              <More text={m.description} lines={4} />
            </Pressable>
          );
        })}
      </>)}

      {step === 4 && (!pb || !f.training ? <Text style={u.hint}>{t("legends.create.needBoth")}</Text> : <>
        <Text style={u.hint}>{t("legends.create.techPick")}</Text>
        {techniques.map((tc) => {
          const m = f.masteredId === tc.id, l = f.learnedId === tc.id;
          return (
            <View key={tc.id} style={[s.card, (m || l) && s.cardOn]}>
              <Text style={s.cardTitle}>{tc.name}</Text>
              <Text style={[s.cardMeta, { color: APPROACH[tc.approach]?.color }]}>{t("legends.create.techSource", { approach: APPROACH[tc.approach]?.label ?? "—", source: tc.source })}</Text>
              <More text={tc.description} lines={3} />
              <View style={u.chips}>
                <Chip label={t("legends.create.mastered")} on={m} onPress={() => set({ masteredId: m ? "" : tc.id, learnedId: l ? "" : f.learnedId })} color={C.maroon} />
                <Chip label={t("legends.create.learned")} on={l} onPress={() => set({ learnedId: l ? "" : tc.id, masteredId: m ? "" : f.masteredId })} />
              </View>
            </View>
          );
        })}
      </>)}

      <Ornament />
      {!!err && <Text style={u.err}>{err}</Text>}
      {target && step === 4 && <Text style={u.hint}>{t("legends.create.willFill", { name: target.name })}</Text>}
      <View style={u.row}>
        {step > 0 && <View style={{ flex: 1 }}><Seal ghost label={t("legends.create.prev")} onPress={() => setStep(step - 1)} /></View>}
        <View style={{ flex: 1 }}>{step < 4 ? <Seal label={t("legends.create.next")} onPress={() => setStep(step + 1)} /> : <Seal label={busy ? t("legends.create.creating") : t("legends.create.create")} onPress={submit} disabled={busy} />}</View>
      </View>
      <Seal ghost label={t("legends.cancel")} onPress={onCancel} disabled={busy} />
    </Scroll>
  );
}

function PlaybookInfo({ d }: { d: PlaybookDetail }) {
  return (
    <View style={{ gap: 8, marginTop: 6 }}>
      {d.feature && <><Text style={s.sub}>❖ {d.feature.name}</Text><View style={s.box}><More text={d.feature.description} lines={8} /></View></>}
      {d.momentOfBalance && <><Text style={s.sub}>❖ {t("legends.create.momentOfBalance")}</Text><View style={s.box}><More text={d.momentOfBalance.description} lines={5} /></View></>}
      {d.growthQuestion && <><Text style={s.sub}>{t("legends.create.growthQuestion")}</Text><Text style={u.p}>{d.growthQuestion.description}</Text></>}
      <Text style={s.sub}>{t("legends.create.movesInfo")}</Text>
      {d.moves.map((m) => <Text key={m.id} style={u.p}>• <Text style={u.b}>{m.name}</Text>{m.rollStat ? t("legends.create.rollsParen", { stat: statLabel(m.rollStat) }) : ""}</Text>)}
      {d.techniques.length > 0 && <><Text style={s.sub}>{t("legends.create.playbookTechnique")}</Text>{d.techniques.map((tc) => <Text key={tc.id} style={u.p}>• <Text style={u.b}>{tc.name}</Text> — {APPROACH[tc.approach]?.label}</Text>)}</>}
    </View>
  );
}

const s = StyleSheet.create({
  steps: { flexDirection: "row", flexWrap: "wrap", gap: 6, justifyContent: "center" },
  step: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1.5, borderColor: C.navy, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 10 },
  stepOn: { backgroundColor: C.navy },
  stepN: { fontFamily: F.num, fontWeight: "700", color: C.navy },
  stepL: { fontFamily: F.title, fontSize: 14, color: C.navy },
  card: { borderWidth: 1.5, borderColor: C.frame, borderRadius: 6, padding: 12, gap: 4, backgroundColor: "#fffdf7" },
  cardOn: { borderColor: C.maroon, borderWidth: 2.5, backgroundColor: "#fbf3ea" },
  cardTitle: { fontFamily: F.title, fontSize: 18, color: C.ink },
  cardMeta: { fontFamily: F.body, fontSize: 13.5, color: C.soft },
  sub: { fontFamily: F.title, fontSize: 15, color: C.navy, marginTop: 4 },
  box: { backgroundColor: C.sky, borderRadius: 4, padding: 10, borderWidth: 1, borderColor: C.frame },
});
