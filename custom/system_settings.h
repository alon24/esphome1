#pragma once
#include <ArduinoJson.h>
#include <cstdio>
#include <cstdlib>
#include <memory>
#include "esp_log.h"
#include "esp_littlefs.h"
#include <esp_task_wdt.h>
#include "esp_attr.h"
#include "nvs_flash.h"
#include "nvs.h"

// ── SYSTEM SETTINGS PERSISTENCE ─────────────────────────────────────────────
// Manages simple key-value settings like screensaver enable/disable.
// Uses RTC memory as a first-tier cache to avoid SPI bus contention.
// ──────────────────────────────────────────────────────────────────────────────

// ── TRIPLE-RESET AP RECOVERY ─────────────────────────────────────────────────
// Physical EN/reset button causes rst:0x1 (POWERON) which clears ALL RTC_DATA_ATTR.
// Counter must live in NVS flash which survives any reset type.
// g_triple_reset_ap is a plain bool — set and checked in the same boot session.
inline bool g_triple_reset_ap = false;
inline uint8_t g_reset_count  = 0; // last read value, for logging only

inline void triple_reset_check() {
    static bool s_checked_this_boot = false;
    if (s_checked_this_boot) return;
    s_checked_this_boot = true;

    nvs_handle_t h;
    uint8_t count = 0;
    if (nvs_open("gridos", NVS_READWRITE, &h) == ESP_OK) {
        nvs_get_u8(h, "rst_cnt", &count); // returns 0 if key missing
        count++;
        nvs_set_u8(h, "rst_cnt", count);
        nvs_commit(h);
        nvs_close(h);
    } else {
        ESP_LOGW("RESET", "NVS open failed — triple-reset unavailable");
        return;
    }
    g_reset_count = count;
    ESP_LOGI("RESET", "Reset counter: %d/3 (NVS)", (int)count);

    if (count >= 3) {
        g_triple_reset_ap = true;
        g_reset_count     = 0;
        nvs_handle_t h2;
        if (nvs_open("gridos", NVS_READWRITE, &h2) == ESP_OK) {
            nvs_set_u8(h2, "rst_cnt", 0);
            nvs_commit(h2);
            nvs_close(h2);
        }
        ESP_LOGI("RESET", "*** TRIPLE RESET DETECTED — AP mode forced ON ***");
    }
}

inline void triple_reset_clear_window() {
    if (g_reset_count > 0) {
        g_reset_count = 0;
        nvs_handle_t h;
        if (nvs_open("gridos", NVS_READWRITE, &h) == ESP_OK) {
            nvs_set_u8(h, "rst_cnt", 0);
            nvs_commit(h);
            nvs_close(h);
        }
        ESP_LOGI("RESET", "Reset window expired — normal boot confirmed");
    }
}
// ─────────────────────────────────────────────────────────────────────────────

inline RTC_DATA_ATTR bool g_ss_enabled = false;
inline RTC_DATA_ATTR bool g_ap_always_on = true;
inline RTC_DATA_ATTR char g_ap_ssid[33] = "gridos-ap";
inline RTC_DATA_ATTR char g_ap_password[64] = "esp32display";
inline RTC_DATA_ATTR bool g_mqtt_enabled = true;
inline RTC_DATA_ATTR char g_active_screen[64] = "main";
inline RTC_DATA_ATTR bool g_rtc_init_done = false;

static const char* SYS_SETTINGS_FILE = "/littlefs/system.json";

inline void system_settings_load() {
    if (g_rtc_init_done) return; // Settings already cached in RTC

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
        auto doc_ptr = std::make_unique<JsonDocument>();
        JsonDocument &doc = *doc_ptr;
        if (!deserializeJson(doc, buf)) {
            g_ss_enabled = doc["ss_enabled"] | false;
            g_mqtt_enabled = doc["mqtt_enabled"] | true;
            g_ap_always_on = doc["ap_always_on"] | true;
            strncpy(g_ap_ssid, doc["ap_ssid"] | "gridos-ap", sizeof(g_ap_ssid)-1);
            strncpy(g_ap_password, doc["ap_password"] | "esp32display", sizeof(g_ap_password)-1);
            strncpy(g_active_screen, doc["last_screen"] | "main", sizeof(g_active_screen)-1);
            ESP_LOGI("SYS", "Settings loaded from Flash to RTC: screen=%s, ss=%s, mqtt=%s, ap_on=%s", 
                     g_active_screen, g_ss_enabled?"ON":"OFF", g_mqtt_enabled?"ON":"OFF", g_ap_always_on?"YES":"NO");
        }
        free(buf);
    }
    fclose(f);
    g_rtc_init_done = true;
}

inline void system_settings_save() {
    // Only write to Flash if we really need to or explicitly requested.
    // For now, we write to Flash but the navigations will use RTC mainly.
    // Note: We avoid calling this during every 'active_screen' change in grid_config.h
    
    FILE* f = fopen(SYS_SETTINGS_FILE, "w");
    if (!f) {
        ESP_LOGE("SYS", "Failed to open settings for writing (Bus Contention likely)");
        return;
    }
    auto doc_ptr = std::make_unique<JsonDocument>();
    JsonDocument &doc = *doc_ptr;
    doc["ss_enabled"] = g_ss_enabled;
    doc["mqtt_enabled"] = g_mqtt_enabled;
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
