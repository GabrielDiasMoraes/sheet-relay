// Sheet in the style of the official PDF (Fallout 2d20): light paper, black bars, color-coded seals per attribute.
import { ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Sheet } from "./api";
import { RollRequest } from "./RollDialog";
import { UtilKind } from "./Utils";
import { t } from "../../../shared/i18n";

const P = { paper: "#ecebe7", ink: "#111", line: "#c9c7c0", cell: "#fff", dim: "#6b6b66" };
const ATTR: [string, string, string][] = [
  ["str", "STRENGTH", "#6fa58a"], ["per", "PERCEPTION", "#8a7358"], ["end", "ENDURANCE", "#2fb3c7"], ["cha", "CHARISMA", "#e36a52"],
  ["int", "INTELLIGENCE", "#a9b4a0"], ["agi", "AGILITY", "#e2a39a"], ["luc", "LUCK", "#a89cba"]
];
const SKILL_LABEL: Record<string, string> = { smallGuns: "Small Guns", bigGuns: "Big Guns", energyWeapons: "Energy Weapons", meleeWeapons: "Melee Weapons", unarmed: "Unarmed", throwing: "Throwing", explosives: "Explosives" };
const PART: Record<string, string> = { head: "HEAD (1-2)", armL: "LEFT ARM (9-11)", armR: "RIGHT ARM (12-14)", torso: "TORSO (3-8)", legL: "LEFT LEG (15-17)", legR: "RIGHT LEG (18-20)" };
const ROBOT_PART: Record<string, string> = { head: "OPTICS (1-2)", armL: "ARM 1 (9-11)", armR: "ARM 2 (12-14)", torso: "MAIN BODY (3-8)", legL: "ARM 3 (15-17)", legR: "THRUSTER (18-20)" };
const ORDER = Object.keys(PART); // PDF order; unknown parts (robots) go to the end
const label = (k: string) => k.replace(/_x$/, "").replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");

const Flag = ({ text, color }: { text: string; color: string }) => <View style={[s.flag, { backgroundColor: color }]}><Text style={s.flagText}>{text}</Text></View>;
const Head = ({ cols }: { cols: [string, number?][] }) => <View style={s.thead}>{cols.map(([c, f], i) => <Text key={i} style={[s.th, { flex: f ?? 1 }]}>{c}</Text>)}</View>;
const Cell = ({ children, flex = 1, align }: { children: ReactNode; flex?: number; align?: "center" }) => <Text style={[s.td, { flex, textAlign: align }]}>{children}</Text>;
const Stat = ({ title, value }: { title: string; value: ReactNode }) => (
  <View style={s.stat}><Text style={s.statTitle}>{title}</Text><View style={s.cog}><Text style={s.cogText}>{value ?? "–"}</Text></View></View>
);

export type Edit = {
  luck: (v: number) => void; attr: (key: string, v: number) => void; tag: (skillId: string, tag: boolean) => void;
  caps: (v: number) => void; qty: (itemId: string, q: number) => void;
};
// Small − / + button, used in direct edits (luck, attributes, ammo).
const Step = ({ label, onPress, sign }: { label: string; onPress: () => void; sign: "−" | "+" }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={6} style={s.step}><Text style={s.stepTxt}>{sign}</Text></Pressable>
);
// Numeric field that only saves on blur / Enter (avoids one save per keystroke).
function NumField({ value, onCommit, label }: { value: number | null; onCommit: (n: number) => void; label: string }) {
  const [txt, setTxt] = useState(String(value ?? 0));
  useEffect(() => setTxt(String(value ?? 0)), [value]);
  const commit = () => { const n = parseInt(txt, 10); if (Number.isFinite(n) && n !== value) onCommit(n); else setTxt(String(value ?? 0)); };
  return <TextInput accessibilityLabel={label} style={s.numField} value={txt} onChangeText={setTxt} onBlur={commit} onSubmitEditing={commit} keyboardType="number-pad" selectTextOnFocus />;
}

type Props = {
  sh: Sheet; err: string; onBack: () => void; onHp: (d: number) => void;
  onRoll: (r: RollRequest) => void; onLevelUp: () => void; onAdd: () => void;
  onInjury: (part: string, index: number, value: 0 | 1 | 2) => void;
  onUtil: (u: UtilKind) => void;
  onEdit: Edit;
};
const Act = ({ label, onPress }: { label: string; onPress: () => void }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={s.act}><Text style={s.actText}>{label}</Text></Pressable>
);
// Each area of the sheet sits in a frame with the title in the corner, as in the PDF.
const Panel = ({ title, color, action, children, flex }: { title?: string; color?: string; action?: ReactNode; children: ReactNode; flex?: number }) => (
  <View style={[s.panel, flex ? { flex } : null]}>
    {(title || action) && <View style={s.panelHead}>{title ? <Flag text={title} color={color ?? P.ink} /> : <View />}{action}</View>}
    {children}
  </View>
);
const Table = ({ children }: { children: ReactNode }) => <View style={s.table}>{children}</View>;
const Empty = ({ text }: { text: string }) => <Text style={[s.small, { color: P.dim, padding: 6 }]}>{text}</Text>;

// Body part plate as on Foundry's sheet: name + range, 5 injury marks, resistances and state.
const STATUS = () => ({ healthy: { c: P.ink, t: "" }, wounded: { c: "#c77700", t: t("fallout.sheet.wounded") }, crippled: { c: "#b3261e", t: t("fallout.sheet.crippled") } } as const);
const MARK = () => [{ bg: "#04b814", icon: "", name: t("fallout.sheet.mark0") }, { bg: "#325885", icon: "🩹", name: t("fallout.sheet.mark1") }, { bg: "#325885", icon: "🩸", name: t("fallout.sheet.mark2") }];
const NEXT: Record<number, 0 | 1 | 2> = { 0: 2, 2: 1, 1: 0 }; // no injury → open → treated → no injury
function BodyPart({ part, title, onInjury }: { part: Sheet["body"][number]; title: string; onInjury: (i: number, v: 0 | 1 | 2) => void }) {
  const status = STATUS(), mark = MARK();
  const st = status[part.status] ?? status.healthy;
  return (
    <View style={[s.part, { borderColor: st.c, borderWidth: part.status === "healthy" ? 1 : 2 }]}>
      <View style={[s.partHeadRow, { backgroundColor: st.c }]}>
        <Text style={s.partHead}>{title}</Text>{!!st.t && <Text style={s.partHead}>{st.t}</Text>}
      </View>
      <View style={s.injuryBar}>
        {part.injuries.map((v, i) => (
          <Pressable key={i} accessibilityRole="button" accessibilityLabel={t("fallout.sheet.injuryA11y", { title, n: i + 1, name: mark[v]?.name ?? "" })} onPress={() => onInjury(i, NEXT[v] ?? 0)}
            style={[s.mark, { backgroundColor: mark[v]?.bg ?? mark[0].bg }]}>
            <Text style={s.markIcon}>{mark[v]?.icon}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.resRow}>
        {([["PHYS", part.physical], ["EN", part.energy], ["RAD", part.radiation], ["POI", part.poison]] as const).map(([k, v]) => (
          <View key={k} style={s.res}><Text style={s.resLabel}>{k}</Text><Text style={s.resVal}>{v}</Text></View>
        ))}
      </View>
    </View>
  );
}

export function SheetView({ sh, onHp, err, onBack, onRoll, onLevelUp, onAdd, onInjury, onUtil, onEdit }: Props) {
  const [editAttrs, setEditAttrs] = useState(false);
  const wide = useWindowDimensions().width >= 820;
  const attrs = sh.attributes, hp = sh.hp;
  const skills = [...sh.skills].sort((a, b) => a.name.localeCompare(b.name));
  const pct = hp?.max ? Math.max(0, Math.min(1, hp.value / hp.max)) : 0;
  const weaponActs = (w: Sheet["weapons"][number]) => (
    <>
      {w.roll && <Act label={t("fallout.common.attack")} onPress={() => onRoll({ kind: "weapon", id: w.id, name: w.name, attrLabel: "", base: w.roll! })} />}
      {w.damageDice != null && <Act label={t("fallout.common.damage")} onPress={() => onRoll({ kind: "damage", id: w.id, name: w.name, dice: w.damageDice!, ammo: w.ammo, ammoPerShot: w.ammoPerShot })} />}
    </>
  );
  const Row = ({ children }: { children: ReactNode }) => <View style={[s.twoCols, wide && { flexDirection: "row", alignItems: "flex-start" }]}>{children}</View>;

  const Skills = (
    <Panel title="SKILLS" color="#e8955a" flex={wide ? 1 : undefined}>
      <Text style={s.hint}>{t("fallout.sheet.skillHint")}</Text>
      <Table>
        <Head cols={[["NAME", 3], ["TAG"], ["RANK"], ["TN"]]} />
        {skills.map((k) => (
          <Pressable key={k.name} accessibilityRole="button" accessibilityLabel={t("fallout.sheet.rollSkill", { name: k.name })} style={({ pressed }) => [s.row, pressed && s.rowPressed]} onPress={() => onRoll({ kind: "skill", id: k.id, name: k.name, attrLabel: k.attr?.toUpperCase() ?? "",
              base: { attribute: attrs[k.attr] ?? 0, rank: k.rank, tag: k.tag, complication: sh.complication } })}>
            <Cell flex={3}>{k.name} <Text style={s.attrTag}>[{k.attr?.toUpperCase()}]</Text></Cell>
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: k.tag }} accessibilityLabel={t("fallout.sheet.tagSkill", { name: k.name })}
              onPress={() => onEdit.tag(k.id, !k.tag)} hitSlop={8} style={s.tagCell}>
              <Text style={s.tagBox}>{k.tag ? "■" : "□"}</Text>
            </Pressable>
            <Cell align="center">{k.rank}</Cell>
            <Cell align="center">{(attrs[k.attr] ?? 0) + k.rank}</Cell>
          </Pressable>
        ))}
      </Table>
    </Panel>
  );

  const Combat = (
    <Panel title="COMBAT" color="#7fa08a" flex={wide ? 1 : undefined}>
      <View style={s.statsRow}>
        <Stat title="MELEE DAMAGE" value={sh.meleeDamage} /><Stat title="DEFENSE" value={sh.defense} /><Stat title="INITIATIVE" value={sh.initiative} />
      </View>
      <View style={s.box}>
        <Text style={s.boxHead}>HEALTH</Text>
        <View style={s.hpLine}><Text style={s.hpBig}>{hp?.value ?? "–"}</Text><Text style={s.hpMax}>/ {hp?.max ?? "–"} HP</Text></View>
        <View style={s.bar}><View style={[s.fill, { width: `${pct * 100}%`, backgroundColor: pct < 0.3 ? "#b3261e" : "#00933B" }]} /></View>
        <View style={s.hpBtns}>
          {[-5, -1, 1, 5].map((d) => (
            <Pressable key={d} accessibilityRole="button" accessibilityLabel={d < 0 ? t("fallout.sheet.dmgA11y", { n: -d }) : t("fallout.sheet.healA11y", { n: d })} style={[s.hpBtn, d > 0 && { backgroundColor: "#00933B" }]} onPress={() => onHp(d)}>
              <Text style={s.hpBtnText}>{d > 0 ? `+${d}` : d}</Text>
            </Pressable>
          ))}
        </View>
        {!!err && <Text style={s.err}>{err}</Text>}
      </View>
      <Text style={s.small}>POISON DR: <Text style={s.bold}>{sh.poisonDR}</Text></Text>
      <View style={s.parts}>
        {[...sh.body].sort((a, b) => ORDER.indexOf(a.key) - ORDER.indexOf(b.key)).map((b) => (
          <BodyPart key={b.key} part={b} title={(sh.bodyType === "robot" ? ROBOT_PART : PART)[b.key] ?? label(b.key).toUpperCase()}
            onInjury={(i, v) => onInjury(b.key, i, v)} />
        ))}
      </View>
      <Text style={s.hint}>{t("fallout.sheet.injuryHint")}</Text>
    </Panel>
  );

  const stats: [string, string, string, number | undefined][] = sh.creature
    ? ([["body", "BODY", "#6fa58a"], ["mind", "MIND", "#a9b4a0"], ["melee", "MELEE", "#e36a52"], ["guns", "GUNS", "#8a7358"], ["other", "OTHER", "#a89cba"]] as const)
      .map(([k, n, c]) => [k, n, c, sh.creature![k]])
    : ATTR.map(([k, n, c]) => [k, n, c, attrs[k]]);

  return (
    <View style={s.paper}>
      <Pressable accessibilityRole="button" onPress={onBack}><Text style={s.back}>{t("fallout.common.backArrow")}</Text></Pressable>

      <Panel>
        <View style={[s.top, wide && { flexDirection: "row" }]}>
          <View style={wide && { flex: 1.2 }}>
            <Text style={[s.logo, !wide && { fontSize: 30 }]}>Fallout</Text><Text style={s.logoSub}>THE ROLEPLAYING GAME</Text>
          </View>
          <View style={wide && { flex: 2 }}>
            <View style={s.black}><Text style={s.blackText}>CHARACTER NAME</Text></View><Text style={s.name}>{sh.name}</Text>
            {!sh.creature && (
              <View style={s.luckRow}>
                <Text style={s.luckLabel}>LUCK POINTS</Text>
                <Step sign="−" label={t("fallout.sheet.spendLuck")} onPress={() => onEdit.luck((sh.luck ?? 0) - 1)} />
                <View style={s.luckCog}><Text style={s.cogText}>{sh.luck ?? 0}</Text></View>
                <Step sign="+" label={t("fallout.sheet.gainLuck")} onPress={() => onEdit.luck((sh.luck ?? 0) + 1)} />
                <Text style={s.luckMax}>{t("fallout.sheet.luckMax", { n: attrs.luc ?? "–" })}</Text>
              </View>
            )}
          </View>
          <View style={[s.topRight, wide && { flex: 2.6 }]}>
            <View style={{ flex: 1 }}>
              <Text style={s.line}>XP EARNED <Text style={s.bold}>{sh.level.xp ?? "–"}</Text></Text>
              <Text style={s.line}>XP TO NEXT LEVEL <Text style={s.bold}>{sh.level.next ?? "–"}</Text></Text>
              <Text style={s.line}>ORIGIN <Text style={s.bold}>{sh.origin || "–"}</Text></Text>
            </View>
            <View style={{ alignItems: "center", gap: 6 }}>
              <View style={s.levelCog}><Text style={s.statTitle}>LEVEL</Text><Text style={s.cogText}>{sh.level.value ?? "–"}</Text></View>
              {["character", "robot"].includes(sh.type) && <Act label="LEVEL UP" onPress={onLevelUp} />}
            </View>
          </View>
        </View>
      </Panel>

      <Panel title={sh.creature ? "CREATURE" : "S.P.E.C.I.A.L."} color={P.ink}
        action={!sh.creature && <Act label={editAttrs ? t("fallout.sheet.done") : t("fallout.sheet.edit")} onPress={() => setEditAttrs(!editAttrs)} />}>
        <View style={s.attrs}>
          {stats.map(([k, name, color, v]) => (
            <View key={k} style={s.attr}>
              <View style={[s.attrBar, { backgroundColor: color }]}><Text style={s.attrName}>{name}</Text></View>
              <View style={s.cog}><Text style={s.cogText}>{v ?? "–"}</Text></View>
              {editAttrs && !sh.creature && (
                <View style={s.attrSteps}>
                  <Step sign="−" label={t("fallout.common.decrease", { label: name })} onPress={() => onEdit.attr(k, (v ?? 0) - 1)} />
                  <Step sign="+" label={t("fallout.common.increase", { label: name })} onPress={() => onEdit.attr(k, (v ?? 0) + 1)} />
                </View>
              )}
            </View>
          ))}
        </View>
      </Panel>

      {["character", "robot"].includes(sh.type) && (
        <Panel title={t("fallout.sheet.utils")} color={P.ink}>
          <View style={s.utilRow}>
            <Act label={t("fallout.sheet.ammo")} onPress={() => onUtil("ammo")} />
            {}
            <Act label={t("fallout.sheet.loot")} onPress={() => onUtil("loot")} />
          </View>
        </Panel>
      )}

      <Row>{skills.length > 0 && Skills}{Combat}</Row>

      <Panel title="WEAPONS" color="#e8955a">
        {sh.weapons.length === 0 ? <Empty text={t("fallout.sheet.noWeapons")} /> : wide ? (
          <Table>
            <Head cols={[["", 3], ["NAME", 3], ["SKILL", 2], ["TN"], ["DAMAGE"], ["EFFECTS", 2], ["TYPE"], ["RATE"], ["RANGE"], ["QUALITIES", 2], ["AMMO", 2], ["WGT"]]} />
            {sh.weapons.map((w) => {
              const tn = w.roll ? w.roll.attribute + w.roll.rank : 0;
              return (
                <View key={w.id} style={s.row}>
                  <View style={{ flex: 3, flexDirection: "row", gap: 4 }}>
                    {weaponActs(w)}
                  </View>
                  <Cell flex={3}>{w.name}</Cell><Cell flex={2}>{SKILL_LABEL[w.skill] ?? w.skill}</Cell><Cell>{tn || "–"}</Cell><Cell>{w.damage}</Cell>
                  <Cell flex={2}>{w.effects.map(label).join(", ")}</Cell><Cell>{w.types.join("/")}</Cell><Cell>{w.rate ?? 0}</Cell><Cell>{w.range}</Cell>
                  <Cell flex={2}>{w.qualities.map(label).join(", ")}</Cell><Cell flex={2}>{w.ammo}</Cell><Cell>{w.weight}</Cell>
                </View>
              );
            })}
          </Table>
        ) : sh.weapons.map((w) => {
          const tn = w.roll ? w.roll.attribute + w.roll.rank : 0;
          return (
            <View key={w.id} style={s.card}>
              <View style={s.cardHead}><Text style={s.cardTitle}>{w.name}</Text>
                <View style={{ flexDirection: "row", gap: 4 }}>{weaponActs(w)}</View>
              </View>
              <Text style={s.small}>{t("fallout.sheet.weaponLine", { skill: SKILL_LABEL[w.skill] ?? w.skill, tn: tn || "–", dmg: w.damage, types: w.types.join("/"), range: w.range, rate: w.rate ?? 0 })}</Text>
              {(w.effects.length > 0 || w.qualities.length > 0) && <Text style={s.small}>{[...w.effects, ...w.qualities].map(label).join(", ")}</Text>}
              <Text style={s.small}>{w.ammo ? t("fallout.sheet.ammoPrefix", { ammo: w.ammo }) : ""}{t("fallout.sheet.weight", { w: w.weight })}</Text>
            </View>
          );
        })}
      </Panel>

      <Row>
        <View style={[s.col, { gap: 12 }]}>
          <Panel title="CAPS & AMMO" color="#e8955a">
            <View style={s.capsRow}><Text style={s.statTitle}>CAPS</Text><NumField label="Caps" value={sh.caps} onCommit={onEdit.caps} /></View>
            {sh.ammo.length === 0 ? <Empty text={t("fallout.sheet.noAmmo")} /> : (
              <Table>
                <Head cols={[["CALIBER", 2], ["QUANTITY"]]} />
                {sh.ammo.map((m) => (
                  <View key={m.id} style={[s.row, { alignItems: "center" }]}>
                    <View style={{ flex: 2 }}>
                      <Text style={s.td}>{m.name}</Text>
                      {m.shots && <Text style={s.attrTag}>{t("fallout.sheet.shots", { c: m.shots.current, m: m.shots.max })}</Text>}
                    </View>
                    <View style={s.qtyCell}>
                      <Step sign="−" label={t("fallout.sheet.less", { name: m.name })} onPress={() => onEdit.qty(m.id, Math.max(0, m.quantity - 1))} />
                      <NumField label={t("fallout.sheet.qty", { name: m.name })} value={m.quantity} onCommit={(q) => onEdit.qty(m.id, q)} />
                      <Step sign="+" label={t("fallout.sheet.more", { name: m.name })} onPress={() => onEdit.qty(m.id, m.quantity + 1)} />
                    </View>
                  </View>
                ))}
              </Table>
            )}
          </Panel>
          <Panel title="GEAR" color="#7fa08a" action={<Act label={t("fallout.sheet.add")} onPress={onAdd} />}>
            <Table>
              <Head cols={[["ITEM", 3], ["LBS."]]} />
              {sh.gear.length === 0 ? <Empty text={t("fallout.sheet.noItems")} /> :
                sh.gear.map((g) => <View key={g.id} style={s.row}><Cell flex={3}>{g.quantity > 1 ? `${g.quantity}× ` : ""}{g.name}{g.equipped ? " ✓" : ""}</Cell><Cell>{g.weight}</Cell></View>)}
              <View style={s.blackRow}><Text style={s.blackText}>CURRENT CARRY WEIGHT</Text><Text style={s.blackText}>{sh.carry.value ?? "–"}</Text></View>
              <View style={s.blackRow}><Text style={s.blackText}>MAXIMUM CARRY WEIGHT</Text><Text style={s.blackText}>{sh.carry.total ?? "–"}</Text></View>
            </Table>
          </Panel>
        </View>
        <Panel title="PERKS & TRAITS" color="#2fb3c7" flex={wide ? 2 : undefined} action={<Act label={t("fallout.sheet.add")} onPress={onAdd} />}>
          {sh.perks.length === 0 ? <Empty text={t("fallout.sheet.noPerks")} /> : wide ? (
            <Table>
              <Head cols={[["NAME", 2], ["RANK"], ["EFFECT", 5]]} />
              {sh.perks.map((k) => <View key={k.id} style={s.row}><Cell flex={2}>{k.name}</Cell><Cell align="center">{k.rank ?? "–"}</Cell><Cell flex={5}>{k.effect}</Cell></View>)}
            </Table>
          ) : sh.perks.map((k) => <View key={k.id} style={s.card}><Text style={s.cardTitle}>{k.name}{k.rank ? `  ·  rank ${k.rank}` : ""}</Text><Text style={s.small}>{k.effect}</Text></View>)}
        </Panel>
      </Row>
    </View>
  );
}

const s = StyleSheet.create({
  paper: { backgroundColor: P.paper, padding: 14, paddingBottom: 96, gap: 12, width: "100%", maxWidth: 1100, alignSelf: "center" },
  panel: { borderWidth: 2, borderColor: P.ink, backgroundColor: "#f6f5f1", padding: 10, gap: 8 },
  panelHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: -4 },
  table: { borderWidth: 1, borderColor: P.ink },
  hint: { color: P.dim, fontSize: 11 },
  rowPressed: { backgroundColor: "#fff3c4" },
  topRight: { flexDirection: "row", gap: 10, alignItems: "center" },
  hpLine: { flexDirection: "row", alignItems: "baseline", gap: 6 }, hpBig: { color: P.ink, fontSize: 30, fontWeight: "900" }, hpMax: { color: P.dim, fontSize: 14, fontWeight: "700" },
  bar: { height: 10, backgroundColor: "#d9d7d0", borderRadius: 5, overflow: "hidden" }, fill: { height: 10 },
  back: { color: P.ink, fontWeight: "700", paddingVertical: 4 },
  top: { gap: 10, alignItems: "stretch" },
  logo: { color: P.ink, fontSize: 40, fontWeight: "900", fontStyle: "italic" }, logoSub: { color: P.ink, fontSize: 10, fontWeight: "700", letterSpacing: 1 },
  black: { backgroundColor: P.ink, paddingHorizontal: 8, paddingVertical: 3 }, blackText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  name: { color: P.ink, fontSize: 22, fontWeight: "800", paddingVertical: 4 },
  line: { color: P.ink, fontSize: 13, paddingVertical: 2, borderBottomWidth: 1, borderColor: P.line }, bold: { fontWeight: "800" },
  levelCog: { alignItems: "center", justifyContent: "center", width: 84, height: 84, borderRadius: 42, backgroundColor: P.cell, borderWidth: 2, borderColor: P.ink },
  attrs: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, attr: { flex: 1, minWidth: 72, alignItems: "center", gap: 6 },
  attrBar: { alignSelf: "stretch", paddingVertical: 6, alignItems: "center", borderRadius: 4 }, attrName: { color: "#fff", fontSize: 10, fontWeight: "800" },
  cog: { width: 54, height: 54, borderRadius: 27, backgroundColor: P.cell, borderWidth: 2, borderColor: P.ink, alignItems: "center", justifyContent: "center" },
  cogText: { color: P.ink, fontSize: 20, fontWeight: "900" },
  twoCols: { gap: 12 }, col: { flex: 1, gap: 4 },
  flag: { alignSelf: "flex-start", paddingHorizontal: 12, paddingVertical: 3, borderTopRightRadius: 10 }, flagText: { color: "#fff", fontStyle: "italic", fontWeight: "900", fontSize: 12 },
  thead: { flexDirection: "row", backgroundColor: P.ink, paddingVertical: 3, paddingHorizontal: 4 }, th: { color: "#fff", fontSize: 10, fontWeight: "800" },
  row: { flexDirection: "row", backgroundColor: P.cell, borderBottomWidth: 1, borderColor: P.line, paddingHorizontal: 4, paddingVertical: 3 },
  td: { color: P.ink, fontSize: 12 }, attrTag: { color: P.dim, fontSize: 10 },
  statsRow: { flexDirection: "row", justifyContent: "space-around", gap: 6 }, stat: { alignItems: "center", gap: 4 }, statTitle: { fontSize: 9, fontWeight: "800", color: P.ink },
  box: { backgroundColor: P.cell, borderWidth: 1, borderColor: P.ink, padding: 8, gap: 2 }, boxHead: { backgroundColor: P.ink, color: "#fff", fontWeight: "800", fontSize: 11, paddingHorizontal: 6, marginBottom: 4 },
  hpBtns: { flexDirection: "row", gap: 6, marginTop: 6 }, hpBtn: { backgroundColor: "#b3261e", paddingVertical: 8, paddingHorizontal: 14, borderRadius: 4, minWidth: 48, alignItems: "center" }, hpBtnText: { color: "#fff", fontWeight: "800" },
  err: { color: "#b3261e" }, small: { color: P.ink, fontSize: 11 },
  parts: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, part: { backgroundColor: "#d9dfd8", padding: 6, minWidth: 150, flexGrow: 1, flexBasis: 150, gap: 5 },
  partHeadRow: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4, paddingVertical: 2, marginHorizontal: -6, marginTop: -6 },
  partHead: { color: "#fff", fontWeight: "800", fontSize: 10 },
  injuryBar: { flexDirection: "row", gap: 2 },
  mark: { flex: 1, height: 22, alignItems: "center", justifyContent: "center", borderRadius: 2 }, markIcon: { fontSize: 12 },
  resRow: { flexDirection: "row", gap: 2 },
  res: { flex: 1, backgroundColor: P.cell, borderWidth: 1, borderColor: P.line, alignItems: "center", paddingVertical: 2 },
  resLabel: { fontSize: 8, fontWeight: "800", color: P.dim }, resVal: { fontSize: 13, fontWeight: "900", color: P.ink },
  card: { backgroundColor: P.cell, borderWidth: 1, borderColor: P.ink, padding: 8, gap: 3 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 6, flexWrap: "wrap" },
  cardTitle: { color: P.ink, fontWeight: "800", fontSize: 14 },
  act: { backgroundColor: P.ink, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 3, alignSelf: "center" }, actText: { color: "#fff", fontWeight: "800", fontSize: 11 },
  diceBar: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  die: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: P.ink, alignItems: "center", justifyContent: "center", backgroundColor: P.cell },
  dieOn: { backgroundColor: P.ink }, dieText: { fontWeight: "900", color: P.ink },
  utilRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  luckRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6, flexWrap: "wrap" },
  luckLabel: { color: "#fff", fontWeight: "900", fontSize: 12, backgroundColor: "#6d5f86", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 3 },
  luckCog: { width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: P.ink, backgroundColor: P.cell, alignItems: "center", justifyContent: "center" },
  luckMax: { color: P.dim, fontSize: 11 },
  step: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: P.ink, backgroundColor: P.cell, alignItems: "center", justifyContent: "center" },
  stepTxt: { color: P.ink, fontSize: 17, fontWeight: "900", lineHeight: 19 },
  attrSteps: { flexDirection: "row", gap: 6 },
  tagCell: { flex: 1, alignItems: "center" }, tagBox: { color: P.ink, fontSize: 16 },
  numField: { minWidth: 56, maxWidth: 90, borderWidth: 2, borderColor: P.ink, backgroundColor: P.cell, color: P.ink, fontSize: 16, fontWeight: "900", textAlign: "center", paddingVertical: 4 },
  qtyCell: { flex: 2, flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "flex-end" },
  capsRow: { flexDirection: "row", alignItems: "center", gap: 10 }, blackRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: P.ink, padding: 6 }
});
