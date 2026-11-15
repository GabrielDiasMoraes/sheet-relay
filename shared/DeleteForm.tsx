// Pick the sheet and type its name to confirm; the GM can still restore it in Foundry.
import { useState } from "react";
import { Text, View } from "react-native";
import { Auth, deleteCharacter } from "./api-core";
import type { Labels, UI } from "./types";

export function DeleteForm({ ui, labels, auth, list, onDone }: { ui: UI; labels: Labels; auth: Auth; list: { id: string; name: string }[]; onDone: () => void }) {
  const [pick, setPick] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async () => { if (!pick) return; try { await deleteCharacter(auth, pick.id, name); onDone(); } catch (e: any) { setMsg(e.message); } };
  return (
    <View style={ui.t.box}>
      <Text style={ui.t.label}>{labels.delWhich}</Text>
      <View style={ui.t.chips}>{list.map((c) => <ui.Chip key={c.id} label={c.name} on={pick?.id === c.id} onPress={() => { setPick(c); setName(""); setMsg(""); }} />)}</View>
      {pick && <>
        <Text style={ui.t.hint}>{labels.delHint}</Text>
        <ui.Field label={labels.delType(pick.name)} value={name} onChangeText={setName} onSubmit={submit} />
      </>}
      {!!msg && <Text style={ui.t.err}>{msg}</Text>}
      <View style={ui.t.row}><ui.Button label={labels.delDo} onPress={submit} disabled={!pick || name.trim().toLowerCase() !== pick.name.trim().toLowerCase()} /><ui.Button ghost label={labels.cancel} onPress={onDone} /></View>
    </View>
  );
}
