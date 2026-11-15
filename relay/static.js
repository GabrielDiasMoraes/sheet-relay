// Serves the web app (expo export) under BASE (default /ficha): static files + falls back to index.html on app routes.
import { readFile, stat } from "node:fs/promises";
import path from "node:path";

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".css": "text/css", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".ttf": "font/ttf", ".woff2": "font/woff2", ".woff": "font/woff", ".map": "application/json", ".txt": "text/plain" };

export function staticHandler({ dir, base = "/ficha" }) {
  const root = path.resolve(dir);
  const b = ("/" + base.replace(/^\/+|\/+$/g, "")).replace(/^\/$/, "");
  /** @returns {Promise<boolean>} true if the request was for the app (and was already answered) */
  return async (pathname, res) => {
    if (pathname === "/" && b) { res.writeHead(302, { location: `${b}/` }); res.end(); return true; }
    if (b && pathname === b) { res.writeHead(302, { location: `${b}/` }); res.end(); return true; }
    if (b && !pathname.startsWith(`${b}/`)) return false;
    let rel;
    try { rel = decodeURIComponent(pathname.slice(b.length)); } catch { res.writeHead(400); res.end(); return true; }
    let file = path.join(root, rel);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return true; }
    let st = await stat(file).catch(() => null);
    if (st?.isDirectory()) { file = path.join(file, "index.html"); st = await stat(file).catch(() => null); }
    if (!st && !path.extname(rel)) { file = path.join(root, "index.html"); st = await stat(file).catch(() => null); } // app route
    if (!st) { res.writeHead(404, { "content-type": "text/plain" }); res.end("Not found"); return true; }
    const ext = path.extname(file);
    const immutable = /\/_expo\/static\//.test(file);
    res.writeHead(200, { "content-type": MIME[ext] ?? "application/octet-stream", "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache" });
    res.end(await readFile(file));
    return true;
  };
}
