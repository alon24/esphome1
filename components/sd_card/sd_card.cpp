#include "sd_card.h"
#include "esp_vfs_fat.h"
#include "sdmmc_cmd.h"
#include "driver/spi_common.h"
#include "driver/sdspi_host.h"
#include "driver/gpio.h"
#include <dirent.h>

// Sunton 8048S043 SD card SPI pins
#define SD_CS_GPIO    GPIO_NUM_10
#define SD_MOSI_GPIO  GPIO_NUM_11
#define SD_CLK_GPIO   GPIO_NUM_12
#define SD_MISO_GPIO  GPIO_NUM_13
// Touch CS must be held HIGH during SD init to prevent SPI bus contention
#define TOUCH_CS_GPIO GPIO_NUM_38

namespace esphome {
namespace sd_card {

static const char *const TAG = "sd_card";

void SDCardComponent::setup() {
    // Hold Touch CS high to prevent bus contention during SD init
    gpio_config_t touch_cs_cfg = {};
    touch_cs_cfg.pin_bit_mask = (1ULL << TOUCH_CS_GPIO);
    touch_cs_cfg.mode = GPIO_MODE_OUTPUT;
    touch_cs_cfg.pull_up_en = GPIO_PULLUP_DISABLE;
    touch_cs_cfg.pull_down_en = GPIO_PULLDOWN_DISABLE;
    gpio_config(&touch_cs_cfg);
    gpio_set_level(TOUCH_CS_GPIO, 1);

    ESP_LOGI(TAG, "Initializing SD card (SPI)...");

    esp_vfs_fat_sdmmc_mount_config_t mount_config = {
        .format_if_mount_failed = false,
        .max_files = 5,
        .allocation_unit_size = 16 * 1024
    };

    sdmmc_card_t *card;

    sdmmc_host_t host = SDSPI_HOST_DEFAULT();

    spi_bus_config_t bus_cfg = {};
    bus_cfg.mosi_io_num = SD_MOSI_GPIO;
    bus_cfg.miso_io_num = SD_MISO_GPIO;
    bus_cfg.sclk_io_num = SD_CLK_GPIO;
    bus_cfg.quadwp_io_num = -1;
    bus_cfg.quadhd_io_num = -1;
    bus_cfg.max_transfer_sz = 4096;

    esp_err_t ret = spi_bus_initialize(
        (spi_host_device_t)host.slot, &bus_cfg, SDSPI_DEFAULT_DMA);
    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "SPI bus init failed: %s", esp_err_to_name(ret));
        return;
    }

    sdspi_device_config_t slot_config = SDSPI_DEVICE_CONFIG_DEFAULT();
    slot_config.gpio_cs = SD_CS_GPIO;
    slot_config.host_id = (spi_host_device_t)host.slot;

    ESP_LOGI(TAG, "Mounting FAT filesystem on /sdcard...");
    ret = esp_vfs_fat_sdspi_mount("/sdcard", &host, &slot_config, &mount_config, &card);

    if (ret != ESP_OK) {
        ESP_LOGE(TAG, "Mount failed: %s", esp_err_to_name(ret));
        spi_bus_free((spi_host_device_t)host.slot);
        return;
    }

    ESP_LOGI(TAG, "SD card mounted OK");
    sdmmc_card_print_info(stdout, card);

    DIR *dir = opendir("/sdcard");
    if (dir) {
        ESP_LOGI(TAG, "SD root contents:");
        struct dirent *entry;
        int count = 0;
        while ((entry = readdir(dir)) != NULL) {
            ESP_LOGI(TAG, "  %s", entry->d_name);
            count++;
        }
        if (count == 0) ESP_LOGI(TAG, "  (empty)");
        closedir(dir);
    } else {
        ESP_LOGE(TAG, "opendir(/sdcard) failed after mount");
    }
}

void SDCardComponent::dump_config() {
    ESP_LOGCONFIG(TAG, "SD Card Component (SPI: CLK=12 MOSI=11 MISO=13 CS=10)");
}

}  // namespace sd_card
}  // namespace esphome
