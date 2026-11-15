// App session: Auth is kept in AsyncStorage (key "sheet-auth", the same as always: nobody gets logged out).
// shortcut: plain text (localStorage on web); swap for expo-secure-store on native if distributing.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Auth } from "./api-core";

export const SESSION_KEY = "sheet-auth";

export function useSession() {
  const [auth, setAuth] = useState<Auth | null>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => { AsyncStorage.getItem(SESSION_KEY).then((v) => { if (v) setAuth(JSON.parse(v)); }).finally(() => setReady(true)); }, []);
  const signIn = (a: Auth) => { AsyncStorage.setItem(SESSION_KEY, JSON.stringify(a)); setAuth(a); };
  const signOut = () => { AsyncStorage.removeItem(SESSION_KEY); setAuth(null); };
  return { auth, ready, signIn, signOut };
}
