#pragma once
#include "lvgl.h"

// ── Stubs for dashboard functions called from device.yaml lambdas ─────────────
static inline void ui_set_connected(const char * = nullptr) {}
static inline void ui_set_disconnected() {}
static inline void dashboard_tick(int, int, int, int, int, int, int) {}

// ── TEST SCREEN (test4) ───────────────────────────────────────────────────────
// Layout (800×480):
//   Header  y=0   h=64   — 3 colour blocks (anti-alias bleed check)
//   Scroll  y=64  h=356  — tall content to verify vertical scroll
//   Button  y=420 h=60   — SHOW/HIDE KEYBOARD — fixed, always visible, child of scr
//   Keyboard y=220 h=200 — overlays scroll area, child of scr (top Z-order)
//
// Button is NOT inside the scroll container so touch is never confused with
// scroll-end gestures.  Keyboard show/hide does NOT call
// lv_keyboard_set_textarea() on show — that registers a def_event_cb that
// auto-hides on defocus, which fires the instant the keyboard steals focus.

static lv_obj_t *g_test_kb        = nullptr;
static lv_obj_t *g_test_kb_btn_lbl = nullptr;
static lv_obj_t *g_test_ta        = nullptr;

static void _test_kb_toggle() {
    if (!g_test_kb) return;
    if (lv_obj_has_flag(g_test_kb, LV_OBJ_FLAG_HIDDEN)) {
        // Show: link textarea AFTER making visible to avoid early defocus-hide
        lv_obj_clear_flag(g_test_kb, LV_OBJ_FLAG_HIDDEN);
        lv_obj_move_foreground(g_test_kb);
        if (g_test_ta) lv_keyboard_set_textarea(g_test_kb, g_test_ta);
        if (g_test_kb_btn_lbl) lv_label_set_text(g_test_kb_btn_lbl, "HIDE KEYBOARD");
        ESP_LOGI("KB", "keyboard shown");
    } else {
        lv_keyboard_set_textarea(g_test_kb, nullptr);
        lv_obj_add_flag(g_test_kb, LV_OBJ_FLAG_HIDDEN);
        if (g_test_kb_btn_lbl) lv_label_set_text(g_test_kb_btn_lbl, "SHOW KEYBOARD");
        ESP_LOGI("KB", "keyboard hidden");
    }
}

static void test_screen_create() {
    lv_obj_t *scr = lv_scr_act();
    lv_obj_set_style_bg_color(scr, lv_color_hex(0x111111), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_clear_flag(scr, LV_OBJ_FLAG_SCROLLABLE);

    // ── HEADER: 3 coloured blocks ─────────────────────────────────────────────
    const struct { uint32_t bg; const char *txt; int x; int w; } hdrs[] = {
        { 0xcc2222, "RED BG",   0,   267 },
        { 0x22aa44, "GREEN BG", 267, 266 },
        { 0x2255ee, "BLUE BG",  533, 267 },
    };
    for (int i = 0; i < 3; i++) {
        lv_obj_t *blk = lv_obj_create(scr);
        lv_obj_set_pos(blk, hdrs[i].x, 0);
        lv_obj_set_size(blk, hdrs[i].w, 64);
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
        lv_obj_set_style_text_font(lbl, &lv_font_montserrat_22, LV_STATE_DEFAULT);
        uint32_t ls[] = { LV_STATE_DEFAULT, LV_STATE_PRESSED, LV_STATE_FOCUSED, LV_STATE_FOCUS_KEY };
        for (int j = 0; j < 4; j++) {
            lv_obj_set_style_bg_color(lbl, lv_color_hex(hdrs[i].bg), ls[j]);
            lv_obj_set_style_bg_opa(lbl, LV_OPA_COVER, ls[j]);
        }
        lv_obj_set_style_border_width(lbl, 0, LV_STATE_DEFAULT);
        lv_obj_set_pos(lbl, 0, 20);
        lv_obj_set_width(lbl, hdrs[i].w);
        lv_obj_set_style_text_align(lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    }

    // ── SCROLLABLE CONTENT (y=64, h=356) ─────────────────────────────────────
    lv_obj_t *scroll = lv_obj_create(scr);
    lv_obj_set_pos(scroll, 0, 64);
    lv_obj_set_size(scroll, 800, 356);
    lv_obj_set_style_bg_color(scroll, lv_color_hex(0x111111), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(scroll, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(scroll, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(scroll, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(scroll, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_width(scroll, 0, LV_STATE_DEFAULT);
    lv_obj_add_flag(scroll, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_scroll_dir(scroll, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(scroll, LV_SCROLLBAR_MODE_ACTIVE);

    // Content rows — enough to require scrolling
    const char *rows[] = {
        "Row 1 — swipe up to scroll",
        "Row 2", "Row 3", "Row 4", "Row 5", "Row 6", "Row 7", "Row 8",
        "Row 9", "Row 10", "Row 11", "Row 12 — end",
    };
    for (int i = 0; i < 12; i++) {
        lv_obj_t *rl = lv_label_create(scroll);
        lv_label_set_text(rl, rows[i]);
        lv_obj_set_style_text_color(rl, lv_color_hex(i == 11 ? 0x00CC44 : 0x888888), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(rl, &lv_font_montserrat_18, LV_STATE_DEFAULT);
        lv_obj_set_style_bg_color(rl, lv_color_hex(0x111111), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(rl, LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_border_width(rl, 0, LV_STATE_DEFAULT);
        lv_obj_set_pos(rl, 24, 16 + i * 52);
    }

    // Textarea inside scroll — target for keyboard input
    g_test_ta = lv_textarea_create(scroll);
    lv_textarea_set_one_line(g_test_ta, true);
    lv_textarea_set_placeholder_text(g_test_ta, "Type here...");
    lv_obj_set_pos(g_test_ta, 24, 16 + 12 * 52);
    lv_obj_set_size(g_test_ta, 752, 48);
    lv_obj_set_style_bg_color(g_test_ta, lv_color_hex(0x222222), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_test_ta, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_color(g_test_ta, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_test_ta, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(g_test_ta, lv_color_hex(0x00CED1), LV_STATE_FOCUSED);
    lv_obj_set_style_border_width(g_test_ta, 2, LV_STATE_FOCUSED);
    lv_obj_set_style_border_color(g_test_ta, lv_color_hex(0x333333), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(g_test_ta, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(g_test_ta, 6, LV_STATE_DEFAULT);

    // ── SHOW/HIDE KEYBOARD BUTTON — fixed at bottom, child of scr ────────────
    // NOT inside scroll → no scroll-gesture ambiguity, always reachable
    lv_obj_t *btn = lv_btn_create(scr);
    lv_obj_set_pos(btn, 0, 420);
    lv_obj_set_size(btn, 800, 60);
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

    lv_obj_add_event_cb(btn, [](lv_event_t *e) {
        ESP_LOGI("KB", "button clicked");
        _test_kb_toggle();
    }, LV_EVENT_CLICKED, nullptr);

    // ── Keyboard — child of scr, highest Z-order, initially hidden ────────────
    g_test_kb = lv_keyboard_create(scr);
    lv_obj_set_pos(g_test_kb, 0, 220);
    lv_obj_set_size(g_test_kb, 800, 200);
    lv_obj_set_style_bg_color(g_test_kb, lv_color_hex(0x1a1a1a), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_test_kb, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_test_kb, &lv_font_montserrat_20, LV_STATE_DEFAULT);
    lv_obj_add_flag(g_test_kb, LV_OBJ_FLAG_HIDDEN);

    // READY/CANCEL from keyboard → hide
    lv_obj_add_event_cb(g_test_kb, [](lv_event_t *) { _test_kb_toggle(); }, LV_EVENT_READY,  nullptr);
    lv_obj_add_event_cb(g_test_kb, [](lv_event_t *) { _test_kb_toggle(); }, LV_EVENT_CANCEL, nullptr);
}
