# ESP32 Display — ESPHome + React SPA

ESP32-S3 display board running ESPHome firmware with a React web app served directly from the device. LVGL handles the local touchscreen UI; React handles the browser UI.

## Hardware

| Board | ESP32-S3-WROOM-1 N16R8 (16 MB flash, 8 MB PSRAM) |
|-------|--------------------------------------------------|
| Display | 4.3" 480×272 RGB parallel (ST7262) |
| Touch | GT911 capacitive (I2C) |
| Config files | `device.yaml` (main), `device-ili9341.yaml`, `device-ili9485.yaml` |

---

## Requirements

| Tool | Install |
|------|---------|
| ESPHome 2023.11+ | `pip install esphome` |
| Bun | `curl -fsSL https://bun.sh/install \| bash` |
| curl | pre-installed on most systems |

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
# or for a specific config:
./scripts/flash.sh device-ili9341.yaml
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
   Web UI: http://esp32-display.local
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
EspHome1/
├── device.yaml              ← ESP32-S3 4827S043 (main board)
├── device-ili9341.yaml      ← Generic ESP32 + ILI9341 240×320
├── device-ili9485.yaml      ← Generic ESP32 + ILI9485 320×480
├── partitions.csv           ← 16 MB flash: dual OTA + SPIFFS
├── secrets.yaml             ← WiFi / OTA credentials (gitignored)
├── components/
│   └── react_spa/           ← ESPHome custom component
│       ├── __init__.py      ← Component registration
│       └── react_spa.h      ← HTTP server + SPIFFS (ESP-IDF)
│                               or AsyncWebServer + LittleFS (Arduino)
├── webapp/
│   ├── src/
│   │   ├── App.tsx          ← Edit this to build your UI
│   │   └── main.tsx
│   ├── vite.config.ts       ← Dev server (port 3008) + API proxy
│   └── package.json
└── scripts/
    ├── dev.sh               ← Start React dev server
    ├── upload.sh            ← Build + gzip + push to device
    ├── check-device.sh      ← Ping device health endpoint
    └── flash.sh             ← Flash ESPHome firmware via USB/OTA
```

---

## LVGL (on-device UI)

The local display is managed by LVGL. Edit the `lvgl:` section in `device.yaml` to build the on-screen UI. The React web app and the LVGL display run independently.

```yaml
lvgl:
  pages:
    - id: main_page
      widgets:
        - label:
            text: "My Label"
            align: CENTER
        - button:
            id: my_btn
            ...
```

---

## OTA firmware updates (after first flash)

```bash
./scripts/flash.sh
```

ESPHome detects the device on the network and uploads over WiFi automatically.

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
