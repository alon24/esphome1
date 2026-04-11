#!/usr/bin/env bash
# Build the React app, gzip it, and upload to the device.
# Usage:
#   ./scripts/upload.sh                         # uses DEVICE_IP env or esp32-display.local
#   DEVICE_IP=192.168.1.42 ./scripts/upload.sh

set -euo pipefail

DEVICE_IP="${DEVICE_IP:-10.100.102.46}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEBAPP_DIR="$SCRIPT_DIR/../webapp"
DIST="$WEBAPP_DIR/dist"

echo "▶  Building React app..."
cd "$WEBAPP_DIR"
bun run build

TIMESTAMP=$(date +%s)
FILENAME="app-v80-${TIMESTAMP}.gz"

echo "▶  Gzipping dist/index.html..."
gzip -9 -c "$DIST/index.html" > "$DIST/$FILENAME"

SIZE=$(du -sh "$DIST/$FILENAME" | cut -f1)
echo "   Bundle size: $SIZE ($FILENAME)"

echo "▶  Uploading to http://${DEVICE_IP}/upload?name=${FILENAME}..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/gzip" \
  --data-binary "@$DIST/$FILENAME" \
  --progress-bar \
  "http://${DEVICE_IP}/upload?name=${FILENAME}")

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "✔  Upload successful (HTTP $HTTP_CODE)"
  echo "   App available at http://${DEVICE_IP}"
else
  echo "✗  Upload failed (HTTP $HTTP_CODE)"
  exit 1
fi
