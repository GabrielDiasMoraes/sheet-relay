// Fallout: composition over shared/createApp. Entry and menu keep the green terminal (Entry.tsx); the rules editor is the core's with the "paper" kit.
import { createApp } from "../../../shared/createApp";
import type { Summary } from "./api";
import { CreateScreen } from "./Create";
import { Guard, Home, Login } from "./Entry";
import { MasterScreen } from "./Master";
import { SheetScreen } from "./SheetScreen";
import { kit } from "./ui";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import { addLocale, t } from "../../../shared/i18n";

addLocale("en", en);
addLocale("pt-BR", ptBR);

export default createApp<Summary>({
  ui: kit,
  labels: () => ({
    rules: t("fallout.rules.title"), rulesBack: t("fallout.rules.back"), rulesBackList: t("fallout.rules.backList"), rulesPick: t("fallout.rules.pick"), rulesSearch: t("fallout.rules.searchPerk"),
    search: t("fallout.rules.search"), rulesOwn: t("fallout.rules.own"),
  }),
  row: (c) => ({ sub: c.type }), // the list is the terminal's (screens.Home); here it only fulfills the contract
  Sheet: SheetScreen,
  Create: ({ auth, nav }) => <CreateScreen auth={auth} onCancel={nav.home} onCreated={nav.open} onAuthError={nav.logout} />,
  Master: ({ auth, nav }) => <MasterScreen auth={auth} onBack={nav.home} onAuthError={nav.logout} />,
  Guard: ({ onBack, children }) => <Guard onBack={onBack}>{children}</Guard>,
  screens: { Login, Home },
  // getters: the text is translated on every read (at render), not just once when the module is imported
  rules: {
    get rolls(): [string, string][] { return [["skill", t("fallout.rules.roll.skill")], ["attack", t("fallout.rules.roll.attack")], ["damage", t("fallout.rules.roll.damage")], ["apply", t("fallout.rules.roll.apply")], ["kill", t("fallout.rules.roll.kill")], ["soak", t("fallout.rules.roll.soak")], ["check", t("fallout.rules.roll.check")], ["heal", t("fallout.rules.roll.heal")]]; },
    get periods(): [string, string][] { return [["", t("fallout.rules.per.none")], ["scene", t("fallout.rules.per.scene")], ["once", t("fallout.rules.per.once")]]; },
    defaultPer: "scene", defaultRoll: "skill",
    get itemKeys(): [string, string][] { return [["weaponType", t("fallout.rules.weaponType")], ["tags", t("fallout.rules.weaponTags")]]; },
    get extraCost(): [string, string][] { return [["ap", "AP"], ["luck", t("fallout.rules.costLuck")]]; },
    get fields() { return { skills: t("fallout.rules.fSkills"), uses: t("fallout.rules.fUses"), auto: t("fallout.rules.fAuto"), effects: t("fallout.rules.fEffects") }; },
  },
});
