// Roll popup (like Foundry's Dialog2d20): sheet values pre-filled, the player adjusts and rolls.
import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { RollBase, RollMod } from "./api";
import { t } from "../../../shared/i18n";

export type RollRequest =
  | { kind: "skill" | "weapon"; id: string; name: string; attrLabel: string; base: RollBase }
  | { kind: "damage"; id: string; name: string; dice: number; ammo: string; ammoPerShot: number };
export type RollChoice = { dice: number; mods?: string[]; difficulty?: number } & Partial<RollBase>;

const P = { ink: "#111", paper: "#f6f5f1", line: "#c9c7c0", dim: "#6b6b66", ok: "#00933B" };

function Stepper({ label, value, set, min, max }: { label: string; value: number; set: (n: number) => void; min: number; max: number }) {
  const step = (d: number) => set(Math.max(min, Math.min(max, value + d)));
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <View style={s.stepper}>
        <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.common.decrease", { label })} onPress={() => step(-1)} style={s.stepBtn}><Text style={s.stepTxt}>−</Text></Pressable>
        <Text style={s.value}>{value}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t("fallout.common.increase", { label })} onPress={() => step(1)} style={s.stepBtn}><Text style={s.stepTxt}>+</Text></Pressable>
      </View>
    </View>
  );
}

type ModCtx = { roll: string; skillId?: string; itemId?: string };
export function RollDialog({ req, onRoll, onClose, loadMods, onResetUses }: { req: RollRequest | null; onRoll: (c: RollChoice) => void; onClose: () => void; loadMods: (ctx: ModCtx) => Promise<RollMod[]>; onResetUses: () => Promise<unknown> }) {
  const [dice, setDice] = useState(2);
  const [attribute, setAttribute] = useState(0);
  const [rank, setRank] = useState(0);
  const [tag, setTag] = useState(false);
  const [complication, setComplication] = useState(20);
  const [difficulty, setDifficulty] = useState(1);
  const [mods, setMods] = useState<RollMod[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => { // on every new test, goes back to the sheet values
    if (!req) return;
    setPicked([]); setMods([]); setQ("");
    let on = true;
    loadMods(req.kind === "skill" ? { roll: "skill", skillId: req.id } : { roll: req.kind === "weapon" ? "attack" : "damage", itemId: req.id }).then((m) => { if (!on) return; setMods(m); setPicked(m.filter((x) => x.auto && x.usesLeft !== 0).map((x) => x.key)); }); // automatic ones come pre-checked
    if (req.kind === "damage") { setDice(req.dice); return; }
    setDice(2); setAttribute(req.base.attribute); setRank(req.base.rank); setTag(req.base.tag); setComplication(req.base.complication); setDifficulty(1);
    return () => { on = false; };
  }, [req]);
  if (!req) return null;
  const d20 = req.kind !== "damage";
  const title = req.kind === "skill" ? t("fallout.roll.tSkill", { name: req.name }) : req.kind === "weapon" ? t("fallout.roll.tWeapon", { name: req.name }) : t("fallout.roll.tDamage", { name: req.name });

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel={t("fallout.roll.close")}>
        <Pressable style={s.box} onPress={() => {}} accessibilityViewIsModal>
          <View style={s.head}><Text style={s.headTxt}>{title}</Text></View>
          {d20 ? (
            <>
              <View style={s.field}>
                <Text style={s.label}>{t("fallout.roll.d20")}</Text>
                <View style={s.chips}>
                  {[1, 2, 3, 4, 5, 6].map((n) => (
                    <Pressable key={n} accessibilityRole="radio" accessibilityState={{ checked: dice === n }} onPress={() => setDice(n)} style={[s.chip, dice === n && s.chipOn]}>
                      <Text style={[s.chipTxt, dice === n && { color: "#fff" }]}>{n}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
              <Stepper label={req.attrLabel ? t("fallout.roll.attrOf", { a: req.attrLabel }) : t("fallout.roll.attr")} value={attribute} set={setAttribute} min={0} max={20} />
              <Stepper label={t("fallout.roll.rank")} value={rank} set={setRank} min={0} max={10} />
              <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: tag }} onPress={() => setTag(!tag)} style={s.field}>
                <Text style={s.label}>{t("fallout.roll.tag")}</Text>
                <Text style={s.value}>{tag ? `■ ${t("fallout.roll.yes")}` : `□ ${t("fallout.roll.no")}`}</Text>
              </Pressable>
              <Stepper label={t("fallout.roll.diff")} value={difficulty} set={setDifficulty} min={0} max={5} />
              <Stepper label={t("fallout.roll.comp")} value={complication} set={setComplication} min={1} max={20} />
              <Text style={s.summary}>
                {t("fallout.roll.summary", { d: difficulty, tn: attribute + rank, c: tag ? Math.max(rank, 1) : 1, x: complication })}
              </Text>
            </>
          ) : (
            <>
              <Stepper label={t("fallout.roll.dmgDice")} value={dice} set={setDice} min={1} max={30} />
              <Text style={s.summary}>
                {t("fallout.roll.dmgDefault", { n: req.dice })}
                {req.ammo && req.ammoPerShot > 0
                  ? t("fallout.roll.ammoCost", { per: req.ammoPerShot, ammo: req.ammo, total: dice > req.dice ? t("fallout.roll.ammoTotal", { n: (dice - req.dice) * req.ammoPerShot }) : "" })
                  : t("fallout.roll.noAmmo")}
              </Text>
            </>
          )}
          {mods.length > 0 && (
            <View style={s.mods}>
              <Text style={s.label}>{t("fallout.roll.mods")}{picked.length ? t(picked.length > 1 ? "fallout.roll.markedN" : "fallout.roll.marked1", { n: picked.length }) : ""}</Text>
              {mods.length > 4 && <TextInput value={q} onChangeText={setQ} placeholder={t("fallout.roll.searchPh")} accessibilityLabel={t("fallout.roll.searchLbl")} style={s.search} />}
              <ScrollView style={s.modList} nestedScrollEnabled>
              {mods.filter((m) => !q.trim() || `${m.itemName} ${m.label} ${m.text}`.toLowerCase().includes(q.trim().toLowerCase())).map((m) => {
                const on = picked.includes(m.key), out = m.usesLeft === 0;
                const cost = [m.cost?.ap && `${m.cost.ap} AP`, m.cost?.luck && `${m.cost.luck} ${t("fallout.roll.luck")}`, m.cost?.uses && `${t("fallout.roll.uses", { left: m.usesLeft ?? m.cost.uses.max, max: m.cost.uses.max })}${m.cost.uses.per ? t("fallout.roll.per", { per: m.cost.uses.per }) : ""}`, m.cost?.resource].filter(Boolean).join(" · ");
                return (
                  <Pressable key={m.key} accessibilityRole="checkbox" accessibilityState={{ checked: on, disabled: out }} disabled={out}
                    onPress={() => setPicked(on ? picked.filter((k) => k !== m.key) : [...picked, m.key])} style={[s.mod, out && { opacity: 0.45 }]}>
                    <Text style={s.value}>{on ? "■" : "□"}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={s.label}>{m.itemName}</Text>
                      <Text style={[s.summary, { color: P.ink }]}>{m.label}</Text>
                      <Text style={s.summary}>{m.text}</Text>
                      {!!cost && <Text style={[s.summary, { color: P.ink }]}>{cost}</Text>}
                      {!!m.auto && <Text style={[s.summary, { color: P.ok }]}>{t("fallout.roll.auto", { auto: m.auto })}</Text>}
                    </View>
                  </Pressable>
                );
              })}
              </ScrollView>
              {mods.some((m) => m.usesLeft === 0) && <Pressable accessibilityRole="button" onPress={() => onResetUses().then(() => loadMods(req.kind === "skill" ? { roll: "skill", skillId: req.id } : { roll: req.kind === "weapon" ? "attack" : "damage", itemId: req.id }).then(setMods))}><Text style={s.link}>{t("fallout.roll.renew")}</Text></Pressable>}
            </View>
          )}
          <View style={s.actions}>
            <Pressable accessibilityRole="button" onPress={onClose} style={[s.btn, s.btnLight]}><Text style={[s.btnTxt, { color: P.ink }]}>{t("fallout.common.cancel")}</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={() => onRoll({ ...(d20 ? { dice, attribute, rank, tag, complication, difficulty } : { dice }), mods: picked })} style={[s.btn, { backgroundColor: P.ok }]}>
              <Text style={s.btnTxt}>{t("fallout.roll.go", { n: dice, unit: d20 ? "d20" : " CD" })}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 16 },
  box: { width: "100%", maxWidth: 420, maxHeight: "96%", backgroundColor: P.paper, borderWidth: 3, borderColor: P.ink, padding: 14, gap: 10 },
  head: { backgroundColor: P.ink, padding: 8, marginHorizontal: -14, marginTop: -14, marginBottom: 4 }, headTxt: { color: "#fff", fontWeight: "900", fontSize: 17 },
  field: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: P.line, paddingBottom: 8, gap: 10 },
  label: { color: P.ink, fontWeight: "700", flexShrink: 1 },
  stepper: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, borderColor: P.ink, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  stepTxt: { color: P.ink, fontSize: 22, fontWeight: "900", lineHeight: 24 },
  value: { color: P.ink, fontSize: 20, fontWeight: "900", minWidth: 32, textAlign: "center" },
  chips: { flexDirection: "row", gap: 6 },
  chip: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: P.ink, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  chipOn: { backgroundColor: P.ink }, chipTxt: { color: P.ink, fontWeight: "900" },
  mods: { gap: 6 }, modList: { maxHeight: 230 },
  search: { borderWidth: 1, borderColor: P.ink, backgroundColor: "#fff", paddingHorizontal: 8, paddingVertical: 6, color: P.ink }, mod: { flexDirection: "row", gap: 8, alignItems: "flex-start", borderWidth: 1, borderColor: P.line, padding: 6, backgroundColor: "#fff" },
  dimTxt: { color: P.dim, fontWeight: "400" }, link: { color: P.ok, fontWeight: "700", textDecorationLine: "underline" },
  summary: { color: P.dim, fontSize: 13 },
  actions: { flexDirection: "row", justifyContent: "flex-end", gap: 8, marginTop: 4 },
  btn: { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 4 }, btnLight: { backgroundColor: "#fff", borderWidth: 1, borderColor: P.ink },
  btnTxt: { color: "#fff", fontWeight: "900" }
});
