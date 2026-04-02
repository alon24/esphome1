# 📝 ESP32-S3-8048S043 (4.3" RGB) Hardware Notes

## 🛠 Verified ESPHome Configuration
These settings are confirmed working to prevent boot-loops on the **Sunton ESP32-S3-WROOM-1 N16R8** (16MB Flash, 8MB Octal PSRAM).

### Flash & Memory
| Setting | Value | Rationale |
|---------|-------|-----------|
| `platformio_options: board_build.flash_mode` | `qio` | **Critical.** Bootloader hangs at `entry` if set to `dio` or left to default. |
| `platformio_options: board_build.f_flash` | `40000000L` | Stable baseline (can be pushed to 80MHz if needed). |
| `psram: mode` | `octal` | Required for the 8MB PSRAM OPI module. |
| `framework: type` | `esp-idf` | Best performance/stability for SD SPI drivers. |

### SD Card Interface (SPI)
| Pin | Function | Verified |
|-----|----------|----------|
| **GPIO 10** | CS (Chip Select) | ✅ |
| **GPIO 11** | MOSI | ✅ |
| **GPIO 12** | CLK (Clock) | ✅ |
| **GPIO 13** | MISO | ✅ |
| **GPIO 38** | **TOUCH CS** | **CRITICAL.** Must be pulled HIGH (`1`) during SD init to prevent bus contention. |

### Visual Status Codes (Backlight: GPIO 2)
Since UART0 is sometimes silent during the early boot phase, use the backlight as a diagnostic:
- **Slow Blinks:** Initializing components (Application Stage 1).
- **Rapid Flashing:** SD Card found and responding (Success).
- **Solid ON (no blink):** SD Card failed to respond (Wiring/Formatting).

## ⚠️ Known Gotchas
1. **The UART Silence:** Even if the ROM logs show `entry 0x403c8918`, the app may still be "crashed" if the flash mode is wrong. Use the backlight blink for 100% verification.
2. **Framework Choice:** While `arduino` works, `esp-idf` provides cleaner support for the POSIX `readdir` calls needed for SD image listing.
