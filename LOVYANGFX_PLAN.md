# [IMPLEMENTED] LovyanGFX Integration Plan for Sunton 8048S043

This document outlines the plan to integrate the [LovyanGFX](https://github.com/lovyan03/LovyanGFX) library into the ESPHome project for the Sunton 8048S043 (4.3" 800x480) display.

## Objective
Replace or augment the standard ESP-IDF driven display components (`mipi_rgb`, `rpi_dpi_rgb`) with LovyanGFX to gain:
- Faster image decoding (`drawJpg`, `drawPng` directly to DMA-enabled buffers).
- Optimized 2D graphics performance.
- Better support for hardware-accelerated sprites.
- A unified API for both ESPHome standard drawing and high-performance custom graphics.

---

## Phase 1: Environment & Boilerplate
1.  **Add Library Dependency**:
    In `device.yaml`, add LovyanGFX to the libraries section.
    ```yaml
    esphome:
      libraries:
        - "LovyanGFX"
    ```

2.  **Create Custom Component Structure**:
    Create a directory `custom_components/lovyan_gfx/`.
    - `lovyan_gfx.h`: C++ implementation.
    - `display.py`: ESPHome configuration schema.

---

## Phase 2: C++ Implementation (`lovyan_gfx.h`)
We will implement a class that inherits from `esphome::display::DisplayBuffer`.

### Configuration (LGFX Class)
The class will contain an internal `LGFX` class configured for the Sunton 8048S043 pinout:
- **Data (16-bit RGB565)**: GPIOs 45, 48, 47, 21, 14, 5, 6, 7, 15, 16, 4, 8, 3, 46, 9, 1.
- **Control**: DE (40), VSYNC (41), HSYNC (39), PCLK (42).
- **Backlight**: GPIO 2.
- **Touch**: GT911 on I2C (SDA: 19, SCL: 20).

### Bridge Logic
- **`setup()`**: Initialize the LGFX device.
- **`draw_absolute_pixel_internal(int x, int y, Color color)`**: Map native ESPHome drawing to `lcd.drawPixel(x, y, c)`.
- **`update()`**: Handle screen refreshing if not automatically handled by the RGB bus.

---

## Phase 3: YAML Configuration
Replace the current `display` block with the new platform:

```yaml
display:
  - platform: lovyan_gfx
    id: main_display
    width: 800
    height: 480
    auto_clear_enabled: false
    lambda: |-
      // Standard ESPHome calls:
      it.print(0, 0, id(font_small), "LovyanGFX Powered");
      
      // Direct LGFX calls (High Performance):
      // Example of drawing from SD card:
      // (Requires casting to the actual LGFX type)
      // auto *lcd = (MyLovyanGFX *)it; 
      // lcd->drawJpgFile(SD, "/images/boot.jpg", 0, 0);
```

---

## Phase 4: Why this helps your current project
Based on your previous work with the SD card and image displays:
*   **Faster Image Loading**: LovyanGFX has an extremely optimized JPG decoder that can render directly to the screen using DMA.
*   **Memory Efficiency**: It handles PSRAM very well, which is crucial for your 800x480 resolution.
*   **Smooth Transitions**: Using LGFX Sprites will allow you to create hardware-accelerated animations (like sliding menus) that LVGL might struggle with on the S3's single-core CPU tasks.

---

## Implementation Checklist
- [ ] Verify `esp-idf` framework compatibility.
- [ ] Map Sunton pins exactly to `lgfx::Bus_RGB` and `lgfx::Panel_RGB`.
- [ ] Implement `DisplayBuffer` methods.
- [ ] Test standard `it.print` functions.
- [ ] Benchmark `drawJpg` from SD card.
