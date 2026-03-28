#!/usr/bin/env bash
# Start the React dev server on port 3008.
# API calls to /api/* are proxied to the device.
# Usage:
#   ./scripts/dev.sh
#   DEVICE_IP=192.168.1.42 ./scripts/dev.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/../webapp"
export DEVICE_IP="${DEVICE_IP:-esp32-display.local}"

if [ ! -d "$WEBAPP_DIR/node_modules" ]; then
  echo "▶  Installing dependencies..."
  cd "$WEBAPP_DIR" && bun install
fi

echo "▶  Starting dev server on http://localhost:3008"
echo "   API proxy → http://${DEVICE_IP}"
echo ""
cd "$WEBAPP_DIR" && bun run dev
