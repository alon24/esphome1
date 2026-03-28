#pragma once
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include "wifi_setup.h"
#include "screen_tests.h"

// ── Global widget pointers ─────────────────────────────────────────────────
static lv_obj_t *g_network_list  = nullptr;
static lv_obj_t *g_ssid_ta       = nullptr;
static lv_obj_t *g_password_ta   = nullptr;
static lv_obj_t *g_status_label  = nullptr;
static lv_obj_t *g_keyboard      = nullptr;

// ── Status helpers (called from yaml on_connect / on_disconnect) ───────────
static void ui_set_connected(const char *ip = nullptr) {
  if (!g_status_label) return;
  char buf[48];
  if (ip && ip[0] != '\0')
    snprintf(buf, sizeof(buf), "Connected: %s", ip);
  else
    snprintf(buf, sizeof(buf), "Connected");
  lv_label_set_text(g_status_label, buf);
  lv_obj_set_style_text_color(g_status_label, lv_color_hex(0x00ff88), LV_STATE_DEFAULT);
}

static void ui_set_disconnected() {
  if (!g_status_label) return;
  lv_label_set_text(g_status_label, "Disconnected");
  lv_obj_set_style_text_color(g_status_label, lv_color_hex(0xff4444), LV_STATE_DEFAULT);
}

// ── Event callbacks ────────────────────────────────────────────────────────
static void _cb_scan(lv_event_t *) {
  wifi_scan_and_populate(g_network_list, g_ssid_ta);
}

static void _cb_keyboard_toggle(lv_event_t *) {
  if (!g_keyboard) return;
  // Read actual LVGL state — never rely on a stale variable
  if (lv_obj_has_flag(g_keyboard, LV_OBJ_FLAG_HIDDEN))
    lv_obj_clear_flag(g_keyboard, LV_OBJ_FLAG_HIDDEN);
  else
    lv_obj_add_flag(g_keyboard, LV_OBJ_FLAG_HIDDEN);
}

static void _cb_connect(lv_event_t *) {
  if (g_status_label) {
    lv_label_set_text(g_status_label, "Connecting...");
    lv_obj_set_style_text_color(g_status_label, lv_color_hex(0xffaa00), LV_STATE_DEFAULT);
  }
  wifi_connect_from_ui(g_ssid_ta, g_password_ta);
}

static void _cb_textarea_focus(lv_event_t *e) {
  lv_obj_t *ta = (lv_obj_t *)lv_event_get_target(e);
  lv_keyboard_set_textarea(g_keyboard, ta);
  // Always show keyboard when a textarea is tapped
  lv_obj_clear_flag(g_keyboard, LV_OBJ_FLAG_HIDDEN);
}

// ── Helpers ────────────────────────────────────────────────────────────────
static lv_obj_t *_make_panel(lv_obj_t *parent, lv_coord_t x, lv_coord_t y,
                              lv_coord_t w, lv_coord_t h) {
  lv_obj_t *p = lv_obj_create(parent);
  lv_obj_set_pos(p, x, y);
  lv_obj_set_size(p, w, h);
  lv_obj_set_style_bg_color(p, lv_color_hex(0x12122a), LV_STATE_DEFAULT);
  lv_obj_set_style_border_color(p, lv_color_hex(0x334499), LV_STATE_DEFAULT);
  lv_obj_set_style_border_width(p, 1, LV_STATE_DEFAULT);
  lv_obj_set_style_radius(p, 6, LV_STATE_DEFAULT);
  lv_obj_set_style_pad_all(p, 8, LV_STATE_DEFAULT);
  lv_obj_clear_flag(p, LV_OBJ_FLAG_SCROLLABLE);
  return p;
}

static lv_obj_t *_make_label(lv_obj_t *parent, const char *text,
                              lv_coord_t x, lv_coord_t y, uint32_t color) {
  lv_obj_t *l = lv_label_create(parent);
  lv_label_set_text(l, text);
  lv_obj_set_pos(l, x, y);
  lv_obj_set_style_text_color(l, lv_color_hex(color), LV_STATE_DEFAULT);
  lv_obj_set_style_text_font(l, &lv_font_montserrat_24, LV_STATE_DEFAULT);
  return l;
}

static lv_obj_t *_make_btn(lv_obj_t *parent, const char *text,
                            lv_coord_t x, lv_coord_t y,
                            lv_coord_t w, lv_coord_t h,
                            lv_event_cb_t cb) {
  lv_obj_t *btn = lv_btn_create(parent);
  lv_obj_set_pos(btn, x, y);
  lv_obj_set_size(btn, w, h);
  if (cb) lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, nullptr);
  lv_obj_t *lbl = lv_label_create(btn);
  lv_label_set_text(lbl, text);
  lv_obj_align(lbl, LV_ALIGN_CENTER, 0, 0);
  lv_obj_set_style_text_font(lbl, &lv_font_montserrat_24, LV_STATE_DEFAULT);
  return btn;
}

static lv_obj_t *_make_textarea(lv_obj_t *parent, const char *initial,
                                 lv_coord_t x, lv_coord_t y,
                                 lv_coord_t w, lv_coord_t h) {
  lv_obj_t *ta = lv_textarea_create(parent);
  lv_obj_set_pos(ta, x, y);
  lv_obj_set_size(ta, w, h);
  lv_textarea_set_one_line(ta, true);
  lv_textarea_set_text(ta, initial);
  lv_obj_set_style_text_font(ta, &lv_font_montserrat_24, LV_STATE_DEFAULT);
  lv_obj_add_event_cb(ta, _cb_textarea_focus, LV_EVENT_FOCUSED, nullptr);
  return ta;
}

// ── Main UI init — call once after LVGL is ready ───────────────────────────
static void ui_init() {
  _run_test(1);
  g_status_label = nullptr;
  g_network_list = nullptr;
  g_ssid_ta      = nullptr;
  g_password_ta  = nullptr;
  g_keyboard     = nullptr;
}
