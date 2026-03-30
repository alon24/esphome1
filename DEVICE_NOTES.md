# ESP32-8048S043 — Knowledge Transfer

Everything learned building the WiFi setup UI on this board. Written to bootstrap a raw ESP-IDF project.

---

## Hardware

| Item | Value |
|---|---|
| Board | ESP32-8048S043 (Sunton/Elecrow variant) |
| SoC | ESP32-S3, dual-core 240 MHz |
| Flash | 16 MB |
| PSRAM | 8 MB OPI (octal, 80 MHz) |
| Display | 4.3" RGB parallel TFT, 800×480, ST7262 panel |
| Touch | GT911 capacitive, I2C |
| Backlight | GPIO2 (LEDC PWM) |

---

## Display Pin Mapping

### Control signals
| Signal | GPIO |
|---|---|
| HSYNC | 39 |
| VSYNC | 41 |
| DE (Data Enable) | 40 |
| PCLK | 42 |

### Data pins (RGB565 — 16-bit)

Physical GPIO↔display wire mapping (hardware fixed):

| Channel | GPIOs (LSB → MSB, i.e. bit0 first) |
|---|---|
| Red (5 bits) | 45, 48, 47, 21, 14 |
| Green (6 bits) | 5, 6, 7, 15, 16, 4 |
| Blue (5 bits) | 8, 3, 46, 9, 1 |

**CRITICAL — Pin order in device.yaml must be LSB-first (not MSB-first).**

ESPHome's `mipi_rgb/display.py` applies `dpins = dpins[8:16] + dpins[0:8]` (a byte-swap) after concatenating `[blue_pins + green_pins + red_pins]`. This transform is designed for LSB-first ordering. If pins are listed MSB-first, R and B channel data end up swapped on the physical wires, causing red to appear as blue.

Correct device.yaml data_pins block:
```yaml
data_pins:
  red:   [45, 48, 47, 21, 14]   # R0 LSB → R4 MSB
  green: [5, 6, 7, 15, 16, 4]   # G0 LSB → G5 MSB
  blue:  [8, 3, 46, 9, 1]        # B0 LSB → B4 MSB
```

---

## Touch (GT911)

| Signal | GPIO |
|---|---|
| SDA | 19 |
| SCL | 20 |
| RST | 38 |
| INT | 18 |
| I2C freq | 400 kHz |

**WARNING:** Do NOT set `interrupt_pin: GPIO18` in ESPHome. The GT911 uses the INT pin state during reset to select its I2C address (0x5D vs 0x14). ESPHome's GT911 driver drives the INT pin during reset in a way that puts the chip on the wrong address, breaking all touch. Leave `interrupt_pin` unset — the driver falls back to polling which works correctly.

---

## Display Timing (confirmed working)

```c
.pclk_hz           = 18 * 1000 * 1000,   // 18 MHz — max before distortion
.hsync_pulse_width = 4,
.hsync_back_porch  = 8,
.hsync_front_porch = 8,
.vsync_pulse_width = 4,
.vsync_back_porch  = 8,
.vsync_front_porch = 8,
.flags.pclk_active_neg = true,            // CRITICAL — inverted clock
```

### What was tried and failed

| Config | Result |
|---|---|
| pclk 16 MHz, porches 8/8/4 | Works but smearing |
| pclk 12 MHz, large porches | Wrong colors |
| pclk 14 MHz, large porches (40/40/48 H, 32/13/1 V) | Flickering — ~28 fps too low |
| pclk 16 MHz, large porches | Flickering — ~33 fps still too low |
| pclk 16 MHz, medium porches (16/16/8) | Worse flickering |
| `pclk_active_neg = false` | Display shows garbage / nothing |

**Key insight:** The ST7262 datasheet porches (40/40/48 H, 32/13/1 V) drop the refresh rate below the panel's minimum (~35 fps), causing flicker. The minimal porches (8/8/4) are what this specific panel wants — smearing is caused by a different issue (single framebuffer DMA contention), not wrong timing.

---

## Framebuffer / Flickering — The Real Problem

### Root cause
The ESP-IDF RGB LCD driver (`esp_lcd_new_rgb_panel`) uses DMA to continuously read from the framebuffer in PSRAM and feed the panel. LVGL writes to the same PSRAM framebuffer. Without synchronisation, LVGL writes during DMA reads → tearing / flickering.

### ESPHome's workaround (broken)
ESPHome's `rpi_dpi_rgb` component calls `esp_lcd_rgb_panel_restart()` **on every loop tick**. This was restarting the DMA every ~10ms which itself caused the flickering. Removing it improved things somewhat.

ESPHome also uses a SRAM bounce buffer (`bounce_buffer_size_px = width * 10`), which helps but doesn't eliminate the problem.

### The real fix: double framebuffer
Use `num_fbs = 2` in `esp_lcd_rgb_panel_config_t`. The driver allocates two full PSRAM framebuffers. DMA reads from one while LVGL writes to the other, swapping on vsync.

```c
esp_lcd_rgb_panel_config_t panel_config = {
    .num_fbs             = 2,
    .bounce_buffer_size_px = 0,
    .psram_trans_align   = 64,
    .flags = {
        .fb_in_psram = true,
        .double_fb   = true,
    },
    // ... timing as above
};
```

**ESPHome cannot do this** because:
1. ESPHome hardcodes `num_fbs = 1` in `rpi_dpi_rgb.cpp`
2. Proper double buffering requires registering a vsync callback to coordinate which buffer LVGL writes to — ESPHome's LVGL flush callback doesn't do this
3. Patching `num_fbs = 2` alone without the vsync coordination causes the display to show a zoomed-in/offset image because `esp_lcd_panel_draw_bitmap` addresses the buffers differently

### Partial ESPHome fix applied
Added to `sdkconfig_options`:
```yaml
CONFIG_LCD_RGB_RESTART_IN_VSYNC: "y"
```
This makes the ESP-IDF driver auto-restart DMA in the vsync ISR instead of requiring manual calls, reducing but not eliminating flicker.

### How to implement properly in raw ESP-IDF
```c
// 1. Allocate two framebuffers
esp_lcd_panel_handle_t panel;
esp_lcd_new_rgb_panel(&panel_config, &panel);  // num_fbs=2

// 2. Get buffer pointers
void *fb[2];
esp_lcd_rgb_panel_get_frame_buffer(panel, 2, &fb[0], &fb[1]);

// 3. Register vsync callback
esp_lcd_rgb_panel_event_callbacks_t cbs = {
    .on_vsync = on_vsync_cb,
};
esp_lcd_rgb_panel_register_event_callbacks(panel, &cbs, &panel_state);

// 4. In vsync callback: swap LVGL draw target
// 5. In LVGL flush callback: write to inactive fb, then signal ready
```

Reference implementation (ESP-IDF + LVGL 9):
**https://github.com/limpens/esp32-8048S043-lvgl9**

---

## LVGL Notes

### Version
- ESPHome uses LVGL **8.4.0**
- The reference repo (limpens) uses LVGL **9.x** — API differences apply

### CRITICAL: byte_order and data_pins must be set together

ESPHome's `mipi_rgb` display component applies a **byte-swap** transform on the data pin array at code-generation time. This transform pairs with LVGL's `big_endian` byte order (LV_COLOR_16_SWAP=1). Both must be set correctly together — getting only one right causes wrong colors.

**Correct configuration:**
```yaml
# display section:
data_pins:
  red:   [45, 48, 47, 21, 14]   # LSB → MSB order
  green: [5, 6, 7, 15, 16, 4]
  blue:  [8, 3, 46, 9, 1]

# lvgl section:
lvgl:
  color_depth: 16
  byte_order: big_endian        # LV_COLOR_16_SWAP=1
```

**What goes wrong with wrong settings:**

| data_pins order | byte_order | Result |
|---|---|---|
| LSB→MSB | big_endian | ✅ Correct colors |
| MSB→LSB | big_endian | Gray appears dark/wrong (pink/magenta) |
| MSB→LSB | little_endian | Gray appears OK, but red↔blue swapped |
| LSB→MSB | little_endian | Colors completely wrong |

**Why:** ESPHome does `dpins = dpins[8:16] + dpins[0:8]` in `mipi_rgb/display.py` after concatenating `[blue + green + red]`. This transform produces the same pin→bit assignment as Arduino_GFX's big-endian mode, which pairs with big-endian LVGL pixel format. With LSB-first pin ordering + big-endian LVGL, the math works out to deliver exactly the right GPIO signal for each color bit.

### LVGL 8 keyboard auto-hide bug
`lv_keyboard_set_textarea(kb, ta)` in LVGL 8 registers a `LV_EVENT_DEFOCUSED` handler on the textarea that **automatically hides the keyboard** when focus leaves. At startup, if no textarea is focused, the keyboard hides itself immediately.

**Symptom:** Keyboard not visible even though code creates it without `LV_OBJ_FLAG_HIDDEN`.

**Workaround in ESPHome/LVGL 8:**
```cpp
lv_keyboard_set_textarea(g_keyboard, ta);
// Force visible — LVGL auto-hides on defocus
lv_obj_clear_flag(g_keyboard, LV_OBJ_FLAG_HIDDEN);
lv_obj_move_foreground(g_keyboard);
```

**In LVGL 9:** The keyboard auto-show/hide behaviour changed. The `lv_keyboard_set_textarea` no longer registers automatic hide events — you control visibility explicitly. Much cleaner.

**Do NOT track keyboard visibility with a bool variable** — it drifts out of sync with LVGL's internal state. Instead use:
```cpp
if (lv_obj_has_flag(keyboard, LV_OBJ_FLAG_HIDDEN))
    lv_obj_clear_flag(keyboard, LV_OBJ_FLAG_HIDDEN);
else
    lv_obj_add_flag(keyboard, LV_OBJ_FLAG_HIDDEN);
```

### Font anti-aliasing on complex backgrounds

LVGL 8 blends each glyph's semi-transparent edge pixels against whatever background is behind the label. On a non-uniform background (e.g. coloured rectangles) this makes text look jagged/pixelated.

**Fix:** Always give labels a solid `bg_color` + `LV_OPA_COVER` matching the intended background:
```cpp
lv_obj_set_style_bg_color(lbl, lv_color_hex(0x0a0a14), LV_STATE_DEFAULT);
lv_obj_set_style_bg_opa(lbl, LV_OPA_COVER, LV_STATE_DEFAULT);
```
Without this, text looks sharp on a flat dark background but pixelated when overlaid on colourful content.

### lv_obj_align vs lv_obj_set_pos

`lv_obj_align()` triggers LVGL's layout engine which applies default theme sizing, padding and borders — text can look styled/boxed unexpectedly.

`lv_obj_set_pos()` + `lv_obj_set_width()` bypasses the layout engine and renders text exactly as specified. Prefer this for custom UI elements.

### Enabling LVGL font sizes

ESPHome only compiles LVGL font modules that are referenced in the YAML. To use a font size in C++ code, add a dummy off-screen label with that font in the `lvgl: pages:` section:
```yaml
- label:
    text: ""
    x: -200
    y: -200
    text_font: MONTSERRAT_32
```
Available built-in sizes: 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32, 34, 36, 38, 40, 42, 44, 46, 48.

### Screen test framework

`custom/screen_tests.h` — reusable screen tests, screen-size-aware via `lv_disp_get_hor/ver_res()`. Tap the centre (160×160 invisible button) to cycle tests.

- **Test 1:** Concentric dashed rectangles at 0/5/10/20/40/80px insets — boundary calibration
- **Test 2:** All font sizes 8–40, fills screen width, stops when next row won't fit

### ESPHome build cache pitfall

`esphome upload` can flash a stale binary if PlatformIO didn't detect custom header changes. Always verify with:
```bash
stat .esphome/build/esp32-display/.pioenvs/esp32-display/firmware.bin | grep Modify
```
The firmware timestamp must be newer than the last header edit. If not, `touch custom/*.h` to force a rebuild.

### Screen scrolling
LVGL screens are scrollable by default. When content fills the screen, LVGL enables scroll which confuses the layout:
```cpp
lv_obj_clear_flag(lv_scr_act(), LV_OBJ_FLAG_SCROLLABLE);
```

### Layout used (800×480)

Three-tab dashboard. Header + content area + footer nav:

```
y=0    ┌────────────────────────────────────────────────────┐
       │  CYANIDE •           v6         192.168.x.x        │  h=64
y=64   ├────────────────────────────────────────────────────┤
       │                                                    │
       │         Tab content area (800×352)                 │  h=352
       │                                                    │
y=416  ├────────────────────────────────────────────────────┤
       │   [ HOME ]        [ SETTINGS ]       [ WIFI ]      │  h=64
y=480  └────────────────────────────────────────────────────┘
```

**WIFI tab inner layout (800×352):**
```
       ┌──────────────────────┬─────────────────────────────┐
       │ NETWORKS    [Scan]   │  SSID                       │
       │ ┌──────────────────┐ │  [ssid textarea           ] │
       │ │ scrollable list  │ │  Password                   │
       │ │ of networks with │ │  [pass textarea           ] │
       │ │ signal bars      │ │             [Connect]       │
       │ └──────────────────┘ │  status label               │
       └──────────────────────┴─────────────────────────────┘
       │    LVGL keyboard (800×200, floating, hidden)        │
       └─────────────────────────────────────────────────────┘
```

### Signal strength bars
Each network row has 5 vertical bars drawn with `lv_obj_create` inside a panel, colored by RSSI:

| RSSI | Bars | Color |
|---|---|---|
| > -55 dBm | 5 | Green `0x00cc44` |
| > -63 dBm | 4 | Yellow-green `0x88cc00` |
| > -71 dBm | 3 | Orange `0xffaa00` |
| > -79 dBm | 2 | Orange-red `0xff6600` |
| ≤ -79 dBm | 1 | Red `0xff2222` |

---

## WiFi Scan (ESP-IDF API)

```c
wifi_scan_config_t cfg = {};
cfg.show_hidden = 0;
esp_wifi_scan_start(&cfg, true);   // blocking ~2-3 s

uint16_t count = 0;
esp_wifi_scan_get_ap_num(&count);
wifi_ap_record_t *recs = malloc(count * sizeof(wifi_ap_record_t));
esp_wifi_scan_get_ap_records(&count, recs);
// recs[i].ssid, recs[i].rssi, recs[i].authmode
free(recs);
```

**Important:** Must be called from a task with enough stack (~8KB). Calling from the main LVGL task is fine with ESP-IDF WDT timeout extended to 30s.

---

## ESP-IDF sdkconfig options used

```yaml
CONFIG_ESP32S3_DATA_CACHE_64KB: "y"
CONFIG_SPIRAM_FETCH_INSTRUCTIONS: "y"
CONFIG_SPIRAM_RODATA: "y"
CONFIG_ESP_TASK_WDT_TIMEOUT_S: "30"    # WiFi scan takes ~2-3s
CONFIG_LCD_RGB_RESTART_IN_VSYNC: "y"   # auto-restart DMA on vsync
CONFIG_SPIFFS_ENABLED: "y"
```

---

## Confirmed Visible Area

Tested by drawing dashed boundary lines at every pixel position:

| Axis | Configured | Visible | Notes |
|---|---|---|---|
| Horizontal | 0–799 (800px) | 0–799 ✅ | Full width visible |
| Vertical | 0–479 (480px) | 0–479 ✅ | Full height visible |

The display shows the full 800×480. y=480 and x=800 are out of range (0-indexed), not missing pixels.

### Rotation
`rotation: 90` in the `display:` block causes flickering — the software rotation conflicts with DMA on the RGB parallel interface. Do NOT use it. The panel is landscape (800 wide × 480 tall) and should be oriented accordingly.

---

## Display Calibration Image

`resources/testscreen.png` — 800×480 PNG with concentric dashed rectangles at 0px, 5px, 10px, 20px, 40px, 80px insets plus a solid white 1px perimeter border. Generated with Pillow. Use to verify display boundaries after any timing changes.

To display on device via LVGL:
```yaml
image:
  - file: resources/testscreen.png
    id: testscreen
    type: RGB565
# Also add a dummy image widget in lvgl pages to compile the LV_USE_IMG module:
#   - image:
#       src: testscreen
#       x: -200
#       y: -200
```
```cpp
lv_obj_t *img = lv_img_create(scr);
lv_img_set_src(img, testscreen->get_lv_img_dsc());
lv_obj_set_pos(img, 0, 0);
```

---

## Known Issues (as of end of ESPHome project)

1. **Flickering** — **FIXED** by switching from deprecated `platform: rpi_dpi_rgb` to `platform: mipi_rgb` with `model: RPI`. The old component called `esp_lcd_rgb_panel_restart()` on every loop tick which itself caused the flicker. `mipi_rgb` does not do this.

2. **Touch broken by interrupt_pin** — **FIXED** by removing `interrupt_pin: GPIO18`. See Touch section above.

3. **Keyboard auto-hides** — LVGL 8's `lv_keyboard_set_textarea` hides keyboard on defocus. Force `lv_obj_clear_flag(kb, LV_OBJ_FLAG_HIDDEN)` after setup and on every textarea focus event. In LVGL 9 this is cleaner.

4. **WiFi scan blocks display** — `esp_wifi_scan_start(cfg, true)` blocks the LVGL task for 2-3s. In a raw ESP-IDF project, run the scan in a separate FreeRTOS task and post results back via a queue.

---

## Recommended approach for raw ESP-IDF project

1. Use **LVGL 9** (not 8) — cleaner API, better keyboard handling
2. Use **`num_fbs=2`** with vsync callback for tear-free rendering
3. Run WiFi scan in a **separate task** (not the LVGL task)
4. Pin LVGL task to **core 1**, WiFi/networking on **core 0**
5. Use **`psram_trans_align=64`** for DMA performance
6. GT911 touch works fine with polling (no INT pin needed, but INT on GPIO18 is better)

---

## Reference URLs

- **Working ESP-IDF + LVGL 9 example for this exact board:**
  https://github.com/limpens/esp32-8048S043-lvgl9

- **ESPHome rpi_dpi_rgb component source** (installed path):
  `/usr/local/lib/python3.12/dist-packages/esphome/components/rpi_dpi_rgb/rpi_dpi_rgb.cpp`

- **Board schematic reference name:** ESP32-8048S043-1.png (search vendor site)

---

## ESPHome project location

`/app/esphome1/` — working ESPHome implementation (no flickering, correct colors, multi-tab UI) with:

| File | Purpose |
|------|---------|
| `device.yaml` | Main config — display, touch, LVGL, SNTP, intervals |
| `custom/ui_helpers.h` | Shared LVGL helpers (`_panel_reset`, `_lbl_bg`, `_make_panel`, etc.) |
| `custom/maindashboard.h` | Header, footer nav, tab orchestrator, `ui_set_connected/disconnected` |
| `custom/tab_home.h` | HOME tab — live clock, date, uptime, network status |
| `custom/tab_settings.h` | SETTINGS tab — IP, WiFi, uptime, board/display/framework info |
| `custom/tab_wifi.h` | WIFI tab — scan list with signal bars, SSID/password entry, connect |
| `custom/wifi_setup.h` | WiFi scan + connect helpers (ESP-IDF API) |
| `custom/version_info.h` | Auto-generated `FW_VERSION_STR` (bumped by `scripts/flash.sh`) |
| `scripts/flash.sh` | Bumps version, compiles, flashes (USB or OTA), verifies |
| `version.txt` | Current firmware version number |
| `upload_failures.txt` | Count of detected cached-binary upload failures |
| `secrets.yaml` | WiFi / OTA / API credentials (gitignored) |
