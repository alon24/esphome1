import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import display
from esphome.const import (
    CONF_HEIGHT,
    CONF_ID,
    CONF_LAMBDA,
    CONF_WIDTH,
)

DEPENDENCIES = ["esp32"]

lovyan_gfx_ns = cg.esphome_ns.namespace("lovyan_gfx")
LovyanGFXDisplay = lovyan_gfx_ns.class_(
    "VerifiedLovyanDisplay", display.DisplayBuffer
)

CONF_SWAP_BYTES = "swap_bytes"

CONFIG_SCHEMA = cv.Schema(
    {
        cv.GenerateID(): cv.declare_id(LovyanGFXDisplay),
        cv.Required(CONF_WIDTH): cv.int_,
        cv.Required(CONF_HEIGHT): cv.int_,
        cv.Optional(CONF_SWAP_BYTES, default=False): cv.boolean,
    }
).extend(cv.polling_component_schema("1s")).extend(display.FULL_DISPLAY_SCHEMA)

async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await display.register_display(var, config)
    
    cg.add_global(cg.RawStatement('#include "esphome/components/lovyan_verified/lovyan_gfx.h"'))
    
    cg.add(var.set_width(config[CONF_WIDTH]))
    cg.add(var.set_height(config[CONF_HEIGHT]))
    cg.add(var.set_swap_bytes(config[CONF_SWAP_BYTES]))

    if CONF_LAMBDA in config:
        lambda_ = await cg.process_lambda(
            config[CONF_LAMBDA], [(display.DisplayBufferRef, "it")], return_type=cg.void
        )
        cg.add(var.set_render_lambda(lambda_))
