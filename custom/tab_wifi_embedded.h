#pragma once
// ── WIFI SMART COMPONENT (EMBEDDED / BOUNDS-RELATIVE) ────────────────────────
// Replaces tab_wifi_create() for use when placed as a component on ANY screen.
// All coordinates are relative to `parent` bounds — no hardcoded screen sizes.

#include "lvgl.h"
#include "ui_helpers.h"
#include "wifi_setup.h"
#include <cstdio>
#include <cstring>
#include <vector>

// ── Persistent pointers for this embedded instance ────────────────────────────

// ── Shared scan results ───────────────────────────────────────────────────────
struct ScanResult {
    char ssid[33];
    int8_t rssi;
};
static std::vector<ScanResult> g_cwifi_results;
static lv_timer_t *g_cwifi_poll_timer = nullptr;
static lv_obj_t *g_cwifi_list       = nullptr;
static lv_obj_t *g_cwifi_ssid_ta    = nullptr;
static lv_obj_t *g_cwifi_pass_ta    = nullptr;
static lv_obj_t *g_cwifi_status_lbl = nullptr;
static lv_obj_t *g_cwifi_scan_lbl   = nullptr;
static lv_obj_t *g_cwifi_keyboard   = nullptr;
static lv_obj_t *g_cwifi_active_ta  = nullptr;
static lv_obj_t *g_cwifi_spinner    = nullptr;
static lv_obj_t *g_cwifi_net_hdr    = nullptr;

// E1: Non-blocking scan state flags
static volatile bool g_cwifi_scanning  = false;
static volatile bool g_cwifi_scan_done = false;

// Forward decl
static void _cwifi_populate_list();

// ── Keyboard helpers ──────────────────────────────────────────────────────────
static void _cwifi_kb_show(lv_obj_t *ta) {
    if (!g_cwifi_keyboard) return;
    g_cwifi_active_ta = ta;
    lv_keyboard_set_textarea(g_cwifi_keyboard, ta);
    lv_obj_clear_flag(g_cwifi_keyboard, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(g_cwifi_keyboard);
}

static void _cwifi_kb_hide() {
    if (!g_cwifi_keyboard) return;
    g_cwifi_active_ta = nullptr;
    lv_keyboard_set_textarea(g_cwifi_keyboard, nullptr);
    lv_obj_add_flag(g_cwifi_keyboard, LV_OBJ_FLAG_HIDDEN);
}

// ── Synchronous scan ─────────────────────────────────────────────────────────
static void _cwifi_do_scan() {
    if (g_cwifi_scan_lbl) lv_label_set_text(g_cwifi_scan_lbl, "SCAN...");
    if (g_cwifi_status_lbl) lv_label_set_text(g_cwifi_status_lbl, "Scanning SSIDs... (Wait)");
    
    // Create custom spinner in the "NETWORKS" header line
    if (g_cwifi_net_hdr && !g_cwifi_spinner) {
        g_cwifi_spinner = lv_arc_create(lv_obj_get_parent(g_cwifi_net_hdr));
        lv_obj_set_size(g_cwifi_spinner, 16, 16);
        lv_arc_set_angles(g_cwifi_spinner, 0, 90);
        lv_arc_set_bg_angles(g_cwifi_spinner, 0, 360);
        // Push to the far right of the header line
        lv_obj_align(g_cwifi_spinner, LV_ALIGN_TOP_RIGHT, -8, 8);
        lv_obj_set_style_arc_width(g_cwifi_spinner, 2, LV_PART_MAIN);
        lv_obj_set_style_arc_width(g_cwifi_spinner, 2, LV_PART_INDICATOR);
        lv_obj_set_style_arc_color(g_cwifi_spinner, lv_color_hex(0x00CED1), LV_PART_INDICATOR);
        
        // Add a simple rotation animation
        lv_anim_t a;
        lv_anim_init(&a);
        lv_anim_set_var(&a, g_cwifi_spinner);
        lv_anim_set_exec_cb(&a, (lv_anim_exec_xcb_t)lv_arc_set_rotation);
        lv_anim_set_values(&a, 0, 360);
        lv_anim_set_time(&a, 1000);
        lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
        lv_anim_start(&a);
    }
    
    lv_refr_now(NULL); // Force UI update before blocking

    wifi_scan_config_t cfg = {};
    cfg.show_hidden = 1;
    
    ESP_LOGI("WIFI", "Starting manual synchronous scan...");
    esp_err_t err = esp_wifi_scan_start(&cfg, true); // blocking ~2-3 s
    
    if (err == ESP_OK) {
        uint16_t count = 0;
        esp_wifi_scan_get_ap_num(&count);
        ESP_LOGI("WIFI", "Scan finished, found %d networks", count);
        
        if (count > 24) count = 24;
        if (count > 0) {
            wifi_ap_record_t *recs = (wifi_ap_record_t*)malloc(count * sizeof(wifi_ap_record_t));
            if (recs) {
                if (esp_wifi_scan_get_ap_records(&count, recs) == ESP_OK) {
                    g_cwifi_results.clear();
                    for (int i = 0; i < (int)count; i++) {
                        if (recs[i].ssid[0] == '\0') continue;
                        ScanResult rs;
                        strncpy(rs.ssid, (char*)recs[i].ssid, 32);
                        rs.ssid[32] = '\0';
                        rs.rssi = recs[i].rssi;
                        g_cwifi_results.push_back(rs);
                    }
                }
                free(recs);
            }
        }
    } else {
        ESP_LOGE("WIFI", "Scan failed: %d", err);
    }

    _cwifi_populate_list();
    
    if (g_cwifi_spinner) {
        lv_obj_del(g_cwifi_spinner);
        g_cwifi_spinner = nullptr;
    }
    
    if (g_cwifi_scan_lbl) lv_label_set_text(g_cwifi_scan_lbl, "SCAN");
    if (g_cwifi_status_lbl) lv_label_set_text(g_cwifi_status_lbl, "Tap a network to select");
}

static void _cwifi_start_scan_bg() {
    _cwifi_do_scan();
}

// ── E5: Populate list (called after scan completes, safe LVGL context) ────────
static void _cwifi_populate_list() {
    if (!g_cwifi_list || !g_cwifi_ssid_ta) return;
    
    lv_obj_clean(g_cwifi_list);
    
    if (g_cwifi_results.empty()) {
        ESP_LOGW("WIFI", "No networks found in shared list.");
        lv_obj_t *el = lv_label_create(g_cwifi_list);
        lv_label_set_text(el, "No networks found");
        lv_obj_set_style_text_color(el, lv_color_hex(0x666666), LV_STATE_DEFAULT);
        if (g_cwifi_status_lbl) lv_label_set_text(g_cwifi_status_lbl, "Scan found 0 networks.");
        return;
    }

    const int ROW_H = 48;
    int y = 0;
    for (const auto &res : g_cwifi_results) {
        lv_obj_t *row = lv_obj_create(g_cwifi_list);
        lv_obj_set_pos(row, 0, y);
        lv_obj_set_size(row, lv_obj_get_width(g_cwifi_list) - 4, ROW_H);
        lv_obj_set_style_bg_color(row, lv_color_hex(0x2a2a2a), LV_STATE_DEFAULT); // Lighter row for contrast
        lv_obj_set_style_bg_opa(row, LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_radius(row, 6, LV_STATE_DEFAULT);
        _panel_reset(row);
        lv_obj_clear_flag(row, LV_OBJ_FLAG_SCROLLABLE);

        // ── Signal strength bar panel ───────────────────────────────────────
        int bars = _rssi_bars(res.rssi);
        uint32_t col = _rssi_color(res.rssi);
        // Ensure color is very bright for short-sighted accessibility
        if (col == 0x00cc44) col = 0x00FF00; 
        if (col == 0xff2222) col = 0xFF0000;

        lv_obj_t *bar_panel = lv_obj_create(row);
        lv_obj_set_size(bar_panel, 30, 24);
        lv_obj_set_pos(bar_panel, 4, 12);
        lv_obj_set_style_bg_color(bar_panel, lv_color_hex(0x000000), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(bar_panel, LV_OPA_COVER, LV_STATE_DEFAULT);
        _panel_reset(bar_panel);
        lv_obj_clear_flag(bar_panel, LV_OBJ_FLAG_CLICKABLE);

        for (int b = 0; b < 5; b++) {
            lv_coord_t bh = 4 + b * 4;
            lv_obj_t *bar = lv_obj_create(bar_panel);
            lv_obj_set_size(bar, 3, bh);
            lv_obj_set_pos(bar, 1 + b * 5, 24 - bh - 2);
            lv_obj_set_style_radius(bar, 1, LV_STATE_DEFAULT);
            lv_obj_set_style_bg_color(bar, b < bars ? lv_color_hex(col) : lv_color_hex(0x444444), LV_STATE_DEFAULT);
            lv_obj_set_style_bg_opa(bar, LV_OPA_COVER, LV_STATE_DEFAULT);
            _panel_reset(bar);
            lv_obj_clear_flag(bar, LV_OBJ_FLAG_CLICKABLE);
        }

        // SSID label (shifted right for bars) - PURE WHITE for high contrast
        lv_obj_t *sl = lv_label_create(row);
        lv_label_set_text(sl, (char*)res.ssid);
        lv_obj_set_style_text_color(sl, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(sl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
        _lbl_bg(sl, 0x2a2a2a);
        lv_obj_set_pos(sl, 38, 8);
        lv_label_set_long_mode(sl, LV_LABEL_LONG_DOT);
        lv_obj_set_width(sl, lv_obj_get_width(g_cwifi_list) - 48);

        // dBm label (shifted right for bars) - VIVID CYAN
        lv_obj_t *dl = lv_label_create(row);
        char dbuf[16]; snprintf(dbuf, sizeof(dbuf), "%d dBm", (int)res.rssi);
        lv_label_set_text(dl, dbuf);
        lv_obj_set_style_text_color(dl, lv_color_hex(0x00FFFF), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(dl, &lv_font_montserrat_12, LV_STATE_DEFAULT);
        _lbl_bg(dl, 0x2a2a2a);
        lv_obj_set_pos(dl, 38, 28);

        // Click → copy SSID
        lv_obj_add_flag(row, LV_OBJ_FLAG_CLICKABLE);
        lv_obj_set_user_data(row, g_cwifi_ssid_ta);
        lv_obj_add_event_cb(row, [](lv_event_t *e) {
            lv_obj_t *r  = lv_event_get_target(e);
            lv_obj_t *ta = (lv_obj_t*)lv_obj_get_user_data(r);
            // SSID label is specifically child index 1 because bar_panel is 0
            lv_obj_t *sl = lv_obj_get_child(r, 1); 
            if (ta && sl) {
                lv_textarea_set_text(ta, lv_label_get_text(sl));
                if (g_cwifi_pass_ta) lv_textarea_set_text(g_cwifi_pass_ta, "");
            }
            if (g_cwifi_status_lbl) {
                lv_label_set_text(g_cwifi_status_lbl, "SSID READY - Enter Password");
                lv_obj_set_style_text_color(g_cwifi_status_lbl, lv_color_hex(0xFFFF00), LV_STATE_DEFAULT); // Bright Yellow
            }
        }, LV_EVENT_CLICKED, nullptr);

        y += ROW_H + 4;
    }
    ESP_LOGI("WIFI", "List populated with %d items", (int)g_cwifi_results.size());
    // Update content height for scrolling and enable it
    lv_obj_add_flag(g_cwifi_list, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scrollbar_mode(g_cwifi_list, LV_SCROLLBAR_MODE_AUTO);
}

// E5: Tick — called every second from tab_home_tick() ─────────────────────────
void tab_wifi_component_tick() {
    if (g_cwifi_scan_done) {
        g_cwifi_scan_done = false;
        _cwifi_populate_list();
        if (g_cwifi_scan_lbl) lv_label_set_text(g_cwifi_scan_lbl, "SCAN");
        if (g_cwifi_status_lbl) lv_label_set_text(g_cwifi_status_lbl, "Tap a network to select");
    }
}

// ── Cleanup on parent delete ──────────────────────────────────────────────────
static void _cwifi_on_delete(lv_event_t*) {
    if (g_cwifi_keyboard && lv_obj_is_valid(g_cwifi_keyboard)) {
        lv_obj_del(g_cwifi_keyboard);
        g_cwifi_keyboard = nullptr;
    }
    g_cwifi_list = g_cwifi_ssid_ta = g_cwifi_pass_ta = nullptr;
    g_cwifi_status_lbl = g_cwifi_scan_lbl = g_cwifi_active_ta = g_cwifi_net_hdr = nullptr;
}

// ── D1-D9: Main embedded create ───────────────────────────────────────────────
void tab_wifi_create_embedded(lv_obj_t *parent) {
    lv_obj_add_event_cb(parent, _cwifi_on_delete, LV_EVENT_DELETE, nullptr);
    lv_obj_clear_flag(parent, LV_OBJ_FLAG_SCROLLABLE);

    int pw = lv_obj_get_width(parent);   // D2
    int ph = lv_obj_get_height(parent);
    
    // Fallback if width not yet updated in LVGL state
    if (pw <= 0) pw = 640;
    if (ph <= 0) ph = 350;
    ESP_LOGI("WIFI", "Embedded create: %dx%d", pw, ph);

    int lw = (pw * 40) / 100;              // D3: left 40%
    int rw = pw - lw - 1;               // D3: right 60%

    // ── Left panel: NETWORKS list ─────────────────────────────────────────────  D4
    lv_obj_t *left = _make_panel(parent, 0, 0, lw, ph, 0x131313);
    lv_obj_clear_flag(left, LV_OBJ_FLAG_SCROLLABLE);

    g_cwifi_net_hdr = lv_label_create(left);
    lv_label_set_text(g_cwifi_net_hdr, "NETWORKS");
    lv_obj_set_style_text_color(g_cwifi_net_hdr, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_cwifi_net_hdr, &lv_font_montserrat_12, LV_STATE_DEFAULT);
    _lbl_bg(g_cwifi_net_hdr, 0x131313);
    lv_obj_set_pos(g_cwifi_net_hdr, 8, 8);

    // Scrollable list
    g_cwifi_list = lv_obj_create(left);
    lv_obj_set_pos(g_cwifi_list, 4, 28);
    lv_obj_set_size(g_cwifi_list, lw - 8, ph - 32);
    lv_obj_set_style_bg_color(g_cwifi_list, lv_color_hex(0x131313), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_cwifi_list, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(g_cwifi_list);
    lv_obj_set_style_pad_all(g_cwifi_list, 2, LV_STATE_DEFAULT);

    lv_obj_t *empty = lv_label_create(g_cwifi_list);
    lv_label_set_text(empty, "Press SCAN " LV_SYMBOL_RIGHT);
    lv_obj_set_style_text_color(empty, lv_color_hex(0x444444), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(empty, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    _lbl_bg(empty, 0x131313);
    lv_obj_set_pos(empty, 8, ph / 3);

    // ── Divider ───────────────────────────────────────────────────────────────
    lv_obj_t *div = lv_obj_create(parent);
    lv_obj_set_pos(div, lw, 0); lv_obj_set_size(div, 1, ph);
    lv_obj_set_style_bg_color(div, lv_color_hex(0x252525), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(div, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(div);

    // ── Right panel: Connection form ──────────────────────────────────────────  D5
    lv_obj_t *right = _make_panel(parent, lw + 1, 0, rw, ph, 0x050505); // Deeper black for better item contrast
    lv_obj_clear_flag(right, LV_OBJ_FLAG_SCROLLABLE);

    // SSID
    lv_obj_t *ssid_hdr = lv_label_create(right);
    lv_label_set_text(ssid_hdr, "SSID");
    lv_obj_set_style_text_color(ssid_hdr, lv_color_hex(0xFF8800), LV_STATE_DEFAULT); // Vivid Orange
    lv_obj_set_style_text_font(ssid_hdr, &lv_font_montserrat_12, LV_STATE_DEFAULT);
    _lbl_bg(ssid_hdr, 0x050505);
    lv_obj_set_pos(ssid_hdr, 10, 8);

    g_cwifi_ssid_ta = lv_textarea_create(right);
    lv_textarea_set_one_line(g_cwifi_ssid_ta, true);
    lv_textarea_set_placeholder_text(g_cwifi_ssid_ta, "Select network...");
    lv_obj_set_pos(g_cwifi_ssid_ta, 8, 26);
    lv_obj_set_size(g_cwifi_ssid_ta, rw - 16, 38);
    lv_obj_set_style_bg_color(g_cwifi_ssid_ta, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(g_cwifi_ssid_ta, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_cwifi_ssid_ta, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(g_cwifi_ssid_ta, lv_color_hex(0x00FFFF), LV_STATE_FOCUSED); // Electric Cyan
    lv_obj_set_style_border_width(g_cwifi_ssid_ta, 3, LV_STATE_FOCUSED); // Thicker border
    lv_obj_set_style_border_color(g_cwifi_ssid_ta, lv_color_hex(0x333333), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(g_cwifi_ssid_ta, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_cwifi_ssid_ta, 6, LV_STATE_DEFAULT);
    lv_obj_add_event_cb(g_cwifi_ssid_ta, [](lv_event_t *e) {
        lv_event_code_t c = lv_event_get_code(e);
        if (c == LV_EVENT_FOCUSED || c == LV_EVENT_CLICKED) _cwifi_kb_show(g_cwifi_ssid_ta);
        else if (c == LV_EVENT_DEFOCUSED) _cwifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // PASSWORD
    lv_obj_t *pass_hdr = lv_label_create(right);
    lv_label_set_text(pass_hdr, "PASSWORD");
    lv_obj_set_style_text_color(pass_hdr, lv_color_hex(0xFF8800), LV_STATE_DEFAULT); // Vivid Orange
    lv_obj_set_style_text_font(pass_hdr, &lv_font_montserrat_12, LV_STATE_DEFAULT);
    _lbl_bg(pass_hdr, 0x050505);
    lv_obj_set_pos(pass_hdr, 10, 74);

    g_cwifi_pass_ta = lv_textarea_create(right);
    lv_textarea_set_one_line(g_cwifi_pass_ta, true);
    lv_textarea_set_password_mode(g_cwifi_pass_ta, true);
    lv_textarea_set_placeholder_text(g_cwifi_pass_ta, "Password...");
    lv_obj_set_pos(g_cwifi_pass_ta, 8, 92);
    lv_obj_set_size(g_cwifi_pass_ta, rw - 16, 38);
    lv_obj_set_style_bg_color(g_cwifi_pass_ta, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(g_cwifi_pass_ta, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_cwifi_pass_ta, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(g_cwifi_pass_ta, lv_color_hex(0x00FFFF), LV_STATE_FOCUSED); // Electric Cyan
    lv_obj_set_style_border_width(g_cwifi_pass_ta, 3, LV_STATE_FOCUSED); // Thicker border
    lv_obj_set_style_border_color(g_cwifi_pass_ta, lv_color_hex(0x333333), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(g_cwifi_pass_ta, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_cwifi_pass_ta, 6, LV_STATE_DEFAULT);
    lv_obj_add_event_cb(g_cwifi_pass_ta, [](lv_event_t *e) {
        lv_event_code_t c = lv_event_get_code(e);
        if (c == LV_EVENT_FOCUSED || c == LV_EVENT_CLICKED) _cwifi_kb_show(g_cwifi_pass_ta);
        else if (c == LV_EVENT_DEFOCUSED) _cwifi_kb_hide();
    }, LV_EVENT_ALL, nullptr);

    // Eye toggle button for password visibility
    lv_obj_t *eye_btn = lv_btn_create(right);
    lv_obj_set_size(eye_btn, 38, 34);
    lv_obj_align_to(eye_btn, g_cwifi_pass_ta, LV_ALIGN_RIGHT_MID, -2, 0);
    lv_obj_set_style_bg_opa(eye_btn, 0, 0);
    lv_obj_set_style_border_width(eye_btn, 0, 0);
    lv_obj_set_style_shadow_width(eye_btn, 0, 0);
    lv_obj_t *eye_lbl = lv_label_create(eye_btn);
    lv_label_set_text(eye_lbl, LV_SYMBOL_EYE_OPEN);
    lv_obj_set_style_text_color(eye_lbl, lv_color_hex(0xFFFF00), LV_STATE_DEFAULT); // Vivid Yellow
    lv_obj_set_style_text_font(eye_lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_center(eye_lbl);
    lv_obj_add_event_cb(eye_btn, [](lv_event_t *e) {
        lv_obj_t *btn = lv_event_get_target(e);
        lv_obj_t *lbl = lv_obj_get_child(btn, 0);
        bool mode = lv_textarea_get_password_mode(g_cwifi_pass_ta);
        lv_textarea_set_password_mode(g_cwifi_pass_ta, !mode);
        lv_label_set_text(lbl, !mode ? LV_SYMBOL_EYE_CLOSE : LV_SYMBOL_EYE_OPEN);
    }, LV_EVENT_CLICKED, nullptr);

    // D6: Buttons ─────────────────────────────────────────────────────────────
    int btn_y = 142;
    int btn_w = (rw - 24) / 2;

    // SCAN button (green)
    lv_obj_t *scan_btn = lv_obj_create(right);
    lv_obj_set_pos(scan_btn, 8, btn_y);
    lv_obj_set_size(scan_btn, btn_w, 40);
    lv_obj_set_style_bg_color(scan_btn, lv_color_hex(0x1a3a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_radius(scan_btn, 6, LV_STATE_DEFAULT);
    _panel_reset(scan_btn);

    g_cwifi_scan_lbl = lv_label_create(scan_btn);
    lv_label_set_text(g_cwifi_scan_lbl, "SCAN");
    lv_obj_set_style_text_color(g_cwifi_scan_lbl, lv_color_hex(0x00FF00), LV_STATE_DEFAULT); // Electric Green
    lv_obj_set_style_text_font(g_cwifi_scan_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(g_cwifi_scan_lbl, 0x1a3a1a);
    lv_obj_center(g_cwifi_scan_lbl);

    lv_obj_add_flag(scan_btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(scan_btn, [](lv_event_t*) {
        ESP_LOGI("WIFI", "Embedded scan button clicked!");
        _cwifi_kb_hide();
        _cwifi_start_scan_bg(); // E4: non-blocking
    }, LV_EVENT_CLICKED, nullptr);

    // CONN button (blue)
    lv_obj_t *conn_btn = lv_obj_create(right);
    lv_obj_set_pos(conn_btn, 8 + btn_w + 8, btn_y);
    lv_obj_set_size(conn_btn, btn_w, 40);
    lv_obj_set_style_bg_color(conn_btn, lv_color_hex(0x003050), LV_STATE_DEFAULT);
    lv_obj_set_style_radius(conn_btn, 6, LV_STATE_DEFAULT);
    _panel_reset(conn_btn);

    lv_obj_t *conn_lbl = lv_label_create(conn_btn);
    lv_label_set_text(conn_lbl, "CONN");
    lv_obj_set_style_text_color(conn_lbl, lv_color_hex(0x00FFFF), LV_STATE_DEFAULT); // Electric Cyan
    lv_obj_set_style_text_font(conn_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(conn_lbl, 0x003050);
    lv_obj_center(conn_lbl);

    lv_obj_add_flag(conn_btn, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(conn_btn, [](lv_event_t*) {
        _cwifi_kb_hide();
        if (!g_cwifi_ssid_ta || !g_cwifi_pass_ta || !g_cwifi_status_lbl) return;
        const char *ssid = lv_textarea_get_text(g_cwifi_ssid_ta);
        if (!ssid || !ssid[0]) { lv_label_set_text(g_cwifi_status_lbl, "Enter an SSID first"); return; }
        lv_label_set_text(g_cwifi_status_lbl, "Connecting...");
        lv_refr_now(NULL);
        void ui_set_connecting();
        ui_set_connecting();
        wifi_connect_from_ui(g_cwifi_ssid_ta, g_cwifi_pass_ta);
        lv_label_set_text(g_cwifi_status_lbl, "Connect requested — check header for IP");
    }, LV_EVENT_CLICKED, nullptr);

    // D7: Status label ────────────────────────────────────────────────────────
    g_cwifi_status_lbl = lv_label_create(right);
    lv_label_set_text(g_cwifi_status_lbl, "Scan for networks to begin");
    lv_obj_set_style_text_color(g_cwifi_status_lbl, lv_color_hex(0x00FFFF), LV_STATE_DEFAULT); // Vivid Cyan
    lv_obj_set_style_text_font(g_cwifi_status_lbl, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    _lbl_bg(g_cwifi_status_lbl, 0x050505);
    lv_obj_set_pos(g_cwifi_status_lbl, 10, 194);
    lv_obj_set_width(g_cwifi_status_lbl, rw - 20);
    lv_label_set_long_mode(g_cwifi_status_lbl, LV_LABEL_LONG_WRAP);

    // Auto-populate saved SSID
    wifi_config_t conf;
    if (esp_wifi_get_config(WIFI_IF_STA, &conf) == ESP_OK && conf.sta.ssid[0]) {
        lv_textarea_set_text(g_cwifi_ssid_ta, (char*)conf.sta.ssid);
        lv_textarea_set_text(g_cwifi_pass_ta, (char*)conf.sta.password);
        lv_label_set_text(g_cwifi_status_lbl, "Saved credentials loaded");
    }

    // D9: Floating keyboard — full screen width, anchored bottom ─────────────
    g_cwifi_keyboard = lv_keyboard_create(lv_scr_act());
    lv_obj_set_size(g_cwifi_keyboard, 800, 200);
    lv_obj_set_style_bg_color(g_cwifi_keyboard, lv_color_hex(0x111111), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_cwifi_keyboard, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_cwifi_keyboard, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_add_flag(g_cwifi_keyboard, LV_OBJ_FLAG_HIDDEN);
    lv_obj_add_event_cb(g_cwifi_keyboard, [](lv_event_t*) { _cwifi_kb_hide(); }, LV_EVENT_READY, nullptr);
    lv_obj_add_event_cb(g_cwifi_keyboard, [](lv_event_t*) { _cwifi_kb_hide(); }, LV_EVENT_CANCEL, nullptr);
}
