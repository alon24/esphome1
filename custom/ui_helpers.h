#pragma once
#include "lvgl.h"

// Forward declarations for global UI state (defined in maindashboard.h)
void ui_set_connected(const char *ip);
void ui_set_disconnected();
void ui_set_connecting();

// Remove all theme-applied decorations from a container
static inline void _panel_reset(lv_obj_t *p) {
    lv_obj_set_style_shadow_width(p, 0, 0);
    lv_obj_set_style_border_width(p, 0, 0);
    lv_obj_set_style_outline_width(p, 0, 0);
    lv_obj_set_style_pad_all(p, 0, 0);
    lv_obj_set_style_bg_grad_dir(p, LV_GRAD_DIR_NONE, 0);
    lv_obj_clear_flag(p, LV_OBJ_FLAG_SCROLLABLE);
}

// Give a label a solid bg so LVGL anti-aliases cleanly.
// Set for ALL states — LVGL theme can override DEFAULT only, leaving PRESSED/FOCUSED
// with a different bg that mismatches the label bg_color → white-fringe bleed.
static inline void _lbl_bg(lv_obj_t *l, uint32_t hex) {
    uint32_t states[] = { LV_STATE_DEFAULT, LV_STATE_PRESSED,
                          LV_STATE_FOCUSED, LV_STATE_FOCUS_KEY,
                          LV_STATE_EDITED,  LV_STATE_HOVERED };
    for (int s = 0; s < 6; s++) {
        lv_obj_set_style_bg_color(l, lv_color_hex(hex), states[s]);
        lv_obj_set_style_bg_opa(l,  LV_OPA_COVER,       states[s]);
    }
    lv_obj_set_style_border_width(l, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_dir(l, LV_GRAD_DIR_NONE, LV_STATE_DEFAULT);
}

// Create a plain dark container with no padding, no theme decoration.
// Locks bg for PRESSED/FOCUSED to the same colour so the theme cannot apply
// a highlight that bleeds through child label anti-aliasing.
static inline lv_obj_t *_make_panel(lv_obj_t *parent, int x, int y, int w, int h, uint32_t bg) {
    lv_obj_t *p = lv_obj_create(parent);
    lv_obj_set_pos(p, x, y);
    lv_obj_set_size(p, w, h);
    uint32_t states[] = { LV_STATE_DEFAULT, LV_STATE_PRESSED,
                          LV_STATE_FOCUSED, LV_STATE_FOCUS_KEY };
    for (int s = 0; s < 4; s++) {
        lv_obj_set_style_bg_color(p, lv_color_hex(bg), states[s]);
        lv_obj_set_style_bg_opa(p,  LV_OPA_COVER,      states[s]);
    }
    lv_obj_set_style_pad_all(p, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(p, 0, LV_STATE_DEFAULT);
    _panel_reset(p);
    lv_obj_clear_flag(p, LV_OBJ_FLAG_SCROLLABLE);
    return p;
}

// Create a rounded card panel with border
static inline lv_obj_t *_make_card(lv_obj_t *parent, int x, int y, int w, int h, uint32_t bg) {
    lv_obj_t *p = lv_obj_create(parent);
    lv_obj_set_pos(p, x, y);
    lv_obj_set_size(p, w, h);
    lv_obj_set_style_bg_color(p, lv_color_hex(bg), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(p, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(p, 16, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(p, 8, LV_STATE_DEFAULT);
    lv_obj_set_style_border_color(p, lv_color_hex(0xffffff), LV_STATE_DEFAULT);
    lv_obj_set_style_border_opa(p, 20, LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(p, 1, LV_STATE_DEFAULT);
    lv_obj_set_style_shadow_width(p, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_outline_width(p, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_bg_grad_dir(p, LV_GRAD_DIR_NONE, LV_STATE_DEFAULT);
    lv_obj_clear_flag(p, LV_OBJ_FLAG_SCROLLABLE);
    return p;
}

// Section header label (cyan small caps)
static inline lv_obj_t *_section_hdr(lv_obj_t *parent, const char *text, int x, int y, uint32_t bg) {
    lv_obj_t *l = lv_label_create(parent);
    lv_label_set_text(l, text);
    lv_obj_set_style_text_color(l, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(l, &lv_font_montserrat_12, LV_STATE_DEFAULT);
    _lbl_bg(l, bg);
    lv_obj_set_pos(l, x, y);
    return l;
}
