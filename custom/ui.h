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
  lv_obj_t *scr = lv_scr_act();
  lv_obj_set_style_bg_color(scr, lv_color_hex(0x1a1a2e), LV_STATE_DEFAULT);
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

  // ── Top bar ──────────────────────────────────────────────────────────────
  lv_obj_t *topbar = lv_obj_create(scr);
  lv_obj_set_pos(topbar, 0, 0);
  lv_obj_set_size(topbar, 800, 44);
  lv_obj_set_style_bg_color(topbar, lv_color_hex(0x12122a), LV_STATE_DEFAULT);
  lv_obj_set_style_border_width(topbar, 0, LV_STATE_DEFAULT);
  lv_obj_set_style_radius(topbar, 0, LV_STATE_DEFAULT);
  lv_obj_set_style_pad_all(topbar, 0, LV_STATE_DEFAULT);
  lv_obj_clear_flag(topbar, LV_OBJ_FLAG_SCROLLABLE);

  lv_obj_t *title = lv_label_create(topbar);
  lv_label_set_text(title, "ESP32 Display");
  lv_obj_align(title, LV_ALIGN_LEFT_MID, 12, 0);
  lv_obj_set_style_text_font(title, &lv_font_montserrat_24, LV_STATE_DEFAULT);
  lv_obj_set_style_text_color(title, lv_color_hex(0xa78bfa), LV_STATE_DEFAULT);

  g_status_label = lv_label_create(topbar);
  lv_label_set_text(g_status_label, "Connecting...");
  lv_obj_align(g_status_label, LV_ALIGN_RIGHT_MID, -12, 0);
  lv_obj_set_style_text_font(g_status_label, &lv_font_montserrat_24, LV_STATE_DEFAULT);
  lv_obj_set_style_text_color(g_status_label, lv_color_hex(0xffaa00), LV_STATE_DEFAULT);

  // ── Left panel — network list ─────────────────────────────────────────────
  lv_obj_t *left = _make_panel(scr, 8, 52, 400, 420);
  lv_obj_set_style_pad_all(left, 6, LV_STATE_DEFAULT);

  _make_btn(left, "Scan", 4, 4, 100, 40, _cb_scan);

  g_network_list = lv_obj_create(left);
  lv_obj_set_pos(g_network_list, 0, 52);
  lv_obj_set_size(g_network_list, 388, 360);
  lv_obj_set_style_bg_color(g_network_list, lv_color_hex(0x0d0d1f), LV_STATE_DEFAULT);
  lv_obj_set_style_border_width(g_network_list, 0, LV_STATE_DEFAULT);
  lv_obj_set_style_pad_all(g_network_list, 4, LV_STATE_DEFAULT);
  lv_obj_set_style_radius(g_network_list, 4, LV_STATE_DEFAULT);

  // ── Right panel — credentials + keyboard ─────────────────────────────────
  lv_obj_t *right = _make_panel(scr, 416, 52, 376, 420);

  _make_label(right, "SSID", 4, 4, 0x94a3b8);
  g_ssid_ta = _make_textarea(right, "", 4, 32, 360, 48);

  _make_label(right, "Password", 4, 92, 0x94a3b8);
  g_password_ta = _make_textarea(right, "", 4, 120, 360, 48);
  lv_textarea_set_password_mode(g_password_ta, true);

  _make_btn(right, "Kbd", 296, 178, 68, 40, _cb_keyboard_toggle);
  _make_btn(right, "Connect", 4, 178, 160, 40, _cb_connect);

  g_keyboard = lv_keyboard_create(right);
  lv_obj_set_pos(g_keyboard, 0, 226);
  lv_obj_set_size(g_keyboard, 368, 180);
  lv_keyboard_set_textarea(g_keyboard, g_ssid_ta);
  lv_obj_add_flag(g_keyboard, LV_OBJ_FLAG_HIDDEN);

  // auto-scan on boot
  wifi_scan_and_populate(g_network_list, g_ssid_ta);
}
