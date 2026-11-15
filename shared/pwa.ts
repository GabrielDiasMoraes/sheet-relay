import { t } from "./i18n";
// PWA (web only): manifest, icons and service worker for "Add to home screen". Each app passes its own colors.
export function setupPwa({ title, themeColor, base = process.env.EXPO_PUBLIC_BASE_PATH ?? "/ficha/" }: { title: string; themeColor: string; base?: string }) {
  if (typeof document === "undefined") return;
  const add = (tag: string, attrs: Record<string, string>) => { const el = document.createElement(tag); Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v)); document.head.appendChild(el); };
  add("link", { rel: "manifest", href: `${base}manifest.json` });
  add("link", { rel: "apple-touch-icon", href: `${base}apple-touch-icon.png` });
  add("meta", { name: "theme-color", content: themeColor });
  add("meta", { name: "apple-mobile-web-app-capable", content: "yes" });
  add("meta", { name: "apple-mobile-web-app-title", content: title });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register(`${base}sw.js`, { scope: base }).catch(() => {});
  avisaVersaoNova();
}

// Compares the loaded bundle (index-*.js script) with the one in the server's current HTML; if it changed, shows the "New version available" banner.
// sw.js has no cache (skipWaiting), so reloading the page is enough to get the new version.
function avisaVersaoNova() {
  const re = /\/_expo\/static\/js\/web\/index-[^"']+\.js/;
  const atual = Array.from(document.scripts).map((s) => s.src.match(re)?.[0]).find(Boolean);
  if (!atual) return; // dev server: no hashed bundle
  let mostrou = false;
  const confere = async () => {
    if (mostrou || document.hidden) return;
    try {
      const html = await (await fetch(location.pathname, { cache: "no-store" })).text();
      const novo = html.match(re)?.[0];
      if (!novo || novo === atual) return;
      mostrou = true;
      const bar = document.createElement("div");
      bar.setAttribute("role", "status");
      bar.style.cssText = "position:fixed;left:50%;bottom:12px;transform:translateX(-50%);z-index:99999;display:flex;gap:12px;align-items:center;padding:8px 14px;border-radius:999px;background:#222;color:#fff;font:14px sans-serif;box-shadow:0 2px 10px #0008";
      bar.append(t("pwa.update"));
      const b = document.createElement("button");
      b.textContent = t("pwa.reload");
      b.style.cssText = "border:0;border-radius:999px;padding:6px 12px;background:#fff;color:#000;font:inherit;font-weight:bold;cursor:pointer";
      b.onclick = async () => {
        try { const r = await navigator.serviceWorker?.getRegistration(); r?.waiting?.postMessage("SKIP_WAITING"); await r?.update(); } catch {}
        location.reload();
      };
      bar.append(b);
      document.body.appendChild(bar);
    } catch {}
  };
  setInterval(confere, 5 * 60 * 1000);
  document.addEventListener("visibilitychange", confere);
}
