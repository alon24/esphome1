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

# ── Find esphome executable ───────────────────────────────────────────────────
if [ -z "${ESPHOME:-}" ]; then
  if command -v esphome &>/dev/null; then
    ESPHOME="esphome"
  elif [ -x "$ROOT_DIR/venv/bin/esphome" ]; then
    ESPHOME="$ROOT_DIR/venv/bin/esphome"
  elif [ -x "$ROOT_DIR/new_venv/bin/esphome" ]; then
    ESPHOME="$ROOT_DIR/new_venv/bin/esphome"
  else
    echo "✗  esphome not found. Ensure it is in PATH or a venv at $ROOT_DIR/venv"
    exit 1
  fi
fi

cd "$ROOT_DIR"

if [ "${USB:-0}" = "1" ]; then
  echo "▶  Connecting via USB..."
  $ESPHOME logs "$CONFIG" --device /dev/ttyUSB0
elif [ -e /dev/ttyUSB0 ]; then
  echo "▶  USB detected — connecting via serial..."
  $ESPHOME logs "$CONFIG" --device /dev/ttyUSB0
elif ping -c 1 -W "$TIMEOUT" "$DEVICE_IP" &>/dev/null; then
  echo "▶  Connecting via IP ($DEVICE_IP)..."
  $ESPHOME logs "$CONFIG" --device "$DEVICE_IP"
else
  echo "✗  Device not reachable at $DEVICE_IP and no USB found."
  exit 1
fi
