// Avatar Legends: composition only; the core (session, login, list, rules, password, delete) is in shared/createApp.
import { createApp } from "../../../shared/createApp";
import { addLocale, t } from "../../../shared/i18n";
import type { Summary } from "./api";
import { CreateScreen } from "./Create";
import { MasterScreen } from "./Master";
import { SheetScreen } from "./SheetScreen";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import { kit } from "./ui";

addLocale("en", en);
addLocale("pt-BR", ptBR);

export default createApp<Summary>({
  ui: kit,
  labels: () => ({ create: t("legends.app.create"), loginTitle: t("legends.app.loginTitle"), loginIntro: t("legends.app.loginIntro") }),
  // empty sheet (the GM creates it and gives it to the player): opens the creator, like the macro
  row: (c) => c.playbook
    ? { sub: `${c.playbook}${c.fatigue ? t("legends.app.fatigue", { value: c.fatigue.value, max: c.fatigue.max }) : ""}` }
    : { sub: t("legends.app.empty"), warn: true, create: { id: c.id, name: c.name } },
  Sheet: SheetScreen,
  Create: ({ auth, arg, nav }) => <CreateScreen auth={auth} target={(arg as { id: string; name: string } | undefined) ?? null} onCancel={nav.home} onCreated={nav.open} onAuthError={nav.logout} />,
  Master: ({ auth, nav }) => <MasterScreen auth={auth} onBack={nav.home} onAuthError={nav.logout} />,
  // getter: the texts are read on every render, to follow the language
  get rules() {
    return {
      rolls: [["move", t("legends.rules.move")], ["principle", t("legends.rules.principle")], ["resist", t("legends.rules.resist")], ["balance", t("legends.rules.balance")], ["technique", t("legends.rules.technique")], ["status", t("legends.rules.status")], ["stat", t("legends.rules.stat")]] as [string, string][],
      defaultRoll: "move", defaultPer: "session",
      fields: {
        skills: t("legends.rules.skills"), attributes: t("legends.rules.attributes"),
        cost: t("legends.rules.cost"), uses: t("legends.rules.uses"),
        effects: t("legends.rules.effects"),
      },
    };
  },
});
