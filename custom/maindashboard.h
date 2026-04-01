#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "version_info.h"
#include "tab_home.h"
#include "tab_settings.h"
#include "tab_wifi.h"
// #include "media_screen.h"
// #include "slideshow.h"
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
static lv_obj_t *g_dash_ip_lbl      = nullptr;
static lv_obj_t *g_dash_ver_lbl     = nullptr;
static lv_obj_t *g_dash_tabs[3]     = {nullptr, nullptr, nullptr};
static lv_obj_t *g_dash_nav[3]      = {nullptr, nullptr, nullptr};
static int        g_dash_active_tab = 0;

// ── Tab switching ─────────────────────────────────────────────────────────────
static void _dash_show_tab(int idx) {
    if (idx == g_dash_active_tab && g_dash_tabs[idx]) {
        // Already shown, but still allow (e.g. for initial setup)
    }
    g_dash_active_tab = idx;

    for (int i = 0; i < 3; i++) {
        if (!g_dash_tabs[i]) continue;
        if (i == idx) lv_obj_clear_flag(g_dash_tabs[i], LV_OBJ_FLAG_HIDDEN);
        else          lv_obj_add_flag(g_dash_tabs[i], LV_OBJ_FLAG_HIDDEN);
    }

    // Update nav button highlight
    for (int i = 0; i < 3; i++) {
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
    if (idx == 2) {
        tab_wifi_on_show();
    }
    if (idx != 2) {
        // Hide keyboard when leaving wifi tab
        _wifi_kb_hide();
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
static void ui_set_connected(const char *ip = nullptr) {
    char buf[32] = "";
    if (ip && ip[0]) snprintf(buf, sizeof(buf), "%s", ip);
    else             snprintf(buf, sizeof(buf), "Connected");

    if (g_dash_ip_lbl) lv_label_set_text(g_dash_ip_lbl, buf);

    char net_str[48];
    snprintf(net_str, sizeof(net_str), "Connected  %s", buf);
    tab_home_set_network(net_str);
    tab_settings_set_ip(ip && ip[0] ? ip : "");
    tab_settings_set_network("Connected");
    tab_wifi_set_status("Connected — check header for IP");
}

static void ui_set_disconnected() {
    if (g_dash_ip_lbl) lv_label_set_text(g_dash_ip_lbl, "No network");
    tab_home_set_network("Not connected");
    tab_settings_set_ip("---");
    tab_settings_set_network("Disconnected");
}

// ── Main create ───────────────────────────────────────────────────────────────
static void maindashboard_create(void) {

    // Override screen background
    lv_obj_t *scr = lv_scr_act();
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

    // Logo / title
    lv_obj_t *title = lv_label_create(header);
    lv_label_set_text(title, "CYANIDE");
    lv_obj_set_style_text_color(title, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(title, &lv_font_montserrat_26, LV_STATE_DEFAULT);
    _lbl_bg(title, DASH_HDR_BG);
    lv_obj_set_pos(title, 48, 20);

    // Status dot
    lv_obj_t *dot = lv_obj_create(header);
    lv_obj_set_size(dot, 10, 10);
    lv_obj_set_style_bg_color(dot, lv_color_hex(0x47EAED), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(dot, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(dot, LV_RADIUS_CIRCLE, LV_STATE_DEFAULT);
    _panel_reset(dot);
    lv_obj_set_pos(dot, 172, 27);

    // Version label
    g_dash_ver_lbl = lv_label_create(header);
    lv_label_set_text(g_dash_ver_lbl, FW_VERSION_STR);
    lv_obj_set_style_text_color(g_dash_ver_lbl, lv_color_hex(0x555555), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_dash_ver_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(g_dash_ver_lbl, DASH_HDR_BG);
    lv_obj_set_pos(g_dash_ver_lbl, 498, 26);

    // IP label
    g_dash_ip_lbl = lv_label_create(header);
    lv_label_set_text(g_dash_ip_lbl, "Connecting...");
    lv_obj_set_style_text_color(g_dash_ip_lbl, lv_color_hex(0xadaaaa), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_dash_ip_lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    _lbl_bg(g_dash_ip_lbl, DASH_HDR_BG);
    lv_obj_set_pos(g_dash_ip_lbl, 542, 24);

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

    // Start with HOME tab visible
    lv_obj_add_flag(g_dash_tabs[1], LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_flag(g_dash_tabs[2], LV_OBJ_FLAG_HIDDEN);

    // ── FOOTER (800×64 at y=416) ──────────────────────────────────────────────
    lv_obj_t *footer = _make_panel(root, 0, 416, 800, 64, DASH_FTR_BG);
    lv_obj_set_style_border_side(footer, LV_BORDER_SIDE_TOP, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(footer, lv_color_hex(0x2a2a2a), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(footer, 1, LV_STATE_DEFAULT);

    static const char *NAV_TXT[] = { "HOME", "SETTINGS", "WIFI" };
    // Widths: 267, 267, 266
    static const int NAV_X[]    = { 0, 267, 534 };
    static const int NAV_W[]    = { 267, 267, 266 };

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
    tab_home_tick(h, m, s, dom, mon, year, dow);
    tab_settings_tick();
}
