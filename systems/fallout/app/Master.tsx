// GM panel: NPCs of Foundry's active scene, with HP and attack and damage rolls for them.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Auth, DefPerk, DmgPerk, Npc, SceneTarget, applyDamage, npcStatus, damagePerks, defensePerks, npcListMods, npcRollDamage, npcRollWeapon, npcSetHp, sceneNpcs, sceneTargets } from "./api";
import { RollChoice, RollDialog, RollRequest } from "./RollDialog";
import { Result, RollResult } from "./RollResult";
import { t } from "../../../shared/i18n";

const P = { paper: "#ecebe7", ink: "#111", line: "#c9c7c0", cell: "#fff", dim: "#6b6b66", ok: "#00933B", bad: "#b3261e" };
const condName = (id: string, fb: string) => { const v = t(`fallout.cond.${id}`); return v === `fallout.cond.${id}` ? fb : v; }; // no translation: Foundry's name
const dispName = (d: number) => (d === -1 ? t("fallout.master.hostile") : d === 1 ? t("fallout.master.ally") : t("fallout.master.neutral"));
const typeName = (k: string) => (["character", "robot", "creature", "npc"].includes(k) ? t(`fallout.master.type.${k}`) : k);

export function MasterScreen({ auth, onBack, onAuthError }: { auth: Auth; onBack: () => void; onAuthError: () => void }) {
  const [data, setData] = useState<{ scene: string | null; npcs: Npc[]; statuses: { id: string; name: string }[] } | null>(null);
  const [condOpen, setCondOpen] = useState<string | null>(null); // NPC with the conditions list open
  const [err, setErr] = useState("");
  const [roll, setRoll] = useState<{ npc: Npc; req: RollRequest } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [last, setLast] = useState<Record<string, number>>({}); // last damage rolled per weapon, to suggest when dealing damage
  const [allies, setAllies] = useState(true);
  const [players, setPlayers] = useState(true);
  const [hit, setHit] = useState<{ npc: Npc; w?: Npc["weapons"][number] } | null>(null);
  const fail = useCallback((e: any) => (e.status === 401 ? onAuthError() : setErr(e.message)), [onAuthError]);
  const load = useCallback(() => sceneNpcs(auth).then((d) => { setData(d); setErr(""); }).catch(fail), [auth, fail]);
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]); // whoever changes HP through Foundry shows up by itself

  const hp = async (n: Npc, delta: number) => {
    if (!n.hp) return;
    try { await npcSetHp(auth, n, Math.max(0, Math.min(n.hp.max, n.hp.value + delta))); await load(); } catch (e) { fail(e); }
  };
  const toggleCond = async (n: Npc, c: string) => { try { await npcStatus(auth, n, c, !n.conditions.includes(c)); await load(); } catch (e) { fail(e); } };
  const go = async (npc: Npc, req: RollRequest, c: RollChoice) => {
    setRoll(null); setResult({ kind: "busy", title: `${npc.name}: ${req.name}` });
    try {
      if (req.kind === "weapon") setResult({ kind: "d20", r: { ...(await npcRollWeapon(auth, npc, req.id, c as Required<RollChoice>)), rollname: `${npc.name}: ${req.name}` } });
      else if (req.kind === "damage") { const r = await npcRollDamage(auth, npc, req.id, c.dice, c.mods); setLast((l) => ({ ...l, [`${npc.tokenId}:${req.id}`]: r.total })); setResult({ kind: "d6", r: { ...r, rollname: `${npc.name}: ${req.name}` } }); }
    } catch (e: any) { setResult({ kind: "error", title: t("fallout.common.failed"), message: e.message }); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: P.paper }}>
      <ScrollView contentContainerStyle={s.page}>
        <Pressable accessibilityRole="button" onPress={onBack}><Text style={s.back}>{t("fallout.common.backArrow")}</Text></Pressable>
        <View style={s.black}><Text style={s.blackTitle}>{t("fallout.master.title")}</Text><Text style={s.blackText}>{data ? (data.scene ? t("fallout.master.scene", { s: data.scene }) : t("fallout.master.noScene")) : t("fallout.master.loading")}</Text></View>
        <Pressable accessibilityRole="button" onPress={load} style={s.btn}><Text style={s.btnTxt}>{t("fallout.master.refresh")}</Text></Pressable>
        {!!err && <Text style={s.err}>{err}</Text>}
        {!data && !err && <ActivityIndicator color={P.ink} />}
        {data && data.npcs.length === 0 && <Text style={s.dim}>{t("fallout.master.noTokens")}</Text>}
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: allies }} onPress={() => setAllies(!allies)} style={s.btn}><Text style={s.btnTxt}>{allies ? "■" : "□"} {t("fallout.master.allies")}</Text></Pressable>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: players }} onPress={() => setPlayers(!players)} style={s.btn}><Text style={s.btnTxt}>{players ? "■" : "□"} {t("fallout.master.players")}</Text></Pressable>
        {data?.npcs.filter((n) => (allies || n.disposition !== 1) && (players || !n.player)).sort((a, b) => a.disposition - b.disposition || a.name.localeCompare(b.name)).map((n) => ( // hostis primeiro
          <View key={n.tokenId} style={[s.card, n.dead && { opacity: 0.55 }]}>
            <View style={s.row}>
              <Text style={s.name}>{n.name}{n.dead ? " ☠" : ""}{n.hidden ? t("fallout.master.hidden") : ""}</Text>
              <Text style={[s.dim, n.disposition === -1 && { color: P.bad, fontWeight: "800" }]}>{n.player ? t("fallout.master.player") : dispName(n.disposition)} · {typeName(n.type)}</Text>
            </View>
            {n.fx.length > 0 && (
              <View style={s.chips}>{n.fx.map((f) => (
                <View key={f.id} style={s.fx} accessibilityLabel={t("fallout.master.effect", { n: f.name })}>
                  <Image source={{ uri: `${typeof location !== "undefined" ? location.origin : ""}/${f.img}` }} style={s.fxImg} />
                  <Text style={s.fxTxt}>{f.name}</Text>
                </View>
              ))}</View>
            )}
            {n.conditions.length > 0 && <View style={s.chips}>{n.conditions.map((c) => <View key={c} style={s.fx}><Text style={s.fxTxt}>{condName(c, data?.statuses.find((x) => x.id === c)?.name ?? c)}</Text></View>)}</View>}
            <Pressable accessibilityRole="button" onPress={() => setCondOpen(condOpen === n.tokenId ? null : n.tokenId)} style={[s.btn, { alignSelf: "flex-start" }]}><Text style={s.btnTxt}>{condOpen === n.tokenId ? t("fallout.master.condClose") : t("fallout.master.cond")}</Text></Pressable>
            {condOpen === n.tokenId && <View style={s.chips}>{data?.statuses.map((c) => (
              <Pressable key={c.id} accessibilityRole="checkbox" accessibilityState={{ checked: n.conditions.includes(c.id) }} onPress={() => toggleCond(n, c.id)} style={[s.chip, n.conditions.includes(c.id) && s.chipOn]}><Text style={[s.chipTxt, n.conditions.includes(c.id) && { color: "#fff" }]}>{condName(c.id, c.name)}</Text></Pressable>
            ))}</View>}
            {n.hp && (
              <View style={s.row}>
                <Text style={s.hp}>{t("fallout.master.hp", { v: n.hp.value, m: n.hp.max })}</Text>
                <View style={s.row}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.master.takeA11y", { n: n.name })} onPress={() => setHit({ npc: n })} style={[s.step, { backgroundColor: P.bad, paddingHorizontal: 12 }]}><Text style={s.stepTxt}>{t("fallout.master.take")}</Text></Pressable>
                  {[1, 5].map((d) => (
                    <Pressable key={d} accessibilityRole="button" accessibilityLabel={t("fallout.master.healA11y", { d, n: n.name })} onPress={() => hp(n, d)} style={[s.step, { backgroundColor: P.ok }]}><Text style={s.stepTxt}>+{d}</Text></Pressable>
                  ))}
                </View>
              </View>
            )}
            {n.weapons.map((w) => (
              <View key={w.id} style={s.weapon}>
                <Text style={s.wname}>{w.name}</Text>
                {w.roll && <Pressable accessibilityRole="button" onPress={() => setRoll({ npc: n, req: { kind: "weapon", id: w.id, name: w.name, attrLabel: "", base: w.roll! } })} style={s.act}><Text style={s.actTxt}>{t("fallout.common.attack")}</Text></Pressable>}
                {w.damageDice != null && <Pressable accessibilityRole="button" onPress={() => setRoll({ npc: n, req: { kind: "damage", id: w.id, name: w.name, dice: w.damageDice!, ammo: w.ammo, ammoPerShot: w.ammoPerShot } })} style={s.act}><Text style={s.actTxt}>{t("fallout.common.damage")}</Text></Pressable>}
                {w.damageDice != null && <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.master.dealA11y", { n: w.name })} onPress={() => setHit({ npc: n, w })} style={[s.act, { backgroundColor: P.bad }]}><Text style={s.actTxt}>{t("fallout.master.deal")}</Text></Pressable>}
              </View>
            ))}
            {n.weapons.length === 0 && <Text style={s.dim}>{t("fallout.master.noWeapons")}</Text>}
          </View>
        ))}
      </ScrollView>
      <RollDialog req={roll?.req ?? null} onClose={() => setRoll(null)} onRoll={(c) => roll && go(roll.npc, roll.req, c)}
        loadMods={(ctx) => (roll ? npcListMods(auth, roll.npc, ctx).catch(() => []) : Promise.resolve([]))} onResetUses={async () => {}} />
      {hit && <DamageForm auth={auth} npc={hit.npc} w={hit.w} suggested={hit.w ? last[`${hit.npc.tokenId}:${hit.w.id}`] : undefined} onClose={() => setHit(null)}
        onDone={(lines) => { setHit(null); setResult({ kind: "lines", title: hit.w ? `${hit.npc.name}: ${hit.w.name}` : t("fallout.master.takes", { n: hit.npc.name }), lines }); load(); }} onError={fail} />}
      {result && <RollResult res={result} onClose={() => setResult(null)} />}
    </View>
  );
}

const s = StyleSheet.create({
  fx: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: P.ink, paddingVertical: 3, paddingHorizontal: 6 }, fxImg: { width: 18, height: 18, tintColor: "#fff" }, fxTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 12 },
  box: { width: "100%", maxWidth: 560, maxHeight: "96%", backgroundColor: P.paper, borderWidth: 3, borderColor: P.ink, padding: 12, gap: 10 },
  mhead: { backgroundColor: P.ink, padding: 8, marginHorizontal: -12, marginTop: -12 }, mheadTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
  lab: { color: P.ink, fontWeight: "800" }, input: { borderWidth: 2, borderColor: P.ink, backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 6, fontSize: 18, fontWeight: "900", minWidth: 90, textAlign: "center", color: P.ink },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, chip: { borderWidth: 2, borderColor: P.ink, backgroundColor: "#fff", paddingVertical: 6, paddingHorizontal: 10 }, chipOn: { backgroundColor: P.ink }, chipTxt: { color: P.ink, fontWeight: "700" },
  page: { padding: 14, gap: 10, maxWidth: 760, width: "100%", alignSelf: "center" },
  back: { color: P.ink, fontWeight: "700", paddingVertical: 6 },
  black: { backgroundColor: P.ink, padding: 10 }, blackTitle: { color: "#fff", fontSize: 20, fontWeight: "900" }, blackText: { color: "#ddd" },
  btn: { alignSelf: "flex-start", borderWidth: 2, borderColor: P.ink, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: "#fff" }, btnTxt: { color: P.ink, fontWeight: "800" },
  err: { color: "#fff", backgroundColor: P.bad, padding: 8, fontWeight: "700" }, dim: { color: P.dim },
  card: { backgroundColor: P.cell, borderWidth: 2, borderColor: P.ink, padding: 10, gap: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  name: { color: P.ink, fontSize: 18, fontWeight: "900", flexShrink: 1 }, hp: { color: P.ink, fontSize: 20, fontWeight: "900" },
  step: { minWidth: 44, height: 40, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 }, stepTxt: { color: "#fff", fontWeight: "900", fontSize: 16 },
  weapon: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: 1, borderColor: P.line, paddingTop: 6 },
  wname: { flex: 1, color: P.ink, fontWeight: "700" },
  act: { backgroundColor: P.ink, paddingVertical: 8, paddingHorizontal: 12 }, actTxt: { color: "#fff", fontWeight: "900" }
});

const LOCS = (): [string, string][] => ["torso", "head", "armL", "armR", "legL", "legR"].map((k) => [k, t(`fallout.loc.${k}`)]);
const DMG_KEYS = ["physical", "energy", "radiation", "poison"];
const DMG = (): [string, string][] => DMG_KEYS.map((k) => [k, t(`fallout.dmg.${k}`)]);

// Same flow as the "Dano ou Cura" macro. With `w` (the NPC's weapon), the NPC deals damage to the chosen targets; without `w`, the NPC is the target and you pick who attacked.
function DamageForm({ auth, npc, w, suggested, onClose, onDone, onError }: { auth: Auth; npc: Npc; w?: Npc["weapons"][number]; suggested?: number; onClose: () => void; onDone: (lines: string[]) => void; onError: (e: any) => void }) {
  const take = !w;
  const [amount, setAmount] = useState(String(suggested ?? w?.damageDice ?? 1));
  const [type, setType] = useState(w?.types.find((ty) => DMG_KEYS.includes(ty)) ?? "physical");
  const [loc, setLoc] = useState("torso");
  const [scene, setScene] = useState<{ sceneId: string | null; targets: SceneTarget[] } | null>(null);
  const [picked, setPicked] = useState<string[]>(take ? [npc.tokenId] : []);
  const [atkTok, setAtkTok] = useState<string | null>(null); // only when taking damage
  const [atkW, setAtkW] = useState<string | null>(w?.id ?? null);
  const [perks, setPerks] = useState<{ apply: DmgPerk[]; kill: DmgPerk[] } | null>(null);
  const [perkOn, setPerkOn] = useState<string[]>([]);
  const [defs, setDefs] = useState<DefPerk[]>([]);
  const [defOn, setDefOn] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const atk = take ? scene?.targets.find((t) => t.tokenId === atkTok) : npc;
  useEffect(() => { sceneTargets(auth).then(setScene).catch(onError); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // the attacker's perks depend on who attacks and with which weapon
    setPerks(null); setPerkOn([]);
    if (!atk || !atkW) return;
    damagePerks(auth, { actorId: atk.actorId, tokenId: atk.tokenId }, atkW).then((p) => { setPerks(p); setPerkOn([...p.apply, ...p.kill].filter((x) => x.auto && x.usesLeft !== 0).map((x) => x.key)); }).catch(onError);
  }, [atk?.tokenId, atkW]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { // defense choices depend on the selected targets
    if (!scene || !picked.length) { setDefs([]); return; }
    defensePerks(auth, scene.sceneId, picked).then((d) => { setDefs(d); setDefOn((on) => on.filter((k) => d.some((x) => `${x.tokenId}|${x.key}` === k))); }).catch(onError);
  }, [picked, scene]); // eslint-disable-line react-hooks/exhaustive-deps
  const n = parseInt(amount, 10), ok = Number.isInteger(n) && n > 0 && picked.length > 0 && !busy;
  const toggle = (list: string[], set: (l: string[]) => void, k: string) => set(list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);
  const run = async () => {
    setBusy(true); setMsg("");
    try {
      const killKeys = (perks?.kill ?? []).map((p) => p.key).filter((k) => perkOn.includes(k)), perkKeys = (perks?.apply ?? []).map((p) => p.key).filter((k) => perkOn.includes(k));
      const r = await applyDamage(auth, { sceneId: scene?.sceneId ?? null, attacker: atk && atkW ? { actorId: atk.actorId, tokenId: atk.tokenId } : null, weaponId: atkW, amount: n, dmgType: type, location: loc,
        targets: picked.map((t) => ({ tokenId: t, defKeys: defOn.filter((v) => v.startsWith(`${t}|`)).map((v) => v.slice(t.length + 1)) })), perkKeys, killKeys });
      onDone(r.lines.concat(r.perkErr ? [t("fallout.master.perkErr", { e: r.perkErr })] : []));
    } catch (e: any) { setBusy(false); setMsg(e.message); }
  };
  const Chip = ({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) => (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={onPress} style={[s.chip, on && s.chipOn]}><Text style={[s.chipTxt, on && { color: "#fff" }]}>{on ? "■" : "□"} {label}</Text></Pressable>
  );
  const others = scene?.targets.filter((t) => t.tokenId !== npc.tokenId) ?? [];
  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.box}>
          <View style={s.mhead}><Text style={s.mheadTxt}>{take ? t("fallout.master.takes", { n: npc.name }) : t("fallout.master.dealTitle", { n: npc.name, w: w!.name })}</Text></View>
          <ScrollView style={{ maxHeight: 520 }} contentContainerStyle={{ gap: 10 }}>
            <View style={s.row}><Text style={s.lab}>{t("fallout.master.dmg")}</Text><TextInput value={amount} onChangeText={setAmount} keyboardType="numeric" accessibilityLabel={t("fallout.master.dmgA11y")} style={s.input} /></View>
            <View style={s.chips}>{DMG().map(([k, l]) => <Chip key={k} on={type === k} label={l} onPress={() => setType(k)} />)}</View>
            <Text style={s.lab}>{t("fallout.master.loc")}</Text>
            <View style={s.chips}>{LOCS().map(([k, l]) => <Chip key={k} on={loc === k} label={l} onPress={() => setLoc(k)} />)}</View>
            {take ? <>
              <Text style={s.lab}>{t("fallout.master.who")}</Text>
              {!scene ? <ActivityIndicator color={P.ink} /> : <View style={s.chips}>
                <Chip on={!atkTok} label={t("fallout.master.nobody")} onPress={() => { setAtkTok(null); setAtkW(null); }} />
                {others.map((t) => <Chip key={t.tokenId} on={atkTok === t.tokenId} label={t.name} onPress={() => { setAtkTok(t.tokenId); setAtkW(t.weapons[0]?.id ?? null); }} />)}
              </View>}
              {!!atk && !!atk.weapons.length && <View style={s.chips}>{atk.weapons.map((x) => <Chip key={x.id} on={atkW === x.id} label={x.name} onPress={() => setAtkW(x.id)} />)}</View>}
            </> : <>
              <Text style={s.lab}>{t("fallout.master.targets")}</Text>
              {!scene ? <ActivityIndicator color={P.ink} /> : (
                <View style={s.chips}>{others.map((t) => <Chip key={t.tokenId} on={picked.includes(t.tokenId)} label={`${t.name}${t.hp ? ` (${t.hp.value}/${t.hp.max})` : ""}${t.dead ? " ☠" : ""}`} onPress={() => toggle(picked, setPicked, t.tokenId)} />)}</View>
              )}
            </>}
            {!!perks && (perks.apply.length + perks.kill.length) > 0 && <>
              <Text style={s.lab}>{t("fallout.master.atkPerks")}</Text>
              {[...perks.apply, ...perks.kill.map((p) => ({ ...p, kill: true }))].map((p: DmgPerk & { kill?: boolean }) => (
                <Chip key={p.key} on={perkOn.includes(p.key)} label={`${p.itemName}: ${p.label}${p.kill ? t("fallout.master.onKill") : ""}${p.usesLeft === 0 ? t("fallout.master.noUses") : ""}`} onPress={() => p.usesLeft !== 0 && toggle(perkOn, setPerkOn, p.key)} />
              ))}
            </>}
            {defs.length > 0 && <>
              <Text style={s.lab}>{t("fallout.master.defPerks")}</Text>
              {defs.map((d) => <Chip key={`${d.tokenId}|${d.key}`} on={defOn.includes(`${d.tokenId}|${d.key}`)} label={`${d.name}: ${d.label}`} onPress={() => toggle(defOn, setDefOn, `${d.tokenId}|${d.key}`)} />)}
            </>}
            {!!msg && <Text style={s.err}>{msg}</Text>}
          </ScrollView>
          <View style={[s.row, { justifyContent: "flex-end" }]}>
            <Pressable accessibilityRole="button" onPress={onClose} style={s.btn}><Text style={s.btnTxt}>{t("fallout.common.cancel")}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={run} disabled={!ok} style={[s.act, { backgroundColor: ok ? P.bad : P.dim }]}><Text style={s.actTxt}>{busy ? t("fallout.common.applying") : t("fallout.master.apply")}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
