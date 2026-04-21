#pragma once
#include <ArduinoJson.h>
#include <cstdio>
#include <cstdlib>
#include "esp_log.h"
#include "esp_littlefs.h"
#include <esp_task_wdt.h>
#include "esp_attr.h"

// ── SYSTEM SETTINGS PERSISTENCE ─────────────────────────────────────────────
// Manages simple key-value settings like screensaver enable/disable.
// Uses RTC memory as a first-tier cache to avoid SPI bus contention.
// ──────────────────────────────────────────────────────────────────────────────

inline RTC_DATA_ATTR bool g_ss_enabled = false; 
inline RTC_DATA_ATTR bool g_ap_always_on = false;
inline RTC_DATA_ATTR char g_ap_ssid[33] = "GRIDOS_AP";
inline RTC_DATA_ATTR char g_ap_password[64] = "";
inline RTC_DATA_ATTR char g_active_screen[64] = "main";
inline RTC_DATA_ATTR bool g_rtc_init_done = false;

static const char* SYS_SETTINGS_FILE = "/littlefs/system.json";

void system_settings_load() {
    if (g_rtc_init_done) return; // Already in RTC memory

    static bool lfs_init = false;
    if (!lfs_init) {
        // Increase watchdog timeout to 20s to allow for LittleFS format if needed
        esp_task_wdt_config_t twdt_config = {
            .timeout_ms = 20000,
            .idle_core_mask = (1 << portNUM_PROCESSORS) - 1,
            .trigger_panic = true,
        };
        esp_task_wdt_reconfigure(&twdt_config);

        esp_vfs_littlefs_conf_t conf = {
            .base_path = "/littlefs",
            .partition_label = "littlefs",
            .format_if_mount_failed = true,
            .dont_mount = false,
        };
        esp_vfs_littlefs_register(&conf);
        
        // Restore watchdog to a safer value (e.g., 5s)
        twdt_config.timeout_ms = 5000;
        esp_task_wdt_reconfigure(&twdt_config);
        
        lfs_init = true;
    }

    FILE* f = fopen(SYS_SETTINGS_FILE, "r");
    if (!f) {
        ESP_LOGI("SYS", "No system settings found, using defaults");
        g_rtc_init_done = true;
        return;
    }
    fseek(f, 0, SEEK_END);
    size_t sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    char* buf = (char*)malloc(sz + 1);
    if (buf) {
        fread(buf, 1, sz, f);
        buf[sz] = '\0';
        JsonDocument doc;
        if (!deserializeJson(doc, buf)) {
            g_ss_enabled = doc["ss_enabled"] | false;
            g_ap_always_on = doc["ap_always_on"] | false;
            strncpy(g_ap_ssid, doc["ap_ssid"] | "GRIDOS_AP", sizeof(g_ap_ssid)-1);
            strncpy(g_ap_password, doc["ap_password"] | "", sizeof(g_ap_password)-1);
            strncpy(g_active_screen, doc["last_screen"] | "main", sizeof(g_active_screen)-1);
            ESP_LOGI("SYS", "Settings loaded from Flash to RTC: screen=%s, ss=%s, ap_on=%s", 
                     g_active_screen, g_ss_enabled?"ON":"OFF", g_ap_always_on?"YES":"NO");
        }
        free(buf);
    }
    fclose(f);
    g_rtc_init_done = true;
}

void system_settings_save() {
    // Only write to Flash if we really need to or explicitly requested.
    // For now, we write to Flash but the navigations will use RTC mainly.
    // Note: We avoid calling this during every 'active_screen' change in grid_config.h
    
    FILE* f = fopen(SYS_SETTINGS_FILE, "w");
    if (!f) {
        ESP_LOGE("SYS", "Failed to open settings for writing (Bus Contention likely)");
        return;
    }
    JsonDocument doc;
    doc["ss_enabled"] = g_ss_enabled;
    doc["ap_always_on"] = g_ap_always_on;
    doc["ap_ssid"] = g_ap_ssid;
    doc["ap_password"] = g_ap_password;
    doc["last_screen"] = g_active_screen;
    char buf[512];
    serializeJson(doc, buf);
    fputs(buf, f);
    fclose(f);
    ESP_LOGI("SYS", "Settings synced to Flash");
}
