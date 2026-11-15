// Composition only: the core (session, login, sheet list, password, delete, rules editor) comes from shared/createApp.
import { createApp } from "../../../shared/createApp";
import { addLocale, t } from "../../../shared/i18n";
import type { Summary } from "./api";
import en from "./locales/en.json";
import ptBR from "./locales/pt-BR.json";
import { SheetScreen } from "./Sheet";
import { kit } from "./ui";

addLocale("en", en);
addLocale("pt-BR", ptBR);

export default createApp<Summary>({
  ui: kit,
  labels: () => ({ loginTitle: t("template.loginTitle") }),
  row: (c) => ({ sub: c.hp ? t("template.hp", { value: c.hp.value, max: c.hp.max }) : c.type }),
  Sheet: SheetScreen,
  // rules: { rolls: [["attack", "Ataque"]], defaultRoll: "attack", fields: {...} }  // enables the GM's "Roll rules" button
});
