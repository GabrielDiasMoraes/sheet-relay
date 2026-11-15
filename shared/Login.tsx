import { Picker } from "@react-native-picker/picker";
import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Auth, listUsers, login } from "./api-core";
import { t } from "./i18n";
import { LangSwitch } from "./LangSwitch";
import type { Labels, UI } from "./types";

export function Login({ ui, labels, onLogin }: { ui: UI; labels: Labels; onLogin: (a: Auth) => void }) {
  const [users, setUsers] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { listUsers().then(setUsers).catch((e) => setErr(e.message)); }, []);
  const submit = async () => {
    if (!username) return setErr(labels.loginPick);
    setBusy(true);
    try { onLogin(await login(username, password)); } catch (e: any) { setErr(e.message); setBusy(false); }
  };
  return (
    <ui.Frame title={labels.loginTitle}>
      <Text style={[ui.t.p, ui.t.intro]}>{labels.loginIntro}</Text>
      <View style={{ gap: 4 }}>
        <Text style={ui.t.label}>{labels.loginWho}</Text>
        <View style={ui.t.input}>
          <Picker selectedValue={username} onValueChange={(v) => { setUsername(v); setErr(""); }} style={ui.t.picker as object} accessibilityLabel={t("user")}>
            <Picker.Item label={t("pick")} value="" />
            {users.map((n) => <Picker.Item key={n} label={n} value={n} />)}
          </Picker>
        </View>
      </View>
      <ui.Field label={labels.loginPw} value={password} onChangeText={setPassword} secure onSubmit={submit} />
      {!!err && <Text style={ui.t.err}>{err}</Text>}
      <ui.Button label={busy ? labels.entering : labels.enter} onPress={submit} disabled={busy} />
      <LangSwitch ui={ui} />
    </ui.Frame>
  );
}
