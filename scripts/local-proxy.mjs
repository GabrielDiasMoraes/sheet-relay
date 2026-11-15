// Local server WITHOUT Caddy/Docker to use the app on your own machine: serves the built app at /ficha/ and forwards /sheet-api/* to the relay.
// Usage: node scripts/local-proxy.mjs <dist folder> [port=8080] [relay=http://127.0.0.1:8787]
import { createReadStream, existsSync, statSync } from "node:fs";
import http from "node:http";
import { extname, join, normalize } from "node:path";

const [dist, port = "8080", relay = "http://127.0.0.1:8787"] = process.argv.slice(2);
if (!dist || !existsSync(join(dist, "index.html"))) { console.error("usage: node scripts/local-proxy.mjs <dist folder with index.html> [port] [relay]"); process.exit(1); }
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".ico": "image/x-icon", ".svg": "image/svg+xml", ".ttf": "font/ttf", ".woff2": "font/woff2" };
const target = new URL(relay);

export const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://local");
  if (url.pathname.startsWith("/sheet-api/")) { // /sheet-api/x -> relay /api/x (same as Caddy); streams the body and the responses (SSE)
    const up = http.request({ host: target.hostname, port: target.port, method: req.method, path: "/api" + url.pathname.slice("/sheet-api".length) + url.search, headers: { ...req.headers, host: target.host } }, (r) => { res.writeHead(r.statusCode ?? 502, r.headers); r.pipe(res); });
    up.on("error", () => { res.writeHead(502, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "relay unavailable" })); });
    req.pipe(up); return;
  }
  if (url.pathname === "/" || url.pathname === "/ficha") { res.writeHead(302, { location: "/ficha/" }); return res.end(); }
  if (!url.pathname.startsWith("/ficha/")) { res.writeHead(404); return res.end("not found"); }
  let f = normalize(join(dist, decodeURIComponent(url.pathname.slice("/ficha/".length) || "index.html")));
  if (!f.startsWith(normalize(dist))) { res.writeHead(403); return res.end(); } // stay inside the app folder
  if (!existsSync(f) || statSync(f).isDirectory()) f = join(dist, "index.html"); // app routes (SPA)
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream" });
  createReadStream(f).pipe(res);
});
if (import.meta.url === `file://${process.argv[1]}`) server.listen(Number(port), "0.0.0.0", () => console.log(`app at http://localhost:${port}/ficha/  (relay: ${relay})`));
