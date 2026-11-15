// Advancement choices (creation and level up): the module returns the next pending choice; here the player decides and
// the flow repeats until nothing is missing. Then "Apply" saves everything at once in Foundry.
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { onErr } from "../../../shared/errors";
import { Auth, Option, Pending, Sheet, advance, describeItem } from "./api";
import { abilityLabel, C, F, sign } from "./theme";
import { t } from "../../../shared/i18n";
import { Chip, More, Seal, u } from "./ui";

type Props = { auth: Auth; actorId: string; target: { uuid?: string; classId?: string }; title: string; onDone: (s?: Sheet) => void; onCancel?: () => void; onAuthError: () => void };

export function AdvanceFlow({ auth, actorId, target, title, onDone, onCancel, onAuthError }: Props) {
  const [decisions, setDecisions] = useState<Record<string, unknown>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [pending, setPending] = useState<Pending | null | undefined>(undefined);
  const [done, setDone] = useState<{ title: string; item: string }[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const fail = (e: any) => onErr(e, onAuthError, setErr);
  const load = (d: Record<string, unknown>) => { setBusy(true); setErr(""); advance(auth, actorId, target, d).then((r) => { setPending(r.pending); setDone(r.done); }).catch(fail).finally(() => setBusy(false)); };
  useEffect(() => load({}), []); // eslint-disable-line react-hooks/exhaustive-deps
  const choose = (key: string, value: unknown) => { const d = { ...decisions, [key]: value }; setDecisions(d); setOrder((o) => [...o.filter((k) => k !== key), key]); load(d); };
  const back = () => { const k = order.at(-1); if (!k) return; const d = { ...decisions }; delete d[k]; setDecisions(d); setOrder(order.slice(0, -1)); load(d); };
  const commit = async () => {
    setBusy(true); setErr("");
    try { const r = await advance(auth, actorId, target, decisions, true); onDone(r.sheet); } catch (e) { fail(e); setBusy(false); }
  };

  return (
    <View style={{ gap: 12 }}>
      <Text style={s.title}>{title}</Text>
      {done.length > 0 && <Text style={u.hint}>{t("dnd.adv.done", { list: done.map((d) => d.title).join(" · ") })}</Text>}
      {pending === undefined || (busy && !pending) ? <ActivityIndicator color={C.red} /> : pending ? (
        <View style={s.card}>
          <Text style={s.kind}>{t("dnd.adv.kind", { item: pending.item, level: pending.level || "—" })}</Text>
          <Text style={s.cardTitle}>{pending.title}</Text>
          {!!pending.hint && <More text={pending.hint} lines={3} />}
          <Step key={pending.key} p={pending} auth={auth} busy={busy} onChoose={(v) => choose(pending.key, v)} />
        </View>
      ) : (
        <View style={s.card}>
          <Text style={s.cardTitle}>{t("dnd.adv.allChosen")}</Text>
          <Text style={u.p}>{t("dnd.adv.allChosenHint")}</Text>
          <Seal label={busy ? t("dnd.applying") : t("dnd.apply")} onPress={commit} disabled={busy} />
        </View>
      )}
      {!!err && <Text style={u.err}>{err}</Text>}
      <View style={u.row}>
        {order.length > 0 && <View style={{ flex: 1 }}><Seal ghost label={t("dnd.adv.backOne")} onPress={back} disabled={busy} /></View>}
        {onCancel && <View style={{ flex: 1 }}><Seal ghost label={t("dnd.cancel")} onPress={onCancel} disabled={busy} /></View>}
      </View>
    </View>
  );
}

// One option of the list, with the text on demand (spell lists only come with name and level).
function OptionRow({ o, on, onPress, auth, multi }: { o: Option; on: boolean; onPress: () => void; auth: Auth; multi: boolean }) {
  const [desc, setDesc] = useState(o.description ?? "");
  const [loading, setLoading] = useState(false);
  const info = () => { if (desc || !o.uuid) return setDesc(desc ? "" : o.description ?? ""); setLoading(true); describeItem(auth, o.uuid).then((d) => setDesc(d.description || "—")).catch(() => setDesc("—")).finally(() => setLoading(false)); };
  return (
    <View style={[s.opt, on && s.optOn]}>
      <View style={s.optHead}>
        <Pressable style={{ flex: 1 }} accessibilityRole={multi ? "checkbox" : "radio"} accessibilityState={{ checked: on }} onPress={onPress}>
          <Text style={s.optName}>{multi ? (on ? "☑ " : "☐ ") : on ? "◉ " : "○ "}{o.label ?? o.name}{o.level != null && o.level >= 0 && o.uuid ? `  ·  ${o.level === 0 ? t("dnd.cantrip") : t("dnd.levelN", { n: o.level })}` : ""}</Text>
        </Pressable>
        {!!o.uuid && <Pressable accessibilityRole="button" accessibilityLabel={t("dnd.adv.read", { name: o.name ?? "" })} onPress={info} hitSlop={8}><Text style={s.info}>{loading ? "…" : desc ? "▲" : "ⓘ"}</Text></Pressable>}
      </View>
      {!!desc && <More text={desc} lines={8} />}
    </View>
  );
}

function Picker({ options, count, value, onChange, auth }: { options: Option[]; count: number; value: string[]; onChange: (v: string[]) => void; auth: Auth }) {
  const [q, setQ] = useState("");
  const id = (o: Option) => (o.uuid ?? o.key)!;
  const shown = options.filter((o) => !q || (o.label ?? o.name ?? "").toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  const toggle = (k: string) => onChange(value.includes(k) ? value.filter((x) => x !== k) : count === 1 ? [k] : value.length < count ? [...value, k] : value);
  return (
    <View style={{ gap: 6 }}>
      <Text style={u.label}>{t("dnd.adv.pick", { count, n: value.length })}</Text>
      {options.length > 12 && <TextInput value={q} onChangeText={setQ} placeholder={t("dnd.adv.filter")} placeholderTextColor={C.soft} style={u.input} accessibilityLabel={t("dnd.adv.filterOpts")} />}
      {shown.map((o) => <OptionRow key={id(o)} o={o} on={value.includes(id(o))} onPress={() => toggle(id(o))} auth={auth} multi={count > 1} />)}
      {options.length > shown.length && <Text style={u.hint}>{t("dnd.adv.showing", { shown: shown.length, total: options.length })}</Text>}
    </View>
  );
}

function AbilityPick({ list, value, onChange }: { list: string[]; value: string; onChange: (v: string) => void }) {
  if (!list.length) return null;
  return <><Text style={u.label}>{t("dnd.adv.castAbility")}</Text><View style={u.chips}>{list.map((k) => <Chip key={k} label={abilityLabel(k)} on={value === k} onPress={() => onChange(k)} />)}</View></>;
}

function Step({ p, auth, busy, onChoose }: { p: Pending; auth: Auth; busy: boolean; onChoose: (v: unknown) => void }) {
  const [sel, setSel] = useState<string[]>([]);
  const [ability, setAbility] = useState("");
  const [asi, setAsi] = useState<Record<string, number>>({});
  const [featMode, setFeatMode] = useState(false);
  const go = (v: unknown) => !busy && onChoose(v);

  if (p.type === "HitPoints") return (
    <View style={{ gap: 8 }}>
      <Text style={u.p}>{t("dnd.adv.hpText", { die: p.die ?? "", con: sign(p.con ?? 0) })}</Text>
      <View style={u.row}>
        <View style={{ flex: 1 }}><Seal label={t("dnd.adv.avg", { n: p.average ?? "" })} onPress={() => go({ mode: "avg" })} /></View>
        <View style={{ flex: 1 }}><Seal ghost label={t("dnd.adv.rollHp", { die: p.die ?? "" })} onPress={() => go({ mode: "roll" })} /></View>
      </View>
      <Text style={u.hint}>{t("dnd.adv.rollHint")}</Text>
    </View>
  );
  if (p.type === "Trait") return (
    <View style={{ gap: 8 }}>
      {!!p.grants?.length && <Text style={u.p}>{t("dnd.adv.gain")}<Text style={u.b}>{p.grants.join(", ")}</Text></Text>}
      <Picker options={p.options ?? []} count={p.count ?? 1} value={sel} onChange={setSel} auth={auth} />
      <Seal label={t("dnd.confirm")} onPress={() => go({ chosen: sel })} disabled={sel.length !== p.count} />
    </View>
  );
  if (p.type === "ItemChoice" || p.type === "ItemGrant") {
    const optional = p.type === "ItemGrant" ? (p.options ?? []).filter((o) => o.optional) : p.options ?? [];
    const fixed = p.type === "ItemGrant" ? (p.options ?? []).filter((o) => !o.optional) : [];
    const needAbility = !!p.spellAbilities?.length;
    return (
      <View style={{ gap: 8 }}>
        {fixed.length > 0 && <Text style={u.p}>{t("dnd.adv.gain")}<Text style={u.b}>{fixed.map((o) => o.name).join(", ")}</Text></Text>}
        {optional.length > 0 && (p.type === "ItemChoice"
          ? <Picker options={optional} count={p.count ?? 1} value={sel} onChange={setSel} auth={auth} />
          : <Picker options={optional} count={optional.length} value={sel} onChange={setSel} auth={auth} />)}
        <AbilityPick list={p.spellAbilities ?? []} value={ability} onChange={setAbility} />
        <Seal label={t("dnd.confirm")} onPress={() => go({ selected: sel, ...(needAbility ? { ability } : {}) })}
          disabled={(p.type === "ItemChoice" && sel.length !== p.count) || (needAbility && !ability)} />
      </View>
    );
  }
  if (p.type === "AbilityScoreImprovement") {
    const used = Object.values(asi).reduce((n, v) => n + v, 0);
    return (
      <View style={{ gap: 8 }}>
        {p.allowFeat && <View style={u.chips}><Chip label={t("dnd.adv.raise")} on={!featMode} onPress={() => setFeatMode(false)} /><Chip label={t("dnd.adv.featPick")} on={featMode} onPress={() => setFeatMode(true)} /></View>}
        {featMode ? <>
          <Picker options={p.feats ?? []} count={1} value={sel} onChange={setSel} auth={auth} />
          <Seal label={t("dnd.adv.confirmFeat")} onPress={() => go({ type: "feat", uuid: sel[0] })} disabled={sel.length !== 1} />
        </> : <>
          <Text style={u.p}>{t("dnd.adv.dist1")}<Text style={u.b}>{p.points}</Text>{t("dnd.adv.dist2", { cap: p.cap ?? "", used, points: p.points ?? "" })}</Text>
          {(p.abilities ?? []).map((a) => {
            const v = asi[a.key] ?? 0, locked = p.locked?.includes(a.key) || !a.canImprove;
            return (
              <View key={a.key} style={[s.asiRow, locked && { opacity: 0.4 }]}>
                <Text style={[u.p, { flex: 1 }]}>{abilityLabel(a.key)} {a.value}{v ? ` → ${a.value + v}` : ""}</Text>
                <Pressable accessibilityLabel={t("dnd.dec", { name: abilityLabel(a.key) })} disabled={locked || v <= 0} onPress={() => setAsi({ ...asi, [a.key]: v - 1 })} style={s.step}><Text style={s.stepT}>−</Text></Pressable>
                <Text style={s.stepV}>+{v}</Text>
                <Pressable accessibilityLabel={t("dnd.inc", { name: abilityLabel(a.key) })} disabled={locked || v >= (p.cap ?? 2) || used >= (p.points ?? 0) || a.value + v >= a.max} onPress={() => setAsi({ ...asi, [a.key]: v + 1 })} style={s.step}><Text style={s.stepT}>+</Text></Pressable>
              </View>
            );
          })}
          <Seal label={t("dnd.confirm")} onPress={() => go({ type: "asi", assignments: asi })} disabled={used !== p.points} />
        </>}
      </View>
    );
  }
  if (p.type === "Subclass") return (
    <View style={{ gap: 8 }}>
      <Picker options={p.options ?? []} count={1} value={sel} onChange={setSel} auth={auth} />
      <Seal label={t("dnd.adv.confirmSub")} onPress={() => go({ uuid: sel[0] })} disabled={sel.length !== 1} />
    </View>
  );
  if (p.type === "Size") return <View style={u.chips}>{(p.options ?? []).map((o) => <Chip key={o.key} label={o.label ?? o.key!} on={false} onPress={() => go({ size: o.key })} />)}</View>;
  return <Seal label={t("dnd.adv.continue")} onPress={() => go({})} />;
}

const s = StyleSheet.create({
  title: { fontFamily: F.title, fontSize: 20, color: C.burnt, fontWeight: "700" },
  card: { borderWidth: 1.5, borderColor: "#a88a5c", borderRadius: 6, padding: 12, gap: 8, backgroundColor: "#f6e9c9" },
  kind: { fontFamily: F.title, fontSize: 11.5, color: C.soft, letterSpacing: 1 },
  cardTitle: { fontFamily: F.title, fontSize: 18, color: C.red, fontWeight: "700" },
  opt: { borderWidth: 1, borderColor: "#c9ad7c", borderRadius: 4, padding: 8, gap: 4, backgroundColor: "#fbf3df" },
  optOn: { borderColor: C.red, borderWidth: 2, backgroundColor: "#f8e3d0" },
  optHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  optName: { fontFamily: F.body, fontSize: 15.5, color: C.ink, fontWeight: "700" },
  info: { fontSize: 18, color: C.red, paddingHorizontal: 4 },
  asiRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  step: { width: 32, height: 32, borderRadius: 16, borderWidth: 1.5, borderColor: C.red, alignItems: "center", justifyContent: "center" },
  stepT: { fontSize: 18, color: C.red, fontWeight: "700" },
  stepV: { fontFamily: F.body, fontSize: 16, fontWeight: "700", width: 28, textAlign: "center" },
});
