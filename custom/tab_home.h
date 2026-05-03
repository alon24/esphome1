#pragma once
#include "lvgl.h"
#include "esp_log.h"

#include "ui_helpers.h"
#include "grid_config.h"
#include "widget_bindings.h"
#include "tab_wifi_embedded.h"
#include "tab_sd_embedded.h"
#include "actions.h"

#ifdef USE_MQTT
#include "esphome/components/mqtt/mqtt_client.h"
#endif

#include <map>
#include <utility>


// ── RECURSIVE ABSOLUTE RENDERER (v92) ─────────────────────────────────────────

struct GridCleanup { lv_coord_t *c; lv_coord_t *r; };

// Forward declare native tab constructors so we can embed them inside widgets without circular includes
void tab_settings_create(lv_obj_t *parent);
void tab_wifi_create(lv_obj_t *parent, lv_obj_t *top_scr);
void tab_wifi_on_show();
void tab_sd_create(lv_obj_t *parent);
void tab_sd_on_show();

static lv_obj_t *g_home_grid_cont = nullptr;

struct UIBuildTask {
    lv_obj_t *parent;
    const GridItem *item;
    int offsetX;
    int offsetY;
    int depth;
};
static std::vector<UIBuildTask> g_ui_build_queue;
static lv_timer_t *g_ui_build_timer = nullptr;

static void _home_render_item(lv_obj_t *parent, const GridItem &it, int offsetX = 0, int offsetY = 0, int depth = 0);
static void _home_render_item_actual(lv_obj_t *parent, const GridItem *it, int offsetX, int offsetY, int depth);
static void _home_render_pane_grid(lv_obj_t *parent, const GridItem &it, int offsetX, int offsetY, int depth);
static void _home_render_panel_ref(lv_obj_t *parent, const GridItem &it, int offsetX, int offsetY, int depth);

static void _ui_build_timer_cb(lv_timer_t *t) {
    if (g_ui_build_queue.empty()) {
        lv_timer_pause(t);
        return;
    }
    // LIFO (DFS) build order
    UIBuildTask task = g_ui_build_queue.back();
    g_ui_build_queue.pop_back();
    if (lv_obj_is_valid(task.parent)) {
        _home_render_item_actual(task.parent, task.item, task.offsetX, task.offsetY, task.depth);
    }
}

static void _home_render_item(lv_obj_t *parent, const GridItem &it, int offsetX, int offsetY, int depth) {
    if (!g_ui_build_timer) {
        g_ui_build_timer = lv_timer_create(_ui_build_timer_cb, 100, nullptr);
    }
    g_ui_build_queue.push_back({parent, &it, offsetX, offsetY, depth});
    lv_timer_resume(g_ui_build_timer);
}

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

    static lv_obj_t *g_last_active_obj = nullptr;

    auto do_switch = [&](lv_obj_t *new_obj) {
        if (!new_obj || new_obj == g_last_active_obj) return;
        
        if (!g_last_active_obj) {
            // First screen: show immediately without animation
            lv_obj_set_x(new_obj, 0);
            lv_obj_clear_flag(new_obj, LV_OBJ_FLAG_HIDDEN);
            g_last_active_obj = new_obj;
            ESP_LOGI("GRID", "Initial screen displayed: %s", g_current_screen.c_str());
            return;
        }

        // Simple slide-in animation for subsequent screens
        lv_obj_set_x(new_obj, 800);
        lv_obj_clear_flag(new_obj, LV_OBJ_FLAG_HIDDEN);
        
        lv_anim_t a;
        lv_anim_init(&a);
        lv_anim_set_var(&a, new_obj);
        lv_anim_set_values(&a, 800, 0);
        lv_anim_set_time(&a, 300);
        lv_anim_set_path_cb(&a, lv_anim_path_ease_out);
        lv_anim_set_exec_cb(&a, [](void* var, int32_t v){ lv_obj_set_x((lv_obj_t*)var, v); });
        lv_anim_start(&a);

        if (g_last_active_obj && lv_obj_is_valid(g_last_active_obj)) {
            lv_anim_t a2;
            lv_anim_init(&a2);
            lv_anim_set_var(&a2, g_last_active_obj);
            lv_anim_set_values(&a2, 0, -800);
            lv_anim_set_time(&a2, 300);
            lv_anim_set_path_cb(&a2, lv_anim_path_ease_out);
            lv_anim_set_exec_cb(&a2, [](void* var, int32_t v){ lv_obj_set_x((lv_obj_t*)var, v); });
            lv_anim_set_completed_cb(&a2, [](lv_anim_t* anim){
                lv_obj_add_flag((lv_obj_t*)anim->var, LV_OBJ_FLAG_HIDDEN);
                lv_obj_set_x((lv_obj_t*)anim->var, 0);
            });
            lv_anim_start(&a2);
        }
        g_last_active_obj = new_obj;
    };

    if (target_obj && lv_obj_is_valid(target_obj)) {
        do_switch(target_obj);

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
    lv_color_t bg_color = lv_color_hex(g_grid_bg);
    lv_obj_set_style_bg_color(scr_cont, bg_color, 0);
    lv_obj_set_style_bg_opa(scr_cont, LV_OPA_COVER, 0);
    
    if (g_home_grid_cont) {
        lv_obj_set_style_bg_color(g_home_grid_cont, bg_color, 0);
        lv_obj_set_style_bg_opa(g_home_grid_cont, LV_OPA_COVER, 0);
    }

    bool has_content = false;

    if (!g_grid_pages.empty()) {
        has_content = true;
        // Multi-page Grid Experience (Non-scrolling TileView)
        lv_obj_t *tv = lv_tileview_create(scr_cont);
        _panel_reset(tv);
        lv_obj_set_size(tv, 800, 480);
        lv_obj_set_style_bg_opa(tv, 0, 0);
        
        // Disable scrollbars on tileview itself
        lv_obj_set_scrollbar_mode(tv, LV_SCROLLBAR_MODE_OFF);

        std::map<std::pair<int, int>, lv_obj_t*> tiles;
        for (const auto &pg : g_grid_pages) {
            lv_obj_t *tile = lv_tileview_add_tile(tv, pg.x, pg.y, LV_DIR_ALL);
            tiles[{pg.x, pg.y}] = tile;
            ESP_LOGI("GRID", "  Page [%d,%d] with %d items", pg.x, pg.y, (int)pg.items.size());
            for (const auto &it : pg.items) {
                ESP_LOGI("GRID", "    Item: %s (%s) at %d,%d", it.name.c_str(), it.type.c_str(), it.x, it.y);
                _home_render_item(tile, it, 0, 0, 0);
            }
        }

        // Add Navigation Hints (Arrows) for all 4 directions
        for (const auto &pg : g_grid_pages) {
            lv_obj_t *tile = tiles[{pg.x, pg.y}];
            auto add_arrow = [&](const char *sym, lv_align_t align, int nx, int ny) {
                lv_obj_t *btn = lv_button_create(tile);
                lv_obj_set_size(btn, 46, 46);
                lv_obj_align(btn, align, (align==LV_ALIGN_LEFT_MID?10:(align==LV_ALIGN_RIGHT_MID?-10:0)), (align==LV_ALIGN_TOP_MID?10:(align==LV_ALIGN_BOTTOM_MID?-10:0)));
                lv_obj_set_style_bg_color(btn, lv_color_hex(0x6366f1), 0);
                lv_obj_set_style_bg_opa(btn, LV_OPA_30, 0);
                lv_obj_set_style_radius(btn, LV_RADIUS_CIRCLE, 0);
                lv_obj_set_style_border_width(btn, 0, 0);
                lv_obj_set_style_shadow_width(btn, 0, 0);
                lv_obj_t *l = lv_label_create(btn);
                lv_label_set_text(l, sym);
                lv_obj_center(l);
                
                struct NavData { lv_obj_t *tv; int x, y; };
                NavData *nd = new NavData{tv, nx, ny};
                lv_obj_add_event_cb(btn, [](lv_event_t *e){
                    NavData *d = (NavData *)lv_event_get_user_data(e);
                    lv_obj_set_tile_id(d->tv, d->x, d->y, LV_ANIM_ON);
                }, LV_EVENT_CLICKED, nd);
                lv_obj_add_event_cb(btn, [](lv_event_t *e){ delete (NavData *)lv_event_get_user_data(e); }, LV_EVENT_DELETE, nullptr);

                // Add pulsing animation to hint at neighbor page
                lv_anim_t a;
                lv_anim_init(&a);
                lv_anim_set_var(&a, btn);
                lv_anim_set_values(&a, LV_OPA_10, LV_OPA_60);
                lv_anim_set_time(&a, 1000);
                lv_anim_set_playback_time(&a, 1000);
                lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
                lv_anim_set_exec_cb(&a, [](void * var, int32_t v) {
                    lv_obj_set_style_bg_opa((lv_obj_t *)var, v, 0);
                });
                lv_anim_start(&a);
            };

            if (tiles.count({pg.x + 1, pg.y})) add_arrow(LV_SYMBOL_RIGHT, LV_ALIGN_RIGHT_MID, pg.x + 1, pg.y);
            if (tiles.count({pg.x - 1, pg.y})) add_arrow(LV_SYMBOL_LEFT, LV_ALIGN_LEFT_MID, pg.x - 1, pg.y);
            if (tiles.count({pg.x, pg.y + 1})) add_arrow(LV_SYMBOL_DOWN, LV_ALIGN_BOTTOM_MID, pg.x, pg.y + 1);
            if (tiles.count({pg.x, pg.y - 1})) add_arrow(LV_SYMBOL_UP, LV_ALIGN_TOP_MID, pg.x, pg.y - 1);
        }
        
        lv_obj_set_height(scr_cont, 480);
    } else {
        // Legacy/Single Page Experience (Scrolling)
        int max_y = 480;
        if (!g_grid_items.empty()) has_content = true;
        for (const auto &it : g_grid_items) {
            ESP_LOGI("GRID", "  Item: %s (%s) at %d,%d", it.name.c_str(), it.type.c_str(), it.x, it.y);
            _home_render_item(scr_cont, it);
            int bottom = it.y + it.height;
            if (bottom > max_y) max_y = bottom;
        }
        lv_obj_set_height(scr_cont, max_y);
    }

    if (!has_content) {
        lv_obj_t *err = lv_label_create(scr_cont);
        lv_label_set_text(err, "GRIDOS: No content found.\nPlease check Designer sync.");
        lv_obj_set_style_text_color(err, lv_color_hex(0xFF0000), 0);
        lv_obj_set_style_text_font(err, &lv_font_montserrat_18, 0);
        lv_obj_center(err);
        ESP_LOGW("GRID", "Screen has no content!");
    }

    // Animate transition
    do_switch(scr_cont);
    _prune_cache_lru(g_current_screen);
}

static void _item_event_cb(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    if (code == LV_EVENT_CLICKED || code == LV_EVENT_VALUE_CHANGED || code == LV_EVENT_LONG_PRESSED || code == LV_EVENT_DOUBLE_CLICKED) {
        lv_obj_t *obj = (lv_obj_t *)lv_event_get_target(e);
        GridItem *it = (GridItem *)lv_obj_get_user_data(obj);
        if (it && it->type == "grid-item" && code == LV_EVENT_CLICKED) {
            if (lv_obj_has_state(obj, LV_STATE_CHECKED)) lv_obj_clear_state(obj, LV_STATE_CHECKED);
            else lv_obj_add_state(obj, LV_STATE_CHECKED);
        }

        const char *action = (const char *)lv_event_get_user_data(e);
        if (action) {
            ESP_LOGI("GRID", "UI Action: %s", action);
            if (strncmp(action, "scr:", 4) == 0) {
                const char *screen_name = action + 4;
                void ui_navigate_to(const char* name);
                ui_navigate_to(screen_name);
            } else if (strncmp(action, "fn:", 3) == 0) {
                handle_custom_action(action + 3);
            } else if (strncmp(action, "toast:", 6) == 0) {
                const char *msg = action + 6;
                // Simple toast using a message box or label
                ESP_LOGI("GRID", "TOAST: %s", msg);
                lv_obj_t * mbox = lv_msgbox_create(NULL);
                lv_msgbox_add_title(mbox, "Notice");
                lv_msgbox_add_text(mbox, msg);
                lv_msgbox_add_close_button(mbox);
            } else if (strncmp(action, "reboot:", 7) == 0) {
                esp_restart();
#ifdef USE_MQTT
            } else if (strncmp(action, "mqtt:", 5) == 0) {
                std::string actStr = action + 5;
                size_t colon = actStr.find(':');
                if (colon != std::string::npos) {
                    std::string t = actStr.substr(0, colon);
                    std::string p = actStr.substr(colon + 1);
                    if (esphome::mqtt::global_mqtt_client) {
                        esphome::mqtt::global_mqtt_client->publish(t, p);
                    }
                }
#endif
            } else if (strncmp(action, "wifi-scan:", 10) == 0) {
                extern void _cwifi_start_scan_bg();
                _cwifi_start_scan_bg();
            } else if (strncmp(action, "set:", 4) == 0) {
                // "set:widgetId:value"
                std::string rest = action + 4;
                size_t colon = rest.find(':');
                if (colon != std::string::npos) {
                    std::string wid = rest.substr(0, colon);
                    float val = atof(rest.substr(colon + 1).c_str());
                    grid_widget_set_value(wid.c_str(), val);
                }
            } else if (strncmp(action, "toggle:", 7) == 0) {
                std::string wid = action + 7;
                float cur = grid_widget_get_value(wid.c_str());
                grid_widget_set_value(wid.c_str(), cur > 0 ? 0.0f : 1.0f);
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
    std::string id;
};

static void _mqtt_lvgl_update_async(void *arg) {
    auto *u = (MqttUpdateData *)arg;
    if (lv_obj_is_valid(u->obj)) {
        if (!u->id.empty()) {
            grid_widget_set_value(u->id.c_str(), atof(u->payload.c_str()));
        }
        
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
        } else if (u->type == "dropdown") {
            lv_dropdown_set_selected(u->obj, atoi(u->payload.c_str()));
        } else if (u->type == "roller") {
            int new_val = atoi(u->payload.c_str());
            int cur_val = lv_roller_get_selected(u->obj);
            if (cur_val != new_val) {
                lv_roller_set_selected(u->obj, new_val, LV_ANIM_OFF);
            }
        } else if (u->type == "grid-item") {
            // Update the bottom label (last child usually, if 3 labels were added)
            uint32_t cnt = lv_obj_get_child_cnt(u->obj);
            if (cnt > 0) {
                lv_obj_t * last = lv_obj_get_child(u->obj, cnt - 1);
                if (lv_obj_check_type(last, &lv_label_class)) {
                    lv_label_set_text(last, u->payload.c_str());
                }
            }
        }
    }
    delete u;
}
#endif

#ifdef USE_MQTT
struct MqttBinding { std::string id; std::string type; std::string topic; std::string pubTopic; };

static void _home_item_mqtt_cb(lv_event_t *e) {
    if (!g_mqtt_enabled) return;
    MqttBinding *it = (MqttBinding *)lv_obj_get_user_data((lv_obj_t *)lv_event_get_target(e));
    if (!it || it->pubTopic.empty()) return;
    
    lv_obj_t *obj = (lv_obj_t *)lv_event_get_target(e);
    std::string val = "";
    
    if (it->type == "switch" || it->type == "checkbox") {
        val = lv_obj_has_state(obj, LV_STATE_CHECKED) ? "ON" : "OFF";
    } else if (it->type == "slider") {
        val = std::to_string(lv_slider_get_value(obj));
    } else if (it->type == "arc") {
        val = std::to_string(lv_arc_get_value(obj));
    } else if (it->type == "roller") {
        int sel = lv_roller_get_selected(obj);
        val = std::to_string(sel);
    } else if (it->type == "dropdown") {
        val = std::to_string(lv_dropdown_get_selected(obj));
    } else if (it->type == "grid-item") {
        val = lv_obj_has_state(obj, LV_STATE_CHECKED) ? "ON" : "OFF";
    } else {
        val = "PRESS";
    }
    
    if (!val.empty()) {
        esphome::mqtt::global_mqtt_client->publish(it->pubTopic, val);
    }
}
#endif

static void _home_render_item_actual(lv_obj_t *parent, const GridItem *pIt, int offsetX, int offsetY, int depth) {
    const GridItem &it = *pIt;
    ESP_LOGI("GRID", "BUILDING: %s (%s) depth=%d", it.name.empty() ? "unnamed" : it.name.c_str(), it.type.c_str(), depth);
    if (depth > 10) {
        ESP_LOGW("GRID", "Max recursion depth reached at item: %s", it.name.c_str());
        return;
    }
    lv_obj_t *obj = nullptr;
    
    // 0. Handle Panel References (Nested layout injection)
    if (it.type == "panel-ref") {
        _home_render_panel_ref(parent, it, offsetX, offsetY, depth + 1);
        return;
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
        lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), (lv_style_selector_t)((uint32_t)LV_PART_INDICATOR | (uint32_t)LV_STATE_CHECKED));
    } else if (it.type == "slider") {
        obj = lv_slider_create(parent);
        lv_slider_set_range(obj, it.min, it.max);
        lv_slider_set_value(obj, it.value, LV_ANIM_OFF);
        lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), LV_PART_INDICATOR);
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
        lv_obj_set_style_arc_color(obj, lv_color_hex(it.color), LV_PART_INDICATOR);
    } else if (it.type == "checkbox") {
        obj = lv_checkbox_create(parent);
        lv_checkbox_set_text(obj, it.name.empty() ? "CHECK" : it.name.c_str());
        if (it.value) lv_obj_add_state(obj, LV_STATE_CHECKED);
        lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), (lv_style_selector_t)(LV_PART_INDICATOR | LV_STATE_CHECKED));
    } else if (it.type == "dropdown") {
        obj = lv_dropdown_create(parent);
        if (!it.options.empty()) lv_dropdown_set_options(obj, it.options.c_str());
        lv_dropdown_set_selected(obj, it.value);
    } else if (it.type == "roller") {
        obj = lv_roller_create(parent);
        lv_obj_set_width(obj, it.width); 
        
        // Font must be set BEFORE visible_row_count for correct height calculation
        const lv_font_t* font = &lv_font_montserrat_16;
        if (it.fontSize <= 12) font = &lv_font_montserrat_12;
        else if (it.fontSize <= 14) font = &lv_font_montserrat_14;
        else if (it.fontSize <= 16) font = &lv_font_montserrat_16;
        else if (it.fontSize <= 18) font = &lv_font_montserrat_18;
        else if (it.fontSize <= 20) font = &lv_font_montserrat_20;
        else if (it.fontSize <= 22) font = &lv_font_montserrat_22;
        else font = &lv_font_montserrat_24;
        lv_obj_set_style_text_font(obj, font, 0);

        if (!it.options.empty()) lv_roller_set_options(obj, it.options.c_str(), LV_ROLLER_MODE_NORMAL);
        lv_roller_set_visible_row_count(obj, 3);
        lv_roller_set_selected(obj, it.value, LV_ANIM_OFF);
        
        lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_scroll_snap_y(obj, LV_SCROLL_SNAP_CENTER);
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_CHAIN);
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLL_MOMENTUM); // Prevent 'bouncing' after release
        
        lv_obj_set_style_anim_duration(obj, 100, 0); // Fast, stable snap
        
        // Selection highlight style - High visibility
        lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), LV_PART_SELECTED);
        lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, LV_PART_SELECTED);
        lv_obj_set_style_text_color(obj, lv_color_hex(0xFFFFFF), LV_PART_SELECTED);
        
        // Bigger item height
        lv_obj_set_style_text_line_space(obj, 20, 0); 
        lv_obj_set_style_pad_ver(obj, 10, LV_PART_MAIN);
    } else if (it.type == "shape_circle") {
        obj = lv_obj_create(parent);
        _panel_reset(obj);
        lv_obj_set_style_radius(obj, LV_RADIUS_CIRCLE, 0);
        lv_obj_set_style_border_width(obj, 4, 0);
        lv_obj_set_style_bg_opa(obj, 0, 0);
    } else if (it.type == "battery_icon") {
        obj = lv_obj_create(parent);
        _panel_reset(obj);
        lv_obj_set_style_bg_opa(obj, 0, 0);
        lv_obj_set_style_border_width(obj, 0, 0);
        
        lv_obj_t *icon = lv_label_create(obj);
        lv_label_set_text(icon, "\uF0082"); // Default battery-90
        lv_obj_center(icon);
        lv_obj_set_style_text_font(icon, &lv_font_montserrat_24, 0); // Using available font
    } else if (it.type == "rounded_rect") {
        obj = lv_obj_create(parent);
        _panel_reset(obj);
        if (it.radius > 0) lv_obj_set_style_radius(obj, it.radius, 0);
        else lv_obj_set_style_radius(obj, 15, 0);
        lv_obj_set_style_border_width(obj, 4, 0);
        lv_obj_set_style_bg_opa(obj, 0, 0);
    } else if (it.type == "bar") {
        obj = lv_bar_create(parent);
        lv_bar_set_range(obj, it.min, it.max);
        lv_bar_set_value(obj, it.value, LV_ANIM_OFF);
        lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), LV_PART_INDICATOR);
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
    } else if (it.type == "native-wifi-info") {
        obj = lv_label_create(parent);
        lv_label_set_text(obj, "0.0.0.0"); // Will be updated by dashboard_tick
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
    } else if (it.type == "grid" || it.type == "page-grid" || it.type == "panel-grid") {
        obj = lv_obj_create(parent); _panel_reset(obj);
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        
        int cols = it.cols > 0 ? it.cols : 1;
        int rows = it.rows > 0 ? it.rows : 1;
        
        lv_coord_t *col_dsc = new lv_coord_t[cols + 1];
        for(int i=0; i<cols; i++) col_dsc[i] = LV_GRID_FR(1);
        col_dsc[cols] = LV_GRID_TEMPLATE_LAST;
        
        lv_coord_t *row_dsc = new lv_coord_t[rows + 1];
        for(int i=0; i<rows; i++) row_dsc[i] = LV_GRID_FR(1);
        row_dsc[rows] = LV_GRID_TEMPLATE_LAST;
        
        lv_obj_set_grid_dsc_array(obj, col_dsc, row_dsc);
        lv_obj_set_style_pad_all(obj, it.gap, 0);
        lv_obj_set_style_pad_gap(obj, it.gap, 0);
        
        GridCleanup *cl = new GridCleanup{col_dsc, row_dsc};
        lv_obj_add_event_cb(obj, [](lv_event_t *e){
            GridCleanup *data = (GridCleanup*)lv_event_get_user_data(e);
            if (data) { delete[] data->c; delete[] data->r; delete data; }
        }, LV_EVENT_DELETE, cl);

        for (const auto& child : it.children) {
            _home_render_item(obj, child, 0, 0, depth + 1);
        }
    } else if (it.type == "grid-item") {
        obj = lv_obj_create(parent); _panel_reset(obj);
        lv_obj_set_flex_flow(obj, LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(obj, LV_FLEX_ALIGN_SPACE_BETWEEN, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_all(obj, 8, 0);
        lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), 0);
        lv_obj_set_style_bg_color(obj, lv_color_hex(0x6366f1), LV_STATE_CHECKED);
        lv_obj_set_style_radius(obj, it.radius, 0);
        
        if (!it.topText.empty()) {
            lv_obj_t *top = lv_label_create(obj);
            lv_label_set_text(top, it.topText.c_str());
            lv_obj_set_style_text_font(top, &lv_font_montserrat_12, 0);
            lv_obj_set_style_text_opa(top, LV_OPA_70, 0);
            lv_obj_set_style_text_align(top, LV_TEXT_ALIGN_CENTER, 0);
            lv_obj_set_width(top, lv_pct(100));
        }
        
        if (!it.icon.empty()) {
            lv_obj_t *mid = lv_label_create(obj);
            lv_label_set_text(mid, it.icon.c_str());
            lv_obj_set_style_text_font(mid, &lv_font_montserrat_24, 0);
        }
        
        if (!it.bottomText.empty()) {
            lv_obj_t *bot = lv_label_create(obj);
            lv_label_set_text(bot, it.bottomText.c_str());
            lv_obj_set_style_text_font(bot, &lv_font_montserrat_12, 0);
            lv_obj_set_style_text_color(bot, lv_color_hex(0xffffff), 0);
            lv_obj_set_style_text_align(bot, LV_TEXT_ALIGN_CENTER, 0);
            lv_obj_set_width(bot, lv_pct(100));
        }
    } else if (it.type == "nav-menu") {
        obj = lv_obj_create(parent); _panel_reset(obj);
        lv_obj_set_flex_flow(obj, it.orientation == "h" ? LV_FLEX_FLOW_ROW : LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(obj, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_all(obj, 10, 0); lv_obj_set_style_pad_gap(obj, 10, 0);
        lv_obj_add_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_set_scrollbar_mode(obj, LV_SCROLLBAR_MODE_AUTO);
        for (const auto& child : it.children) _home_render_item(obj, child, 0, 0, depth + 1);
    } else if (it.type == "header") {
        obj = lv_obj_create(parent);
        _panel_reset(obj);
        lv_obj_set_style_bg_color(obj, lv_color_hex(0x0f172a), 0);
        lv_obj_set_style_bg_opa(obj, 204, 0); // 0.8
        lv_obj_set_style_border_width(obj, 0, 0);
        lv_obj_set_style_border_side(obj, LV_BORDER_SIDE_BOTTOM, 0);
        lv_obj_set_style_border_color(obj, lv_color_hex(0x334155), 0);
        lv_obj_set_style_pad_hor(obj, 20, 0);
        lv_obj_clear_flag(obj, LV_OBJ_FLAG_SCROLLABLE);
        
        // Left side: AP & IP
        lv_obj_t *left_cont = lv_obj_create(obj);
        _panel_reset(left_cont);
        lv_obj_set_size(left_cont, LV_SIZE_CONTENT, lv_pct(100));
        lv_obj_align(left_cont, LV_ALIGN_LEFT_MID, 0, 0);
        lv_obj_set_flex_flow(left_cont, LV_FLEX_FLOW_ROW);
        lv_obj_set_flex_align(left_cont, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_gap(left_cont, 15, 0);
        
        // AP Badge
        lv_obj_t *ap_btn = lv_button_create(left_cont);
        lv_obj_set_style_bg_color(ap_btn, lv_color_hex(0x6366f1), 0);
        lv_obj_set_style_radius(ap_btn, 0, 0);
        lv_obj_set_style_pad_hor(ap_btn, 12, 0);
        lv_obj_set_style_pad_ver(ap_btn, 4, 0);
        lv_obj_set_style_shadow_width(ap_btn, 0, 0);
        lv_obj_t *ap_lbl = lv_label_create(ap_btn);
        lv_label_set_text(ap_lbl, "AP");
        lv_obj_set_style_text_font(ap_lbl, &lv_font_montserrat_12, 0);
        lv_obj_set_style_text_color(ap_lbl, lv_color_hex(0xffffff), 0);
        
        if (!it.apTargetScreenId.empty()) {
            char *persist_act = strdup(("scr:" + it.apTargetScreenId).c_str());
            lv_obj_add_event_cb(ap_btn, _item_event_cb, LV_EVENT_CLICKED, persist_act);
        }

        // IP Label
        lv_obj_t *ip_lbl = lv_label_create(left_cont);
        lv_label_set_text(ip_lbl, "Disconnected"); 
        lv_obj_set_style_text_color(ip_lbl, lv_color_hex(0x94a3b8), 0);
        lv_obj_set_style_text_font(ip_lbl, &lv_font_montserrat_14, 0);
        lv_obj_set_user_data(ip_lbl, (void*)"header_ip");
        
        if (!it.ipTargetScreenId.empty()) {
            char *persist_act = strdup(("scr:" + it.ipTargetScreenId).c_str());
            lv_obj_add_event_cb(ip_lbl, _item_event_cb, LV_EVENT_CLICKED, persist_act);
            lv_obj_add_flag(ip_lbl, LV_OBJ_FLAG_CLICKABLE);
        }
        
        // Right side: Icons & Time
        lv_obj_t *right_cont = lv_obj_create(obj);
        _panel_reset(right_cont);
        lv_obj_set_size(right_cont, LV_SIZE_CONTENT, lv_pct(100));
        lv_obj_align(right_cont, LV_ALIGN_RIGHT_MID, 0, 0);
        lv_obj_set_flex_flow(right_cont, LV_FLEX_FLOW_ROW);
        lv_obj_set_flex_align(right_cont, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_gap(right_cont, 12, 0);
        
        lv_obj_t *wifi_icn = lv_label_create(right_cont);
        lv_label_set_text(wifi_icn, LV_SYMBOL_WIFI);
        lv_obj_set_style_text_color(wifi_icn, lv_color_hex(0x94a3b8), 0);
        lv_obj_set_user_data(wifi_icn, (void*)"header_wifi");
        
        lv_obj_t *bat_icn = lv_label_create(right_cont);
        lv_label_set_text(bat_icn, LV_SYMBOL_BATTERY_3 " 98%");
        lv_obj_set_style_text_color(bat_icn, lv_color_hex(0x10b981), 0);
        
        lv_obj_t *time_lbl = lv_label_create(right_cont);
        lv_label_set_text(time_lbl, "00:00");
        lv_obj_set_style_text_font(time_lbl, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(time_lbl, lv_color_hex(0xffffff), 0);
        lv_obj_set_user_data(time_lbl, (void*)"header_time");
    } else if (it.type == "pane-grid") {
        _home_render_pane_grid(parent, it, offsetX, offsetY, depth + 1);
        return; // Already handled positioning inside grid helper
    } else if (it.type == "chart") {
        return; // Disabled permanently for stability test
#if 0
        obj = lv_chart_create(parent);
        bool is_area = (it.chartType == "area");
        lv_chart_set_type(obj, it.chartType == "bar" ? LV_CHART_TYPE_BAR : (it.chartType == "scatter" ? LV_CHART_TYPE_SCATTER : LV_CHART_TYPE_LINE));
        lv_chart_set_point_count(obj, it.chartPoints);
        lv_chart_set_axis_range(obj, LV_CHART_AXIS_PRIMARY_Y, it.min, it.max);
        lv_chart_set_update_mode(obj, LV_CHART_UPDATE_MODE_SHIFT);
        
        lv_chart_series_t *ser = lv_chart_add_series(obj, lv_color_hex(it.chartColor), LV_CHART_AXIS_PRIMARY_Y);
        
        if (is_area) {
            lv_obj_set_style_bg_opa(obj, LV_OPA_40, LV_PART_ITEMS);
            lv_obj_set_style_bg_grad_dir(obj, LV_GRAD_DIR_VER, LV_PART_ITEMS);
            // Gradient from chart color to transparent
            lv_obj_set_style_bg_color(obj, lv_color_hex(it.chartColor), LV_PART_ITEMS);
            lv_obj_set_style_bg_grad_color(obj, lv_color_hex(it.itemBg), LV_PART_ITEMS); 
        }

        // Store series in extra field for updates
        if (!it.id.empty()) {
            g_live_widgets[it.id] = { obj, it.type, ser };
        }
        
        lv_obj_set_style_bg_color(obj, lv_color_hex(it.itemBg), 0);
        lv_obj_set_style_border_width(obj, 1, 0);
        lv_obj_set_style_border_color(obj, lv_color_hex(0x333333), 0);
#endif
    }

    // 2. Apply common properties
    if (obj) {
        if (it.type == "menu-item" || it.type == "nav-item") {
            lv_obj_set_size(obj, lv_pct(100), 50); // Improved touch target
        } else if (it.type == "roller") {
            lv_obj_set_pos(obj, it.x + offsetX, it.y + offsetY);
            // Height is handled by lv_roller_set_visible_row_count
        } else {
            lv_obj_set_pos(obj, it.x + offsetX, it.y + offsetY);
            lv_obj_set_size(obj, it.width, it.height);
        }

        // Apply grid cell if parent is a grid
        if (lv_obj_get_style_layout(parent, LV_PART_MAIN) == LV_LAYOUT_GRID) {
            lv_obj_set_grid_cell(obj, LV_GRID_ALIGN_STRETCH, it.col, 1, LV_GRID_ALIGN_STRETCH, it.row, 1);
        }

        if (it.type == "btn" || it.type == "label" || it.type == "menu-item" || it.type == "nav-item") {
            lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), 0);
            lv_obj_set_style_bg_opa(obj, (it.noBg) ? 0 : LV_OPA_COVER, 0);
        } else if (it.type == "border") {
            lv_obj_set_style_bg_opa(obj, 0, 0);
        } else {
            if (!it.noBg && it.type != "panel-ref") {
                lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), 0);
                lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
            }
        }
        lv_obj_set_style_opa(obj, it.opacity, 0);
        
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
            lv_obj_add_event_cb(obj, _item_event_cb, (it.type == "roller" || it.type == "slider" || it.type == "arc") ? LV_EVENT_VALUE_CHANGED : LV_EVENT_CLICKED, persist_act);
        }

        // MQTT Bindings
#if 0
#ifdef USE_MQTT
        if (g_mqtt_enabled && (!it.mqttTopic.empty() || !it.mqttStateTopic.empty())) {
            MqttBinding *binding = new MqttBinding{it.id, it.type, it.mqttStateTopic.empty() ? it.mqttTopic : it.mqttStateTopic, it.mqttTopic};
            lv_obj_set_user_data(obj, binding);

            // CRITICAL-1: Cleanup binding and unsubscribe on delete
            lv_obj_add_event_cb(obj, [](lv_event_t *e) {
                MqttBinding *data = (MqttBinding *)lv_obj_get_user_data((lv_obj_t *)lv_event_get_target(e));
                if (data) {
                    if (esphome::mqtt::global_mqtt_client && !data->topic.empty()) {
                        esphome::mqtt::global_mqtt_client->unsubscribe(data->topic);
                    }
                    delete data;
                }
            }, LV_EVENT_DELETE, nullptr);
            
            // CRITICAL-2: Thread safe callback via lv_async_call
            if (!binding->topic.empty()) {
                esphome::mqtt::global_mqtt_client->subscribe(binding->topic, [obj, binding](const std::string &topic, const std::string &payload) {
                    auto *u = new MqttUpdateData{obj, binding->type, payload, binding->id};
                    lv_async_call(_mqtt_lvgl_update_async, u);
                });
            }

            if (!it.mqttTopic.empty()) {
                lv_obj_add_event_cb(obj, _home_item_mqtt_cb, LV_EVENT_VALUE_CHANGED, nullptr);
                if (it.type == "btn" || it.type == "menu-item" || it.type == "nav-item") {
                    lv_obj_add_event_cb(obj, _home_item_mqtt_cb, LV_EVENT_CLICKED, nullptr);
                }
            }
        }
#endif
#endif
        
        // 3. Register in Live Registry
        if (!it.id.empty()) {
            // Preserve existing extra data (e.g. from chart branch)
            if (g_live_widgets.count(it.id) && g_live_widgets[it.id].obj == obj) {
                // already registered with extra data
            } else {
                g_live_widgets[it.id] = { obj, it.type, nullptr };
            }
        }

        // 4. Render Icon Overlay
        if (!it.icon.empty()) {
            if (it.icon[0] == '/') {
                // File path
                lv_obj_t *img = lv_image_create(obj);
                lv_image_set_src(img, it.icon.c_str());
                lv_obj_center(img);
                lv_obj_add_flag(img, LV_OBJ_FLAG_EVENT_BUBBLE);
            } else {
                // Emoji/Text
                lv_obj_t *icon_lbl = lv_label_create(obj);
                lv_label_set_text(icon_lbl, it.icon.c_str());
                lv_obj_center(icon_lbl);
                lv_obj_set_style_text_font(icon_lbl, &lv_font_montserrat_24, 0); // Default icon size
                lv_obj_add_flag(icon_lbl, LV_OBJ_FLAG_EVENT_BUBBLE);
            }
        }
    }
}

static void _home_render_panel_ref(lv_obj_t *parent, const GridItem &it, int offsetX, int offsetY, int depth) {
    const Panel *pDef = nullptr;
    for (const auto &p : g_panels) {
        if (p.id == it.panelId) { pDef = &p; break; }
    }
    if (!pDef) {
        ESP_LOGW("GRID", "Panel ID not found: %s", it.panelId.c_str());
        return;
    }

    lv_obj_t *cont = lv_obj_create(parent);
    _panel_reset(cont);
    lv_obj_set_pos(cont, it.x + offsetX, it.y + offsetY);
    lv_obj_set_size(cont, it.width, it.height);
    lv_obj_set_style_bg_color(cont, lv_color_hex(pDef->bg), 0);
    lv_obj_set_style_bg_opa(cont, pDef->bg == 0 ? 0 : LV_OPA_COVER, 0);
    lv_obj_set_style_radius(cont, it.radius, 0);
    lv_obj_set_style_clip_corner(cont, true, 0);
    lv_obj_clear_flag(cont, LV_OBJ_FLAG_SCROLLABLE);

    /* if (pDef->layout == "h" || pDef->layout == "v") {
        lv_obj_set_flex_flow(cont, pDef->layout == "h" ? LV_FLEX_FLOW_ROW : LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(cont, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_START);
        lv_obj_set_style_pad_all(cont, it.padding, 0);
        lv_obj_set_style_pad_gap(cont, pDef->gap, 0);
    } */

    for (const auto &el : pDef->elements) {
        _home_render_item(cont, el, 0, 0, depth + 1);
    }
}

static void _home_render_pane_grid(lv_obj_t *parent, const GridItem &it, int offsetX, int offsetY, int depth) {
    const PaneGrid *pgDef = nullptr;
    std::string lookupId = it.paneGridId.empty() ? it.id : it.paneGridId;
    for (const auto &g : g_pane_grids) {
        if (g.id == lookupId) { pgDef = &g; break; }
    }
    if (!pgDef) {
        ESP_LOGW("GRID", "Pane Grid ID not found: %s (checked %s)", lookupId.c_str(), it.paneGridId.empty() ? "item.id" : "item.paneGridId");
        return;
    }

    lv_obj_t *cont = lv_obj_create(parent);
    _panel_reset(cont);
    lv_obj_set_pos(cont, it.x + offsetX, it.y + offsetY);
    lv_obj_set_size(cont, it.width, it.height);
    lv_obj_set_style_bg_opa(cont, 0, 0);
    lv_obj_set_style_pad_all(cont, 0, 0);
    
    int cols = pgDef->columns > 0 ? pgDef->columns : 3;
    int rows = pgDef->rows > 0 ? pgDef->rows : 3;
    int total_gap = pgDef->gap * (cols - 1);
    int item_w = (it.width - total_gap) / cols;

    // Set grid layout on the container so children (grid-items) can be positioned
    lv_coord_t *col_dsc = new lv_coord_t[cols + 1];
    for(int i=0; i<cols; i++) col_dsc[i] = LV_GRID_FR(1);
    col_dsc[cols] = LV_GRID_TEMPLATE_LAST;

    lv_coord_t *row_dsc = new lv_coord_t[rows + 1];
    for(int i=0; i<rows; i++) row_dsc[i] = LV_GRID_FR(1);
    row_dsc[rows] = LV_GRID_TEMPLATE_LAST;

    lv_obj_set_grid_dsc_array(cont, col_dsc, row_dsc);
    lv_obj_set_style_pad_column(cont, pgDef->gap, 0);
    lv_obj_set_style_pad_row(cont, pgDef->gap, 0);

    // Cleanup for grid descriptors
    GridCleanup *cl = new GridCleanup{col_dsc, row_dsc};
    lv_obj_add_event_cb(cont, [](lv_event_t *e){
        GridCleanup *data = (GridCleanup*)lv_event_get_user_data(e);
        if (data) { delete[] data->c; delete[] data->r; delete data; }
    }, LV_EVENT_DELETE, cl);

    int pane_idx = 0;
    for (const auto &pane : pgDef->panes) {
        lv_obj_t *tile = lv_button_create(cont);
        lv_obj_set_size(tile, item_w, item_w); // Square tiles
        lv_obj_set_style_bg_color(tile, lv_color_hex(pane.bg), 0);
        lv_obj_set_style_radius(tile, 12, 0);
        lv_obj_set_style_pad_all(tile, 8, 0);
        
        int p_col = pane_idx % cols;
        int p_row = pane_idx / cols;
        lv_obj_set_grid_cell(tile, LV_GRID_ALIGN_STRETCH, p_col, 1, LV_GRID_ALIGN_STRETCH, p_row, 1);
        
        // Icon
        if (!pane.icon.empty()) {
            lv_obj_t *icon = lv_label_create(tile);
            lv_label_set_text(icon, pane.icon.c_str());
            lv_obj_set_style_text_font(icon, &lv_font_montserrat_24, 0);
            lv_obj_align(icon, LV_ALIGN_TOP_LEFT, 0, 0);
            lv_obj_add_flag(icon, LV_OBJ_FLAG_EVENT_BUBBLE);
        }

        // Title
        lv_obj_t *lbl = lv_label_create(tile);
        lv_label_set_text(lbl, pane.title.c_str());
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_12, 0);
        lv_obj_set_style_text_color(lbl, lv_color_hex(pane.textColor), 0);
        lv_obj_align(lbl, LV_ALIGN_BOTTOM_LEFT, 0, 0);
        lv_obj_add_flag(lbl, LV_OBJ_FLAG_EVENT_BUBBLE);

        // Click Actions
        if (!pane.onClick.empty()) {
            lv_obj_add_event_cb(tile, _item_event_cb, LV_EVENT_CLICKED, strdup(pane.onClick.c_str()));
        } else if (!pane.mqttTopic.empty()) {
            std::string act = "mqtt:" + pane.mqttTopic + ":toggle";
            lv_obj_add_event_cb(tile, _item_event_cb, LV_EVENT_CLICKED, strdup(act.c_str()));
        }
        
        if (!pane.onDoubleClick.empty()) {
            lv_obj_add_event_cb(tile, _item_event_cb, LV_EVENT_DOUBLE_CLICKED, strdup(pane.onDoubleClick.c_str()));
        }
        
        if (!pane.onLongPress.empty()) {
            lv_obj_add_event_cb(tile, _item_event_cb, LV_EVENT_LONG_PRESSED, strdup(pane.onLongPress.c_str()));
        }
        pane_idx++;
    }

    // Render children directly added to this grid item
    for (const auto& child : it.children) {
        _home_render_item(cont, child, 0, 0, depth + 1);
    }
}

void tab_home_create(lv_obj_t *parent) {
    g_live_widgets.clear();
    lv_obj_clean(parent);
    g_home_grid_cont = lv_obj_create(parent);
    lv_obj_set_size(g_home_grid_cont, 800, 480);
    _panel_reset(g_home_grid_cont);
    lv_obj_add_flag(g_home_grid_cont, (lv_obj_flag_t)(LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_MOMENTUM));
    lv_obj_clear_flag(g_home_grid_cont, LV_OBJ_FLAG_SCROLL_ELASTIC); // Remove white 'spring' overshoot effect
    lv_obj_set_scrollbar_mode(g_home_grid_cont, LV_SCROLLBAR_MODE_AUTO);
    
    ui_refresh_grid();
}

static std::string g_current_ip = "Disconnected";

static void _update_ui_recursive(lv_obj_t *parent, const char *tbuf, const char *best_ip, const char *sta_ip, const char *ap_ip, bool wifi_active, int depth = 0) {
    if (depth > 20) return; // Prevent stack overflow on deep trees
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(parent); i++) {
        lv_obj_t *child = lv_obj_get_child(parent, i);
        void *ud = lv_obj_get_user_data(child);
        const char* widget_id = nullptr;
        // Check if it's a live widget to get its ID
        for (auto const& [id, w] : g_live_widgets) {
            if (w.obj == child) {
                widget_id = id.c_str();
                break;
            }
        }

        bool is_sta_info = widget_id && (strstr(widget_id, "sta_ip") != nullptr);
        bool is_ap_info = widget_id && (strstr(widget_id, "ap_ip") != nullptr);
        bool is_best_info = widget_id && (strcmp(widget_id, "header_ip_label") == 0 || strstr(widget_id, "ip_label"));

        if (ud == (void*)"clock" || ud == (void*)"header_time") {
            lv_label_set_text(child, tbuf);
        } else if (is_sta_info) {
            lv_label_set_text(child, sta_ip);
        } else if (is_ap_info) {
            lv_label_set_text(child, ap_ip);
        } else if (ud == (void*)"header_ip" || is_best_info) {
            lv_label_set_text(child, best_ip);
        } else if (ud == (void*)"header_wifi") {
            lv_obj_set_style_text_color(child, lv_color_hex(wifi_active ? 0x6366f1 : 0x475569), 0);
        }
        _update_ui_recursive(child, tbuf, best_ip, sta_ip, ap_ip, wifi_active, depth + 1);
    }
}

void tab_home_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    if (!g_home_grid_cont) return;
    char time_buf[16];
    snprintf(time_buf, sizeof(time_buf), "%02d:%02d", h, m);
    
    // Check WiFi status
    bool wifi_active = false;
    std::string sta_ip = "0.0.0.0";
    std::string ap_ip = "0.0.0.0";
#ifdef USE_WIFI
    wifi_active = esphome::wifi::global_wifi_component->is_connected();
    if (wifi_active) {
        char buf[esphome::network::IP_ADDRESS_BUFFER_SIZE];
        sta_ip = esphome::wifi::global_wifi_component->get_ip_addresses()[0].str_to(buf);
    }
    
    // Always check AP status
    esp_netif_ip_info_t ap_ip_info;
    esp_netif_t *ap_netif = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
    if (ap_netif) {
        esp_netif_get_ip_info(ap_netif, &ap_ip_info);
        if (ap_ip_info.ip.addr != 0) {
            char buf[32];
            snprintf(buf, sizeof(buf), IPSTR, IP2STR(&ap_ip_info.ip));
            ap_ip = buf;
        }
    }
#endif
    
    std::string best_ip = wifi_active ? sta_ip : (ap_ip != "0.0.0.0" ? ap_ip : "0.0.0.0");
    // _update_ui_recursive(g_home_grid_cont, time_buf, best_ip.c_str(), sta_ip.c_str(), ap_ip.c_str(), wifi_active);
}
