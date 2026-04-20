# GridOS Smart Components — Implementation Tracker

Smart Components are **interactive native C++ widgets** placed anywhere on a screen via the editor.
They look like regular widgets in JSON (`type: "component"`) but render full C++ logic on-device.

---

## Core Infrastructure

### A. Data Model (grid_config.h)
- [x] **A1** — Add `std::string component;` field to `GridItem` struct
- [x] **A2** — Add `it.component = eObj["component"] | "";` to `parse_grid_item()`
- [x] **A3** — Verify JSON serialization in `grid_config_save` round-trips the `component` field

### B. C++ Renderer Dispatch (tab_home.h)
- [x] **B1** — In `_home_render_item`, add `if (it.type == "component")` branch
- [x] **B2** — Create container: `lv_obj_create(parent)` sized to `it.w × it.h` at `it.x, it.y`
- [x] **B3** — `_panel_reset(comp_cont)` + bg color from `it.color`
- [x] **B4** — Dispatch `it.component == "wifi-panel"` → `tab_wifi_create_embedded(comp_cont)`
- [x] **B5** — Dispatch `it.component == "sd-browser"` → `tab_sd_create_embedded(comp_cont)`
- [x] **B6** — Dispatch `it.component == "system-settings"` → `tab_settings_create(comp_cont)`

### C. Editor → Device JSON (App.tsx) ✅ Done
- [x] **C1** — `component` field added to `GridItem` TypeScript type
- [x] **C2** — `SMART_COMPONENTS` registry defined with id, label, desc, preview, defaultW/H
- [x] **C3** — "🧩 SMART COMPONENTS" sidebar section with card list
- [x] **C4** — Drag-and-drop support (sets type/component/w/h in dataTransfer)
- [x] **C5** — Click-to-add using `addItem("component", ...)` with `itemOverride`
- [x] **C6** — Canvas preview renders mockup image at widget bounds
- [x] **C7** — `addItem` updated to accept `itemOverride?: Partial<GridItem>`
- [ ] **C8** — Handle `component` field in canvas drop handler (read from `dataTransfer`)
- [ ] **C9** — Inspector panel: show component name (read-only) + bounds x/y/w/h fields
- [ ] **C10** — Sync: include `component` field in JSON payload sent to device

---

## WiFi Panel Component

### D. `tab_wifi_create_embedded(lv_obj_t* parent)` in tab_wifi_embedded.h
- [x] **D1** — Created `tab_wifi_create_embedded(lv_obj_t* parent)`
- [x] **D2** — Derive layout from parent bounds
- [x] **D3** — Left/right panel split (40/60)
- [x] **D4** — Left SSID list with scrollable container
- [x] **D5** — Right panel: SSID + PASSWORD textareas
- [x] **D6** — SCAN (green) + CONN (blue) buttons
- [x] **D7** — Status label
- [x] **D8** — Auto-populate from saved credentials
- [x] **D9** — Floating keyboard anchored to screen bottom

### E. Non-Blocking WiFi Scan
- [x] **E1** — `g_cwifi_scanning` / `g_cwifi_scan_done` volatile flags
- [x] **E2** — `_cwifi_scan_task()` FreeRTOS background task
- [x] **E3** — `_cwifi_start_scan_bg()` guard + `xTaskCreate()`
- [x] **E4** — SCAN button wired to `_cwifi_start_scan_bg()` (non-blocking)
- [x] **E5** — `tab_wifi_component_tick()` polls flag and calls `_cwifi_populate_list()`
- [x] **E6** — `tab_wifi_component_tick()` called from `tab_home_tick()` every second

---

## SD Card Browser Component

### F. SD Browser Layout — `tab_sd_create_embedded(lv_obj_t* parent)` in tab_sd_embedded.h
- [x] **F1** — Created `tab_sd_create_embedded(lv_obj_t* parent)`
- [x] **F2** — 40/60 left/right panel split
- [x] **F3** — Header bar, path breadcrumb, scrollable file list
- [x] **F4** — ⬆ Up button navigates to parent directory
- [x] **F5** — Right panel: "Select a file to preview" placeholder
- [x] **F6** — Image viewer via stb_image (JPEG/BMP), scaled to fit right panel
- [x] **F7** — Toolbar: ⬅ BACK and 🗑 DELETE buttons
- [x] **F8** — File list rows: 📁 folder, 🖼 image, 📄 file icons + filenames
- [x] **F9** — Folder click → `_csd_scan_dir()` navigation
- [x] **F10** — Image click → load and render in right viewer
- [x] **F11** — Non-image click → show filename + size
- [x] **F12** — Delete: `lv_msgbox_create` confirm → `unlink()` + list refresh
- [x] **F13** — SD mount check; shows "NOT MOUNTED" error if SD absent

### G. SD Component Tick
- [ ] **G1** — Check `esphome::sd_card::g_sd_newly_mounted` flag in `tab_home_tick()` and call `_sd_refresh_list()` if true

---

## System Settings Component

### H. `tab_settings_create(lv_obj_t* parent)` — Already exists, just needs bounds-relative layout
- [ ] **H1** — Audit `tab_settings.h` for any hardcoded pixel sizes that assume 800×416 parent
- [ ] **H2** — Replace hardcoded widths/heights with `lv_obj_get_width(parent)` / `lv_obj_get_height(parent)` where needed

---

## Editor Integration Polish

### I. Drag-and-Drop onto Canvas
- [ ] **I1** — In canvas `onDrop` handler, check if `type === "component"` and read `component` from dataTransfer
- [ ] **I2** — Call `addItem("component", ...)` with the matching `itemOverride` (component id, defaultW, defaultH, color)

### J. Inspector Panel
- [ ] **J1** — When selected item has `type === "component"`, show a "Smart Component" badge in inspector header
- [ ] **J2** — Show component name (read-only, human-readable from `SMART_COMPONENTS` registry)
- [ ] **J3** — Show editable x, y, w, h fields (same as any widget)
- [ ] **J4** — Show hint: _"This component renders natively on device. Internal layout adapts to the bounds you set."_

### K. SYNC Payload
- [ ] **K1** — Verify `syncToDevice` serializes `component` field in the JSON item output
- [ ] **K2** — Test round-trip: sync → device → verify `_home_render_item` receives `it.component == "wifi-panel"`

---

## Testing Checklist
- [ ] **T1** — Place WiFi component next to nav panel on same screen, sync, verify both render
- [ ] **T2** — Click SCAN button on WiFi component, verify display doesn't freeze during 2s scan
- [ ] **T3** — Tap a network row → SSID textarea populates
- [ ] **T4** — Place SD Browser component on a screen, sync, verify file list populates
- [ ] **T5** — Tap a folder in SD Browser → navigates into folder
- [ ] **T6** — Tap an image file → renders in right viewer panel
- [ ] **T7** — Resize WiFi component in editor (narrow/wide), sync, verify layout adapts
- [ ] **T8** — Delete a file from SD Browser via confirm dialog

---

## Priority Order (Suggested)

```
A1 → A2 → B1 → B2 → B3 → B4   (core dispatch pipeline)
D1 → D2 → D3 → D4 → D5 → D6   (WiFi panel basic layout)
E1 → E2 → E3 → E4 → E5 → E6   (non-blocking scan)
F1 → F2 → F3 → F4 → F5 → F6   (SD browser basic layout)
F7 → F8 → F9 → F10 → F11       (SD browser interactions)
C8 → C9 → C10 → I1 → I2        (editor polish)
T1 → T2 → T3 → T4 → T5         (testing)
```
