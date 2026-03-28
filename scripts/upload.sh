#!/usr/bin/env bash
# Build the React app, gzip it, and upload to the device.
# Usage:
#   ./scripts/upload.sh                         # uses DEVICE_IP env or esp32-display.local
#   DEVICE_IP=192.168.1.42 ./scripts/upload.sh

set -euo pipefail

DEVICE_IP="${DEVICE_IP:-esp32-display.local}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/../webapp"
DIST="$WEBAPP_DIR/dist"

echo "▶  Building React app..."
cd "$WEBAPP_DIR"
bun run build

echo "▶  Gzipping dist/index.html..."
gzip -9 -c "$DIST/index.html" > "$DIST/app.gz"

SIZE=$(du -sh "$DIST/app.gz" | cut -f1)
echo "   Bundle size: $SIZE"

echo "▶  Uploading to http://${DEVICE_IP}/upload..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/gzip" \
  --data-binary "@$DIST/app.gz" \
  --progress-bar \
  "http://${DEVICE_IP}/upload")

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "✔  Upload successful (HTTP $HTTP_CODE)"
  echo "   App available at http://${DEVICE_IP}"
else
  echo "✗  Upload failed (HTTP $HTTP_CODE)"
  exit 1
fi
