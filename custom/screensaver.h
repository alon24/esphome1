#pragma once
#include "lvgl.h"
#include "tab_sd.h"
#include <vector>
#include <string>
#include <algorithm>
#include <random>

// ── Configuration (Dynamic) ───────────────────────────────────────────────────
// ── Configuration (Links to globals in device.yaml) ───────────────────────────
#define g_ss_timeout_ms  (id(pref_ss_timeout))
#define g_ss_interval_ms (id(pref_ss_interval))
#define g_ss_enabled     (id(pref_ss_enabled))

// ── State ─────────────────────────────────────────────────────────────────────
static uint32_t g_ss_last_activity = 0;
static uint32_t g_ss_last_change   = 0;
static bool     g_ss_active        = false;
static std::vector<std::string> g_ss_images;
static size_t   g_ss_idx           = 0;

// ── Implementation ────────────────────────────────────────────────────────────

static void _ss_collect_images(const std::string &base_path) {
    DIR *dir = opendir(base_path.c_str());
    if (!dir) return;

    struct dirent *e;
    while ((e = readdir(dir)) != NULL) {
        if (e->d_name[0] == '.') continue;
        std::string full = base_path + "/" + e->d_name;
        
        if (e->d_type == DT_DIR) {
            DIR *sub = opendir(full.c_str());
            if (sub) {
                struct dirent *se;
                while ((se = readdir(sub)) != NULL) {
                    if (se->d_name[0] == '.') continue;
                    if (_sd_is_image(se->d_name)) {
                        g_ss_images.push_back(full + "/" + se->d_name);
                    }
                    delay(1); // Feed Watchdog
                }
                closedir(sub);
            }
        } else if (_sd_is_image(e->d_name)) {
            g_ss_images.push_back(full);
        }
        delay(1); // Feed Watchdog
        if (g_ss_images.size() > 100) break; // Lower limit for safety
    }
    closedir(dir);
}

static void screensaver_stop() {
    if (!g_ss_active) return;
    g_ss_active = false;
    _sd_show_list(); // Closes the viewer
    ESP_LOGI("SS", "Screensaver STOPPED");
}

static void screensaver_start() {
    if (g_ss_active) return;
    
    g_ss_images.clear();
    _ss_collect_images(SD_TAB_MOUNT);
    
    if (g_ss_images.empty()) {
        g_ss_last_activity = lv_tick_get();
        return;
    }

    // Simple Shuffle using esp_random()
    for (size_t i = g_ss_images.size() - 1; i > 0; i--) {
        size_t j = esp_random() % (i + 1);
        std::swap(g_ss_images[i], g_ss_images[j]);
    }
    
    g_ss_active = true;
    g_ss_idx = 0;
    g_ss_last_change = 0;
    ESP_LOGI("SS", "Screensaver STARTED (%d images)", (int)g_ss_images.size());
}

static void screensaver_refresh_activity() {
    g_ss_last_activity = lv_tick_get();
    if (g_ss_active) screensaver_stop();
}

static void screensaver_tick() {
    uint32_t now = lv_tick_get();

    // Check for start
    if (!g_ss_active) {
        // Don't start screensaver if user is explicitly viewing an image in the SD tab
        if (g_sd_viewer && !lv_obj_has_flag(g_sd_viewer, LV_OBJ_FLAG_HIDDEN)) {
            g_ss_last_activity = now;
            return;
        }

        if (g_ss_enabled && (now - g_ss_last_activity > g_ss_timeout_ms)) {
            screensaver_start();
        }
        return;
    }

    // Handle cycling
    if (now - g_ss_last_change > g_ss_interval_ms) {
        g_ss_last_change = now;
        
        if (g_ss_idx >= g_ss_images.size()) {
            g_ss_idx = 0;
            // Simple Shuffle using esp_random()
            for (size_t i = g_ss_images.size() - 1; i > 0; i--) {
                size_t j = esp_random() % (i + 1);
                std::swap(g_ss_images[i], g_ss_images[j]);
            }
        }

        ESP_LOGI("SS", "Cycling to: %s", g_ss_images[g_ss_idx].c_str());
        _sd_show_image(g_ss_images[g_ss_idx].c_str());
        g_ss_idx++;
    }
}
