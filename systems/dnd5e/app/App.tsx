// D&D 5e: composition only; the core (session, login, list, rules, password, delete) is in shared/createApp.
import { createApp } from "../../../shared/createApp";
import { addLocale, t } from "../../../shared/i18n";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import type { Summary } from "./api";
import { CreateScreen, Existing } from "./Create";
import { MasterScreen } from "./Master";
import { SheetScreen } from "./SheetScreen";
import { C } from "./theme";
import { AuthCtx, kit } from "./ui";

addLocale("en", en);
addLocale("pt-BR", ptBR);

export default createApp<Summary>({
  ui: kit,
  labels: () => ({
    loginTitle: t("dnd.app.loginTitle"), loginIntro: t("dnd.app.loginIntro"), loginWho: t("dnd.app.loginWho"), loginPick: t("dnd.app.loginPick"),
    rulesBack: t("dnd.sheets"), rulesPick: t("dnd.app.rulesPick"), rulesSearch: t("dnd.app.rulesSearch"), rulesOwn: t("dnd.app.rulesOwn"),
  }),
  // incomplete sheet: opening it shows the notice to continue creation (nav.create(existing) in SheetScreen)
  row: (c) => ({ sub: c.level ? t("dnd.app.sub", { classes: c.classes, level: c.level, v: c.hp.value, max: c.hp.max }) : t("dnd.app.incomplete"), warn: !c.level }),
  Sheet: SheetScreen,
  Create: ({ auth, arg, nav }) => <CreateScreen auth={auth} existing={arg as Existing | undefined} onCancel={nav.home} onCreated={nav.open} onAuthError={nav.logout} />,
  Master: ({ auth, nav }) => <MasterScreen auth={auth} onBack={nav.home} onAuthError={nav.logout} />,
  Provider: ({ auth, children }) => <AuthCtx.Provider value={auth}>{children}</AuthCtx.Provider>, // compendium links in the texts
  // getters: the text is read on every render, so it switches with the language
  rules: {
    get rolls(): [string, string][] { return ["attack", "damage", "heal", "save", "check", "skill", "initiative", "death", "spell", "soak"].map((k) => [k, t(`dnd.app.roll.${k}`)]); },
    get periods(): [string, string][] { return [["", t("dnd.app.period.none")], ["sr", t("dnd.app.period.sr")], ["lr", t("dnd.app.period.lr")], ["turn", t("dnd.app.period.turn")]]; },
    get itemKeys(): [string, string][] { return ["weaponType", "tags", "damageType", "range"].map((k) => [k, t(`dnd.app.key.${k}`)]); },
    defaultRoll: "attack", smallBack: true, periodColor: C.stoneDark,
    get fields() {
      return {
        skills: t("dnd.app.f.skills"), attributes: t("dnd.app.f.attributes"), cost: t("dnd.app.f.cost"), uses: t("dnd.app.f.uses"),
        auto: t("dnd.app.f.auto"), effects: t("dnd.app.f.effects"), rollsHint: t("dnd.app.f.rollsHint"),
      };
    },
  },
});
