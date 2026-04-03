# ESP32-S3-8048S043 — Project TODO

## Status: SD card working ✅, device.yaml integration next

---

## Done

- [x] SD card SPI driver (`components/sd_card`) — mounts FAT32, lists files
- [x] LVGL file explorer UI (`sdcardtests_ui.yaml` + `custom/sdcardtests.h`)
- [x] Touch verified working (colour-cycle test button)
- [x] UART logging fixed (UART0, per-tag filtering)
- [x] Python venv at `./venv/` (esphome 2026.3.2)
- [x] `scripts/flash.sh` + `scripts/logs.sh` use venv, no docker

---

## Next

- [ ] **Integrate SD card into `device.yaml`** — add `sd_card` component, port explorer UI as a tab
- [ ] **Remove touch interrupt pin** from device.yaml if present (use polling like sdcardtests_ui)
- [ ] **React integration** — expose SD file list via HTTP API, connect to web UI
