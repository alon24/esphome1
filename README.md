# ESP32 Display — ESPHome + React SPA (v110-GRIDOS-ULTIMATE)

A professional-grade, high-fidelity media station and UI designer powered by an ESP32-S3. This project features a **Memory-Persistent Digital Twin Designer** with pixel-perfect hardware parity, standalone WiFi Access Point modes, and a resilient autonomous filesystem engine.

## ✅ DONE
- [x] **Project Manager**: Sidebar hub for Screens and Master Panels.
- [x] **Recursive Rendering**: Nested panel-ref support (Device & Web).
- [x] **Autonomous Persistence**: Filesystem self-mounts for 100% reliable layout restoration on boot.
- [x] **Standalone AP Mode**: Hotspot support with custom SSID/Password and "Always On" capability.
- [x] **Industrial Widget Suite**: Roller, Dropdown, Arc, Bar, Switch, and Label with real-time hardware sync.
- [x] **Smart Refreshes**: Background UI commit to physical hardware on designer "Sync".
- [x] **Stable Lifecycle**: Parent-anchored rendering to prevent race conditions and memory resets.

## 🛠 PENDING
- [ ] **Performance optimization** for very deep nests (>8 levels).
- [ ] **State export/import** for full project backup (local JSON download).
- [ ] **Advanced Sensor Graphs**: Real-time plotting mirrored in LVGL/React.
- [ ] **Touch event tunneling** for deeper nested items.

## Hardware

| Board | ESP32-S3-WROOM-1 N16R8 (16 MB flash, 8 MB PSRAM) |
|-------|--------------------------------------------------|
| Display | 4.3" 800×480 RGB parallel (ST7262) |
| Touch | GT911 capacitive (I2C) |
| Config files | `device.yaml` (main) |
| Hardware details | [DEVICE_NOTES.md](./DEVICE_NOTES.md) |

## Status: 🥇 v110 ULTIMATE - Field-Ready Designer
**The studio now operates as a robust, persistent standalone environment.**

### Key Features
- **Deterministic Restore**: The hardware consumes its own Digital Twin state from SPIFFS on every power cycle.
- **Standalone WiFi Orchestration**: Configure SSID/Pass in the builder; hardware acts as a primary AP.
- **Precision 1:1 Rendering**: LVGL 8.4 engine maps React widgets with absolute coordinate parity.
- **Autonomous Mount**: Filesystem ready-checks ensure data integrity before UI initialization.
- **mDNS Zero-Config**: Access the dashboard at `http://esp32-display.local/` or via AP IP `192.168.4.1`.
- **SD Media Engine**: Interactive slideshow with touch navigation and remote control.

---

## Requirements

| Tool | Version | Notes |
|------|---------|-------|
| ESPHome | 2026.3.2 | Pre-installed in `venv/` — no global install needed |
| Python | 3.12 | Required to recreate venv if needed |
| Bun | latest | `curl -fsSL https://bun.sh/install \| bash` |
| curl | any | Pre-installed on most systems |

> **ESPHome venv**: A working Python venv is at `./venv/`. The flash and log scripts use it automatically. To recreate it: `python3 -m venv venv && venv/bin/pip install esphome`

---

## Quick reference

### Flash firmware to device

```bash
# Auto-detect (USB if offline, OTA if online)
./scripts/flash.sh

# Force USB (device must be connected via USB-C)
USB=1 ./scripts/flash.sh

# Force OTA to a specific IP
DEVICE_IP=192.168.1.42 ./scripts/flash.sh
```

The script bumps the version number, compiles, flashes, and verifies the running version in device logs.

---

### View device logs (serial or OTA)

```bash
# Auto-detect (USB or IP)
./scripts/logs.sh

# Specific config
./scripts/logs.sh sdcardtests_ui.yaml

# Force USB
USB=1 ./scripts/logs.sh

# Explicit IP
DEVICE_IP=192.168.1.42 ./scripts/logs.sh
```

Press `Ctrl+C` to stop. Logs stream in real time at the configured log level.

---

### Run React UI locally

```bash
# Proxy API calls to device on mDNS
./scripts/dev.sh

# Proxy to a specific IP
DEVICE_IP=192.168.1.42 ./scripts/dev.sh
```

Opens at **http://localhost:5173**. Hot-reload is active — edits to `webapp/src/` apply instantly. The device does not need to be connected for frontend-only work.

> **Note:** Port 5173 must be the mapped/exposed Docker port. If something else is already using 5173, set `VITE_PORT=<other-mapped-port> ./scripts/dev.sh`.

---

### Push React app to device

```bash
# Build + gzip + upload via HTTP (device must be on WiFi)
./scripts/upload.sh

# With explicit IP
DEVICE_IP=192.168.1.42 ./scripts/upload.sh
```

No firmware reflash needed — uploads to SPIFFS over WiFi and is served immediately at `http://esp32-display.local/`.

---

## First-time setup

### 1. Fill in your credentials

Edit `secrets.yaml`:

```yaml
wifi_ssid: "your-network"
wifi_password: "your-password"
api_password: "choose-a-password"
ota_password: "choose-a-password"
```

### 2. Flash the firmware via USB

Connect the board via USB, then:

```bash
./scripts/flash.sh
```

This compiles and uploads the ESPHome firmware. After this, all future firmware updates can be done over WiFi (OTA).

### 3. Install webapp dependencies

```bash
cd webapp && bun install
```

---

## React development

Start the local dev server on **port 3008**. API calls to `/api/*` are proxied to the device automatically.

```bash
# Device on mDNS (default)
./scripts/dev.sh

# Device on a fixed IP
DEVICE_IP=192.168.1.42 ./scripts/dev.sh
```

Open [http://localhost:3008](http://localhost:3008) in your browser.

The device does **not** need to be connected for frontend-only work. Connect it when you need to test live API calls.

---

## Deploy webapp to device

Builds the React app, gzips it into a single file, and uploads it to the device filesystem. **No firmware reflash needed.**

```bash
./scripts/upload.sh

# With explicit IP
DEVICE_IP=192.168.1.42 ./scripts/upload.sh
```

What it does:
1. `bun run build` — Vite bundles everything into one `index.html` (JS + CSS inlined)
2. `gzip -9` — compresses to `dist/app.gz`
3. `curl POST /upload` — streams the gzip to the device
4. Device saves it to SPIFFS and serves it at `http://<device>/`

---

## Check device connectivity

```bash
./scripts/check-device.sh

# With explicit IP
DEVICE_IP=192.168.1.42 ./scripts/check-device.sh
```

Output on success:
```
✔  Device online — response: {"status":"ok"}
   Web UI: http://10.100.102.46
```

---

## Device endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serves the React SPA (gzip) |
| `/api/health` | GET | `{"status":"ok"}` — connectivity check |
| `/upload` | POST | Upload new `app.gz` (Content-Type: application/gzip) |

---

## Project layout

```
esphome1/
├── device.yaml              ← Main config (ESP32-S3 800×480)
├── partitions.csv           ← 16 MB flash: dual OTA + SPIFFS
├── secrets.yaml             ← WiFi / OTA credentials (gitignored)
├── version.txt              ← Current firmware version number
├── custom/
│   ├── ui_helpers.h         ← Shared LVGL panel/label helpers
│   ├── maindashboard.h      ← Header, footer nav, tab orchestrator
│   ├── tab_home.h           ← HOME tab: clock, date, uptime
│   ├── tab_settings.h       ← SETTINGS tab: device info
│   ├── tab_wifi.h           ← WIFI tab: scan, password, connect
│   ├── wifi_setup.h         ← WiFi scan + connect helpers (ESP-IDF)
│   └── version_info.h       ← Auto-generated FW_VERSION_STR (flash.sh)
├── components/
│   └── react_spa/           ← ESPHome custom component
│       ├── __init__.py      ← Component registration
│       └── react_spa.h      ← HTTP server + SPIFFS (ESP-IDF)
├── webapp/
│   ├── src/
│   │   ├── App.tsx          ← Edit this to build your browser UI
│   │   └── main.tsx
│   ├── vite.config.ts       ← Dev server (port 3008) + API proxy
│   └── package.json
└── scripts/
    ├── dev.sh               ← Start React dev server
    ├── upload.sh            ← Build + gzip + push to device
    ├── check-device.sh      ← Ping device health endpoint
    └── flash.sh             ← Bump version, compile, flash USB/OTA
```

---

## LVGL (on-device UI)

The local touchscreen UI is built with LVGL 8.4.0 via custom C++ headers included in `device.yaml`. The React web app and LVGL display run independently.

### Tab layout (800×480)

```
y=0    ┌────────────────────────────────────────────────────┐
       │  CYANIDE •           v6         192.168.x.x        │  ← Header (64px)
y=64   ├────────────────────────────────────────────────────┤
       │                                                    │
       │            Tab content (800×352)                   │
       │   HOME | SETTINGS | WIFI                           │
       │                                                    │
y=416  ├────────────────────────────────────────────────────┤
       │   [ HOME ]        [ SETTINGS ]       [ WIFI ]      │  ← Footer nav (64px)
y=480  └────────────────────────────────────────────────────┘
```

### Tab files

| File | Tab | Content |
|------|-----|---------|
| `custom/tab_home.h` | HOME (default) | Live clock, date, network status, **Blueprint Mirror (80x80 grid)** |
| `custom/tab_settings.h` | SYSTEM | IP info, uptime, board/framework versions |
| `custom/tab_wifi.h` | WIFI | Network scan list, SSID/pass entry, active connection mgmt |
| `custom/tab_sd.h` | SD (Director) | High-perf image browser (BMP/JPG/PNG), Slideshow controller |
| `custom/maindashboard.h` | Orchestrator | Header, vertical nav, tab switching, global API pulse |

### 💎 Digital Twin Mirror
The web dashboard features a **Blueprint Mirror** that provides real-time parity with the physical display. Drag, drop, and resize elements in your browser; they sync to the hardware with pixel-perfect accuracy.

### 🖼 Slideshow Mode
The system includes an automatic slideshow engine that cycles through SD card images after 30s of inactivity. It can be remotely controlled via the **Director** tab in the web UI.

### Critical: byte_order must be little_endian

```yaml
lvgl:
  color_depth: 16
  byte_order: little_endian   # REQUIRED — default big_endian causes pink/magenta colors
```

Without this, all grays appear as pink/magenta on the RGB parallel display.

### Enabling font sizes

ESPHome only compiles LVGL fonts referenced in YAML. Add off-screen dummy labels to force compilation:

```yaml
- label:
    text: ""
    x: -200
    y: -200
    text_font: MONTSERRAT_48
```

---

## OTA firmware updates (after first flash)

```bash
./scripts/flash.sh
```

ESPHome detects the device on the network and uploads over WiFi automatically.

---

## SD Card

The board uses **SPI** for the SD card (not SDMMC). Pins: CS=GPIO10, MOSI=11, CLK=12, MISO=13. FAT32 format required.

### SD Card UI test firmware

`sdcardtests_ui.yaml` is a standalone config with an LVGL file browser — useful for verifying the SD card works before integrating into the main firmware.

```bash
# Flash the SD UI test
./scripts/flash.sh sdcardtests_ui.yaml

# Watch SD card logs (filtered)
./scripts/logs.sh sdcardtests_ui.yaml
```

Look for `[sd_card]: SD card mounted OK` and a directory listing in the logs. The display will show a scrollable file browser.

### SD card not mounting?

See [DEVICE_NOTES.md](./DEVICE_NOTES.md) for the full list of gotchas. Quick checklist:
1. Card formatted FAT32
2. `board_build.flash_mode: qio` present in yaml
3. `CONFIG_VFS_SUPPORT_IO/POSIX` set in sdkconfig_options
4. `vfs` in component CMakeLists REQUIRES
5. GPIO38 pulled HIGH before SD init in component setup()

### Wipe device (boot-loop recovery)
```bash
./scripts/erase.sh
```

---

## Troubleshooting

**Device not found by mDNS (`esp32-display.local`)**
→ Use the IP address directly: find it in your router's DHCP table or ESPHome logs (`esphome logs device.yaml`), then set `DEVICE_IP=<ip>` before any script.

**Upload returns non-200**
→ Run `./scripts/check-device.sh` first to confirm connectivity. Check SPIFFS has free space via ESPHome logs.

**Blank display after flash**
→ The backlight defaults to ON. If the screen stays black, check `GPIO2` backlight pin. Verify display pin assignments in `device.yaml` match your board revision.

**Build fails (Arduino libs missing)**
→ ESPHome auto-installs `AsyncTCP` and `ESP Async WebServer` for Arduino-framework configs. Let the first build complete fully before editing.
