#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "version_info.h"
#include <cstdio>
#include <esp_timer.h>
#include <esp_wifi.h>

// ── SETTINGS TAB ─────────────────────────────────────────────────────────────
// Content area: 800×352

#define TAB_SETTINGS_BG   0x0e0e0e
#define TAB_SETTINGS_CARD 0x1a1a1a

// ── Globals ───────────────────────────────────────────────────────────────────
static lv_obj_t *g_set_ip_val         = nullptr;
static lv_obj_t *g_set_uptime_val     = nullptr;
static lv_obj_t *g_set_net_val        = nullptr;
static lv_obj_t *g_set_ssid_val       = nullptr;
static lv_obj_t *g_set_ap_ssid_val    = nullptr;
static lv_obj_t *g_set_ap_dot         = nullptr;
static lv_obj_t *g_set_ap_status_val  = nullptr;

// ── Row helper ────────────────────────────────────────────────────────────────
static lv_obj_t *_settings_row(lv_obj_t *parent, const char *label, const char *value,
                                int y, uint32_t bg) {
    lv_obj_t *lbl = lv_label_create(parent);
    lv_label_set_text(lbl, label);
    lv_obj_set_style_text_color(lbl, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    _lbl_bg(lbl, bg);
    lv_obj_set_pos(lbl, 20, y);
    lv_obj_set_width(lbl, 180);

    lv_obj_t *val = lv_label_create(parent);
    lv_label_set_text(val, value);
    lv_obj_set_style_text_color(val, lv_color_hex(0xdddddd), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(val, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    _lbl_bg(val, bg);
    lv_obj_set_pos(val, 210, y);
    lv_obj_set_width(val, 380);

    return val;
}

// ── Thin separator helper ─────────────────────────────────────────────────────
static void _settings_sep(lv_obj_t *parent, int y, uint32_t color = 0x2a2a2a) {
    lv_obj_t *s = lv_obj_create(parent);
    lv_obj_set_pos(s, 0, y);
    lv_obj_set_size(s, 420, 1);
    lv_obj_set_style_bg_color(s, lv_color_hex(color), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(s, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(s);
}

static void tab_settings_create(lv_obj_t *parent) {

    // ── Left column: device + AP info ────────────────────────────────────────
    // Increased height to 326 to fit AP section
    lv_obj_t *card = _make_card(parent, 16, 16, 456, 326, TAB_SETTINGS_CARD);

    _section_hdr(card, "DEVICE INFO", 0, 0, TAB_SETTINGS_CARD);
    _settings_sep(card, 22);

    _settings_row(card, "Firmware",   FW_VERSION_STR,  34, TAB_SETTINGS_CARD);
    g_set_ip_val  = _settings_row(card, "IP Address", "---",       66, TAB_SETTINGS_CARD);
    g_set_net_val = _settings_row(card, "WiFi",       "---",       98, TAB_SETTINGS_CARD);
    g_set_ssid_val= _settings_row(card, "SSID",       "---",      130, TAB_SETTINGS_CARD);
    g_set_uptime_val=_settings_row(card,"Uptime",     "---",      162, TAB_SETTINGS_CARD);

    // ── AP section ───────────────────────────────────────────────────────────
    _settings_sep(card, 196, 0x333333);
    _section_hdr(card, "ACCESS POINT", 0, 206, TAB_SETTINGS_CARD);
    _settings_sep(card, 224, 0x2a2a2a);

    // AP SSID row — read once at create time from ESP-IDF
    {
        char ap_ssid[33] = "ESP32-Display-AP";
        wifi_config_t cfg;
        if (esp_wifi_get_config(WIFI_IF_AP, &cfg) == ESP_OK && cfg.ap.ssid[0])
            snprintf(ap_ssid, sizeof(ap_ssid), "%s", (char *)cfg.ap.ssid);
        g_set_ap_ssid_val = _settings_row(card, "AP SSID", ap_ssid, 234, TAB_SETTINGS_CARD);
    }

    // AP Status row — label + colored dot + value text
    lv_obj_t *ap_lbl = lv_label_create(card);
    lv_label_set_text(ap_lbl, "Status");
    lv_obj_set_style_text_color(ap_lbl, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(ap_lbl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    _lbl_bg(ap_lbl, TAB_SETTINGS_CARD);
    lv_obj_set_pos(ap_lbl, 20, 268);
    lv_obj_set_width(ap_lbl, 180);

    // Dot indicator (green = active, gray = inactive)
    g_set_ap_dot = lv_obj_create(card);
    lv_obj_set_size(g_set_ap_dot, 10, 10);
    lv_obj_set_style_radius(g_set_ap_dot, LV_RADIUS_CIRCLE, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(g_set_ap_dot, lv_color_hex(0x555555), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_set_ap_dot, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(g_set_ap_dot);
    lv_obj_set_pos(g_set_ap_dot, 210, 273);   // vertically centered on 18pt text

    g_set_ap_status_val = lv_label_create(card);
    lv_label_set_text(g_set_ap_status_val, "---");
    lv_obj_set_style_text_color(g_set_ap_status_val, lv_color_hex(0x555555), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_set_ap_status_val, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    _lbl_bg(g_set_ap_status_val, TAB_SETTINGS_CARD);
    lv_obj_set_pos(g_set_ap_status_val, 226, 268);   // 10px dot + 6px gap
    lv_obj_set_width(g_set_ap_status_val, 200);

    // ── Right column ─────────────────────────────────────────────────────────
    lv_obj_t *card2 = _make_card(parent, 488, 16, 296, 168, TAB_SETTINGS_CARD);
    _section_hdr(card2, "DISPLAY", 0, 0, TAB_SETTINGS_CARD);

    lv_obj_t *hint = lv_label_create(card2);
    lv_label_set_text(hint,
        "800 x 480\n"
        "RGB565 Parallel\n"
        "18 MHz PCLK\n"
        "GT911 Touch");
    lv_obj_set_style_text_color(hint, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(hint, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    lv_obj_set_style_text_line_space(hint, 6, LV_STATE_DEFAULT);
    _lbl_bg(hint, TAB_SETTINGS_CARD);
    lv_obj_set_pos(hint, 0, 28);

    lv_obj_t *card3 = _make_card(parent, 488, 190, 296, 158, TAB_SETTINGS_CARD);
    _section_hdr(card3, "FRAMEWORK", 0, 0, TAB_SETTINGS_CARD);

    lv_obj_t *fwinfo = lv_label_create(card3);
    lv_label_set_text(fwinfo,
        "ESPHome  2024+\n"
        "LVGL  8.4.0\n"
        "ESP-IDF  5.x\n"
        "little_endian color");
    lv_obj_set_style_text_color(fwinfo, lv_color_hex(0x888888), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(fwinfo, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    lv_obj_set_style_text_line_space(fwinfo, 6, LV_STATE_DEFAULT);
    _lbl_bg(fwinfo, TAB_SETTINGS_CARD);
    lv_obj_set_pos(fwinfo, 0, 28);
}

// ── Tick: called every second ─────────────────────────────────────────────────
static void tab_settings_tick() {
    if (!g_set_uptime_val) return;

    char buf[48];

    // Uptime
    uint64_t us  = esp_timer_get_time();
    uint32_t tot = (uint32_t)(us / 1000000ULL);
    uint32_t h   = tot / 3600;
    uint32_t m   = (tot % 3600) / 60;
    uint32_t s   = tot % 60;
    snprintf(buf, sizeof(buf), "%uh %02um %02us", h, m, s);
    lv_label_set_text(g_set_uptime_val, buf);

    // Connected WiFi SSID
    if (g_set_ssid_val) {
        wifi_ap_record_t sta;
        if (esp_wifi_sta_get_ap_info(&sta) == ESP_OK && sta.ssid[0])
            lv_label_set_text(g_set_ssid_val, (char *)sta.ssid);
        else
            lv_label_set_text(g_set_ssid_val, "---");
    }

    // AP status + client count
    if (g_set_ap_dot && g_set_ap_status_val) {
        wifi_mode_t mode;
        bool ap_on = (esp_wifi_get_mode(&mode) == ESP_OK) &&
                     (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA);

        lv_obj_set_style_bg_color(g_set_ap_dot,
            lv_color_hex(ap_on ? 0x00cc44 : 0x555555), LV_STATE_DEFAULT);

        if (ap_on) {
            wifi_sta_list_t sl = {};
            esp_wifi_ap_get_sta_list(&sl);
            if (sl.num == 0)
                snprintf(buf, sizeof(buf), "Active");
            else
                snprintf(buf, sizeof(buf), "Active  %d client%s",
                         sl.num, sl.num == 1 ? "" : "s");
            lv_obj_set_style_text_color(g_set_ap_status_val,
                lv_color_hex(0x00cc44), LV_STATE_DEFAULT);
        } else {
            snprintf(buf, sizeof(buf), "Inactive");
            lv_obj_set_style_text_color(g_set_ap_status_val,
                lv_color_hex(0x666666), LV_STATE_DEFAULT);
        }
        lv_label_set_text(g_set_ap_status_val, buf);
    }
}

// ── Public API ────────────────────────────────────────────────────────────────
static void tab_settings_set_ip(const char *ip) {
    if (g_set_ip_val)
        lv_label_set_text(g_set_ip_val, (ip && ip[0]) ? ip : "---");
}

static void tab_settings_set_network(const char *status) {
    if (g_set_net_val)
        lv_label_set_text(g_set_net_val, status);
}
