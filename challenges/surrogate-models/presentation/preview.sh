#!/usr/bin/env bash
# Live preview of the whole deck at http://localhost:$PORT/.
#
# Quarto does not watch files pulled in with {{< include >}}, so this polls
# sections/ (and the deck's scripts and styles) and re-renders the deck whenever one changes; the running
# preview server then reloads the browser.
#
# Usage: ./preview.sh [extra quarto preview flags, e.g. --no-browser]
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-4848}"
quarto preview index.md --port "$PORT" "$@" &
quarto_pid=$!

stamp="$(mktemp)"
trap 'kill "$quarto_pid" 2>/dev/null; rm -f "$stamp"' EXIT INT TERM

while kill -0 "$quarto_pid" 2>/dev/null; do
  sleep 1
  if [ -n "$(find sections _afterbody.html _pipeline.html pipeline.js kaldera.js trajectory.js architectures.js custom.scss data/pipeline_snapshot.js data/trajectory_snapshot.js data/explorer -type f -newer "$stamp" -print -quit 2>/dev/null)" ]; then
    touch "$stamp"
    quarto render index.md --quiet || true
  fi
done
