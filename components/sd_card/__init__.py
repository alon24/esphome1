import esphome.config_validation as cv
from esphome import automation
from esphome.const import CONF_ID

CODEOWNERS = ["@user"]
DEPENDENCIES = ["esp_idf"]

sd_card_ns = automation.esphome_ns.namespace("sd_card")

CONFIG_SCHEMA = cv.Schema({})

async def to_code(config):
    # This component only provides C++ headers
    # The actual SD card code is included via custom/sd_card.h
    pass
