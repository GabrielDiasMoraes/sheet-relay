// Minimal service worker: only so the browser offers "Install app". No cache: the sheet must be online (live Foundry data).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
