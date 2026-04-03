#pragma once
#include "esphome/core/log.h"

// Forward declare the init function handled by the external component / driver
extern "C" {
    bool sd_card_init();
}

#define SD_MOUNT "/sdcard"

void sd_list_images(const char *dir);
void ui_init_explorer();
