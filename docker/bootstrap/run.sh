#!/usr/bin/env bash
set -euo pipefail

# tini -g signals the whole group, so children already got it; just stop the setup phase.
trap 'echo "[mcpup-bootstrap] Received termination signal, shutting down"; exit 143' TERM
trap 'echo "[mcpup-bootstrap] Interrupted, shutting down"; exit 130' INT

node /opt/mcpup/bootstrap.mjs
cd "$MCPUP_APP_DIR"

echo "[mcpup-bootstrap] Installing dependencies"
pnpm install --no-frozen-lockfile

if [[ "${MCPUP_SKIP_BUILD}" == "true" ]]; then
  echo "[mcpup-bootstrap] Skipping build (MCPUP_SKIP_BUILD=true)"
else
  echo "[mcpup-bootstrap] Building project"
  pnpm run build
fi

# exec so the app replaces this shell and receives signals from tini directly.
if [[ $# -gt 0 ]]; then
  echo "[mcpup-bootstrap] Starting: $*"
  exec "$@"
fi

echo "[mcpup-bootstrap] Starting server on ${HOST}:${PORT}"
exec pnpm run start -- -p "${PORT}" --host "${HOST}" --with-inspector
