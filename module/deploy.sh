#!/usr/bin/env bash
# Installs the module: core (module/) + each system's plugin (systems/<id>/module/ -> scripts/systems/<id>/).
# Servidor:  FOUNDRY_HOST=user@host ./deploy.sh fallout   (copies to ~/foundry_<instance>/Data/modules/sheet-relay over ssh)
# Local:     ./deploy.sh --local <Foundry Data folder>    (copies to <Data>/modules/sheet-relay, no ssh)
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)/.."
STAGE="$(mktemp -d "${TMPDIR:-/tmp}/sheet-relay.XXXXXX")"; trap 'rm -rf "$STAGE"' EXIT
bash ./stage.sh "$STAGE"
if [ "${1:-}" = "--local" ]; then
  [ -n "${2:-}" ] || { echo "usage: ./deploy.sh --local <Foundry Data folder>"; exit 1; }
  dest="$2/modules/sheet-relay"; mkdir -p "$dest"; cp -R "$STAGE/." "$dest/"; echo "-> $dest"; exit 0
fi
: "${FOUNDRY_HOST:?set FOUNDRY_HOST=user@host (or use --local <Data folder>)}"
[ $# -gt 0 ] || { echo "specify the instance (e.g. fallout)"; exit 1; }
for i in "$@"; do
  tar czf - -C "$STAGE" . | ssh "$FOUNDRY_HOST" "mkdir -p ~/foundry_$i/Data/modules/sheet-relay && tar xzf - -C ~/foundry_$i/Data/modules/sheet-relay"
  echo "-> foundry_$i"
done
