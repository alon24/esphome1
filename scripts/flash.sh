#!/usr/bin/env bash
# Flash ESPHome firmware to the device via USB (first time) or OTA (subsequent).
# Usage:
#   ./scripts/flash.sh                         # uses device.yaml
#   ./scripts/flash.sh device-ili9341.yaml     # flash a different config
#   OTA=1 ./scripts/flash.sh                   # force OTA even if USB is available

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
CONFIG="${1:-device.yaml}"

if ! command -v esphome &>/dev/null; then
  echo "✗  esphome not found. Install it:"
  echo "   pip install esphome"
  exit 1
fi

cd "$ROOT_DIR"
echo "▶  Flashing $CONFIG ..."
esphome run "$CONFIG"
