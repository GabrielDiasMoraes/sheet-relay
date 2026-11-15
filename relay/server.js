import http from "node:http";
import { WebSocketServer } from "ws";
import { timingSafeEqual } from "node:crypto";
import { staticHandler } from "./static.js";

const PORT = process.env.PORT ?? 8787;
const MAX_FAILS = 10, WINDOW_MS = 60_000;
const pending = new Map();
const fails = new Map(); // ip -> [timestamps of auth failures]
let foundry = null; // module (Foundry) connection
const subs = new Map(); // actorId -> Set(res): apps with the sheet open (Server-Sent Events)
let seq = 0;

const wss = new WebSocketServer({ noServer: true });
wss.on("connection", (ws) => {
  foundry = ws;
  ws.on("message", (raw) => {
    const m = JSON.parse(raw);
    if (m.event === "actor") for (const r of subs.get(m.actorId) ?? []) r.write("data: changed\n\n");
    else pending.get(m.id)?.(m);
  });
  ws.on("close", () => { if (foundry === ws) foundry = null; });
});

const ask = (msg) => new Promise((resolve, reject) => {
  if (!foundry) return reject(Object.assign(new Error("Foundry disconnected"), { status: 503, code: "relay.disconnected" }));
  const id = ++seq;
  const t = setTimeout(() => { pending.delete(id); reject(Object.assign(new Error("timeout"), { status: 504 })); }, 60_000);
  pending.set(id, (m) => { clearTimeout(t); pending.delete(id); resolve(m); });
  foundry.send(JSON.stringify({ id, ...msg }));
});

// Player IP for the attempt limit. The relay is only reachable through Caddy (docker network, no host port), and Caddy
// overwrites X-Forwarded-For with the client's real IP; without this all players shared the proxy IP and one
// player's stale session blocked the whole table.
// X-Forwarded-For only counts behind a trusted proxy (TRUST_PROXY=1); directly on the internet anyone could forge the IP and bypass the limit.
const clientIp = (req) => (process.env.TRUST_PROXY && req.headers["x-forwarded-for"]?.split(",").at(-1).trim()) || req.socket.remoteAddress;

const recentFails = (ip) => {
  const l = (fails.get(ip) ?? []).filter((t) => Date.now() - t < WINDOW_MS);
  fails.set(ip, l);
  return l;
};

const routes = [
  ["GET", /^\/api\/users$/, () => ({ type: "listUsers", public: true })],
  ["GET", /^\/api\/status$/, () => ({ type: "status", public: true })], // system and plugin loaded in the world (no token)
  ["GET", /^\/api\/characters$/, () => ({ type: "listCharacters" })],
  ["GET", /^\/api\/character\/([\w-]+)$/, (m) => ({ type: "getCharacter", actorId: m[1] })],
  ["GET", /^\/api\/packs$/, () => ({ type: "listPacks" })],
  ["GET", /^\/api\/packs\/([\w.-]+)\/search$/, (m, body, url) => ({ type: "searchCompendium", pack: m[1], query: url.searchParams.get("q") ?? "" })],
  // Generic route: any module command, arguments in the body. This is what the new apps (e.g. Avatar) use;
  // the module validates the command and the permission, so the relay does not need to know each one.
  ["POST", /^\/api\/call\/(\w+)$/, (m, body) => { const { type: _t, token: _k, id: _i, ...args } = body ?? {}; return { ...args, type: m[1] }; }],
  ["POST", /^\/api\/password$/, (m, body) => ({ type: "changePassword", oldPassword: body.oldPassword, newPassword: body.newPassword })],
  // no token: the only public endpoint; failures count toward the per-IP limit
  ["POST", /^\/api\/login$/, (m, body) => ({ type: "login", username: body.username, password: body.password, public: true })]
];

const MAX_BODY = 64 * 1024;
// Body too large: drains without storing and rejects at the end, so the 413 response arrives (destroying the socket becomes "connection dropped").
const readJson = (req) => new Promise((resolve, reject) => {
  let raw = "", big = false;
  req.on("data", (c) => { if (big) return; raw += c; if (raw.length > MAX_BODY) { big = true; raw = ""; } });
  req.on("error", () => resolve(null));
  req.on("end", () => {
    if (big) return reject(Object.assign(new Error("Request body too large"), { status: 413, code: "relay.bodyTooLarge" }));
    try { resolve(JSON.parse(raw || "{}")); } catch { resolve(null); }
  });
});

// STATIC_DIR (a system's `expo export` folder) makes the relay also serve the app at BASE_PATH (default /ficha). The app calls /sheet-api/...; /api/... still works.
const serveApp = process.env.STATIC_DIR ? staticHandler({ dir: process.env.STATIC_DIR, base: process.env.BASE_PATH ?? "/ficha" }) : null;

export const server = http.createServer(async (req, res) => {
  // Token in a header (no cookie), so "*" opens no CSRF hole.
  const out = (s, body) => { res.writeHead(s, { "content-type": "application/json", "access-control-allow-origin": "*" }); res.end(JSON.stringify(body)); };
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "access-control-allow-origin": "*", "access-control-allow-headers": "authorization,content-type", "access-control-allow-methods": "GET,PATCH,POST,OPTIONS" });
    return res.end();
  }
  const ip = clientIp(req);
  const url = new URL(req.url.replace(/^\/sheet-api(?=\/|$|\?)/, "/api"), "http://relay");
  if (serveApp && req.method === "GET" && !url.pathname.startsWith("/api/") && await serveApp(url.pathname, res)) return;
  const route = routes.map(([method, re, build]) => req.method === method && [url.pathname.match(re), build]).find((r) => r && r[0]);
  if (url.pathname === "/api/events" && req.method === "GET") return events(req, res, url, ip, out);
  if (!route) return out(404, { error: "Not found", code: "relay.notFound" });

  if (recentFails(ip).length >= MAX_FAILS) return out(429, { error: "Too many attempts", code: "relay.tooManyAttempts" });
  const token = req.headers.authorization?.match(/^Bearer (\S+)$/)?.[1];
  const fail401 = (msg = "Invalid token", code = "relay.invalidToken") => { recentFails(ip).push(Date.now()); out(401, { error: msg, ...(code && { code }) }); };
  const isPublic = route[1](route[0], {}, url).public;
  if (!token && !isPublic) return fail401();

  try {
    const body = req.method === "GET" ? {} : await readJson(req);
    if (!body) return out(400, { error: "Invalid JSON", code: "relay.badJson" });
    const { public: _p, ...cmd } = route[1](route[0], body, url);
    const r = await ask({ ...cmd, token });
    if (r.status === 401) return fail401(r.error, r.code ?? null);
    out(r.ok ? 200 : r.status ?? 500, r.ok ? r.data : { error: r.error, code: r.code });
  } catch (e) { out(e.status ?? 500, { error: e.message, code: e.code }); }
});
// GET /api/events?actor=ID&t=TOKEN — EventSource cannot send headers, so the token goes in the URL.
// Keeps the connection open and sends "changed" when the sheet changes in Foundry.
async function events(req, res, url, ip, out) {
  if (recentFails(ip).length >= MAX_FAILS) return out(429, { error: "Too many attempts", code: "relay.tooManyAttempts" });
  const actorId = url.searchParams.get("actor") ?? "", token = url.searchParams.get("t") ?? "";
  if (!/^[\w-]+$/.test(actorId) || !token) { recentFails(ip).push(Date.now()); return out(401, { error: "Invalid token", code: "relay.invalidToken" }); }
  try {
    const r = await ask({ type: "subscribe", actorId, token });
    if (!r.ok) { if (r.status === 401) recentFails(ip).push(Date.now()); return out(r.status ?? 500, { error: r.error, code: r.code }); }
  } catch (e) { return out(e.status ?? 500, { error: e.message, code: e.code }); }
  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive", "access-control-allow-origin": "*" });
  res.write(": ok\n\n");
  if (!subs.has(actorId)) subs.set(actorId, new Set());
  subs.get(actorId).add(res);
  const beat = setInterval(() => res.write(": ping\n\n"), 25_000); // keeps proxies from dropping the idle connection
  req.on("close", () => { clearInterval(beat); subs.get(actorId)?.delete(res); if (!subs.get(actorId)?.size) subs.delete(actorId); });
}

// The Foundry module is what connects here and receives logins and tokens: with RELAY_SECRET only whoever has the secret gets in.
const secretOk = (req) => {
  const want = process.env.RELAY_SECRET;
  if (!want) return true;
  const got = String(new URL(req.url, "http://x").searchParams.get("secret") ?? "");
  const a = Buffer.from(got), b = Buffer.from(want);
  return a.length === b.length && timingSafeEqual(a, b);
};
server.on("upgrade", (req, sock, head) => {
  if (!secretOk(req)) { sock.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n"); return sock.destroy(); }
  wss.handleUpgrade(req, sock, head, (ws) => wss.emit("connection", ws));
});

// Listens only on localhost by default; in Docker, HOST=0.0.0.0 and only Caddy (HTTPS) reaches the port.
if (import.meta.url === `file://${process.argv[1]}`) server.listen(PORT, process.env.HOST ?? "127.0.0.1", () => { console.log(`relay on :${PORT}`); if (!process.env.RELAY_SECRET) console.warn("WARNING: RELAY_SECRET not set; anyone who can reach this port can impersonate Foundry."); });
