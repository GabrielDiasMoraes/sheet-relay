// "Moves and features" box of the roll popup (the core is in shared/PerkBox).
import { StyleSheet, Text } from "react-native";
import { PerkBox as Box } from "../../../shared/PerkBox";
import { t } from "../../../shared/i18n";
import { Auth, listRollMods } from "./api";
import { C } from "./theme";
import { kit } from "./ui";

export function PerkBox({ auth, actorId, itemId, approach, stat, picked, setPicked }: { auth: Auth; actorId: string; itemId?: string; approach?: string; stat?: string; picked: string[]; setPicked: (k: string[]) => void }) {
  return (
    <Box ui={kit} look={{ title: t("legends.perks.title"), search: t("legends.perks.search"), color: C.maroon, maxHeight: 220, searchStyle: s.search, modStyle: s.mod }}
      load={() => listRollMods(auth, actorId, { itemId, stat, approach })} deps={`${itemId}|${approach}|${stat}`} picked={picked} setPicked={setPicked}
      extra={(m) => <>
        {!!m.cost?.resource && <Text style={kit.t.hint}>{m.cost.resource}</Text>}
        {!!m.cost?.uses && <Text style={kit.t.hint}>{t("legends.perks.uses", { left: m.usesLeft ?? "?", max: m.usesMax ?? "?" })}{m.cost.uses.per === "session" ? t("legends.perks.perSession") : ""}</Text>}
      </>} />
  );
}

const s = StyleSheet.create({
  search: { borderWidth: 1.5, borderColor: C.frame, paddingHorizontal: 10, paddingVertical: 6, fontSize: 15, color: C.ink },
  mod: { gap: 2, borderBottomWidth: 1, borderColor: C.frame, paddingBottom: 6 }
});
