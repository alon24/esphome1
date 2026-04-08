#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "grid_config.h"

// ── DYNAMIC GRID HOME TAB ─────────────────────────────────────────────────────
// Layout: 640x416
// Grid: 8 columns (80px each), 80px rows.
// ──────────────────────────────────────────────────────────────────────────────

#define GRID_COLS    8
#define GRID_CELL_W  80
#define GRID_CELL_H  80
#define TAB_HOME_BG  0x0e0e0e

static lv_obj_t *g_home_grid_cont = nullptr;

static void _home_render_grid();

void ui_refresh_grid() {
    _home_render_grid();
}

static void tab_home_create(lv_obj_t *parent) {
    // Parent is 640x416 panel
    g_home_grid_cont = lv_obj_create(parent);
    lv_obj_set_size(g_home_grid_cont, 640, 416);
    lv_obj_set_pos(g_home_grid_cont, 0, 0);
    _panel_reset(g_home_grid_cont);
    lv_obj_set_style_bg_color(g_home_grid_cont, lv_color_hex(g_grid_bg), 0);
    lv_obj_set_style_bg_opa(g_home_grid_cont, LV_OPA_COVER, 0);
    
    // Enable vertical scrolling
    lv_obj_set_scroll_dir(g_home_grid_cont, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(g_home_grid_cont, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_style_pad_all(g_home_grid_cont, 0, 0);

    // Load configuration from flash
    ::grid_config_load();
    _home_render_grid();
}

static void _home_render_grid() {
    if (!g_home_grid_cont) return;
    
    // Save scroll position
    lv_coord_t scroll_y = lv_obj_get_scroll_y(g_home_grid_cont);
    
    lv_obj_clean(g_home_grid_cont);

    for (const auto &item : g_grid_items) {
        // Create base container/button for the block
        lv_obj_t *obj = nullptr;
        
        if (item.type == "btn" || item.type == "switch" || item.type == "slider") {
            obj = lv_btn_create(g_home_grid_cont);
        } else {
            obj = lv_obj_create(g_home_grid_cont);
            _panel_reset(obj);
        }

        lv_obj_set_size(obj, item.w * GRID_CELL_W - 4, item.h * GRID_CELL_H - 4);
        lv_obj_set_pos(obj, item.x * GRID_CELL_W + 2, item.y * GRID_CELL_H + 2);
        
        lv_obj_set_style_bg_color(obj, lv_color_hex(item.color), 0);
        lv_obj_set_style_bg_opa(obj, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(obj, 12, 0);
        lv_obj_set_style_shadow_width(obj, 0, 0);
        lv_obj_set_style_border_width(obj, 1, 0);
        lv_obj_set_style_border_color(obj, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_style_border_opa(obj, 25, 0);
        lv_obj_set_style_clip_corner(obj, true, 0);

        if (item.type == "btn") {
            lv_obj_t *lbl = lv_label_create(obj);
            lv_label_set_text(lbl, item.name.c_str());
            lv_obj_set_style_text_color(lbl, lv_color_hex(item.textColor), 0);
            lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, 0);
            lv_obj_center(lbl);
        } 
        else if (item.type == "switch") {
            lv_obj_t *sw = lv_switch_create(obj);
            lv_obj_set_size(sw, 50 * item.scale / 100, 25 * item.scale / 100);
            lv_obj_center(sw);
            
            lv_obj_t *lbl = lv_label_create(obj);
            lv_label_set_text(lbl, item.name.c_str());
            lv_obj_set_style_text_color(lbl, lv_color_hex(item.textColor), 0);
            lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, 0);
            lv_obj_align(lbl, LV_ALIGN_TOP_MID, 0, 5);
        }
        else if (item.type == "slider") {
            lv_obj_t *slider = lv_slider_create(obj);
            lv_obj_set_width(slider, lv_pct(item.scale > 100 ? 95 : item.scale));
            lv_obj_center(slider);
            
            lv_obj_t *lbl = lv_label_create(obj);
            lv_label_set_text(lbl, item.name.c_str());
            lv_obj_set_style_text_color(lbl, lv_color_hex(item.textColor), 0);
            lv_obj_set_style_text_font(lbl, &lv_font_montserrat_14, 0);
            lv_obj_align(lbl, LV_ALIGN_TOP_MID, 0, 5);
        }
        else if (item.type == "label" || item.type == "clock") {
            lv_obj_t *lbl = lv_label_create(obj);
            lv_label_set_text(lbl, item.name.c_str());
            lv_obj_set_style_text_color(lbl, lv_color_hex(item.textColor), 0);
            
            // Adjust font size based on scale (cheap approximation)
            if (item.scale < 80) lv_obj_set_style_text_font(lbl, &lv_font_montserrat_12, 0);
            else if (item.scale > 150) lv_obj_set_style_text_font(lbl, &lv_font_montserrat_24, 0);
            else lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, 0);

            lv_obj_center(lbl);
            if (item.type == "clock") {
                lv_obj_set_user_data(lbl, (void*)"clock"); // Tag it
            }
        }
    }
    // Restore scroll position
    lv_obj_scroll_to_y(g_home_grid_cont, scroll_y, LV_ANIM_OFF);
}

static void tab_home_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    if (!g_home_grid_cont) return;

    // Search for clock labels and update them
    for (uint32_t i = 0; i < lv_obj_get_child_cnt(g_home_grid_cont); i++) {
        lv_obj_t * block = lv_obj_get_child(g_home_grid_cont, i);
        if (!block) continue;
        for (uint32_t j = 0; j < lv_obj_get_child_cnt(block); j++) {
            lv_obj_t * child = lv_obj_get_child(block, j);
            if (lv_obj_get_user_data(child) == (void*)"clock") {
                char time_buf[16];
                sprintf(time_buf, "%02d:%02d:%02d", h, m, s);
                lv_label_set_text(child, time_buf);
            }
        }
    }
}

static void tab_home_set_network(const char *text) {
    // Future: Update network block if present
}
