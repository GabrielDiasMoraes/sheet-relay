// Avatar level up: with growth full (4/4) the player picks an advance, as in the "Gerenciador de Crescimento"
// table macro. The module validates everything again and resets growth on apply.
import { useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { onErr } from "../../../shared/errors";
import { t } from "../../../shared/i18n";
import { Auth, GrowthMove, GrowthOptions, Sheet, applyGrowth, growthOptions } from "./api";
import { C, F, STATS, sign, statLabel } from "./theme";
import { Chip, More, Seal, u } from "./ui";

const MAX_RAISED_STAT = 2;

export function GrowthScreen({ auth, actorId, onClose, onDone, onAuthError }: { auth: Auth; actorId: string; onClose: () => void; onDone: (s: Sheet, detail: string) => void; onAuthError: () => void }) {
  const [o, setO] = useState<GrowthOptions | null>(null);
  const [key, setKey] = useState("");
  const [choice, setChoice] = useState("");
  const [filter, setFilter] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fail = (e: any) => onErr(e, onAuthError, setErr);
  useEffect(() => { growthOptions(auth, actorId).then(setO).catch(fail); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const adv = o?.advancements.find((a) => a.key === key);
  const needsChoice = key && key !== "moment";
  const apply = async () => {
    if (needsChoice && !choice) return setErr(t("legends.growth.choose"));
    setBusy(true);
    const move = [...(o?.playbookMoves ?? []), ...(o?.otherMoves ?? [])].find((m) => m.id === choice);
    const detail = key === "raise-stat" ? `${statLabel(choice)} +1` : move ? t("legends.growth.newMove", { name: move.name })
      : key === "shift-center" ? t("legends.growth.shifted", { track: (choice === "top" ? o?.balance.topTrack : o?.balance.bottomTrack) ?? "undefined" }) : adv?.label ?? "";
    try { onDone(await applyGrowth(auth, actorId, key, choice || undefined), detail); } catch (e) { fail(e); setBusy(false); }
  };
  const moves = (list: GrowthMove[]) => {
    const pbs = [...new Set(list.map((m) => m.playbook))];
    const shown = list.filter((m) => !filter || m.playbook === filter);
    return <>
      {pbs.length > 1 && <View style={u.chips}>{pbs.map((p) => <Chip key={p} label={p} on={filter === p} onPress={() => setFilter(filter === p ? "" : p)} />)}</View>}
      {shown.map((m) => (
        <Pressable key={m.id} accessibilityRole="radio" accessibilityState={{ checked: choice === m.id }} onPress={() => setChoice(m.id)} style={[s.card, choice === m.id && s.cardOn]}>
          <Text style={s.cardTitle}>{choice === m.id ? "◉" : "○"} {m.name}</Text>
          <Text style={s.meta}>{m.playbook}{m.rollStat ? t("legends.growth.rolls", { stat: statLabel(m.rollStat) }) : ""}</Text>
          <More text={m.description} lines={3} />
        </Pressable>
      ))}
    </>;
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.dialog}>
          <ScrollView contentContainerStyle={{ gap: 12 }}>
            <Text style={s.title}>{t("legends.growth.title")}</Text>
            {!o ? (err ? <Text style={u.err}>{err}</Text> : <ActivityIndicator color={C.navy} />) : <>
              <View style={[u.row, { alignItems: "center" }]}>
                {Array.from({ length: o.max }, (_, i) => <View key={i} style={[s.sq, i < o.value && { backgroundColor: C.air, borderColor: C.air }]} />)}
                <Text style={u.p}>{o.value}/{o.max}</Text>
              </View>
              {!o.available ? <Text style={u.p}>{t("legends.growth.markSquares", { max: o.max })}</Text> : !key ? <>
                <Text style={u.hint}>{t("legends.growth.full")}</Text>
                {o.advancements.map((a) => (
                  <Pressable key={a.key} accessibilityRole="button" disabled={!a.eligible} onPress={() => { setKey(a.key); setChoice(""); setFilter(""); setErr(""); }} style={[s.card, !a.eligible && { opacity: 0.45 }]}>
                    <Text style={s.cardTitle}>{a.label}</Text>
                    <Text style={s.meta}>{a.max ? t("legends.growth.usedOf", { used: a.used, max: a.max }) : t("legends.growth.used", { used: a.used })}{a.eligible ? "" : t("legends.growth.unavailable")}</Text>
                  </Pressable>
                ))}
              </> : <>
                <Text style={s.sub}>{adv?.label}</Text>
                {key === "playbook-move" && moves(o.playbookMoves)}
                {key === "other-move" && moves(o.otherMoves)}
                {key === "raise-stat" && <View style={u.chips}>
                  {STATS.map((k) => {
                    const v = o.stats[k] ?? 0, ok = v < MAX_RAISED_STAT;
                    return <Chip key={k} label={`${statLabel(k)} ${sign(v)}${ok ? ` → ${sign(v + 1)}` : t("legends.growth.limit")}`} on={choice === k} onPress={() => ok && setChoice(k)} color={ok ? C.maroon : C.soft} />;
                  })}
                </View>}
                {key === "shift-center" && <View style={u.chips}>
                  <Chip label={t("legends.growth.toTrack", { track: o.balance.topTrack })} on={choice === "top"} onPress={() => setChoice("top")} color={C.water} />
                  <Chip label={t("legends.growth.toTrack", { track: o.balance.bottomTrack })} on={choice === "bottom"} onPress={() => setChoice("bottom")} color={C.water} />
                </View>}
                {key === "moment" && <View style={s.card}><More text={o.moment ?? t("legends.growth.moment")} lines={8} /></View>}
                {!!err && <Text style={u.err}>{err}</Text>}
                <View style={u.row}>
                  <View style={{ flex: 1 }}><Seal ghost label={t("legends.back")} onPress={() => { setKey(""); setErr(""); }} disabled={busy} /></View>
                  <View style={{ flex: 1 }}><Seal label={busy ? t("legends.growth.applying") : t("legends.growth.apply")} onPress={apply} disabled={busy} /></View>
                </View>
              </>}
            </>}
            {!key && <Seal ghost label={t("legends.close")} onPress={onClose} />}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(20,24,36,.6)", justifyContent: "center", padding: 12 },
  dialog: { backgroundColor: C.paper, borderWidth: 3, borderColor: C.navy, borderRadius: 6, padding: 16, maxWidth: 640, width: "100%", maxHeight: "92%", alignSelf: "center" },
  title: { fontFamily: F.brush, fontSize: 30, color: C.ink },
  sub: { fontFamily: F.title, fontSize: 18, color: C.navy },
  card: { borderWidth: 1.5, borderColor: C.frame, borderRadius: 6, padding: 12, gap: 4, backgroundColor: "#fffdf7" },
  cardOn: { borderColor: C.maroon, borderWidth: 2.5, backgroundColor: "#fbf3ea" },
  cardTitle: { fontFamily: F.title, fontSize: 17, color: C.ink },
  meta: { fontFamily: F.body, fontSize: 13.5, color: C.soft },
  sq: { width: 22, height: 22, borderWidth: 2, borderColor: C.ink, backgroundColor: "#fffdf7" },
});
