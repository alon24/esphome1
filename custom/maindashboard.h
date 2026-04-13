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
static lv_obj_t *g_dash_tabs[4]     = {nullptr, nullptr, nullptr, nullptr};
static lv_obj_t *g_dash_nav_btns[4] = {nullptr, nullptr, nullptr, nullptr};
static int        g_dash_active_tab = 0;

static const char *DASH_DAYS[]   = { "Sun","Mon","Tue","Wed","Thu","Fri","Sat" };
static const char *DASH_MONTHS[] = { "","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec" };

static void _dash_update_nav_style(int active_idx) {
    for (int i = 0; i < 4; i++) {
        if (!g_dash_nav_btns[i]) continue;
        bool active = (i == active_idx);
        uint32_t bg = active ? 0x1C2828 : DASH_SIDE_BG;
        lv_obj_set_style_bg_color(g_dash_nav_btns[i], lv_color_hex(bg), 0);
        lv_obj_t *lbl = lv_obj_get_child(g_dash_nav_btns[i], 0);
        if (lbl) {
            lv_obj_set_style_text_color(lbl, lv_color_hex(active ? 0x00CED1 : 0x888888), 0);
        }
    }
}

static void _dash_show_tab(int idx) {
    g_dash_active_tab = idx;
    for (int i = 0; i < 4; i++) {
        if (!g_dash_tabs[i]) continue;
        if (i == idx) lv_obj_clear_flag(g_dash_tabs[i], LV_OBJ_FLAG_HIDDEN);
        else          lv_obj_add_flag(g_dash_tabs[i], LV_OBJ_FLAG_HIDDEN);
    }
    _dash_update_nav_style(idx);
    if (idx == 2) tab_wifi_on_show();
    else          _wifi_kb_hide();
    if (idx == 3) tab_sd_on_show();
    else          tab_sd_on_hide();
}

static lv_obj_t *_dash_make_nav_btn(lv_obj_t *parent, const char *sym, const char *name, int y, int idx) {
    lv_obj_t *btn = lv_obj_create(parent);
    lv_obj_set_size(btn, 140, 50);
    lv_obj_set_pos(btn, 10, y);
    lv_obj_set_style_bg_color(btn, lv_color_hex(DASH_SIDE_BG), 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn, 8, 0);
    lv_obj_set_style_border_width(btn, 0, 0);
    lv_obj_set_style_outline_width(btn, 0, 0);
    _panel_reset(btn);
    lv_obj_clear_flag(btn, LV_OBJ_FLAG_SCROLLABLE);

    lv_obj_t *lbl = lv_label_create(btn);
    lv_label_set_text_fmt(lbl, "%s  %s", sym, name);
    lv_obj_set_style_text_color(lbl, lv_color_hex(0x888888), 0);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, 0);
    lv_obj_center(lbl);

    lv_obj_set_user_data(btn, (void *)(intptr_t)idx);
    lv_obj_add_event_cb(btn, [](lv_event_t *e) {
        lv_obj_t * target = lv_event_get_target(e);
        int i = (int)(intptr_t)lv_obj_get_user_data(target);
        _dash_show_tab(i);
    }, LV_EVENT_CLICKED, nullptr);
    return btn;
}

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

static void maindashboard_create(lv_obj_t *parent) {
    if (!parent) return;
    system_settings_load();
    void grid_config_load(const char* name); // Forward decl
    grid_config_load(nullptr); // Load persistent active screen
    
    // Apply boot-time AP settings
    if (g_ap_always_on) {
        ::wifi_apply_ap_settings(true, g_ap_ssid, g_ap_password);
        ESP_LOGI("SYS", "Persistent AP Mode Active on Boot: %s", g_ap_ssid);
    }
    lv_obj_clean(parent);
    lv_obj_t *scr = parent;

    lv_disp_t *disp = lv_disp_get_default();
    if (disp && disp->driver) disp->driver->flush_cb = lvgl_flush_cb;

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
    lv_obj_add_event_cb(g_dash_ap_btn, [](lv_event_t *){ _dash_show_tab(2); }, LV_EVENT_CLICKED, nullptr);

    g_dash_ap_ip_lbl = lv_label_create(header);
    lv_label_set_text(g_dash_ap_ip_lbl, "");
    lv_obj_set_style_text_color(g_dash_ap_ip_lbl, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(g_dash_ap_ip_lbl, &lv_font_montserrat_14, 0);
    lv_obj_align(g_dash_ap_ip_lbl, LV_ALIGN_RIGHT_MID, -190, 0); // Placed between STA IP and AP Icon

    // Dynamic Color & IP Timer
    lv_timer_create([](lv_timer_t *t){
        lv_obj_t *p = (lv_obj_t*)t->user_data;
        lv_obj_t *icn = lv_obj_get_child(p, 0);
        wifi_mode_t mode;
        esp_wifi_get_mode(&mode);
        bool active = (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA);
        lv_obj_set_style_text_color(icn, lv_color_hex(active ? 0x00FF00 : 0x555555), 0);
        
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

    // ── SIDEBAR (Left 160px, Below Header) ────────────────────────────────────
    lv_obj_t *sidebar = _make_panel(scr, 0, 64, 160, 416, DASH_SIDE_BG);
    lv_obj_set_style_border_width(sidebar, 0, 0);
    lv_obj_set_style_outline_width(sidebar, 0, 0);
    lv_obj_set_style_shadow_width(sidebar, 0, 0);
    lv_obj_add_flag(sidebar, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(sidebar, LV_DIR_VER);

    const char *SYMS[] = {LV_SYMBOL_HOME, LV_SYMBOL_SETTINGS, LV_SYMBOL_WIFI, LV_SYMBOL_SD_CARD};
    const char *NAMES[] = {"HOME", "SYSTEM", "WIFI", "SD"};
    for (int i = 0; i < 4; i++) {
        g_dash_nav_btns[i] = _dash_make_nav_btn(sidebar, SYMS[i], NAMES[i], 20 + (i * 60), i);
    }

    // ── CONTENT AREA (Right 640x416, Below Header) ────────────────────────────
    lv_obj_t *content = lv_obj_create(scr);
    lv_obj_set_size(content, 640, 416);
    lv_obj_set_pos(content, 160, 64);
    _panel_reset(content);
    lv_obj_set_style_pad_all(content, 0, 0); // Explicitly zero padding
    lv_obj_set_style_bg_color(content, lv_color_hex(DASH_BG), 0);
    lv_obj_set_style_bg_opa(content, LV_OPA_COVER, 0);

    g_dash_tabs[0] = _make_panel(content, 0, 0, 640, 416, DASH_BG);
    tab_home_create(g_dash_tabs[0]);
    
    g_dash_tabs[1] = _make_panel(content, 0, 0, 640, 416, DASH_BG);
    tab_settings_create(g_dash_tabs[1]);

    g_dash_tabs[2] = _make_panel(content, 0, 0, 640, 416, DASH_BG);
    tab_wifi_create(g_dash_tabs[2], scr);

    g_dash_tabs[3] = _make_panel(content, 0, 0, 640, 416, DASH_BG);
    tab_sd_create(g_dash_tabs[3]);

    _dash_show_tab(0);
}

static void dashboard_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    if (g_grid_needs_refresh) {
        g_grid_needs_refresh = false;
        if (g_dash_tabs[0]) tab_home_create(g_dash_tabs[0]); // Re-create home tab with latest grid
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
