// Keeps the relay user logged into Foundry (no canvas). If anything fails, it exits with an error and Docker restarts it.
import { chromium } from "playwright";

const { FOUNDRY_URL, FOUNDRY_USER, FOUNDRY_PASSWORD } = process.env;
if (!FOUNDRY_URL || !FOUNDRY_USER || !FOUNDRY_PASSWORD) throw new Error("defina FOUNDRY_URL, FOUNDRY_USER e FOUNDRY_PASSWORD");

// for this world is off, waits here without opening the browser; when it comes back, logs in.
const probe = (process.env.FOUNDRY_HOST ? FOUNDRY_URL.replace("localhost", process.env.FOUNDRY_HOST) : FOUNDRY_URL) + "/join";
for (let warned = false; ; warned = true) {
  const up = await fetch(probe, { signal: AbortSignal.timeout(5_000) }).then((r) => r.ok, () => false);
  if (up) break;
  if (!warned) console.log("Foundry is down; waiting for it to come up...");
  await new Promise((r) => setTimeout(r, 15_000));
}

const browser = await chromium.launch({
  // The module uses crypto.subtle (secure contexts only) and opens ws:// to the relay (blocked on https pages).
  // Fix: open Foundry as http://localhost, which is secure, and resolve "localhost" to the Foundry container.
  args: ["--no-sandbox", "--disable-gpu", ...(process.env.FOUNDRY_HOST ? [`--host-resolver-rules=MAP localhost ${process.env.FOUNDRY_HOST}`] : [])]
});
browser.on("disconnected", () => process.exit(1));
const page = await browser.newPage();
// Foundry enables modules per world, not per user; here the relay's browser gets an empty module in place of the ones not on the list.
// audit-logger stays: it logs to Discord the edits made by this client (the app's).
const ALLOW = (process.env.MODULES_ALLOW ?? "sheet-relay,lib-wrapper,audit-logger").split(",");
// The relay only needs the data: video/YouTube (foundry-tube), images and fonts were ~125% CPU.
await page.route("**/*", (r) => {
  const q = r.request(), url = q.url();
  if (["image", "media", "font"].includes(q.resourceType()) || /youtube|googlevideo|ytimg|ggpht/.test(url)) return r.abort();
  const mod = url.match(/\/modules\/([^/]+)\/.*\.(m?js|css)(\?|$)/);
  if (mod && !ALLOW.includes(mod[1])) return r.fulfill({ contentType: mod[2] === "css" ? "text/css" : "text/javascript", body: mod[2] === "css" ? "" : "export {};" });
  return r.continue();
});
// Foundry's "No canvas" client setting (the ?nocanvas parameter does not work in v13): avoids WebGL and high CPU.
await page.addInitScript(() => {
  localStorage.setItem("core.noCanvas", "true");
  localStorage.setItem("core.performanceMode", "0"); // LOW
  localStorage.setItem("core.maxFPS", "10");
});
await page.goto(`${FOUNDRY_URL}/join`);
await page.selectOption('select[name="userid"]', { label: FOUNDRY_USER });
await page.fill('input[name="password"]', FOUNDRY_PASSWORD);
await page.click('button[name="join"]');
await page.waitForURL("**/game", { timeout: 30_000 });
await page.goto(`${FOUNDRY_URL}/game`);
await page.waitForFunction(() => globalThis.game?.ready, null, { timeout: 120_000 });
const info = await page.evaluate(() => ({ canvasReady: !!globalThis.canvas?.ready, hasStage: !!globalThis.canvas?.stage, webgl: !!globalThis.canvas?.app?.renderer }));
console.log(`logged in as ${FOUNDRY_USER}`, JSON.stringify(info));

if (process.env.DIAG) { // DIAG=1: profiles the page JS and prints the heaviest functions (self time)
  await new Promise((r) => setTimeout(r, 20_000));
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Profiler.enable"); await cdp.send("Profiler.start");
  await new Promise((r) => setTimeout(r, 8_000));
  const { profile } = await cdp.send("Profiler.stop");
  const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  profile.samples.forEach((id, i) => {
    const f = byId.get(id).callFrame; const k = `${f.functionName || "(anon)"} ${f.url.replace(/^https?:\/\/[^/]+/, "")}:${f.lineNumber}`;
    self.set(k, (self.get(k) ?? 0) + (profile.timeDeltas[i] ?? 0));
  });
  const total = [...self.values()].reduce((a, b) => a + b, 0);
  [...self].sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(`${((v / total) * 100).toFixed(1)}%  ${k}`));
  process.exit(0);
}

for (;;) { // watchdog: world reloaded, Foundry off (socket dropped) or tab dead -> restarts the container, which goes back to waiting
  await new Promise((r) => setTimeout(r, 30_000));
  const ok = await page.evaluate(() => !!globalThis.game?.ready && !!globalThis.game.socket?.connected).catch(() => false);
  if (!ok) { console.error("session lost"); process.exit(1); }
}
