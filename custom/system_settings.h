#pragma once
#include <ArduinoJson.h>
#include <cstdio>
#include <cstdlib>
#include "esp_log.h"

// ── SYSTEM SETTINGS PERSISTENCE ─────────────────────────────────────────────
// Manages simple key-value settings like screensaver enable/disable.
// ──────────────────────────────────────────────────────────────────────────────

bool g_ss_enabled = true; 
static const char* SYS_SETTINGS_FILE = "/spiffs/system.json";

static void system_settings_load() {
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
            ESP_LOGI("SYS", "Settings loaded: ss_enabled=%d", g_ss_enabled);
        }
        free(buf);
    }
    fclose(f);
}

static void system_settings_save() {
    FILE* f = fopen(SYS_SETTINGS_FILE, "w");
    if (!f) {
        ESP_LOGE("SYS", "Failed to open settings for writing");
        return;
    }
    JsonDocument doc;
    doc["ss_enabled"] = g_ss_enabled;
    char buf[128];
    serializeJson(doc, buf);
    fputs(buf, f);
    fclose(f);
    ESP_LOGI("SYS", "Settings saved");
}
