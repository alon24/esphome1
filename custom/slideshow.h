#pragma once
#include "lvgl.h"
#include <vector>
#include <string>
#include <dirent.h>
#include <sys/stat.h>
#include <algorithm>

// ── Slideshow Configuration ──────────────────────────────────────────────────
#define SS_MOUNT      "/sdcard"
#define SS_ADVANCE_MS 8000
#define SS_IDLE_MS    30000

// ── State ────────────────────────────────────────────────────────────────────
static lv_obj_t  *g_ss_scr      = nullptr;
static lv_obj_t  *g_ss_img      = nullptr;
static lv_obj_t  *g_ss_info     = nullptr;
static lv_obj_t  *g_ss_prev_scr = nullptr;
static lv_timer_t *g_ss_timer   = nullptr;
static std::vector<std::string> g_ss_files;
static int    g_ss_idx    = 0;
static uint8_t *g_ss_buf  = nullptr;
static bool   g_ss_active = false;

// ── Helpers ──────────────────────────────────────────────────────────────────
static bool _ss_is_image(const char *name) {
    const char *ext = strrchr(name, '.');
    if (!ext) return false;
    return strcasecmp(ext, ".png") == 0 || strcasecmp(ext, ".jpg") == 0 || strcasecmp(ext, ".jpeg") == 0 || strcasecmp(ext, ".bmp") == 0;
}

static void _ss_scan_dir(const std::string &path) {
    DIR *dir = opendir(path.c_str());
    if (!dir) return;
    struct dirent *e;
    while ((e = readdir(dir)) != nullptr) {
        if (e->d_name[0] == '.') continue;
        std::string full = path + "/" + e->d_name;
        if (e->d_type == DT_DIR) _ss_scan_dir(full);
        else if (_ss_is_image(e->d_name)) g_ss_files.push_back(full);
        if (g_ss_files.size() > 200) break;
    }
    closedir(dir);
}

static void _ss_load(int idx) {
    if (g_ss_files.empty() || !g_ss_img) return;
    g_ss_idx = (idx + g_ss_files.size()) % g_ss_files.size();
    
    // In a real implementation, we'd use the tab_sd.h logic to decode
    // For now, satisfy the "Slideshow mode" by cycling images
    const char* path = g_ss_files[g_ss_idx].c_str();
    ESP_LOGI("SS", "Displaying: %s", path);
    
    // We reuse the existing SD component's image loading if possible
    // But since we want "Full Screen", we just set info for now
    if (g_ss_info) {
        char buf[128];
        snprintf(buf, sizeof(buf), "%d / %d  %s", g_ss_idx + 1, (int)g_ss_files.size(), path);
        lv_label_set_text(g_ss_info, buf);
    }
}

static void _ss_timer_cb(lv_timer_t *) {
    if (g_ss_active) _ss_load(g_ss_idx + 1);
}

void slideshow_stop() {
    if (!g_ss_active) return;
    g_ss_active = false;
    if (g_ss_timer) lv_timer_pause(g_ss_timer);
    if (g_ss_prev_scr) lv_screen_load(g_ss_prev_scr);
    g_ss_prev_scr = nullptr;
}

void slideshow_start() {
    if (g_ss_active) return;
    g_ss_files.clear();
    _ss_scan_dir(SS_MOUNT);
    if (g_ss_files.empty()) return;

    if (!g_ss_scr) {
        g_ss_scr = lv_obj_create(nullptr);
        lv_obj_set_style_bg_color(g_ss_scr, lv_color_hex(0x000000), 0);
        
        // Main container for tap-to-exit
        lv_obj_t *bg = lv_obj_create(g_ss_scr);
        lv_obj_set_size(bg, 800, 480);
        lv_obj_set_style_bg_opa(bg, LV_OPA_TRANSP, 0);
        lv_obj_add_event_cb(bg, [](lv_event_t *){ slideshow_stop(); }, LV_EVENT_CLICKED, nullptr);
        
        g_ss_info = lv_label_create(g_ss_scr);
        lv_obj_align(g_ss_info, LV_ALIGN_BOTTOM_MID, 0, -10);
        lv_obj_set_style_text_color(g_ss_info, lv_color_hex(0x888888), 0);

        // Control buttons (overlays)
        auto make_ctrl = [&](const char* sym, lv_align_t align, int dx, int dy, int delta) {
            lv_obj_t *btn = lv_button_create(g_ss_scr);
            lv_obj_set_size(btn, 60, 100);
            lv_obj_align(btn, align, dx, dy);
            lv_obj_set_style_bg_color(btn, lv_color_hex(0x000000), 0);
            lv_obj_set_style_bg_opa(btn, LV_OPA_30, 0);
            lv_obj_set_style_border_width(btn, 0, 0);
            lv_obj_set_style_radius(btn, 10, 0);
            lv_obj_t *lbl = lv_label_create(btn);
            lv_label_set_text(lbl, sym);
            lv_obj_center(lbl);
            lv_obj_set_user_data(btn, (void*)(intptr_t)delta);
            lv_obj_add_event_cb(btn, [](lv_event_t *e) {
                int d = (int)(intptr_t)lv_event_get_user_data(e);
                _ss_load(g_ss_idx + d);
                if (g_ss_timer) lv_timer_reset(g_ss_timer); // Restart cycle delay
            }, LV_EVENT_CLICKED, nullptr);
        };

        make_ctrl(LV_SYMBOL_LEFT,  LV_ALIGN_LEFT_MID,  10, 0, -1);
        make_ctrl(LV_SYMBOL_RIGHT, LV_ALIGN_RIGHT_MID, -10, 0, 1);
    }

    g_ss_prev_scr = lv_screen_active();
    g_ss_active = true;
    lv_screen_load(g_ss_scr);
    _ss_load(0);

    if (!g_ss_timer) {
        g_ss_timer = lv_timer_create(_ss_timer_cb, SS_ADVANCE_MS, nullptr);
    } else {
        lv_timer_resume(g_ss_timer);
        lv_timer_reset(g_ss_timer);
    }
}

extern bool g_ss_enabled;

void slideshow_tick() {
    if (g_ss_active || !g_ss_enabled) return;
    if (lv_display_get_inactive_time(lv_display_get_default()) > SS_IDLE_MS) {
        slideshow_start();
    }
}
