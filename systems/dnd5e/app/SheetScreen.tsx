import { ReactNode, useContext, useEffect, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { onErr } from "../../../shared/errors";
import type { Nav } from "../../../shared/types";
import { useLive } from "../../../shared/useLive";
import { AdvanceFlow } from "./Advance";
import {
  Activity, Auth, HealTarget, healTargets, Choice, pool, resolvePending, special, Mode, RollOut, Sheet, activity, addItem, condition, creationOptions, getCharacter, hp, packs,
  removeItem, rest, roll, search, setItem, update
} from "./api";
import type { Existing } from "./Create";
import { PerkBox } from "./Perks";
import { SheetView } from "./SheetView";
import { abilityLabel, C, conditions, F, skillName, sign } from "./theme";
import { t } from "../../../shared/i18n";
import { ActorCtx, Chip, Field, Infernal, More, Ornament, Rich, Seal, u } from "./ui";
// What the sheet asks the app to open: roll, item/spell action, HP, conditions, add item, level up, text.
export type Ask =
  | { kind: "roll"; title: string; rollKind: string; key?: string }
  | { kind: "item"; itemId: string }
  | { kind: "hp" } | { kind: "conditions" } | { kind: "add"; itemType: "gear" | "spell" } | { kind: "levelup" } | { kind: "rest" }
  | { kind: "info"; title: string; text: string };
type Result = RollOut | "busy" | { error: string } | { note: string };

export function SheetScreen({ auth, id, nav }: { auth: Auth; id: string; nav: Nav }) {
  const onBack = nav.home, onAuthError = nav.logout, onResume = (e: Existing) => nav.create(e);
  const [sh, setSh] = useState<Sheet | null>(null);
  const [err, setErr] = useState("");
  const [ask, setAsk] = useState<Ask | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [skipped, setSkipped] = useState<string[]>([]); // choices postponed until reload
  const [followUp, setFollowUp] = useState<{ itemId: string; activityId: string; critical: boolean } | null>(null);
  const fail = (e: any) => onErr(e, onAuthError, (error) => setResult({ error }));
  const load = () => getCharacter(auth, id).then(setSh);
  useEffect(() => { load().catch((e) => onErr(e, onAuthError, setErr)); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useLive(auth, id, () => load().catch(() => {}));
  if (err) return <Infernal title={t("dnd.s.error")}><Text style={u.err}>{err}</Text><Seal label={t("dnd.s.back")} onPress={onBack} /></Infernal>;
  if (!sh) return <View style={s.night}><ActivityIndicator color={C.ember} /></View>;
  const incomplete = !sh.classes.length || !sh.background || !sh.species;
  const save = (p: Promise<Sheet>) => p.then((n) => { setSh(n); return true; }, (e) => { fail(e); load().catch(() => {}); return false; });
  const doRoll = async (p: Promise<RollOut>, follow?: { itemId: string; activityId: string }) => {
    setAsk(null); setResult("busy");
    try { const r = await p; setResult(r); setFollowUp(follow ? { ...follow, critical: !!r.critical } : null); load().catch(() => {}); } catch (e) { fail(e); }
  };
  const act = {
    roll: (rollKind: string, key: string | undefined, mode: Mode, bonus: number, mods?: string[]) => doRoll(roll(auth, id, { kind: rollKind, key, mode, bonus, mods })),
    attack: (itemId: string, a: Activity, mode: Mode, bonus: number, mods?: string[]) => doRoll(activity(auth, id, { itemId, activityId: a.id, action: "attack", mode, bonus, mods }), { itemId, activityId: a.id }),
    damage: (itemId: string, activityId: string, critical: boolean, mods?: string[]) => { setFollowUp(null); return doRoll(activity(auth, id, { itemId, activityId, action: "damage", critical, mods })); },
    pool: (itemId: string, n: number, target?: string) => doRoll(pool(auth, id, itemId, n, target)),
    heal: (itemId: string, activityId: string, mods?: string[], target?: string) => { setFollowUp(null); return doRoll(activity(auth, id, { itemId, activityId, action: "heal", mods, targetTokenId: target })); },
    soakHit: async (n: number, mods: string[]) => { // defense (reaction) before damage: the damage drops by what the reaction rolls
      setAsk(null); setResult("busy");
      try { const r = await roll(auth, id, { kind: "soak", mods }); setResult(r); if (n - (r.total ?? 0) > 0) await save(hp(auth, id, n - (r.total ?? 0), false)); else load().catch(() => {}); } catch (e) { fail(e); }
    },
    special: async (itemId: string, choice?: string) => { setAsk(null); setResult("busy"); try { await special(auth, id, itemId, choice); setResult({ note: t("dnd.s.activated") }); load().catch(() => {}); } catch (e) { fail(e); } },
    use: async (itemId: string, a: Activity, slot?: string) => {
      setAsk(null); setResult("busy");
      try { const r = await activity(auth, id, { itemId, activityId: a.id, action: "use", slot }); if (r.sheet) setSh(r.sheet); setResult({ note: t("dnd.s.used", { label: r.label }) }); } catch (e) { fail(e); }
    },
  };
  return (
    <ActorCtx.Provider value={id}>
    <View style={{ flex: 1, backgroundColor: C.desk }}>
      <ScrollView>
        {incomplete && (
          <Pressable accessibilityRole="button" style={s.banner} onPress={() => onResume({ id: sh.id, name: sh.name, hasClass: !!sh.classes.length, hasBackground: !!sh.background, hasSpecies: !!sh.species })}>
            <Text style={s.bannerTxt}>{t("dnd.s.banner")}</Text>
          </Pressable>
        )}
        <SheetView sh={sh} onBack={onBack} onAsk={setAsk}
          onUpdate={(changes) => save(update(auth, id, changes))}
          onItem={(itemId, field, value) => save(setItem(auth, id, itemId, field, value))} />
      </ScrollView>
      {!ask && sh.pending?.some((p) => !skipped.includes(p.id)) && <PendingChoice auth={auth} list={sh.pending.filter((p) => !skipped.includes(p.id))} names={Object.fromEntries(sh.features.map((f) => [f.id, f.name]))} onLater={(ids) => setSkipped([...skipped, ...ids])} onDone={() => load().catch(() => {})} onError={fail} />}
      {ask && <AskView ask={ask} sh={sh} auth={auth} act={act} onClose={() => setAsk(null)} onAuthError={onAuthError}
        onSheet={(n, note) => { setSh(n); setAsk(null); if (note) setResult({ note }); }}
        save={save} onRemove={(itemId) => { setAsk(null); save(removeItem(auth, id, itemId)); }} />}
      {result && <ResultCard res={result} onClose={() => { setResult(null); setFollowUp(null); }}
        follow={followUp ? () => act.damage(followUp.itemId, followUp.activityId, followUp.critical) : undefined} critical={!!followUp?.critical} />}
    </View>
    </ActorCtx.Provider>
  );
}

// ---------- Popups ----------
// Healing target: yourself or an active scene token (the list comes from the relay; without a scene, only "You").
function HealTargetPick({ auth, value, onChange }: { auth: Auth; value: string; onChange: (id: string) => void }) {
  const [list, setList] = useState<HealTarget[]>([]);
  useEffect(() => { healTargets(auth).then(setList, () => {}); }, []);
  if (!list.length) return null;
  return <>
    <Text style={u.label}>{t("dnd.s.target")}</Text>
    <View style={u.chips}><Chip label={t("dnd.s.you")} on={!value} onPress={() => onChange("")} />{list.map((t) => <Chip key={t.tokenId} label={`${t.name} (${t.hp.value}/${t.hp.max})`} on={value === t.tokenId} onPress={() => onChange(t.tokenId)} />)}</View>
  </>;
}
type Act = {
  roll: (k: string, key: string | undefined, m: Mode, b: number, mods?: string[]) => void; attack: (itemId: string, a: Activity, m: Mode, b: number, mods?: string[]) => void;
  damage: (itemId: string, activityId: string, critical: boolean, mods?: string[]) => void; special: (itemId: string, choice?: string) => void; pool: (itemId: string, n: number, target?: string) => void; heal: (itemId: string, activityId: string, mods?: string[], target?: string) => void; soakHit: (n: number, mods: string[]) => void; use: (itemId: string, a: Activity, slot?: string) => void;
};
function Modalish({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <View style={s.dialog}>
          <View style={s.dialogHead}><Text style={s.dialogTitle}>{title}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel={t("dnd.close")} onPress={onClose} hitSlop={10}><Text style={s.close}>✕</Text></Pressable></View>
          <ScrollView contentContainerStyle={{ gap: 12 }}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}
function ModePick({ mode, setMode, bonus, setBonus }: { mode: Mode; setMode: (m: Mode) => void; bonus: number; setBonus: (n: number) => void }) {
  return <>
    <View style={u.chips}>
      <Chip label={t("dnd.mode.normal")} on={mode === "normal"} onPress={() => setMode("normal")} color={C.stoneDark} />
      <Chip label={t("dnd.mode.adv")} on={mode === "adv"} onPress={() => setMode("adv")} color={C.good} />
      <Chip label={t("dnd.mode.dis")} on={mode === "dis"} onPress={() => setMode("dis")} color={C.red} />
    </View>
    <View style={s.stepRow}>
      <Text style={[u.p, { flex: 1 }]}>{t("dnd.s.bonus")}</Text>
      <Pressable accessibilityLabel={t("dnd.s.bonusDec")} onPress={() => setBonus(Math.max(-20, bonus - 1))} style={s.stepBtn}><Text style={s.stepTxt}>−</Text></Pressable>
      <Text style={s.stepVal}>{sign(bonus)}</Text>
      <Pressable accessibilityLabel={t("dnd.s.bonusInc")} onPress={() => setBonus(Math.min(20, bonus + 1))} style={s.stepBtn}><Text style={s.stepTxt}>+</Text></Pressable>
    </View>
  </>;
}

function AskView({ ask, sh, auth, act, onClose, onSheet, save, onRemove, onAuthError }: {
  ask: Ask; sh: Sheet; auth: Auth; act: Act; onClose: () => void; onSheet: (s: Sheet, note?: string) => void; save: (p: Promise<Sheet>) => Promise<boolean>; onRemove: (itemId: string) => void; onAuthError: () => void;
}) {
  const [mode, setMode] = useState<Mode>("normal");
  const [bonus, setBonus] = useState(0);
  const [amount, setAmount] = useState("");
  const [slot, setSlot] = useState("");
  const [dice, setDice] = useState(1);
  const [choice, setChoice] = useState(""); // option of the own action (constellation, martial form)
  const [target, setTarget] = useState(""); // healing target token ("" = yourself)
  const [perks, setPerks] = useState<Record<string, string[]>>({}); // selections per action (attack/damage of each activity)
  const setP = (k: string) => (v: string[]) => setPerks((p) => ({ ...p, [k]: v }));
  const [groups, setGroups] = useState<Record<string, Record<string, string[]>>>({}); // per activity: feat -> actions where it applies
  const forAction = (act: string, tag: string) => (perks[act] ?? []).filter((k) => groups[act]?.[k]?.includes(tag)); // only what applies to the pressed button goes
  if (ask.kind === "roll") return (
    <Modalish title={ask.title} onClose={onClose}>
      <ModePick mode={mode} setMode={setMode} bonus={bonus} setBonus={setBonus} />
      <PerkBox auth={auth} actorId={sh.id} ctx={{ kind: ask.rollKind, key: ask.key }} picked={perks.d20 ?? []} setPicked={setP("d20")} />
      <Seal label={t("dnd.s.rollD20")} onPress={() => act.roll(ask.rollKind, ask.key, mode, bonus, perks.d20)} />
    </Modalish>
  );
  if (ask.kind === "info") return <Modalish title={ask.title} onClose={onClose}><Rich text={ask.text} /></Modalish>;
  if (ask.kind === "hp") {
    const n = parseInt(amount, 10);
    return (
      <Modalish title={`${t("dnd.s.hpTitle", { v: sh.hp.value, max: sh.hp.max })}${sh.hp.temp ? t("dnd.tempPart", { n: sh.hp.temp }) : ""}`} onClose={onClose}>
        <Field label={t("dnd.amount")} value={amount} onChangeText={setAmount} numeric />
        <View style={u.row}>
          <View style={{ flex: 1 }}><Seal label={t("dnd.damage")} onPress={() => n > 0 && save(hp(auth, sh.id, n, false)).then((ok) => ok && onClose())} disabled={!(n > 0)} /></View>
          <View style={{ flex: 1 }}><Seal ghost label={t("dnd.heal")} onPress={() => n > 0 && save(hp(auth, sh.id, n, true)).then((ok) => ok && onClose())} disabled={!(n > 0)} /></View>
        </View>
        <PerkBox auth={auth} actorId={sh.id} ctx={{ kind: "soak" }} picked={perks.soak ?? []} setPicked={setP("soak")} />
        {!!perks.soak?.length && <Seal label={t("dnd.s.soakBtn")} onPress={() => n > 0 && act.soakHit(n, perks.soak)} disabled={!(n > 0)} />}
        <Text style={u.hint}>{t("dnd.s.hpHint")}</Text>
      </Modalish>
    );
  }
  if (ask.kind === "rest") return (
    <Modalish title={t("dnd.rest")} onClose={onClose}>
      <Text style={u.p}>{t("dnd.s.hdLine", { v: sh.hd.value, max: sh.hd.max })}</Text>
      <View style={u.chips}>{sh.classes.filter((c) => c.hd.value > 0).map((c) => <Chip key={c.id} label={t("dnd.s.spendHd", { den: c.hd.denomination, name: c.name, n: c.hd.value })} on={false} onPress={() => act.roll("hitDie", c.hd.denomination, "normal", 0)} />)}</View>
      <View style={u.row}>
        <View style={{ flex: 1 }}><Seal ghost label={t("dnd.s.shortRest")} onPress={() => save(rest(auth, sh.id, "short")).then((ok) => ok && onClose())} /></View>
        <View style={{ flex: 1 }}><Seal label={t("dnd.s.longRest")} onPress={() => save(rest(auth, sh.id, "long")).then((ok) => ok && onClose())} /></View>
      </View>
      <Text style={u.hint}>{t("dnd.s.restHint")}</Text>
    </Modalish>
  );
  if (ask.kind === "conditions") return (
    <Modalish title={t("dnd.conditions")} onClose={onClose}>
      <View style={u.chips}>{conditions().map(([k, l]) => { const on = sh.conditions.includes(k); return <Chip key={k} label={l} on={on} onPress={() => save(condition(auth, sh.id, k, !on))} />; })}</View>
      <View style={s.stepRow}>
        <Text style={[u.p, { flex: 1 }]}>{t("dnd.s.exhaustion", { n: sh.exhaustion })}</Text>
        <Pressable accessibilityLabel={t("dnd.s.exDec")} disabled={sh.exhaustion <= 0} onPress={() => save(update(auth, sh.id, { "system.attributes.exhaustion": sh.exhaustion - 1 }))} style={s.stepBtn}><Text style={s.stepTxt}>−</Text></Pressable>
        <Pressable accessibilityLabel={t("dnd.s.exInc")} disabled={sh.exhaustion >= 6} onPress={() => save(update(auth, sh.id, { "system.attributes.exhaustion": sh.exhaustion + 1 }))} style={s.stepBtn}><Text style={s.stepTxt}>+</Text></Pressable>
      </View>
    </Modalish>
  );
  if (ask.kind === "add") return <AddItem auth={auth} sh={sh} spells={ask.itemType === "spell"} onClose={onClose} onAdded={(n, name) => onSheet(n, t("dnd.s.added", { name }))} onAuthError={onAuthError} />;
  if (ask.kind === "levelup") return <LevelUp auth={auth} sh={sh} onClose={onClose} onDone={(n) => n && onSheet(n, t("dnd.s.levelApplied"))} onAuthError={onAuthError} />;

  // Item, spell or feature: its text and actions (activities).
  const item = [...sh.spells, ...sh.gear, ...sh.features].find((i) => i.id === ask.itemId);
  if (!item) return null;
  const spell = sh.spells.find((i) => i.id === ask.itemId);
  const gear = sh.gear.find((i) => i.id === ask.itemId);
  const slots = spell && spell.level > 0 && spell.method !== "innate" ? sh.slots.filter((x) => (x.key === "pact" || x.level >= spell.level) && x.value > 0) : [];
  const chosenSlot = slot || slots[0]?.key || "";
  return (
    <Modalish title={item.name} onClose={onClose}>
      {spell && <Text style={u.hint}>{spell.level === 0 ? t("dnd.cantripCap") : t("dnd.levelCap", { n: spell.level })} · {spell.school} · {spell.activation} · {spell.range} · {spell.duration} · {spell.components}</Text>}
      {"uses" in item && item.uses && <Text style={u.p}>{t("dnd.s.uses", { v: item.uses.value, max: item.uses.max })}</Text>}
      {slots.length > 0 && <>
        <Text style={u.label}>{t("dnd.s.slot")}</Text>
        <View style={u.chips}>{slots.map((x) => <Chip key={x.key} label={`${t(x.key === "pact" ? "dnd.pact" : "dnd.levelCap", { n: x.level })} (${x.value})`} on={chosenSlot === x.key} onPress={() => setSlot(x.key)} />)}</View>
      </>}
      {spell && spell.level > 0 && !slots.length && spell.method !== "innate" && <Text style={u.err}>{t("dnd.s.noSlots")}</Text>}
      {item.activities.some((a) => a.type === "attack") && <ModePick mode={mode} setMode={setMode} bonus={bonus} setBonus={setBonus} />}
      {(("pool" in item && !!item.pool) || item.activities.some((a) => a.type === "heal")) && <HealTargetPick auth={auth} value={target} onChange={setTarget} />}
      {item.activities.map((a) => (
        <View key={a.id} style={s.actRow}>
          <Text style={[u.p, { fontWeight: "700" }]}>{a.name}{a.activation ? ` · ${a.activation}` : ""}{a.toHit ? ` · ${a.toHit}` : ""}{a.save ? ` · ${t("dnd.dc", { n: a.save.dc })} ${a.save.ability.map((k) => abilityLabel(k)).join("/")}` : ""}{a.damage.length ? ` · ${a.damage.join(", ")}` : ""}</Text>
          {(a.type === "attack" || a.damage.length > 0) && <PerkBox auth={auth} actorId={sh.id}
            ctxs={[...(a.type === "attack" ? [{ ctx: { itemId: item.id, activityId: a.id, action: "attack" }, tag: t("dnd.attackLc") }] : []), ...(a.damage.length > 0 ? [a.type === "heal" ? { ctx: { itemId: item.id, activityId: a.id, action: "heal" }, tag: t("dnd.healLc") } : { ctx: { itemId: item.id, activityId: a.id, action: "damage" }, tag: t("dnd.damageLc") }] : [])]}
            picked={perks[a.id] ?? []} setPicked={setP(a.id)} onGroups={(g) => setGroups((x) => ({ ...x, [a.id]: g }))} />}
          <View style={u.row}>
            {a.type === "attack" && <Seal small label={t("dnd.attack")} onPress={() => act.attack(item.id, a, mode, bonus, forAction(a.id, t("dnd.attackLc")))} />}
            {a.damage.length > 0 && (a.type === "heal" ? <Seal small ghost label={t("dnd.s.healBtn")} onPress={() => act.heal(item.id, a.id, forAction(a.id, t("dnd.healLc")), target || undefined)} /> : <Seal small ghost label={t("dnd.damage")} onPress={() => act.damage(item.id, a.id, false, forAction(a.id, t("dnd.damageLc")))} />)}
            {(a.type !== "attack" || (spell && spell.level > 0)) && <Seal small ghost={a.type === "attack"} label={spell && spell.level ? t("dnd.s.cast") : t("dnd.s.use")} onPress={() => act.use(item.id, a, slots.length ? chosenSlot : undefined)} />}
          </View>
        </View>
      ))}
      {"pool" in item && !!item.pool ? (
        <View style={{ gap: 6 }}>
          <Text style={u.hint}>{t("dnd.s.pool", { left: item.pool.left, max: item.pool.max, die: item.pool.die })}{item.pool.cap < item.pool.max ? t("dnd.s.poolCap", { n: item.pool.cap }) : ""}</Text>
          <View style={u.chips}>{Array.from({ length: Math.min(item.pool.left, item.pool.cap) }, (_, k) => k + 1).map((k) => <Chip key={k} label={`${k}d${item.pool!.die}`} on={Math.min(dice, item.pool!.left) === k} onPress={() => setDice(k)} color={C.stoneDark} />)}</View>
          {item.pool.left > 0 && <Seal small label={t("dnd.s.healWith", { n: Math.min(dice, item.pool.left, item.pool.cap), die: item.pool.die })} onPress={() => act.pool(item.id, Math.min(dice, item.pool!.left, item.pool!.cap), target || undefined)} />}
        </View>
      ) : "special" in item && !!item.special && (
        <View style={{ gap: 6 }}>
          {"choices" in item && !!item.choices?.length && <View style={u.chips}>{item.choices.map((c) => <Chip key={c.value} label={c.label} on={choice === c.value} onPress={() => setChoice(c.value)} />)}</View>}
          <Seal small label={item.special} onPress={() => (("choices" in item && item.choices?.length) ? choice && act.special(item.id, choice) : act.special(item.id))} />
        </View>
      )}
      {!item.activities.length && !("special" in item && item.special) && <Text style={u.hint}>{t("dnd.s.noAction")}</Text>}
      <More text={item.description || "—"} lines={10} />
      {(gear || spell) && <Seal small ghost label={t(gear ? "dnd.s.removeItem" : "dnd.s.removeSpell")} onPress={() => onRemove(item.id)} />}
    </Modalish>
  );
}

function AddItem({ auth, sh, spells, onClose, onAdded, onAuthError }: { auth: Auth; sh: Sheet; spells: boolean; onClose: () => void; onAdded: (s: Sheet, name: string) => void; onAuthError: () => void }) {
  const [list, setList] = useState<{ id: string; label: string }[]>([]);
  const [pack, setPack] = useState("");
  const [q, setQ] = useState("");
  const [res, setRes] = useState<{ uuid: string; name: string; type: string; level: number | null }[]>([]);
  const [err, setErr] = useState("");
  const fail = (e: any) => onErr(e, onAuthError, setErr);
  useEffect(() => { packs(auth).then((l) => { setList(l); setPack(l.find((p) => (spells ? /spells/ : /equipment/).test(p.id))?.id ?? l[0]?.id ?? ""); }).catch(fail); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!pack) return; const t = setTimeout(() => search(auth, pack, q, spells ? "spell" : "").then((r) => setRes(spells ? r : r.filter((x) => x.type !== "spell"))).catch(fail), 250); return () => clearTimeout(t); }, [pack, q]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modalish title={spells ? t("dnd.s.addSpell") : t("dnd.s.addItem")} onClose={onClose}>
      <View style={u.chips}>{list.map((p) => <Chip key={p.id} label={p.label} on={pack === p.id} onPress={() => setPack(p.id)} color={C.stoneDark} />)}</View>
      <TextInput value={q} onChangeText={setQ} placeholder={t("dnd.s.searchPh")} placeholderTextColor={C.soft} style={s.search} accessibilityLabel={t("dnd.s.search")} />
      {!!err && <Text style={u.err}>{err}</Text>}
      {res.map((r) => (
        <Pressable key={r.uuid} accessibilityRole="button" onPress={() => addItem(auth, sh.id, r.uuid).then((n) => onAdded(n, r.name)).catch(fail)} style={s.resRow}>
          <Text style={u.p}>＋ {r.name}<Text style={u.hint}>{r.level != null ? `  ${r.level === 0 ? t("dnd.cantrip") : t("dnd.levelN", { n: r.level })}` : `  ${r.type}`}</Text></Text>
        </Pressable>
      ))}
    </Modalish>
  );
}

function LevelUp({ auth, sh, onClose, onDone, onAuthError }: { auth: Auth; sh: Sheet; onClose: () => void; onDone: (s?: Sheet) => void; onAuthError: () => void }) {
  const [target, setTarget] = useState<{ classId?: string; uuid?: string; label: string } | null>(null);
  const [classes, setClasses] = useState<{ uuid: string; name: string }[] | null>(null);
  useEffect(() => { creationOptions(auth).then((o) => setClasses(o.classes.filter((c) => !sh.classes.some((k) => k.name === c.name)))).catch(() => setClasses([])); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Modalish title={t("dnd.s.levelUp", { a: sh.level, b: sh.level + 1 })} onClose={onClose}>
      {target ? <AdvanceFlow auth={auth} actorId={sh.id} target={target} title={target.label} onDone={onDone} onCancel={() => setTarget(null)} onAuthError={onAuthError} /> : <>
        {sh.xp.max != null && sh.xp.value < sh.xp.max && <Text style={u.hint}>{t("dnd.s.xpHint", { v: sh.xp.value, max: sh.xp.max })}</Text>}
        <Text style={u.label}>{t("dnd.s.whichClass")}</Text>
        {sh.classes.map((c) => <Seal key={c.id} label={`${c.name} ${c.level} → ${c.level + 1}`} onPress={() => setTarget({ classId: c.id, label: t("dnd.s.classLevel", { name: c.name, n: c.level + 1 }) })} />)}
        <Text style={u.label}>{t("dnd.s.multi")}</Text>
        {!classes ? <ActivityIndicator color={C.red} /> : <View style={u.chips}>{classes.map((c) => <Chip key={c.uuid} label={c.name} on={false} onPress={() => setTarget({ uuid: c.uuid, label: t("dnd.s.multiLabel", { name: c.name }) })} />)}</View>}
        <Text style={u.hint}>{t("dnd.s.multiHint")}</Text>
      </>}
    </Modalish>
  );
}

// Result: big total, dice, and "Roll damage" after an attack (doubled on a crit).
// Character's pending choices (the "Apartado dos Sonhos" skill after a long rest, the damage type of Elemental Affinity…).
// One page per choice; the title carries the feat's name.
function PendingChoice({ auth, list, names, onLater, onDone, onError }: { auth: Auth; list: Choice[]; names: Record<string, string>; onLater: (ids: string[]) => void; onDone: () => void; onError: (e: any) => void }) {
  const [page, setPage] = useState(0);
  const [val, setVal] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const actorId = useContext(ActorCtx);
  const i = Math.min(page, list.length - 1), p = list[i];
  return (
    <Modalish title={t("dnd.s.pending", { name: names[p.itemId] ?? t("dnd.s.feat") })} onClose={() => onLater(list.map((x) => x.id))}>
      {list.length > 1 && (
        <View style={u.row}>
          <View style={{ flex: 1 }}><Seal small ghost label={t("dnd.prev")} disabled={i === 0} onPress={() => setPage(i - 1)} /></View>
          <Text style={[u.p, { alignSelf: "center" }]}>{t("dnd.s.pageOf", { i: i + 1, n: list.length })}</Text>
          <View style={{ flex: 1 }}><Seal small ghost label={t("dnd.s.next")} disabled={i === list.length - 1} onPress={() => setPage(i + 1)} /></View>
        </View>
      )}
      <Text style={u.p}>{p.title}</Text>
      <View style={u.chips}>{p.options.map((o) => <Chip key={o.value} label={p.kind === "skill" ? skillName(o.value) ?? o.label : o.label} on={val[p.id] === o.value} onPress={() => setVal({ ...val, [p.id]: o.value })} color={C.stoneDark} />)}</View>
      <Seal label={busy ? t("dnd.applying") : t("dnd.confirm")} disabled={!val[p.id] || busy} onPress={() => { setBusy(true); resolvePending(auth, actorId!, p.id, val[p.id]).then(() => { setBusy(false); onDone(); }, (e) => { setBusy(false); onError(e); }); }} />
    </Modalish>
  );
}

function ResultCard({ res, onClose, follow, critical }: { res: Result; onClose: () => void; follow?: () => void; critical: boolean }) {
  const label = (r: RollOut) => r.kind === "skill" ? skillName(r.label) : r.kind === "check" ? t("dnd.s.checkOf", { name: abilityLabel(r.label) }) : r.kind === "save" ? t("dnd.s.saveOf", { name: abilityLabel(r.label) })
    : r.kind === "death" ? t("dnd.s.deathSave") : r.kind === "soak" ? t("dnd.s.soakRes") : r.kind === "heal" ? t("dnd.s.healLabel", { label: r.label }) : r.kind === "init" ? t("dnd.initiative") : r.kind === "hitDie" ? t("dnd.s.hdLabel", { label: r.label }) : r.kind === "attack" ? t("dnd.s.attackLabel", { label: r.label }) : r.kind === "damage" ? t("dnd.s.damageLabel", { label: r.label }) : r.label;
  return (
    <View style={s.cardWrap} pointerEvents="box-none">
      <View style={s.card}>
        {res === "busy" ? <ActivityIndicator color={C.red} /> : "error" in res ? <><Text style={s.dialogTitle}>{t("dnd.s.failed")}</Text><Text style={u.err}>{res.error}</Text></>
          : "note" in res ? <Text style={u.p}>{res.note}</Text> : <>
            <Text style={s.cardLabel}>{label(res)}</Text>
            <Text style={[s.cardTotal, res.critical && { color: C.good }, res.fumble && { color: C.red }]}>{res.total ?? "—"}</Text>
            {res.critical && <Text style={[s.cardLabel, { color: C.good }]}>{t("dnd.s.critical")}</Text>}
            {res.fumble && <Text style={[s.cardLabel, { color: C.red }]}>{t("dnd.s.fumble")}</Text>}
            <View style={u.chips}>{(res.dice ?? []).map((d, i) => <View key={i} style={[s.die, !d.active && { opacity: 0.35 }]}><Text style={s.dieT}>{d.result}</Text><Text style={s.dieF}>d{d.faces}</Text></View>)}</View>
            <Text style={u.hint}>{res.formula}</Text>
            {res.healed?.applied !== undefined && <Text style={u.p}>{t("dnd.s.healed", { name: res.healed.name, applied: res.healed.applied, v: res.healed.hp.value, max: res.healed.hp.max })}</Text>}
            {!!res.mods?.used.length && <Text style={u.p}>{t("dnd.s.usedMods", { list: res.mods.used.join("; ") })}</Text>}
            {!!res.mods?.warn?.length && <Text style={u.p}>{t("dnd.s.warn", { list: res.mods.warn.join("; ") })}</Text>}
            {res.mods?.extra.map((x, i) => <Text key={i} style={u.p}>{x.label}: {x.total} ({x.formula})</Text>)}
            {res.mods?.notes.map((n, i) => <Text key={i} style={u.hint}>{n}</Text>)}
            {follow && <Seal small label={critical ? t("dnd.s.rollDmgCrit") : t("dnd.s.rollDmg")} onPress={follow} />}
          </>}
        <Pressable accessibilityRole="button" accessibilityLabel={t("dnd.close")} onPress={onClose} style={s.cardClose}><Text style={s.close}>✕</Text></Pressable>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  night: { flex: 1, backgroundColor: C.desk, justifyContent: "center" },
  banner: { backgroundColor: C.red, padding: 12, margin: 8, borderRadius: 4 },
  bannerTxt: { fontFamily: F.title, color: "#fff", fontSize: 15, textAlign: "center", fontWeight: "700" },
  backdrop: { flex: 1, backgroundColor: "rgba(20,8,6,.6)", justifyContent: "center", padding: 12 },
  dialog: { backgroundColor: C.page, borderWidth: 3, borderColor: C.stoneDark, borderRadius: 6, padding: 16, maxWidth: 620, width: "100%", maxHeight: "92%", alignSelf: "center", gap: 10 },
  dialogHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  dialogTitle: { fontFamily: F.title, fontSize: 20, color: C.ink, fontWeight: "700", flex: 1 },
  close: { fontSize: 20, color: C.soft },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: C.stoneDark, alignItems: "center", justifyContent: "center" },
  stepTxt: { fontSize: 20, color: C.ink, fontWeight: "700" },
  stepVal: { fontFamily: F.body, fontSize: 18, fontWeight: "800", width: 36, textAlign: "center", color: C.ink },
  actRow: { borderTopWidth: 1, borderColor: C.stone, paddingTop: 8, gap: 6 },
  search: { borderWidth: 1.5, borderColor: C.stone, borderRadius: 4, backgroundColor: "#fff", fontFamily: F.body, fontSize: 16, color: C.ink, padding: 8 },
  resRow: { paddingVertical: 8, borderBottomWidth: 1, borderColor: "#ddd" },
  cardWrap: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, alignItems: "center" },
  card: { backgroundColor: C.page, borderWidth: 3, borderColor: C.stoneDark, borderRadius: 6, padding: 16, paddingTop: 12, gap: 6, width: "100%", maxWidth: 420, alignItems: "center", boxShadow: "0 6px 24px rgba(0,0,0,.5)" } as object,
  cardLabel: { fontFamily: F.title, fontSize: 16, color: C.ink, fontWeight: "700", textAlign: "center" },
  cardTotal: { fontFamily: F.title, fontSize: 46, color: C.ink, fontWeight: "700", lineHeight: 52 },
  die: { minWidth: 40, height: 44, borderRadius: 6, borderWidth: 2, borderColor: C.ink, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  dieT: { fontFamily: F.body, fontSize: 18, fontWeight: "800", color: C.ink, lineHeight: 20 },
  dieF: { fontFamily: F.body, fontSize: 10, color: C.soft },
  cardClose: { position: "absolute", top: 4, right: 8, padding: 6 },
});
