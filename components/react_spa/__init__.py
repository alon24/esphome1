import glob
import os

import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components.esp32 import include_builtin_idf_component
from esphome.const import CONF_ID, CONF_PORT
from esphome.core import CORE

DEPENDENCIES = ["wifi"]
AUTO_LOAD = []

react_spa_ns = cg.esphome_ns.namespace("react_spa")
ReactSPAComponent = react_spa_ns.class_("ReactSPAComponent", cg.Component)

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(): cv.declare_id(ReactSPAComponent),
        cv.Optional(CONF_PORT, default=80): cv.port,
    }
).extend(cv.COMPONENT_SCHEMA)


async def to_code(config):
    var = cg.Pvariable(config[CONF_ID], ReactSPAComponent.new())
    await cg.register_component(var, config)
    cg.add(var.set_port(config[CONF_PORT]))

    if CORE.using_arduino:
        if CORE.is_esp32:
            cg.add_library("AsyncTCP", None)
        elif CORE.is_esp8266:
            cg.add_library("ESPAsyncTCP", None)
        cg.add_library("ESP Async WebServer", None)
    elif CORE.is_esp32:
        # We are migrating to LittleFS. 
        # The esp_littlefs component handles its own flags and sources.
        pass
