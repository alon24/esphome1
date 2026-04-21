#pragma once
#include "lvgl.h"

// ── Stubs for dashboard functions called from device.yaml lambdas ─────────────
static inline void ui_set_connected(const char * = nullptr) {}
static inline void ui_set_disconnected() {}
static inline void dashboard_tick(int, int, int, int, int, int, int) {}

// ── TEST SCREEN (test4) ───────────────────────────────────────────────────────
// Layout (800×480):
//   Header   y=0   h=50   — 3 colour blocks (anti-alias bleed check)
//   Textarea y=50  h=52   — always visible input, DIRECT child of scr
//   Scroll   y=102 h=128  — content rows to verify vertical scroll
//   Button   y=230 h=50   — SHOW/HIDE keyboard — explicit toggle, always visible
//   Keyboard y=280 h=200  — shows on textarea focus, initially hidden
//
// Focus flow:
//   Tap textarea → LV_EVENT_FOCUSED  → _ta_event_cb shows keyboard
//   ✓ / ✗ key   → LV_EVENT_READY/CANCEL → _test_kb_hide()
//   Button press → explicit _test_kb_show() / _test_kb_hide()
//   Tap elsewhere→ LV_EVENT_DEFOCUSED → _ta_event_cb hides keyboard
//
// NOTE: lv_textarea has group_def=TRUE so it auto-joins the default LVGL group.
// With a touchscreen indev bound to that group, FOCUSED/DEFOCUSED fire on tap.

static lv_obj_t *g_test_kb         = nullptr;
static lv_obj_t *g_test_kb_btn_lbl = nullptr;
static lv_obj_t *g_test_ta         = nullptr;

// ── Show / hide helpers ───────────────────────────────────────────────────────

static void _test_kb_hide() {
    if (!g_test_kb) return;
    lv_keyboard_set_textarea(g_test_kb, nullptr);
    lv_obj_add_flag(g_test_kb, LV_OBJ_FLAG_HIDDEN);
    if (g_test_kb_btn_lbl) lv_label_set_text(g_test_kb_btn_lbl, "SHOW KEYBOARD");
    ESP_LOGI("KB", "keyboard hidden");
}

static void _test_kb_show() {
    if (!g_test_kb || !g_test_ta) return;
    lv_keyboard_set_textarea(g_test_kb, g_test_ta);
    lv_obj_clear_flag(g_test_kb, LV_OBJ_FLAG_HIDDEN);
    lv_obj_move_foreground(g_test_kb);
    if (g_test_kb_btn_lbl) lv_label_set_text(g_test_kb_btn_lbl, "HIDE KEYBOARD");
    ESP_LOGI("KB", "keyboard shown");
}

// ── Textarea focus callback — standard LVGL pattern ──────────────────────────
//
// On FOCUSED  : link keyboard ↔ textarea, show keyboard.
// On DEFOCUSED: unlink, hide keyboard.
//
// This version of LVGL (extra/widgets/keyboard) does NOT register any callback
// on the textarea inside lv_keyboard_set_textarea() — it only sets keyboard->ta
// and toggles LV_STATE_FOCUSED on the keyboard widget.  So there is no risk of
// an internally-added defocus-hide callback accumulating on the textarea.


static void _ta_event_cb(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    lv_obj_t       *kb   = (lv_obj_t *)lv_event_get_user_data(e);

    if (code == LV_EVENT_FOCUSED) {
        lv_keyboard_set_textarea(kb, lv_event_get_target(e));
        lv_obj_clear_flag(kb, LV_OBJ_FLAG_HIDDEN);
        lv_obj_move_foreground(kb);
        if (g_test_kb_btn_lbl) lv_label_set_text(g_test_kb_btn_lbl, "HIDE KEYBOARD");
        ESP_LOGI("KB", "textarea focused → keyboard shown");
    }
    if (code == LV_EVENT_DEFOCUSED) {
        lv_keyboard_set_textarea(kb, nullptr);
        lv_obj_add_flag(kb, LV_OBJ_FLAG_HIDDEN);
        if (g_test_kb_btn_lbl) lv_label_set_text(g_test_kb_btn_lbl, "SHOW KEYBOARD");
        ESP_LOGI("KB", "textarea defocused → keyboard hidden");
    }
}

// ── Screen builder ────────────────────────────────────────────────────────────

static void test_screen_create() {
    lv_obj_t *scr = lv_screen_active();
    lv_obj_set_style_bg_color(scr, lv_color_hex(0x111111), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

    // ── HEADER: 3 coloured blocks (y=0–50) ───────────────────────────────────
    const struct { uint32_t bg; const char *txt; int x; int w; } hdrs[] = {
        { 0xcc2222, "RED BG",   0,   267 },
        { 0x22aa44, "GREEN BG", 267, 266 },
        { 0x2255ee, "BLUE BG",  533, 267 },
    };
    for (int i = 0; i < 3; i++) {
        lv_obj_t *blk = lv_obj_create(scr);
        lv_obj_set_pos(blk, hdrs[i].x, 0);
        lv_obj_set_size(blk, hdrs[i].w, 50);
        uint32_t s[] = { LV_STATE_DEFAULT, LV_STATE_PRESSED, LV_STATE_FOCUSED };
        for (int j = 0; j < 3; j++) {
            lv_obj_set_style_bg_color(blk, lv_color_hex(hdrs[i].bg), s[j]);
            lv_obj_set_style_bg_opa(blk, LV_OPA_COVER, s[j]);
        }
        lv_obj_set_style_pad_all(blk, 0, LV_STATE_DEFAULT);
        lv_obj_set_style_radius(blk, 0, LV_STATE_DEFAULT);
        lv_obj_set_style_border_width(blk, 0, LV_STATE_DEFAULT);
        lv_obj_set_style_shadow_width(blk, 0, LV_STATE_DEFAULT);
        lv_obj_clear_flag(blk, LV_OBJ_FLAG_SCROLLABLE);

        lv_obj_t *lbl = lv_label_create(blk);
        lv_label_set_text(lbl, hdrs[i].txt);
        lv_obj_set_style_text_color(lbl, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_20, LV_STATE_DEFAULT);
        uint32_t ls[] = { LV_STATE_DEFAULT, LV_STATE_PRESSED, LV_STATE_FOCUSED, LV_STATE_FOCUS_KEY };
        for (int j = 0; j < 4; j++) {
            lv_obj_set_style_bg_color(lbl, lv_color_hex(hdrs[i].bg), ls[j]);
            lv_obj_set_style_bg_opa(lbl, LV_OPA_COVER, ls[j]);
        }
        lv_obj_set_style_border_width(lbl, 0, LV_STATE_DEFAULT);
        lv_obj_set_pos(lbl, 0, 14);
        lv_obj_set_width(lbl, hdrs[i].w);
        lv_obj_set_style_text_align(lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    }

    // ── TEXTAREA (y=50–102) — direct child of scr, always above keyboard ─────
    // lv_textarea has group_def=TRUE, so it auto-joins the default LVGL group.
    // The touchscreen indev fires LV_EVENT_FOCUSED when the user taps here.
    g_test_ta = lv_textarea_create(scr);
    lv_textarea_set_one_line(g_test_ta, true);
    lv_textarea_set_placeholder_text(g_test_ta, "Tap here to type...");
    lv_obj_set_pos(g_test_ta, 8, 54);
    lv_obj_set_size(g_test_ta, 784, 44);
    lv_obj_set_style_bg_color(g_test_ta, lv_color_hex(0x222222), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_test_ta, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(g_test_ta, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_test_ta, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(g_test_ta, lv_color_hex(0x00CED1), LV_STATE_FOCUSED);
    lv_obj_set_style_border_width(g_test_ta, 2, LV_STATE_FOCUSED);
    lv_obj_set_style_border_color(g_test_ta, lv_color_hex(0x444444), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(g_test_ta, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_test_ta, 6, LV_STATE_DEFAULT);
    lv_obj_set_scroll_dir(g_test_ta, LV_DIR_HOR);
    lv_obj_clear_flag(g_test_ta, LV_OBJ_FLAG_SCROLL_ON_FOCUS);

    // ── SCROLLABLE CONTENT (y=102–230) ───────────────────────────────────────
    lv_obj_t *scroll = lv_obj_create(scr);
    lv_obj_set_pos(scroll, 0, 102);
    lv_obj_set_size(scroll, 800, 128);
    lv_obj_set_style_bg_color(scroll, lv_color_hex(0x111111), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(scroll, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(scroll, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(scroll, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(scroll, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_width(scroll, 0, LV_STATE_DEFAULT);
    lv_obj_add_flag(scroll, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(scroll, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(scroll, LV_SCROLLBAR_MODE_ACTIVE);

    const char *rows[] = {
        "Row 1 — swipe to scroll",
        "Row 2", "Row 3", "Row 4", "Row 5",
        "Row 6", "Row 7", "Row 8 — end",
    };
    for (int i = 0; i < 8; i++) {
        lv_obj_t *rl = lv_label_create(scroll);
        lv_label_set_text(rl, rows[i]);
        lv_obj_set_style_text_color(rl, lv_color_hex(i == 7 ? 0x00CC44 : 0x888888), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(rl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
        lv_obj_set_style_bg_color(rl, lv_color_hex(0x111111), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(rl, LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_border_width(rl, 0, LV_STATE_DEFAULT);
        lv_obj_set_pos(rl, 16, 4 + i * 36);
    }

    // ── SHOW/HIDE KEYBOARD BUTTON (y=230–280) — always visible ───────────────
    lv_obj_t *btn = lv_button_create(scr);
    lv_obj_set_pos(btn, 0, 230);
    lv_obj_set_size(btn, 800, 50);
    lv_obj_set_style_bg_color(btn, lv_color_hex(0x1a0a2a), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(btn, lv_color_hex(0x2a1a3a), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, LV_STATE_PRESSED);
    lv_obj_set_style_radius(btn, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(btn, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_width(btn, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(btn, 0, LV_STATE_DEFAULT);

    g_test_kb_btn_lbl = lv_label_create(btn);
    lv_label_set_text(g_test_kb_btn_lbl, "SHOW KEYBOARD");
    lv_obj_set_style_text_color(g_test_kb_btn_lbl, lv_color_hex(0xAA77FF), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_test_kb_btn_lbl, &lv_font_montserrat_20, LV_STATE_DEFAULT);
    uint32_t bls[] = { LV_STATE_DEFAULT, LV_STATE_PRESSED, LV_STATE_FOCUSED, LV_STATE_FOCUS_KEY };
    for (int j = 0; j < 4; j++) {
        lv_obj_set_style_bg_color(g_test_kb_btn_lbl, lv_color_hex(0x1a0a2a), bls[j]);
        lv_obj_set_style_bg_opa(g_test_kb_btn_lbl, LV_OPA_COVER, bls[j]);
    }
    lv_obj_set_style_border_width(g_test_kb_btn_lbl, 0, LV_STATE_DEFAULT);
    lv_obj_center(g_test_kb_btn_lbl);

    lv_obj_add_event_cb(btn, [](lv_event_t *) {
        if (lv_obj_has_flag(g_test_kb, LV_OBJ_FLAG_HIDDEN))
            _test_kb_show();
        else
            _test_kb_hide();
    }, LV_EVENT_CLICKED, nullptr);

    // ── KEYBOARD (y=280–480) — child of scr, initially hidden ────────────────
    g_test_kb = lv_keyboard_create(scr);
    // lv_obj_set_pos(g_test_kb, 0, 280);
    lv_obj_set_size(g_test_kb, 800, 200);
    lv_obj_set_style_bg_color(g_test_kb, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_test_kb, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_test_kb, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_add_flag(g_test_kb, LV_OBJ_FLAG_HIDDEN);

    // ✓ / ✗ on keyboard → hide (lv_keyboard_def_event_cb on keyboard fires
    // LV_EVENT_READY / LV_EVENT_CANCEL for the OK and Close keys respectively)
    lv_obj_add_event_cb(g_test_kb, [](lv_event_t *) { _test_kb_hide(); }, LV_EVENT_READY,  nullptr);
    lv_obj_add_event_cb(g_test_kb, [](lv_event_t *) { _test_kb_hide(); }, LV_EVENT_CANCEL, nullptr);

    // ── Wire focus events on textarea → keyboard show/hide ───────────────────
    // LV_EVENT_ALL ensures we catch both FOCUSED and DEFOCUSED.
    // g_test_kb is passed as user_data so the callback has no stale globals.
    lv_obj_add_event_cb(g_test_ta, _ta_event_cb, LV_EVENT_ALL, g_test_kb);
}
