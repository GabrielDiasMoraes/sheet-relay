import { registerRootComponent } from 'expo';

import App from './App';

import { setupPwa } from "../../../shared/pwa";

setupPwa({ title: "Fallout sheet", themeColor: "#050d07" });

registerRootComponent(App);
