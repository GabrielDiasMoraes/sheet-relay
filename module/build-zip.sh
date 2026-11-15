#!/usr/bin/env bash
# Generates the files of a Foundry Release: dist/module.json (manifest) + dist/module.zip (module.json at the root).
# Usage: bash module/build-zip.sh <version> [repository owner/name]   (default: $GITHUB_REPOSITORY or GabrielDiasMoraes/sheet-relay)
set -e
cd "$(dirname "$0")"
VERSION="${1:?usage: build-zip.sh <version, e.g. 1.0.0>}"
REPO="${2:-${GITHUB_REPOSITORY:-GabrielDiasMoraes/sheet-relay}}"
OUT="$(pwd)/../dist"; STAGE="$(mktemp -d "${TMPDIR:-/tmp}/sheet-relay-zip.XXXXXX")"; trap 'rm -rf "$STAGE"' EXIT
rm -rf "$OUT"; mkdir -p "$OUT"
bash ./stage.sh "$STAGE"
rm -rf "$STAGE/scripts/test" # tests are not shipped in the package
node - "$STAGE/module.json" "$VERSION" "$REPO" <<'JS'
const fs = require("fs"); const [file, version, repo] = process.argv.slice(2);
const m = JSON.parse(fs.readFileSync(file, "utf8"));
const base = `https://github.com/${repo}`;
Object.assign(m, { version, url: base, bugs: `${base}/issues`, readme: `${base}#readme`,
  manifest: `${base}/releases/latest/download/module.json`, download: `${base}/releases/download/v${version}/module.zip` });
fs.writeFileSync(file, JSON.stringify(m, null, 2) + "\n");
JS
cp "$STAGE/module.json" "$OUT/module.json"
(cd "$STAGE" && python3 -m zipfile -c "$OUT/module.zip" $(ls -A))
echo "-> $OUT/module.json e $OUT/module.zip"; python3 -m zipfile -l "$OUT/module.zip" | head -5
