import { useState } from "react";
import { Text, View } from "react-native";
import { Auth, changePassword } from "./api-core";
import type { Labels, UI } from "./types";

export function PasswordForm({ ui, labels, auth, onDone }: { ui: UI; labels: Labels; auth: Auth; onDone: () => void }) {
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async () => { try { await changePassword(auth, oldP, newP); onDone(); } catch (e: any) { setMsg(e.message); } };
  return (
    <View style={ui.t.box}>
      <ui.Field label={labels.pwOld} value={oldP} onChangeText={setOldP} secure />
      <ui.Field label={labels.pwNew} value={newP} onChangeText={setNewP} secure onSubmit={submit} />
      {!!msg && <Text style={ui.t.err}>{msg}</Text>}
      <View style={ui.t.row}><ui.Button label={labels.pwSave} onPress={submit} /><ui.Button ghost label={labels.cancel} onPress={onDone} /></View>
    </View>
  );
}
