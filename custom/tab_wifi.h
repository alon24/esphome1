#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "wifi_setup.h"
#include <cstdio>
#include <cstring>
#include <vector>

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
static lv_obj_t *g_wifi_ap_sw      = nullptr;  // AP Mode switch
static lv_obj_t *g_wifi_ap_ssid_ta = nullptr;  // AP SSID
static lv_obj_t *g_wifi_ap_pass_ta = nullptr;  // AP Password
static lv_obj_t *g_wifi_ap_ip_lbl   = nullptr;  // AP IP Status
static volatile bool g_wifi_scanning  = false;
static volatile bool g_wifi_scan_done = false;
static TaskHandle_t g_wifi_scan_task_handle = nullptr;
static std::vector<ScanResult> g_wifi_scan_results; // shared results for tab_wifi.h

static void _wifi_on_delete(lv_event_t *e) {
    if (g_wifi_keyboard) {
        lv_obj_del(g_wifi_keyboard);
        g_wifi_keyboard = nullptr;
    }
    g_wifi_list = nullptr;
    g_wifi_ssid_ta = nullptr;
    g_wifi_pass_ta = nullptr;
    g_wifi_status_lbl = nullptr;
    g_wifi_scan_btn = nullptr;
    g_wifi_scan_lbl = nullptr;
    g_wifi_active_ta = nullptr;
    g_wifi_ap_sw = nullptr;
    g_wifi_ap_ssid_ta = nullptr;
    g_wifi_ap_pass_ta = nullptr;
    g_wifi_ap_ip_lbl = nullptr;
}

// ── Keyboard show/hide ────────────────────────────────────────────────────────

static void _wifi_kb_show(lv_obj_t *ta) {
    if (!g_wifi_keyboard) return;
    g_wifi_active_ta = ta;
    lv_keyboard_set_textarea(g_wifi_keyboard, ta);
    lv_obj_clear_flag(g_wifi_keyboard, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(g_wifi_keyboard); // Ensure it's on top
}

static void _wifi_kb_hide() {
    if (!g_wifi_keyboard) return;
    g_wifi_active_ta = nullptr;
    lv_keyboard_set_textarea(g_wifi_keyboard, nullptr);
    lv_obj_add_flag(g_wifi_keyboard, LV_OBJ_FLAG_HIDDEN);
}

// ── Network list population (own version using lv_obj_create, not lv_btn) ────
static void _wifi_scan_task(void *pvParameters) {
    ESP_LOGI("WIFI", "Background scan task started...");
    wifi_scan_config_t cfg = {};
    cfg.show_hidden = 0;
    esp_err_t err = esp_wifi_scan_start(&cfg, true);
    if (err == ESP_OK) {
        uint16_t count = 0;
        esp_wifi_scan_get_ap_num(&count);
        if (count > 24) count = 24;
        wifi_ap_record_t *recs = (wifi_ap_record_t *)malloc(count * sizeof(wifi_ap_record_t));
        if (recs) {
            if (esp_wifi_scan_get_ap_records(&count, recs) == ESP_OK) {
                g_wifi_scan_results.clear();
                for (int i = 0; i < (int)count; i++) {
                    if (recs[i].ssid[0] == '\0') continue;
                    ScanResult rs;
                    strncpy(rs.ssid, (char*)recs[i].ssid, 32);
                    rs.ssid[32] = '\0';
                    rs.rssi = recs[i].rssi;
                    g_wifi_scan_results.push_back(rs);
                }
            }
            free(recs);
        }
    } else {
        ESP_LOGE("WIFI", "Background scan failed: %d", err);
    }
    g_wifi_scanning = false;
    g_wifi_scan_done = true;
    g_wifi_scan_task_handle = nullptr;
    vTaskDelete(NULL);
}

static void _wifi_populate_list_ui(lv_obj_t *list, lv_obj_t *ssid_ta) {
    if (!list) return;
    lv_obj_clean(list);
    const lv_coord_t ROW_H = 52;
    const lv_coord_t GAP   = 2;
    lv_coord_t y = 0;

    for (const auto &res : g_wifi_scan_results) {
        lv_obj_t *row = lv_obj_create(list);
        lv_obj_set_pos(row, 0, y);
        lv_obj_set_size(row, 356, ROW_H);
        lv_obj_set_style_bg_color(row, lv_color_hex(TAB_WIFI_ROW_BG), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(row, LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_radius(row, 4, LV_STATE_DEFAULT);
        lv_obj_set_style_pad_all(row, 0, LV_STATE_DEFAULT);
        _panel_reset(row);
        lv_obj_clear_flag(row, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_add_flag(row, LV_OBJ_FLAG_CLICKABLE);

        int bars = _rssi_bars(res.rssi);
        uint32_t col = _rssi_color(res.rssi);
        for (int b = 0; b < 5; b++) {
            lv_coord_t bh = 6 + b * 7;
            lv_obj_t *bar = lv_obj_create(row);
            lv_obj_set_size(bar, 5, bh);
            lv_obj_set_pos(bar, 8 + b * 8, ROW_H - 8 - bh);
            lv_obj_set_style_bg_color(bar, b < bars ? lv_color_hex(col) : lv_color_hex(0x333333), LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(bar, LV_OPA_COVER, LV_STATE_DEFAULT);
            _panel_reset(bar);
            lv_obj_clear_flag(bar, LV_OBJ_FLAG_CLICKABLE);
        }

        lv_obj_t *ssid_lbl = lv_label_create(row);
        lv_label_set_text(ssid_lbl, res.ssid);
        lv_obj_set_style_text_color(ssid_lbl, lv_color_hex(0xdddddd), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(ssid_lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
        lv_obj_set_pos(ssid_lbl, 52, 8);
        lv_obj_set_width(ssid_lbl, 240);
        lv_label_set_long_mode(ssid_lbl, LV_LABEL_LONG_DOT);

        lv_obj_t *dbm_lbl = lv_label_create(row);
        char dbuf[16]; snprintf(dbuf, sizeof(dbuf), "%d dBm", (int)res.rssi);
        lv_label_set_text(dbm_lbl, dbuf);
        lv_obj_set_style_text_color(dbm_lbl, lv_color_hex(0x666666), LV_STATE_DEFAULT);
        lv_obj_set_pos(dbm_lbl, 52, 30);

        lv_obj_set_user_data(row, ssid_ta);
        lv_obj_add_event_cb(row, [](lv_event_t *e) {
            lv_obj_t *r = (lv_obj_t *)lv_event_get_target(e);
            lv_obj_t *ta = (lv_obj_t *)lv_obj_get_user_data(r);
            lv_obj_t *sl = lv_obj_get_child(r, 5);
            if (ta && sl) lv_textarea_set_text(ta, lv_label_get_text(sl));
            if (g_wifi_status_lbl) lv_label_set_text(g_wifi_status_lbl, "SSID Selected");
        }, LV_EVENT_CLICKED, nullptr);

        y += ROW_H + GAP;
    }
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
    lv_obj_add_flag(btn, LV_OBJ_FLAG_CLICKABLE);

    lv_obj_t *lbl = lv_label_create(btn);
    lv_label_set_text(lbl, text);
    lv_obj_set_style_text_color(lbl, lv_color_hex(tc), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    _lbl_bg(lbl, bg);
    lv_obj_set_size(lbl, w, h);
    lv_obj_set_style_text_align(lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_top(lbl, (h - 20) / 2, LV_STATE_DEFAULT);
    lv_obj_set_pos(lbl, 0, 0);
    lv_obj_clear_flag(lbl, LV_OBJ_FLAG_CLICKABLE);

    return btn;
}

// ── Main create ───────────────────────────────────────────────────────────────
// parent = content area (800×352), root = full-screen root (800×480)
void tab_wifi_create(lv_obj_t *parent, lv_obj_t *root) {
    lv_obj_add_event_cb(parent, _wifi_on_delete, LV_EVENT_DELETE, nullptr);

    // ── Left: network list ────────────────────────────────────────────────────
    lv_obj_t *left = _make_panel(parent, 0, 0, 260, 352, TAB_WIFI_LIST_BG);

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
    lv_obj_set_pos(g_wifi_list, 10, 32);
    lv_obj_set_size(g_wifi_list, 240, 308);
    lv_obj_set_style_bg_color(g_wifi_list, lv_color_hex(TAB_WIFI_LIST_BG), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_wifi_list, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(g_wifi_list, 4, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_wifi_list, 0, LV_STATE_DEFAULT);
    _panel_reset(g_wifi_list);
    lv_obj_add_flag(g_wifi_list, LV_OBJ_FLAG_SCROLLABLE);
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
    lv_obj_set_pos(div, 260, 0);
    lv_obj_set_size(div, 1, 520);
    lv_obj_set_style_bg_color(div, lv_color_hex(0x252525), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(div, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(div);

    // ── Right: connect panel (tall — parent handles scroll) ───────────────────
    lv_obj_t *right = _make_panel(parent, 261, 0, 539, 520, TAB_WIFI_BG);

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
    lv_textarea_set_placeholder_text(g_wifi_ssid_ta, "Select...");
    lv_textarea_set_one_line(g_wifi_ssid_ta, true);
    lv_obj_set_pos(g_wifi_ssid_ta, 10, 28);
    lv_obj_set_size(g_wifi_ssid_ta, 330, 44);
    lv_obj_set_style_bg_color(g_wifi_ssid_ta, lv_color_hex(0x222222), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_wifi_ssid_ta, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(g_wifi_ssid_ta, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_wifi_ssid_ta, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(g_wifi_ssid_ta, lv_color_hex(0x00CED1), LV_STATE_FOCUSED);
    lv_obj_set_style_border_width(g_wifi_ssid_ta, 2, LV_STATE_FOCUSED);
    lv_obj_set_style_border_color(g_wifi_ssid_ta, lv_color_hex(0x333333), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(g_wifi_ssid_ta, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_wifi_ssid_ta, 6, LV_STATE_DEFAULT);
    lv_obj_set_scroll_dir(g_wifi_ssid_ta, LV_DIR_HOR);
    lv_obj_clear_flag(g_wifi_ssid_ta, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
    // LV_EVENT_ALL + FOCUSED/DEFOCUSED — correct pattern per manufacturer example.
    // Our cb is registered FIRST; on FOCUSED it calls lv_keyboard_set_textarea which
    // adds lv_keyboard_def_event_cb. On DEFOCUSED, our cb fires first and calls
    // lv_keyboard_set_textarea(NULL), which REMOVES the def_event_cb before it can
    // auto-hide — so we have full control over keyboard visibility.
    lv_obj_add_event_cb(g_wifi_ssid_ta, [](lv_event_t *e) {
        lv_event_code_t code = lv_event_get_code(e);
        if (code == LV_EVENT_FOCUSED || code == LV_EVENT_CLICKED) _wifi_kb_show(g_wifi_ssid_ta);
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
    lv_textarea_set_placeholder_text(g_wifi_pass_ta, "Pass...");
    lv_textarea_set_one_line(g_wifi_pass_ta, true);
    lv_textarea_set_password_mode(g_wifi_pass_ta, true);
    lv_obj_set_pos(g_wifi_pass_ta, 10, 104);
    lv_obj_set_size(g_wifi_pass_ta, 330, 44);
    lv_obj_set_style_bg_color(g_wifi_pass_ta, lv_color_hex(0x222222), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_wifi_pass_ta, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(g_wifi_pass_ta, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_wifi_pass_ta, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(g_wifi_pass_ta, lv_color_hex(0x00CED1), LV_STATE_FOCUSED);
    lv_obj_set_style_border_width(g_wifi_pass_ta, 2, LV_STATE_FOCUSED);
    lv_obj_set_style_border_color(g_wifi_pass_ta, lv_color_hex(0x333333), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(g_wifi_pass_ta, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_wifi_pass_ta, 6, LV_STATE_DEFAULT);
    lv_obj_set_scroll_dir(g_wifi_pass_ta, LV_DIR_HOR);
    lv_obj_clear_flag(g_wifi_pass_ta, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
    lv_obj_add_event_cb(g_wifi_pass_ta, [](lv_event_t *e) {
        lv_event_code_t code = lv_event_get_code(e);
        if (code == LV_EVENT_FOCUSED || code == LV_EVENT_CLICKED) _wifi_kb_show(g_wifi_pass_ta);
        else if (code == LV_EVENT_DEFOCUSED) _wifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // Show/Hide Password Button
    lv_obj_t *eye_btn = lv_button_create(right);
    lv_obj_set_size(eye_btn, 40, 40);
    lv_obj_set_pos(eye_btn, 302, 106);
    lv_obj_set_style_bg_color(eye_btn, lv_color_hex(0x333333), 0);
    lv_obj_set_style_radius(eye_btn, 4, 0);
    lv_obj_t *eye_lbl = lv_label_create(eye_btn);
    lv_label_set_text(eye_lbl, LV_SYMBOL_EYE_OPEN);
    lv_obj_center(eye_lbl);

    lv_obj_add_event_cb(eye_btn, [](lv_event_t * e) {
        if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
            lv_obj_t * btn = (lv_obj_t *)lv_event_get_target(e);
            lv_obj_t * lbl = lv_obj_get_child(btn, 0);
            if (!lbl) return;
            bool is_pass = lv_textarea_get_password_mode(g_wifi_pass_ta);
            if (is_pass) {
                lv_textarea_set_password_mode(g_wifi_pass_ta, false);
                lv_label_set_text(lbl, LV_SYMBOL_EYE_CLOSE);
            } else {
                lv_textarea_set_password_mode(g_wifi_pass_ta, true);
                lv_label_set_text(lbl, LV_SYMBOL_EYE_OPEN);
            }
        }
    }, LV_EVENT_CLICKED, nullptr);

    // ── Buttons row ───────────────────────────────────────────────────────────
    g_wifi_scan_btn = _wifi_btn(right, "SCAN",    10, 165, 170, 44, 0x1a3a1a, 0x00CC44);
    lv_obj_t *conn_btn = _wifi_btn(right, "CONN", 185, 165, 165, 44, 0x003050, 0x47EAED);
    lv_obj_add_flag(conn_btn, LV_OBJ_FLAG_CLICKABLE);

    // Keep a pointer to scan button's label to change text during scan
    g_wifi_scan_lbl = lv_obj_get_child(g_wifi_scan_btn, 0);

    lv_obj_add_event_cb(g_wifi_scan_btn, [](lv_event_t *) {
        if (g_wifi_scanning) return;
        _wifi_kb_hide();
        
        if (g_wifi_scan_lbl) lv_label_set_text(g_wifi_scan_lbl, "SCANNING...");
        if (g_wifi_status_lbl) lv_label_set_text(g_wifi_status_lbl, "Scanning for networks...");
        
        g_wifi_scanning = true;
        g_wifi_scan_done = false;
        xTaskCreate(_wifi_scan_task, "wifi_full_scan", 4096, nullptr, 5, &g_wifi_scan_task_handle);
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
        ui_set_connecting(); 
        wifi_connect_from_ui(g_wifi_ssid_ta, g_wifi_pass_ta);
        lv_label_set_text(g_wifi_status_lbl, "Connect requested - check header for IP");
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

    // ── AP MODE SETTINGS (Below fold) ─────────────────────────────────────────
    lv_obj_t *ap_sep = lv_obj_create(right);
    lv_obj_set_size(ap_sep, 360, 2);
    lv_obj_set_pos(ap_sep, 10, 270);
    lv_obj_set_style_bg_color(ap_sep, lv_color_hex(0x333333), 0);
    _panel_reset(ap_sep);

    lv_obj_t *ap_hdr = lv_label_create(right);
    lv_label_set_text(ap_hdr, "STANDALONE AP MODE");
    lv_obj_set_style_text_color(ap_hdr, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(ap_hdr, &lv_font_montserrat_14, 0);
    lv_obj_set_pos(ap_hdr, 12, 280);

    g_wifi_ap_ip_lbl = lv_label_create(right);
    lv_label_set_text(g_wifi_ap_ip_lbl, "Portal IP: 0.0.0.0");
    lv_obj_set_style_text_color(g_wifi_ap_ip_lbl, lv_color_hex(0x666666), 0);
    lv_obj_set_style_text_font(g_wifi_ap_ip_lbl, &lv_font_montserrat_14, 0);
    lv_obj_set_pos(g_wifi_ap_ip_lbl, 160, 280);

    // Switch
    g_wifi_ap_sw = lv_switch_create(right);
    lv_obj_set_pos(g_wifi_ap_sw, 300, 276);
    lv_obj_set_style_bg_color(g_wifi_ap_sw, lv_color_hex(0x00CED1), (uint32_t)LV_PART_INDICATOR | (uint32_t)LV_STATE_CHECKED);

    // AP SSID
    lv_obj_t *aps_hdr = lv_label_create(right);
    lv_label_set_text(aps_hdr, "AP SSID");
    lv_obj_set_style_text_color(aps_hdr, lv_color_hex(0x888888), 0);
    lv_obj_set_style_text_font(aps_hdr, &lv_font_montserrat_14, 0);
    lv_obj_set_pos(aps_hdr, 12, 310);

    g_wifi_ap_ssid_ta = lv_textarea_create(right);
    lv_textarea_set_text(g_wifi_ap_ssid_ta, "");
    lv_textarea_set_one_line(g_wifi_ap_ssid_ta, true);
    lv_obj_set_pos(g_wifi_ap_ssid_ta, 10, 330);
    lv_obj_set_size(g_wifi_ap_ssid_ta, 330, 44);
    lv_obj_set_style_bg_color(g_wifi_ap_ssid_ta, lv_color_hex(0x222222), 0);
    lv_obj_set_style_text_color(g_wifi_ap_ssid_ta, lv_color_hex(0xffffff), 0);
    lv_obj_set_style_text_font(g_wifi_ap_ssid_ta, &lv_font_montserrat_18, 0);
    lv_obj_set_style_radius(g_wifi_ap_ssid_ta, 6, 0);
    lv_obj_set_scroll_dir(g_wifi_ap_ssid_ta, LV_DIR_HOR);
    lv_obj_clear_flag(g_wifi_ap_ssid_ta, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
    lv_obj_add_event_cb(g_wifi_ap_ssid_ta, [](lv_event_t *e) {
        lv_event_code_t code = lv_event_get_code(e);
        if (code == LV_EVENT_FOCUSED || code == LV_EVENT_CLICKED) _wifi_kb_show(g_wifi_ap_ssid_ta);
        else if (code == LV_EVENT_DEFOCUSED) _wifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // AP Password
    lv_obj_t *app_hdr = lv_label_create(right);
    lv_label_set_text(app_hdr, "AP PASSWORD");
    lv_obj_set_style_text_color(app_hdr, lv_color_hex(0x888888), 0);
    lv_obj_set_style_text_font(app_hdr, &lv_font_montserrat_14, 0);
    lv_obj_set_pos(app_hdr, 12, 385);

    g_wifi_ap_pass_ta = lv_textarea_create(right);
    lv_textarea_set_text(g_wifi_ap_pass_ta, "");
    lv_textarea_set_one_line(g_wifi_ap_pass_ta, true);
    lv_textarea_set_password_mode(g_wifi_ap_pass_ta, true);
    lv_obj_set_pos(g_wifi_ap_pass_ta, 10, 405);
    lv_obj_set_size(g_wifi_ap_pass_ta, 330, 44);
    lv_obj_set_style_bg_color(g_wifi_ap_pass_ta, lv_color_hex(0x222222), 0);
    lv_obj_set_style_text_color(g_wifi_ap_pass_ta, lv_color_hex(0xffffff), 0);
    lv_obj_set_style_text_font(g_wifi_ap_pass_ta, &lv_font_montserrat_18, 0);
    lv_obj_set_style_radius(g_wifi_ap_pass_ta, 6, 0);
    lv_obj_set_scroll_dir(g_wifi_ap_pass_ta, LV_DIR_HOR);
    lv_obj_clear_flag(g_wifi_ap_pass_ta, LV_OBJ_FLAG_SCROLL_ON_FOCUS);
    lv_obj_add_event_cb(g_wifi_ap_pass_ta, [](lv_event_t *e) {
        lv_event_code_t code = lv_event_get_code(e);
        if (code == LV_EVENT_FOCUSED || code == LV_EVENT_CLICKED) _wifi_kb_show(g_wifi_ap_pass_ta);
        else if (code == LV_EVENT_DEFOCUSED) _wifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // Save AP Button
    lv_obj_t *save_ap_btn = _wifi_btn(right, "SAVE & APPLY AP", 10, 465, 330, 44, 0x00CED1, 0xFFFFFF);
    lv_obj_add_event_cb(save_ap_btn, [](lv_event_t *) {
        _wifi_kb_hide();
        bool active = lv_obj_has_state(g_wifi_ap_sw, LV_STATE_CHECKED);
        const char *ssid = lv_textarea_get_text(g_wifi_ap_ssid_ta);
        const char *pass = lv_textarea_get_text(g_wifi_ap_pass_ta);
        
        // Update globals
        g_ap_always_on = active;
        if (ssid) strncpy(g_ap_ssid, ssid, 32);
        if (pass) strncpy(g_ap_password, pass, 64);
        
        wifi_apply_ap_settings(active, g_ap_ssid, g_ap_password);
        system_settings_save();
        
        lv_label_set_text(g_wifi_status_lbl, "AP Settings applied & saved.");
    }, LV_EVENT_CLICKED, nullptr);

    // ── Floating keyboard — child of lv_screen_active() per manufacturer example.
    g_wifi_keyboard = lv_keyboard_create(lv_screen_active());
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
void tab_wifi_on_show() {
    if (g_wifi_status_lbl)
        lv_label_set_text(g_wifi_status_lbl, "Reading saved credentials...");
    
    // Auto-populate from NVS/esp-idf
    wifi_config_t conf;
    if (esp_wifi_get_config(WIFI_IF_STA, &conf) == ESP_OK) {
        if (conf.sta.ssid[0] != '\0') {
            printf("[WIFI] Pre-populating SSID: %s\n", (char*)conf.sta.ssid);
            if (g_wifi_ssid_ta) lv_textarea_set_text(g_wifi_ssid_ta, (char*)conf.sta.ssid);
            if (g_wifi_pass_ta) lv_textarea_set_text(g_wifi_pass_ta, (char*)conf.sta.password);
            if (g_wifi_status_lbl) lv_label_set_text(g_wifi_status_lbl, "Saved credentials loaded - ready.");
        }
    }
    
    // Populate AP fields from globals
    if (g_wifi_ap_ssid_ta) lv_textarea_set_text(g_wifi_ap_ssid_ta, g_ap_ssid);
    if (g_wifi_ap_pass_ta) lv_textarea_set_text(g_wifi_ap_pass_ta, g_ap_password);
    
    wifi_mode_t mode;
    esp_wifi_get_mode(&mode);
    if (g_wifi_ap_sw) {
        if (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA) lv_obj_add_state(g_wifi_ap_sw, LV_STATE_CHECKED);
        else lv_obj_clear_state(g_wifi_ap_sw, LV_STATE_CHECKED);
    }
}

// Called every second from maindashboard
static void tab_wifi_tick() {
    if (g_wifi_scan_done) {
        g_wifi_scan_done = false;
        _wifi_populate_list_ui(g_wifi_list, g_wifi_ssid_ta);
        if (g_wifi_scan_lbl) lv_label_set_text(g_wifi_scan_lbl, "SCAN");
        if (g_wifi_status_lbl) lv_label_set_text(g_wifi_status_lbl, "Scan finished.");
    }

    if (g_wifi_ap_ip_lbl) {
        esp_netif_ip_info_t ap_ip_info;
        esp_netif_t *ap_netif = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
        if (ap_netif) {
            esp_netif_get_ip_info(ap_netif, &ap_ip_info);
            char buf[32];
            snprintf(buf, sizeof(buf), "Portal IP: " IPSTR, IP2STR(&ap_ip_info.ip));
            lv_label_set_text(g_wifi_ap_ip_lbl, buf);
        } else {
            lv_label_set_text(g_wifi_ap_ip_lbl, "Portal IP: OFF");
        }
    }
}

static void tab_wifi_set_status(const char *msg) {
    if (g_wifi_status_lbl)
        lv_label_set_text(g_wifi_status_lbl, msg);
}
