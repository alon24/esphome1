#!/usr/bin/env bash
# Start the React dev server.
# API calls to /api/* are proxied to the device.
# Usage:
#   ./scripts/dev.sh
#   DEVICE_IP=192.168.1.42 ./scripts/dev.sh
#   VITE_PORT=3009 BASE_PATH=/proxy/3009/ ./scripts/dev.sh  # behind code-server proxy

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/../webapp"
export DEVICE_IP="${DEVICE_IP:-esp32-display.local}"
export BASE_PATH="${BASE_PATH:-/proxy/3009/}"
export VITE_PORT="${VITE_PORT:-3009}"

# Pick package manager: prefer bun, fall back to npm
if command -v bun &>/dev/null; then
  PKG="bun"
else
  PKG="npm"
fi

if [ ! -d "$WEBAPP_DIR/node_modules" ]; then
  echo "▶  Installing dependencies with $PKG..."
  cd "$WEBAPP_DIR" && $PKG install
fi

echo "▶  Starting dev server on http://localhost:${VITE_PORT:-5173}${BASE_PATH} (using $PKG)"
echo "   API proxy → http://${DEVICE_IP}"
echo ""
cd "$WEBAPP_DIR" && $PKG run dev
