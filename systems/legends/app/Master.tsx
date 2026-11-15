// GM panel: active scene tokens (players and NPCs) with fatigue, conditions and status.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { onErr } from "../../../shared/errors";
import { t } from "../../../shared/i18n";
import { Auth, RollOut, SceneToken, sceneTokens, tokenBalance, tokenFatigue, tokenMark, tokenRoll, tokenTechnique } from "./api";
import { C, APPROACH, sign, statLabel } from "./theme";
import { Chip, Scroll, Seal, u } from "./ui";

const disp = (d: number) => t(d === -1 ? "legends.master.hostile" : d === 1 ? "legends.master.ally" : "legends.master.neutral");

export function MasterScreen({ auth, onBack, onAuthError }: { auth: Auth; onBack: () => void; onAuthError: () => void }) {
  const [data, setData] = useState<{ scene: string | null; tokens: SceneToken[] } | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [roll, setRoll] = useState<{ tk: SceneToken; stat: string; bonus: number; penalty: number } | null>(null);
  const [res, setRes] = useState<string | null>(null);
  const fail = useCallback((e: any) => onErr(e, onAuthError, setErr), [onAuthError]);
  const load = useCallback(() => sceneTokens(auth).then((d) => { setData(d); setErr(""); }).catch(fail), [auth, fail]);
  useEffect(() => { load(); const tk = setInterval(load, 8000); return () => clearInterval(tk); }, [load]);
  const fat = async (tk: SceneToken, d: number) => { try { await tokenFatigue(auth, tk, Math.max(0, Math.min(tk.fatigue.max, tk.fatigue.value + d))); await load(); } catch (e) { fail(e); } };
  const mark = async (tk: SceneToken, id: string, on: boolean) => { try { await tokenMark(auth, tk, id, on); await load(); } catch (e) { fail(e); } };
  const bal = async (tk: SceneToken, v: number) => { try { await tokenBalance(auth, tk, Math.max(-3, Math.min(3, v))); await load(); } catch (e) { fail(e); } };
  const send = async (tk: SceneToken, id: string, name: string) => { try { await tokenTechnique(auth, tk, id); setRes(t("legends.master.sent", { name })); } catch (e) { fail(e); } };
  const doRoll = async () => {
    if (!roll) return;
    try {
      const r: RollOut = await tokenRoll(auth, roll.tk, { stat: roll.stat, bonus: roll.bonus, penalty: roll.penalty });
      setRes(t("legends.master.result", { name: roll.tk.name, stat: r.stat === "npc" ? "2d6" : statLabel(r.stat, r.statName), dice: r.dice.join(" + "), total: r.total, outcome: t(`legends.outcome.${r.outcome}`), formula: r.formula }));
      setRoll(null);
    } catch (e) { fail(e); }
  };
  return (
    <Scroll title={t("legends.master.title")} wide>
      <Seal ghost label={t("legends.back")} onPress={onBack} />
      <Text style={u.hint}>{data ? (data.scene ? t("legends.master.scene", { scene: data.scene }) : t("legends.master.noScene")) : t("legends.master.loading")}</Text>
      {!!err && <Text style={u.err}>{err}</Text>}
      {!!res && <Text style={[u.p, { fontWeight: "700" }]}>{res}</Text>}
      {!data && !err && <ActivityIndicator color={C.navy} />}
      {data && data.tokens.length === 0 && <Text style={u.p}>{t("legends.master.noTokens")}</Text>}
      {data?.tokens.sort((a, b) => a.disposition - b.disposition || a.name.localeCompare(b.name)).map((tk) => {
        const on = [...tk.conditions, ...tk.statuses].filter((m) => m.checked);
        return (
          <View key={tk.tokenId} style={{ gap: 6, borderTopWidth: 1, borderColor: C.frame, paddingTop: 8 }}>
            <Text style={u.label}>{tk.name}{tk.hidden ? t("legends.master.hidden") : ""} · {tk.kind === "player" ? t("legends.master.player") : disp(tk.disposition)}</Text>
            <View style={[u.row, { alignItems: "center" }]}>
              <Text style={u.p}>{t("legends.master.fatigue", { value: tk.fatigue.value, max: tk.fatigue.max })}</Text>
              <Seal ghost label="−1" onPress={() => fat(tk, -1)} disabled={tk.fatigue.value <= 0} />
              <Seal ghost label="+1" onPress={() => fat(tk, 1)} disabled={tk.fatigue.value >= tk.fatigue.max} />
            </View>
            {tk.balance && (
              <View style={[u.row, { alignItems: "center" }]}>
                <Text style={u.p}>{t("legends.master.balance", { top: tk.balance.topTrack, topValue: sign(tk.balance.value), bottom: tk.balance.bottomTrack, bottomValue: sign(-tk.balance.value), center: sign(tk.balance.center) })}</Text>
                <Seal ghost label="−1" onPress={() => bal(tk, tk.balance!.value - 1)} disabled={tk.balance.value <= -3} />
                <Seal ghost label="+1" onPress={() => bal(tk, tk.balance!.value + 1)} disabled={tk.balance.value >= 3} />
              </View>
            )}
            <Seal ghost label={roll?.tk.tokenId === tk.tokenId ? t("legends.master.closeRoll") : t("legends.master.roll")} onPress={() => setRoll(roll?.tk.tokenId === tk.tokenId ? null : { tk, stat: tk.kind === "player" ? "passion" : "npc", bonus: 0, penalty: 0 })} />
            {roll?.tk.tokenId === tk.tokenId && (
              <View style={{ gap: 6 }}>
                {tk.kind === "player" ? <View style={u.chips}>
                  {Object.entries(tk.stats ?? {}).map(([k, v]) => <Chip key={k} label={`${statLabel(k, k)} ${sign(v)}`} on={roll.stat === k} onPress={() => setRoll({ ...roll, stat: k })} />)}
                  {tk.principles.map(([k, n, v]) => <Chip key={k} label={`${n} ${sign(v)}`} on={roll.stat === k} onPress={() => setRoll({ ...roll, stat: k })} color={C.water} />)}
                </View> : <Text style={u.hint}>{t("legends.master.npcHint")}</Text>}
                <View style={[u.row, { alignItems: "center" }]}>
                  <Text style={u.p}>{t("legends.master.bonus", { n: roll.bonus })}</Text><Seal ghost label="−" onPress={() => setRoll({ ...roll, bonus: Math.max(0, roll.bonus - 1) })} /><Seal ghost label="+" onPress={() => setRoll({ ...roll, bonus: Math.min(9, roll.bonus + 1) })} />
                  <Text style={u.p}>{t("legends.master.penalty", { n: roll.penalty })}</Text><Seal ghost label="−" onPress={() => setRoll({ ...roll, penalty: Math.max(0, roll.penalty - 1) })} /><Seal ghost label="+" onPress={() => setRoll({ ...roll, penalty: Math.min(9, roll.penalty + 1) })} />
                </View>
                <Seal label={t("legends.master.roll2d6")} onPress={doRoll} />
              </View>
            )}
            {tk.techniques.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={u.label}>{t("legends.master.techniques")}</Text>
                {tk.techniques.map((q) => (
                  <View key={q.id} style={{ gap: 2 }}>
                    <Text style={u.p}>{q.name} · {APPROACH[q.approach]?.label ?? q.approach}</Text>
                    <Text style={u.hint}>{q.description.length > 220 ? `${q.description.slice(0, 220)}…` : q.description}</Text>
                    <Seal ghost label={t("legends.master.sendChat")} onPress={() => send(tk, q.id, q.name)} />
                  </View>
                ))}
              </View>
            )}
            {on.length > 0 && <Text style={u.hint}>{on.map((m) => m.name).join(", ")}</Text>}
            <Seal ghost label={open === tk.tokenId ? t("legends.master.closeConditions") : t("legends.master.conditionsStatuses")} onPress={() => setOpen(open === tk.tokenId ? null : tk.tokenId)} />
            {open === tk.tokenId && (
              <View style={{ gap: 6 }}>
                <Text style={u.label}>{t("legends.master.conditions")}</Text>
                <View style={u.chips}>{tk.conditions.map((m) => <Chip key={m.id} label={m.name} on={m.checked} onPress={() => mark(tk, m.id, !m.checked)} color={C.fire} />)}</View>
                <Text style={u.label}>{t("legends.master.statuses")}</Text>
                <View style={u.chips}>{tk.statuses.map((m) => <Chip key={m.id} label={m.name} on={m.checked} onPress={() => mark(tk, m.id, !m.checked)} color={m.positive ? C.earth : C.maroon} />)}</View>
              </View>
            )}
          </View>
        );
      })}
    </Scroll>
  );
}
