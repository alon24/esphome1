#pragma once
// ── Media screen ──────────────────────────────────────────────────────────────
// Standalone LVGL screen for browsing and viewing images from the SD card.
//
// Layout (800×480):
//   Header  y=0   h=50   — "MEDIA" title + SD status + back button
//   List    y=50  h=350  — scrollable file list (tap to view)
//   Footer  y=400 h=80   — "PLAY ALL" slideshow button + refresh button
//
// Public API:
//   media_screen_create();         // once at boot
//   media_screen_show(prev_scr);   // switch to media screen, refresh file list
//   media_screen_hide();           // return to prev_scr

#include "lvgl.h"
#include "sd_card.h"
#include "slideshow.h"
#include <vector>
#include <string>
#include <cstring>

// ── State ─────────────────────────────────────────────────────────────────────
static lv_obj_t  *g_media_scr      = nullptr;
static lv_obj_t  *g_media_list     = nullptr;   // scrollable list container
static lv_obj_t  *g_media_status   = nullptr;   // header status label
static lv_obj_t  *g_media_prev_scr = nullptr;

static std::vector<std::string> g_media_files;

// ── Single-image viewer (full-screen overlay on media screen) ─────────────────
static lv_obj_t  *g_media_viewer     = nullptr;
static lv_obj_t  *g_media_view_img   = nullptr;
static uint8_t   *g_media_view_buf   = nullptr;
static bool       g_media_viewer_open = false;

static void _media_viewer_close() {
    if (!g_media_viewer_open) return;
    g_media_viewer_open = false;
    if (g_media_viewer) lv_obj_add_flag(g_media_viewer, LV_OBJ_FLAG_HIDDEN);
    if (g_media_view_buf) { free(g_media_view_buf); g_media_view_buf = nullptr; }
}

static void _media_viewer_open_file(const char *path) {
    if (!g_media_viewer) return;
    _media_viewer_close();

    size_t fsz = 0;
    uint8_t *buf = sd_read_file(path, &fsz);
    if (!buf) {
        ESP_LOGW("MEDIA", "Cannot open: %s", path);
        return;
    }
    g_media_view_buf = buf;

    static lv_img_dsc_t dsc;
    dsc.header.cf          = LV_IMG_CF_RAW;
    dsc.header.always_zero = 0;
    dsc.header.reserved    = 0;
    dsc.data_size          = fsz;
    dsc.data               = buf;

    int iw = 800, ih = 480;
    sd_png_dims(buf, fsz, &iw, &ih);
    dsc.header.w = (uint32_t)iw;
    dsc.header.h = (uint32_t)ih;

    lv_img_set_src(g_media_view_img, &dsc);

    // Fit zoom
    uint16_t zx = (uint16_t)((800 * 256) / (iw > 0 ? iw : 1));
    uint16_t zy = (uint16_t)((480 * 256) / (ih > 0 ? ih : 1));
    uint16_t z  = zx < zy ? zx : zy;
    if (z > 256) z = 256;
    lv_img_set_zoom(g_media_view_img, z);
    lv_obj_center(g_media_view_img);

    lv_obj_clear_flag(g_media_viewer, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(g_media_viewer);
    g_media_viewer_open = true;
}

// ── File list builder ──────────────────────────────────────────────────────────
static void _media_refresh_list() {
    if (!g_media_list) return;
    lv_obj_clean(g_media_list);
    g_media_files.clear();

    if (g_media_status) lv_label_set_text(g_media_status, "Scanning...");

    if (!sd_card_init()) {
        if (g_media_status) lv_label_set_text(g_media_status, "SD card not found");
        return;
    }

    g_media_files = sd_list_images();

    char sbuf[48];
    snprintf(sbuf, sizeof(sbuf), "%d files on SD", (int)g_media_files.size());
    if (g_media_status) lv_label_set_text(g_media_status, sbuf);

    if (g_media_files.empty()) {
        lv_obj_t *empty = lv_label_create(g_media_list);
        lv_label_set_text(empty, "No images found on SD card");
        lv_obj_set_style_text_color(empty, lv_color_hex(0x666666), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(empty, &lv_font_montserrat_16, LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(empty, LV_OPA_TRANSP, LV_STATE_DEFAULT);
        lv_obj_set_pos(empty, 16, 16);
        return;
    }

    int row_h = 48;
    for (int i = 0; i < (int)g_media_files.size(); i++) {
        const std::string &path = g_media_files[i];
        const char *name = sd_basename(path.c_str());

        lv_obj_t *row = lv_obj_create(g_media_list);
        lv_obj_set_pos(row, 0, i * (row_h + 2));
        lv_obj_set_size(row, 760, row_h);
        lv_obj_set_style_bg_color(row, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_color(row, lv_color_hex(0x003030), LV_STATE_PRESSED);
        lv_obj_set_style_bg_opa(row, LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(row, LV_OPA_COVER, LV_STATE_PRESSED);
        lv_obj_set_style_pad_all(row, 0, 0);
        lv_obj_set_style_radius(row, 4, 0);
        lv_obj_set_style_border_color(row, lv_color_hex(0x2a2a2a), LV_STATE_DEFAULT);
        lv_obj_set_style_border_width(row, 1, LV_STATE_DEFAULT);
        lv_obj_set_style_shadow_width(row, 0, 0);
        lv_obj_clear_flag(row, LV_OBJ_FLAG_SCROLLABLE);

        lv_obj_t *lbl = lv_label_create(row);
        lv_label_set_text(lbl, name);
        lv_label_set_long_mode(lbl, LV_LABEL_LONG_DOT);
        lv_obj_set_width(lbl, 700);
        lv_obj_set_style_text_color(lbl, lv_color_hex(0xC8C5C4), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(lbl, LV_OPA_TRANSP, LV_STATE_DEFAULT);
        lv_obj_set_pos(lbl, 12, 15);

        // Ext badge
        lv_obj_t *ext_lbl = lv_label_create(row);
        lv_label_set_text(ext_lbl, sd_ext(path.c_str()));
        lv_obj_set_style_text_color(ext_lbl, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(ext_lbl, &lv_font_montserrat_14, LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(ext_lbl, LV_OPA_TRANSP, LV_STATE_DEFAULT);
        lv_obj_set_pos(ext_lbl, 720, 16);

        // Pass path via closure copy — store index in user_data
        lv_obj_set_user_data(row, (void *)(intptr_t)i);
        lv_obj_add_event_cb(row, [](lv_event_t *e) {
            lv_obj_t *r = lv_event_get_target(e);
            int idx = (int)(intptr_t)lv_obj_get_user_data(r);
            if (idx >= 0 && idx < (int)g_media_files.size()) {
                _media_viewer_open_file(g_media_files[idx].c_str());
            }
        }, LV_EVENT_CLICKED, nullptr);
    }

    // Set list height to fit all rows (enables scrolling)
    lv_obj_set_height(g_media_list,
        (int)g_media_files.size() * (row_h + 2) + 8);
}

// ── Public API ────────────────────────────────────────────────────────────────

static void media_screen_hide() {
    _media_viewer_close();
    if (g_media_prev_scr) lv_scr_load(g_media_prev_scr);
    g_media_prev_scr = nullptr;
}

static void media_screen_show(lv_obj_t *prev_scr) {
    if (!g_media_scr) return;
    g_media_prev_scr = prev_scr;
    lv_scr_load(g_media_scr);
    _media_refresh_list();
}

static void media_screen_create() {
    g_media_scr = lv_obj_create(nullptr);
    lv_obj_set_size(g_media_scr, 800, 480);
    lv_obj_set_style_bg_color(g_media_scr, lv_color_hex(0x0e0e0e), 0);
    lv_obj_set_style_bg_opa(g_media_scr, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(g_media_scr, 0, 0);
    lv_obj_clear_flag(g_media_scr, LV_OBJ_FLAG_SCROLLABLE);

    // ── HEADER (800×50) ───────────────────────────────────────────────────────
    lv_obj_t *hdr = lv_obj_create(g_media_scr);
    lv_obj_set_pos(hdr, 0, 0);
    lv_obj_set_size(hdr, 800, 50);
    lv_obj_set_style_bg_color(hdr, lv_color_hex(0x131313), 0);
    lv_obj_set_style_bg_opa(hdr, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(hdr, 0, 0);
    lv_obj_set_style_radius(hdr, 0, 0);
    lv_obj_set_style_border_width(hdr, 0, 0);
    lv_obj_set_style_shadow_width(hdr, 0, 0);
    lv_obj_clear_flag(hdr, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *title = lv_label_create(hdr);
    lv_label_set_text(title, "MEDIA");
    lv_obj_set_style_text_color(title, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(title, &lv_font_montserrat_22, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(title, lv_color_hex(0x131313), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(title, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_pos(title, 16, 14);

    g_media_status = lv_label_create(hdr);
    lv_label_set_text(g_media_status, "");
    lv_obj_set_style_text_color(g_media_status, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_media_status, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(g_media_status, lv_color_hex(0x131313), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_media_status, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_pos(g_media_status, 120, 17);

    // Back button
    lv_obj_t *back_btn = lv_obj_create(hdr);
    lv_obj_set_pos(back_btn, 720, 0);
    lv_obj_set_size(back_btn, 80, 50);
    lv_obj_set_style_bg_color(back_btn, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(back_btn, lv_color_hex(0x003030), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(back_btn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(back_btn, LV_OPA_COVER, LV_STATE_PRESSED);
    lv_obj_set_style_pad_all(back_btn, 0, 0);
    lv_obj_set_style_radius(back_btn, 0, 0);
    lv_obj_set_style_border_width(back_btn, 0, 0);
    lv_obj_set_style_shadow_width(back_btn, 0, 0);
    lv_obj_clear_flag(back_btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_t *back_lbl = lv_label_create(back_btn);
    lv_label_set_text(back_lbl, "BACK");
    lv_obj_set_style_text_color(back_lbl, lv_color_hex(0xC8C5C4), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(back_lbl, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(back_lbl, LV_OPA_TRANSP, LV_STATE_DEFAULT);
    lv_obj_center(back_lbl);
    lv_obj_add_event_cb(back_btn, [](lv_event_t *) {
        media_screen_hide();
    }, LV_EVENT_CLICKED, nullptr);

    // ── SCROLLABLE FILE LIST (y=50, h=350) ───────────────────────────────────
    lv_obj_t *scroll_cont = lv_obj_create(g_media_scr);
    lv_obj_set_pos(scroll_cont, 20, 55);
    lv_obj_set_size(scroll_cont, 760, 340);
    lv_obj_set_style_bg_color(scroll_cont, lv_color_hex(0x0e0e0e), 0);
    lv_obj_set_style_bg_opa(scroll_cont, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(scroll_cont, 0, 0);
    lv_obj_set_style_radius(scroll_cont, 0, 0);
    lv_obj_set_style_border_width(scroll_cont, 0, 0);
    lv_obj_set_style_shadow_width(scroll_cont, 0, 0);
    lv_obj_add_flag(scroll_cont, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(scroll_cont, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(scroll_cont, LV_SCROLLBAR_MODE_ACTIVE);

    g_media_list = scroll_cont;

    // ── FOOTER (y=400, h=80) ─────────────────────────────────────────────────
    lv_obj_t *footer = lv_obj_create(g_media_scr);
    lv_obj_set_pos(footer, 0, 400);
    lv_obj_set_size(footer, 800, 80);
    lv_obj_set_style_bg_color(footer, lv_color_hex(0x131313), 0);
    lv_obj_set_style_bg_opa(footer, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(footer, 0, 0);
    lv_obj_set_style_radius(footer, 0, 0);
    lv_obj_set_style_border_side(footer, LV_BORDER_SIDE_TOP, 0);
    lv_obj_set_style_border_color(footer, lv_color_hex(0x2a2a2a), 0);
    lv_obj_set_style_border_width(footer, 1, 0);
    lv_obj_set_style_shadow_width(footer, 0, 0);
    lv_obj_clear_flag(footer, LV_OBJ_FLAG_SCROLLABLE);

    // PLAY ALL button (left 50%)
    lv_obj_t *play_btn = lv_obj_create(footer);
    lv_obj_set_pos(play_btn, 0, 0);
    lv_obj_set_size(play_btn, 400, 80);
    lv_obj_set_style_bg_color(play_btn, lv_color_hex(0x003030), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(play_btn, lv_color_hex(0x005050), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(play_btn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(play_btn, LV_OPA_COVER, LV_STATE_PRESSED);
    lv_obj_set_style_pad_all(play_btn, 0, 0);
    lv_obj_set_style_radius(play_btn, 0, 0);
    lv_obj_set_style_border_width(play_btn, 0, 0);
    lv_obj_set_style_shadow_width(play_btn, 0, 0);
    lv_obj_clear_flag(play_btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_t *play_lbl = lv_label_create(play_btn);
    lv_label_set_text(play_lbl, "PLAY ALL");
    lv_obj_set_style_text_color(play_lbl, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(play_lbl, &lv_font_montserrat_20, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(play_lbl, LV_OPA_TRANSP, LV_STATE_DEFAULT);
    lv_obj_center(play_lbl);
    lv_obj_add_event_cb(play_btn, [](lv_event_t *) {
        slideshow_start(g_media_scr);
    }, LV_EVENT_CLICKED, nullptr);

    // REFRESH button (right 50%)
    lv_obj_t *ref_btn = lv_obj_create(footer);
    lv_obj_set_pos(ref_btn, 400, 0);
    lv_obj_set_size(ref_btn, 400, 80);
    lv_obj_set_style_bg_color(ref_btn, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(ref_btn, lv_color_hex(0x2a2a2a), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(ref_btn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(ref_btn, LV_OPA_COVER, LV_STATE_PRESSED);
    lv_obj_set_style_pad_all(ref_btn, 0, 0);
    lv_obj_set_style_radius(ref_btn, 0, 0);
    lv_obj_set_style_border_width(ref_btn, 0, 0);
    lv_obj_set_style_shadow_width(ref_btn, 0, 0);
    lv_obj_clear_flag(ref_btn, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_t *ref_lbl = lv_label_create(ref_btn);
    lv_label_set_text(ref_lbl, "REFRESH");
    lv_obj_set_style_text_color(ref_lbl, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(ref_lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(ref_lbl, LV_OPA_TRANSP, LV_STATE_DEFAULT);
    lv_obj_center(ref_lbl);
    lv_obj_add_event_cb(ref_btn, [](lv_event_t *) {
        _media_refresh_list();
    }, LV_EVENT_CLICKED, nullptr);

    // ── SINGLE-IMAGE VIEWER (full-screen overlay, initially hidden) ───────────
    g_media_viewer = lv_obj_create(g_media_scr);
    lv_obj_set_pos(g_media_viewer, 0, 0);
    lv_obj_set_size(g_media_viewer, 800, 480);
    lv_obj_set_style_bg_color(g_media_viewer, lv_color_hex(0x000000), 0);
    lv_obj_set_style_bg_opa(g_media_viewer, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(g_media_viewer, 0, 0);
    lv_obj_set_style_radius(g_media_viewer, 0, 0);
    lv_obj_set_style_border_width(g_media_viewer, 0, 0);
    lv_obj_set_style_shadow_width(g_media_viewer, 0, 0);
    lv_obj_clear_flag(g_media_viewer, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_add_flag(g_media_viewer, LV_OBJ_FLAG_HIDDEN);

    g_media_view_img = lv_img_create(g_media_viewer);
    lv_obj_set_style_bg_opa(g_media_view_img, LV_OPA_TRANSP, 0);

    // Tap viewer to close
    lv_obj_add_event_cb(g_media_viewer, [](lv_event_t *) {
        _media_viewer_close();
    }, LV_EVENT_CLICKED, nullptr);

    // "tap to close" hint
    lv_obj_t *hint = lv_label_create(g_media_viewer);
    lv_label_set_text(hint, "Tap to close");
    lv_obj_set_style_text_color(hint, lv_color_hex(0x444444), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(hint, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(hint, LV_OPA_TRANSP, LV_STATE_DEFAULT);
    lv_obj_set_pos(hint, 8, 460);
}
