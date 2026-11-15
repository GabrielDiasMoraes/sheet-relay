#!/usr/bin/env node
// Fails if the tree (git ls-files, or the given folder) contains anything that must not go to the PUBLIC repository:
// personal server, server users, non-SRD content, personal email. In the private repo (.private file) it does nothing.
// Usage: node scripts/leak-scan.mjs [folder]
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? new URL("..", import.meta.url).pathname);
if (existsSync(path.join(root, ".private"))) { console.log("leak-scan: private repository (.private), nothing to check"); process.exit(0); }

const RULES = [
  [/\b163\.176\.52\.90\b/, "personal server IP"],
  [/duckdns\.org/i, "duckdns domain"],
  [/\b(Dogmeat|Oogi|Sending Stone)\b/, "personal server relay user"],
  [/\b(Eberron|Phandelver|Descida a Avernus|Descent into Avernus|Avernus|Elturel|Forge of the Artificer)\b/i, "non-SRD content / table"],
  [/world\.(conteudo-dnd-2024|playbooks-ptbr)/, "private world compendium"],
  [/Player'?s Handbook 2024|Livro do Jogador/i, "non-SRD book"],
  [/foundry-manage\.sh|foundry-toggle-watcher/, "personal server scripts"],
  [/gaabrielmooraes@|moraes@/i, "e-mail pessoal"],
  [/@house|fallout\.travel|TravelScreen|travelOptions|Fun[cç][aã]o de Viagem/, "house rule (wasteland travel)", ["module/test/contract.test.mjs"]],
  [/\bBEGIN (RSA|OPENSSH|EC) PRIVATE KEY\b/, "chave privada"],
];
const SKIP_DIR = new Set(["node_modules", ".git", "dist", ".expo", "diagramas"]);
const TEXT = /\.(m?js|cjs|tsx?|json|md|sh|ya?ml|html|txt|css|py|env|example|snippet)$|(^|\/)(Dockerfile|LICENSE|NOTICE|Caddyfile)$/;

const walk = (d) => readdirSync(d).flatMap((f) => { const p = path.join(d, f); return SKIP_DIR.has(f) ? [] : statSync(p).isDirectory() ? walk(p) : [p]; });
let files;
try { files = execFileSync("git", ["-C", root, "ls-files"], { encoding: "utf8" }).split("\n").filter(Boolean).map((f) => path.join(root, f)); } catch { files = walk(root); }
if (!files.length) files = walk(root);

const bad = [];
// PNGs can't be text-scanned: the private (Portuguese, server-specific) diagram dir must never reach the public tree
for (const f of files) if (/(^|\/)docs\/diagramas\//.test(path.relative(root, f))) bad.push(`${path.relative(root, f)}: private diagram image in the public tree`);
for (const f of files) {
  const rel = path.relative(root, f);
  if (rel === "scripts/leak-scan.mjs" || !TEXT.test(rel) || !existsSync(f)) continue;
  const lines = readFileSync(f, "utf8").split("\n");
  lines.forEach((l, i) => RULES.forEach(([re, why, allow]) => { if (!allow?.includes(rel) && re.test(l)) bad.push(`${rel}:${i + 1}: ${why}: ${l.trim().slice(0, 100)}`); }));
}
if (bad.length) { console.error(`leak-scan: ${bad.length} occurrence(s)\n` + bad.slice(0, Number(process.env.LEAK_MAX ?? 60)).join("\n")); process.exit(1); }
console.log(`leak-scan ok (${files.length} arquivos)`);
