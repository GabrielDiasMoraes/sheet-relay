// The example system's sheet: name, HP, rename and one roll. This is where you design YOUR system's sheet.
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { onErr } from "../../../shared/errors";
import { t } from "../../../shared/i18n";
import { useLive } from "../../../shared/useLive";
import type { Nav } from "../../../shared/types";
import { Auth, RollOut, Sheet, getCharacter, rename, roll } from "./api";
import { kit } from "./ui";

export function SheetScreen({ auth, id, nav }: { auth: Auth; id: string; nav: Nav }) {
  const [sh, setSh] = useState<Sheet | null>(null);
  const [name, setName] = useState("");
  const [res, setRes] = useState<RollOut | null>(null);
  const [err, setErr] = useState("");
  const { Frame, Button, Field, Spinner, t: st } = kit;
  const load = () => getCharacter(auth, id).then((s) => { setSh(s); setName((n) => n || s.name); }).catch((e) => onErr(e, nav.logout, setErr));
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
  useLive(auth, id, () => load()); // the sheet reloads by itself when it changes in Foundry
  if (!sh) return <Frame title={t("template.sheet")}>{err ? <Text style={st.err}>{err}</Text> : <Spinner />}<Button label={t("template.back")} ghost onPress={nav.home} /></Frame>;
  return (
    <Frame title={sh.name}>
      {!!err && <Text style={st.err}>{err}</Text>}
      {sh.hp && <Text style={st.p}>{t("template.hp", { value: sh.hp.value, max: sh.hp.max })}</Text>}
      <Field label={t("template.name")} value={name} onChangeText={setName} />
      <View style={st.row}>
        <Button label={t("template.rename")} onPress={() => rename(auth, id, name).then(setSh).catch((e) => onErr(e, nav.logout, setErr))} disabled={!name.trim() || name === sh.name} />
        <Button label={t("template.roll")} onPress={() => roll(auth, id).then(setRes).catch((e) => onErr(e, nav.logout, setErr))} />
      </View>
      {res && <Text style={st.p}>{res.formula} = {res.total}</Text>}
      <Button label={t("template.sheets")} ghost onPress={nav.home} />
    </Frame>
  );
}
