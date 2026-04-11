# 📝 ESP32-S3-8048S043 (4.3" RGB) Hardware Notes

## 🛠 Verified ESPHome Configuration
These settings are confirmed working on the **Sunton ESP32-S3-WROOM-1 N16R8** (16MB Flash, 8MB Octal PSRAM).

### Flash & Memory
| Setting | Value | Rationale |
|---------|-------|-----------|
| `board_build.flash_mode` | `qio` | **Critical.** Bootloader hangs at `entry` with `dio` or default. |
| `board_build.f_flash` | `40000000L` | Stable baseline. |
| `psram: mode` | `octal` | Required for the 8MB PSRAM OPI module. |
| `framework: type` | `esp-idf` | Required for SPI SD drivers and POSIX VFS. |

### SD Card Interface (SPI)
| Pin | Function | Notes |
|-----|----------|-------|
| **GPIO 10** | CS (Chip Select) | |
| **GPIO 11** | MOSI | |
| **GPIO 12** | CLK | |
| **GPIO 13** | MISO | |
| **GPIO 38** | **Touch CS** | **Pull HIGH before SD init** to prevent SPI bus contention. |

> ⚠️ **Driver**: The SD card uses the **SPI peripheral** (`esp_vfs_fat_sdspi_mount`), NOT the SDMMC peripheral. Using `esp_vfs_fat_sdmmc_mount` will silently fail to mount.

### Required sdkconfig Options (SD Card)
```yaml
sdkconfig_options:
  CONFIG_VFS_SUPPORT_IO: "y"
  CONFIG_VFS_SUPPORT_POSIX: "y"
  CONFIG_VFS_SUPPORT_FATFS: "y"
  CONFIG_HAVE_SDSPI: "y"
```
Without `CONFIG_VFS_SUPPORT_IO/POSIX`, `opendir`/`readdir`/`closedir` link as no-op stubs and all directory listing fails silently.

### CMakeLists.txt for sd_card component
Must include `vfs` in REQUIRES or POSIX directory functions won't resolve:
```cmake
idf_component_register(SRCS "sd_card.cpp"
                       INCLUDE_DIRS "."
                       REQUIRES fatfs sdmmc vfs esp_driver_sdspi esp_driver_spi driver)
```

### SD Card Format
FAT32 works. Tested with 29GB card. No special formatting required.

---

## 🖥 Display & Touch
| Component | Details |
|-----------|---------|
| Display | 4.3" 800×480 RGB parallel (ST7262 / `mipi_rgb`) |
| Touch | GT911 capacitive, I2C addr `0x5D`, SDA=GPIO19, SCL=GPIO20 |
| Touch INT | GPIO18 (Disconnected - now using polling) |
| Touch RST | GPIO38 (Shared with SD CS — pull HIGH before SD init) |
| Backlight | GPIO2 via LEDC |

### LVGL
| Setting | Value | Why |
|---------|-------|-----|
| `color_depth` | `16` | |
| `byte_order` | `little_endian` | **Required.** Default big-endian causes pink/magenta colors on this display. |

---

## 💾 Persistence & State Management (v110)
Implementing layout persistence on ESP32-S3 requires overcoming early-boot race conditions between the LVGL engine and the SPIFFS partition mount.

### Autonomous Filesystem Mount
To prevent "File Not Found" errors during boot, the `grid_config_load` engine implements a **Self-Mount** check. It registers the SPIFFS partition using the ESP-IDF VFS driver immediately before the first IO operation. This ensures the 1:1 state restore works even if YAML-level components are delayed.

### State Parity Engine
- **Active Screen Tracking**: The device records the current designer screen name in `system.json`.
- **Serialization**: Layouts are pushed from React as JSON and parsed via `ArduinoJson 7.x`.
- **UI Lifecycle**: `maindashboard_create` is anchored to specific LVGL page objects to prevent memory resets during auto-refreshes.

## 📡 Standalone AP Mode
The device supports a field-deployable **GRIDOS Access Point**.
- **Mode**: AP+STA (Concurrent).
- **Credentials**: Persistent SSID and Password stored in `system.json`.
- **Watchdog**: The firmware monitors the AP state and can be configured to "Always On" via the designer settings.

---

## ⚠️ Known Gotchas

1. **Double Initialization**: Avoid calling `maindashboard_create` from both `on_boot` and LVGL lifecycle; it causes task collisions. v110 centralizes this in the LVGL page-load.

2. **Buffer Overflows**: Serializing system credentials (SSID/Pass) requires at least a **512-byte** character buffer. Smaller buffers (128 bytes) will cause immediate stack corruption and reboot.

3. **SDMMC vs SPI**: The Sunton 8048S043 wiring is SPI. Standard ESPHome SD components must be configured for SPI CS=GPIO10.

4. **SPIFFS Race**: Standard ESPHome SPIFFS mounting often happens too late for custom logic. Always use the autonomous mount pattern in `grid_config.h`.
