#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
#include <cstdio>
#include <esp_timer.h>

// ── HOME TAB ──────────────────────────────────────────────────────────────────
// Content area: 800×352 (parent is the home content container)
// Shows live clock, date, uptime.

static lv_obj_t *g_home_time_lbl    = nullptr;
static lv_obj_t *g_home_date_lbl    = nullptr;
static lv_obj_t *g_home_uptime_lbl  = nullptr;
static lv_obj_t *g_home_status_lbl  = nullptr;

static const char *HOME_DAYS[]   = { "Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday" };
static const char *HOME_MONTHS[] = { "","January","February","March","April","May",
                                     "June","July","August","September","October","November","December" };

#define TAB_HOME_BG 0x0e0e0e

static void tab_home_create(lv_obj_t *parent) {
    // parent is already a plain dark 800×352 panel created by maindashboard

    // ── Section title ────────────────────────────────────────────────────────
    lv_obj_t *title = lv_label_create(parent);
    lv_label_set_text(title, "SYSTEM TIME");
    lv_obj_set_style_text_color(title, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(title, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    lv_obj_set_style_text_letter_space(title, 3, LV_STATE_DEFAULT);
    _lbl_bg(title, TAB_HOME_BG);
    lv_obj_set_width(title, 800);
    lv_obj_set_style_text_align(title, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    lv_obj_set_pos(title, 0, 22);

    // ── Large clock ──────────────────────────────────────────────────────────
    g_home_time_lbl = lv_label_create(parent);
    lv_label_set_text(g_home_time_lbl, "--:--:--");
    lv_obj_set_style_text_color(g_home_time_lbl, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_home_time_lbl, &lv_font_montserrat_48, LV_STATE_DEFAULT);
    _lbl_bg(g_home_time_lbl, TAB_HOME_BG);
    lv_obj_set_width(g_home_time_lbl, 800);
    lv_obj_set_style_text_align(g_home_time_lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    lv_obj_set_pos(g_home_time_lbl, 0, 60);

    // ── Date string ──────────────────────────────────────────────────────────
    g_home_date_lbl = lv_label_create(parent);
    lv_label_set_text(g_home_date_lbl, "Syncing...");
    lv_obj_set_style_text_color(g_home_date_lbl, lv_color_hex(0xadaaaa), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_home_date_lbl, &lv_font_montserrat_22, LV_STATE_DEFAULT);
    _lbl_bg(g_home_date_lbl, TAB_HOME_BG);
    lv_obj_set_width(g_home_date_lbl, 800);
    lv_obj_set_style_text_align(g_home_date_lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    lv_obj_set_pos(g_home_date_lbl, 0, 138);

    // ── Separator ────────────────────────────────────────────────────────────
    lv_obj_t *sep = lv_obj_create(parent);
    lv_obj_set_pos(sep, 40, 178);
    lv_obj_set_size(sep, 720, 1);
    lv_obj_set_style_bg_color(sep, lv_color_hex(0x2a2a2a), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(sep, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(sep);

    // ── Uptime ───────────────────────────────────────────────────────────────
    g_home_uptime_lbl = lv_label_create(parent);
    lv_label_set_text(g_home_uptime_lbl, "Uptime  --");
    lv_obj_set_style_text_color(g_home_uptime_lbl, lv_color_hex(0x666666), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_home_uptime_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(g_home_uptime_lbl, TAB_HOME_BG);
    lv_obj_set_width(g_home_uptime_lbl, 800);
    lv_obj_set_style_text_align(g_home_uptime_lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    lv_obj_set_pos(g_home_uptime_lbl, 0, 200);

    // ── Network status (updated from maindashboard) ──────────────────────────
    g_home_status_lbl = lv_label_create(parent);
    lv_label_set_text(g_home_status_lbl, "Network  --");
    lv_obj_set_style_text_color(g_home_status_lbl, lv_color_hex(0x666666), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_home_status_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(g_home_status_lbl, TAB_HOME_BG);
    lv_obj_set_width(g_home_status_lbl, 800);
    lv_obj_set_style_text_align(g_home_status_lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    lv_obj_set_pos(g_home_status_lbl, 0, 224);
}

// Called every second from device.yaml interval
// dow: 1=Sunday … 7=Saturday (ESPHome convention); pass -1 when SNTP not yet valid
static void tab_home_tick(int h, int m, int s, int dom, int mon, int year, int dow) {
    if (!g_home_time_lbl) return;

    char buf[64];

    // Clock
    if (h >= 0) {
        snprintf(buf, sizeof(buf), "%02d:%02d:%02d", h, m, s);
        lv_label_set_text(g_home_time_lbl, buf);

        if (dow >= 1 && dow <= 7 && mon >= 1 && mon <= 12)
            snprintf(buf, sizeof(buf), "%s, %d %s %d",
                     HOME_DAYS[dow - 1], dom, HOME_MONTHS[mon], year);
        else
            snprintf(buf, sizeof(buf), "--");
        lv_label_set_text(g_home_date_lbl, buf);
    } else {
        lv_label_set_text(g_home_time_lbl, "--:--:--");
        lv_label_set_text(g_home_date_lbl, "Syncing time...");
    }

    // Uptime from ESP timer (avoids drift from missed ticks)
    uint64_t us   = esp_timer_get_time();
    uint32_t tot  = (uint32_t)(us / 1000000ULL);
    uint32_t uh   = tot / 3600;
    uint32_t um   = (tot % 3600) / 60;
    uint32_t usec = tot % 60;
    snprintf(buf, sizeof(buf), "Uptime  %uh %02um %02us", uh, um, usec);
    lv_label_set_text(g_home_uptime_lbl, buf);
}

// Called by maindashboard when IP / connection state changes
static void tab_home_set_network(const char *text) {
    if (g_home_status_lbl)
        lv_label_set_text(g_home_status_lbl, text);
}
