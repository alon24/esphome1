#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "version_info.h"
#include "tab_home.h"
#include "tab_settings.h"
#include "tab_wifi.h"
// #include "media_screen.h"
// #include "slideshow.h"
#include "tab_sd.h"
#include <cstdio>

// ── MAIN DASHBOARD ORCHESTRATOR ───────────────────────────────────────────────
// Layout (800×480):
//   Header  y=0   h=64   — title, version, IP
//   Content y=64  h=352  — tab panels (home / settings / wifi)
//   Footer  y=416 h=64   — tab navigation (3 buttons)

#define DASH_BG      0x0e0e0e
#define DASH_HDR_BG  0x131313
#define DASH_FTR_BG  0x131313

// ── Globals ───────────────────────────────────────────────────────────────────
static lv_obj_t *g_dash_time_lbl    = nullptr;
static lv_obj_t *g_dash_ap_btn      = nullptr;
static lv_obj_t *g_dash_ip_btn      = nullptr;
static lv_obj_t *g_dash_tabs[4]     = {nullptr, nullptr, nullptr, nullptr};
static lv_obj_t *g_dash_nav[4]      = {nullptr, nullptr, nullptr, nullptr};
static int        g_dash_active_tab = 0;

// ── Tab switching ─────────────────────────────────────────────────────────────
static void _dash_show_tab(int idx) {
    if (idx == g_dash_active_tab && g_dash_tabs[idx]) {
        // Already shown, but still allow (e.g. for initial setup)
    }
    int prev_tab = g_dash_active_tab;
    g_dash_active_tab = idx;

    for (int i = 0; i < 4; i++) {
        if (!g_dash_tabs[i]) continue;
        if (i == idx) lv_obj_clear_flag(g_dash_tabs[i], LV_OBJ_FLAG_HIDDEN);
        else          lv_obj_add_flag(g_dash_tabs[i], LV_OBJ_FLAG_HIDDEN);
    }

    // Update nav button highlight
    for (int i = 0; i < 4; i++) {
        if (!g_dash_nav[i]) continue;
        bool active = (i == idx);
        uint32_t bg = active ? 0x1C2828 : DASH_FTR_BG;
        // Set bg for DEFAULT and PRESSED — keeps label bg in sync on touch
        lv_obj_set_style_bg_color(g_dash_nav[i], lv_color_hex(bg), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_color(g_dash_nav[i], lv_color_hex(bg), LV_STATE_PRESSED);
        lv_obj_set_style_bg_color(g_dash_nav[i], lv_color_hex(bg), LV_STATE_FOCUSED);
        // Update label text color and bg (must match button bg for clean anti-alias)
        lv_obj_t *lbl = lv_obj_get_child(g_dash_nav[i], 0);
        if (lbl) {
            lv_obj_set_style_text_color(lbl,
                lv_color_hex(active ? 0x00CED1 : 0xC8C5C4), LV_STATE_DEFAULT);
            lv_obj_set_style_bg_color(lbl, lv_color_hex(bg), LV_STATE_DEFAULT);
            lv_obj_set_style_bg_color(lbl, lv_color_hex(bg), LV_STATE_PRESSED);
            lv_obj_set_style_bg_opa(lbl, LV_OPA_COVER, LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(lbl, LV_OPA_COVER, LV_STATE_PRESSED);
        }
    }

    // Side effects when switching tabs
    if (prev_tab == 3 && idx != 3) {
        tab_sd_on_hide();
    }
    if (idx == 2) {
        tab_wifi_on_show();
    }
    if (idx != 2) {
        // Hide keyboard when leaving wifi tab
        _wifi_kb_hide();
    }
    if (idx == 3) {
        tab_sd_on_show();
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
static void ui_set_connected(const char *ip = nullptr) {
    char buf[32] = "";
    if (ip && ip[0]) snprintf(buf, sizeof(buf), "%s", ip);
    else             snprintf(buf, sizeof(buf), "Connected");

    if (g_dash_ip_btn) {
        lv_obj_t *lbl = lv_obj_get_child(g_dash_ip_btn, 0);
        if (lbl) {
            lv_label_set_text(lbl, buf);
            lv_obj_set_style_text_color(lbl, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
        }
    }

    char net_str[48];
    snprintf(net_str, sizeof(net_str), "Connected  %s", buf);
    tab_home_set_network(net_str);
    tab_settings_set_ip(ip && ip[0] ? ip : "");
    tab_settings_set_network("Connected");
    tab_wifi_set_status("Connected - check header for IP");
}

static void ui_set_disconnected() {
    if (g_dash_ip_btn) {
        lv_obj_t *lbl = lv_obj_get_child(g_dash_ip_btn, 0);
        if (lbl) {
            lv_label_set_text(lbl, "Disconnected");
            lv_obj_set_style_text_color(lbl, lv_color_hex(0xff4444), LV_STATE_DEFAULT);
        }
    }
    tab_home_set_network("Not connected");
    tab_settings_set_ip("---");
    tab_settings_set_network("Disconnected");
}

#include "esphome/components/lovyan_verified/lovyan_gfx.h"

// High-speed flush callback for LVGL
static void lvgl_flush_cb(lv_disp_drv_t *drv, const lv_area_t *area, lv_color_t *color_p) {
    auto &lcd = esphome::lovyan_gfx::v_lcd();
    int32_t w = (area->x2 - area->x1 + 1);
    int32_t h = (area->y2 - area->y1 + 1);
    
    lcd.startWrite();
    lcd.setAddrWindow(area->x1, area->y1, w, h);
    lcd.writePixels((uint16_t *)&color_p->full, w * h);
    lcd.endWrite();

    lv_disp_flush_ready(drv);
}

// ── Main create ───────────────────────────────────────────────────────────────
static void maindashboard_create(void) {

    // Override screen background
    lv_obj_t *scr = lv_scr_act();
    lv_obj_clean(scr);

    // SPEED OPTIMIZATION: Patch the slow ESPHome flush_cb with our fast Lovyan driver
    lv_disp_t *disp = lv_disp_get_default();
    if (disp != nullptr && disp->driver != nullptr) {
        disp->driver->flush_cb = lvgl_flush_cb;
        ESP_LOGI("main", "LVGL Speed-Patch Applied: Block-flush active.");
    }

    lv_obj_set_style_bg_color(scr, lv_color_hex(DASH_BG), 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(scr, 0, 0);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

    // Full-screen root (buries any theme/display bg leakage)
    lv_obj_t *root = lv_obj_create(scr);
    lv_obj_set_size(root, 800, 480);
    lv_obj_set_pos(root, 0, 0);
    lv_obj_set_style_bg_color(root, lv_color_hex(DASH_BG), 0);
    lv_obj_set_style_bg_opa(root, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(root, 0, 0);
    lv_obj_set_style_radius(root, 0, 0);
    _panel_reset(root);
    lv_obj_clear_flag(root, LV_OBJ_FLAG_SCROLLABLE);

    // ── HEADER (800×64 at y=0) ────────────────────────────────────────────────
    lv_obj_t *header = _make_panel(root, 0, 0, 800, 64, DASH_HDR_BG);

    // App Name (Top-Left)
    lv_obj_t *title = lv_label_create(header);
    lv_label_set_text(title, APP_NAME);
    lv_obj_set_style_text_color(title, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(title, &lv_font_montserrat_26, LV_STATE_DEFAULT);
    _lbl_bg(title, DASH_HDR_BG);
    lv_obj_set_pos(title, 20, 18);

    // Time (Next to App Name)
    g_dash_time_lbl = lv_label_create(header);
    lv_label_set_text(g_dash_time_lbl, "--:--");
    lv_obj_set_style_text_color(g_dash_time_lbl, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_dash_time_lbl, &lv_font_montserrat_20, LV_STATE_DEFAULT);
    _lbl_bg(g_dash_time_lbl, DASH_HDR_BG);
    lv_obj_set_pos(g_dash_time_lbl, 190, 22);

    // IP / Connectivity (Top-Right, clickable)
    g_dash_ip_btn = lv_obj_create(header);
    lv_obj_set_size(g_dash_ip_btn, 220, 50);
    lv_obj_align(g_dash_ip_btn, LV_ALIGN_RIGHT_MID, -10, 0);
    lv_obj_set_style_bg_color(g_dash_ip_btn, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_dash_ip_btn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_dash_ip_btn, 6, LV_STATE_DEFAULT);
    _panel_reset(g_dash_ip_btn);
    lv_obj_add_event_cb(g_dash_ip_btn, [](lv_event_t *) { _dash_show_tab(2); }, LV_EVENT_CLICKED, nullptr);

    lv_obj_t *ip_lbl = lv_label_create(g_dash_ip_btn);
    lv_label_set_text(ip_lbl, "Disconnected");
    lv_obj_set_style_text_color(ip_lbl, lv_color_hex(0xff4444), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(ip_lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_align(ip_lbl, LV_ALIGN_CENTER, 0, 0);
    _lbl_bg(ip_lbl, 0x1a1a1a);

    // AP Icon (Left of IP, clickable)
    g_dash_ap_btn = lv_obj_create(header);
    lv_obj_set_size(g_dash_ap_btn, 50, 50);
    lv_obj_align(g_dash_ap_btn, LV_ALIGN_RIGHT_MID, -240, 0);
    lv_obj_set_style_bg_color(g_dash_ap_btn, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_dash_ap_btn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_dash_ap_btn, 25, LV_STATE_DEFAULT); // Circle
    _panel_reset(g_dash_ap_btn);
    lv_obj_add_event_cb(g_dash_ap_btn, [](lv_event_t *) {
        wifi_mode_t mode;
        esp_wifi_get_mode(&mode);
        if (mode == WIFI_MODE_STA) esp_wifi_set_mode(WIFI_MODE_APSTA);
        else if (mode == WIFI_MODE_APSTA) esp_wifi_set_mode(WIFI_MODE_STA);
    }, LV_EVENT_CLICKED, nullptr);

    lv_obj_t *ap_ico = lv_label_create(g_dash_ap_btn);
    lv_label_set_text(ap_ico, LV_SYMBOL_WIFI);
    lv_obj_set_style_text_color(ap_ico, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(ap_ico, &lv_font_montserrat_20, LV_STATE_DEFAULT);
    lv_obj_align(ap_ico, LV_ALIGN_CENTER, 0, 0);
    _lbl_bg(ap_ico, 0x1a1a1a);

    // Version label (Left of AP icon)
    lv_obj_t *ver_lbl = lv_label_create(header);
    lv_label_set_text(ver_lbl, FW_VERSION_STR);
    lv_obj_set_style_text_color(ver_lbl, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(ver_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(ver_lbl, DASH_HDR_BG);
    lv_obj_align_to(ver_lbl, g_dash_ap_btn, LV_ALIGN_OUT_LEFT_MID, -10, 0);

    // ── CONTENT AREA (800×352 at y=64) ───────────────────────────────────────
    lv_obj_t *content = _make_panel(root, 0, 64, 800, 352, DASH_BG);

    // Tab 0 — HOME
    g_dash_tabs[0] = _make_panel(content, 0, 0, 800, 352, DASH_BG);
    tab_home_create(g_dash_tabs[0]);

    // Tab 1 — SETTINGS
    g_dash_tabs[1] = _make_panel(content, 0, 0, 800, 352, DASH_BG);
    tab_settings_create(g_dash_tabs[1]);

    // Tab 2 — WIFI (also creates floating keyboard as child of root)
    g_dash_tabs[2] = _make_panel(content, 0, 0, 800, 352, DASH_BG);
    tab_wifi_create(g_dash_tabs[2], root);

    // Tab 3 — SD CARD
    g_dash_tabs[3] = _make_panel(content, 0, 0, 800, 352, DASH_BG);
    tab_sd_create(g_dash_tabs[3]);

    // Start with HOME tab visible
    lv_obj_add_flag(g_dash_tabs[1], LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(g_dash_tabs[2], LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(g_dash_tabs[3], LV_OBJ_FLAG_HIDDEN);

    // ── FOOTER (800×64 at y=416) ──────────────────────────────────────────────
    lv_obj_t *footer = _make_panel(root, 0, 416, 800, 64, DASH_FTR_BG);
    lv_obj_set_style_border_side(footer, LV_BORDER_SIDE_TOP, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(footer, lv_color_hex(0x2a2a2a), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(footer, 1, LV_STATE_DEFAULT);

    static const char *NAV_TXT[] = { "HOME", "SETTINGS", "WIFI", "SD" };
    // Widths: 4 × 200 = 800
    static const int NAV_X[]    = { 0, 200, 400, 600 };
    static const int NAV_W[]    = { 200, 200, 200, 200 };

    for (int i = 0; i < (int)(sizeof(NAV_TXT) / sizeof(NAV_TXT[0])); i++) {
        g_dash_nav[i] = lv_obj_create(footer);
        lv_obj_set_pos(g_dash_nav[i], NAV_X[i], 0);
        lv_obj_set_size(g_dash_nav[i], NAV_W[i], 64);
        lv_obj_set_style_bg_color(g_dash_nav[i],
            lv_color_hex(i == 0 ? 0x1C2828 : DASH_FTR_BG), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(g_dash_nav[i], LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_pad_all(g_dash_nav[i], 0, LV_STATE_DEFAULT);
        lv_obj_set_style_radius(g_dash_nav[i], 0, LV_STATE_DEFAULT);
        _panel_reset(g_dash_nav[i]);
        lv_obj_clear_flag(g_dash_nav[i], LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_clear_flag(g_dash_nav[i], LV_OBJ_FLAG_CLICK_FOCUSABLE);
        // Lock pressed/focused bg to same as default — prevents label bg mismatch
        lv_obj_set_style_bg_color(g_dash_nav[i], lv_color_hex(i == 0 ? 0x1C2828 : DASH_FTR_BG), LV_STATE_PRESSED);
        lv_obj_set_style_bg_color(g_dash_nav[i], lv_color_hex(i == 0 ? 0x1C2828 : DASH_FTR_BG), LV_STATE_FOCUSED);
        lv_obj_set_style_bg_opa(g_dash_nav[i], LV_OPA_COVER, LV_STATE_PRESSED);
        lv_obj_set_style_bg_opa(g_dash_nav[i], LV_OPA_COVER, LV_STATE_FOCUSED);

        lv_obj_t *nl = lv_label_create(g_dash_nav[i]);
        lv_label_set_text(nl, NAV_TXT[i]);
        lv_obj_set_style_text_color(nl,
            lv_color_hex(i == 0 ? 0x00CED1 : 0xC8C5C4), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(nl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
        uint32_t nbg = i == 0 ? 0x1C2828 : DASH_FTR_BG;
        _lbl_bg(nl, nbg);
        lv_obj_set_pos(nl, 0, 25);
        lv_obj_set_width(nl, NAV_W[i]);
        lv_obj_set_style_text_align(nl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);

        // Pass tab index via user_data for the click callback
        lv_obj_set_user_data(g_dash_nav[i], (void *)(intptr_t)i);
        lv_obj_add_event_cb(g_dash_nav[i], [](lv_event_t *e) {
            lv_obj_t *btn = lv_event_get_target(e);
            int idx = (int)(intptr_t)lv_obj_get_user_data(btn);
            _dash_show_tab(idx);
        }, LV_EVENT_CLICKED, nullptr);
    }
}

// ── Tick: called every second from device.yaml interval ───────────────────────
// h=-1 signals SNTP not yet synced
static void dashboard_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    // Update Header Time
    if (g_dash_time_lbl) {
        if (h == -1) {
            lv_label_set_text(g_dash_time_lbl, "--:--");
        } else {
            char tbuf[16];
            snprintf(tbuf, sizeof(tbuf), "%02d:%02d:%02d", h, m, s);
            lv_label_set_text(g_dash_time_lbl, tbuf);
        }
    }

    // Update AP Icon Color
    if (g_dash_ap_btn) {
        wifi_mode_t mode;
        esp_wifi_get_mode(&mode);
        bool ap_on = (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA);
        lv_obj_t *ico = lv_obj_get_child(g_dash_ap_btn, 0);
        if (ico) {
            lv_obj_set_style_text_color(ico, lv_color_hex(ap_on ? 0x00FF00 : 0x888888), LV_STATE_DEFAULT);
        }
    }

    tab_home_tick(h, m, s, dom, mon, year, dow);
    tab_settings_tick();
    tab_wifi_tick();
    tab_sd_poll();
}
