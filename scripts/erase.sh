#!/usr/bin/env bash
# Erase ESP32 flash using esptool.py

set -euo pipefail

PORT="${1:-/dev/ttyUSB0}"

# Try the project's specific esphome_venv first (verified working)
VENV_PYTHON="/root/claude-dev/projects/esphome1/esphome_venv/bin/python3"
if [ -f "$VENV_PYTHON" ]; then
  echo "▶  Using esptool from esphome_venv..."
  "$VENV_PYTHON" -m esptool --port "$PORT" erase_flash
# Fallback to system module
elif python3 -m esptool version &>/dev/null; then
  echo "▶  Using esptool python module..."
  python3 -m esptool --port "$PORT" erase_flash
# Or the standard command
elif command -v esptool.py &>/dev/null; then
  echo "▶  Using esptool.py command..."
  esptool.py --port "$PORT" erase_flash
else
  echo "✗  esptool not found."
  exit 1
fi

echo "✔  Erase complete."
