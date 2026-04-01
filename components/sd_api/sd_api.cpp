#include "sd_api.h"
#include "esp_log.h"

namespace esphome {
namespace sd_api {

static const char* TAG = "sd_api";

void setup_sd_api() {
    ESP_LOGI(TAG, "SD API initialized");
    // Note: HTTP endpoint registration requires web_server_base integration
    // which is handled at the device.yaml level with lambda handlers
}

}  // namespace sd_api
}  // namespace esphome
