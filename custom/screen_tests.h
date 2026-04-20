#pragma once

// ── Screen test framework ──────────────────────────────────────────────────
// Tap the centre of the screen to advance to the next test.

static int g_current_test = 1;
static const int NUM_TESTS = 2;

// Forward declarations
static void _run_test(int n);
static void _add_test_nav();

static void _cb_next_test(lv_event_t *) {
  g_current_test = (g_current_test % NUM_TESTS) + 1;
  lv_obj_clean(lv_screen_active());
  _run_test(g_current_test);
}

static void _add_test_nav() {
  lv_disp_t *disp = lv_disp_get_default();
  int W = lv_disp_get_hor_res(disp);
  int H = lv_disp_get_ver_res(disp);
  // Invisible 160×160 touch area in the centre
  lv_obj_t *btn = lv_button_create(lv_screen_active());
  lv_obj_set_pos(btn, W / 2 - 80, H / 2 - 80);
  lv_obj_set_size(btn, 160, 160);
  lv_obj_set_style_bg_opa(btn, LV_OPA_TRANSP, LV_STATE_DEFAULT);
  lv_obj_set_style_border_width(btn, 0, LV_STATE_DEFAULT);
  lv_obj_set_style_shadow_width(btn, 0, LV_STATE_DEFAULT);
  lv_obj_add_event_cb(btn, _cb_next_test, LV_EVENT_CLICKED, nullptr);
}

// ── Helpers ────────────────────────────────────────────────────────────────
static void _draw_dashed_rect(lv_obj_t *scr,
                               int x1, int y1, int x2, int y2,
                               uint32_t c1, uint32_t c2, int dash) {
  auto make_seg = [&](int x, int y, int w, int h, uint32_t col) {
    lv_obj_t *s = lv_obj_create(scr);
    lv_obj_set_pos(s, x, y);
    lv_obj_set_size(s, w, h);
    lv_obj_set_style_bg_color(s, lv_color_hex(col), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(s, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(s, 0, LV_STATE_DEFAULT);
    lv_obj_clear_flag(s, LV_OBJ_FLAG_SCROLLABLE | LV_OBJ_FLAG_CLICKABLE);
  };
  for (int x = x1; x <= x2; x += dash) {
    int w = (x + dash - 1 <= x2) ? dash : (x2 - x + 1);
    uint32_t col = ((x - x1) / dash) % 2 == 0 ? c1 : c2;
    make_seg(x, y1, w, 2, col);
    make_seg(x, y2, w, 2, col);
  }
  for (int y = y1 + 2; y <= y2 - 2; y += dash) {
    int h = (y + dash - 1 <= y2 - 2) ? dash : (y2 - 2 - y + 1);
    uint32_t col = ((y - y1) / dash) % 2 == 0 ? c1 : c2;
    make_seg(x1, y, 2, h, col);
    make_seg(x2, y, 2, h, col);
  }
}


// ── Test 1: concentric dashed rectangles ──────────────────────────────────
static void screen_test_1() {
  lv_obj_t *scr = lv_screen_active();
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(scr, lv_color_hex(0x0a0a14), LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, LV_STATE_DEFAULT);

  lv_disp_t *disp = lv_disp_get_default();
  int W = lv_disp_get_hor_res(disp);
  int H = lv_disp_get_ver_res(disp);

  struct { int inset; uint32_t c1; uint32_t c2; } rects[] = {
    {0,  0xFFFF00, 0xFF00FF},
    {5,  0x00FFFF, 0xFF4400},
    {10, 0x00FF44, 0xFF0088},
    {20, 0xFFFFFF, 0x4444FF},
    {40, 0xFF8800, 0x00FFFF},
    {80, 0xFF00FF, 0xFFFF00},
  };
  for (auto &r : rects)
    _draw_dashed_rect(scr, r.inset, r.inset, W - 1 - r.inset, H - 1 - r.inset,
                      r.c1, r.c2, 12);

  // Resolution label — bottom left
  char res[24];
  snprintf(res, sizeof(res), "%dx%d", W, H);
  lv_obj_t *res_lbl = lv_label_create(scr);
  lv_label_set_text(res_lbl, res);
  lv_obj_set_pos(res_lbl, 0, H / 2 - 12);
  lv_obj_set_width(res_lbl, W);
  lv_label_set_long_mode(res_lbl, LV_LABEL_LONG_DOT);
  lv_obj_set_style_text_font(res_lbl, &lv_font_montserrat_24, LV_STATE_DEFAULT);
  lv_obj_set_style_text_color(res_lbl, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
  lv_obj_set_style_text_align(res_lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
  lv_obj_set_style_bg_color(res_lbl, lv_color_hex(0x0a0a14), LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(res_lbl, LV_OPA_COVER, LV_STATE_DEFAULT);
  lv_obj_set_style_pad_ver(res_lbl, 4, LV_STATE_DEFAULT);
}

// ── Test 2: text at growing font sizes (8–40, stops if off-screen) ────────
static void screen_test_2() {
  lv_obj_t *scr = lv_screen_active();
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(scr, lv_color_hex(0x0a0a14), LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, LV_STATE_DEFAULT);

  int H = lv_disp_get_ver_res(lv_disp_get_default());

  struct { int sz; const lv_font_t *font; } rows[] = {
    { 8,  &lv_font_montserrat_8  },
    { 10, &lv_font_montserrat_10 },
    { 12, &lv_font_montserrat_12 },
    { 14, &lv_font_montserrat_14 },
    { 16, &lv_font_montserrat_16 },
    { 18, &lv_font_montserrat_18 },
    { 20, &lv_font_montserrat_20 },
    { 22, &lv_font_montserrat_22 },
    { 24, &lv_font_montserrat_24 },
    { 26, &lv_font_montserrat_26 },
    { 28, &lv_font_montserrat_28 },
    { 30, &lv_font_montserrat_30 },
    { 32, &lv_font_montserrat_32 },
    { 34, &lv_font_montserrat_34 },
    { 36, &lv_font_montserrat_36 },
    { 38, &lv_font_montserrat_38 },
    { 40, &lv_font_montserrat_40 },
  };

  int W = lv_disp_get_hor_res(lv_disp_get_default());
  lv_coord_t y = 0;
  for (auto &r : rows) {
    if (y + r.sz > H) break;
    char buf[128];
    snprintf(buf, sizeof(buf), "sz%d AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz 0123456789", r.sz);
    lv_obj_t *lbl = lv_label_create(scr);
    lv_label_set_text(lbl, buf);
    lv_obj_set_pos(lbl, 0, y);
    lv_obj_set_width(lbl, W);
    lv_label_set_long_mode(lbl, LV_LABEL_LONG_DOT);
    lv_obj_set_style_text_font(lbl, r.font, LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(lbl, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    y += r.sz + 2;
  }
}

// ── Dispatcher ────────────────────────────────────────────────────────────
static void _run_test(int n) {
  if (n == 1) screen_test_1();
  else if (n == 2) screen_test_2();
  _add_test_nav();
}
