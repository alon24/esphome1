#pragma once
#include "lvgl.h"
#include "esp_log.h"

#include "ui_helpers.h"
#include "grid_config.h"
#include "tab_wifi_embedded.h"
#include "tab_sd_embedded.h"

// ── RECURSIVE ABSOLUTE RENDERER (v92) ─────────────────────────────────────────

// Forward declare native tab constructors so we can embed them inside widgets without circular includes
void tab_settings_create(lv_obj_t *parent);
void tab_wifi_create(lv_obj_t *parent, lv_obj_t *top_scr);
void tab_wifi_on_show();
void tab_sd_create(lv_obj_t *parent);
void tab_sd_on_show();

static lv_obj_t *g_home_grid_cont = nullptr;

static void _home_render_item(lv_obj_t *parent, const GridItem &it, int offsetX = 0, int offsetY = 0);

static std::map<std::string, lv_obj_t*> g_lv_screen_cache;
static std::vector<std::string> g_lv_cache_order; // LRU order tracker

static void _prune_cache_lru(const std::string& current) {
    // Move current to front of order
    auto it = std::find(g_lv_cache_order.begin(), g_lv_cache_order.end(), current);
    if (it != g_lv_cache_order.end()) g_lv_cache_order.erase(it);
    g_lv_cache_order.insert(g_lv_cache_order.begin(), current);

    // Evict oldest if > 2
    if (g_lv_cache_order.size() > 2) {
        std::string evict_name = g_lv_cache_order.back();
        g_lv_cache_order.pop_back();
        if (g_lv_screen_cache.count(evict_name)) {
            lv_obj_t* obj = g_lv_screen_cache[evict_name];
            if (lv_obj_is_valid(obj)) lv_obj_del(obj);
            g_lv_screen_cache.erase(evict_name);
            ESP_LOGI("GRID", "LRU Cache Evicted: %s", evict_name.c_str());
        }
    }
}

void grid_config_clear_cache() {
    for (auto const& [name, obj] : g_lv_screen_cache) {
        if (lv_obj_is_valid(obj)) lv_obj_del(obj);
    }
    g_lv_screen_cache.clear();
    g_lv_cache_order.clear();
}

void grid_config_clear_screen_cache(const std::string& name) {
    if (g_lv_screen_cache.count(name)) {
        lv_obj_t* obj = g_lv_screen_cache[name];
        if (lv_obj_is_valid(obj)) lv_obj_del(obj);
        g_lv_screen_cache.erase(name);
        
        auto it = std::find(g_lv_cache_order.begin(), g_lv_cache_order.end(), name);
        if (it != g_lv_cache_order.end()) g_lv_cache_order.erase(it);
    }
}

bool grid_config_has_screen_cache(const std::string& name) {
    return g_lv_screen_cache.count(name) > 0;
}

void ui_refresh_grid() {
    if (!g_home_grid_cont) return;

    if (g_grid_clear_needed) {
        g_grid_clear_needed = false;
        grid_config_clear_cache();
    }
    if (!g_grid_clear_screen.empty()) {
        grid_config_clear_screen_cache(g_grid_clear_screen);
        g_grid_clear_screen = "";
    }

    // Check if we already have this screen pre-built
    lv_obj_t* target_obj = nullptr;
    if (g_lv_screen_cache.count(g_current_screen)) {
        target_obj = g_lv_screen_cache[g_current_screen];
    }

    if (target_obj && lv_obj_is_valid(target_obj)) {
        // Show target FIRST to prevent black flicker
        lv_obj_clear_flag(target_obj, LV_OBJ_FLAG_HIDDEN);
        
        // Hide all OTHER cached screens
        for (auto const& [name, obj] : g_lv_screen_cache) {
            if (obj != target_obj && lv_obj_is_valid(obj)) {
                lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
            }
        }

        if (g_current_screen == "wifi") tab_wifi_on_show();
        if (g_current_screen == "sd") tab_sd_on_show();

        _prune_cache_lru(g_current_screen);
        return;
    }

    // If not cached, building new screen...
    // Temporarily don't hide others yet to keep current view visible as long as possible
    lv_obj_t* scr_cont = lv_obj_create(g_home_grid_cont);
    _panel_reset(scr_cont);
    lv_obj_set_size(scr_cont, lv_pct(100), LV_SIZE_CONTENT);
    g_lv_screen_cache[g_current_screen] = scr_cont;

    // Build the content...
    bool is_native = (g_current_screen == "native-wifi" || g_current_screen == "native-system" || g_current_screen == "native-sd");
    
    // Only use native fallbacks if there are NO grid items for this screen
    if (g_grid_items.empty() || is_native) {
        if (g_current_screen == "wifi" || g_current_screen == "native-wifi") {
            tab_wifi_create(scr_cont, lv_screen_active());
            tab_wifi_on_show();
            return;
        }
        if (g_current_screen == "system" || g_current_screen == "native-system") {
            tab_settings_create(scr_cont);
            return;
        }
        if (g_current_screen == "sd" || g_current_screen == "native-sd") {
            tab_sd_create(scr_cont);
            tab_sd_on_show();
            return;
        }
    }

    ESP_LOGI("GRID", "Building new screen: %s", g_current_screen.c_str());
    lv_obj_set_style_bg_color(scr_cont, lv_color_hex(g_grid_bg), 0);
    lv_obj_set_style_bg_opa(scr_cont, LV_OPA_COVER, 0);

    for (const auto &it : g_grid_items) {
        _home_render_item(scr_cont, it);
    }

    // Hide others AFTER build is done
    for (auto const& [name, obj] : g_lv_screen_cache) {
        if (obj != scr_cont && lv_obj_is_valid(obj)) {
            lv_obj_add_flag(obj, LV_OBJ_FLAG_HIDDEN);
        }
    }
    
    _prune_cache_lru(g_current_screen);
}

static void _item_event_cb(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    if (code == LV_EVENT_CLICKED) {
        const char *action = (const char *)lv_event_get_user_data(e);
        if (action) {
            ESP_LOGI("GRID", "UI Action: %s", action);
            if (strncmp(action, "scr:", 4) == 0) {
                const char *screen_name = action + 4;
                void ui_navigate_to(const char* name);
                ui_navigate_to(screen_name);
            }
        }
    } else if (code == LV_EVENT_DELETE) {
        char *action = (char *)lv_event_get_user_data(e);
        if (action) free(action);
    }
}

#ifdef USE_MQTT
struct MqttUpdateData {
    lv_obj_t *obj;
    std::string type;
    std::string payload;
};

static void _mqtt_lvgl_update_async(void *arg) {
    auto *u = (MqttUpdateData *)arg;
    if (lv_obj_is_valid(u->obj)) {
        if (u->type == "switch" || u->type == "checkbox") {
            if (u->payload == "ON" || u->payload == "1" || u->payload == "true") lv_obj_add_state(u->obj, LV_STATE_CHECKED);
            else lv_obj_clear_state(u->obj, LV_STATE_CHECKED);
        } else if (u->type == "slider") {
            lv_slider_set_value(u->obj, atoi(u->payload.c_str()), LV_ANIM_ON);
        } else if (u->type == "arc") {
            lv_arc_set_value(u->obj, atoi(u->payload.c_str()));
        } else if (u->type == "bar") {
            lv_bar_set_value(u->obj, atoi(u->payload.c_str()), LV_ANIM_ON);
        } else if (u->type == "label") {
            lv_label_set_text(u->obj, u->payload.c_str());
        }
    }
    delete u;
}
#endif

#ifdef USE_MQTT
static void _home_item_mqtt_cb(lv_event_t *e) {
    GridItem *it = (GridItem *)lv_obj_get_user_data(lv_event_get_target(e));
    if (!it || it->mqttTopic.empty()) return;
    
    lv_obj_t *obj = lv_event_get_target(e);
    std::string val = "";
    
    if (it->type == "switch" || it->type == "checkbox") {
        val = lv_obj_has_state(obj, LV_STATE_CHECKED) ? "ON" : "OFF";
    } else if (it->type == "slider") {
        val = std::to_string(lv_slider_get_value(obj));
    } else if (it->type == "arc") {
        val = std::to_string(lv_arc_get_value(obj));
    } else if (it->type == "roller") {
        char buf[64];
        lv_roller_get_selected_str(obj, buf, 64);
        val = buf;
    } else if (it->type == "dropdown") {
        char buf[64];
        lv_dropdown_get_selected_str(obj, buf, 64);
        val = buf;
    }
    
    if (!val.empty()) {
        esphome::mqtt::global_mqtt_client->publish(it->mqttTopic, val);
    }
}
#endif

static void _home_render_item(lv_obj_t *parent, const GridItem &it, int offsetX, int offsetY) {
    lv_obj_t *obj = nullptr;
    
    // 0. Handle Panel References (Nested layout injection)
    if (it.type == "panel-ref") {
        const Panel* pDef = nullptr;
        for (const auto &p : g_panels) {
            if (p.id == it.panelId) { pDef = &p; break; }
        }
        if (pDef) {
            lv_obj_t *panel_obj = lv_obj_create(parent);
            _panel_reset(panel_obj);
            lv_obj_set_size(panel_obj, it.width, it.height);
            lv_obj_set_pos(panel_obj, it.x + offsetX, it.y + offsetY);
            if (pDef->bg > 0) {
                lv_obj_set_style_bg_color(panel_obj, lv_color_hex(pDef->bg), 0);
                lv_obj_set_style_bg_opa(panel_obj, LV_OPA_COVER, 0);
            } else {
                lv_obj_set_style_bg_opa(panel_obj, 0, 0); 
            }
            lv_obj_set_style_clip_corner(panel_obj, true, 0);
            lv_obj_set_flex_flow(panel_obj, LV_FLEX_FLOW_COLUMN);
            lv_obj_set_flex_align(panel_obj, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
            lv_obj_set_style_pad_all(panel_obj, 0, 0);
            lv_obj_set_style_pad_gap(panel_obj, 0, 0);
            lv_obj_add_flag(panel_obj, LV_OBJ_FLAG_SCROLLABLE);
            lv_obj_set_scrollbar_mode(panel_obj, LV_SCROLLBAR_MODE_AUTO);
            for (const auto &child : pDef->elements) _home_render_item(panel_obj, child, 0, 0);
            return;
        } else {
            ESP_LOGW("GRID", "Panel Reference ID not found: %s", it.panelId.c_str());
            return;
        }
    }

    // 1. Create native widget or container
    if (it.type == "btn") {
        obj = lv_button_create(parent);
        lv_obj_t *lbl = lv_label_create(obj);
        lv_label_set_text(lbl, it.name.empty() ? "BTN" : it.name.c_str());
        lv_obj_center(lbl);
    } else if (it.type == "switch") {
        obj = lv_switch_create(parent);
        if (it.value) lv_obj_add_state(obj, LV_STATE_CHECKED);
    } else if (it.type == "slider") {
        obj = lv_slider_create(parent);
        lv_slider_set_range(obj, it.min, it.max);
        lv_slider_set_value(obj, it.value, LV_ANIM_OFF);
    } else if (it.type == "clock") {
        obj = lv_obj_create(parent);
        _panel_reset(obj);
        lv_obj_t *lbl = lv_label_create(obj);
        lv_obj_set_user_data(lbl, (void*)"clock");
        lv_label_set_text(lbl, "00:00:00");
        lv_obj_center(lbl);
    } else if (it.type == "label") {
        obj = lv_obj_create(parent);
        _panel_reset(obj);
        lv_obj_t *lbl = lv_label_create(obj);
        lv_label_set_text(lbl, it.name.empty() ? "LABEL" : it.name.c_str());
        lv_obj_center(lbl);
    } else if (it.type == "arc") {
        obj = lv_arc_create(parent);
        lv_arc_set_range(obj, it.min, it.max);
        lv_arc_set_value(obj, it.value);
    } else if (it.type == "checkbox") {
        obj = lv_checkbox_create(parent);
        lv_checkbox_set_text(obj, it.name.empty() ? "CHECK" : it.name.c_str());
        if (it.value) lv_obj_add_state(obj, LV_STATE_CHECKED);
    } else if (it.type == "dropdown") {
        obj = lv_dropdown_create(parent);
        if (!it.options.empty()) lv_dropdown_set_options(obj, it.options.c_str());
        lv_dropdown_set_selected(obj, it.value);
    } else if (it.type == "roller") {
        obj = lv_roller_create(parent);
        if (!it.options.empty()) lv_roller_set_options(obj, it.options.c_str(), LV_ROLLER_MODE_NORMAL);
        lv_roller_set_visible_row_count(obj, 3);
        lv_roller_set_selected(obj, it.value, LV_ANIM_OFF);
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_CHAIN);
    } else if (it.type == "bar") {
        obj = lv_bar_create(parent);
        lv_bar_set_range(obj, it.min, it.max);
        lv_bar_set_value(obj, it.value, LV_ANIM_OFF);
    } else if (it.type == "border") {
        obj = lv_obj_create(parent);
        _panel_reset(obj);
    } else if (it.type == "menu-item" || it.type == "nav-item") {
        obj = lv_button_create(parent);
        lv_obj_t *lbl = lv_label_create(obj);
        lv_label_set_text(lbl, it.name.empty() ? "MENU ITEM" : it.name.c_str());
        lv_obj_center(lbl);
        lv_obj_set_style_text_color(lbl, lv_color_hex(it.textColor), 0);
        
        // Visual indicator like React
        lv_obj_t *dot = lv_label_create(obj);
        lv_label_set_text(dot, LV_SYMBOL_PLAY); // Small arrow
        lv_obj_set_style_text_font(dot, &lv_font_montserrat_14, 0);
        lv_obj_align(dot, LV_ALIGN_LEFT_MID, 8, 0);
        lv_obj_set_style_opa(dot, LV_OPA_50, 0);
    } else if (it.type == "native-wifi") {
        obj = lv_obj_create(parent); _panel_reset(obj); lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        tab_wifi_create(obj, lv_screen_active()); tab_wifi_on_show();
    } else if (it.type == "native-system") {
        obj = lv_obj_create(parent); _panel_reset(obj); lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        tab_settings_create(obj);
    } else if (it.type == "native-sd") {
        obj = lv_obj_create(parent); _panel_reset(obj); lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        tab_sd_create(obj); tab_sd_on_show();
    } else if (it.type == "component") {
        obj = lv_obj_create(parent); _panel_reset(obj); lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        if (it.component == "wifi-panel") tab_wifi_create_embedded(obj);
        else if (it.component == "sd-browser") tab_sd_create_embedded(obj);
        else if (it.component == "system-settings") tab_settings_create(obj);
    } else if (it.type == "nav-menu") {
        obj = lv_obj_create(parent); _panel_reset(obj);
        lv_obj_set_flex_flow(obj, it.orientation == "h" ? LV_FLEX_FLOW_ROW : LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(obj, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_all(obj, 10, 0); lv_obj_set_style_pad_gap(obj, 10, 0);
        lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
        for (const auto& child : it.children) _home_render_item(obj, child, 0, 0);
    }

    // 2. Apply common properties
    if (obj) {
        if (it.type == "menu-item" || it.type == "nav-item") {
            lv_obj_set_size(obj, lv_pct(100), 50); // Improved touch target
        } else {
            lv_obj_set_pos(obj, it.x + offsetX, it.y + offsetY);
            lv_obj_set_size(obj, it.width, it.height);
        }

        // Colors & Shape
        // Colors & Shape
        lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), 0);
        lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
        
        lv_obj_set_style_text_color(obj, lv_color_hex(it.textColor), 0);
        
        // Font Size (Map to available montserrat fonts)
        const lv_font_t* font = &lv_font_montserrat_16;
        if (it.fontSize <= 12) font = &lv_font_montserrat_12;
        else if (it.fontSize <= 14) font = &lv_font_montserrat_14;
        else if (it.fontSize <= 16) font = &lv_font_montserrat_16;
        else if (it.fontSize <= 18) font = &lv_font_montserrat_18;
        else if (it.fontSize <= 20) font = &lv_font_montserrat_20;
        else if (it.fontSize <= 22) font = &lv_font_montserrat_22;
        else font = &lv_font_montserrat_24;
        lv_obj_set_style_text_font(obj, font, 0);

        // Text Alignment
        if (it.textAlign == "left") lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_LEFT, 0);
        else if (it.textAlign == "right") lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_RIGHT, 0);
        else lv_obj_set_style_text_align(obj, LV_TEXT_ALIGN_CENTER, 0);

        if (it.radius > 0) lv_obj_set_style_radius(obj, it.radius, 0);
        if (it.borderWidth > 0) {
            lv_obj_set_style_border_width(obj, it.borderWidth, 0);
            lv_obj_set_style_border_color(obj, lv_color_hex(it.borderColor), 0);
        }

        // Navigation Action
        std::string final_action = it.action;
        if (final_action.empty() && !it.targetScreenId.empty()) {
            final_action = "scr:" + it.targetScreenId;
        }

        if (!final_action.empty()) {
            lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
            char *persist_act = strdup(final_action.c_str());
            lv_obj_add_event_cb(obj, _item_event_cb, LV_EVENT_CLICKED, persist_act);
        }

        // MQTT Bindings
#ifdef USE_MQTT
        if (!it.mqttTopic.empty()) {
            GridItem *persist_it = new GridItem(it);
            lv_obj_set_user_data(obj, persist_it);

            // CRITICAL-1: Cleanup persist_it and unsubscribe on delete
            lv_obj_add_event_cb(obj, [](lv_event_t *e) {
                GridItem *data = (GridItem *)lv_obj_get_user_data(lv_event_get_target(e));
                if (data) {
                    if (esphome::mqtt::global_mqtt_client) {
                        esphome::mqtt::global_mqtt_client->unsubscribe(data->mqttTopic);
                    }
                    delete data;
                }
            }, LV_EVENT_DELETE, nullptr);
            
            // CRITICAL-2: Thread safe callback via lv_async_call
            esphome::mqtt::global_mqtt_client->subscribe(it.mqttTopic, [obj, persist_it](const std::string &topic, const std::string &payload) {
                auto *u = new MqttUpdateData{obj, persist_it->type, payload};
                lv_async_call(_mqtt_lvgl_update_async, u);
            });

            lv_obj_add_event_cb(obj, _home_item_mqtt_cb, LV_EVENT_VALUE_CHANGED, nullptr);
            if (it.type == "btn" || it.type == "menu-item") lv_obj_add_event_cb(obj, _home_item_mqtt_cb, LV_EVENT_CLICKED, nullptr);
        }
#endif
    }
}

void tab_home_create(lv_obj_t *parent) {
    lv_obj_clean(parent);
    g_home_grid_cont = lv_obj_create(parent);
    lv_obj_set_size(g_home_grid_cont, 800, 416);
    _panel_reset(g_home_grid_cont);
    lv_obj_add_flag(g_home_grid_cont, (lv_obj_flag_t)(LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_MOMENTUM));
    lv_obj_set_scrollbar_mode(g_home_grid_cont, LV_SCROLLBAR_MODE_AUTO);
    
    // Pulse arrow hint at bottom
    lv_obj_t *hint = lv_label_create(parent);
    lv_label_set_text(hint, LV_SYMBOL_DOWN);
    lv_obj_set_style_text_color(hint, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(hint, &lv_font_montserrat_18, 0);
    lv_obj_align(hint, LV_ALIGN_BOTTOM_MID, 0, -10);
    
    // Animation for pulsing
    lv_anim_t a;
    lv_anim_init(&a);
    lv_anim_set_var(&a, hint);
    lv_anim_set_values(&a, LV_OPA_TRANSP, LV_OPA_COVER);
    lv_anim_set_time(&a, 1000);
    lv_anim_set_playback_time(&a, 1000);
    lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
    lv_anim_set_exec_cb(&a, [](void * var, int32_t v) {
        lv_obj_set_style_opa((lv_obj_t *)var, v, 0);
    });
    lv_anim_start(&a);

    ui_refresh_grid();
}

static void _update_clock_recursive(lv_obj_t *parent, const char *buf) {
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(parent); i++) {
        lv_obj_t *child = lv_obj_get_child(parent, i);
        if (lv_obj_get_user_data(child) == (void*)"clock") {
            lv_label_set_text(child, buf);
        }
        _update_clock_recursive(child, buf);
    }
}

void tab_home_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    if (!g_home_grid_cont) return;
    char time_buf[16];
    snprintf(time_buf, sizeof(time_buf), "%02d:%02d:%02d", h, m, s);
    _update_clock_recursive(g_home_grid_cont, time_buf);
    tab_wifi_component_tick(); // E6: poll background scan completion
}
