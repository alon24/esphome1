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
static TaskHandle_t g_cwifi_scan_task_handle = nullptr;

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

// ── Background scan task ─────────────────────────────────────────────────────
static void _cwifi_scan_task(void *pvParameters) {
    ESP_LOGI("WIFI", "Starting Background Scan Task (robust mode)...");
    
    wifi_mode_t mode;
    esp_wifi_get_mode(&mode);
    if (mode == WIFI_MODE_NULL) {
        ESP_LOGW("WIFI", "WiFi not started, starting in STA mode for scan");
        esp_wifi_set_mode(WIFI_MODE_STA);
    }
    
    wifi_scan_config_t cfg = {};
    cfg.show_hidden = (bool)((size_t)pvParameters);
    // Add explicit scan times to ensure we catch beacons
    cfg.scan_time.active.min = 100;
    cfg.scan_time.active.max = 150;
    
    esp_err_t err = esp_wifi_scan_start(&cfg, true); // blocking here in the background task
    
    if (err == ESP_OK) {
        uint16_t count = 0;
        esp_wifi_scan_get_ap_num(&count);
        ESP_LOGI("WIFI", "Scan finished, total APs: %d", count);
        
        if (count > 32) count = 32;
        if (count > 0) {
            wifi_ap_record_t *recs = (wifi_ap_record_t*)malloc(count * sizeof(wifi_ap_record_t));
            if (recs) {
                if (esp_wifi_scan_get_ap_records(&count, recs) == ESP_OK) {
                    g_cwifi_results.clear();
                    for (int i = 0; i < (int)count; i++) {
                        if (recs[i].ssid[0] == '\0') continue;
                        
                        // SSID Deduplication
                        bool found = false;
                        for (const auto &existing : g_cwifi_results) {
                            if (strncmp(existing.ssid, (const char*)recs[i].ssid, 32) == 0) {
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            ScanResult rs;
                            strncpy(rs.ssid, (const char*)recs[i].ssid, 32);
                            rs.ssid[32] = '\0';
                            rs.rssi = recs[i].rssi;
                            g_cwifi_results.push_back(rs);
                        }
                    }
                    ESP_LOGI("WIFI", "Populated shared list with %d unique results", (int)g_cwifi_results.size());
                }
                free(recs);
            }
        }
    } else {
        ESP_LOGE("WIFI", "Background Scan failed error: %d", err);
    }

    g_cwifi_scanning = false;
    g_cwifi_scan_done = true;
    g_cwifi_scan_task_handle = nullptr;
    vTaskDelete(NULL);
}

static void _cwifi_start_scan_bg() {
    if (g_cwifi_scanning) {
        ESP_LOGW("WIFI", "Scan already in progress, ignoring request");
        return;
    }

    ESP_LOGI("WIFI", "Requested manual background scan...");
    if (g_cwifi_scan_lbl) lv_label_set_text(g_cwifi_scan_lbl, "SCANNING...");
    if (g_cwifi_status_lbl) lv_label_set_text(g_cwifi_status_lbl, "Scanning SSIDs... (Wait)");
    
    // Create custom spinner in the "NETWORKS" header line
    if (g_cwifi_net_hdr && !g_cwifi_spinner) {
        g_cwifi_spinner = lv_arc_create(lv_obj_get_parent(g_cwifi_net_hdr));
        lv_obj_set_size(g_cwifi_spinner, 16, 16);
        lv_arc_set_angles(g_cwifi_spinner, 0, 90);
        lv_arc_set_bg_angles(g_cwifi_spinner, 0, 360);
        lv_obj_align(g_cwifi_spinner, LV_ALIGN_TOP_RIGHT, -8, 8);
        lv_obj_set_style_arc_width(g_cwifi_spinner, 2, LV_PART_MAIN);
        lv_obj_set_style_arc_width(g_cwifi_spinner, 2, LV_PART_INDICATOR);
        lv_obj_set_style_arc_color(g_cwifi_spinner, lv_color_hex(0x00CED1), LV_PART_INDICATOR);
        
        lv_anim_t a;
        lv_anim_init(&a);
        lv_anim_set_var(&a, g_cwifi_spinner);
        lv_anim_set_exec_cb(&a, (lv_anim_exec_xcb_t)lv_arc_set_rotation);
        lv_anim_set_values(&a, 0, 360);
        lv_anim_set_time(&a, 1000);
        lv_anim_set_repeat_count(&a, LV_ANIM_REPEAT_INFINITE);
        lv_anim_start(&a);
    }
    
    g_cwifi_scanning = true;
    g_cwifi_scan_done = false;
    
    // Launch background task
    xTaskCreate(_cwifi_scan_task, "wifi_scan_task", 4096, (void*)((size_t)true), 5, &g_cwifi_scan_task_handle);
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
            lv_obj_t *r  = (lv_obj_t*)lv_event_get_target(e);
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
        
        if (g_cwifi_spinner) {
            lv_obj_del(g_cwifi_spinner);
            g_cwifi_spinner = nullptr;
        }
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
