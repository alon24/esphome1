#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "grid_config.h"

// ── GRIDOS PRECISION CORE (v79) ───────────────────────────────────────────────
// Absolute Geometry + Zero-Text Elements
// ──────────────────────────────────────────────────────────────────────────────

#define GRID_COLS    8
#define GRID_CELL_W  80
#define GRID_CELL_H  80

static lv_obj_t *g_home_grid_cont = nullptr;

static void _home_render_grid();

void ui_refresh_grid() {
    _home_render_grid();
}

static void _grid_element_click_cb(lv_event_t * e) {
    int data = (int)(intptr_t)lv_event_get_user_data(e);
    int item_idx = data / 100;
    int el_idx   = data % 100;

    if (item_idx < 0 || item_idx >= g_grid_items.size()) return;
    const auto &it = g_grid_items[item_idx];
    if (el_idx < 0 || el_idx >= it.elements.size()) return;
    const auto &el = it.elements[el_idx];
    
    ESP_LOGI("GRID", "Component: %s | Widget: %s | Action: %s", it.name.c_str(), el.name.c_str(), el.action.c_str());
    
    // Dispatch Action
    if (el.action.find("goto:") == 0) {
        std::string next_screen = el.action.substr(5);
        grid_config_load(next_screen);
        ui_refresh_grid();
    } else if (el.action.find("mqtt:") == 0) {
        // This will be caught by the ESPHome YAML event listener
        std::string topic = el.action.substr(5);
        ESP_LOGD("ACTION", "Dispatching MQTT Trigger: %s", topic.c_str());
        #ifdef USE_MQTT
        // global_mqtt_client->publish(topic, "PRESS"); // Example if accessible
        #endif
    } else if (el.action.find("toggle:") == 0) {
         ESP_LOGD("ACTION", "GPIO Toggle requested: %s", el.action.c_str());
    }
}

static void tab_home_create(lv_obj_t *parent) {
    g_home_grid_cont = lv_obj_create(parent);
    lv_obj_set_size(g_home_grid_cont, 640, 416); 
    _panel_reset(g_home_grid_cont);
    lv_obj_set_style_bg_color(g_home_grid_cont, lv_color_hex(g_grid_bg), 0);
    lv_obj_set_style_bg_opa(g_home_grid_cont, LV_OPA_COVER, 0);
    
    lv_obj_set_scroll_dir(g_home_grid_cont, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(g_home_grid_cont, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_add_flag(g_home_grid_cont, LV_OBJ_FLAG_SCROLL_ELASTIC | LV_OBJ_FLAG_SCROLL_MOMENTUM);
    lv_obj_set_style_pad_all(g_home_grid_cont, 0, 0);

    ::grid_config_load();
    _home_render_grid();
}

static void _home_render_grid() {
    if (!g_home_grid_cont) return;
    lv_coord_t scroll_y = lv_obj_get_scroll_y(g_home_grid_cont);
    lv_obj_clean(g_home_grid_cont);

    for (int i = 0; i < g_grid_items.size(); i++) {
        const auto &item = g_grid_items[i];
        lv_obj_t *obj = lv_obj_create(g_home_grid_cont);
        _panel_reset(obj);
        lv_obj_set_size(obj, item.w * GRID_CELL_W, item.h * GRID_CELL_H);
        lv_obj_set_pos(obj, item.x * GRID_CELL_W, item.y * GRID_CELL_H);
        
        lv_obj_set_style_bg_color(obj, lv_color_hex(item.color), 0);
        lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(obj, 12, 0);
        lv_obj_set_style_border_width(obj, 1, 0);
        lv_obj_set_style_border_color(obj, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_style_border_opa(obj, 15, 0);
        lv_obj_set_style_clip_corner(obj, true, 0);

        auto apply_geo = [&](lv_obj_t* child, const GridElement& el) {
            int bw = (int)(item.w * GRID_CELL_W * el.innerW / 100.0);
            int bh = (int)(item.h * GRID_CELL_H * el.innerH / 100.0);
            
            if (el.type == "clock" || el.type == "label") {
                lv_obj_update_layout(child);
                bw = lv_obj_get_width(child);
                bh = lv_obj_get_height(child);
            } else {
                lv_obj_set_size(child, bw, bh);
            }

            int target_x = (int)(item.w * GRID_CELL_W * el.innerX / 100.0) - (bw / 2);
            int target_y = (int)(item.h * GRID_CELL_H * el.innerY / 100.0) - (bh / 2);
            lv_obj_set_pos(child, target_x, target_y);
        };

        for (int j = 0; j < item.elements.size(); j++) {
            const auto &el = item.elements[j];
            int packed_idx = (i * 100) + j;

            if (el.type == "clock") {
                lv_obj_t *time_lbl = lv_label_create(obj);
                lv_obj_set_style_text_color(time_lbl, lv_color_hex(el.textColor), 0);
                
                int fs = (int)(24 * el.innerW / 100.0); 
                if (fs < 14) lv_obj_set_style_text_font(time_lbl, &lv_font_montserrat_12, 0);
                else if (fs < 18) lv_obj_set_style_text_font(time_lbl, &lv_font_montserrat_14, 0);
                else if (fs < 24) lv_obj_set_style_text_font(time_lbl, &lv_font_montserrat_18, 0);
                else if (fs < 32) lv_obj_set_style_text_font(time_lbl, &lv_font_montserrat_24, 0);
                else if (fs < 48) lv_obj_set_style_text_font(time_lbl, &lv_font_montserrat_32, 0);
                else lv_obj_set_style_text_font(time_lbl, &lv_font_montserrat_48, 0);

                lv_obj_set_user_data(time_lbl, (void*)"clock"); 
                apply_geo(time_lbl, el);

            } else if (el.type == "label") {
                lv_obj_t *lbl = lv_label_create(obj);
                lv_label_set_text(lbl, el.name.c_str());
                lv_obj_set_style_text_color(lbl, lv_color_hex(el.textColor), 0);
                
                int fs = (int)(18 * el.innerW / 100.0);
                if (fs < 14) lv_obj_set_style_text_font(lbl, &lv_font_montserrat_12, 0);
                else if (fs < 18) lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, 0);
                else if (fs < 24) lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, 0);
                else if (fs < 32) lv_obj_set_style_text_font(lbl, &lv_font_montserrat_24, 0);
                else if (fs < 48) lv_obj_set_style_text_font(lbl, &lv_font_montserrat_32, 0);
                else lv_obj_set_style_text_font(lbl, &lv_font_montserrat_48, 0);
                
                apply_geo(lbl, el);

            } else if (el.type == "btn") {
                lv_obj_t *btn = lv_btn_create(obj);
                apply_geo(btn, el);
                lv_obj_add_event_cb(btn, _grid_element_click_cb, LV_EVENT_CLICKED, (void*)(intptr_t)packed_idx);

            } else if (el.type == "switch") {
                lv_obj_t *sw = lv_switch_create(obj);
                apply_geo(sw, el);
                lv_obj_add_event_cb(sw, _grid_element_click_cb, LV_EVENT_VALUE_CHANGED, (void*)(intptr_t)packed_idx);

            } else if (el.type == "slider") {
                lv_obj_t *sl = lv_slider_create(obj);
                apply_geo(sl, el);
                lv_obj_add_event_cb(sl, _grid_element_click_cb, LV_EVENT_VALUE_CHANGED, (void*)(intptr_t)packed_idx);
            }
        }
    }
    lv_obj_scroll_to_y(g_home_grid_cont, scroll_y, LV_ANIM_OFF);
}

static void tab_home_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    if (!g_home_grid_cont) return;
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(g_home_grid_cont); i++) {
        lv_obj_t * block = lv_obj_get_child(g_home_grid_cont, i);
        if (!block) continue;
        for (uint32_t j = 0; j < lv_obj_get_child_cnt(block); j++) {
            lv_obj_t * child = lv_obj_get_child(block, j);
            if (lv_obj_get_user_data(child) == (void*)"clock") {
                char time_buf[16];
                snprintf(time_buf, sizeof(time_buf), "%02d:%02d:%02d", h, m, s);
                lv_label_set_text(child, time_buf);
            }
        }
    }
}
