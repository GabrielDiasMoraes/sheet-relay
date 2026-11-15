// Roll rules editor (GM only): picks the item and edits its rules; the rule applies to everyone who has it.
import { useCallback, useEffect, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { Auth, Rule, RuleItem, getRules, listRuleItems, resetRules, saveRules } from "./api-core";
import { onErr } from "./errors";
import type { Labels, UI } from "./types";

export type RulesCfg = {
  rolls: [string, string][]; // roll keys in `when.rolls` and labels
  periods?: [string, string][]; // use renewal ("" = none); without a list, uses a fixed `defaultPer`
  defaultPer?: string;
  itemKeys?: [string, string][]; // filters by item property (`when.item`)
  extraCost?: [string, string][]; // extra numeric or text costs in `cost` (Fallout: ap, luck), one field each, before the uses
  fields: { skills: string; attributes?: string; cost?: string; uses: string; effects: string; auto?: string; rollsHint?: string };
  defaultRoll: string;
  smallBack?: boolean; periodColor?: string;
};
type Common = { ui: UI; labels: Labels; cfg: RulesCfg; auth: Auth; onAuthError: () => void };
const list = (t: string) => t.split(",").map((x) => x.trim()).filter(Boolean);

export function Rules({ ui, labels, cfg, auth, onBack, onAuthError }: Common & { onBack: () => void }) {
  const [q, setQ] = useState("");
  const [items, setItems] = useState<RuleItem[] | null>(null);
  const [sel, setSel] = useState<RuleItem | null>(null);
  const [err, setErr] = useState("");
  const fail = useCallback((e: any) => onErr(e, onAuthError, setErr), [onAuthError]);
  useEffect(() => { const t = setTimeout(() => listRuleItems(auth, q).then(setItems).catch(fail), 250); return () => clearTimeout(t); }, [q, sel, auth, fail]);
  if (sel) return <Editor ui={ui} labels={labels} cfg={cfg} auth={auth} item={sel} onBack={() => setSel(null)} onAuthError={onAuthError} />;
  const { t } = ui;
  return (
    <ui.Frame title={labels.rules} wide>
      <ui.Button ghost small={cfg.smallBack} label={labels.rulesBack} onPress={onBack} />
      <Text style={t.hint}>{labels.rulesPick}</Text>
      <TextInput value={q} onChangeText={setQ} placeholder={labels.search} accessibilityLabel={labels.rulesSearch} style={t.input} />
      {!!err && <Text style={t.err}>{err}</Text>}
      {!items && !err && <ui.Spinner />}
      {items?.map((i) => (
        <Pressable key={i.key} accessibilityRole="button" onPress={() => setSel(i)} style={{ borderBottomWidth: 1, borderColor: ui.c.border, paddingVertical: 8 }}>
          <Text style={t.label}>{i.name}</Text>
          <Text style={[t.hint, (i.source === "mundo" || i.source === "world") && { color: ui.c.mundo, fontWeight: "700" }]}>{labels.rulesRows(i.count, i.source)}</Text>
        </Pressable>
      ))}
    </ui.Frame>
  );
}

function Editor({ ui, labels, cfg, auth, item, onBack, onAuthError }: Common & { item: RuleItem; onBack: () => void }) {
  const [rules, setRules] = useState<Rule[] | null>(null);
  const [src, setSrc] = useState(item.source);
  const [eff, setEff] = useState<string[]>([]); // effects as JSON, one text per rule
  const [msg, setMsg] = useState<{ t: string; bad?: boolean } | null>(null);
  const load = useCallback(() => getRules(auth, item.key).then((r) => { setRules(r.regras); setSrc(r.source); setEff(r.regras.map((x) => JSON.stringify(x.effects, null, 1))); }).catch((e) => onErr(e, onAuthError, (t) => setMsg({ t, bad: true }))), [auth, item.key, onAuthError]);
  useEffect(() => { load(); }, [load]);
  const { t, c } = ui;
  if (!rules) return <ui.Frame title={item.name} wide><ui.Spinner /></ui.Frame>;
  const set = (i: number, patch: Partial<Rule>) => setRules(rules.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  const when = (i: number, patch: NonNullable<Rule["when"]>) => set(i, { when: { ...rules[i].when, ...patch } });
  const filt = (i: number, k: string, v: string) => { const it = { ...rules[i].when?.item, [k]: list(v) }; if (!it[k].length) delete it[k]; when(i, { item: Object.keys(it).length ? it : undefined }); };
  const cost = (i: number, patch: NonNullable<Rule["cost"]>) => { const k = { ...rules[i].cost, ...patch }; set(i, { cost: Object.values(k).some((v) => v !== undefined && v !== "") ? k : undefined }); };
  const add = () => { setRules([...rules, { id: `regra-${rules.length + 1}`, label: labels.rulesNew, text: "", when: { rolls: [cfg.defaultRoll] }, effects: [] }]); setEff([...eff, "[]"]); };
  const del = (i: number) => { setRules(rules.filter((_, k) => k !== i)); setEff(eff.filter((_, k) => k !== i)); };
  const save = async () => {
    try {
      const out = rules.map((r, i) => ({ ...r, ...(cfg.fields.auto && { auto: r.auto || undefined }), effects: JSON.parse(eff[i] || "[]") }));
      await saveRules(auth, item.key, item.name, out); setMsg({ t: labels.rulesSaved }); load();
    } catch (e: any) { setMsg({ t: e instanceof SyntaxError ? `${labels.rulesBadJson}${e.message}` : e.message, bad: true }); }
  };
  const reset = async () => { try { await resetRules(auth, item.key); setMsg({ t: labels.rulesResetDone }); load(); } catch (e: any) { setMsg({ t: e.message, bad: true }); } };
  const f = cfg.fields;
  return (
    <ui.Frame title={item.name} wide>
      <ui.Button ghost small={cfg.smallBack} label={labels.rulesBackList} onPress={onBack} />
      <Text style={t.hint}>{labels.rulesRules(src)} {labels.rulesOwn}</Text>
      {rules.map((r, i) => (
        <View key={i} style={{ gap: 8, borderTopWidth: 1, borderColor: c.border, paddingTop: 10 }}>
          <ui.Field label={labels.rulesName} value={r.label} onChangeText={(v) => set(i, { label: v })} />
          <ui.Field label={labels.rulesText} value={r.text ?? ""} onChangeText={(v) => set(i, { text: v })} multiline />
          <Text style={t.label}>{labels.rulesIn}</Text>
          {!!f.rollsHint && <Text style={t.hint}>{f.rollsHint}</Text>}
          <View style={t.chips}>{cfg.rolls.map(([k, l]) => { const on = !!r.when?.rolls?.includes(k); return <ui.Chip key={k} label={l} on={on} onPress={() => when(i, { rolls: on ? r.when!.rolls!.filter((x) => x !== k) : [...(r.when?.rolls ?? []), k] })} />; })}</View>
          <ui.Field label={f.skills} value={(r.when?.skills ?? []).join(", ")} onChangeText={(v) => when(i, { skills: list(v) })} />
          {!!f.attributes && <ui.Field label={f.attributes} value={(r.when?.attributes ?? []).join(", ")} onChangeText={(v) => when(i, { attributes: list(v) })} />}
          {cfg.itemKeys?.map(([k, l]) => <ui.Field key={k} label={l} value={(r.when?.item?.[k] ?? []).join(", ")} onChangeText={(v) => filt(i, k, v)} />)}
          {!!f.cost && <ui.Field label={f.cost} value={r.cost?.resource ?? ""} onChangeText={(v) => cost(i, { resource: v || undefined })} />}
          {cfg.extraCost?.map(([k, l]) => <ui.Field key={k} label={l} value={String((r.cost as Record<string, unknown> | undefined)?.[k] ?? "")} onChangeText={(v) => cost(i, { [k]: v === "" ? undefined : Number.isFinite(Number(v)) ? Number(v) : v })} />)}
          <ui.Field label={f.uses} value={String(r.cost?.uses?.max ?? "")} onChangeText={(v) => cost(i, { uses: v === "" ? undefined : { ...r.cost?.uses, max: Number.isFinite(Number(v)) ? Number(v) : v, per: cfg.periods ? r.cost?.uses?.per ?? cfg.defaultPer : cfg.defaultPer ?? r.cost?.uses?.per } })} />
          {!!cfg.periods && !!r.cost?.uses && <View style={t.chips}>{cfg.periods.map(([k, l]) => <ui.Chip key={k} label={l} on={(r.cost?.uses?.per ?? "") === k} color={cfg.periodColor} onPress={() => cost(i, { uses: { ...r.cost!.uses!, per: k || undefined } })} />)}</View>}
          {!!f.auto && <ui.Field label={f.auto} value={r.auto ?? ""} onChangeText={(v) => set(i, { auto: v })} />}
          <ui.Field label={f.effects} value={eff[i] ?? "[]"} onChangeText={(v) => setEff(eff.map((x, k) => (k === i ? v : x)))} multiline />
          <Pressable accessibilityRole="button" onPress={() => del(i)}><Text style={[t.hint, { color: c.danger, fontWeight: "700" }]}>{labels.rulesRemove}</Text></Pressable>
        </View>
      ))}
      <ui.Button ghost label={labels.rulesAdd} onPress={add} />
      {!!msg && <Text style={msg.bad ? t.err : [t.hint, { color: c.ok, fontWeight: "700" }]}>{msg.t}</Text>}
      <View style={t.row}>
        <ui.Button label={labels.rulesSave} onPress={save} />
        {src === "mundo" && <ui.Button ghost label={labels.rulesReset} onPress={reset} />}
      </View>
    </ui.Frame>
  );
}
