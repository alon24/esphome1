#!/usr/bin/env bash
# View ESPHome logs via IP or USB.
#
# Usage:
#   ./scripts/logs.sh                        # default config, auto-detect
#   ./scripts/logs.sh sdcardtests_ui.yaml    # specific config
#   USB=1 ./scripts/logs.sh                  # force USB
#   DEVICE_IP=192.168.1.42 ./scripts/logs.sh # explicit IP

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
CONFIG="${1:-device.yaml}"
DEVICE_IP="${DEVICE_IP:-10.100.102.46}"
TIMEOUT=4

ESPHOME="${ESPHOME:-$ROOT_DIR/venv/bin/esphome}"

cd "$ROOT_DIR"

if [ "${USB:-0}" = "1" ]; then
  echo "▶  Connecting via USB..."
  $ESPHOME logs "$CONFIG" --device /dev/ttyUSB0
elif ping -c 1 -W "$TIMEOUT" "$DEVICE_IP" &>/dev/null; then
  echo "▶  Connecting via IP ($DEVICE_IP)..."
  $ESPHOME logs "$CONFIG" --device "$DEVICE_IP"
elif [ -e /dev/ttyUSB0 ]; then
  echo "▶  IP unreachable, falling back to USB..."
  $ESPHOME logs "$CONFIG" --device /dev/ttyUSB0
else
  echo "✗  Device not reachable at $DEVICE_IP and no USB found."
  exit 1
fi
