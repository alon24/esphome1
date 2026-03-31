#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "wifi_setup.h"
#include <cstdio>
#include <cstring>

// ── WIFI TAB ──────────────────────────────────────────────────────────────────
// Content area: 800×352 (parent), plus root (800×480) for floating keyboard.
//
// Layout:
//   Left  (380px) — scrollable SSID list
//   Right (420px) — selected SSID + password + buttons + status

#define TAB_WIFI_BG      0x0e0e0e
#define TAB_WIFI_LIST_BG 0x131313
#define TAB_WIFI_CARD_BG 0x1a1a1a
#define TAB_WIFI_ROW_BG  0x1e1e1e
#define TAB_WIFI_SEL_BG  0x0d3030

static lv_obj_t *g_wifi_list       = nullptr;  // scrollable SSID list container
static lv_obj_t *g_wifi_ssid_ta    = nullptr;  // shows selected SSID
static lv_obj_t *g_wifi_pass_ta    = nullptr;  // password input
static lv_obj_t *g_wifi_status_lbl = nullptr;  // connection status
static lv_obj_t *g_wifi_keyboard   = nullptr;  // floating keyboard (lv_layer_top child)
static lv_obj_t *g_wifi_scan_btn   = nullptr;
static lv_obj_t *g_wifi_scan_lbl   = nullptr;  // label inside scan btn
static lv_obj_t *g_wifi_active_ta  = nullptr;  // currently active textarea
static lv_obj_t *g_kb_toggle_lbl   = nullptr;  // label of toggle button (show/hide text)

// ── Keyboard show/hide ────────────────────────────────────────────────────────

static void _wifi_kb_show(lv_obj_t *ta) {
    if (!g_wifi_keyboard) return;
    g_wifi_active_ta = ta;
    lv_keyboard_set_textarea(g_wifi_keyboard, ta);
    lv_obj_clear_flag(g_wifi_keyboard, LV_OBJ_FLAG_HIDDEN);
    if (g_kb_toggle_lbl) lv_label_set_text(g_kb_toggle_lbl, "HIDE KEYBOARD");
}

static void _wifi_kb_hide() {
    if (!g_wifi_keyboard) return;
    g_wifi_active_ta = nullptr;
    lv_keyboard_set_textarea(g_wifi_keyboard, nullptr);
    lv_obj_add_flag(g_wifi_keyboard, LV_OBJ_FLAG_HIDDEN);
    if (g_kb_toggle_lbl) lv_label_set_text(g_kb_toggle_lbl, "SHOW KEYBOARD");
}

// ── Network list population (own version using lv_obj_create, not lv_btn) ────
static void _wifi_populate_list(lv_obj_t *list, lv_obj_t *ssid_ta) {
    wifi_scan_config_t cfg = {};
    cfg.show_hidden = 0;
    esp_wifi_scan_start(&cfg, true);   // blocking ~2-3 s

    uint16_t count = 0;
    esp_wifi_scan_get_ap_num(&count);
    if (count > 24) count = 24;

    wifi_ap_record_t *recs = (wifi_ap_record_t *)malloc(count * sizeof(wifi_ap_record_t));
    if (!recs) return;
    esp_wifi_scan_get_ap_records(&count, recs);

    lv_obj_clean(list);

    const lv_coord_t ROW_H = 52;
    const lv_coord_t GAP   = 2;
    lv_coord_t y = 0;

    for (int i = 0; i < (int)count; i++) {
        if (recs[i].ssid[0] == '\0') continue;

        // Row container
        lv_obj_t *row = lv_obj_create(list);
        lv_obj_set_pos(row, 0, y);
        lv_obj_set_size(row, 356, ROW_H);
        lv_obj_set_style_bg_color(row, lv_color_hex(TAB_WIFI_ROW_BG), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_color(row, lv_color_hex(TAB_WIFI_ROW_BG), LV_STATE_PRESSED);
        lv_obj_set_style_bg_opa(row, LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(row, LV_OPA_COVER, LV_STATE_PRESSED);
        lv_obj_set_style_radius(row, 4, LV_STATE_DEFAULT);
        lv_obj_set_style_pad_all(row, 0, LV_STATE_DEFAULT);
        _panel_reset(row);
        lv_obj_clear_flag(row, LV_OBJ_FLAG_SCROLLABLE);

        // Signal bars (5 vertical bars)
        int bars = _rssi_bars(recs[i].rssi);
        uint32_t col = _rssi_color(recs[i].rssi);

        for (int b = 0; b < 5; b++) {
            lv_coord_t bh = 6 + b * 7;
            lv_obj_t *bar = lv_obj_create(row);
            lv_obj_set_size(bar, 5, bh);
            lv_obj_set_pos(bar, 8 + b * 8, ROW_H - 8 - bh);
            lv_obj_set_style_bg_color(bar,
                b < bars ? lv_color_hex(col) : lv_color_hex(0x333333),
                LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(bar, LV_OPA_COVER, LV_STATE_DEFAULT);
            lv_obj_set_style_radius(bar, 1, LV_STATE_DEFAULT);
            lv_obj_clear_flag(bar, LV_OBJ_FLAG_CLICKABLE);
            _panel_reset(bar);
        }

        // SSID label
        lv_obj_t *ssid_lbl = lv_label_create(row);
        char sbuf[64];
        snprintf(sbuf, sizeof(sbuf), "%s", (char *)recs[i].ssid);
        lv_label_set_text(ssid_lbl, sbuf);
        lv_obj_set_style_text_color(ssid_lbl, lv_color_hex(0xdddddd), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(ssid_lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
        _lbl_bg(ssid_lbl, TAB_WIFI_ROW_BG);
        lv_obj_set_pos(ssid_lbl, 52, 8);
        lv_obj_set_width(ssid_lbl, 240);
        lv_label_set_long_mode(ssid_lbl, LV_LABEL_LONG_DOT);
        lv_obj_clear_flag(ssid_lbl, LV_OBJ_FLAG_CLICKABLE);

        // dBm label
        lv_obj_t *dbm_lbl = lv_label_create(row);
        char dbuf[12];
        snprintf(dbuf, sizeof(dbuf), "%d", (int)recs[i].rssi);
        lv_label_set_text(dbm_lbl, dbuf);
        lv_obj_set_style_text_color(dbm_lbl, lv_color_hex(0x666666), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(dbm_lbl, &lv_font_montserrat_14, LV_STATE_DEFAULT);
        _lbl_bg(dbm_lbl, TAB_WIFI_ROW_BG);
        lv_obj_set_pos(dbm_lbl, 52, 30);
        lv_obj_clear_flag(dbm_lbl, LV_OBJ_FLAG_CLICKABLE);

        // Click: copy SSID to ssid_ta
        lv_obj_set_user_data(row, ssid_ta);
        lv_obj_add_event_cb(row, [](lv_event_t *e) {
            lv_obj_t *r  = lv_event_get_target(e);
            lv_obj_t *ta = (lv_obj_t *)lv_obj_get_user_data(r);
            if (!ta) return;
            // ssid_lbl is at child index 5 (5 bars + ssid_lbl)
            lv_obj_t *sl = lv_obj_get_child(r, 5);
            if (!sl) return;
            lv_textarea_set_text(ta, lv_label_get_text(sl));
            // update status
            if (g_wifi_status_lbl)
                lv_label_set_text(g_wifi_status_lbl, "SSID selected — enter password");
        }, LV_EVENT_CLICKED, nullptr);

        y += ROW_H + GAP;
    }

    free(recs);
}

// ── Button helper ─────────────────────────────────────────────────────────────
static lv_obj_t *_wifi_btn(lv_obj_t *parent, const char *text,
                            int x, int y, int w, int h,
                            uint32_t bg, uint32_t tc) {
    lv_obj_t *btn = lv_obj_create(parent);
    lv_obj_set_pos(btn, x, y);
    lv_obj_set_size(btn, w, h);
    lv_obj_set_style_bg_color(btn, lv_color_hex(bg), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(btn, lv_color_hex(bg), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, LV_STATE_PRESSED);
    lv_obj_set_style_radius(btn, 6, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(btn, 0, LV_STATE_DEFAULT);
    _panel_reset(btn);
    lv_obj_clear_flag(btn, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *lbl = lv_label_create(btn);
    lv_label_set_text(lbl, text);
    lv_obj_set_style_text_color(lbl, lv_color_hex(tc), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    _lbl_bg(lbl, bg);
    lv_obj_set_size(lbl, w, h);
    lv_obj_set_style_text_align(lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_top(lbl, (h - 20) / 2, LV_STATE_DEFAULT);
    lv_obj_set_pos(lbl, 0, 0);

    return btn;
}

// ── Main create ───────────────────────────────────────────────────────────────
// parent = content area (800×352), root = full-screen root (800×480)
static void tab_wifi_create(lv_obj_t *parent, lv_obj_t *root) {

    // ── Left: network list ────────────────────────────────────────────────────
    lv_obj_t *left = _make_panel(parent, 0, 0, 380, 352, TAB_WIFI_LIST_BG);

    // List header
    lv_obj_t *list_hdr = lv_label_create(left);
    lv_label_set_text(list_hdr, "NETWORKS");
    lv_obj_set_style_text_color(list_hdr, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(list_hdr, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    lv_obj_set_style_text_letter_space(list_hdr, 2, LV_STATE_DEFAULT);
    _lbl_bg(list_hdr, TAB_WIFI_LIST_BG);
    lv_obj_set_pos(list_hdr, 12, 10);

    // Scrollable list area
    g_wifi_list = lv_obj_create(left);
    lv_obj_set_pos(g_wifi_list, 12, 32);
    lv_obj_set_size(g_wifi_list, 356, 308);
    lv_obj_set_style_bg_color(g_wifi_list, lv_color_hex(TAB_WIFI_LIST_BG), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_wifi_list, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(g_wifi_list, 4, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_wifi_list, 0, LV_STATE_DEFAULT);
    _panel_reset(g_wifi_list);
    // Scrollable: keep default

    // Empty state label
    lv_obj_t *empty_lbl = lv_label_create(g_wifi_list);
    lv_label_set_text(empty_lbl, "Press SCAN to search");
    lv_obj_set_style_text_color(empty_lbl, lv_color_hex(0x444444), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(empty_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(empty_lbl, TAB_WIFI_LIST_BG);
    lv_obj_set_pos(empty_lbl, 40, 120);

    // Divider
    // Make the whole WiFi tab panel scrollable vertically so all content
    // (including the keyboard toggle and scroll-test rows) is reachable.
    lv_obj_add_flag(parent, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(parent, LV_DIR_VER);

    lv_obj_t *div = lv_obj_create(parent);
    lv_obj_set_pos(div, 380, 0);
    lv_obj_set_size(div, 1, 520);
    lv_obj_set_style_bg_color(div, lv_color_hex(0x252525), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(div, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(div);

    // ── Right: connect panel (tall — parent handles scroll) ───────────────────
    lv_obj_t *right = _make_panel(parent, 381, 0, 419, 520, TAB_WIFI_BG);

    // SSID section
    lv_obj_t *ssid_hdr = lv_label_create(right);
    lv_label_set_text(ssid_hdr, "SSID");
    lv_obj_set_style_text_color(ssid_hdr, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(ssid_hdr, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    _lbl_bg(ssid_hdr, TAB_WIFI_BG);
    lv_obj_set_pos(ssid_hdr, 12, 8);

    // SSID textarea (read-only display + tap to edit)
    g_wifi_ssid_ta = lv_textarea_create(right);
    lv_textarea_set_text(g_wifi_ssid_ta, "");
    lv_textarea_set_placeholder_text(g_wifi_ssid_ta, "Select from list or type...");
    lv_textarea_set_one_line(g_wifi_ssid_ta, true);
    lv_obj_set_pos(g_wifi_ssid_ta, 12, 28);
    lv_obj_set_size(g_wifi_ssid_ta, 395, 44);
    lv_obj_set_style_bg_color(g_wifi_ssid_ta, lv_color_hex(0x222222), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_wifi_ssid_ta, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(g_wifi_ssid_ta, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_wifi_ssid_ta, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(g_wifi_ssid_ta, lv_color_hex(0x00CED1), LV_STATE_FOCUSED);
    lv_obj_set_style_border_width(g_wifi_ssid_ta, 2, LV_STATE_FOCUSED);
    lv_obj_set_style_border_color(g_wifi_ssid_ta, lv_color_hex(0x333333), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(g_wifi_ssid_ta, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_wifi_ssid_ta, 6, LV_STATE_DEFAULT);
    // LV_EVENT_ALL + FOCUSED/DEFOCUSED — correct pattern per manufacturer example.
    // Our cb is registered FIRST; on FOCUSED it calls lv_keyboard_set_textarea which
    // adds lv_keyboard_def_event_cb. On DEFOCUSED, our cb fires first and calls
    // lv_keyboard_set_textarea(NULL), which REMOVES the def_event_cb before it can
    // auto-hide — so we have full control over keyboard visibility.
    lv_obj_add_event_cb(g_wifi_ssid_ta, [](lv_event_t *e) {
        lv_event_code_t code = lv_event_get_code(e);
        if (code == LV_EVENT_FOCUSED)   _wifi_kb_show(g_wifi_ssid_ta);
        else if (code == LV_EVENT_DEFOCUSED) _wifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // Password section
    lv_obj_t *pass_hdr = lv_label_create(right);
    lv_label_set_text(pass_hdr, "PASSWORD");
    lv_obj_set_style_text_color(pass_hdr, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(pass_hdr, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    _lbl_bg(pass_hdr, TAB_WIFI_BG);
    lv_obj_set_pos(pass_hdr, 12, 84);

    g_wifi_pass_ta = lv_textarea_create(right);
    lv_textarea_set_text(g_wifi_pass_ta, "");
    lv_textarea_set_placeholder_text(g_wifi_pass_ta, "Password...");
    lv_textarea_set_one_line(g_wifi_pass_ta, true);
    lv_textarea_set_password_mode(g_wifi_pass_ta, true);
    lv_obj_set_pos(g_wifi_pass_ta, 12, 104);
    lv_obj_set_size(g_wifi_pass_ta, 395, 44);
    lv_obj_set_style_bg_color(g_wifi_pass_ta, lv_color_hex(0x222222), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_wifi_pass_ta, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(g_wifi_pass_ta, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_wifi_pass_ta, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(g_wifi_pass_ta, lv_color_hex(0x00CED1), LV_STATE_FOCUSED);
    lv_obj_set_style_border_width(g_wifi_pass_ta, 2, LV_STATE_FOCUSED);
    lv_obj_set_style_border_color(g_wifi_pass_ta, lv_color_hex(0x333333), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(g_wifi_pass_ta, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_wifi_pass_ta, 6, LV_STATE_DEFAULT);
    lv_obj_add_event_cb(g_wifi_pass_ta, [](lv_event_t *e) {
        lv_event_code_t code = lv_event_get_code(e);
        if (code == LV_EVENT_FOCUSED)   _wifi_kb_show(g_wifi_pass_ta);
        else if (code == LV_EVENT_DEFOCUSED) _wifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // ── Buttons row ───────────────────────────────────────────────────────────
    g_wifi_scan_btn = _wifi_btn(right, "SCAN",    12, 165, 190, 44, 0x1a3a1a, 0x00CC44);
    lv_obj_t *conn_btn = _wifi_btn(right, "CONNECT", 213, 165, 194, 44, 0x003050, 0x47EAED);

    // Keep a pointer to scan button's label to change text during scan
    g_wifi_scan_lbl = lv_obj_get_child(g_wifi_scan_btn, 0);

    lv_obj_add_event_cb(g_wifi_scan_btn, [](lv_event_t *) {
        _wifi_kb_hide();
        lv_label_set_text(g_wifi_scan_lbl, "SCANNING...");
        lv_refr_now(NULL);  // show "SCANNING..." before blocking
        lv_label_set_text(g_wifi_status_lbl, "Scanning for networks...");
        lv_refr_now(NULL);
        _wifi_populate_list(g_wifi_list, g_wifi_ssid_ta);
        lv_label_set_text(g_wifi_scan_lbl, "SCAN");
        lv_label_set_text(g_wifi_status_lbl, "Tap a network to select");
    }, LV_EVENT_CLICKED, nullptr);

    lv_obj_add_event_cb(conn_btn, [](lv_event_t *) {
        _wifi_kb_hide();
        const char *ssid = lv_textarea_get_text(g_wifi_ssid_ta);
        if (!ssid || ssid[0] == '\0') {
            lv_label_set_text(g_wifi_status_lbl, "Enter an SSID first");
            return;
        }
        lv_label_set_text(g_wifi_status_lbl, "Connecting...");
        lv_refr_now(NULL);
        wifi_connect_from_ui(g_wifi_ssid_ta, g_wifi_pass_ta);
        lv_label_set_text(g_wifi_status_lbl, "Connect requested — check header for IP");
    }, LV_EVENT_CLICKED, nullptr);

    // ── Status label ──────────────────────────────────────────────────────────
    g_wifi_status_lbl = lv_label_create(right);
    lv_label_set_text(g_wifi_status_lbl, "Scan for networks to begin");
    lv_obj_set_style_text_color(g_wifi_status_lbl, lv_color_hex(0x666666), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_wifi_status_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(g_wifi_status_lbl, TAB_WIFI_BG);
    lv_obj_set_pos(g_wifi_status_lbl, 12, 222);
    lv_obj_set_width(g_wifi_status_lbl, 395);
    lv_label_set_long_mode(g_wifi_status_lbl, LV_LABEL_LONG_WRAP);

    // ── Keyboard toggle button — shows "SHOW KEYBOARD" / "HIDE KEYBOARD" ───────
    lv_obj_t *kb_btn = _wifi_btn(right, "SHOW KEYBOARD", 12, 265, 395, 44, 0x2a1a3a, 0xAA77FF);
    g_kb_toggle_lbl = lv_obj_get_child(kb_btn, 0);  // label is first child of btn
    lv_obj_add_event_cb(kb_btn, [](lv_event_t *) {
        if (!g_wifi_keyboard) return;
        if (lv_obj_has_flag(g_wifi_keyboard, LV_OBJ_FLAG_HIDDEN)) {
            _wifi_kb_show(g_wifi_pass_ta);
        } else {
            _wifi_kb_hide();
        }
    }, LV_EVENT_CLICKED, nullptr);

    // ── Scroll-test rows (below the 352px visible fold — swipe up to reveal) ───
    {
        const char *txts[] = { "▼  SCROLL TEST  ▼", "row 1", "row 2", "row 3", "end of page" };
        uint32_t cols[]    = { 0x00CED1, 0x555555, 0x555555, 0x555555, 0x00CC44 };
        for (int i = 0; i < 5; i++) {
            lv_obj_t *tl = lv_label_create(right);
            lv_label_set_text(tl, txts[i]);
            lv_obj_set_style_text_color(tl, lv_color_hex(cols[i]), LV_STATE_DEFAULT);
            lv_obj_set_style_text_font(tl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
            _lbl_bg(tl, TAB_WIFI_BG);
            lv_obj_set_pos(tl, 12, 360 + i * 34);
        }
    }

    // ── Floating keyboard — child of lv_scr_act() per manufacturer example.
    g_wifi_keyboard = lv_keyboard_create(lv_scr_act());
    // lv_obj_set_pos(g_wifi_keyboard, 0, 280);
    lv_obj_set_size(g_wifi_keyboard, 800, 200);
    lv_obj_set_style_bg_color(g_wifi_keyboard, lv_color_hex(0x111111), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_wifi_keyboard, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_wifi_keyboard, &lv_font_montserrat_20, LV_STATE_DEFAULT);
    lv_obj_add_flag(g_wifi_keyboard, LV_OBJ_FLAG_HIDDEN);

    // Hide keyboard on Enter (READY) or Back (CANCEL)
    lv_obj_add_event_cb(g_wifi_keyboard, [](lv_event_t *) {
        _wifi_kb_hide();
    }, LV_EVENT_READY, nullptr);
    lv_obj_add_event_cb(g_wifi_keyboard, [](lv_event_t *) {
        _wifi_kb_hide();
    }, LV_EVENT_CANCEL, nullptr);
}

// Called from maindashboard when wifi tab is shown.
// Show keyboard immediately — bypasses FOCUSED/CLICKED timing issues entirely.
static void tab_wifi_on_show() {
    if (g_wifi_pass_ta) _wifi_kb_show(g_wifi_pass_ta);
    if (g_wifi_status_lbl)
        lv_label_set_text(g_wifi_status_lbl, "Scan for networks to begin");
}

// Called by maindashboard when connection state changes
static void tab_wifi_set_status(const char *msg) {
    if (g_wifi_status_lbl)
        lv_label_set_text(g_wifi_status_lbl, msg);
}
