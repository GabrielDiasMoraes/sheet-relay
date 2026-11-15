// Terminal entry and menu: login, sheet list, delete, password and sheet render errors.
import { Picker } from "@react-native-picker/picker";
import { Component, ReactNode, useEffect, useState } from "react";
import { Text, View } from "react-native";
import { Auth, Summary, changePassword, deleteCharacter, listCharacters, listUsers, login } from "./api";
import { Cursor, Field, Line, Opt, s, T, Terminal, useLoad } from "./Terminal";
import type { Nav } from "../../../shared/types";
import { t } from "../../../shared/i18n";

// A render error on the sheet (unexpected Foundry data) becomes a message with a "back" button instead of a blank screen.
export class Guard extends Component<{ onBack: () => void; children: ReactNode }, { error: string }> {
  state = { error: "" };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Terminal title={t("fallout.guard.title")}>
        <Line bad>!! {this.state.error}</Line>
        <Line dim>{t("fallout.guard.hint")}</Line>
        <Opt label={t("fallout.entry.back")} onPress={this.props.onBack} />
      </Terminal>
    );
  }
}

// ---------- Login ----------
export function Login({ onLogin }: { onLogin: (a: Auth) => void }) {
  const [users, setUsers] = useState<string[]>([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { listUsers().then(setUsers).catch((e) => setErr(e.message)); }, []);
  const submit = async () => {
    if (!username) return setErr(t("fallout.login.pick"));
    try { onLogin(await login(username, password)); } catch (e: any) { setErr(String(e.message).toUpperCase()); }
  };
  return (
    <Terminal title={t("fallout.login.title")}>
      <Line dim>{t("fallout.login.user")}</Line>
      <View style={s.input}>
        <Picker selectedValue={username} onValueChange={(v) => { setUsername(v); setErr(""); }} style={s.picker} dropdownIconColor={T.fg}>
          <Picker.Item label={t("fallout.login.select")} value="" color={T.dim} />
          {users.map((u) => <Picker.Item key={u} label={u} value={u} />)}
        </Picker>
      </View>
      <Line dim>{t("fallout.login.pw")}</Line>
      <Field value={password} onChangeText={setPassword} placeholder="********" secure onSubmit={submit} />
      {!!err && <Line bad>!! {err}</Line>}
      <View style={{ height: 6 }} />
      <Opt label={t("fallout.login.enter")} onPress={submit} />
      <Text style={s.t}>{">"} <Cursor /></Text>
    </Terminal>
  );
}

const typeLabel = (type: string) => (["character", "robot", "creature", "npc"].includes(type) ? t(`fallout.type.${type}`) : type);
export function Home({ auth, nav }: { auth: Auth; nav: Nav }) {
  const { data, setData, err } = useLoad<Summary[]>(() => listCharacters(auth), nav.logout, []);
  const [mode, setMode] = useState<"menu" | "password" | "delete">("menu");
  return (
    <Terminal title={t("fallout.home.title", { name: auth.name.toUpperCase() })}>
      <Line dim>{t("fallout.home.files")}</Line>
      {err ? <Line bad>!! {err}</Line> : !data ? <Line dim>{t("fallout.home.loading")}</Line> :
        data.length === 0 ? <Line dim>{t("fallout.home.empty")}</Line> :
        data.map((c) => <Opt key={c.id} label={c.name.toUpperCase()} right={`${typeLabel(c.type)}${c.hp ? ` · HP ${c.hp.value}/${c.hp.max}` : ""}`} onPress={() => nav.open(c.id)} />)}
      <View style={s.rule} />
      {auth.gm && <Opt label={t("fallout.home.master")} onPress={nav.master} />}
      {auth.gm && <Opt label={t("fallout.home.rules")} onPress={nav.rules} />}
      <Opt label={t("fallout.home.create")} onPress={() => nav.create()} />
      {auth.gm && !!data?.length && (mode === "delete"
        ? <DeleteForm auth={auth} list={data} onDone={(id) => { if (id) setData(data.filter((c) => c.id !== id)); setMode("menu"); }} />
        : <Opt label={t("fallout.home.delete")} onPress={() => setMode("delete")} />)}
      {mode === "password" ? <PasswordForm auth={auth} onDone={() => setMode("menu")} /> : <Opt label={t("fallout.home.pw")} onPress={() => setMode("password")} />}
      <Opt label={t("fallout.home.logout")} onPress={nav.logout} />
      <Text style={s.t}>{">"} <Cursor /></Text>
    </Terminal>
  );
}

// Pick the sheet and type its name to confirm; the GM can still restore it in Foundry.
function DeleteForm({ auth, list, onDone }: { auth: Auth; list: Summary[]; onDone: (deletedId?: string) => void }) {
  const [pick, setPick] = useState<Summary | null>(null);
  const [name, setName] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async () => {
    if (!pick) return;
    try { await deleteCharacter(auth, pick.id, name); onDone(pick.id); } catch (e: any) { setMsg(String(e.message).toUpperCase()); }
  };
  return (
    <View style={s.sub}>
      <Line dim>{t("fallout.del.which")}</Line>
      {list.map((c) => <Opt key={c.id} label={c.name.toUpperCase()} right={pick?.id === c.id ? "[X]" : "[ ]"} onPress={() => { setPick(c); setName(""); setMsg(""); }} />)}
      {pick && <>
        <Line dim>{t("fallout.del.hint")}</Line>
        <Line dim>{t("fallout.del.type", { name: pick.name.toUpperCase() })}</Line>
        <Field value={name} onChangeText={setName} placeholder={pick.name} onSubmit={submit} />
      </>}
      {!!msg && <Line bad>!! {msg}</Line>}
      <Opt label={t("fallout.del.confirm")} onPress={submit} disabled={!pick || name.trim().toLowerCase() !== pick.name.trim().toLowerCase()} />
      <Opt label={t("fallout.del.cancel")} onPress={() => onDone()} />
    </View>
  );
}

function PasswordForm({ auth, onDone }: { auth: Auth; onDone: () => void }) {
  const [oldP, setOldP] = useState("");
  const [newP, setNewP] = useState("");
  const [msg, setMsg] = useState("");
  const submit = async () => {
    try { await changePassword(auth, oldP, newP); onDone(); } catch (e: any) { setMsg(String(e.message).toUpperCase()); }
  };
  return (
    <View style={s.sub}>
      <Line dim>{t("fallout.pw.old")}</Line>
      <Field value={oldP} onChangeText={setOldP} placeholder="********" secure />
      <Line dim>{t("fallout.pw.new")}</Line>
      <Field value={newP} onChangeText={setNewP} placeholder="********" secure onSubmit={submit} />
      {!!msg && <Line bad>!! {msg}</Line>}
      <Opt label={t("fallout.pw.save")} onPress={submit} />
      <Opt label={t("fallout.del.cancel")} onPress={onDone} />
    </View>
  );
}
