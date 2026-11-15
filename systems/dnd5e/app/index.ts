import { registerRootComponent } from "expo";
import App from "./App";
import { setupPwa } from "../../../shared/pwa";
import { FONTS_CSS } from "./theme";
import { t } from "../../../shared/i18n";

setupPwa({ title: t("dnd.pwa.title"), themeColor: "#170807" });
if (typeof document !== "undefined") { // fonts of the 2024 sheet and the infernal login (Google Fonts, web only)
  const l = document.createElement("link");
  Object.assign(l, { rel: "stylesheet", href: FONTS_CSS });
  document.head.appendChild(l);
}
registerRootComponent(App);
