// Assembles a system's app: restores the session → Login or (Home | Sheet | Create | Master | Rules), with a Guard on the sheet.
// The system provides the UI, the list row and its own screens (Sheet, Create, Master).
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, View } from "react-native";
import { FC, ReactNode, useState } from "react";
import type { Auth } from "./api-core";
import { Guard } from "./Guard";
import { Home, Row } from "./Home";
import { Login } from "./Login";
import { Rules, RulesCfg } from "./Rules";
import { useSession } from "./session";
import { Labels, Nav, UI, defaultLabels } from "./types";
import { useLang } from "./i18n";

export type { Labels, Nav, UI } from "./types";
export type { Row } from "./Home";
export type { RulesCfg } from "./Rules";

export type SystemConfig<S extends { id: string; name: string }> = {
  ui: UI;
  labels?: Partial<Labels> | (() => Partial<Labels>); // overrides core labels (types.ts); use the function form with t() to switch with the language
  row(s: S): Row; // sheet subtitle in the list (warn = highlighted; create = tap opens the creator with this argument)
  Sheet: FC<{ auth: Auth; id: string; nav: Nav }>;
  Create?: FC<{ auth: Auth; arg?: unknown; nav: Nav }>;
  Master?: FC<{ auth: Auth; nav: Nav }>;
  rules?: RulesCfg;
  Provider?: FC<{ auth: Auth | null; children: ReactNode }>; // system context (e.g. session for compendium links)
  Guard?: FC<{ onBack: () => void; children: ReactNode }>; // error while rendering the sheet (default: the core's Guard)
  screens?: { Login?: FC<{ onLogin: (a: Auth) => void }>; Home?: FC<{ auth: Auth; nav: Nav }> }; // substitui por completo
};

type View_ = { k: "home" } | { k: "open"; id: string } | { k: "create"; arg?: unknown } | { k: "master" } | { k: "rules" };

export function createApp<S extends { id: string; name: string }>(cfg: SystemConfig<S>): FC {
  const { ui } = cfg;
  const Wrap = cfg.Provider ?? (({ children }: { auth: Auth | null; children: ReactNode }) => <>{children}</>);
  return function App() {
    useLang(); // re-renders when the language changes; labels are recomputed on every render (t() reads the current language)
    const labels: Labels = { ...defaultLabels(), ...(typeof cfg.labels === "function" ? cfg.labels() : cfg.labels) };
    const G = cfg.Guard ?? (({ onBack, children }: { onBack: () => void; children: ReactNode }) => <Guard ui={ui} labels={labels} onBack={onBack}>{children}</Guard>);
    const { auth, ready, signIn, signOut } = useSession();
    const [view, setView] = useState<View_>({ k: "home" });
    const home = () => setView({ k: "home" });
    const nav: Nav = { home, open: (id) => setView({ k: "open", id }), create: (arg) => setView({ k: "create", arg }), logout: () => { signOut(); home(); }, master: () => setView({ k: "master" }), rules: () => setView({ k: "rules" }) };
    if (!ready) return <View style={ui.night}><ActivityIndicator color={ui.splash} /></View>;
    return (
      <Wrap auth={auth}>
        <View style={ui.night}>
          <StatusBar style="light" />
          {!auth ? (cfg.screens?.Login ? <cfg.screens.Login onLogin={signIn} /> : <Login ui={ui} labels={labels} onLogin={signIn} />)
            : view.k === "master" && cfg.Master ? <cfg.Master auth={auth} nav={nav} />
            : view.k === "rules" && cfg.rules ? <Rules ui={ui} labels={labels} cfg={cfg.rules} auth={auth} onBack={home} onAuthError={nav.logout} />
            : view.k === "create" && cfg.Create ? <cfg.Create auth={auth} arg={view.arg} nav={nav} />
            : view.k === "open" ? <G key={view.id} onBack={home}><cfg.Sheet auth={auth} id={view.id} nav={nav} /></G>
            : cfg.screens?.Home ? <cfg.screens.Home auth={auth} nav={nav} />
            : <Home<S> ui={ui} labels={labels} auth={auth} nav={nav} row={cfg.row} canCreate={!!cfg.Create}
                gm={{ master: cfg.Master && (() => setView({ k: "master" })), rules: cfg.rules && (() => setView({ k: "rules" })) }} />}
        </View>
      </Wrap>
    );
  };
}
