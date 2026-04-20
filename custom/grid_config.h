#pragma once
#include <vector>
#include <string>
#include <map>
#include <ArduinoJson.h>
#include <esp_spiffs.h>
#include "esp_log.h"

// ── ABSOLUTE GRID CONFIG (v92) ───────────────────────────────────────────────

struct GridItem {
    std::string id;
    std::string name;
    std::string type;
    int x, y, w, h;
    uint32_t color;
    uint32_t textColor;
    std::string panelId;
    std::string action;
    int value, min, max;
    std::string options;
    int borderWidth;
    int radius;
    std::string orientation;
    std::string component;      // A1: used when type == "component"
    std::string mqttTopic;      // NEW: MQTT Binding
    std::vector<GridItem> children;
};

struct Panel {
    std::string id;
    std::string name;
    int w, h;
    uint32_t bg;
    std::vector<GridItem> elements;
};

static std::vector<GridItem> g_grid_items;
static std::vector<Panel> g_panels;
static uint32_t g_grid_bg = 0x0e0e0e;
static uint32_t g_grid_border_color = 0x222222;
static int g_grid_border_width = 0;
extern char g_active_screen[64];
static std::string g_current_screen = "main";
char g_grid_json_cache[8192] __attribute__((weak)); 
bool g_grid_needs_refresh = false;
static bool g_grid_clear_needed = false;
static std::string g_grid_clear_screen = "";

inline std::string get_screen_path(const std::string& name) {
    std::string n = name;
    for (auto & c : n) c = tolower(c);
    if (n == "main") return "/spiffs/grid.json";
    if (name.compare(0, 4, "scr_") == 0) return "/spiffs/" + name + ".json";
    return "/spiffs/scr_" + name + ".json";
}

void ui_refresh_grid();
extern void grid_config_clear_cache();
extern void grid_config_clear_screen_cache(const std::string& name);
extern bool grid_config_has_screen_cache(const std::string& name);

static void parse_grid_item(JsonObject eObj, GridItem& it) {
    it.id        = eObj["id"]        | "";
    it.type      = eObj["type"]      | "label";
    it.name      = eObj["name"]      | "Item";
    it.x         = eObj["x"]         | 0;
    it.y         = eObj["y"]         | 0;
    it.w         = eObj["w"]         | 100;
    it.h         = eObj["h"]         | 40;
    it.color     = eObj["color"]     | 0x333333;
    it.textColor = eObj["textColor"] | 0xFFFFFF;
    it.panelId   = eObj["panelId"]   | "";
    it.action    = eObj["action"]    | "";
    it.value     = eObj["value"]     | 0;
    it.min       = eObj["min"]       | 0;
    it.max       = eObj["max"]       | 100;
    it.options   = eObj["options"]   | "";
    it.borderWidth = eObj["borderWidth"] | 0;
    it.radius    = eObj["radius"]    | 0;
    it.orientation = eObj["orientation"] | "v";
    it.component   = eObj["component"]   | "";  // A2: smart component id
    it.mqttTopic   = eObj["mqttTopic"]   | "";  // NEW
    
    it.children.clear();
    if (eObj["children"].is<JsonArray>()) {
        JsonArray childArr = eObj["children"].as<JsonArray>();
        for (JsonObject cObj : childArr) {
            GridItem child;
            parse_grid_item(cObj, child);
            it.children.push_back(child);
        }
    }
}

void grid_panels_load() {
    FILE* f = fopen("/spiffs/panels.json", "r");
    if (!f) {
        ESP_LOGW("GRID", "[PANELS] panels.json not found on SPIFFS");
        return;
    }
    fseek(f, 0, SEEK_END);
    size_t sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    char* buf = (char*)malloc(sz + 1);
    if (!buf) { fclose(f); return; }
    
    fread(buf, 1, sz, f);
    buf[sz] = '\0';
    fclose(f);

    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, buf);
    if (err) {
        ESP_LOGE("GRID", "[PANELS] Failed to parse: %s", err.c_str());
        free(buf);
        return;
    }

    g_panels.clear();
    JsonArray arr = doc.as<JsonArray>();
    for (JsonObject pObj : arr) {
        Panel p;
        p.id = pObj["id"] | "";
        p.name = pObj["name"] | "";
        p.w = pObj["w"] | 100;
        p.h = pObj["h"] | 100;
        p.bg = pObj["bg"] | 0;
        JsonArray els = pObj["elements"].as<JsonArray>();
        for (JsonObject eObj : els) {
            GridItem it;
            parse_grid_item(eObj, it);
            p.elements.push_back(it);
        }
        g_panels.push_back(p);
        ESP_LOGI("GRID", "[PANELS] Loaded master: %s (%d elements)", p.name.c_str(), (int)p.elements.size());
    }
    free(buf);
}

void grid_config_load(const char* name, bool force = false) {
    if (!force && name && strlen(name) > 0 && name == g_current_screen && g_grid_items.size() > 0) {
        ESP_LOGI("GRID", "Using memory-cached screen: %s", name);
        return; // Skip SPIFFS hit
    }

    if (name && strlen(name) > 0) {
        g_current_screen = name;
    } else {
        g_current_screen = g_active_screen;
    }
    
    // Ensure SPIFFS is mounted at least once
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

    // Load panels first!
    grid_panels_load();

    std::string path = get_screen_path(g_current_screen);
    FILE* f = fopen(path.c_str(), "r");
    if (!f) {
        ESP_LOGW("GRID", "Screen file %s not found", path.c_str());
        g_grid_items.clear();
        return;
    }

    fseek(f, 0, SEEK_END);
    size_t sz = ftell(f);
    fseek(f, 0, SEEK_SET);
    char* buf = (char*)malloc(sz + 1);
    if (!buf) { fclose(f); ESP_LOGE("GRID", "Failed to alloc %d", sz); return; }

    fread(buf, 1, sz, f);
    buf[sz] = '\0';
    fclose(f);
    ESP_LOGI("GRID", "Loaded %d bytes from %s", (int)sz, path.c_str());
    
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, buf);
    if (err) {
        ESP_LOGE("GRID", "Failed to parse screen %s: %s", path.c_str(), err.c_str());
        free(buf);
        return;
    }

    g_grid_items.clear();
    g_grid_bg = doc["bg"] | 0x0e0e0e;
    g_grid_border_color = doc["borderColor"] | 0x222222;
    g_grid_border_width = doc["borderWidth"] | 0;
    JsonArray array = doc["items"].as<JsonArray>();
    ESP_LOGI("GRID", "Parsing %d items (bg: %06X, border: %06X, width: %d)", (int)array.size(), (unsigned int)g_grid_bg, (unsigned int)g_grid_border_color, g_grid_border_width);
    for (JsonObject v : array) {
        GridItem it;
        parse_grid_item(v, it);
        g_grid_items.push_back(it);
        ESP_LOGI("GRID", "  Loaded [%s] %s", it.type.c_str(), it.name.c_str());
    }
    
    // Cache for web UI retrieval
    strncpy(g_grid_json_cache, buf, 8191);
    g_grid_json_cache[8191] = '\0';
    free(buf);
}

void grid_config_save(const char* json_str, const char* name) {
    if (name && strlen(name) > 0) {
        g_current_screen = name;
        strncpy(g_active_screen, name, 63);
        void system_settings_save(); 
        system_settings_save();
    }
    std::string path = get_screen_path(g_current_screen);
    FILE* f = fopen(path.c_str(), "w");
    if (f) {
        fputs(json_str, f);
        fclose(f);
        ESP_LOGI("GRID", "Saved screen: %s", path.c_str());
    }
    g_grid_needs_refresh = true;
    grid_config_clear_screen_cache(g_current_screen);
    grid_config_load(g_current_screen.c_str(), true);
}

void ui_navigate_to(const char* name) {
    if (name && strlen(name) > 0) {
        g_current_screen = name;
        strncpy(g_active_screen, name, 63);
        ESP_LOGI("GRID", "Navigating to: %s (forcing reload)", name);
    }
    g_grid_needs_refresh = true;
    grid_config_load(g_current_screen.c_str(), true); // Always force reload from disk
}

void grid_panels_save(const char* json_str) {
    FILE* f = fopen("/spiffs/panels.json", "w");
    if (f) {
        fputs(json_str, f);
        fclose(f);
        ESP_LOGI("GRID", "Saved global panels.json");
    }
    grid_panels_load(); // Immediately reload
    g_grid_needs_refresh = true;
    g_grid_clear_needed = true;
}

void grid_list_screens(char* out, size_t max_len) {
    JsonDocument doc;
    JsonArray arr = doc["screens"].to<JsonArray>();
    arr.add("main");
    serializeJson(doc, out, max_len);
}

void grid_config_tick() {
    if (g_grid_needs_refresh) {
        g_grid_needs_refresh = false;
        ui_refresh_grid();
    }
}
