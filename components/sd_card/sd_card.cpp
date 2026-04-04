#include "sd_card.h"
#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"
#include "driver/spi_common.h"
#include "driver/sdspi_host.h"
#include "driver/gpio.h"
#include "esp_timer.h"
#include <dirent.h>
#include <sys/stat.h>
#include <sys/types.h>

// Sunton 8048S043 SD card SPI pins
#define SD_CS_GPIO    GPIO_NUM_10
#define SD_MOSI_GPIO  GPIO_NUM_11
#define SD_CLK_GPIO   GPIO_NUM_12
#define SD_MISO_GPIO  GPIO_NUM_13
// Touch CS must be held HIGH during SD operations to prevent SPI bus contention
#define TOUCH_CS_GPIO GPIO_NUM_38

namespace esphome {
namespace sd_card {

static const char *const TAG = "sd_card";

SDCardComponent *g_sd_card         = nullptr;
volatile bool    g_sd_newly_mounted = false;

// ── Private helpers ───────────────────────────────────────────────────────────

static void _touch_cs_high() {
    gpio_config_t cfg = {};
    cfg.pin_bit_mask   = (1ULL << TOUCH_CS_GPIO);
    cfg.mode           = GPIO_MODE_OUTPUT;
    cfg.pull_up_en     = GPIO_PULLUP_DISABLE;
    cfg.pull_down_en   = GPIO_PULLDOWN_DISABLE;
    gpio_config(&cfg);
    gpio_set_level(TOUCH_CS_GPIO, 1);
}

// ── Public API ────────────────────────────────────────────────────────────────

bool SDCardComponent::try_mount(bool notify) {
    if (mounted_) return true;

    // Init SPI bus if not already done
    if (!spi_inited_) {
        sdmmc_host_t host = SDSPI_HOST_DEFAULT();
        host_slot_ = host.slot;

        spi_bus_config_t bus_cfg = {};
        bus_cfg.mosi_io_num    = SD_MOSI_GPIO;
        bus_cfg.miso_io_num    = SD_MISO_GPIO;
        bus_cfg.sclk_io_num    = SD_CLK_GPIO;
        bus_cfg.quadwp_io_num  = -1;
        bus_cfg.quadhd_io_num  = -1;
        bus_cfg.max_transfer_sz = 4096;

        esp_err_t ret = spi_bus_initialize(
            (spi_host_device_t)host_slot_, &bus_cfg, SDSPI_DEFAULT_DMA);
        if (ret != ESP_OK) {
            ESP_LOGD(TAG, "SPI bus init failed: %s", esp_err_to_name(ret));
            return false;
        }
        spi_inited_ = true;
    }

    esp_vfs_fat_mount_config_t mount_cfg = {
        .format_if_mount_failed = false,
        .max_files = 5,
        .allocation_unit_size = 0,
        .disk_status_check_enable = false,
    };

    sdmmc_host_t host = SDSPI_HOST_DEFAULT();
    host.slot = host_slot_;
    host.max_freq_khz = 10000; // Lower to 10MHz for stability

    sdspi_device_config_t slot_cfg = SDSPI_DEVICE_CONFIG_DEFAULT();
    slot_cfg.gpio_cs = SD_CS_GPIO;
    slot_cfg.host_id = (spi_host_device_t)host_slot_;

    esp_err_t ret = esp_vfs_fat_sdspi_mount("/sdcard", &host, &slot_cfg,
                                             &mount_cfg, &card_);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Mount failed: %s (Check SD card presence/format)", esp_err_to_name(ret));
        return false;
    }

    mounted_ = true;
    ESP_LOGI(TAG, "SD card mounted successfully at /sdcard");
    ESP_LOGI(TAG, "Card Name: %s", card_->cid.name);
    sdmmc_card_print_info(stdout, card_);

    if (notify) {
        g_sd_newly_mounted = true;
    }
    
    // Safety check: is the mount point actually visible to VFS?
    struct stat st_root;
    if (stat("/sdcard", &st_root) != 0) {
        ESP_LOGE(TAG, "VFS Registration FAILED: /sdcard mount point not found after success! (errno=%d)", errno);
        mounted_ = false;
        return false;
    } else {
        // Create conv directory with robust check
        struct stat st = {0};
        if (stat("/sdcard/conv", &st) == -1) {
            ESP_LOGI(TAG, "Ensuring: /sdcard/conv");
            if (mkdir("/sdcard/conv", 0777) == 0) {
                ESP_LOGI(TAG, "Directory prepared: /sdcard/conv");
            } else if (errno != EEXIST) {
                ESP_LOGE(TAG, "Failed to create /conv directory! Error: %s (errno %d)", strerror(errno), errno);
            }
        }
    }

    ESP_LOGI(TAG, "Mounted /sdcard and verified structure");
    
    // --- Manual Write Test (8.3 compatible) ---
    struct stat st_test = {0};
    if (stat("/sdcard/a.txt", &st_test) == 0) remove("/sdcard/a.txt");
    
    FILE *ft = fopen("/sdcard/a.txt", "w");
    if (ft) {
        fprintf(ft, "8.3 write test ok");
        fclose(ft);
        ESP_LOGI(TAG, "SD Card Base Write Test (a.txt): SUCCESS!");
        remove("/sdcard/a.txt");

        // Short dir test
#if defined(CONFIG_FATFS_LFN_HEAP) || defined(CONFIG_FATFS_LFN_STACK)
        ESP_LOGI(TAG, "LFN enabled, testing short directory creation...");
#else
        ESP_LOGI(TAG, "LFN disabled, testing short directory creation...");
#endif
        if (stat("/sdcard/tst", &st_test) == 0) rmdir("/sdcard/tst");
        if (mkdir("/sdcard/tst", 0777) == 0) {
            ESP_LOGI(TAG, "Short directory creation SUCCESS!");
            rmdir("/sdcard/tst");
        } else {
            ESP_LOGW(TAG, "Short directory FAILED (errno %d: %s)", errno, strerror(errno));
        }
    } else {
        ESP_LOGE(TAG, "SD Card Base Write Test FAILED! (errno=%d, error=%s)", errno, strerror(errno));
    }
    // -------------------------

    mounted_ = true;
    
    return true;
}

void SDCardComponent::unmount() {
    if (mounted_ && card_) {
        esp_vfs_fat_sdcard_unmount("/sdcard", card_);
        mounted_ = false;
        card_    = nullptr;
        ESP_LOGI(TAG, "SD card unmounted");
    }
    if (spi_inited_) {
        spi_bus_free((spi_host_device_t)host_slot_);
        spi_inited_ = false;
        ESP_LOGI(TAG, "SPI bus freed");
    }
}

void SDCardComponent::setup() {
    g_sd_card = this;
    _touch_cs_high();
#if defined(CONFIG_FATFS_LFN_HEAP) || defined(CONFIG_FATFS_LFN_STACK)
    ESP_LOGI(TAG, "Standard/Long Filename (LFN) support verified in SDK.");
#else
    ESP_LOGE(TAG, "CRITICAL: Long Filename (LFN) support appears DISABLED in SDK!");
#endif
    ESP_LOGI(TAG, "SD card component initialising (SPI: CLK=12 MOSI=11 MISO=13 CS=10)");
    try_mount(false);
}

void SDCardComponent::loop() {
    if (mounted_) return;

    uint32_t now = (uint32_t)(esp_timer_get_time() / 1000ULL);
    if (now - last_poll_ms_ < POLL_INTERVAL_MS) return;
    last_poll_ms_ = now;

    // try_mount with notify=true so the UI can react when the card appears
    try_mount(true);
}

void SDCardComponent::dump_config() {
    ESP_LOGCONFIG(TAG, "SD Card (SPI: CLK=12 MOSI=11 MISO=13 CS=10) mounted=%s",
                  mounted_ ? "yes" : "no");
}

}  // namespace sd_card
}  // namespace esphome

// ── Global free functions — declared via extern in custom headers ─────────────
// These avoid the include-path problem: custom .h files can't easily include
// component headers, but they can extern-declare plain C++ functions.

namespace esphome {

bool sd_card_is_mounted() {
    return esphome::sd_card::g_sd_card &&
           esphome::sd_card::g_sd_card->is_mounted();
}
bool sd_card_do_mount() {
    return esphome::sd_card::g_sd_card &&
           esphome::sd_card::g_sd_card->try_mount(false);
}
bool sd_card_do_unmount() {
    if (esphome::sd_card::g_sd_card) {
        esphome::sd_card::g_sd_card->unmount();
        return true;
    }
    return false;
}

} // namespace esphome

