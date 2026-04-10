#pragma once
#include <vector>
#include <string>
#include <ArduinoJson.h>
#include <esp_spiffs.h>
#include "esp_log.h"

// ── GRID CONFIGURATION MANAGER ────────────────────────────────────────────────
// Manages loading and saving the JSON grid layout from internal SPIFFS.
// ──────────────────────────────────────────────────────────────────────────────

struct GridElement {
    std::string name;
    std::string type; // "btn", "switch", "slider", "label", "clock"
    float innerX, innerY; // 0-100 percentage relative to parent block
    float innerW, innerH; // Percent scale or size
    uint32_t textColor;
    std::string action;
};

struct GridItem {
    std::string id;
    std::string name;
    int x, y, w, h;
    uint32_t color;
    std::vector<GridElement> elements;
};

static std::vector<GridItem> g_grid_items;
static uint32_t g_grid_bg = 0x0e0e0e;
static std::string g_current_screen = "main";
char g_grid_json_cache[8192] __attribute__((weak)); 
bool g_grid_needs_refresh = false;

inline std::string get_screen_path(const std::string& name) {
    if (name == "main") return "/spiffs/grid.json";
    return "/spiffs/scr_" + name + ".json";
}

void grid_config_refresh_cache();
void ui_refresh_grid();

void grid_config_load(const char* name);
void grid_config_load(std::string name);

void grid_config_load() {
    grid_config_load("");
}

void grid_config_load(std::string name) {
    grid_config_load(name.c_str());
}

void grid_config_load(const char* name) {
    if (name && strlen(name) > 0) g_current_screen = name;
    std::string path = get_screen_path(g_current_screen);
    FILE* f = fopen(path.c_str(), "r");
    if (!f) {
        ESP_LOGW("GRID", "No config file found, using defaults");
        g_grid_items.clear();
        GridItem it{"C0", "Clock Block", 0, 0, 4, 2, 0x1C2828, {}};
        it.elements.push_back({"Time", "clock", 50, 50, 100, 100, 0xFFFFFF, ""});
        g_grid_items.push_back(it);
        grid_config_refresh_cache();
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
                it.id    = v["id"]    | "c_unnamed";
                it.name  = v["name"]  | "Component";
                it.x     = v["x"]     | 0;
                it.y     = v["y"]     | 0;
                it.w     = v["w"]     | 1;
                it.h     = v["h"]     | 1;
                it.color = v["color"] | 0x333333;
                
                JsonArray el_array = v["elements"].as<JsonArray>();
                for (JsonObject ev : el_array) {
                    GridElement el;
                    el.name      = ev["name"]      | "Widget";
                    el.type      = ev["type"]      | "btn";
                    el.innerX    = ev["innerX"]    | 50.0f;
                    el.innerY    = ev["innerY"]    | 50.0f;
                    el.innerW    = ev["innerW"]    | 100.0f;
                    el.innerH    = ev["innerH"]    | 100.0f;
                    el.textColor = ev["textColor"] | 0xFFFFFF;
                    el.action    = ev["action"]    | "";
                    it.elements.push_back(el);
                }
                g_grid_items.push_back(it);
            }
            ESP_LOGI("GRID", "Loaded %d items from SPIFFS", (int)g_grid_items.size());
        } else {
            ESP_LOGE("GRID", "JSON Parse failed: %s", err.c_str());
        }
        free(buf);
    }
    fclose(f);
    grid_config_refresh_cache();
}

void grid_config_save(const char* json_str, const char* name);
void grid_config_save(const char* json_str, std::string name);

void grid_config_save(const char* json_str) {
    grid_config_save(json_str, "");
}

void grid_config_save(const char* json_str, std::string name) {
    grid_config_save(json_str, name.c_str());
}

void grid_config_get_json(char* out, size_t max_len) {
    JsonDocument doc;
    doc["bg"] = g_grid_bg;
    JsonArray array = doc["items"].to<JsonArray>();
    for (const auto &it : g_grid_items) {
        JsonObject v = array.add<JsonObject>();
        v["id"]    = it.id;
        v["name"]  = it.name;
        v["x"]     = it.x;
        v["y"]     = it.y;
        v["w"]     = it.w;
        v["h"]     = it.h;
        v["color"] = it.color;
        
        JsonArray el_arr = v["elements"].to<JsonArray>();
        for (const auto &el : it.elements) {
            JsonObject ev = el_arr.add<JsonObject>();
            ev["name"]      = el.name;
            ev["type"]      = el.type;
            ev["innerX"]    = el.innerX;
            ev["innerY"]    = el.innerY;
            ev["innerW"]    = el.innerW;
            ev["innerH"]    = el.innerH;
            ev["textColor"] = el.textColor;
            ev["action"]    = el.action;
        }
    }
    serializeJson(doc, out, max_len);
    if (out == g_grid_json_cache) return; 
    strncpy(g_grid_json_cache, out, 8191);
}

void grid_config_refresh_cache() {
    grid_config_get_json(g_grid_json_cache, 8192);
}

void grid_config_save(const char* json_str, const char* name) {
    if (name && strlen(name) > 0) g_current_screen = name;
    std::string path = get_screen_path(g_current_screen);
    size_t len = strlen(json_str);
    ESP_LOGI("GRID", "SAVING SCREEN [%s] (%d bytes)", g_current_screen.c_str(), (int)len);
    
    if (len < 8192 - 1) {
        strncpy(g_grid_json_cache, json_str, 8191);
        g_grid_json_cache[8191] = '\0';
    }

    FILE* f = fopen(path.c_str(), "w");
    if (f) {
        fputs(json_str, f);
        fflush(f); fsync(fileno(f));
        fclose(f);
        ESP_LOGI("GRID", "Persisted %s", path.c_str());
    }
    
    JsonDocument doc;
    deserializeJson(doc, json_str);
    g_grid_bg = doc["bg"] | 0x0e0e0e;
    JsonArray array = doc["items"].as<JsonArray>();
    if (!array.isNull()) {
        g_grid_items.clear();
        for (JsonObject v : array) {
            GridItem it;
            it.id    = v["id"]   | "comp";
            it.name  = v["name"] | "Comp";
            it.x = v["x"] | 0; it.y = v["y"] | 0; 
            it.w = v["w"] | 1; it.h = v["h"] | 1;
            it.color = v["color"] | 0x333333;

            JsonArray el_arr = v["elements"].as<JsonArray>();
            for (JsonObject ev : el_arr) {
                GridElement el;
                el.name      = ev["name"]      | "Widget";
                el.type      = ev["type"]      | "btn";
                el.innerX    = ev["innerX"]    | 50.0f;
                el.innerY    = ev["innerY"]    | 50.0f;
                el.innerW    = ev["innerW"]    | 60.0f;
                el.innerH    = ev["innerH"]    | 40.0f;
                el.textColor = ev["textColor"] | 0xFFFFFF;
                el.action    = ev["action"]    | "";
                it.elements.push_back(el);
            }
            g_grid_items.push_back(it);
        }
        g_grid_needs_refresh = true;
    }
}

// Added for modular screens
void grid_list_screens(char* out, size_t max_len) {
    JsonDocument doc;
    JsonArray arr = doc["screens"].to<JsonArray>();
    arr.add("main");
    
    struct dirent *entry;
    DIR *dir = opendir("/spiffs");
    if (dir) {
        while ((entry = readdir(dir)) != NULL) {
            std::string name = entry->d_name;
            if (name.find("scr_") == 0 && name.find(".json") != std::string::npos) {
                std::string screenName = name.substr(4, name.length() - 9);
                arr.add(screenName);
            }
        }
        closedir(dir);
    }
    serializeJson(doc, out, max_len);
}

void grid_config_tick() {
    if (g_grid_needs_refresh) {
        g_grid_needs_refresh = false;
        ui_refresh_grid();
    }
}
