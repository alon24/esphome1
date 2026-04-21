import esphome.codegen as cg
import esphome.config_validation as cv
from esphome.const import CONF_ID

CONFIG_SCHEMA = cv.Schema({
    cv.GenerateID(): cv.declare_id(cg.Component),
})

async def to_code(config):
    base_dir = "/app/esphome1/components/esp_littlefs"
    
    # Include paths
    cg.add_build_flag(f"-I{base_dir}/include")
    cg.add_build_flag(f"-I{base_dir}/src")
    cg.add_build_flag(f"-I{base_dir}/src/littlefs")
    
    # LittleFS default configuration macros
    cg.add_build_flag("-DCONFIG_LITTLEFS_BLOCK_SIZE=4096")
    cg.add_build_flag("-DCONFIG_LITTLEFS_PAGE_SIZE=256")
    cg.add_build_flag("-DCONFIG_LITTLEFS_LOOKAHEAD_SIZE=128")
    cg.add_build_flag("-DCONFIG_LITTLEFS_BLOCK_CYCLES=500")
    cg.add_build_flag("-DCONFIG_LITTLEFS_CACHE_SIZE=512")
    cg.add_build_flag("-DCONFIG_LITTLEFS_READ_SIZE=128")
    cg.add_build_flag("-DCONFIG_LITTLEFS_WRITE_SIZE=128")
    cg.add_build_flag("-DCONFIG_LITTLEFS_MAX_PARTITIONS=3")
    cg.add_build_flag("-DCONFIG_LITTLEFS_DISK_VERSION_MOST_RECENT=1")
    cg.add_build_flag("-DCONFIG_LITTLEFS_MALLOC_STRATEGY_DEFAULT=1")
    cg.add_build_flag("-DCONFIG_LITTLEFS_OBJ_NAME_LEN=64")
    cg.add_build_flag("-DCONFIG_LITTLEFS_USE_MTIME=1")
    cg.add_build_flag("-DCONFIG_LITTLEFS_MTIME_USE_SECONDS=1")
    
    # Flags for esp_littlefs headers
    cg.add_build_flag("-DLFS_CONFIG=lfs_config.h")
