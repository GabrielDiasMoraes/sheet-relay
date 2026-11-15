// Create sheet (terminal): name, type/origin, S.P.E.C.I.A.L. and TAG skills.
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Auth, createCharacter } from "./api";
import { Field, Line, Opt, s, T, Terminal } from "./Terminal";
import { t } from "../../../shared/i18n";

const SPECIAL: [string, string][] = [["str", "STRENGTH"], ["per", "PERCEPTION"], ["end", "ENDURANCE"], ["cha", "CHARISMA"], ["int", "INTELLIGENCE"], ["agi", "AGILITY"], ["luc", "LUCK"]];
const SKILLS = ["Athletics", "Barter", "Big Guns", "Energy Weapons", "Explosives", "Lockpick", "Medicine", "Melee Weapons", "Pilot", "Repair", "Science", "Small Guns", "Sneak", "Speech", "Survival", "Throwing", "Unarmed"];
// Table types. The origin is stored in English because the level up (macro) detects Ghoul/Mutant/Robot by it.
const KINDS = [
  { label: "fallout.create.k.human", type: "character", origin: "Human" }, { label: "fallout.create.k.robot", type: "robot", origin: "Robot" },
  { label: "fallout.create.k.ghoul", type: "character", origin: "Ghoul" }, { label: "fallout.create.k.mutant", type: "character", origin: "Super Mutant" },
  { label: "fallout.create.k.synth", type: "character", origin: "Synth" }
] as const; // label = translation key
const BUDGET = 40; // book: 5 in each attribute + 5 free points; origins can change this, the GM adjusts afterwards

export function CreateScreen({ auth, onCancel, onCreated, onAuthError }: { auth: Auth; onCancel: () => void; onCreated: (id: string) => void; onAuthError: () => void }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState(0);
  const [detail, setDetail] = useState("");
  const [attrs, setAttrs] = useState<Record<string, number>>(Object.fromEntries(SPECIAL.map(([k]) => [k, 5])));
  const [tags, setTags] = useState<string[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const total = Object.values(attrs).reduce((a, b) => a + b, 0);
  const bump = (k: string, d: number) => setAttrs((a) => ({ ...a, [k]: Math.max(4, Math.min(10, a[k] + d)) }));
  const toggle = (sk: string) => setTags((cur) => (cur.includes(sk) ? cur.filter((x) => x !== sk) : cur.length < 3 ? [...cur, sk] : cur));

  const submit = async () => {
    if (!name.trim()) return setErr(t("fallout.create.noName"));
    setBusy(true); setErr("");
    const k = KINDS[kind], origin = detail.trim() ? `${k.origin}: ${detail.trim()}` : k.origin;
    try { const c = await createCharacter(auth, { name: name.trim(), type: k.type, origin, attributes: attrs, tags }); onCreated(c.id); }
    catch (e: any) { e.status === 401 ? onAuthError() : setErr(String(e.message).toUpperCase()); setBusy(false); }
  };

  return (
    <Terminal title={t("fallout.create.title")}>
      <Line dim>{t("fallout.create.name")}</Line>
      <Field value={name} onChangeText={setName} placeholder={t("fallout.create.namePh")} />
      <Line dim>{t("fallout.create.kind")}</Line>
      <View style={s.chips}>
        {KINDS.map((k, i) => (
          <Pressable key={k.origin} accessibilityRole="radio" accessibilityState={{ checked: kind === i }} onPress={() => setKind(i)} style={[s.chip, kind === i && s.chipOn]}>
            <Text style={[s.t, kind === i && { color: T.bg }]}>{kind === i ? "[X]" : "[ ]"} {t(k.label)}</Text>
          </Pressable>
        ))}
      </View>
      <Line dim>{t("fallout.create.detail")}</Line>
      <Field value={detail} onChangeText={setDetail} placeholder={t("fallout.create.detailPh")} />

      <View style={s.rule} />
      <Line>{t("fallout.create.special", { total, budget: BUDGET, note: total > BUDGET ? t("fallout.create.over") : total < BUDGET ? t("fallout.create.free", { n: BUDGET - total }) : t("fallout.create.ok") })}</Line>
      {SPECIAL.map(([k, label]) => (
        <View key={k} style={s.statRow}>
          <Text style={[s.t, { flex: 1 }]}>{label.padEnd(13, ".")}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.common.decrease", { label })} onPress={() => bump(k, -1)} style={s.step}><Text style={s.t}>[-]</Text></Pressable>
          <Text style={[s.t, s.statVal]}>{String(attrs[k]).padStart(2, "0")}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.common.increase", { label })} onPress={() => bump(k, 1)} style={s.step}><Text style={s.t}>[+]</Text></Pressable>
        </View>
      ))}

      <View style={s.rule} />
      <Line>{t("fallout.create.tags", { n: tags.length })}</Line>
      <View style={s.chips}>
        {SKILLS.map((sk) => {
          const on = tags.includes(sk);
          return (
            <Pressable key={sk} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(sk)} style={[s.chip, on && s.chipOn]}>
              <Text style={[s.t, on && { color: T.bg }]}>{on ? "[X]" : "[ ]"} {sk.toUpperCase()}</Text>
            </Pressable>
          );
        })}
      </View>

      <View style={s.rule} />
      {!!err && <Line bad>!! {err}</Line>}
      <Opt label={busy ? t("fallout.create.initing") : t("fallout.create.init")} onPress={submit} disabled={busy} />
      <Opt label={t("fallout.del.cancel")} onPress={onCancel} disabled={busy} />
    </Terminal>
  );
}
