// Simulates the module: token "t-ok" is valid; the relay must forward the token and map the statuses.
import assert from "node:assert";
process.env.TRUST_PROXY = "1"; // the per-IP limit test uses X-Forwarded-For
import { WebSocket } from "ws";
import { server } from "./server.js";

await new Promise((r) => server.listen(0, "127.0.0.1", r));
const port = server.address().port;
const ws = new WebSocket(`ws://127.0.0.1:${port}`);
await new Promise((r) => ws.on("open", r));
const seen = [];
ws.on("message", (d) => {
  const m = JSON.parse(d); seen.push(m);
  const { id, token, type, actorId } = m;
  ws.send(JSON.stringify(
    type === "listUsers" ? { id, ok: true, data: ["ana", "bia"] }
    : type === "status" ? { id, ok: true, data: { ok: true, system: "x", plugin: "x", api: 1 } }
    : type === "login" ? (m.username === "ana" && m.password === "pw" ? { id, ok: true, data: { token: "t-ok", name: "ana" } } : { id, ok: false, status: 401, error: "invalid username or password" })
    : token !== "t-ok" ? { id, ok: false, status: 401, error: "invalid token" }
    : type === "listCharacters" ? { id, ok: true, data: [{ id: "abc" }] }
    : type === "searchCompendium" ? { id, ok: true, data: { pack: m.pack, query: m.query } }
    : type === "subscribe" ? (actorId === "abc" ? { id, ok: true, data: { ok: true } } : { id, ok: false, status: 403, error: "no access" })
    : type === "echo" ? { id, ok: true, data: { actorId: m.actorId, x: m.x } }
    : type === "createCharacter" ? { id, ok: true, data: { name: m.name, actorType: m.actorType } }
    : type === "rollSkill" ? { id, ok: true, data: { skillId: m.skillId, dice: m.dice } }
    : type === "changePassword" ? { id, ok: true, data: { ok: true } }
    : type === "updateCharacter" ? { id, ok: true, data: { id: "abc", hp: m.hp } }
    : actorId === "abc" ? { id, ok: true, data: { id: "abc", name: "Teste" } }
    : actorId === "outro" ? { id, ok: false, status: 403, error: "no access to this actor" }
    : { id, ok: false, status: 404, error: "actor not found" }));
});
const get = async (p, token) => {
  const r = await fetch(`http://127.0.0.1:${port}${p}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
  return [r.status, await r.json()];
};
assert.deepEqual(await get("/api/character/abc", "t-ok"), [200, { id: "abc", name: "Teste" }]);
assert.deepEqual(await get("/api/characters", "t-ok"), [200, [{ id: "abc" }]]);
assert.equal((await get("/api/character/outro", "t-ok"))[0], 403);
assert.equal((await get("/api/character/zzz", "t-ok"))[0], 404);
assert.equal((await fetch(`http://127.0.0.1:${port}/api/characters`, { method: "OPTIONS" })).status, 204); // CORS preflight without token
const post = async (p, body, token) => { const r = await fetch(`http://127.0.0.1:${port}${p}`, { method: "POST", headers: token ? { authorization: `Bearer ${token}` } : {}, body: JSON.stringify(body) }); return [r.status, await r.json()]; };
assert.deepEqual(await post("/api/login", { username: "ana", password: "pw" }), [200, { token: "t-ok", name: "ana" }]); // login does not require a token
assert.equal(seen.at(-1).token, undefined);
assert.deepEqual(await post("/api/password", { oldPassword: "pw", newPassword: "novasenha" }, "t-ok"), [200, { ok: true }]);
assert.equal((await post("/api/password", {})).at(0), 401); // changing the password requires a session
assert.deepEqual(await get("/api/users"), [200, ["ana", "bia"]]); // public: no token
assert.deepEqual(await get("/api/status"), [200, { ok: true, system: "x", plugin: "x", api: 1 }]); // public: no token
assert.deepEqual(await get("/api/packs/fallout.perks/search?q=gun%20nut", "t-ok"), [200, { pack: "fallout.perks", query: "gun nut" }]);
assert.deepEqual(await post("/api/call/rollSkill", { actorId: "abc", skillId: "s1", dice: 3 }, "t-ok"), [200, { skillId: "s1", dice: 3 }]);
assert.deepEqual(await post("/api/call/createCharacter", { name: "Nova", actorType: "robot" }, "t-ok"), [200, { name: "Nova", actorType: "robot" }]);
// SSE: only the owner listens; the Foundry notice arrives as "changed"
assert.equal((await fetch(`http://127.0.0.1:${port}/api/events?actor=outro&t=t-ok`)).status, 403);
const sse = await fetch(`http://127.0.0.1:${port}/api/events?actor=abc&t=t-ok`);
assert.equal(sse.headers.get("content-type"), "text/event-stream");
const reader = sse.body.getReader();
await reader.read(); // ": ok"
ws.send(JSON.stringify({ event: "actor", actorId: "abc" }));
assert.match(new TextDecoder().decode((await reader.read()).value), /data: changed/);
await reader.cancel();
// generic route: forwards the command and arguments; does not let the body override the command or the token
assert.deepEqual(await post("/api/call/echo", { actorId: "abc", x: 1, type: "login", token: "outro" }, "t-ok"), [200, { actorId: "abc", x: 1 }]);
assert.equal(seen.at(-1).type, "echo"); assert.equal(seen.at(-1).token, "t-ok");
assert.deepEqual(await post("/api/call/echo", { actorId: "abc", x: 2, id: "forged" }, "t-ok"), [200, { actorId: "abc", x: 2 }]); // the body id does not become the message id
assert.notEqual(seen.at(-1).id, "forjado");
assert.equal((await post("/api/call/echo", { actorId: "abc" })).at(0), 401); // requires a session
// a ~3 KB body (saveRules, createCharacter) reaches the module; above 64 KB gives 413 without dropping the connection
const grande = "x".repeat(3000);
assert.deepEqual(await post("/api/call/echo", { actorId: "abc", x: grande }, "t-ok"), [200, { actorId: "abc", x: grande }]);
assert.deepEqual(await post("/api/call/createCharacter", { name: grande, actorType: "robot" }, "t-ok"), [200, { name: grande, actorType: "robot" }]);
assert.deepEqual(await post("/api/call/echo", { actorId: "abc", x: "x".repeat(70000) }, "t-ok"), [413, { error: "Request body too large", code: "relay.bodyTooLarge" }]);
const before = seen.length;
assert.equal((await get("/api/character/abc"))[0], 401); // no header: does not even ask Foundry
assert.equal(seen.length, before);
assert.equal((await get("/api/character/abc", "ruim"))[0], 401); // wrong token: 401 comes from the module
assert.deepEqual(await post("/api/login", { username: "ana", password: "wrong" }), [401, { error: "invalid username or password" }]);
// rate limit: 5 failures already counted (no header, bad token, password change without session, call without session, wrong login); 5 more reach 10
for (let i = 0; i < 5; i++) await get("/api/character/abc", "ruim");
assert.equal((await get("/api/character/abc", "t-ok"))[0], 429);
// another player (another IP from the proxy) is not blocked by the first one's failures
const other = await fetch(`http://127.0.0.1:${port}/api/character/abc`, { headers: { authorization: "Bearer t-ok", "x-forwarded-for": "203.0.113.9" } });
assert.equal(other.status, 200);
// RELAY_SECRET: without the secret the WebSocket upgrade is refused (401); with it, it gets in
process.env.RELAY_SECRET = "s3gredo";
const tenta = (q) => new Promise((r) => { const w = new WebSocket(`ws://127.0.0.1:${port}${q}`); w.on("open", () => { w.close(); r("open"); }); w.on("unexpected-response", (_q, res) => r(res.statusCode)); w.on("error", () => {}); });
assert.equal(await tenta(""), 401);
assert.equal(await tenta("?secret=errado"), 401);
assert.equal(await tenta("?secret=s3gredo"), "open");
delete process.env.RELAY_SECRET;
ws.close(); console.log("ok"); server.close(); process.exit(0);
