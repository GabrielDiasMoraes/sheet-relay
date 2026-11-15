#!/usr/bin/env bash
# Assembles the module in <dest>: module.json + scripts/ (core) + each system's plugin (systems/<id>/module/ -> scripts/systems/<id>/).
# Usage: bash module/stage.sh <destination folder>   (used by deploy.sh and build-zip.sh)
set -e
cd "$(dirname "$0")"
ROOT="$(pwd)/.."
STAGE="${1:?usage: stage.sh <destination folder>}"
mkdir -p "$STAGE/scripts"
cp module.json "$STAGE/"; cp -R scripts/. "$STAGE/scripts/"
for d in "$ROOT"/systems/*/module; do
  id="$(basename "$(dirname "$d")")"; [ "$id" = "_template" ] && continue
  mkdir -p "$STAGE/scripts/systems/$id"; cp -R "$d/." "$STAGE/scripts/systems/$id/"
done
for f in LICENSE NOTICE; do [ -f "$ROOT/$f" ] && cp "$ROOT/$f" "$STAGE/"; done
true
