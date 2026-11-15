// Sheet in the official PDF layout, on two pages.
// Page 1: playbook, origin, demeanor, fighting style, name, training, logo and status; box with stats,
// fatigue, balance (principle banners) and conditions; playbook resource and moves.
// Page 2: your character, moment of balance, clearing conditions, growth and combat techniques.
// As on paper: fields are directly editable (save on blur) and the boxes toggle with a tap.
import { ReactNode, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { t } from "../../../shared/i18n";
import type { Popup, RollReq } from "./SheetScreen";
import { Move, Sheet, Technique, TextItem } from "./api";
import { APPROACH, BACKGROUNDS, C, F, STATS, TRAINING, opts, sign, statLabel } from "./theme";

type Props = {
  sh: Sheet; onBack: () => void; onRoll: (r: RollReq) => void; onPopup: (p: Popup) => void;
  onUpdate: (changes: Record<string, unknown>) => Promise<boolean>; // true if it saved
  onItem: (itemId: string, field: string, value: boolean) => void;
  onMark: (itemId: string, index: number) => void; onLevelUp: () => void;
};
const norm = (tc: string) => tc.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function SheetView({ sh, onBack, onRoll, onPopup, onUpdate, onItem, onMark, onLevelUp }: Props) {
  const { width } = useWindowDimensions();
  const wide = width >= 900, mid = width >= 620;
  const set = (path: string, v: unknown) => onUpdate({ [path]: v });
  const col = (n: number) => (wide ? { flex: n, minWidth: 0 } : mid ? { flexBasis: "46%", flexGrow: 1 } : { width: "100%" }) as object;
  const editText = (tc: TextItem) => onPopup({ title: tc.name, edit: tc.description, itemId: tc.id });
  const bgs = opts("background", BACKGROUNDS);
  const pageStyle = [s.page, { padding: mid ? 28 : 14 }];

  return (
    <View style={[s.desk, { padding: mid ? 20 : 6 }]}>
      <View style={s.bar}>
        <Pressable accessibilityRole="button" onPress={onBack} style={s.barBtn}><Text style={s.barTxt}>{t("legends.view.sheets")}</Text></Pressable>
        <Text style={s.barHint}>{t("legends.view.barHint")}</Text>
      </View>

      {/* ================= Folha 1 ================= */}
      <View style={pageStyle}>
        <View style={s.row}>
          <View style={[col(3), { gap: 6 }]}>
            <Text style={s.playbook} numberOfLines={2}>{(sh.playbook || t("legends.view.noPlaybook")).toUpperCase()}</Text>
            <Text style={s.h3}>{t("legends.view.background")}</Text>
            <View style={s.bgGrid}>
              {bgs.map((b) => {
                const on = norm(sh.background) === norm(b);
                return <Check key={b} label={b} on={on} small onPress={() => set("system.background", on ? "" : b)} style={{ width: "33%" }} />;
              })}
              {!!sh.background && !bgs.some((b) => norm(b) === norm(sh.background)) && <Check label={sh.background} on small onPress={() => set("system.background", "")} />}
            </View>
            <Text style={s.h3}>{t("legends.view.demeanor")}</Text>
            <Framed><Inp value={sh.demeanor} label={t("legends.view.demeanor")} onSave={(v) => set("system.demeanor", v)} /></Framed>
            <Framed label={t("legends.view.fightingStyleLabel")}><Inp value={sh.fightingStyle} label={t("legends.view.fightingStyle")} onSave={(v) => set("system.fighting_style", v)} /></Framed>
          </View>

          <View style={[col(4), { gap: 8, alignItems: "stretch" }]}>
            <Framed label={t("legends.view.nameLabel")}><Inp value={sh.name} label={t("legends.view.name")} big onSave={(v) => v.trim() && set("name", v.trim())} /></Framed>
            <Text style={[s.h2, s.center]}>{t("legends.view.yourTraining")}</Text>
            <View style={s.banners} accessibilityHint={t("legends.view.trainingHint")}>
              {TRAINING.map((tc) => {
                const on = !!sh.training[tc.key];
                return (
                  <Pressable key={tc.key} accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={tc.label}
                    onPress={() => set(`system.training.${tc.key}`, !on)} style={{ alignItems: "center" }}>
                    <View style={[s.banner, { borderColor: tc.color }, on && { backgroundColor: tc.color }]}>
                      <Text style={[s.bannerHan, { color: on ? C.paper : tc.color }]}>{tc.han}</Text>
                      <Text style={[s.bannerHan2, { color: on ? C.paper : tc.color }]}>{tc.han2}</Text>
                    </View>
                    <View style={[s.bannerTip, { borderColor: tc.color }, on && { backgroundColor: C.ink, borderColor: C.ink }]} />
                    <Text style={[s.bannerLabel, { color: tc.color }, on && { fontWeight: "700" }]} numberOfLines={1}>{tc.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={[col(3), { gap: 6 }]}>
            <Logo />
            <Text style={s.h3}>{t("legends.view.status")}</Text>
            <View style={{ flexDirection: "row", gap: 10 }}>
              {[true, false].map((pos) => (
                <View key={String(pos)} style={{ flex: 1, flexDirection: "row", gap: 4 }}>
                  <View style={s.sideLabelBox}><Text style={[s.sideLabel, { color: pos ? C.water : C.fire }]}>{pos ? t("legends.view.positive") : t("legends.view.negative")}</Text></View>
                  <View style={{ flex: 1 }}>
                    {sh.statuses.filter((x) => x.positive === pos).map((x) => (
                      <Check key={x.id} label={x.name} on={x.checked} small onPress={() => onItem(x.id, "checked", !x.checked)}
                        onLongPress={() => onPopup({ title: x.name, text: x.description })} />
                    ))}
                  </View>
                </View>
              ))}
            </View>
            <Text style={s.hint}>{t("legends.view.statusHint")}</Text>
          </View>
        </View>

        <Frame>
          <View style={s.row}>
            <View style={[col(3), { gap: 6 }]}>
              <Text style={s.h1}>{t("legends.view.stats")} <Text style={s.hint}>{t("legends.view.tapToRoll")}</Text></Text>
              {STATS.map((k) => (
                <View key={k} style={s.statRow}>
                  <Pressable accessibilityRole="button" accessibilityLabel={t("legends.view.rollName", { name: statLabel(k) })} onPress={() => onRoll({ title: statLabel(k), stat: k })} style={s.statHit}>
                    <View style={s.ring}><Text style={s.ringVal}>{sign(sh.stats[k])}</Text></View>
                    <Text style={s.statName}>{statLabel(k).toUpperCase()}</Text>
                  </Pressable>
                  <Step value={sh.stats[k]} min={-3} max={4} onChange={(v) => set(`system.stats.${k}`, v)} label={statLabel(k)} />
                </View>
              ))}
              <Text style={[s.h1, { marginTop: 8 }]}>{t("legends.view.fatigue")}</Text>
              <Track n={sh.fatigue?.max ?? 5} value={sh.fatigue?.value ?? 0} onChange={(v) => set("system.fatigue.value", v)} label={t("legends.view.fatigueLower")} />
            </View>
            <View style={[col(4), { gap: 4 }]}>
              <Text style={[s.h1, s.center]}>{t("legends.view.balance")}</Text>
              <Text style={[s.hint, s.center]}>{t("legends.view.balanceHint")}</Text>
              <Balance b={sh.balance} onValue={(v) => set("system.balance.value", v)} onCenter={(v) => set("system.balance.center", v)}
                onRoll={(which) => onRoll({ title: which === "top" ? sh.balance.topTrack : sh.balance.bottomTrack, stat: which })} />
            </View>
            <View style={[col(3), { gap: 4 }]}>
              <Text style={s.h1}>{t("legends.view.conditions")}</Text>
              {sh.conditions.map((x) => (
                <Pressable key={x.id} accessibilityRole="checkbox" accessibilityState={{ checked: x.checked }} accessibilityLabel={x.name} onPress={() => onItem(x.id, "checked", !x.checked)} style={{ paddingVertical: 2 }}>
                  <View style={s.checkRow}><Sq on={x.checked} /><Text style={s.condName}>{x.name.toUpperCase()}</Text></View>
                  <Text style={s.condFx}>{x.description.split("\n")[0]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </Frame>

        <View style={s.row}>
          <View style={[col(1), { gap: 6 }]}>
            {sh.feature ? <>
              <Text style={[s.h2, s.center]}>❖ {sh.feature.name.toUpperCase()} ❖</Text>
              <View style={s.rule} />
              <View style={s.featureBox}>
                <Marked text={sh.feature.description} lines={14} onToggle={(i) => onMark(sh.feature!.id, i)} />
                <EditLink onPress={() => editText(sh.feature!)} />
              </View>
            </> : <Text style={s.hint}>{t("legends.view.noFeature")}</Text>}
          </View>
          <View style={[col(1), { gap: 6 }]}><Moves moves={sh.moves} onRoll={onRoll} onMark={onMark} onEdit={editText} /></View>
        </View>
      </View>

      {/* ================= Folha 2 ================= */}
      <View style={pageStyle}>
        <View style={s.row}>
          <View style={[col(2), { gap: 6 }]}>
            <Text style={s.h1}>{t("legends.view.yourCharacter")}</Text>
            <Framed label={t("legends.view.lookLabel")}><Inp value={sh.look} label={t("legends.view.look")} multiline onSave={(v) => set("profile.look", v)} /></Framed>
            <View style={s.lineField}><Text style={s.lineLabel}>{t("legends.view.hometownLabel")}</Text><View style={{ flex: 1 }}><Inp value={sh.hometown} label={t("legends.view.hometown")} onSave={(v) => set("system.hometown", v)} /></View></View>
            <Text style={s.h1}>{t("legends.view.history")}</Text>
            <Framed><Inp value={sh.history} label={t("legends.view.history")} multiline tall onSave={(v) => set("profile.history", v)} /></Framed>
            <Text style={s.h1}>{t("legends.view.connections")}</Text>
            <Framed><Inp value={sh.connections} label={t("legends.view.connections")} multiline onSave={(v) => set("profile.connections", v)} /></Framed>

            <Text style={[s.h2, s.center, { marginTop: 8 }]}>❖ {t("legends.view.momentOfBalance")} ❖</Text>
            <View style={s.momentOuter}><View style={s.momentInner}>
              {sh.momentOfBalance ? <>
                <Marked text={sh.momentOfBalance.description} lines={10} onToggle={(i) => onMark(sh.momentOfBalance!.id, i)} />
                <EditLink onPress={() => editText(sh.momentOfBalance!)} />
              </> : <Text style={s.hint}>—</Text>}
            </View></View>

            <Text style={[s.h1, { marginTop: 8 }]}>{t("legends.view.clearing")}</Text>
            {sh.conditions.map((x) => {
              const clear = x.description.match(/(?:Para limpar|To clear):\s*(.+)/i)?.[1];
              return clear ? <Text key={x.id} style={s.small}>• <Text style={{ fontWeight: "700" }}>{x.name}</Text>: {clear}</Text> : null;
            })}

            <Growth g={sh.growth} questions={sh.growthQuestions} set={set} onMark={onMark} onEdit={editText} onLevelUp={onLevelUp} />

            <Text style={[s.h1, { marginTop: 8 }]}>{t("legends.view.notes")}</Text>
            <Framed><Inp value={sh.notes} label={t("legends.view.notes")} multiline onSave={(v) => set("system.notes", v)} /></Framed>
          </View>
          <View style={[col(3), { gap: 6 }]}><Techniques list={sh.techniques} onItem={onItem} onRoll={onRoll} /></View>
        </View>
      </View>
    </View>
  );
}

// ---------- Pieces ----------
const Frame = ({ children }: { children: ReactNode }) => <View style={s.frameOuter}><View style={s.frameInner}>{children}</View></View>;
// Box with a double frame, like the PDF fields; the label sits in the top corner, inside the box.
const Framed = ({ label, children }: { label?: string; children: ReactNode }) => (
  <View style={s.fOuter}><View style={s.fInner}>{!!label && <Text style={s.fLabel}>{label.toUpperCase()}</Text>}{children}</View></View>
);
// Text field directly on the sheet: saves on blur, if changed.
function Inp({ value, label, multiline, tall, big, onSave }: { value: string; label: string; multiline?: boolean; tall?: boolean; big?: boolean; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <TextInput value={v} onChangeText={setV} onBlur={() => v !== value && onSave(v)} multiline={multiline} accessibilityLabel={label} placeholder="…" placeholderTextColor={C.frame}
      style={[s.inp, multiline && { minHeight: tall ? 130 : 70, textAlignVertical: "top" }, big && { fontFamily: F.title, fontSize: 24 }, { outlineStyle: "none" } as object]} />
  );
}
const Sq = ({ on, size = 16 }: { on: boolean; size?: number }) => (
  <View style={[s.sq, { width: size, height: size }, on && { backgroundColor: C.ink }]}>{on && <Text style={[s.sqX, { fontSize: size * 0.7, lineHeight: size * 0.8 }]}>✕</Text>}</View>
);
function Check({ label, on, onPress, onLongPress, small, style }: { label: string; on: boolean; onPress: () => void; onLongPress?: () => void; small?: boolean; style?: object }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} accessibilityLabel={label} onPress={onPress} onLongPress={onLongPress} delayLongPress={400} style={[s.checkRow, { paddingVertical: 3 }, style]}>
      <Sq on={on} size={small ? 14 : 16} /><Text style={[small ? s.small : s.p, { flexShrink: 1 }, on && { color: C.maroon, fontWeight: "700" }]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}
const EditLink = ({ onPress }: { onPress: () => void }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={{ alignSelf: "flex-end", padding: 4 }}><Text style={s.editLink}>{t("legends.view.editText")}</Text></Pressable>
);

// Text with the playbooks' "( )"/"(x)" choices as tappable boxes (the module swaps them in the item text, as in Foundry).
const MARK = /(\(\s*[xX]?\s*\))/;
function Marked({ text, lines, onToggle }: { text: string; lines: number; onToggle?: (i: number) => void }) {
  const [open, setOpen] = useState(false);
  const long = text.split("\n").length > lines || text.length > lines * 70;
  let n = -1;
  return (
    <View>
      <Text style={s.p} numberOfLines={open || !long ? undefined : lines}>
        {text.split(MARK).map((part, k) => {
          if (!MARK.test(part)) return part;
          const i = ++n, on = /x/i.test(part);
          if (!onToggle) return part;
          return <Text key={k} accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => onToggle(i)} style={[s.mark, on && s.markOn]}>{on ? "☒" : "☐"}</Text>;
        })}
      </Text>
      {long && <Pressable accessibilityRole="button" onPress={() => setOpen(!open)}><Text style={s.editLink}>{open ? t("legends.ui.less") : t("legends.ui.more")}</Text></Pressable>}
    </View>
  );
}

function Step({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (v: number) => void; label: string }) {
  return (
    <View style={s.step}>
      <Pressable accessibilityLabel={t("legends.sheet.dec", { label })} disabled={value <= min} onPress={() => onChange(value - 1)} style={[s.stepBtn, value <= min && { opacity: 0.3 }]}><Text style={s.stepTxt}>−</Text></Pressable>
      <Pressable accessibilityLabel={t("legends.sheet.inc", { label })} disabled={value >= max} onPress={() => onChange(value + 1)} style={[s.stepBtn, value >= max && { opacity: 0.3 }]}><Text style={s.stepTxt}>+</Text></Pressable>
    </View>
  );
}

// Diamonds over the black brushstroke (fatigue). Tapping the last marked one unmarks it.
function Track({ n, value, onChange, label }: { n: number; value: number; onChange: (v: number) => void; label: string }) {
  return (
    <View style={s.track}>
      {Array.from({ length: n }, (_, i) => (
        <Pressable key={i} accessibilityRole="button" accessibilityLabel={t("legends.view.trackOf", { label, i: i + 1, n })} onPress={() => onChange(value === i + 1 ? i : i + 1)} style={s.diaHit}>
          <View style={[s.dia, i < value && { backgroundColor: C.fire, borderColor: C.fire }]} />
        </Pressable>
      ))}
      <Text style={s.trackVal}>{value}/{n}</Text>
    </View>
  );
}

// Balance as in the PDF: black banner (top principle) on the left, white on the right, +3…−3 track in the middle.
function Balance({ b, onValue, onCenter, onRoll }: { b: Sheet["balance"]; onValue: (v: number) => void; onCenter: (v: number) => void; onRoll: (w: "top" | "bottom") => void }) {
  const steps = [3, 2, 1, 0, -1, -2, -3];
  const LETTERS = ["\u00a0", ...t("legends.view.balanceLetters")]; // a cell without a letter keeps the height (track aligned)
  return (
    <View style={s.balance}>
      <Principle name={b.topTrack} value={b.value} dark onPress={() => onRoll("top")} />
      <View style={s.balMid}>
        <Text style={s.yinyang}>☯</Text>
        <View style={s.balTrack}>
          <View style={s.balLine} />
          {steps.map((v, i) => (
            <Pressable key={v} accessibilityRole="button" accessibilityLabel={t("legends.view.balanceAt", { value: sign(v), track: b.topTrack })} onPress={() => onValue(v)} style={s.balCell}>
              <Text style={s.balTop}>{sign(v)}</Text>
              <View style={[s.balDia, b.center === v && s.balCenter, b.value === v && { backgroundColor: C.navy }]} />
              <Text style={s.balBottom}>{sign(-v)}</Text>
              <Text style={s.balLetter}>{LETTERS[i]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={s.centerRow}>
          <Text style={s.small}>{t("legends.view.center")}</Text>
          <Pressable accessibilityLabel={t("legends.view.moveCenter", { track: b.topTrack })} disabled={b.center >= 3} onPress={() => onCenter(b.center + 1)} style={s.stepBtn}><Text style={s.stepTxt}>‹</Text></Pressable>
          <Text style={s.centerVal}>{sign(b.center)}</Text>
          <Pressable accessibilityLabel={t("legends.view.moveCenter", { track: b.bottomTrack })} disabled={b.center <= -3} onPress={() => onCenter(b.center - 1)} style={s.stepBtn}><Text style={s.stepTxt}>›</Text></Pressable>
        </View>
      </View>
      <Principle name={b.bottomTrack} value={-b.value} onPress={() => onRoll("bottom")} />
    </View>
  );
}
const Principle = ({ name, value, dark, onPress }: { name: string; value: number; dark?: boolean; onPress: () => void }) => (
  <Pressable accessibilityRole="button" accessibilityLabel={t("legends.view.rollName", { name })} onPress={onPress} style={[s.principle, dark ? { backgroundColor: C.ink } : { backgroundColor: "#fffdf7", borderWidth: 2, borderColor: C.ink }]}>
    <View style={[s.principleRot, { transform: [{ rotate: dark ? "-90deg" : "90deg" }] }]}>
      <Text style={[s.principleTxt, { color: dark ? C.paper : C.ink }]} numberOfLines={1}>[ {name || "—"} ]</Text>
      <Text style={[s.principleVal, { color: dark ? C.paper : C.ink }]}>{sign(value)}</Text>
    </View>
  </Pressable>
);

function Logo() {
  return (
    <View style={{ alignItems: "center", gap: 2 }}>
      <View style={{ flexDirection: "row", gap: 6 }}>
        {TRAINING.slice(0, 4).map((tc) => <View key={tc.key} style={s.logoNation}><Text style={s.logoHan}>{tc.han}</Text></View>)}
      </View>
      <Text style={s.logoBig}>AVATAR</Text>
      <Text style={s.logoSmall}>L E G E N D S</Text>
      <Text style={s.logoTiny}>{t("legends.view.theRpg")}</Text>
    </View>
  );
}

const MOVE_TABS = ["playbook", "basic", "balance"];
const TAB_KEY: Record<string, string> = { playbook: "legends.view.tabPlaybook", basic: "legends.view.tabBasic", balance: "legends.view.tabBalance" };
function Moves({ moves, onRoll, onMark, onEdit }: { moves: Move[]; onRoll: (r: RollReq) => void; onMark: (id: string, i: number) => void; onEdit: (tc: TextItem) => void }) {
  const [tab, setTab] = useState("playbook");
  const list = moves.filter((m) => (tab === "playbook" ? !["basic", "balance"].includes(m.category) : m.category === tab));
  return (
    <>
      <View style={[s.row, { alignItems: "flex-end", gap: 8 }]}>
        <Text style={s.brush}>{t("legends.view.moves")}</Text>
        {tab === "playbook" && <Text style={s.chooseTwo}>{t("legends.view.chooseTwo")}</Text>}
      </View>
      <View style={[s.row, { gap: 4 }]}>
        {MOVE_TABS.map((k) => (
          <Pressable key={k} accessibilityRole="tab" accessibilityState={{ selected: tab === k }} onPress={() => setTab(k)} style={[s.tab, tab === k && s.tabOn]}>
            <Text style={[s.tabTxt, tab === k && { color: C.paper }]}>{t(TAB_KEY[k])}</Text>
          </Pressable>
        ))}
      </View>
      {list.length === 0 && <Text style={s.hint}>{t("legends.view.noMoves")}</Text>}
      {list.map((m) => (
        <View key={m.id} style={s.move}>
          <View style={s.moveHead}>
            <Sq on size={13} />
            <View style={{ flex: 1 }}>
              <Text style={s.moveName}>{m.name.toUpperCase()}</Text>
              {!!m.rollStat && <Text style={s.small}>{t("legends.view.rolls", { stat: statLabel(m.rollStat) })}</Text>}
            </View>
            {m.rollable && <Pressable accessibilityRole="button" accessibilityLabel={t("legends.view.rollName", { name: m.name })} onPress={() => onRoll({ title: m.name, itemId: m.id, stat: m.rollStat })} style={s.rollBtn}><Text style={s.rollTxt}>{t("legends.view.roll")}</Text></Pressable>}
          </View>
          <Marked text={m.description} lines={3} onToggle={(i) => onMark(m.id, i)} />
          {/_{3,}/.test(m.description) && <EditLink onPress={() => onEdit(m)} />}
        </View>
      ))}
    </>
  );
}

function Growth({ g, questions, set, onMark, onEdit, onLevelUp }: { g: Sheet["growth"]; questions: TextItem[]; set: (p: string, v: unknown) => Promise<boolean>; onMark: (id: string, i: number) => void; onEdit: (tc: TextItem) => void; onLevelUp: () => void }) {
  const ADV: [string, string][] = [["playbook-move", t("legends.view.advPlaybookMove")], ["other-move", t("legends.view.advOtherMove")], ["shift-center", t("legends.view.advShiftCenter")], ["moment", t("legends.view.advMoment")]];
  return (
    <View style={{ gap: 6, marginTop: 10 }}>
      <View style={[s.row, { alignItems: "center", gap: 14 }]}>
        <Text style={s.h1}>{t("legends.view.growthTitle")}</Text>
        <Squares n={g.max} value={g.value} label={t("legends.view.growthLower")}
          onChange={(v) => set("system.growth.value", v).then((ok) => ok && v >= g.max && onLevelUp())} />
      </View>
      {g.value >= g.max && (
        <Pressable accessibilityRole="button" onPress={onLevelUp} style={s.levelUp}>
          <Text style={s.levelUpTxt}>{t("legends.view.growthFull")}</Text>
        </Pressable>
      )}
      <Text style={s.h4}>{t("legends.view.growthQuestion")}</Text>
      {questions.length === 0 && <Framed><Text style={s.hint}>—</Text></Framed>}
      {questions.map((q) => (
        <Framed key={q.id}><Marked text={q.description} lines={6} onToggle={(i) => onMark(q.id, i)} />{/_{3,}/.test(q.description) && <EditLink onPress={() => onEdit(q)} />}</Framed>
      ))}
      <Text style={s.h4}>{t("legends.view.growthAdvancements")}</Text>
      {ADV.map(([k, l]) => {
        const a = g.advancements[k];
        return (
          <View key={k} style={[s.checkRow, { gap: 6 }]}>
            <Text style={[s.small, { flexShrink: 1 }]}>• {l}</Text>
            <Squares n={a?.max || 2} value={a?.value ?? 0} onChange={(v) => set(`system.growth.advancements.${k}.value`, v)} label={l} small />
          </View>
        );
      })}
      <Text style={s.small}>{t("legends.view.raiseStat")}</Text>
    </View>
  );
}
function Squares({ n, value, onChange, label, small }: { n: number; value: number; onChange: (v: number) => void; label: string; small?: boolean }) {
  const sz = small ? 15 : 22;
  return (
    <View style={[s.row, { gap: small ? 3 : 10 }]}>
      {Array.from({ length: n }, (_, i) => (
        <Pressable key={i} accessibilityRole="checkbox" accessibilityState={{ checked: i < value }} accessibilityLabel={`${label} ${i + 1}`} onPress={() => onChange(value === i + 1 ? i : i + 1)} hitSlop={8}>
          <Sq on={i < value} size={sz} />
        </Pressable>
      ))}
    </View>
  );
}

// Techniques as in the PDF: "NAME:" with A/P/D on the right, approach marked and the text in a box. Basic ones are collapsed.
const LPM_KEYS = ["learned", "practiced", "mastered"] as const;
const APPROACH_STAT: Record<string, string> = { "advance-attack": "passion", "defend-maneuver": "focus", "evade-observe": "creativity" };
function Techniques({ list, onItem, onRoll }: { list: Technique[]; onItem: (id: string, f: string, v: boolean) => void; onRoll: (r: RollReq) => void }) {
  const [showBasic, setShowBasic] = useState(false);
  const LPM = LPM_KEYS.map((f) => [f, t(`legends.view.${f}L`), t(`legends.view.${f}`)] as const);
  const shown = list.filter((tc) => showBasic || !tc.basic);
  return (
    <>
      <Text style={s.brush}>{t("legends.view.fightingTechniques")}</Text>
      <View style={s.redRule}><View style={s.redDia} /></View>
      <View style={[s.row, { gap: 6, flexWrap: "wrap" }]}>
        {Object.entries(APPROACH).map(([k, ap]) => (
          <Pressable key={k} accessibilityRole="button" accessibilityLabel={t("legends.view.rollApproach", { name: ap.label })} onPress={() => onRoll({ title: ap.label, approach: k, stat: APPROACH_STAT[k] })} style={[s.rollBtn, { backgroundColor: ap.color }]}><Text style={s.rollTxt}>{t("legends.view.rollBtn", { name: ap.label })}</Text></Pressable>
        ))}
      </View>
      {shown.map((tc) => (
        <View key={tc.id} style={{ gap: 4, marginBottom: 6 }}>
          <View style={s.techHead}>
            <Text style={s.techLabel}>{t("legends.view.techName")}</Text>
            <View style={s.techNameLine}><Text style={s.techName} numberOfLines={2}>{tc.name}</Text></View>
            {!tc.basic && LPM.map(([f, l, full]) => (
              <Pressable key={f} accessibilityRole="checkbox" accessibilityState={{ checked: tc[f] }} accessibilityLabel={`${full}: ${tc.name}`} onPress={() => onItem(tc.id, f, !tc[f])} style={s.lpm} hitSlop={4}>
                <Text style={s.lpmL}>{l}</Text>
                <View style={[s.lpmDot, tc[f] && { backgroundColor: C.ink }]} />
              </Pressable>
            ))}
          </View>
          <View style={[s.row, { gap: 10 }]}>
            {Object.entries(APPROACH).map(([k, ap]) => (
              <View key={k} style={s.checkRow}><Sq on={tc.approach === k} size={11} /><Text style={s.approach}>{ap.label.toUpperCase()}</Text></View>
            ))}
            <Text style={[s.approach, { color: C.soft }]}>{tc.basic ? t("legends.view.basicUpper") : TRAINING.find((x) => x.key === tc.training)?.label.toUpperCase() ?? tc.training.toUpperCase()}</Text>
          </View>
          <Framed><Marked text={tc.description} lines={4} /></Framed>
        </View>
      ))}
      <Pressable accessibilityRole="button" onPress={() => setShowBasic(!showBasic)} style={[s.tab, { alignSelf: "flex-start" }]}>
        <Text style={s.tabTxt}>{showBasic ? t("legends.view.hideBasic") : t("legends.view.showBasic", { n: list.filter((tc) => tc.basic).length })}</Text>
      </Pressable>
      <Text style={s.hint}>{t("legends.view.lpmLegend")}</Text>
    </>
  );
}

const s = StyleSheet.create({
  desk: { gap: 18, maxWidth: 1180, width: "100%", alignSelf: "center" },
  page: { backgroundColor: C.page, gap: 18, borderRadius: 2, boxShadow: "0 4px 18px rgba(0,0,0,.35)" } as object,
  bar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" },
  barBtn: { borderWidth: 1.5, borderColor: C.paper, borderRadius: 3, paddingVertical: 6, paddingHorizontal: 12 },
  barTxt: { fontFamily: F.title, fontSize: 15, color: C.paper },
  barHint: { fontFamily: F.body, fontSize: 13, color: C.paper2, fontStyle: "italic", flexShrink: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 18, alignItems: "flex-start" },
  center: { textAlign: "center" },
  playbook: { fontFamily: F.title, fontSize: 32, color: C.ink, lineHeight: 36, fontWeight: "700" },
  h1: { fontFamily: F.title, fontSize: 24, color: C.ink, textShadowColor: "rgba(59,74,122,.4)", textShadowOffset: { width: 1.5, height: 1.5 }, textShadowRadius: 0 },
  h2: { fontFamily: F.title, fontSize: 21, color: C.ink, textShadowColor: "rgba(59,74,122,.4)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  h3: { fontFamily: F.title, fontSize: 17, color: C.ink, fontWeight: "700" },
  h4: { fontFamily: F.title, fontSize: 15, color: C.navy, fontWeight: "700" },
  brush: { fontFamily: F.brush, fontSize: 32, color: C.ink },
  chooseTwo: { fontFamily: F.title, fontSize: 14, color: C.maroon, fontWeight: "700", marginBottom: 8 },
  p: { fontFamily: F.body, fontSize: 15, color: C.ink, lineHeight: 21 },
  small: { fontFamily: F.body, fontSize: 13.5, color: C.ink, lineHeight: 18 },
  hint: { fontFamily: F.body, fontSize: 12.5, color: C.soft, fontStyle: "italic" },
  editLink: { fontFamily: F.title, fontSize: 12.5, color: C.navy, marginTop: 4 },
  bgGrid: { flexDirection: "row", flexWrap: "wrap" },
  fOuter: { borderWidth: 1.5, borderColor: C.navy, borderRadius: 4, padding: 2 },
  fInner: { borderWidth: 1, borderColor: C.frame, borderRadius: 2, paddingHorizontal: 8, paddingVertical: 4 },
  fLabel: { fontFamily: F.title, fontSize: 11, color: C.ink, fontWeight: "700" },
  inp: { fontFamily: F.body, fontSize: 16, color: C.ink, paddingVertical: 4, backgroundColor: "transparent" },
  lineField: { flexDirection: "row", alignItems: "flex-end", gap: 6, borderBottomWidth: 1.5, borderColor: C.navy },
  lineLabel: { fontFamily: F.title, fontSize: 14, color: C.ink, fontWeight: "700", paddingBottom: 6 },
  banners: { flexDirection: "row", gap: 6, flexWrap: "wrap", justifyContent: "center" },
  banner: { width: 44, height: 116, borderWidth: 2.5, borderRadius: 3, alignItems: "center", paddingTop: 8, gap: 4, backgroundColor: "#fffdf7" },
  bannerHan: { fontFamily: F.han, fontSize: 28, lineHeight: 34 },
  bannerHan2: { fontFamily: F.han, fontSize: 24, lineHeight: 30 },
  bannerLabel: { fontFamily: F.title, fontSize: 10, width: 64, marginHorizontal: -10, textAlign: "center", marginTop: 3 },
  levelUp: { backgroundColor: C.air, borderRadius: 4, paddingVertical: 10, paddingHorizontal: 14, borderWidth: 2, borderColor: "#8a6312", alignSelf: "flex-start" },
  levelUpTxt: { fontFamily: F.title, fontSize: 16, color: C.ink, fontWeight: "700" },
  bannerTip: { marginTop: -8, width: 15, height: 15, borderWidth: 2, transform: [{ rotate: "45deg" }], backgroundColor: "#fffdf7" },
  logoNation: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: C.ink, alignItems: "center", justifyContent: "center" },
  logoHan: { fontFamily: F.han, fontSize: 17, lineHeight: 22, color: C.ink },
  logoBig: { fontFamily: F.title, fontSize: 34, letterSpacing: 2, color: C.ink, fontWeight: "700", lineHeight: 38 },
  logoSmall: { fontFamily: F.title, fontSize: 15, color: C.ink, letterSpacing: 2 },
  logoTiny: { fontFamily: F.title, fontSize: 10, color: C.soft, letterSpacing: 3 },
  sideLabelBox: { width: 14, alignItems: "center", justifyContent: "center" },
  sideLabel: { fontFamily: F.title, fontSize: 10, fontWeight: "700", width: 90, textAlign: "center", transform: [{ rotate: "-90deg" }] },
  frameOuter: { borderWidth: 3, borderColor: C.navy, borderRadius: 4, padding: 4 },
  frameInner: { borderWidth: 1, borderColor: C.frame, borderRadius: 2, padding: 14 },
  statRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statHit: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 5, borderColor: C.ink, alignItems: "center", justifyContent: "center", backgroundColor: "#fffdf7" },
  ringVal: { fontFamily: F.num, fontSize: 18, fontWeight: "700", color: C.ink },
  statName: { fontFamily: F.title, fontSize: 19, color: C.ink, fontWeight: "700", textShadowColor: "rgba(59,74,122,.35)", textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 0 },
  step: { flexDirection: "row", gap: 4 },
  stepBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, borderColor: C.navy, alignItems: "center", justifyContent: "center", backgroundColor: "#fffdf7" },
  stepTxt: { fontSize: 17, color: C.navy, fontWeight: "700", lineHeight: 20 },
  track: { flexDirection: "row", alignItems: "center", gap: 2, backgroundColor: C.ink, alignSelf: "flex-start", borderRadius: 14, paddingHorizontal: 8, paddingVertical: 2 },
  diaHit: { padding: 6 },
  dia: { width: 16, height: 16, transform: [{ rotate: "45deg" }], borderWidth: 2, borderColor: C.paper, backgroundColor: C.paper },
  trackVal: { fontFamily: F.num, color: C.paper, fontSize: 13, marginLeft: 4 },
  balance: { flexDirection: "row", gap: 6, alignItems: "stretch", minHeight: 230 },
  balMid: { flex: 1, backgroundColor: C.sky, borderRadius: 6, paddingVertical: 10, paddingHorizontal: 4, justifyContent: "center", gap: 10, overflow: "hidden" },
  yinyang: { position: "absolute", alignSelf: "center", fontSize: 150, color: "rgba(38,38,46,.08)", top: 20 },
  principle: { width: 50, borderRadius: 3, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  principleRot: { width: 220, alignItems: "center" },
  principleTxt: { fontFamily: F.brush, fontSize: 19, textAlign: "center" },
  principleVal: { fontFamily: F.num, fontSize: 13, fontWeight: "700" },
  balTrack: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  balLine: { position: "absolute", left: 8, right: 8, top: 31, height: 3, backgroundColor: C.ink },
  balCell: { alignItems: "center", gap: 3, minWidth: 24 },
  balTop: { fontFamily: F.num, fontSize: 11, fontWeight: "700", color: C.paper, backgroundColor: C.ink, borderRadius: 8, paddingHorizontal: 4, overflow: "hidden" },
  balBottom: { fontFamily: F.num, fontSize: 11, fontWeight: "700", color: C.ink },
  balLetter: { fontFamily: F.title, fontSize: 10, color: C.navy },
  balDia: { width: 15, height: 15, transform: [{ rotate: "45deg" }], borderWidth: 2, borderColor: C.ink, backgroundColor: "#fffdf7" },
  balCenter: { borderColor: C.maroon, borderWidth: 4 },
  centerRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  centerVal: { fontFamily: F.num, fontSize: 15, fontWeight: "700", color: C.ink, width: 26, textAlign: "center" },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sq: { borderWidth: 1.5, borderColor: C.ink, alignItems: "center", justifyContent: "center", backgroundColor: "#fffdf7" },
  sqX: { color: C.paper, fontWeight: "900" },
  condName: { fontFamily: F.title, fontSize: 16, fontWeight: "700", color: C.ink },
  condFx: { fontFamily: F.body, fontSize: 12.5, color: C.ink, marginLeft: 22 },
  rule: { height: 2, backgroundColor: C.navy, opacity: 0.6 },
  featureBox: { borderRadius: 2, padding: 12, backgroundColor: C.sky, backgroundImage: "linear-gradient(180deg, #dfe6f3 0%, #f4f6fb 100%)", gap: 4 } as object,
  mark: { fontSize: 18, color: C.navy },
  markOn: { color: C.maroon, fontWeight: "700" },
  tab: { borderWidth: 1, borderColor: C.navy, borderRadius: 12, paddingVertical: 3, paddingHorizontal: 10 },
  tabOn: { backgroundColor: C.navy },
  tabTxt: { fontFamily: F.body, fontSize: 13, color: C.navy, fontWeight: "600" },
  move: { borderBottomWidth: 1.5, borderColor: C.frame, paddingBottom: 8, gap: 4 },
  moveHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  moveName: { fontFamily: F.title, fontSize: 15, fontWeight: "700", color: C.ink },
  rollBtn: { backgroundColor: C.maroon, borderRadius: 3, paddingVertical: 5, paddingHorizontal: 12 },
  rollTxt: { fontFamily: F.title, fontSize: 14, color: C.paper },
  momentOuter: { borderWidth: 2, borderColor: C.navy, padding: 3, backgroundColor: C.sky },
  momentInner: { borderWidth: 1, borderColor: C.frame, padding: 10, backgroundColor: "rgba(223,230,243,.6)", backgroundImage: "radial-gradient(circle at 50% 120%, transparent 55%, rgba(59,74,122,.08) 56%, transparent 62%)", backgroundSize: "28px 14px" } as object,
  redRule: { height: 2, backgroundColor: C.maroon, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  redDia: { width: 10, height: 10, backgroundColor: C.maroon, transform: [{ rotate: "45deg" }] },
  techHead: { flexDirection: "row", alignItems: "flex-end", gap: 6 },
  techLabel: { fontFamily: F.title, fontSize: 16, fontWeight: "700", color: C.ink },
  techNameLine: { flex: 1, borderBottomWidth: 1.5, borderColor: C.ink, paddingBottom: 1 },
  techName: { fontFamily: F.body, fontSize: 15.5, color: C.ink, fontWeight: "600" },
  approach: { fontFamily: F.title, fontSize: 10.5, color: C.maroon, fontWeight: "700" },
  lpm: { flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 1 },
  lpmL: { fontFamily: F.title, fontSize: 16, color: C.ink, fontWeight: "700" },
  lpmDot: { width: 15, height: 15, borderRadius: 8, borderWidth: 2, borderColor: C.ink, backgroundColor: "#fffdf7" },
});
