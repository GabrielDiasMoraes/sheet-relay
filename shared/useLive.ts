// Sheet changed in Foundry: the relay notifies (SSE) and the sheet reloads by itself.
import { useEffect } from "react";
import { Auth, eventsUrl } from "./api-core";

export function useLive(auth: Auth, id: string, reload: () => void) {
  useEffect(() => {
    // shortcut: the native app has no EventSource; reloads every 15 s. Swap for an SSE lib if the native app is published.
    if (typeof EventSource === "undefined") { const t = setInterval(reload, 15_000); return () => clearInterval(t); }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const es = new EventSource(eventsUrl(auth, id)); // reconnects by itself if it drops
    es.onmessage = () => { clearTimeout(timer); timer = setTimeout(reload, 300); };
    return () => { es.close(); clearTimeout(timer); };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps
}
