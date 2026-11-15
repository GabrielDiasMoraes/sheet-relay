#!/usr/bin/env bash
# Full local check (safety net before publishing or refactoring).
# Usage: bash scripts/check.sh [--rapido]   (--rapido skips the apps' typecheck)
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
FAIL=0
step() { echo "== $1"; shift; if "$@"; then :; else echo "FAILED: $*"; FAIL=1; fi; }

for t in module/test/*.test.mjs; do step "test $t" node "$t"; done
step "relay/test.js" node relay/test.js
step "relay/test-static.js" node relay/test-static.js
[ -d systems/dnd5e/content ] && step "catalogs match the generator" node content/roll-mods/build-catalog.mjs --check # the sources only exist in the private fork
[ -f scripts/check-systems.mjs ] && [ -f deploy/docker-compose.yml ] && step "system manifests" node scripts/check-systems.mjs # validates the server infra (deploy/): private fork only

if [ "${1:-}" != "--rapido" ]; then
  for d in systems/*/app; do
    [ -d "$d/node_modules" ] || { echo "(skipping tsc of $d: no node_modules)"; continue; }
    step "typecheck $d" bash -c "cd $d && node node_modules/typescript/bin/tsc --noEmit"
  done
fi

if [ "$FAIL" = 0 ]; then echo "TUDO OK"; else echo "HÁ FALHAS"; exit 1; fi
