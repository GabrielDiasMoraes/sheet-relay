import { registerRootComponent } from "expo";
import App from "./App";
import { setupPwa } from "../../../shared/pwa";

setupPwa({ title: "Sheet (example)", themeColor: "#20242b" });
registerRootComponent(App);
