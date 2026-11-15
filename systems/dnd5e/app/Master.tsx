// GM panel: active scene tokens with HP, damage (by the dnd5e rules, with resistances), healing, temp HP, conditions, initiative,
// attack and damage rolled per NPC, effects with duration in rounds and filters (hostile, allies/neutral, players).
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, Text, View } from "react-native";
import { onErr } from "../../../shared/errors";
import { Auth, Mode, RollOut, SceneData, SceneToken, sceneInit, sceneTokens, tokenActivity, tokenCondition, tokenEffect, tokenHp } from "./api";
import { C, conditions, damageName } from "./theme";
import { t as tr } from "../../../shared/i18n";
import { Chip, Field, Infernal, Seal, u } from "./ui";

const condName = (id: string, fb: string) => conditions().find(([k]) => k === id)?.[1] ?? fb;
// Effect presets (name, rounds, Foundry core icon); the icon can also be changed by hand.
const ICONS = ["aura", "angel", "fire", "shield", "mage-shield", "sword", "skull", "poison", "lightning", "ice-aura", "heal", "eye", "upgrade", "downgrade", "sleep", "paralysis", "regen", "degen", "target", "net"];
const PRESETS: [string, number, string][] = [["blessed", 10, "angel"], ["burning", 3, "fire"], ["impaired", 10, "downgrade"], ["champion", 10, "aura"]];
const MODES: Mode[] = ["normal", "adv", "dis"];
const base = typeof location !== "undefined" ? location.origin : "";

export function MasterScreen({ auth, onBack, onAuthError }: { auth: Auth; onBack: () => void; onAuthError: () => void }) {
  const [data, setData] = useState<SceneData | null>(null);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("");
  const [open, setOpen] = useState<string | null>(null); // token with the conditions list open
  const [fxOpen, setFxOpen] = useState<string | null>(null); // token with the effect form open
  const [fx, setFx] = useState({ name: "", rounds: "10", icon: "aura" });
  const [mode, setMode] = useState<Mode>("normal");
  const [res, setRes] = useState("");
  const [show, setShow] = useState({ hostile: true, other: true, players: true });
  const fail = useCallback((e: any) => onErr(e, onAuthError, setErr), [onAuthError]);
  const load = useCallback(() => sceneTokens(auth).then((d) => { setData(d); setErr(""); }).catch(fail), [auth, fail]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]);
  const n = parseInt(amount, 10), targets = data?.tokens.filter((t) => sel.includes(t.tokenId)) ?? [];
  const apply = async (mode: "damage" | "heal" | "temp") => {
    setMsg(""); setErr("");
    try {
      const out: string[] = [];
      for (const t of targets) { const r = await tokenHp(auth, t, n, mode, mode === "damage" ? type || undefined : undefined); out.push(`${tr("dnd.m.hpLine", { name: r.name, v: r.hp.value, max: r.hp.max })}${r.hp.temp ? tr("dnd.tempPart", { n: r.hp.temp }) : ""}`); }
      setMsg(out.join(" · ")); await load();
    } catch (e) { fail(e); }
  };
  const toggle = async (t: SceneToken, c: string) => { try { await tokenCondition(auth, t, c, !t.conditions.includes(c)); await load(); } catch (e) { fail(e); } };
  const rollAct = async (t: SceneToken, itemId: string, act: { id: string; name: string }, action: "attack" | "damage") => {
    setMsg(""); setErr(""); setRes("");
    try {
      const o: RollOut = await tokenActivity(auth, t, itemId, act.id, action, mode);
      setRes(o.cancelled ? tr("dnd.m.cancelled", { name: t.name }) : tr("dnd.m.rollRes", { name: t.name, act: act.name, kind: action === "attack" ? tr("dnd.attackLc") : tr("dnd.damageLc"), total: o.total ?? "", crit: o.critical ? tr("dnd.m.crit") : o.fumble ? tr("dnd.m.fumble") : "", formula: o.formula ?? "", dice: o.dice?.filter((d) => d.active).map((d) => d.result).join(", ") ?? "" }));
    } catch (e) { fail(e); }
  };
  const addFx = async (t: SceneToken) => {
    setMsg(""); setErr("");
    try { await tokenEffect(auth, t, { action: "add", name: fx.name.trim(), rounds: parseInt(fx.rounds, 10), icon: `icons/svg/${fx.icon}.svg` }); setMsg(tr("dnd.m.fxApplied", { name: t.name })); setFxOpen(null); await load(); } catch (e) { fail(e); }
  };
  const delFx = async (t: SceneToken, id: string) => { try { await tokenEffect(auth, t, { action: "remove", effectId: id }); await load(); } catch (e) { fail(e); } };
  const visible = (t: SceneToken) => (t.player ? show.players : t.disposition === -1 ? show.hostile : show.other);
  const init = async () => { try { await sceneInit(auth, sel); setMsg(tr("dnd.m.initDone")); await load(); } catch (e) { fail(e); } };
  return (
    <Infernal title={tr("dnd.m.title")} wide>
      <Seal ghost small label={tr("dnd.sheets")} onPress={onBack} />
      <Text style={u.hint}>{data ? (data.scene ? tr("dnd.m.scene", { name: data.scene }) : tr("dnd.m.noScene")) : tr("dnd.m.loading")}</Text>
      {!!err && <Text style={u.err}>{err}</Text>}
      {!!msg && <Text style={u.hint}>{msg}</Text>}
      {!!res && <Text style={[u.p, u.b]} accessibilityLiveRegion="polite">{res}</Text>}
      <Text style={u.label}>{tr("dnd.m.show")}</Text>
      <View style={u.chips}>
        <Chip label={tr("dnd.m.hostile")} on={show.hostile} onPress={() => setShow({ ...show, hostile: !show.hostile })} color={C.stoneDark} />
        <Chip label={tr("dnd.m.others")} on={show.other} onPress={() => setShow({ ...show, other: !show.other })} color={C.stoneDark} />
        <Chip label={tr("dnd.m.players")} on={show.players} onPress={() => setShow({ ...show, players: !show.players })} color={C.stoneDark} />
      </View>
      {data && data.tokens.length === 0 && <Text style={u.p}>{tr("dnd.m.noTokens")}</Text>}
      {data && data.tokens.length > 0 && (
        <View style={{ gap: 8 }}>
          <Text style={u.label}>{tr("dnd.m.targets", { n: targets.length })}</Text>
          <Field label={tr("dnd.amount")} value={amount} onChangeText={setAmount} numeric />
          <View style={u.chips}>
            <Chip label={tr("dnd.m.noType")} on={!type} onPress={() => setType("")} color={C.stoneDark} />
            {data.damageTypes.map((d) => <Chip key={d.id} label={damageName(d.id, d.name)} on={type === d.id} onPress={() => setType(d.id)} color={C.stoneDark} />)}
          </View>
          <View style={u.row}>
            <Seal small label={tr("dnd.damage")} onPress={() => apply("damage")} disabled={!(n > 0) || !targets.length} />
            <Seal small ghost label={tr("dnd.heal")} onPress={() => apply("heal")} disabled={!(n > 0) || !targets.length} />
            <Seal small ghost label={tr("dnd.m.tempHp")} onPress={() => apply("temp")} disabled={!(n > 0) || !targets.length} />
            <Seal small ghost label={tr("dnd.initiative")} onPress={init} disabled={!targets.length} />
          </View>
          <Text style={u.hint}>{tr("dnd.m.dmgHint")}</Text>
        </View>
      )}
      {data?.tokens.filter(visible).sort((a, b) => a.disposition - b.disposition || a.name.localeCompare(b.name)).map((t) => (
        <View key={t.tokenId} style={{ gap: 6, borderTopWidth: 1, borderColor: "#a88a5c55", paddingTop: 8 }}>
          <Chip label={`${t.name}${t.dead ? " ☠" : ""}${t.hidden ? tr("dnd.m.hidden") : ""}${tr("dnd.m.tokHp", { v: t.hp.value, max: t.hp.max })}${t.hp.temp ? ` (+${t.hp.temp})` : ""}${t.init != null ? tr("dnd.m.tokInit", { n: t.init }) : ""}`}
            on={sel.includes(t.tokenId)} onPress={() => setSel((l) => (l.includes(t.tokenId) ? l.filter((x) => x !== t.tokenId) : [...l, t.tokenId]))} color={t.disposition === -1 ? C.red : C.stoneDark} />
          <Text style={u.hint}>{t.player ? tr("dnd.m.player") : tr(`dnd.m.disp.${t.disposition === -1 || t.disposition === 1 ? t.disposition : 0}`)}{t.conditions.length ? ` · ${t.conditions.map((c) => condName(c, data.conditions.find((x) => x.id === c)?.name ?? c)).join(", ")}` : ""}</Text>
          {t.fx.length > 0 && <View style={u.chips}>{t.fx.map((f) => (
            <Pressable key={f.id} accessibilityRole="button" accessibilityLabel={tr("dnd.m.rmFx", { name: f.name })} onPress={() => delFx(t, f.id)} style={{ flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1.5, borderColor: C.stoneDark, borderRadius: 14, paddingVertical: 3, paddingHorizontal: 8 }}>
              <Image source={{ uri: `${base}/${f.img}` }} style={{ width: 16, height: 16 }} />
              <Text style={u.hint}>{f.name}{f.left != null ? tr("dnd.m.rounds", { n: f.left }) : ""} ✕</Text>
            </Pressable>
          ))}</View>}
          {!t.player && t.attacks.map((w) => w.activities.map((act) => (
            <View key={`${w.id}:${act.id}`} style={u.row}>
              <Text style={[u.p, { alignSelf: "center" }]}>{w.name}{act.toHit ? ` (${act.toHit})` : ""}{act.damage.length ? ` · ${act.damage.join(" + ")}` : ""}</Text>
              <Seal small label={tr("dnd.attack")} onPress={() => rollAct(t, w.id, act, "attack")} />
              <Seal small ghost label={tr("dnd.damage")} onPress={() => rollAct(t, w.id, act, "damage")} />
            </View>
          )))}
          <View style={u.row}>
            <Seal small ghost label={fxOpen === t.tokenId ? tr("dnd.m.fxClose") : tr("dnd.m.fx")} onPress={() => setFxOpen(fxOpen === t.tokenId ? null : t.tokenId)} />
            {!t.player && t.attacks.length > 0 && MODES.map((k) => <Chip key={k} label={tr(`dnd.mode.${k}`)} on={mode === k} onPress={() => setMode(k)} color={C.stoneDark} />)}
          </View>
          {fxOpen === t.tokenId && (
            <View style={{ gap: 6 }}>
              <View style={u.chips}>{PRESETS.map(([k, r, i]) => { const n = tr(`dnd.m.preset.${k}`); return <Chip key={k} label={n} on={fx.name === n} onPress={() => setFx({ name: n, rounds: String(r), icon: i })} color={C.stoneDark} />; })}</View>
              <Field label={tr("dnd.m.fxName")} value={fx.name} onChangeText={(v) => setFx({ ...fx, name: v.slice(0, 60) })} />
              <Field label={tr("dnd.m.fxRounds")} value={fx.rounds} onChangeText={(v) => setFx({ ...fx, rounds: v })} numeric />
              <View style={u.chips}>{ICONS.map((i) => <Pressable key={i} accessibilityRole="radio" accessibilityLabel={tr("dnd.m.icon", { name: i })} accessibilityState={{ selected: fx.icon === i }} onPress={() => setFx({ ...fx, icon: i })} style={{ padding: 3, borderWidth: 2, borderRadius: 6, borderColor: fx.icon === i ? C.red : "transparent" }}><Image source={{ uri: `${base}/icons/svg/${i}.svg` }} style={{ width: 24, height: 24 }} /></Pressable>)}</View>
              <Seal small label={tr("dnd.m.fxApply")} onPress={() => addFx(t)} disabled={!fx.name.trim() || !(parseInt(fx.rounds, 10) >= 1 && parseInt(fx.rounds, 10) <= 100)} />
            </View>
          )}
          <Seal small ghost label={open === t.tokenId ? tr("dnd.m.condClose") : tr("dnd.conditions")} onPress={() => setOpen(open === t.tokenId ? null : t.tokenId)} />
          {open === t.tokenId && <View style={u.chips}>{data.conditions.filter((c) => conditions().some(([k]) => k === c.id)).map((c) => <Chip key={c.id} label={condName(c.id, c.name)} on={t.conditions.includes(c.id)} onPress={() => toggle(t, c.id)} />)}</View>}
        </View>
      ))}
    </Infernal>
  );
}
