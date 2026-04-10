# ESP32-S3-8048S043 — Project TODO
# Status: Final UX Polish — Anchoring & Clamping Implemented 💎

---

## Done

- [x] SD card SPI driver (`components/sd_card`) — mounts FAT32, lists files
- [x] LVGL file explorer UI (`sdcardtests_ui.yaml` + `custom/sdcardtests.h`)
- [x] Touch verified working (GT911 polling)
- [x] UART logging fixed (UART0, per-tag filtering)
- [x] Python venv at `./venv/` (esphome 2026.3.2)
- [x] `scripts/flash.sh` + `scripts/upload.sh` use venv, no docker
- [x] **SD card tab integrated** — `custom/tab_sd.h` included, wired as tab 3
- [x] **SD image viewer** — inline Decoding (stb_image/tjpgd)
- [x] **Slideshow mode** — Full-screen image cycle with stop/start/nav
- [x] **UI Mirror Scaling** — Perfect parity between React Blueprint Mirror and LVGL geometry
- [x] **Top-Left Anchoring** — Switched from center-point to TL corner for easier snapping
- [x] **Widget Clamping** — Size safety caps prevent widgets from bleeding out of blocks
- [x] **mDNS Discovery** — Enabled `esp32-display.local` for zero-config access
- [x] **State Persistence** — SPIFFS-based `grid.json` and `system.json` (settings saved on device)
- [x] **Persistent Settings** — Slideshow auto-toggle saved across reboots

---

## Roadmap

- [ ] **Advanced Sensor Graphs** — Custom LVGL chart components mirrored in React
- [ ] **Animated Transitions** — Slide/Fade effects for tab switching on both platforms
- [ ] **Smart OTA Monitoring** — Real-time progress percentage shown on the LCD during flash
