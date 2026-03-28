#!/usr/bin/env bash
# Check if the ESP32 device is reachable and responding.
# Usage:
#   ./scripts/check-device.sh
#   DEVICE_IP=192.168.1.42 ./scripts/check-device.sh

set -euo pipefail

DEVICE_IP="${DEVICE_IP:-esp32-display.local}"
TIMEOUT=5

echo "Checking http://${DEVICE_IP}/api/health ..."

RESPONSE=$(curl -sf --max-time "$TIMEOUT" "http://${DEVICE_IP}/api/health" 2>/dev/null || true)

if [ -z "$RESPONSE" ]; then
  echo "✗  Device unreachable at ${DEVICE_IP}"
  echo ""
  echo "   Troubleshooting:"
  echo "   1. Check the device is powered on"
  echo "   2. Check it is on the same WiFi network"
  echo "   3. Try setting DEVICE_IP=<actual-ip> instead of mDNS"
  echo "   4. Check ESPHome logs: esphome logs device.yaml"
  exit 1
fi

echo "✔  Device online — response: $RESPONSE"
echo "   Web UI: http://${DEVICE_IP}"
