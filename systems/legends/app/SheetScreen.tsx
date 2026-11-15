import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { onErr } from "../../../shared/errors";
import { t } from "../../../shared/i18n";
import type { Nav } from "../../../shared/types";
import { useLive } from "../../../shared/useLive";
import { Auth, RollOut, Sheet, getCharacter, roll, setItem, setItemText, toggleMark, update } from "./api";
import { GrowthScreen } from "./Growth";
import { SheetView } from "./SheetView";
import { C, F, STATS, sign, statLabel } from "./theme";
import { Chip, Scroll, Seal, u } from "./ui";
import { PerkBox } from "./Perks";

export type RollReq = { title: string; itemId?: string; approach?: string; stat: string };
export type Popup = { title: string; text: string } | { title: string; edit: string; itemId: string };
export function SheetScreen({ auth, id, nav }: { auth: Auth; id: string; nav: Nav }) {
  const onBack = nav.home, onAuthError = nav.logout;
  const [sh, setSh] = useState<Sheet | null>(null);
  const [err, setErr] = useState("");
  const [req, setReq] = useState<RollReq | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  const [growing, setGrowing] = useState(false);
  const [result, setResult] = useState<RollOut | "busy" | { error: string } | null>(null);
  const fail = (e: any) => onErr(e, onAuthError, (error) => setResult({ error }));
  const load = () => getCharacter(auth, id).then(setSh);
  useEffect(() => { load().catch((e) => onErr(e, onAuthError, setErr)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useLive(auth, id, () => load().catch(() => {}));
  if (err) return <Scroll title={t("legends.sheet.error")}><Text style={u.err}>{err}</Text><Seal label={t("legends.backPlain")} onPress={onBack} /></Scroll>;
  if (!sh) return <View style={s.night}><ActivityIndicator color={C.paper} /></View>;
  // action error: shows it on the card and reloads the sheet, so the screen does not keep a value that was not saved
  const save = (p: Promise<Sheet>) => p.then(setSh).catch((e) => { fail(e); load().catch(() => {}); throw e; });
  const quiet = (p: Promise<unknown>) => p.catch(() => {}); // the error already shows on the card
  const doRoll = async (o: { stat: string; bonus: number; penalty: number; mods?: string[] }) => {
    const r = req!; setReq(null); setResult("busy");
    try { setResult(await roll(auth, id, { itemId: r.itemId, approach: r.approach, ...o })); } catch (e) { fail(e); }
  };
  return (
    <View style={{ flex: 1, backgroundColor: C.desk }}>
      <ScrollView>
        <SheetView sh={sh} onBack={onBack} onRoll={setReq} onPopup={setPopup}
          onUpdate={(changes) => save(update(auth, id, changes)).then(() => true, () => false)} onLevelUp={() => setGrowing(true)}
          onItem={(itemId, field, value) => quiet(save(setItem(auth, id, itemId, field, value)))}
          onMark={(itemId, index) => quiet(save(toggleMark(auth, id, itemId, index)))} />
      </ScrollView>
      {req && <RollDialog req={req} sh={sh} auth={auth} onClose={() => setReq(null)} onRoll={doRoll} />}
      {popup && <PopupView p={popup} onClose={() => setPopup(null)} onSave={(itemId, text) => { setPopup(null); quiet(save(setItemText(auth, id, itemId, text))); }} />}
      {growing && <GrowthScreen auth={auth} actorId={id} onClose={() => setGrowing(false)} onAuthError={onAuthError}
        onDone={(next, detail) => { setGrowing(false); setSh(next); setPopup({ title: t("legends.growth.title"), text: t("legends.sheet.growthApplied", { detail }) }); }} />}
      {result && <RollCard res={result} onClose={() => setResult(null)} />}
    </View>
  );
}

// Full description (e.g. status) or editing of an item's text (the "____" blanks of the playbooks).
function PopupView({ p, onClose, onSave }: { p: Popup; onClose: () => void; onSave: (itemId: string, text: string) => void }) {
  const [text, setText] = useState("edit" in p ? p.edit : "");
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.dialog} onPress={() => {}}>
          <Text style={s.dialogTitle}>{p.title}</Text>
          {"edit" in p ? <>
            <Text style={u.hint}>{t("legends.sheet.fillHint")}</Text>
            <TextInput value={text} onChangeText={setText} multiline style={[u.input, { minHeight: 260, maxHeight: 460, textAlignVertical: "top" }]} accessibilityLabel={p.title} />
            <View style={u.row}><Seal label={t("legends.sheet.save")} onPress={() => onSave(p.itemId, text)} /><Seal ghost label={t("legends.cancel")} onPress={onClose} /></View>
          </> : <>
            <ScrollView style={{ maxHeight: 420 }}><Text style={u.p}>{p.text}</Text></ScrollView>
            <Seal ghost label={t("legends.close")} onPress={onClose} />
          </>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Roll popup: stat (or principle), bonus and penalty, like the system's dialog.
function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <View style={s.stepRow}>
      <Text style={[u.p, { flex: 1 }]}>{label}</Text>
      <Pressable accessibilityLabel={t("legends.sheet.dec", { label })} onPress={() => onChange(Math.max(0, value - 1))} style={s.stepBtn}><Text style={s.stepTxt}>−</Text></Pressable>
      <Text style={s.stepVal}>{value}</Text>
      <Pressable accessibilityLabel={t("legends.sheet.inc", { label })} onPress={() => onChange(Math.min(9, value + 1))} style={s.stepBtn}><Text style={s.stepTxt}>+</Text></Pressable>
    </View>
  );
}
function RollDialog({ req, sh, onClose, onRoll, auth }: { req: RollReq; sh: Sheet; onClose: () => void; onRoll: (o: { stat: string; bonus: number; penalty: number; mods?: string[] }) => void; auth: Auth }) {
  const [stat, setStat] = useState(req.stat);
  const [picked, setPicked] = useState<string[]>([]);
  const [bonus, setBonus] = useState(0);
  const [penalty, setPenalty] = useState(0);
  const opts: [string, string, number][] = [
    ...STATS.map((k) => [k, statLabel(k), sh.stats[k]] as [string, string, number]),
    ["top", sh.balance.topTrack, sh.balance.value], ["bottom", sh.balance.bottomTrack, -sh.balance.value],
  ];
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose}>
        <Pressable style={s.dialog} onPress={() => {}}>
          <Text style={s.dialogTitle}>{req.title}</Text>
          <Text style={u.label}>{t("legends.sheet.rollWith")}</Text>
          <View style={u.chips}>{opts.map(([k, l, v]) => <Chip key={k} label={`${l} ${sign(v)}`} on={stat === k} onPress={() => setStat(k)} color={k === "top" || k === "bottom" ? C.water : C.maroon} />)}</View>
          <PerkBox auth={auth} actorId={sh.id} itemId={req.itemId} approach={req.approach} stat={stat} picked={picked} setPicked={setPicked} />
          <Stepper label={t("legends.sheet.bonus")} value={bonus} onChange={setBonus} />
          <Stepper label={t("legends.sheet.penalty")} value={penalty} onChange={setPenalty} />
          <Text style={u.hint}>{t("legends.sheet.conditionsHint")}</Text>
          {!stat && <Text style={u.hint}>{t("legends.sheet.pickStat")}</Text>}
          <View style={u.row}><Seal label={t("legends.sheet.roll2d6")} onPress={() => stat && onRoll({ stat, bonus, penalty, mods: picked })} disabled={!stat} /><Seal ghost label={t("legends.cancel")} onPress={onClose} /></View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// Result in the system's card style: 10+ earth, 7–9 water, 6− fire.
const OUTCOME = { full: { key: "legends.sheet.outFull", color: C.earth }, hit: { key: "legends.sheet.outHit", color: C.water }, miss: { key: "legends.sheet.outMiss", color: C.fire } };
const PIPS: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
const Die = ({ n }: { n: number }) => (
  <View style={s.die} accessibilityLabel={t("legends.sheet.die", { n })}>
    {Array.from({ length: 9 }, (_, i) => <View key={i} style={s.pipCell}>{PIPS[n]?.includes(i) && <View style={s.pip} />}</View>)}
  </View>
);
function RollCard({ res, onClose }: { res: RollOut | "busy" | { error: string }; onClose: () => void }) {
  return (
    <View style={s.cardWrap} pointerEvents="box-none">
      <View style={s.card}>
        {res === "busy" ? <ActivityIndicator color={C.navy} /> : "error" in res ? <>
          <Text style={s.dialogTitle}>{t("legends.sheet.failed")}</Text><Text style={u.err}>{res.error}</Text>
        </> : <>
          <Text style={s.cardStat}>{t("legends.sheet.rolling", { stat: statLabel(res.stat, res.statName) })}</Text>
          {!!res.move && <Text style={s.cardMove}>{res.move}</Text>}
          <Text style={[s.cardOutcome, { color: OUTCOME[res.outcome].color }]}>{t(OUTCOME[res.outcome].key)}</Text>
          <View style={[u.row, { alignItems: "center", justifyContent: "center" }]}>
            {res.dice.map((d, i) => <Die key={i} n={d} />)}
            <Text style={s.cardTotal}>= {res.total}</Text>
          </View>
          <Text style={u.hint}>{res.formula}{res.condition ? ` · ${res.condition.name} ${sign(res.condition.value)}` : ""}</Text>
          {res.approach && <Text style={[u.hint, { textAlign: "center" }]}>{t(res.outcome === "full" ? "legends.sheet.techFull" : res.outcome === "hit" ? "legends.sheet.techHit" : "legends.sheet.techMiss")}</Text>}
          {res.mods?.used.map((m) => <Text key={m} style={u.hint}>✓ {m}</Text>)}
          {res.mods?.notes.map((n) => <Text key={n} style={u.hint}>{n}</Text>)}
        </>}
        <Pressable accessibilityRole="button" accessibilityLabel={t("legends.close")} onPress={onClose} style={s.cardClose}><Text style={s.cardCloseTxt}>✕</Text></Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  night: { flex: 1, backgroundColor: C.night, justifyContent: "center" },
  backdrop: { flex: 1, backgroundColor: "rgba(20,24,36,.55)", justifyContent: "center", padding: 16 },
  dialog: { backgroundColor: C.paper, borderWidth: 3, borderColor: C.navy, borderRadius: 6, padding: 18, gap: 12, maxWidth: 560, width: "100%", alignSelf: "center" },
  dialogTitle: { fontFamily: F.title, fontSize: 22, color: C.ink },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: C.navy, alignItems: "center", justifyContent: "center" },
  stepTxt: { fontSize: 20, color: C.navy, fontWeight: "700" },
  stepVal: { fontFamily: F.num, fontSize: 20, width: 28, textAlign: "center", color: C.ink },
  cardWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, alignItems: "center" },
  card: { backgroundColor: C.paper, borderWidth: 3, borderColor: C.navy, borderRadius: 6, padding: 16, paddingTop: 12, gap: 6, width: "100%", maxWidth: 420, alignItems: "center", boxShadow: "0 6px 24px rgba(0,0,0,.35)" } as object,
  cardStat: { fontFamily: F.title, fontSize: 17, color: C.ink },
  cardMove: { fontFamily: F.title, fontSize: 15, color: C.maroon },
  cardOutcome: { fontFamily: F.brush, fontSize: 34 },
  cardTotal: { fontFamily: F.num, fontSize: 30, color: C.ink, marginLeft: 6 },
  die: { width: 40, height: 40, borderRadius: 7, borderWidth: 2, borderColor: C.ink, backgroundColor: "#fffdf7", flexDirection: "row", flexWrap: "wrap", padding: 3 },
  pipCell: { width: "33.3%", height: "33.3%", alignItems: "center", justifyContent: "center" },
  pip: { width: 7, height: 7, borderRadius: 4, backgroundColor: C.ink },
  cardClose: { position: "absolute", top: 4, right: 8, padding: 6 },
  cardCloseTxt: { fontSize: 18, color: C.soft },
});
