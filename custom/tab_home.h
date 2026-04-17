#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "grid_config.h"

// ── RECURSIVE ABSOLUTE RENDERER (v92) ─────────────────────────────────────────

static lv_obj_t *g_home_grid_cont = nullptr;

static void _home_render_item(lv_obj_t *parent, const GridItem &it, int offsetX = 0, int offsetY = 0);

void ui_refresh_grid() {
    if (!g_home_grid_cont) return;
    ESP_LOGI("GRID", "Refreshing UI (Items: %d, Panels: %d)", (int)g_grid_items.size(), (int)g_panels.size());
    lv_obj_clean(g_home_grid_cont);
    lv_obj_set_style_bg_color(g_home_grid_cont, lv_color_hex(g_grid_bg), 0);
    lv_obj_set_style_border_color(g_home_grid_cont, lv_color_hex(g_grid_border_color), 0);
    lv_obj_set_style_border_width(g_home_grid_cont, g_grid_border_width, 0);
    lv_obj_set_style_border_side(g_home_grid_cont, LV_BORDER_SIDE_FULL, 0);
    
    for (const auto &it : g_grid_items) {
        _home_render_item(g_home_grid_cont, it);
    }
}

static void _item_event_cb(lv_event_t *e) {
    const char *action = (const char *)lv_event_get_user_data(e);
    if (action) {
        ESP_LOGI("GRID", "UI Action: %s", action);
        if (strncmp(action, "scr:", 4) == 0) {
            const char *screen_name = action + 4;
            ESP_LOGI("GRID", "Navigating to screen: %s", screen_name);
            void grid_config_save(const char* json, const char* name);
            grid_config_save("", screen_name); // This reloads the UI via internal flag
        }
    }
}

static void _home_render_item(lv_obj_t *parent, const GridItem &it, int offsetX, int offsetY) {
    lv_obj_t *obj = nullptr;
    
    if (it.type == "panel-ref") {
        const Panel* pDef = nullptr;
        for (const auto &p : g_panels) {
            if (p.id == it.panelId) { pDef = &p; break; }
        }
        
        if (pDef) {
            ESP_LOGI("GRID", "Rendering Panel Reference: %s at %d,%d", pDef->name.c_str(), it.x, it.y);
            lv_obj_t *panel_obj = lv_obj_create(parent);
            _panel_reset(panel_obj);
            lv_obj_set_size(panel_obj, it.w, it.h);
            lv_obj_set_pos(panel_obj, it.x + offsetX, it.y + offsetY);
            lv_obj_set_style_bg_opa(panel_obj, 0, 0); // Ensure panel vessel is transparent
            lv_obj_set_style_clip_corner(panel_obj, true, 0);
            
            for (const auto &child : pDef->elements) {
                _home_render_item(panel_obj, child, 0, 0);
            }
            return;
        } else {
            ESP_LOGW("GRID", "Panel Reference ID not found: %s", it.panelId.c_str());
            return;
        }
    }

    if (it.type == "btn") {
        obj = lv_btn_create(parent);
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
        obj = lv_label_create(parent);
        lv_obj_set_user_data(obj, (void*)"clock");
        lv_label_set_text(obj, "00:00:00");
    } else if (it.type == "label") {
        obj = lv_label_create(parent);
        lv_label_set_text(obj, it.name.empty() ? "LABEL" : it.name.c_str());
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
    } else if (it.type == "nav-menu") {
        obj = lv_obj_create(parent);
        _panel_reset(obj);
        lv_obj_set_flex_flow(obj, it.orientation == "h" ? LV_FLEX_FLOW_ROW : LV_FLEX_FLOW_COLUMN);
        lv_obj_set_flex_align(obj, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_all(obj, 10, 0);
        lv_obj_set_style_pad_gap(obj, 10, 0);
        
        char buf[512];
        strncpy(buf, it.options.c_str(), 511);
        char *line = strtok(buf, "\n");
        while (line) {
            char *sep = strchr(line, '|');
            if (sep) {
                *sep = '\0';
                char *label = line;
                char *act = sep + 1;
                
                lv_obj_t *btn = lv_btn_create(obj);
                lv_obj_set_size(btn, it.orientation == "h" ? LV_SIZE_CONTENT : lv_pct(100), LV_SIZE_CONTENT);
                lv_obj_t *l = lv_label_create(btn);
                lv_label_set_text(l, label);
                lv_obj_center(l);
                
                char *persist_act = strdup(act);
                lv_obj_add_event_cb(btn, _item_event_cb, LV_EVENT_CLICKED, persist_act);
            }
            line = strtok(NULL, "\n");
        }
    }

    if (obj) {
        lv_obj_set_size(obj, it.w, it.h);
        lv_obj_set_pos(obj, it.x + offsetX, it.y + offsetY);
        
        // Only apply background color to objects that aren't inherently stylized (like labels)
        if (it.type != "label" && it.type != "clock" && it.type != "border") {
            lv_obj_set_style_bg_color(obj, lv_color_hex(it.color), 0);
            lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
        } else if (it.type == "border") {
            lv_obj_set_style_bg_opa(obj, LV_OPA_TRANSP, 0);
        }
        
        lv_obj_set_style_text_color(obj, lv_color_hex(it.textColor), 0);
        lv_obj_set_style_border_color(obj, lv_color_hex(it.textColor), 0); // Use textColor as border color
        lv_obj_set_style_border_width(obj, it.borderWidth, 0);
        lv_obj_set_style_radius(obj, it.radius, 0);
        
        if (!it.action.empty()) {
            lv_obj_add_flag(obj, LV_OBJ_FLAG_CLICKABLE);
            lv_obj_add_event_cb(obj, _item_event_cb, LV_EVENT_CLICKED, (void*)it.action.c_str());
        }
    }
}

void tab_home_create(lv_obj_t *parent) {
    lv_obj_clean(parent);
    g_home_grid_cont = lv_obj_create(parent);
    lv_obj_set_size(g_home_grid_cont, 640, 416);
    _panel_reset(g_home_grid_cont);
    lv_obj_add_flag(g_home_grid_cont, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_SCROLL_MOMENTUM);
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
}
