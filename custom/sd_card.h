#pragma once
// ── SD card (SPI) ─────────────────────────────────────────────────────────────
// SPI2 host. Adjust pins to match your board's wiring.
//   CLK  → GPIO12   MOSI → GPIO11
//   MISO → GPIO13   CS   → GPIO10
//
// Mount point: /sdcard

#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"
#include "driver/sdspi_host.h"
#include "driver/spi_master.h"
#include <dirent.h>
#include <sys/stat.h>
#include <vector>
#include <string>
#include <algorithm>
#include <cstring>
#include <cctype>

#define SD_PIN_CLK   12
#define SD_PIN_MOSI  11
#define SD_PIN_MISO  13
#define SD_PIN_CS    10
#define SD_MOUNT     "/sdcard"

static sdmmc_card_t *g_sd_card = nullptr;
static bool          g_sd_ok   = false;

static bool sd_card_init() {
    if (g_sd_ok) return true;

    esp_vfs_fat_sdmmc_mount_config_t cfg = {};
    cfg.format_if_mount_failed = false;
    cfg.max_files              = 10;
    cfg.allocation_unit_size   = 16 * 1024;

    sdmmc_host_t host = SDSPI_HOST_DEFAULT();
    host.slot = SPI2_HOST;

    spi_bus_config_t bus = {};
    bus.mosi_io_num   = SD_PIN_MOSI;
    bus.miso_io_num   = SD_PIN_MISO;
    bus.sclk_io_num   = SD_PIN_CLK;
    bus.quadwp_io_num = -1;
    bus.quadhd_io_num = -1;
    bus.max_transfer_sz = 4096;

    esp_err_t r = spi_bus_initialize(SPI2_HOST, &bus, SDSPI_DEFAULT_DMA);
    if (r != ESP_OK && r != ESP_ERR_INVALID_STATE) {
        ESP_LOGE("SD", "SPI bus init: %s", esp_err_to_name(r));
        return false;
    }

    sdspi_device_config_t slot = SDSPI_DEVICE_CONFIG_DEFAULT();
    slot.gpio_cs = (gpio_num_t)SD_PIN_CS;
    slot.host_id = SPI2_HOST;

    r = esp_vfs_fat_sdspi_mount(SD_MOUNT, &host, &slot, &cfg, &g_sd_card);
    if (r != ESP_OK) {
        ESP_LOGE("SD", "Mount failed: %s", esp_err_to_name(r));
        return false;
    }

    g_sd_ok = true;
    uint64_t bytes = (uint64_t)g_sd_card->csd.capacity * g_sd_card->csd.sector_size;
    ESP_LOGI("SD", "Mounted %.0f MB", (double)bytes / (1024.0 * 1024.0));
    return true;
}

// Scan dir for image files (.png .gif .jpg .jpeg), sorted by name.
static std::vector<std::string> sd_list_images(const char *dir = SD_MOUNT) {
    std::vector<std::string> out;
    DIR *d = opendir(dir);
    if (!d) return out;
    struct dirent *e;
    while ((e = readdir(d)) != nullptr) {
        if (e->d_type == DT_DIR) continue;
        std::string n(e->d_name);
        std::string lo = n;
        for (char &c : lo) c = (char)tolower((unsigned char)c);
        size_t sz = lo.size();
        if ((sz > 4 && lo.substr(sz-4) == ".png")  ||
            (sz > 4 && lo.substr(sz-4) == ".jpg")  ||
            (sz > 5 && lo.substr(sz-5) == ".jpeg"))
        {
            out.push_back(std::string(dir) + "/" + n);
        }
    }
    closedir(d);
    std::sort(out.begin(), out.end());
    return out;
}

// Read entire file into PSRAM (or internal heap on failure). Caller must free().
static uint8_t *sd_read_file(const char *path, size_t *out_size) {
    FILE *f = fopen(path, "rb");
    if (!f) { ESP_LOGE("SD", "open: %s", path); return nullptr; }
    fseek(f, 0, SEEK_END);
    long sz = ftell(f);
    rewind(f);
    if (sz <= 0) { fclose(f); return nullptr; }

    uint8_t *buf = (uint8_t *)heap_caps_malloc((size_t)sz,
                        MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!buf) buf = (uint8_t *)malloc((size_t)sz);
    if (!buf) { fclose(f); ESP_LOGE("SD", "OOM %ld bytes", sz); return nullptr; }

    size_t rd = fread(buf, 1, (size_t)sz, f);
    fclose(f);
    if (rd != (size_t)sz) { free(buf); return nullptr; }
    *out_size = (size_t)sz;
    return buf;
}

// Get file size in bytes (0 on error)
static size_t sd_file_size(const char *path) {
    struct stat st;
    return (stat(path, &st) == 0) ? (size_t)st.st_size : 0;
}

// Extract PNG dimensions from raw PNG bytes (IHDR at offset 16)
static bool sd_png_dims(const uint8_t *data, size_t sz, int *w, int *h) {
    const uint8_t magic[] = {0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a};
    if (sz < 24 || memcmp(data, magic, 8) != 0) return false;
    *w = (int)((data[16]<<24)|(data[17]<<16)|(data[18]<<8)|data[19]);
    *h = (int)((data[20]<<24)|(data[21]<<16)|(data[22]<<8)|data[23]);
    return true;
}

static const char *sd_ext(const char *path) {
    const char *d = strrchr(path, '.'); return d ? d+1 : "";
}
static const char *sd_basename(const char *path) {
    const char *s = strrchr(path, '/'); return s ? s+1 : path;
}
