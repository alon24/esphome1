#pragma once
#include <ArduinoJson.h>
#include <cstdio>
#include <cstdlib>
#include "esp_log.h"
#include <esp_spiffs.h>

// ── SYSTEM SETTINGS PERSISTENCE ─────────────────────────────────────────────
// Manages simple key-value settings like screensaver enable/disable.
// ──────────────────────────────────────────────────────────────────────────────

inline bool g_ss_enabled = false; 
inline bool g_ap_always_on = false;
inline char g_ap_ssid[33] = "GRIDOS_AP";
inline char g_ap_password[64] = "";
inline char g_active_screen[64] = "main";
static const char* SYS_SETTINGS_FILE = "/spiffs/system.json";

void system_settings_load() {
    static bool spiffs_init = false;
    if (!spiffs_init) {
        esp_vfs_spiffs_conf_t conf = {
            .base_path = "/spiffs",
            .partition_label = NULL,
            .max_files = 10,
            .format_if_mount_failed = true
        };
        esp_vfs_spiffs_register(&conf);
        spiffs_init = true;
    }
    FILE* f = fopen(SYS_SETTINGS_FILE, "r");
    if (!f) {
        ESP_LOGI("SYS", "No system settings found, using defaults");
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
            ESP_LOGI("SYS", "Settings loaded: screen=%s, ss=%s, ap_on=%s", 
                     g_active_screen, g_ss_enabled?"ON":"OFF", g_ap_always_on?"YES":"NO");
        }
        free(buf);
    }
    fclose(f);
}

void system_settings_save() {
    FILE* f = fopen(SYS_SETTINGS_FILE, "w");
    if (!f) {
        ESP_LOGE("SYS", "Failed to open settings for writing");
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
    ESP_LOGI("SYS", "Settings saved: ss=%s, ap_on=%s", g_ss_enabled?"ON":"OFF", g_ap_always_on?"YES":"NO");
}
