// "Feats and features" box of the roll popups (the core is in shared/PerkBox). Here: several rolls
// (e.g. attack and damage of the same weapon) in a single list, each feat showing which ones it applies to, and the activation groups.
// The rules come from the module (per roll); the server revalidates whatever is selected.
import { StyleSheet, Text } from "react-native";
import { PerkBox as Box } from "../../../shared/PerkBox";
import { Auth, RollMod, listRollMods } from "./api";
import { C } from "./theme";
import { t } from "../../../shared/i18n";
import { kit } from "./ui";

export type ModCtx = { kind?: string; key?: string; itemId?: string; activityId?: string; action?: string };
type Tagged = RollMod & { tags: string[] };

// ctxs: one or more rolls in a single list; each feat shows which of them it applies to.
export function PerkBox({ auth, actorId, ctx, ctxs, picked, setPicked, onGroups }: { auth: Auth; actorId: string; ctx?: ModCtx; ctxs?: { ctx: ModCtx; tag: string }[]; picked: string[]; setPicked: (k: string[]) => void; onGroups?: (g: Record<string, string[]>) => void }) {
  const lists = ctxs ?? [{ ctx: ctx!, tag: "" }];
  const load = () => Promise.all(lists.map((l) => listRollMods(auth, actorId, l.ctx).catch(() => [] as RollMod[]))).then((all) => {
    const by = new Map<string, Tagged>();
    all.forEach((ms, i) => ms.forEach((m) => { const cur = by.get(m.key); if (cur) cur.tags.push(lists[i].tag); else by.set(m.key, { ...m, tags: [lists[i].tag] }); }));
    return [...by.values()];
  });
  const cost = (m: RollMod) => [m.cost?.uses && `${t("dnd.perk.uses", { left: m.usesLeft ?? "?", max: m.usesMax ?? "?" })}${m.cost.uses.per ? ` (${["sr", "lr", "turn", "scene"].includes(m.cost.uses.per) ? t(`dnd.perk.per.${m.cost.uses.per}`) : m.cost.uses.per})` : ""}`, m.cost?.resource].filter(Boolean).join(" · ");
  return (
    <Box<Tagged> ui={kit} look={{ title: t("dnd.perk.title"), search: t("dnd.perk.search"), color: C.stoneDark, maxHeight: 240, searchStyle: s.search, modStyle: s.mod }}
      load={load} deps={JSON.stringify(lists)} picked={picked} setPicked={setPicked}
      initial={(merged) => { // automatic ones with an effect come pre-selected; those that only warn do not
        onGroups?.(Object.fromEntries(merged.map((m) => [m.key, m.tags])));
        return merged.filter((x) => x.auto && x.usesLeft !== 0 && x.effects?.some((e) => !e.other && !e.grant)).map((x) => x.key);
      }}
      chipLabel={(m) => `${m.itemName}: ${m.label}${m.tags.filter(Boolean).length ? ` (${m.tags.filter(Boolean).join(t("dnd.and"))})` : ""}`}
      extra={(m) => <>
        {!!m.preview && <Text style={kit.t.hint}>{t("dnd.perk.formula", { f: m.preview })}</Text>}
        {!!cost(m) && <Text style={kit.t.hint}>{cost(m)}</Text>}
      </>} />
  );
}

const s = StyleSheet.create({
  search: { borderWidth: 1.5, borderColor: "#a88a5c", backgroundColor: "#fff8", paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, color: C.ink },
  mod: { gap: 2, borderBottomWidth: 1, borderColor: "#a88a5c55", paddingBottom: 6 }
});
