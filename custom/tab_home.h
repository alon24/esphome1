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
    lv_obj_clean(g_home_grid_cont);

    for (const auto &item : g_grid_items) {
        lv_obj_t *btn = lv_btn_create(g_home_grid_cont);
        lv_obj_set_size(btn, item.w * GRID_CELL_W - 4, item.h * GRID_CELL_H - 4);
        lv_obj_set_pos(btn, item.x * GRID_CELL_W + 2, item.y * GRID_CELL_H + 2);
        
        lv_obj_set_style_bg_color(btn, lv_color_hex(item.color), 0);
        lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(btn, 8, 0);
        lv_obj_set_style_shadow_width(btn, 0, 0);
        lv_obj_set_style_border_width(btn, 1, 0);
        lv_obj_set_style_border_color(btn, lv_color_hex(0xFFFFFF), 0);
        lv_obj_set_style_border_opa(btn, 20, 0);

        lv_obj_t *lbl = lv_label_create(btn);
        lv_label_set_text(lbl, item.name.c_str());
        lv_obj_set_style_text_color(lbl, lv_color_hex(item.textColor), 0);
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, 0);
        lv_obj_center(lbl);

        // Grid Click Handler
        lv_obj_add_event_cb(btn, [](lv_event_t *e) {
            lv_obj_t * target = lv_event_get_target(e);
            lv_obj_t * label = lv_obj_get_child(target, 0);
            if (label) {
                printf("[GRID] Click: %s\n", lv_label_get_text(label));
            }
        }, LV_EVENT_CLICKED, nullptr);
    }
}

static void tab_home_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    // Future: Update clock block if present in grid items
}

static void tab_home_set_network(const char *text) {
    // Future: Update network block if present
}
