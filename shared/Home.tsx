// Sheet list + create, GM panel, rules, delete, password and sign out.
import { LangSwitch } from "./LangSwitch";
import { useEffect, useState } from "react";
import { Pressable, Text } from "react-native";
import { Auth, listCharacters } from "./api-core";
import { DeleteForm } from "./DeleteForm";
import { onErr } from "./errors";
import { PasswordForm } from "./PasswordForm";
import type { Labels, Nav, UI } from "./types";

export type Row = { sub: string; warn?: boolean; create?: unknown }; // create: tapping opens the creator with this argument (empty sheet)
type P<S extends { id: string; name: string }> = {
  ui: UI; labels: Labels; auth: Auth; nav: Nav; row: (s: S) => Row;
  canCreate: boolean; gm: { master?: () => void; rules?: () => void };
};

export function Home<S extends { id: string; name: string }>({ ui, labels, auth, nav, row, canCreate, gm }: P<S>) {
  const [list, setList] = useState<S[] | null>(null);
  const [err, setErr] = useState("");
  const [pw, setPw] = useState(false);
  const [del, setDel] = useState(false);
  const load = () => listCharacters<S>(auth).then(setList).catch((e) => onErr(e, nav.logout, setErr));
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const { t } = ui;
  return (
    <ui.Frame title={labels.welcome(auth.name)}>
      <Text style={t.label}>{labels.yours}</Text>
      {err ? <Text style={t.err}>{err}</Text> : !list ? <ui.Spinner /> :
        list.length === 0 ? <Text style={t.p}>{labels.none}</Text> :
        list.map((c) => {
          const r = row(c);
          return (
            <Pressable key={c.id} accessibilityRole="button" onPress={() => (r.create ? nav.create(r.create) : nav.open(c.id))}
              style={({ pressed, hovered }: any) => [t.item, (pressed || hovered) && t.hover]}>
              <Text style={t.itemName}>{c.name}</Text>
              <Text style={[t.itemSub, r.warn && { color: ui.c.warn }]}>{r.sub}</Text>
            </Pressable>
          );
        })}
      <ui.Ornament />
      {canCreate && <ui.Button label={labels.create} onPress={() => nav.create()} />}
      {auth.gm && gm.master && <ui.Button ghost label={labels.master} onPress={gm.master} />}
      {auth.gm && gm.rules && <ui.Button ghost label={labels.rules} onPress={gm.rules} />}
      {auth.gm && !!list?.length && (del ? <DeleteForm ui={ui} labels={labels} auth={auth} list={list} onDone={() => { setDel(false); load(); }} /> : <ui.Button ghost label={labels.del} onPress={() => setDel(true)} />)}
      {pw ? <PasswordForm ui={ui} labels={labels} auth={auth} onDone={() => setPw(false)} /> : <ui.Button ghost label={labels.pw} onPress={() => setPw(true)} />}
      <ui.Button ghost label={labels.logout} onPress={nav.logout} />
      <LangSwitch ui={ui} />
    </ui.Frame>
  );
}
