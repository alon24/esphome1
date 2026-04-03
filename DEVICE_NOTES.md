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
| Touch INT | GPIO18 |
| Touch RST | GPIO38 (also Touch CS — keep HIGH during SD init) |
| Backlight | GPIO2 via LEDC |

### LVGL
| Setting | Value | Why |
|---------|-------|-----|
| `color_depth` | `16` | |
| `byte_order` | `little_endian` | **Required.** Default big-endian causes pink/magenta colors on this display. |

---

## 📡 UART Logging
Default ESP32-S3 ESP-IDF routes app logs to USB-JTAG CDC, not UART0. Required config to get logs on the serial pin (GPIO43 TX / GPIO44 RX):

```yaml
logger:
  hardware_uart: UART0

sdkconfig_options:
  CONFIG_ESP_CONSOLE_UART: "y"
  CONFIG_ESP_CONSOLE_UART_NUM: "0"
  CONFIG_ESP_CONSOLE_USB_SERIAL_JTAG_ENABLED: "n"
```

---

## ⚠️ Known Gotchas

1. **SDMMC vs SPI**: The board wiring is SPI, not SDMMC. `esp_vfs_fat_sdmmc_mount` will fail silently with no mount. Always use `esp_vfs_fat_sdspi_mount`.

2. **GPIO38 contention**: GT911 touch reset shares GPIO38 with the SPI bus. Pull it HIGH before initializing the SD card or the SD init will fail intermittently.

3. **Flash mode**: `board_build.flash_mode: qio` is mandatory. Any other mode causes a silent hang after the ROM `entry` log.

4. **Task WDT**: Don't block in `setup()` for more than ~3 seconds. The default IDF task watchdog fires at 5s — SD init + any delays will trip it. Remove diagnostic delay loops from component setup.

5. **POSIX VFS stubs**: Even if `esp_vfs_fat_sdspi_mount` succeeds, `opendir` will silently always-fail if `CONFIG_VFS_SUPPORT_POSIX` is not set and `vfs` is not in CMakeLists REQUIRES.

6. **UART silence**: If you see ROM boot logs but no app logs, the console is going to USB-JTAG. See UART Logging section above.
