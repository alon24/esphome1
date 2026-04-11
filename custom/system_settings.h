#pragma once
#include <ArduinoJson.h>
#include <cstdio>
#include <cstdlib>
#include "esp_log.h"

// ── SYSTEM SETTINGS PERSISTENCE ─────────────────────────────────────────────
// Manages simple key-value settings like screensaver enable/disable.
// ──────────────────────────────────────────────────────────────────────────────

bool g_ss_enabled = true; 
bool g_ap_always_on = false;
char g_ap_ssid[33] = "GRIDOS_AP";
char g_ap_password[64] = "";
char g_active_screen[64] = "main";
static const char* SYS_SETTINGS_FILE = "/spiffs/system.json";

void system_settings_load() {
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
            g_ss_enabled = doc["ss_enabled"] | true;
            g_ap_always_on = doc["ap_always_on"] | false;
            strncpy(g_ap_ssid, doc["ap_ssid"] | "GRIDOS_AP", sizeof(g_ap_ssid)-1);
            strncpy(g_ap_password, doc["ap_password"] | "", sizeof(g_ap_password)-1);
            strncpy(g_active_screen, doc["last_screen"] | "main", sizeof(g_active_screen)-1);
            ESP_LOGI("SYS", "Settings loaded: last_screen=%s", g_active_screen);
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
    ESP_LOGI("SYS", "Settings saved");
}
