// Sheet in the layout of the official D&D 2024 sheet (pt-BR), on two pages.
// Page 1: header (name, background, class, species, subclass, level, AC, HP, hit die, death saves),
// attributes with saving throws and skills, heroic inspiration, initiative/speed/size/passive perception,
// weapons and damage cantrips, class and species features, feats and training.
// Page 2: spellcasting, spell slots, cantrips and spells, appearance, backstory, languages, equipment, attunement and coins.
import { ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import type { Ask } from "./SheetScreen";
import { Sheet } from "./api";
import { abilityLabel, armor, C, coins, conditions, F, sizeName, skillName, sign } from "./theme";
import { t } from "../../../shared/i18n";

type Props = {
  sh: Sheet; onBack: () => void; onAsk: (a: Ask) => void;
  onUpdate: (changes: Record<string, unknown>) => Promise<boolean>; onItem: (itemId: string, field: string, value: unknown) => Promise<boolean>;
};
// skills of each attribute, in sheet order
const BY_ABILITY: Record<string, string[]> = { str: ["ath"], dex: ["acr", "slt", "ste"], con: [], int: ["arc", "his", "inv", "nat", "rel"], wis: ["ani", "ins", "med", "prc", "sur"], cha: ["dec", "itm", "prf", "per"] };

export function SheetView({ sh, onBack, onAsk, onUpdate, onItem }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 980, mid = width >= 640;
  const set = (path: string, v: unknown) => onUpdate({ [path]: v });
  const ab = Object.fromEntries(sh.abilities.map((a) => [a.key, a]));
  const sk = Object.fromEntries(sh.skills.map((x) => [x.key, x]));
  const kinds = (k: string[]) => sh.features.filter((f) => k.includes(f.kind));
  const cantripsWithDamage = sh.spells.filter((x) => x.level === 0 && x.activities.some((a) => a.damage.length));
  const subclass = sh.classes.map((c) => c.subclass).filter(Boolean).join(" / ");
  const conds = sh.conditions.filter((c) => conditions().some(([k]) => k === c));
  const pg = [s.page, { padding: mid ? 22 : 10 }];

  const abilityBlock = (k: string) => {
    const a = ab[k], label = abilityLabel(k);
    return (
      <Box key={k} title={label.toUpperCase()}>
        <View style={s.abilityTop}>
          <Pressable accessibilityRole="button" accessibilityLabel={t("dnd.s.checkOf", { name: label })} onPress={() => onAsk({ kind: "roll", title: t("dnd.s.checkOf", { name: label }), rollKind: "check", key: k })} style={s.modCircle}>
            <Text style={s.modVal}>{sign(a.mod)}</Text>
          </Pressable>
          <View style={{ alignItems: "center" }}>
            <NumIn value={a.value} min={1} max={30} label={t("dnd.v.score", { name: label })} onSave={(v) => set(`system.abilities.${k}.value`, v)} style={s.scoreBox} />
            <Text style={s.tiny}>{t("dnd.v.scoreCap")}</Text>
          </View>
        </View>
        <Text style={s.tiny}>{t("dnd.v.modifier")}</Text>
        <RowRoll prof={a.saveProf ? 1 : 0} value={a.save} label={t("dnd.v.save")} bold onPress={() => onAsk({ kind: "roll", title: t("dnd.s.saveOf", { name: label }), rollKind: "save", key: k })} />
        {BY_ABILITY[k].map((x) => sk[x] && (
          <RowRoll key={x} prof={sk[x].prof} value={sk[x].total} label={skillName(x)!} onPress={() => onAsk({ kind: "roll", title: skillName(x)!, rollKind: "skill", key: x })} />
        ))}
      </Box>
    );
  };

  return (
    <View style={[s.desk, { padding: mid ? 18 : 6 }]}>
      <View style={s.bar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={s.barBtn}><Text style={s.barTxt}>{t("dnd.sheets")}</Text></Pressable>
        <View style={s.barRight}>
          <Pressable accessibilityRole="button" onPress={() => onAsk({ kind: "rest" })} style={s.barBtn}><Text style={s.barTxt}>{t("dnd.rest")}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onAsk({ kind: "conditions" })} style={s.barBtn}><Text style={s.barTxt}>{t("dnd.conditions")}{conds.length ? ` (${conds.length})` : ""}</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => onAsk({ kind: "levelup" })} style={[s.barBtn, { backgroundColor: C.red, borderColor: C.red }]}><Text style={s.barTxt}>{t("dnd.v.levelUp")}</Text></Pressable>
        </View>
      </View>
      {conds.length > 0 && <Text style={s.condLine}>{t("dnd.v.condLine", { list: conds.map((c) => conditions().find(([k]) => k === c)?.[1]).join(", ") })}{sh.exhaustion ? t("dnd.v.exhaust", { n: sh.exhaustion }) : ""}</Text>}

      {/* ================= Page 1 ================= */}
      <View style={pg}>
        <View style={s.row}>
          <Box style={{ flexGrow: 3, flexBasis: mid ? 320 : "100%" }}>
            <Inp value={sh.name} label={t("dnd.v.charName")} big onSave={(v) => v.trim() && set("name", v.trim())} />
            <Text style={s.tiny}>{t("dnd.v.charNameCap")}</Text>
            <View style={s.grid2}>
              <Labeled label={t("dnd.v.background")} value={sh.background} /><Labeled label={t("dnd.v.class")} value={sh.classes.map((c) => `${c.name} ${c.level}`).join(" / ")} />
              <Labeled label={t("dnd.v.species")} value={sh.species} /><Labeled label={t("dnd.v.subclass")} value={subclass} />
            </View>
          </Box>
          <View style={s.levelBox}>
            <Text style={s.levelNum}>{sh.level}</Text><Text style={s.tiny}>{t("dnd.v.level")}</Text>
            <NumIn value={sh.xp.value} min={0} max={999999} label={t("dnd.v.xpLabel")} onSave={(v) => set("system.details.xp.value", v)} style={s.xpBox} />
            <Text style={s.tiny}>{t("dnd.v.xp")}{sh.xp.max ? ` / ${sh.xp.max}` : ""}</Text>
          </View>
          <View style={s.shield}><Text style={s.tinyCenter}>{t("dnd.v.ac")}</Text><Text style={s.acVal}>{sh.ac}</Text></View>
          <Box title={t("dnd.v.hp")} style={{ flexGrow: 2, flexBasis: mid ? 230 : "100%" }}>
            <View style={[s.row, { gap: 10, alignItems: "flex-end" }]}>
              <Pressable accessibilityRole="button" accessibilityLabel={t("dnd.v.hpA11y")} onPress={() => onAsk({ kind: "hp" })} style={s.hpNow}>
                <Text style={[s.hpVal, sh.hp.value === 0 && { color: C.red }]}>{sh.hp.value}</Text><Text style={s.tiny}>{t("dnd.v.current")}</Text>
              </Pressable>
              <View style={{ gap: 4 }}>
                <NumIn value={sh.hp.temp} min={0} max={999} label={t("dnd.v.tempA11y")} onSave={(v) => set("system.attributes.hp.temp", v)} style={s.smallBox} /><Text style={s.tiny}>{t("dnd.v.temp")}</Text>
                <View style={s.smallBox}><Text style={s.boxNum}>{sh.hp.max}</Text></View><Text style={s.tiny}>{t("dnd.v.max")}</Text>
              </View>
            </View>
          </Box>
          <Box title={t("dnd.v.hd")} style={{ flexBasis: 120, flexGrow: 1 }}>
            <Pressable accessibilityRole="button" onPress={() => onAsk({ kind: "rest" })} style={{ gap: 4, alignItems: "center" }}>
              <View style={s.smallBox}><Text style={s.boxNum}>{sh.hd.max - sh.hd.value}</Text></View><Text style={s.tiny}>{t("dnd.v.spent")}</Text>
              <View style={s.smallBox}><Text style={s.boxNum}>{sh.hd.max}</Text></View><Text style={s.tiny}>{t("dnd.v.maxHd", { d: sh.classes.map((c) => c.hd.denomination).join("/") })}</Text>
            </Pressable>
          </Box>
          <Box title={t("dnd.v.death")} style={{ flexBasis: 150, flexGrow: 1 }}>
            <Diamonds n={3} value={sh.death.success} label={t("dnd.v.successes")} color={C.good} onChange={(v) => set("system.attributes.death.success", v)} />
            <Diamonds n={3} value={sh.death.failure} label={t("dnd.v.failures")} color={C.red} onChange={(v) => set("system.attributes.death.failure", v)} />
            <Pressable accessibilityRole="button" onPress={() => onAsk({ kind: "roll", title: t("dnd.s.deathSave"), rollKind: "death" })}><Text style={s.link}>{t("dnd.v.rollSave")}</Text></Pressable>
          </Box>
        </View>

        <View style={s.logoRow}><View style={s.logoLine} /><Text style={s.logo}>DUNGEONS & DRAGONS</Text><View style={s.logoLine} /></View>

        <View style={[s.row, { alignItems: "flex-start" }]}>
          <View style={{ flexBasis: wide ? 360 : "100%", flexGrow: wide ? 0 : 1, gap: 10 }}>
            <Box title={t("dnd.v.prof")}><Text style={[s.bigNum, { textAlign: "center" }]}>{sign(sh.prof)}</Text></Box>
            <View style={s.row}>
              <View style={s.abCol}>{["str", "dex", "con"].map(abilityBlock)}
                <Box title={t("dnd.v.inspiration")}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: sh.inspiration }} onPress={() => set("system.attributes.inspiration", !sh.inspiration)} style={{ alignItems: "center", padding: 6 }}>
                    <View style={[s.diaBig, sh.inspiration && { backgroundColor: C.gold, borderColor: "#8a6a10" }]} />
                  </Pressable>
                </Box>
              </View>
              <View style={s.abCol}>{["int", "wis", "cha"].map(abilityBlock)}</View>
            </View>
          </View>

          <View style={{ flex: 1, minWidth: mid ? 320 : "100%", gap: 10 }}>
            <View style={s.row}>
              <Stat title={t("dnd.v.initCap")} value={sign(sh.init)} onPress={() => onAsk({ kind: "roll", title: t("dnd.initiative"), rollKind: "init" })} />
              <Stat title={t("dnd.v.speed")} value={`${sh.speed.walk}`} sub={sh.speed.units === "ft" ? t("dnd.v.feet") : sh.speed.units} />
              <Stat title={t("dnd.v.size")} value={sizeName(sh.size) || "—"} small />
              <Stat title={t("dnd.v.passive")} value={String(sk.prc?.passive ?? 10)} />
            </View>
            <Box title={t("dnd.v.weapons")}>
              <View style={s.tHead}><Text style={[s.th, { flex: 3 }]}>{t("dnd.v.th.name")}</Text><Text style={[s.th, { flex: 1.3 }]}>{t("dnd.v.th.bonus")}</Text><Text style={[s.th, { flex: 3 }]}>{t("dnd.v.th.dmg")}</Text></View>
              {[...sh.attacks.map((a) => ({ id: a.id, name: a.name, acts: a.activities })), ...cantripsWithDamage.map((c) => ({ id: c.id, name: c.name, acts: c.activities }))].map((r) => {
                const a = r.acts.find((x) => x.toHit || x.save) ?? r.acts[0];
                return (
                  <Pressable key={r.id} accessibilityRole="button" accessibilityLabel={t("dnd.v.attackWith", { name: r.name })} onPress={() => onAsk({ kind: "item", itemId: r.id })} style={s.tRow}>
                    <Text style={[s.td, { flex: 3, fontWeight: "700" }]} numberOfLines={1}>{r.name}</Text>
                    <Text style={[s.td, { flex: 1.3 }]}>{a?.toHit ?? (a?.save ? t("dnd.dc", { n: a.save.dc }) : "—")}</Text>
                    <Text style={[s.td, { flex: 3 }]} numberOfLines={2}>{a?.damage.join(", ") || "—"}</Text>
                  </Pressable>
                );
              })}
              {!sh.attacks.length && !cantripsWithDamage.length && <Text style={s.hint}>{t("dnd.v.noWeapons")}</Text>}
            </Box>
            <Box title={t("dnd.v.classFeat")}><FeatureList list={kinds(["class", "subclass"])} onAsk={onAsk} /></Box>
            <View style={s.row}>
              <Box title={t("dnd.v.raceFeat")} style={{ flex: 1, minWidth: 220 }}><FeatureList list={kinds(["race"])} onAsk={onAsk} /></Box>
              <Box title={t("dnd.v.feats")} style={{ flex: 1, minWidth: 220 }}><FeatureList list={sh.features.filter((f) => !["class", "subclass", "race"].includes(f.kind))} onAsk={onAsk} /></Box>
            </View>
          </View>
        </View>

        <Box title={t("dnd.v.equipTrain")}>
          <View style={[s.row, { gap: 12, alignItems: "center" }]}>
            <Text style={s.tinyBold}>{t("dnd.v.armorTrain")}</Text>
            {armor().map(([k, l]) => <View key={k} style={s.checkRow}><View style={[s.dia, sh.traits.armor.includes(k) && { backgroundColor: C.ink }]} /><Text style={s.small}>{l}</Text></View>)}
          </View>
          <Text style={s.tinyBold}>{t("dnd.v.weaponsCap")}</Text><Text style={s.small}>{sh.traits.weapons.map((w) => (w === "sim" || w === "mar" ? t(`dnd.weapon.${w}`) : w)).join(", ") || "—"}</Text>
          <Text style={s.tinyBold}>{t("dnd.v.tools")}</Text><Text style={s.small}>{sh.traits.tools.join(", ") || "—"}</Text>
        </Box>
      </View>

      {/* ================= Page 2 ================= */}
      <View style={pg}>
        <View style={[s.row, { alignItems: "flex-start" }]}>
          <View style={{ flex: 2, minWidth: mid ? 360 : "100%", gap: 10 }}>
            <View style={s.row}>
              <Box title={t("dnd.v.spellcasting")} style={{ flexBasis: 220, flexGrow: 1 }}>
                <Labeled label={t("dnd.v.castAbility")} value={sh.spellcasting ? abilityLabel(sh.spellcasting.ability) : "—"} />
                <View style={s.row}>
                  <Stat title={t("dnd.v.modifier")} value={sh.spellcasting ? sign(ab[sh.spellcasting.ability]?.mod ?? 0) : "—"} small />
                  <Stat title={t("dnd.v.dcCap")} value={sh.spellcasting?.dc != null ? String(sh.spellcasting.dc) : "—"} small />
                  <Stat title={t("dnd.v.atkCap")} value={sh.spellcasting?.attack != null ? sign(sh.spellcasting.attack) : "—"} small />
                </View>
              </Box>
              <Box title={t("dnd.v.slots")} style={{ flexBasis: 260, flexGrow: 2 }}>
                {sh.slots.length === 0 && <Text style={s.hint}>{t("dnd.v.noSlots")}</Text>}
                {sh.slots.map((x) => (
                  <View key={x.key} style={s.slotRow}>
                    <Text style={[s.small, { width: 72 }]}>{t(x.key === "pact" ? "dnd.pact" : "dnd.levelCap", { n: x.level })}</Text>
                    <View style={s.slotTotal}><Text style={s.small}>{x.max}</Text></View>
                    <Diamonds n={x.max} value={x.max - x.value} label={t("dnd.v.spentLevel", { n: x.level })} onChange={(v) => set(`system.spells.${x.key}.value`, x.max - v)} />
                  </View>
                ))}
              </Box>
            </View>
            <Box title={t("dnd.v.spells")}>
              <View style={s.tHead}><Text style={[s.th, { width: 34 }]}>{t("dnd.v.th.lvl")}</Text><Text style={[s.th, { flex: 3 }]}>{t("dnd.v.th.name")}</Text><Text style={[s.th, { flex: 1.4 }]}>{t("dnd.v.th.time")}</Text><Text style={[s.th, { flex: 1.2 }]}>{t("dnd.v.th.range")}</Text><Text style={[s.th, { width: 64 }]}>{t("dnd.v.th.crm")}</Text><Text style={[s.th, { width: 44 }]}>{t("dnd.v.th.prep")}</Text></View>
              {sh.spells.map((x) => (
                <View key={x.id} style={s.tRow}>
                  <Text style={[s.td, { width: 34, textAlign: "center" }]}>{x.level}</Text>
                  <Pressable style={{ flex: 3 }} accessibilityRole="button" accessibilityLabel={t("dnd.v.open", { name: x.name })} onPress={() => onAsk({ kind: "item", itemId: x.id })}><Text style={[s.td, { fontWeight: "700" }]} numberOfLines={1}>{x.name}</Text></Pressable>
                  <Text style={[s.td, { flex: 1.4 }]} numberOfLines={1}>{x.activation}</Text>
                  <Text style={[s.td, { flex: 1.2 }]} numberOfLines={1}>{x.range}</Text>
                  <Text style={[s.td, { width: 64 }]}>{[x.concentration && "C", x.ritual && "R", x.components.includes("M") && "M"].filter(Boolean).join(" ") || "·"}</Text>
                  <Pressable style={{ width: 44, alignItems: "center" }} accessibilityRole="checkbox" accessibilityState={{ checked: x.prepared > 0, disabled: x.level === 0 || x.prepared === 2 }} accessibilityLabel={t("dnd.v.prepare", { name: x.name })}
                    disabled={x.level === 0 || x.prepared === 2} onPress={() => onItem(x.id, "prepared", !(x.prepared > 0))}>
                    <View style={[s.dia, (x.prepared > 0 || x.level === 0) && { backgroundColor: x.prepared === 2 || x.level === 0 ? C.stone : C.ink }]} />
                  </Pressable>
                </View>
              ))}
              <Pressable accessibilityRole="button" onPress={() => onAsk({ kind: "add", itemType: "spell" })}><Text style={s.link}>{t("dnd.v.addSpell")}</Text></Pressable>
              <Text style={s.hint}>{t("dnd.v.spellHint")}</Text>
            </Box>
          </View>

          <View style={{ flex: 1, minWidth: mid ? 280 : "100%", gap: 10 }}>
            <Box title={t("dnd.v.appearance")}><Inp value={sh.bio.appearance} label={t("dnd.v.appearanceA11y")} multiline onSave={(v) => set("system.details.appearance", v)} /></Box>
            <Box title={t("dnd.v.story")}>
              <Inp value={sh.bio.biography} label={t("dnd.v.storyA11y")} multiline tall onSave={(v) => set("system.details.biography.value", v)} />
              <Text style={s.tinyBold}>{t("dnd.v.alignment")}</Text>
              <Inp value={sh.alignment} label={t("dnd.v.alignmentA11y")} onSave={(v) => set("system.details.alignment", v)} />
            </Box>
            <Box title={t("dnd.v.languages")}><Text style={s.small}>{sh.languages.join(", ") || "—"}</Text></Box>
            <Box title={t("dnd.v.equipment")}>
              {sh.gear.map((g) => (
                <View key={g.id} style={s.gearRow}>
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: g.equipped }} accessibilityLabel={t("dnd.v.equip", { name: g.name })} onPress={() => onItem(g.id, "equipped", !g.equipped)} hitSlop={6}>
                    <View style={[s.dia, g.equipped && { backgroundColor: C.ink }]} />
                  </Pressable>
                  <Pressable style={{ flex: 1 }} accessibilityRole="button" onPress={() => onAsk({ kind: "item", itemId: g.id })}><Text style={s.small} numberOfLines={1}>{g.name}{g.uses ? ` (${g.uses.value}/${g.uses.max})` : ""}</Text></Pressable>
                  <Pressable accessibilityLabel={t("dnd.v.less", { name: g.name })} onPress={() => g.quantity > 0 && onItem(g.id, "quantity", g.quantity - 1)} style={s.qtyBtn}><Text style={s.qtyT}>−</Text></Pressable>
                  <Text style={s.qty}>{g.quantity}</Text>
                  <Pressable accessibilityLabel={t("dnd.v.more", { name: g.name })} onPress={() => onItem(g.id, "quantity", g.quantity + 1)} style={s.qtyBtn}><Text style={s.qtyT}>+</Text></Pressable>
                </View>
              ))}
              <Pressable accessibilityRole="button" onPress={() => onAsk({ kind: "add", itemType: "gear" })}><Text style={s.link}>{t("dnd.v.addItem")}</Text></Pressable>
              <Text style={s.hint}>{t("dnd.v.gearHint", { v: Math.round(sh.encumbrance.value), max: Math.round(sh.encumbrance.max) })}</Text>
              <Text style={s.tinyBold}>{t("dnd.v.attune")}</Text>
              {sh.gear.filter((g) => g.attunement).map((g) => (
                <Pressable key={g.id} accessibilityRole="checkbox" accessibilityState={{ checked: g.attuned }} onPress={() => onItem(g.id, "attuned", !g.attuned)} style={s.checkRow}>
                  <View style={[s.dia, g.attuned && { backgroundColor: C.ink }]} /><Text style={s.small}>{g.name}</Text>
                </Pressable>
              ))}
              {!sh.gear.some((g) => g.attunement) && <Text style={s.hint}>{t("dnd.v.noAttune")}</Text>}
            </Box>
            <Box title={t("dnd.v.coins")}>
              <View style={s.coins}>
                {coins().map(([k, l]) => (
                  <View key={k} style={{ alignItems: "center", gap: 2 }}>
                    <Text style={s.tinyBold}>{l}</Text>
                    <NumIn value={sh.currency[k] ?? 0} min={0} max={9999999} label={t("dnd.v.coinsA11y", { l })} onSave={(v) => set(`system.currency.${k}`, v)} style={s.coinBox} />
                  </View>
                ))}
              </View>
            </Box>
          </View>
        </View>
      </View>
    </View>
  );
}

// ---------- Pieces ----------
function Box({ title, children, style }: { title?: string; children: ReactNode; style?: object }) {
  return (
    <View style={[s.box, style]}>
      {!!title && <><Text style={s.boxTitle}>{title}</Text><View style={s.boxRule} /></>}
      {children}
    </View>
  );
}
const Labeled = ({ label, value }: { label: string; value: string }) => (
  <View style={{ flexBasis: "46%", flexGrow: 1 }}><Text style={s.field} numberOfLines={1}>{value || "—"}</Text><Text style={s.tiny}>{label}</Text></View>
);
function Stat({ title, value, sub, onPress, small }: { title: string; value: string; sub?: string; onPress?: () => void; small?: boolean }) {
  const body = <><Text style={s.statTitle}>{title}</Text><View style={s.statBox}><Text style={[s.statVal, small && { fontSize: 16 }]} numberOfLines={1}>{value}</Text></View>{!!sub && <Text style={s.tiny}>{sub}</Text>}</>;
  return onPress
    ? <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={s.stat}>{body}</Pressable>
    : <View style={s.stat}>{body}</View>;
}
// Saving throw/skill row: proficiency dot (half, full, expertise), value and name; tap to roll.
function RowRoll({ prof, value, label, onPress, bold }: { prof: number; value: number; label: string; onPress: () => void; bold?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t("dnd.v.rollLabel", { label })} onPress={onPress} style={({ pressed }) => [s.rollRow, pressed && { backgroundColor: "#e7e3dc" }]}>
      <View style={[s.profDot, prof >= 1 && { backgroundColor: C.ink }, prof === 0.5 && { backgroundColor: C.stone }]}>{prof >= 2 && <View style={s.profInner} />}</View>
      <View style={s.rollVal}><Text style={s.rollValT}>{sign(value)}</Text></View>
      <Text style={[s.small, bold && { fontWeight: "800" }]}>{label}</Text>
    </Pressable>
  );
}
function FeatureList({ list, onAsk }: { list: Sheet["features"]; onAsk: (a: Ask) => void }) {
  if (!list.length) return <Text style={s.hint}>—</Text>;
  return <>{list.map((f) => (
    <Pressable key={f.id} accessibilityRole="button" onPress={() => onAsk(f.activities.length || f.special ? { kind: "item", itemId: f.id } : { kind: "info", title: f.name, text: f.description })} style={s.featRow}>
      <Text style={s.small}><Text style={{ fontWeight: "800" }}>{f.name}</Text>{f.uses ? `  (${f.uses.value}/${f.uses.max})` : ""}{f.activities.length || f.special ? "  ▸" : ""}</Text>
    </Pressable>
  ))}</>;
}
function Diamonds({ n, value, onChange, label, color = C.ink }: { n: number; value: number; onChange: (v: number) => void; label: string; color?: string }) {
  return (
    <View style={s.checkRow}>
      {Array.from({ length: n }, (_, i) => (
        <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: i < value }} accessibilityLabel={`${label} ${i + 1}`} hitSlop={5} onPress={() => onChange(value === i + 1 ? i : i + 1)}>
          <View style={[s.dia, i < value && { backgroundColor: color, borderColor: color }]} />
        </Pressable>
      ))}
      <Text style={s.tiny}>{label.toUpperCase()}</Text>
    </View>
  );
}
function Inp({ value, label, multiline, tall, big, onSave }: { value: string; label: string; multiline?: boolean; tall?: boolean; big?: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <TextInput value={v} onChangeText={setV} onBlur={() => v !== value && onSave(v)} multiline={multiline} accessibilityLabel={label} placeholder="…" placeholderTextColor={C.stone}
      style={[s.inp, multiline && { minHeight: tall ? 150 : 80, textAlignVertical: "top" }, big && { fontFamily: F.title, fontSize: 22, fontWeight: "700" }, { outlineStyle: "none" } as object]} />
  );
}
function NumIn({ value, min, max, label, onSave, style }: { value: number; min: number; max: number; label: string; onSave: (v: number) => void; style?: object }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  const commit = () => { const n = parseInt(v, 10); if (Number.isInteger(n) && n >= min && n <= max && n !== value) onSave(n); else setV(String(value)); };
  return <TextInput value={v} onChangeText={setV} onBlur={commit} onSubmitEditing={commit} keyboardType="numeric" accessibilityLabel={label} selectTextOnFocus
    style={[s.numIn, style, { outlineStyle: "none" } as object]} />;
}

const frame = { borderWidth: 2, borderColor: C.stoneDark, borderRadius: 8, backgroundColor: C.panel, boxShadow: `inset 0 0 0 3px ${C.page}, inset 0 0 0 4px ${C.stone}` } as object;
const s = StyleSheet.create({
  desk: { gap: 14, maxWidth: 1240, width: "100%", alignSelf: "center" },
  page: { backgroundColor: C.page, gap: 12, borderRadius: 3, boxShadow: "0 4px 22px rgba(0,0,0,.55)" } as object,
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" },
  barRight: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  barBtn: { borderWidth: 1.5, borderColor: "#d9c7a4", borderRadius: 4, paddingVertical: 6, paddingHorizontal: 10 },
  barTxt: { fontFamily: F.title, fontSize: 13.5, color: "#f3e6cc", fontWeight: "700" },
  condLine: { fontFamily: F.body, color: "#f3c9a4", fontSize: 14, fontWeight: "700" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  grid2: { flexDirection: "row", flexWrap: "wrap", columnGap: 12, rowGap: 4, marginTop: 4 },
  box: { ...frame, padding: 10, gap: 5 },
  boxTitle: { fontFamily: F.title, fontSize: 12.5, fontWeight: "700", color: C.ink, textAlign: "center", letterSpacing: 0.5 },
  boxRule: { height: 1.5, backgroundColor: C.stoneDark, marginBottom: 2 },
  tiny: { fontFamily: F.body, fontSize: 10, color: C.soft, letterSpacing: 1 },
  tinyCenter: { fontFamily: F.title, fontSize: 10, color: C.ink, fontWeight: "700", textAlign: "center" },
  tinyBold: { fontFamily: F.title, fontSize: 10.5, color: C.ink, fontWeight: "700", letterSpacing: 0.5 },
  field: { fontFamily: F.body, fontSize: 15, color: C.ink, fontWeight: "700", borderBottomWidth: 1, borderColor: C.stone, paddingBottom: 2 },
  small: { fontFamily: F.body, fontSize: 14, color: C.ink, lineHeight: 19 },
  hint: { fontFamily: F.body, fontSize: 12.5, color: C.soft, fontStyle: "italic" },
  link: { fontFamily: F.title, fontSize: 12.5, color: C.red, fontWeight: "700", marginTop: 4 },
  levelBox: { ...frame, width: 104, alignItems: "center", justifyContent: "center", padding: 8, borderRadius: 52, gap: 2 },
  levelNum: { fontFamily: F.title, fontSize: 30, fontWeight: "700", color: C.ink, lineHeight: 34 },
  xpBox: { width: 76, height: 26, fontSize: 13 },
  shield: { width: 96, minHeight: 116, borderWidth: 2.5, borderColor: C.stoneDark, backgroundColor: C.panel, borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: 48, borderBottomRightRadius: 48, alignItems: "center", paddingTop: 8, gap: 4 },
  acVal: { fontFamily: F.title, fontSize: 32, fontWeight: "700", color: C.ink },
  hpNow: { flex: 1, minWidth: 90, height: 78, borderWidth: 1.5, borderColor: C.stoneDark, borderRadius: 4, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  hpVal: { fontFamily: F.title, fontSize: 34, fontWeight: "700", color: C.ink, lineHeight: 38 },
  smallBox: { width: 64, height: 28, borderWidth: 1.5, borderColor: C.stoneDark, borderRadius: 3, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  boxNum: { fontFamily: F.body, fontSize: 16, fontWeight: "800", color: C.ink },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logoLine: { flex: 1, height: 3, backgroundColor: C.stone, borderRadius: 2 },
  logo: { fontFamily: F.title, fontSize: 18, fontWeight: "700", color: C.ink, letterSpacing: 1 },
  bigNum: { fontFamily: F.title, fontSize: 26, fontWeight: "700", color: C.ink },
  abCol: { flex: 1, minWidth: 160, gap: 10 },
  abilityTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  modCircle: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, borderColor: C.stoneDark, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  modVal: { fontFamily: F.title, fontSize: 24, fontWeight: "700", color: C.ink },
  scoreBox: { width: 46, height: 30, fontSize: 16, fontWeight: "800" },
  rollRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3, borderRadius: 3 },
  profDot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5, borderColor: C.ink, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  profInner: { width: 5, height: 5, borderRadius: 3, backgroundColor: "#fff" },
  rollVal: { width: 30, height: 20, borderWidth: 1, borderColor: C.stoneDark, borderRadius: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  rollValT: { fontFamily: F.body, fontSize: 13, fontWeight: "800", color: C.ink },
  diaBig: { width: 26, height: 26, transform: [{ rotate: "45deg" }], borderWidth: 2.5, borderColor: C.stoneDark, backgroundColor: "#fff" },
  stat: { ...frame, flex: 1, minWidth: 92, padding: 6, alignItems: "center", gap: 3 },
  statTitle: { fontFamily: F.title, fontSize: 10.5, fontWeight: "700", color: C.ink, textAlign: "center" },
  statBox: { minWidth: 52, height: 34, borderWidth: 1.5, borderColor: C.stoneDark, borderRadius: 3, alignItems: "center", justifyContent: "center", paddingHorizontal: 6, backgroundColor: "#fff" },
  statVal: { fontFamily: F.title, fontSize: 20, fontWeight: "700", color: C.ink },
  tHead: { flexDirection: "row", gap: 6, borderBottomWidth: 1, borderColor: C.stone, paddingBottom: 2 },
  th: { fontFamily: F.body, fontSize: 11.5, color: C.soft, fontWeight: "700", textDecorationLine: "underline" },
  tRow: { flexDirection: "row", gap: 6, alignItems: "center", paddingVertical: 5, borderBottomWidth: 1, borderColor: "#e3e0da" },
  td: { fontFamily: F.body, fontSize: 13.5, color: C.ink },
  featRow: { paddingVertical: 3, borderBottomWidth: 1, borderColor: "#e3e0da" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  dia: { width: 13, height: 13, transform: [{ rotate: "45deg" }], borderWidth: 1.5, borderColor: C.ink, backgroundColor: "#fff", margin: 2 },
  slotRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  slotTotal: { width: 28, height: 22, borderWidth: 1.5, borderColor: C.stoneDark, borderRadius: 2, alignItems: "center", justifyContent: "center", backgroundColor: "#fff" },
  inp: { fontFamily: F.body, fontSize: 15, color: C.ink, paddingVertical: 4, backgroundColor: "transparent" },
  numIn: { fontFamily: F.body, fontSize: 15, fontWeight: "700", color: C.ink, borderWidth: 1.5, borderColor: C.stoneDark, borderRadius: 3, textAlign: "center", backgroundColor: "#fff", padding: 2 },
  gearRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 3, borderBottomWidth: 1, borderColor: "#e3e0da" },
  qtyBtn: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, borderColor: C.stoneDark, alignItems: "center", justifyContent: "center" },
  qtyT: { fontSize: 14, fontWeight: "800", color: C.ink, lineHeight: 16 },
  qty: { fontFamily: F.body, fontSize: 14, fontWeight: "800", width: 26, textAlign: "center", color: C.ink },
  coins: { flexDirection: "row", gap: 6, justifyContent: "space-between", flexWrap: "wrap" },
  coinBox: { width: 58, height: 34 },
});
