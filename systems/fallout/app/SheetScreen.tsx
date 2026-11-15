// Open sheet: loads, direct edits, rolls (popup + card), level up, new item and utilities.
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useState } from "react";
import { AddItemScreen, LevelUpScreen } from "./Extras";
import { RollChoice, RollDialog, RollRequest } from "./RollDialog";
import { Result, RollResult } from "./RollResult";
import { SheetView } from "./SheetView";
import { Line, Opt, s, T, Terminal, useLoad } from "./Terminal";
import { AmmoScreen, LootScreen,  UtilKind } from "./Utils";
import type { Nav } from "../../../shared/types";
import { useLive } from "../../../shared/useLive";
import { t } from "../../../shared/i18n";
import { Auth, Sheet, getCharacter, listRollMods, resetModUses, rollDamage, rollSkill, rollWeapon, setAttribute, setCaps, setHp, setInjury, setLuck, setQuantity, setSkillTag } from "./api";

export function SheetScreen({ auth, id, nav }: { auth: Auth; id: string; nav: Nav }) {
  const onBack = nav.home, onAuthError = nav.logout;
  const { data: sh, setData, err, setErr } = useLoad<Sheet>(() => getCharacter(auth, id), onAuthError, [id]);
  const [mode, setMode] = useState<"sheet" | "levelup" | "add" | UtilKind>("sheet");
  const [rollReq, setRollReq] = useState<RollRequest | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  // action errors show in the footer card (they used to be hidden in the HP box)
  const fail = (e: any) => (e.status === 401 ? onAuthError() : setResult({ kind: "error", title: t("fallout.common.failed"), message: e.message }));
  useLive(auth, id, () => getCharacter(auth, id).then(setData).catch(() => {})); // spent ammo, loot etc. arrive by themselves
  if (err && !sh) return <Terminal title={t("fallout.entry.error")}><Line bad>!! {err}</Line><Opt label={t("fallout.entry.back")} onPress={onBack} /></Terminal>;
  if (!sh) return <View style={s.root}><ActivityIndicator color={T.fg} /></View>;

  const back = (next?: Sheet) => { setMode("sheet"); if (next) setData(next); else getCharacter(auth, id).then(setData).catch(fail); };
  const utilDone = (r?: Result) => { setMode("sheet"); if (r) setResult(r); };
  if (mode === "levelup") return <LevelUpScreen auth={auth} id={id} onDone={back} onAuthError={onAuthError} />;
  if (mode === "add") return <AddItemScreen auth={auth} id={id} onDone={back} onAuthError={onAuthError} />;
  if (mode === "ammo") return <AmmoScreen auth={auth} id={id} onDone={utilDone} onAuthError={onAuthError} />;
  
  if (mode === "loot") return <LootScreen auth={auth} id={id} onDone={utilDone} onAuthError={onAuthError} />;

  const change = async (delta: number) => {
    if (!sh.hp) return;
    try { setData(await setHp(auth, id, sh.hp.value + delta)); } catch (e) { fail(e); }
  };
  const roll = async (req: RollRequest, c: RollChoice) => {
    setRollReq(null); setResult({ kind: "busy", title: req.name });
    try {
      if (req.kind === "skill") setResult({ kind: "d20", r: await rollSkill(auth, id, req.id, c as Required<RollChoice>) });
      else if (req.kind === "weapon") setResult({ kind: "d20", r: await rollWeapon(auth, id, req.id, c as Required<RollChoice>) });
      else setResult({ kind: "d6", r: await rollDamage(auth, id, req.id, c.dice, c.mods) });
    } catch (e: any) { fail(e); }
  };
  const save = (p: Promise<Sheet>) => p.then(setData).catch(fail);
  const edit = {
    luck: (v: number) => save(setLuck(auth, id, v)), attr: (k: string, v: number) => save(setAttribute(auth, id, k, v)),
    tag: (skillId: string, t: boolean) => save(setSkillTag(auth, id, skillId, t)), caps: (v: number) => save(setCaps(auth, id, v)),
    qty: (itemId: string, q: number) => save(setQuantity(auth, id, itemId, q))
  };
  return (
    <View style={{ flex: 1, backgroundColor: "#ecebe7" }}>
      <ScrollView>
        <SheetView sh={sh} onHp={change} err={err} onBack={onBack} onRoll={setRollReq}
          onInjury={(part, i, v) => save(setInjury(auth, id, part, i, v))}
          onLevelUp={() => setMode("levelup")} onAdd={() => setMode("add")} onUtil={setMode} onEdit={edit} />
      </ScrollView>
      <RollDialog loadMods={(ctx) => listRollMods(auth, id, ctx).catch(() => [])} onResetUses={() => resetModUses(auth, id)} req={rollReq} onClose={() => setRollReq(null)} onRoll={(c) => rollReq && roll(rollReq, c)} />
      {result && <RollResult res={result} onClose={() => setResult(null)} />}
    </View>
  );
}
