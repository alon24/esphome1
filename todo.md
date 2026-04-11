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
- [x] **Interactive Widget Rescaling** — Drag-and-drop handles for visual scaling of buttons/switches directly on the grid
- [x] **Smart Safety Constraints** — Hard clamping for widget movement and resizing; prevents clipping
- [x] **Visual Overflow Alerts** — High-visibility "CLIP!" badges in the Mirror to flag layout violations
- [x] **Keyboard Productivity** — Copy/Paste, Delete, and Escape keys for rapid layout editing
- [x] **High-Precision Persistence** — Fixed anchor-point reset issues with rounded coordinates and float support
- [x] **Persistent Settings** — Slideshow auto-toggle saved across reboots
- [x] **3-Column Architecture** — Hierarchy | Mirror | Inspector for professional dashboard management
- [x] **Multi-Widget Components** — Components are now containers with nested element support
- [x] **Slate-Pro Aesthetics** — Premium glassmorphism and neon-vibrant design system
- [x] **Project Manager** — Sidebar hub for managing multiple Screens and reusable Master Panels
- [x] **Right-Click Context Menu** — Rapid insertion system for widgets and panels on Canvas and Tree
- [x] **Hierarchical Scene Tree** — Professional layer manager visualizing nested relationships
- [x] **Recursive Rendering (V2)** — Rebuilt C++ parser and React renderers for deep panel nesting
- [x] **Page Calibration** — 420px dashed guides reflecting usable vertical space (Height - Header)
- [x] **Origin Hub** — Precision (0,0) crosshair indicators for Master Panel design
- [x] **Hardware Alignment** — 1:1 parity between web designer and ESP32 physical display

---

## Roadmap

- [ ] **Advanced Sensor Graphs** — Custom LVGL chart components mirrored in React
- [ ] **Animated Transitions** — Slide/Fade effects for tab switching on both platforms
- [ ] **Smart OTA Monitoring** — Real-time progress percentage shown on the LCD during flash
