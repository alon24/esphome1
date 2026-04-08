#pragma once
#include <vector>
#include <string>
#include <ArduinoJson.h>
#include <esp_spiffs.h>
#include "esp_log.h"

// ── GRID CONFIGURATION MANAGER ────────────────────────────────────────────────
// Manages loading and saving the JSON grid layout from internal SPIFFS.
// ──────────────────────────────────────────────────────────────────────────────

struct GridItem {
    std::string name;
    int x, y, w, h;
    uint32_t color;
    uint32_t textColor;
    std::string action; // e.g. "mqtt:light/on" or "toggle:gpio/2"
};

static std::vector<GridItem> g_grid_items;
static uint32_t g_grid_bg = 0x0e0e0e;
static const char* GRID_CONFIG_FILE = "/spiffs/grid.json";

// Forward declaration of the refresh function in tab_home.h
void ui_refresh_grid();

void grid_config_load() {
    FILE* f = fopen(GRID_CONFIG_FILE, "r");
    if (!f) {
        ESP_LOGW("GRID", "No config file found, using defaults");
        // Default demo layout
        g_grid_items.clear();
        g_grid_items.push_back({"Clock", 0, 0, 4, 2, 0x1C2828, 0xFFFFFF, ""});
        g_grid_items.push_back({"Stats", 4, 0, 4, 2, 0x281C1C, 0xFFFFFF, ""});
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
        DeserializationError err = deserializeJson(doc, buf);
        if (!err) {
            g_grid_items.clear();
            g_grid_bg = doc["bg"] | 0x0e0e0e;
            JsonArray array = doc["items"].as<JsonArray>();
            for (JsonObject v : array) {
                GridItem it;
                it.name   = v["name"]   | "Item";
                it.x      = v["x"]      | 0;
                it.y      = v["y"]      | 0;
                it.w      = v["w"]      | 1;
                it.h      = v["h"]      | 1;
                it.color  = v["color"]  | 0x333333;
                it.textColor = v["textColor"] | 0xFFFFFF;
                it.action = v["action"] | "";
                g_grid_items.push_back(it);
            }
            ESP_LOGI("GRID", "Loaded %d items from SPIFFS", (int)g_grid_items.size());
        } else {
            ESP_LOGE("GRID", "JSON Parse failed: %s", err.c_str());
        }
        free(buf);
    }
    fclose(f);
}

void grid_config_get_json(char* out, size_t max_len) {
    JsonDocument doc;
    doc["bg"] = g_grid_bg;
    JsonArray array = doc["items"].to<JsonArray>();
    for (const auto &it : g_grid_items) {
        JsonObject v = array.add<JsonObject>();
        v["name"]  = it.name;
        v["x"]     = it.x;
        v["y"]     = it.y;
        v["w"]     = it.w;
        v["h"]     = it.h;
        v["color"] = it.color;
        v["textColor"] = it.textColor;
        v["action"]= it.action;
    }
    serializeJson(doc, out, max_len);
}

void grid_config_save(const char* json_str) {
    FILE* f = fopen(GRID_CONFIG_FILE, "w");
    if (f) {
        fputs(json_str, f);
        fclose(f);
        ESP_LOGI("GRID", "Config saved to SPIFFS");
        // Reload and refresh UI
        ::grid_config_load();
        ui_refresh_grid();
    } else {
        ESP_LOGE("GRID", "Failed to open config for writing");
    }
}
