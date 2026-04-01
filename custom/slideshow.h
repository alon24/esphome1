#pragma once
// ── Slideshow screen ──────────────────────────────────────────────────────────
// Full-screen image viewer that cycles through PNG/GIF/JPG files from SD card.
//
// Usage:
//   slideshow_screen_create();          // once at boot, creates LVGL objects
//   slideshow_start(prev_scr);          // switch to slideshow, load images
//   slideshow_stop();                   // return to prev_scr
//   slideshow_check_sleep(inactive_ms); // call every second; auto-starts after 60s idle
//
// Image display:
//   PNG/JPG  → lv_img_dsc_t{cf=LV_IMG_CF_RAW, data=file_bytes}  (lodepng decodes)
//
// Auto-advance: 10 s per image (configurable via SLIDESHOW_ADVANCE_MS)
// Sleep trigger: 60 s inactivity (configurable via SLIDESHOW_IDLE_MS)

#include "lvgl.h"
#include "sd_card.h"
#include <vector>
#include <string>
#include <cstring>

#define SLIDESHOW_ADVANCE_MS  10000   // ms per image
#define SLIDESHOW_IDLE_MS     60000   // ms idle before sleep mode kicks in

// ── State ─────────────────────────────────────────────────────────────────────
static lv_obj_t  *g_ss_scr      = nullptr;   // slideshow screen
static lv_obj_t  *g_ss_img      = nullptr;   // lv_img widget (PNG/JPG)
static lv_obj_t  *g_ss_info     = nullptr;   // filename / index overlay
static lv_obj_t  *g_ss_prev_scr = nullptr;   // screen to return to on exit
static lv_timer_t *g_ss_timer   = nullptr;   // auto-advance timer

static std::vector<std::string> g_ss_files;
static int    g_ss_idx    = 0;
static uint8_t *g_ss_buf  = nullptr;   // currently loaded file buffer (free on advance)
static bool   g_ss_active = false;

// ── Forward declarations ───────────────────────────────────────────────────────
static void _ss_load(int idx);
static void _ss_timer_cb(lv_timer_t *);

// ── Buffer helpers ─────────────────────────────────────────────────────────────
static void _ss_free_buf() {
    if (g_ss_buf) { free(g_ss_buf); g_ss_buf = nullptr; }
}

// ── Image helpers ──────────────────────────────────────────────────────────────
static void _ss_hide_widgets() {
    if (g_ss_img) lv_obj_add_flag(g_ss_img, LV_OBJ_FLAG_HIDDEN);
}

// Fit image to screen preserving aspect ratio; returns zoom (256 = 1:1)
static uint16_t _ss_fit_zoom(int img_w, int img_h, int scr_w, int scr_h) {
    if (img_w <= 0 || img_h <= 0) return 256;
    // Scale to fit within scr_w × scr_h
    uint16_t zx = (uint16_t)((scr_w * 256) / img_w);
    uint16_t zy = (uint16_t)((scr_h * 256) / img_h);
    uint16_t z  = zx < zy ? zx : zy;
    return z > 256 ? 256 : z;  // never upscale beyond 1:1
}

// ── Load one file ──────────────────────────────────────────────────────────────
static void _ss_load(int idx) {
    if (g_ss_files.empty()) return;
    idx = ((idx % (int)g_ss_files.size()) + (int)g_ss_files.size()) % (int)g_ss_files.size();
    g_ss_idx = idx;

    _ss_hide_widgets();
    _ss_free_buf();

    const std::string &path = g_ss_files[idx];

    // Update info label
    if (g_ss_info) {
        char buf[64];
        snprintf(buf, sizeof(buf), "%d / %d  %s",
                 idx + 1, (int)g_ss_files.size(), sd_basename(path.c_str()));
        lv_label_set_text(g_ss_info, buf);
    }

    int scr_w = 800, scr_h = 480;

    // ── PNG / JPG via lv_img ───────────────────────────────────────────────
    size_t fsz = sd_file_size(path.c_str());
    if (fsz == 0) goto next_file;

    g_ss_buf = sd_read_file(path.c_str(), &fsz);
    if (!g_ss_buf) goto next_file;

    {
        static lv_img_dsc_t img_dsc;
        img_dsc.header.cf          = LV_IMG_CF_RAW;
        img_dsc.header.always_zero = 0;
        img_dsc.header.reserved    = 0;
        img_dsc.data_size          = fsz;
        img_dsc.data               = g_ss_buf;

        int iw = scr_w, ih = scr_h;
        sd_png_dims(g_ss_buf, fsz, &iw, &ih);
        img_dsc.header.w = (uint32_t)iw;
        img_dsc.header.h = (uint32_t)ih;

        lv_obj_clear_flag(g_ss_img, LV_OBJ_FLAG_HIDDEN);
        lv_img_set_src(g_ss_img, &img_dsc);
        uint16_t zoom = _ss_fit_zoom(iw, ih, scr_w, scr_h);
        lv_img_set_zoom(g_ss_img, zoom);
        lv_obj_center(g_ss_img);
    }
    return;

next_file:
    // Failed to load — skip to next
    ESP_LOGW("SS", "Failed to load: %s", path.c_str());
    _ss_free_buf();
    _ss_load((idx + 1) % (int)g_ss_files.size());
}

// ── Timer callback ─────────────────────────────────────────────────────────────
static void _ss_timer_cb(lv_timer_t *) {
    if (!g_ss_active || g_ss_files.empty()) return;
    _ss_load((g_ss_idx + 1) % (int)g_ss_files.size());
}

// ── Public API ────────────────────────────────────────────────────────────────

// Call once at boot to create the LVGL screen and widgets
static void slideshow_screen_create() {
    g_ss_scr = lv_obj_create(nullptr);   // standalone screen (not child of any parent)
    lv_obj_set_size(g_ss_scr, 800, 480);
    lv_obj_set_style_bg_color(g_ss_scr, lv_color_hex(0x000000), 0);
    lv_obj_set_style_bg_opa(g_ss_scr, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(g_ss_scr, 0, 0);
    lv_obj_clear_flag(g_ss_scr, LV_OBJ_FLAG_SCROLLABLE);

    // lv_img widget (PNG / JPG)
    g_ss_img = lv_img_create(g_ss_scr);
    lv_obj_set_style_bg_opa(g_ss_img, LV_OPA_TRANSP, 0);
    lv_obj_add_flag(g_ss_img, LV_OBJ_FLAG_HIDDEN);

    // Info overlay — bottom bar
    lv_obj_t *bar = lv_obj_create(g_ss_scr);
    lv_obj_set_pos(bar, 0, 450);
    lv_obj_set_size(bar, 800, 30);
    lv_obj_set_style_bg_color(bar, lv_color_hex(0x000000), 0);
    lv_obj_set_style_bg_opa(bar, LV_OPA_50, 0);
    lv_obj_set_style_pad_all(bar, 0, 0);
    lv_obj_set_style_radius(bar, 0, 0);
    lv_obj_set_style_border_width(bar, 0, 0);
    lv_obj_clear_flag(bar, LV_OBJ_FLAG_SCROLLABLE);

    g_ss_info = lv_label_create(bar);
    lv_label_set_text(g_ss_info, "");
    lv_obj_set_style_text_color(g_ss_info, lv_color_hex(0xAAAAAA), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_ss_info, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_ss_info, LV_OPA_TRANSP, LV_STATE_DEFAULT);
    lv_obj_set_pos(g_ss_info, 8, 7);

    // Tap-to-exit: tap anywhere on screen stops slideshow
    lv_obj_add_event_cb(g_ss_scr, [](lv_event_t *) {
        slideshow_stop();
    }, LV_EVENT_CLICKED, nullptr);
}

// Start slideshow: save current screen, scan SD, begin cycling
static void slideshow_start(lv_obj_t *prev_scr) {
    if (g_ss_active) return;
    if (!g_ss_scr) slideshow_screen_create();

    g_ss_prev_scr = prev_scr;
    g_ss_active   = true;

    // (Re-)scan SD card images
    g_ss_files.clear();
    if (sd_card_init()) {
        g_ss_files = sd_list_images();
    }

    if (g_ss_files.empty()) {
        ESP_LOGW("SS", "No images on SD card");
        g_ss_active = false;
        return;
    }

    lv_scr_load(g_ss_scr);
    g_ss_idx = 0;
    _ss_load(0);

    if (!g_ss_timer) {
        g_ss_timer = lv_timer_create(_ss_timer_cb, SLIDESHOW_ADVANCE_MS, nullptr);
    } else {
        lv_timer_reset(g_ss_timer);
        lv_timer_resume(g_ss_timer);
    }
    ESP_LOGI("SS", "Slideshow started: %d images", (int)g_ss_files.size());
}

// Stop slideshow: return to previous screen
static void slideshow_stop() {
    if (!g_ss_active) return;
    g_ss_active = false;

    if (g_ss_timer) lv_timer_pause(g_ss_timer);
    _ss_hide_widgets();
    _ss_free_buf();

    if (g_ss_prev_scr) lv_scr_load(g_ss_prev_scr);
    g_ss_prev_scr = nullptr;
    ESP_LOGI("SS", "Slideshow stopped");
}

// Call every second from dashboard_tick; starts slideshow after idle threshold
static void slideshow_check_sleep() {
    if (g_ss_active) return;
    uint32_t idle = lv_disp_get_inactive_time(nullptr);
    if (idle >= SLIDESHOW_IDLE_MS) {
        if (!sd_card_init()) return;    // no SD card, don't trigger
        if (sd_list_images().empty()) return;
        lv_obj_t *cur = lv_scr_act();
        slideshow_start(cur);
    }
}
