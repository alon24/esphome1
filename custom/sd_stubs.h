#pragma once
#include "esphome/core/log.h"

namespace esphome {
    // Stubs to allow dashboard to compile without the physical SD card component
    bool sd_card_is_mounted() { return false; }
    bool sd_card_do_mount() { return false; }
    bool sd_card_do_unmount() { return false; }
    namespace sd_card {
        volatile bool g_sd_newly_mounted = false;
    }
}

// STB Image Stubs
extern "C" {
    void stbi_image_free(void* retval_from_stbi_load) {}
    unsigned char *stbi_load_from_memory(unsigned char const *buffer, int len, int *x, int *y, int *channels_in_file, int desired_channels) { return nullptr; }
    unsigned char *stbi_load(char const *filename, int *x, int *y, int *channels_in_file, int desired_channels) { return nullptr; }
    const char *stbi_failure_reason(void) { return "SD card component disabled"; }
}
