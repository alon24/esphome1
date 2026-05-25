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



static void maindashboard_create(lv_obj_t *parent) {
    ESP_LOGI("DASH", "Creating Main Dashboard...");
    if (!parent) return;
    system_settings_load();
    void grid_config_load(const char* name, bool force); // Forward decl
    grid_config_load(nullptr, false); // Load persistent active screen

    // Triple-reset recovery: override AP setting before applying
    ESP_LOGI("RESET", "Dashboard init: triple_ap=%d, reset_count=%d",
             (int)g_triple_reset_ap, (int)g_reset_count);
    bool show_recovery_overlay = false;
    if (g_triple_reset_ap) {
        g_triple_reset_ap = false;
        g_ap_always_on    = true;
        show_recovery_overlay = true;
        ESP_LOGI("RESET", "*** RECOVERY OVERLAY: AP mode forced ON (ssid=%s) ***", g_ap_ssid);
    }

    // Apply boot-time AP settings — enforce saved preference in both directions
    ::wifi_apply_ap_settings(g_ap_always_on, g_ap_ssid, g_ap_password);
    ESP_LOGI("SYS", "Boot AP: %s (ssid=%s)", g_ap_always_on ? "ON" : "OFF", g_ap_ssid);
    lv_obj_clean(parent);
    lv_obj_t *scr = parent;


    lv_obj_set_style_bg_color(scr, lv_color_hex(DASH_BG), 0);
    
    // ── HEADER (Full width 800x64) ────────────────────────────────────────────
    // lv_obj_t *header = _make_panel(scr, 0, 0, 800, 64, DASH_HDR_BG);
    // lv_obj_set_style_border_width(header, 0, 0);
    // lv_obj_set_style_outline_width(header, 0, 0);
    // lv_obj_set_style_shadow_width(header, 0, 0);

    // lv_obj_t *title = lv_label_create(header);
    // lv_label_set_text(title, APP_NAME);
    // lv_obj_set_style_text_color(title, lv_color_hex(0x00CED1), 0);
    // lv_obj_set_style_text_font(title, &lv_font_montserrat_22, 0);
    // lv_obj_set_pos(title, 20, 18);
    
    // g_dash_time_lbl = lv_label_create(header);
    // lv_label_set_text(g_dash_time_lbl, "00:00:00");
    // lv_obj_set_style_text_color(g_dash_time_lbl, lv_color_hex(0xffffff), 0);
    // lv_obj_set_style_text_font(g_dash_time_lbl, &lv_font_montserrat_20, 0);
    // lv_obj_set_pos(g_dash_time_lbl, 160, 22);

    // g_dash_ip_lbl = lv_label_create(header);
    // lv_label_set_text(g_dash_ip_lbl, "Disconnected");
    // lv_obj_set_style_text_color(g_dash_ip_lbl, lv_color_hex(0xFF4444), 0); // Bright Red when disconnected
    // lv_obj_set_style_text_font(g_dash_ip_lbl, &lv_font_montserrat_14, 0);
    // lv_obj_align(g_dash_ip_lbl, LV_ALIGN_RIGHT_MID, -20, 0);

    // lv_obj_t *vlbl = lv_label_create(header);
    // lv_label_set_text(vlbl, FW_VERSION_STR);
    // lv_obj_set_style_text_color(vlbl, lv_color_hex(0xcccccc), 0); // High-contrast grey
    // lv_obj_set_style_text_font(vlbl, &lv_font_montserrat_14, 0);
    // lv_obj_align(vlbl, LV_ALIGN_RIGHT_MID, -420, 0); // Shifted further left to make room

    // AP Icon (Mirroring Web Editor)
    // AP Icon (Interactive & Color-coded)
    // static lv_obj_t *g_dash_ap_btn = lv_obj_create(header);
    // lv_obj_set_size(g_dash_ap_btn, 44, 44);
    // lv_obj_align(g_dash_ap_btn, LV_ALIGN_RIGHT_MID, -360, 0); // Shifted to make room for IPs
    // _panel_reset(g_dash_ap_btn);
    // lv_obj_set_style_bg_opa(g_dash_ap_btn, 0, 0);
    // lv_obj_clear_flag(g_dash_ap_btn, LV_OBJ_FLAG_SCROLLABLE);

    // lv_obj_t *ap_icn = lv_label_create(g_dash_ap_btn);
    // lv_label_set_text(ap_icn, LV_SYMBOL_WIFI);
    // lv_obj_set_style_text_font(ap_icn, &lv_font_montserrat_20, 0);
    // lv_obj_center(ap_icn);
    
    // Switch to WiFi Tab on click
    // lv_obj_add_event_cb(g_dash_ap_btn, [](lv_event_t *){ 
    //     void ui_navigate_to(const char* name);
    //     ui_navigate_to("wifi"); 
    // }, LV_EVENT_CLICKED, nullptr);

    // g_dash_ap_ip_lbl = lv_label_create(header);
    // lv_label_set_text(g_dash_ap_ip_lbl, "");
    // lv_obj_set_style_text_color(g_dash_ap_ip_lbl, lv_color_hex(0x00CED1), 0);
    // lv_obj_set_style_text_font(g_dash_ap_ip_lbl, &lv_font_montserrat_14, 0);
    // lv_obj_align(g_dash_ap_ip_lbl, LV_ALIGN_RIGHT_MID, -190, 0); // Placed between STA IP and AP Icon

    // Dynamic Color & IP Timer
    // lv_timer_create([](lv_timer_t *t){
    //     lv_obj_t *p = (lv_obj_t*)lv_timer_get_user_data(t);
    //     if (!lv_obj_is_valid(p)) return;
    //     lv_obj_t *icn = lv_obj_get_child(p, 0);
    //     wifi_mode_t mode;
    //     esp_wifi_get_mode(&mode);
    //     bool active = (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA);
    //     if (icn) lv_obj_set_style_text_color(icn, lv_color_hex(active ? 0x00FF00 : 0x555555), 0);
        
    //     if (g_dash_ap_ip_lbl) {
    //         if (active) {
    //             esp_netif_ip_info_t ap_ip_info;
    //             esp_netif_t *ap_netif = esp_netif_get_handle_from_ifkey("WIFI_AP_DEF");
    //             if (ap_netif) {
    //                 esp_netif_get_ip_info(ap_netif, &ap_ip_info);
    //                 char buf[32];
    //                 snprintf(buf, sizeof(buf), "AP: " IPSTR, IP2STR(&ap_ip_info.ip));
    //                 lv_label_set_text(g_dash_ap_ip_lbl, buf);
    //             }
    //             } else {
    //                 lv_label_set_text(g_dash_ap_ip_lbl, "");
    //             }
    //         }
    //     }, 1000, g_dash_ap_btn);

    // ── CONTENT AREA (Full Width 800x480, Starting at Top) ────────────────────────
    g_dash_main_cont = lv_obj_create(scr);
    lv_obj_set_size(g_dash_main_cont, 800, 480);
    lv_obj_set_pos(g_dash_main_cont, 0, 0);
    _panel_reset(g_dash_main_cont);
    lv_obj_set_style_pad_all(g_dash_main_cont, 0, 0); // Explicitly zero padding
    lv_obj_set_style_bg_color(g_dash_main_cont, lv_color_hex(DASH_BG), 0);
    lv_obj_set_style_bg_opa(g_dash_main_cont, LV_OPA_COVER, 0);

    tab_home_create(g_dash_main_cont);

    // Show triple-reset recovery overlay on top of content for 5 seconds
    if (show_recovery_overlay) {
        ESP_LOGI("RESET", "Creating recovery overlay on screen");
        lv_obj_t *ov = lv_obj_create(scr);
        lv_obj_set_size(ov, 800, 480);
        lv_obj_set_pos(ov, 0, 0);
        lv_obj_set_style_bg_color(ov, lv_color_hex(0x100800), 0);
        lv_obj_set_style_bg_opa(ov, LV_OPA_COVER, 0);
        lv_obj_set_style_border_color(ov, lv_color_hex(0xFFAA00), 0);
        lv_obj_set_style_border_width(ov, 4, 0);
        lv_obj_clear_flag(ov, LV_OBJ_FLAG_SCROLLABLE);

        lv_obj_t *icon = lv_label_create(ov);
        lv_label_set_text(icon, LV_SYMBOL_WIFI "  " LV_SYMBOL_WARNING);
        lv_obj_set_style_text_font(icon, &lv_font_montserrat_24, 0);
        lv_obj_set_style_text_color(icon, lv_color_hex(0xFFAA00), 0);
        lv_obj_align(icon, LV_ALIGN_CENTER, 0, -70);

        lv_obj_t *lbl = lv_label_create(ov);
        lv_label_set_text(lbl, "GOING TO AP MODE\nAFTER 3 RESETS");
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_22, 0);
        lv_obj_set_style_text_color(lbl, lv_color_hex(0xFFAA00), 0);
        lv_obj_set_style_text_align(lbl, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_set_width(lbl, 700);
        lv_obj_align(lbl, LV_ALIGN_CENTER, 0, 0);

        lv_obj_t *sub = lv_label_create(ov);
        char sub_buf[80];
        snprintf(sub_buf, sizeof(sub_buf), "Connect to: %s", g_ap_ssid);
        lv_label_set_text(sub, sub_buf);
        lv_obj_set_style_text_font(sub, &lv_font_montserrat_18, 0);
        lv_obj_set_style_text_color(sub, lv_color_hex(0xAAAAAA), 0);
        lv_obj_set_style_text_align(sub, LV_TEXT_ALIGN_CENTER, 0);
        lv_obj_align(sub, LV_ALIGN_CENTER, 0, 60);

        lv_timer_create([](lv_timer_t *t) {
            lv_obj_t *o = (lv_obj_t*)lv_timer_get_user_data(t);
            if (lv_obj_is_valid(o)) lv_obj_del(o);
            lv_timer_del(t);
            ESP_LOGI("RESET", "Recovery overlay dismissed");
        }, 5000, ov);
    }

    ESP_LOGI("DASH", "Dashboard build complete.");
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
    void tab_wifi_component_tick();
    tab_wifi_component_tick();
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
    extern std::string g_current_ip;
    g_current_ip = ip ? ip : "Connected";
    tab_settings_set_ip(ip ? ip : "");
}

void ui_set_disconnected() {
    if (g_dash_ip_lbl) {
        lv_label_set_text(g_dash_ip_lbl, "Disconnected");
        lv_obj_set_style_text_color(g_dash_ip_lbl, lv_color_hex(0xFF4444), 0);
    }
    extern std::string g_current_ip;
    g_current_ip = "Disconnected";
}
