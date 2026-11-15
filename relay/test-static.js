// App static server: files, fallback to index.html, redirects and ../ protection
import assert from "node:assert";
import http from "node:http";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { staticHandler } from "./static.js";

const dir = mkdtempSync(path.join(tmpdir(), "sr-static-"));
mkdirSync(path.join(dir, "_expo/static/js"), { recursive: true });
writeFileSync(path.join(dir, "index.html"), "<html>app</html>");
writeFileSync(path.join(dir, "_expo/static/js/a.js"), "x=1");
const h = staticHandler({ dir, base: "/ficha" });
const srv = http.createServer(async (req, res) => { if (!(await h(new URL(req.url, "http://x").pathname, res))) { res.writeHead(404); res.end("other"); } });
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const get = (p) => fetch(`http://127.0.0.1:${srv.address().port}${p}`, { redirect: "manual" });
assert.equal((await get("/")).headers.get("location"), "/ficha/");
assert.equal((await get("/ficha")).headers.get("location"), "/ficha/");
assert.equal(await (await get("/ficha/")).text(), "<html>app</html>");
assert.equal(await (await get("/ficha/some/route")).text(), "<html>app</html>"); // app route
const js = await get("/ficha/_expo/static/js/a.js");
assert.equal(js.headers.get("content-type"), "text/javascript; charset=utf-8");
assert.match(js.headers.get("cache-control"), /immutable/);
assert.equal((await get("/ficha/falta.png")).status, 404);
assert.equal((await get("/ficha/..%2f..%2fetc%2fpasswd")).status, 403);
assert.equal(await (await get("/api/x")).text(), "other"); // outside the app: passes through
srv.close(); console.log("ok static");
