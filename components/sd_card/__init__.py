import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.const import CONF_ID
from esphome.components.esp32 import include_builtin_idf_component, require_fatfs

CODEOWNERS = ["@alon24"]

sd_card_ns = cg.esphome_ns.namespace("sd_card")
SDCardComponent = sd_card_ns.class_("SDCardComponent", cg.Component)

CONFIG_SCHEMA = cv.Schema({
    cv.GenerateID(): cv.declare_id(SDCardComponent),
}).extend(cv.COMPONENT_SCHEMA)

async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await cg.register_component(var, config)

    # fatfs is excluded by ESPHome by default; we need it for esp_vfs_fat_sdmmc_mount
    include_builtin_idf_component("fatfs")
    require_fatfs()

    # Add ESP-IDF include paths (located in PlatformIO packages after first download)
    cg.add_build_flag("-I/root/.platformio/packages/framework-espidf/components/fatfs/vfs")
    cg.add_build_flag("-I/root/.platformio/packages/framework-espidf/components/fatfs/diskio")
    cg.add_build_flag("-I/root/.platformio/packages/framework-espidf/components/fatfs/src")
    cg.add_build_flag("-I/root/.platformio/packages/framework-espidf/components/sdmmc/include")
    cg.add_build_flag("-I/root/.platformio/packages/framework-espidf/components/esp_driver_sdspi/include")
    cg.add_build_flag("-I/root/.platformio/packages/framework-espidf/components/esp_driver_spi/include")
