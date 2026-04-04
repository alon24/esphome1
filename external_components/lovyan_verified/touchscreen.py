import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.components import touchscreen
from esphome.const import CONF_ID
from esphome import pins
from .display import lovyan_gfx_ns, LovyanGFXDisplay

LovyanGFXTouchscreen = lovyan_gfx_ns.class_(
    "LovyanGFXTouchscreen", touchscreen.Touchscreen, cg.PollingComponent
)

CONF_DISPLAY_ID = "display_id"

CONFIG_SCHEMA = touchscreen.TOUCHSCREEN_SCHEMA.extend(
    {
        cv.GenerateID(): cv.declare_id(LovyanGFXTouchscreen),
        cv.Required(CONF_DISPLAY_ID): cv.use_id(LovyanGFXDisplay),
    }
).extend(cv.polling_component_schema("50ms"))

async def to_code(config):
    var = cg.new_Pvariable(config[CONF_ID])
    await touchscreen.register_touchscreen(var, config)
    
    display = await cg.get_variable(config[CONF_DISPLAY_ID])
    cg.add(var.set_display(display))
