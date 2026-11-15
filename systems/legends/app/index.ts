import { registerRootComponent } from "expo";
import App from "./App";
import { setupPwa } from "../../../shared/pwa";
import { FONTS_CSS } from "./theme";

setupPwa({ title: "Avatar sheet", themeColor: "#1d2433" });
if (typeof document !== "undefined") { // PDF-style fonts (Google Fonts, web only)
  const l = document.createElement("link");
  Object.assign(l, { rel: "stylesheet", href: FONTS_CSS });
  document.head.appendChild(l);
}
registerRootComponent(App);
