#!/usr/bin/env bash
# Publishes an app (and the module with --module): typecheck, build, checks the bundle and uploads.
# Usage: scripts/publish-app.sh <app|id> [--module] [--dry-run] [--local <Foundry Data folder>] [--serve [port]]
#   Server (default): rsync to the server and, with --module, deploys the module + restarts the headless (ssh). Host: FOUNDRY_HOST (or .publish.env).
#   --local <Data>:    no ssh: with --module copies the module to <Data>/modules/sheet-relay; the app stays in the local dist.
#   --serve [port]:    after the build, serves the app at http://localhost:<port>/ficha/ with /sheet-api proxied to the local relay (scripts/local-proxy.mjs).
#   --dry-run:         typecheck + build in a temp directory; only prints the commands.
# The app and the instance come from the manifest systems/<id>/system.json.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
[ -f "$ROOT/.publish.env" ] && . "$ROOT/.publish.env"   # optional (not versioned): FOUNDRY_HOST=user@host
HOST="${FOUNDRY_HOST:-}"
KEY="${1:-}"; shift || true
MODULE=0; DRY=0; LOCAL=""; SERVE=0; PORT=8080
while [ $# -gt 0 ]; do case "$1" in
  --module) MODULE=1;; --dry-run) DRY=1;;
  --local) LOCAL="${2:?--local needs the Foundry Data folder}"; shift;;
  --serve) SERVE=1; if [[ "${2:-}" =~ ^[0-9]+$ ]]; then PORT="$2"; shift; fi;;
  *) echo "unknown option: $1"; exit 1;; esac; shift; done
INFO="$(node "$ROOT/scripts/system-info.mjs" "$KEY")" || { echo "usage: $0 <app|id> [--module] [--dry-run] [--local <Data>] [--serve [port]]"; exit 1; }
f() { node -e 'console.log(JSON.parse(process.argv[1])[process.argv[2]] ?? "")' "$INFO" "$1"; }
APP="$(f app)"; SYSID="$(f id)"; INST="$(f instance)"
DIR="$ROOT/systems/$SYSID/app" # the server keeps receiving at sheet-app/apps/$APP/dist
cd "$DIR"

echo "== typecheck ($APP)"
node node_modules/typescript/bin/tsc --noEmit

if [ "$DRY" = 1 ]; then OUT="$(mktemp -d "${TMPDIR:-/tmp}/publish-$APP.XXXXXX")"; else OUT="$DIR/dist"; rm -rf "$OUT"; fi
echo "== build -> $OUT"
node node_modules/expo/bin/cli export --platform web --output-dir "$OUT"

shopt -s nullglob
js=("$OUT"/_expo/static/js/web/index-*.js)
[ ${#js[@]} -gt 0 ] || { echo "ERROR: $OUT/_expo/static/js/web/index-*.js does not exist; broken build, not publishing."; exit 1; }
echo "bundle: ${js[0]##*/}"

run() { if [ "$DRY" = 1 ]; then echo "[dry-run] $*"; else echo "+ $*"; "$@"; fi; }
if [ -n "$LOCAL" ]; then
  [ "$MODULE" = 1 ] && run bash "$ROOT/module/deploy.sh" --local "$LOCAL"
  if [ "$SERVE" = 1 ] && [ "$DRY" = 0 ]; then exec node "$ROOT/scripts/local-proxy.mjs" "$OUT" "$PORT"; fi
  [ "$DRY" = 1 ] && echo "(dry-run: nothing was copied)" || echo "Done (local): app at $OUT"
  exit 0
fi
[ "$DRY" = 1 ] || : "${HOST:?set FOUNDRY_HOST=user@host (or .publish.env) or use --local <Data folder>}"
run rsync -rlz --chmod=D755,F644 --delete "$OUT/" "$HOST:sheet-app/apps/$APP/dist/"
if [ "$MODULE" = 1 ]; then
  if [ "$DRY" = 1 ]; then echo "[dry-run] FOUNDRY_HOST=$HOST bash $ROOT/module/deploy.sh $INST"
  else FOUNDRY_HOST="$HOST" bash "$ROOT/module/deploy.sh" "$INST"; fi
  run ssh "$HOST" "cd ~/sheet-app/deploy && docker-compose restart headless-$APP"
  echo "WARNING: the world shows as 'off' in the app for ~90 s while headless-$APP restarts."
fi
[ "$DRY" = 1 ] && echo "(dry-run: nothing was sent; temp dir at $OUT)" || echo "Published: $APP"
