#pragma once
#include <vector>
#include <string>
#include <map>
#include <ArduinoJson.h>
#include "esp_log.h"
#include "system_settings.h"

// ── ABSOLUTE GRID CONFIG (v92) ───────────────────────────────────────────────

struct GridItem {
    std::string id;
    std::string name;
    std::string type;
    int x, y, width, height;
    uint32_t color;
    uint32_t itemBg;            // 5.1: Added item background
    uint32_t textColor;
    std::string panelId;
    std::string action;
    int value, min, max;
    std::string options;
    int borderWidth;
    uint32_t borderColor;
    int radius;
    int fontSize;
    std::string textAlign;
    std::string orientation;
    std::string component;      // A1: used when type == "component"
    std::string mqttTopic;      // NEW: MQTT Binding (Command/Publish)
    std::string mqttStateTopic; // NEW: MQTT State (Subscription)
    std::string targetScreenId; // NEW: Screen navigation
    std::string icon;
    std::string onClick;
    std::string onDoubleClick;
    std::string onLongPress;
    std::string paneGridId;
    std::vector<GridItem> children;
};

struct Pane {
    std::string id;
    std::string title;
    std::string icon;
    uint32_t bg;
    uint32_t textColor;
    std::string mqttStateTopic;
    std::string mqttTopic;
    std::string onClick;
    std::string onDoubleClick;
    std::string onLongPress;
};

struct PaneGrid {
    std::string id;
    std::string name;
    int columns;
    int gap;
    std::vector<Pane> panes;
};

static std::vector<PaneGrid> g_pane_grids;

struct Panel {
    std::string id;
    std::string name;
    int width, height;
    uint32_t bg;
    std::vector<GridItem> elements;
};

static std::vector<GridItem> g_grid_items;
static std::vector<Panel> g_panels;
static uint32_t g_grid_bg = 0x0e0e0e;
static uint32_t g_grid_border_color = 0x222222;
static int g_grid_border_width = 0;
// Shared State
static std::string g_current_screen = "main";
inline char g_grid_json_cache[65536] __attribute__((weak)); 
inline bool g_grid_needs_refresh = false;
inline bool g_grid_needs_cache_clear = false;
inline std::string g_pending_nav_screen = "";
static bool g_grid_clear_needed = false;
static std::string g_grid_clear_screen = "";

inline std::string get_screen_path(const std::string& name) {
    std::string n = name;
    for (auto & c : n) c = tolower(c);
    if (n == "main") return "/littlefs/grid.json";
    if (n.compare(0, 4, "scr_") == 0) return "/littlefs/" + n + ".json";
    return "/littlefs/scr_" + n + ".json";
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
    it.width     = eObj["width"]     | eObj["w"] | 100; // 5.1 Legacy support
    it.height    = eObj["height"]    | eObj["h"] | 40;  // 5.1 Legacy support
    it.color     = eObj["color"]     | 0x333333;
    it.itemBg    = eObj["itemBg"]    | 0x000000;         // 5.1 Added
    it.textColor = eObj["textColor"] | 0xFFFFFF;
    it.panelId   = eObj["panelId"]   | "";
    it.action    = eObj["action"]    | "";
    it.value     = eObj["value"]     | 0;
    it.min       = eObj["min"]       | 0;
    it.max       = eObj["max"]       | 100;
    it.options   = eObj["options"]   | "";
    it.borderWidth = eObj["borderWidth"] | 0;
    it.borderColor = eObj["borderColor"] | it.textColor;
    it.radius    = eObj["radius"]    | 0;
    it.fontSize  = eObj["fontSize"]  | 16;
    it.textAlign = eObj["textAlign"] | "center";
    it.orientation = eObj["orientation"] | "v";
    it.component   = eObj["component"]   | "";  // A2: smart component id
    it.mqttTopic   = eObj["mqttTopic"]   | "";
    it.mqttStateTopic = eObj["mqttStateTopic"] | "";
    it.targetScreenId = eObj["targetScreenId"] | ""; // NEW
    it.icon = eObj["icon"] | "";
    it.onClick = eObj["onClick"] | "";
    it.onDoubleClick = eObj["onDoubleClick"] | "";
    it.onLongPress = eObj["onLongPress"] | "";
    it.paneGridId = eObj["paneGridId"] | "";
    
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
    FILE* f = fopen("/littlefs/panels.json", "r");
    if (!f) {
        ESP_LOGW("GRID", "[PANELS] panels.json not found on LittleFS");
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
        p.width = pObj["width"] | pObj["w"] | 100;
        p.height = pObj["height"] | pObj["h"] | 100;
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

void grid_pane_grids_load() {
    FILE* f = fopen("/littlefs/grids.json", "r");
    if (!f) return;
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
    if (err) { free(buf); return; }

    g_pane_grids.clear();
    JsonArray arr = doc.as<JsonArray>();
    for (JsonObject gObj : arr) {
        PaneGrid pg;
        pg.id = gObj["id"] | "";
        pg.name = gObj["name"] | "";
        pg.columns = gObj["columns"] | 3;
        pg.gap = gObj["gap"] | 10;
        JsonArray pArr = gObj["panes"].as<JsonArray>();
        for (JsonObject pObj : pArr) {
            Pane p;
            p.id = pObj["id"] | "";
            p.title = pObj["title"] | "";
            p.icon = pObj["icon"] | "";
            p.bg = pObj["bg"] | 0x1e293b;
            p.textColor = pObj["textColor"] | 0xffffff;
            p.mqttStateTopic = pObj["mqttStateTopic"] | "";
            p.mqttTopic = pObj["mqttTopic"] | "";
            p.onClick = pObj["onClick"] | "";
            p.onDoubleClick = pObj["onDoubleClick"] | "";
            p.onLongPress = pObj["onLongPress"] | "";
            pg.panes.push_back(p);
        }
        g_pane_grids.push_back(pg);
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
    
    // Ensure LittleFS is mounted via system_settings
    system_settings_load();

    // Load panels first!
    grid_panels_load();
    grid_pane_grids_load();

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
    strncpy(g_grid_json_cache, buf, 65535);
    g_grid_json_cache[65535] = '\0';
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
    
    // Defer UI update to main loop task to avoid Core 0/1 race condition
    g_grid_needs_cache_clear = true;
    g_grid_needs_refresh = true;
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
    FILE* f = fopen("/littlefs/panels.json", "w");
    if (f) {
        fputs(json_str, f);
        fclose(f);
        ESP_LOGI("GRID", "Saved global panels.json");
    }
    grid_panels_load(); // Immediately reload
    g_grid_needs_refresh = true;
    g_grid_clear_needed = true;
}



void grid_pane_grids_save(const char* json_str) {
    FILE* f = fopen("/littlefs/grids.json", "w");
    if (f) {
        fputs(json_str, f);
        fclose(f);
        ESP_LOGI("GRID", "Saved global grids.json");
    }
    grid_pane_grids_load();
    g_grid_needs_refresh = true;
}

void grid_list_screens(char* out, size_t max_len) {
    JsonDocument doc;
    JsonArray arr = doc["screens"].to<JsonArray>();
    
    // 5.2 Real screen listing
    DIR *dir = opendir("/littlefs");
    if (dir) {
        struct dirent *e;
        while ((e = readdir(dir)) != nullptr) {
            std::string name(e->d_name);
            if (name.size() > 5 && name.substr(name.size()-5) == ".json") {
                if (name == "grid.json") arr.add("main");
                else if (name.substr(0, 4) == "scr_") {
                    arr.add(name.substr(4, name.size()-9).c_str()); // strip scr_ and .json
                } else {
                    arr.add(name.substr(0, name.size()-5).c_str()); // fallback strip .json
                }
            }
        }
        closedir(dir);
    } else {
        arr.add("main");
    }
    
    serializeJson(doc, out, max_len);
}

void grid_config_tick() {
    if (g_grid_needs_refresh) {
        if (g_grid_needs_cache_clear) {
            void grid_config_clear_screen_cache(const std::string& name);
            grid_config_clear_screen_cache(g_current_screen);
            g_grid_needs_cache_clear = false;
            grid_config_load(g_current_screen.c_str(), true); // reload from file
        }
        
        if (!g_pending_nav_screen.empty()) {
            ui_navigate_to(g_pending_nav_screen.c_str());
            g_pending_nav_screen = "";
        }
        g_grid_needs_refresh = false;
        ui_refresh_grid();
    }
}
