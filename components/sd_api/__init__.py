import esphome.config_validation as cv
from esphome.const import CONF_ID

CODEOWNERS = ["@user"]
DEPENDENCIES = ["web_server_base", "sd_card"]

CONFIG_SCHEMA = cv.Schema({})

async def to_code(config):
    # API endpoints are registered via device.yaml lambdas
    pass
