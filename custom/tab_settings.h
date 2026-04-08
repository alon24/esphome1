#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include "version_info.h"
#include "screensaver.h"
#include "esphome/core/log.h"
#include <cstdio>
#include <esp_timer.h>
#include <esp_wifi.h>

#define TAB_SETTINGS_BG   0x0e0e0e
#define TAB_SETTINGS_CARD 0x1a1a1a

static lv_obj_t *g_set_ip_val         = nullptr;
static lv_obj_t *g_set_uptime_val     = nullptr;
static lv_obj_t *g_set_ssid_val       = nullptr;

static lv_obj_t *_settings_row(lv_obj_t *parent, const char *label, const char *value, int y, uint32_t bg) {
    lv_obj_t *lbl = lv_label_create(parent);
    lv_label_set_text(lbl, label);
    lv_obj_set_style_text_color(lbl, lv_color_hex(0x888888), 0);
    lv_obj_set_pos(lbl, 20, y);
    lv_obj_t *val = lv_label_create(parent);
    lv_label_set_text(val, value);
    lv_obj_set_style_text_color(val, lv_color_hex(0xdddddd), 0);
    lv_obj_set_pos(val, 210, y);
    return val;
}

static void tab_settings_create(lv_obj_t *parent) {

    lv_obj_t *card = _make_card(parent, 10, 10, 620, 396, TAB_SETTINGS_CARD);
    _section_hdr(card, "SYSTEM INFORMATION", 0, 0, TAB_SETTINGS_CARD);

    _settings_row(card, "Firmware", FW_VERSION_STR, 40, TAB_SETTINGS_CARD);
    g_set_ip_val = _settings_row(card, "IP Address", "---", 70, TAB_SETTINGS_CARD);
    g_set_ssid_val = _settings_row(card, "Network", "---", 100, TAB_SETTINGS_CARD);
    g_set_uptime_val = _settings_row(card, "System Uptime", "---", 130, TAB_SETTINGS_CARD);

    lv_obj_t *hint = lv_label_create(card);
    lv_label_set_text(hint, "Sidebar navigation active. System status verified.");
    lv_obj_set_style_text_color(hint, lv_color_hex(0x666666), 0);
    lv_obj_set_pos(hint, 20, 340);

    lv_obj_set_size(parent, 640, 416); 
    lv_obj_add_flag(parent, LV_OBJ_FLAG_SCROLLABLE);
}

static void tab_settings_tick() {
    if (!g_set_uptime_val) return;
    char buf[32];
    uint32_t tot = (uint32_t)(esp_timer_get_time() / 1000000ULL);
    snprintf(buf, sizeof(buf), "%uh %02um %02us", tot/3600, (tot%3600)/60, tot%60);
    lv_label_set_text(g_set_uptime_val, buf);

    if (g_set_ssid_val) {
        wifi_ap_record_t sta;
        if (esp_wifi_sta_get_ap_info(&sta) == ESP_OK) lv_label_set_text(g_set_ssid_val, (char*)sta.ssid);
    }
}

static void tab_settings_set_ip(const char *ip) { if (g_set_ip_val) lv_label_set_text(g_set_ip_val, ip ? ip : "---"); }
static void tab_settings_set_network(const char *st) { }
