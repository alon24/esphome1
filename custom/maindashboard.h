#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "tab_home.h"
#include "tab_settings.h"
#include "tab_wifi.h"
#include "tab_sd.h"
#include "version_info.h"
#include "esphome/core/log.h"
#include <cstdio>

// ── FULL-WIDTH HEADER + SIDEBAR DASHBOARD ─────────────────────────────────────
// Layout (800×480):
//   Header  (Top)     x=0   w=800  h=64  — Full Width Stats/Time
//   Sidebar (Left)    x=0   w=160  h=416 — Vertical Nav (Below Header)
//   Content (Right)   x=160 w=640  h=416 — Actual Page content
// ──────────────────────────────────────────────────────────────────────────────

#define DASH_BG      0x0e0e0e
#define DASH_SIDE_BG 0x131313
#define DASH_HDR_BG  0x1a1a1a

static lv_obj_t *g_dash_time_lbl    = nullptr;
static lv_obj_t *g_dash_ip_lbl      = nullptr;
static lv_obj_t *g_dash_ap_ip_lbl   = nullptr;
static lv_obj_t *g_dash_main_cont   = nullptr;

static const char *DASH_DAYS[]   = { "Sun","Mon","Tue","Wed","Thu","Fri","Sat" };
static const char *DASH_MONTHS[] = { "","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec" };

static void lvgl_flush_cb(lv_display_t *disp, const lv_area_t *area, uint8_t *px_map) {
    auto &lcd = esphome::lovyan_gfx::v_lcd();
    int32_t w = (area->x1 > area->x2) ? (area->x1 - area->x2 + 1) : (area->x2 - area->x1 + 1);
    int32_t h = (area->y1 > area->y2) ? (area->y1 - area->y2 + 1) : (area->y2 - area->y1 + 1);
    lcd.startWrite();
    lcd.setAddrWindow(area->x1, area->y1, w, h);
    lcd.writePixels((uint16_t *)px_map, w * h);
    lcd.endWrite();
    lv_display_flush_ready(disp);
}

static void maindashboard_create(lv_obj_t *parent) {
    if (!parent) return;
    system_settings_load();
    void grid_config_load(const char* name, bool force); // Forward decl
    grid_config_load(nullptr, false); // Load persistent active screen
    
    // Apply boot-time AP settings
    if (g_ap_always_on) {
        ::wifi_apply_ap_settings(true, g_ap_ssid, g_ap_password);
        ESP_LOGI("SYS", "Persistent AP Mode Active on Boot: %s", g_ap_ssid);
    }
    lv_obj_clean(parent);
    lv_obj_t *scr = parent;

    lv_display_t *disp = lv_display_get_default();
    if (disp) lv_display_set_flush_cb(disp, lvgl_flush_cb);

    lv_obj_set_style_bg_color(scr, lv_color_hex(DASH_BG), 0);
    
    // ── HEADER (Full width 800x64) ────────────────────────────────────────────
    lv_obj_t *header = _make_panel(scr, 0, 0, 800, 64, DASH_HDR_BG);
    lv_obj_set_style_border_width(header, 0, 0);
    lv_obj_set_style_outline_width(header, 0, 0);
    lv_obj_set_style_shadow_width(header, 0, 0);

    lv_obj_t *title = lv_label_create(header);
    lv_label_set_text(title, APP_NAME);
    lv_obj_set_style_text_color(title, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(title, &lv_font_montserrat_22, 0);
    lv_obj_set_pos(title, 20, 18);
    
    g_dash_time_lbl = lv_label_create(header);
    lv_label_set_text(g_dash_time_lbl, "00:00:00");
    lv_obj_set_style_text_color(g_dash_time_lbl, lv_color_hex(0xffffff), 0);
    lv_obj_set_style_text_font(g_dash_time_lbl, &lv_font_montserrat_20, 0);
    lv_obj_set_pos(g_dash_time_lbl, 160, 22);

    g_dash_ip_lbl = lv_label_create(header);
    lv_label_set_text(g_dash_ip_lbl, "Disconnected");
    lv_obj_set_style_text_color(g_dash_ip_lbl, lv_color_hex(0xFF4444), 0); // Bright Red when disconnected
    lv_obj_set_style_text_font(g_dash_ip_lbl, &lv_font_montserrat_14, 0);
    lv_obj_align(g_dash_ip_lbl, LV_ALIGN_RIGHT_MID, -20, 0);

    lv_obj_t *vlbl = lv_label_create(header);
    lv_label_set_text(vlbl, FW_VERSION_STR);
    lv_obj_set_style_text_color(vlbl, lv_color_hex(0xcccccc), 0); // High-contrast grey
    lv_obj_set_style_text_font(vlbl, &lv_font_montserrat_14, 0);
    lv_obj_align(vlbl, LV_ALIGN_RIGHT_MID, -420, 0); // Shifted further left to make room

    // AP Icon (Mirroring Web Editor)
    // AP Icon (Interactive & Color-coded)
    static lv_obj_t *g_dash_ap_btn = lv_obj_create(header);
    lv_obj_set_size(g_dash_ap_btn, 44, 44);
    lv_obj_align(g_dash_ap_btn, LV_ALIGN_RIGHT_MID, -360, 0); // Shifted to make room for IPs
    _panel_reset(g_dash_ap_btn);
    lv_obj_set_style_bg_opa(g_dash_ap_btn, 0, 0);
    lv_obj_clear_flag(g_dash_ap_btn, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *ap_icn = lv_label_create(g_dash_ap_btn);
    lv_label_set_text(ap_icn, LV_SYMBOL_WIFI);
    lv_obj_set_style_text_font(ap_icn, &lv_font_montserrat_20, 0);
    lv_obj_center(ap_icn);
    
    // Switch to WiFi Tab on click
    lv_obj_add_event_cb(g_dash_ap_btn, [](lv_event_t *){ 
        void ui_navigate_to(const char* name);
        ui_navigate_to("wifi"); 
    }, LV_EVENT_CLICKED, nullptr);

    g_dash_ap_ip_lbl = lv_label_create(header);
    lv_label_set_text(g_dash_ap_ip_lbl, "");
    lv_obj_set_style_text_color(g_dash_ap_ip_lbl, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(g_dash_ap_ip_lbl, &lv_font_montserrat_14, 0);
    lv_obj_align(g_dash_ap_ip_lbl, LV_ALIGN_RIGHT_MID, -190, 0); // Placed between STA IP and AP Icon

    // Dynamic Color & IP Timer
    lv_timer_create([](lv_timer_t *t){
        lv_obj_t *p = (lv_obj_t*)lv_timer_get_user_data(t);
        if (!lv_obj_is_valid(p)) return;
        lv_obj_t *icn = lv_obj_get_child(p, 0);
        wifi_mode_t mode;
        esp_wifi_get_mode(&mode);
        bool active = (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA);
        if (icn) lv_obj_set_style_text_color(icn, lv_color_hex(active ? 0x00FF00 : 0x555555), 0);
        
        if (g_dash_ap_ip_lbl) {
            if (active) {
                esp_netif_ip_info_t ap_ip_info;
                esp_netif_t *ap_netif = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
                if (ap_netif) {
                    esp_netif_get_ip_info(ap_netif, &ap_ip_info);
                    char buf[32];
                    snprintf(buf, sizeof(buf), "AP: " IPSTR, IP2STR(&ap_ip_info.ip));
                    lv_label_set_text(g_dash_ap_ip_lbl, buf);
                }
            } else {
                lv_label_set_text(g_dash_ap_ip_lbl, "");
            }
        }
    }, 1000, g_dash_ap_btn);

    // ── CONTENT AREA (Full Width 800x416, Below Header) ────────────────────────
    g_dash_main_cont = lv_obj_create(scr);
    lv_obj_set_size(g_dash_main_cont, 800, 416);
    lv_obj_set_pos(g_dash_main_cont, 0, 64);
    _panel_reset(g_dash_main_cont);
    lv_obj_set_style_pad_all(g_dash_main_cont, 0, 0); // Explicitly zero padding
    lv_obj_set_style_bg_color(g_dash_main_cont, lv_color_hex(DASH_BG), 0);
    lv_obj_set_style_bg_opa(g_dash_main_cont, LV_OPA_COVER, 0);

    tab_home_create(g_dash_main_cont);
}

static void dashboard_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    if (g_grid_needs_refresh) {
        g_grid_needs_refresh = false;
        ui_refresh_grid(); // Perform high-speed RAM cache swap without destroying the LVGL hierarchy
        ESP_LOGI("GRID", "UI Refresh triggered from editor");
    }
    if (g_dash_time_lbl && h != -1) {
        char tbuf[48];
        if (dow >= 1 && dow <= 7 && mon >= 1 && mon <= 12) {
            snprintf(tbuf, sizeof(tbuf), "%s, %02d %s  %02d:%02d:%02d", 
                     DASH_DAYS[dow-1], dom, DASH_MONTHS[mon], h, m, s);
        } else {
            snprintf(tbuf, sizeof(tbuf), "%02d:%02d:%02d", h, m, s);
        }
        lv_label_set_text(g_dash_time_lbl, tbuf);
    }
    tab_home_tick(h, m, s, dom, mon, year, dow);
    tab_settings_tick();
    tab_wifi_tick();
    tab_sd_poll();
}

void ui_set_connecting() {
    if (g_dash_ip_lbl) {
        lv_label_set_text(g_dash_ip_lbl, "Connecting...");
        lv_obj_set_style_text_color(g_dash_ip_lbl, lv_color_hex(0xFFA500), 0); // Orange
    }
}

void ui_set_connected(const char *ip) {
    if (g_dash_ip_lbl) {
        lv_label_set_text(g_dash_ip_lbl, ip ? ip : "Connected");
        lv_obj_set_style_text_color(g_dash_ip_lbl, lv_color_hex(0x00FF00), 0);
    }
    tab_settings_set_ip(ip ? ip : "");
}

void ui_set_disconnected() {
    if (g_dash_ip_lbl) {
        lv_label_set_text(g_dash_ip_lbl, "Disconnected");
        lv_obj_set_style_text_color(g_dash_ip_lbl, lv_color_hex(0xFF4444), 0);
    }
}
