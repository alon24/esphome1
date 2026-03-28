#pragma once

// ── Screen test patterns ───────────────────────────────────────────────────
// Each test works for any screen size using lv_disp_get_hor/ver_res.

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
  // Top & bottom edges
  for (int x = x1; x <= x2; x += dash) {
    int w = (x + dash - 1 <= x2) ? dash : (x2 - x + 1);
    uint32_t col = ((x - x1) / dash) % 2 == 0 ? c1 : c2;
    make_seg(x, y1, w, 2, col);
    make_seg(x, y2, w, 2, col);
  }
  // Left & right edges (skip corners already drawn)
  for (int y = y1 + 2; y <= y2 - 2; y += dash) {
    int h = (y + dash - 1 <= y2 - 2) ? dash : (y2 - 2 - y + 1);
    uint32_t col = ((y - y1) / dash) % 2 == 0 ? c1 : c2;
    make_seg(x1, y, 2, h, col);
    make_seg(x2, y, 2, h, col);
  }
}

// ── Test 1: concentric dashed rectangles + "1" in centre ──────────────────
static void screen_test_1() {
  lv_obj_t *scr = lv_scr_act();
  lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);
  lv_obj_set_style_bg_color(scr, lv_color_hex(0x0a0a14), LV_STATE_DEFAULT);
  lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, LV_STATE_DEFAULT);

  lv_disp_t *disp = lv_disp_get_default();
  int W = lv_disp_get_hor_res(disp);
  int H = lv_disp_get_ver_res(disp);

  struct { int inset; uint32_t c1; uint32_t c2; } rects[] = {
    {0,  0xFFFF00, 0xFF00FF},  // yellow / magenta
    {5,  0x00FFFF, 0xFF4400},  // cyan   / orange
    {10, 0x00FF44, 0xFF0088},  // lime   / pink
    {20, 0xFFFFFF, 0x4444FF},  // white  / blue
    {40, 0xFF8800, 0x00FFFF},  // orange / cyan
    {80, 0xFF00FF, 0xFFFF00},  // magenta/ yellow
  };
  for (auto &r : rects)
    _draw_dashed_rect(scr, r.inset, r.inset, W - 1 - r.inset, H - 1 - r.inset,
                      r.c1, r.c2, 12);

  // ── Resolution label (bottom-left) ────────────────────────────────────
  char res[24];
  snprintf(res, sizeof(res), "%dx%d", W, H);
  lv_obj_t *res_lbl = lv_label_create(scr);
  lv_label_set_text(res_lbl, res);
  lv_obj_set_pos(res_lbl, 90, H / 2 + 30);
  lv_obj_set_style_text_color(res_lbl, lv_color_hex(0xaaaaaa), LV_STATE_DEFAULT);
  lv_obj_set_style_text_font(res_lbl, &lv_font_montserrat_24, LV_STATE_DEFAULT);

  // ── Large "1" in the centre ────────────────────────────────────────────
  lv_obj_t *num = lv_label_create(scr);
  lv_label_set_text(num, "1");
  lv_obj_set_style_text_font(num, &lv_font_montserrat_48, LV_STATE_DEFAULT);
  lv_obj_set_style_text_color(num, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
  lv_obj_align(num, LV_ALIGN_CENTER, 0, 0);
}
