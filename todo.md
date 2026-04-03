# ESP32-S3-8048S043 — Project TODO

## Status: SD card tab integrated into device.yaml ✅, React HTTP API next

---

## Done

- [x] SD card SPI driver (`components/sd_card`) — mounts FAT32, lists files
- [x] LVGL file explorer UI (`sdcardtests_ui.yaml` + `custom/sdcardtests.h`)
- [x] Touch verified working (colour-cycle test button)
- [x] UART logging fixed (UART0, per-tag filtering)
- [x] Python venv at `./venv/` (esphome 2026.3.2)
- [x] `scripts/flash.sh` + `scripts/logs.sh` use venv, no docker
- [x] **SD card tab integrated into `device.yaml`** — `custom/tab_sd.h` included, wired as tab 3 in `maindashboard.h`
- [x] **SD image viewer** — inline BMP→RGB565 decoder, PNG/JPG pass-through via `LV_IMG_CF_RAW`, scrollable full-screen viewer with Back button
- [x] **SD tab polish** — path label (scrolling), refresh button, directory navigation, SD insert polling via `tab_sd_poll()`

---

## Next

- [ ] **Remove touch interrupt pin** from device.yaml if present (use polling like sdcardtests_ui)
- [ ] **React integration** — expose SD file list via HTTP API, connect to web UI
- [ ] **Slideshow mode** — auto-cycle images from SD card on a timer
