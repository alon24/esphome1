#pragma once
// ── SD CARD BROWSER — SMART COMPONENT (EMBEDDED / BOUNDS-RELATIVE) ───────────
// F1-F13: Browsable file list on left, preview/info panel on right.
// All coordinates are relative to `parent` bounds.

#include "lvgl.h"
#include "ui_helpers.h"
#include <dirent.h>
#include <sys/stat.h>
#include <string>
#include <vector>
#include <algorithm>
#include <cstdio>
#include <cstring>
#include "stb_image.h"

#define CSDTAB_MOUNT "/sdcard"
static uint32_t g_csd_bg   = 0x0E0E12;
static uint32_t g_csd_list = 0x16161D;
static uint32_t g_csd_row  = 0x1A1B26;
static uint32_t g_csd_text = 0xFFFFFF;
static uint32_t g_csd_hl   = 0x00CED1;

static lv_obj_t *g_csd_list_cont   = nullptr;
static lv_obj_t *g_csd_path_lbl    = nullptr;
static lv_obj_t *g_csd_right_panel = nullptr;
static lv_obj_t *g_csd_info_lbl    = nullptr;
static lv_obj_t *g_csd_img_obj     = nullptr;
static std::string g_csd_cur_path  = CSDTAB_MOUNT;
static std::string g_csd_sel_path  = "";

static lv_img_dsc_t g_csd_img_dsc  = {};
static uint8_t *g_csd_img_buf      = nullptr;

// ── Delete + confirm ──────────────────────────────────────────────────────────
static void _csd_do_delete(const std::string &path) {
    if (path.empty()) return;
    if (unlink(path.c_str()) == 0) {
        lv_label_set_text(g_csd_info_lbl, "File deleted.");
        g_csd_sel_path = "";
    } else {
        lv_label_set_text(g_csd_info_lbl, "Delete failed.");
    }
}

// ── Image display ─────────────────────────────────────────────────────────────
static bool _csd_is_image(const char *name) {
    const char *ext = strrchr(name, '.');
    if (!ext) return false;
    return strcasecmp(ext, ".jpg") == 0 || strcasecmp(ext, ".jpeg") == 0 ||
           strcasecmp(ext, ".bmp") == 0;
}

static void _csd_show_image(const char *path) {
    // Free previous
    if (g_csd_img_buf) { 
        free(g_csd_img_buf); 
        g_csd_img_buf = nullptr; 
        if (g_csd_img_obj) lv_obj_add_flag(g_csd_img_obj, LV_OBJ_FLAG_HIDDEN);
    }

    struct stat st; stat(path, &st);
    long sz = st.st_size;

    int iw, ih, n;
    unsigned char *pix = stbi_load(path, &iw, &ih, &n, 3);
    if (!pix) { 
        const char* err = stbi_failure_reason();
        char ebuf[64]; snprintf(ebuf, sizeof(ebuf), "Load fail: %s", err ? err : "unknown");
        lv_label_set_text(g_csd_info_lbl, ebuf); 
        return; 
    }

    int pw = lv_obj_get_width(g_csd_right_panel) - 8;
    int ph = lv_obj_get_height(g_csd_right_panel) - 60;

    // Convert RGB → RGB565 and scale to fit right panel
    float sx = (float)iw / pw, sy = (float)ih / ph;
    float sc = (sx > sy) ? sx : sy;
    int dw = (int)(iw / sc), dh = (int)(ih / sc);
    if (dw > pw) dw = pw; if (dh > ph) dh = ph;

    size_t buf_sz = (size_t)dw * dh * 2;
    g_csd_img_buf = (uint8_t*)heap_caps_malloc(buf_sz, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
    if (!g_csd_img_buf) { stbi_image_free(pix); lv_label_set_text(g_csd_info_lbl, "PSRAM alloc fail"); return; }

    uint16_t *dst = (uint16_t*)g_csd_img_buf;
    for (int y = 0; y < dh; y++) {
        int sy_px = (int)(y * sc);
        for (int x = 0; x < dw; x++) {
            int sx_px = (int)(x * sc);
            uint8_t *p = pix + (sy_px * iw + sx_px) * 3;
            uint16_t px = ((uint16_t)(p[0]>>3)<<11) | ((uint16_t)(p[1]>>2)<<5) | (p[2]>>3);
            dst[y * dw + x] = (px >> 8) | (px << 8); // byte-swap for little-endian LCD
        }
    }
    stbi_image_free(pix);

    g_csd_img_dsc.header.cf     = LV_IMG_CF_TRUE_COLOR;
    g_csd_img_dsc.header.w      = dw;
    g_csd_img_dsc.header.h      = dh;
    g_csd_img_dsc.data_size     = buf_sz;
    g_csd_img_dsc.data          = g_csd_img_buf;

    if (!g_csd_img_obj) {
        g_csd_img_obj = lv_img_create(g_csd_right_panel);
        lv_obj_align(g_csd_img_obj, LV_ALIGN_TOP_MID, 0, 10);
    }
    lv_img_set_src(g_csd_img_obj, &g_csd_img_dsc);
    lv_obj_set_size(g_csd_img_obj, dw, dh);
    lv_obj_clear_flag(g_csd_img_obj, LV_OBJ_FLAG_HIDDEN);

    char ibuf[64]; snprintf(ibuf, sizeof(ibuf), "%dx%d px · %d KB", iw, ih, (int)(sz/1024));
    lv_label_set_text(g_csd_info_lbl, ibuf);
}

// ── Forward decl ──────────────────────────────────────────────────────────────
static void _csd_scan_dir(const std::string &path);

// ── Scan + populate list ──────────────────────────────────────────────────────
static void _csd_scan_dir(const std::string &path) {
    if (!g_csd_list_cont || !g_csd_path_lbl) return;
    g_csd_cur_path = path;

    // Update path label (show path relative to mount)
    std::string disp = "/";
    if (path.size() > strlen(CSDTAB_MOUNT)) {
        disp = path.substr(strlen(CSDTAB_MOUNT));
    }
    lv_label_set_text(g_csd_path_lbl, disp.c_str());

    lv_obj_clean(g_csd_list_cont);

    // ⬆ Up row
    if (path != CSDTAB_MOUNT) {
        lv_obj_t *up_row = lv_obj_create(g_csd_list_cont);
        lv_obj_set_size(up_row, lv_pct(100), 50);
        lv_obj_set_style_bg_color(up_row, lv_color_hex(g_csd_row), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(up_row, LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_radius(up_row, 6, LV_STATE_DEFAULT);
        _panel_reset(up_row);
        lv_obj_t *ul = lv_label_create(up_row);
        lv_label_set_text(ul, LV_SYMBOL_UP "  PARENT FOLDER");
        lv_obj_set_style_text_color(ul, lv_color_hex(g_csd_text), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(ul, &lv_font_montserrat_16, LV_STATE_DEFAULT);
        _lbl_bg(ul, g_csd_row);
        lv_obj_center(ul);

        size_t pos = path.find_last_of('/');
        std::string up_path = (pos != std::string::npos && pos > strlen(CSDTAB_MOUNT)) ? path.substr(0, pos) : std::string(CSDTAB_MOUNT);
        lv_obj_set_user_data(up_row, strdup(up_path.c_str()));
        lv_obj_add_event_cb(up_row, [](lv_event_t *e) {
            if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
                const char *p = (const char*)lv_obj_get_user_data(lv_event_get_target(e));
                if (p) _csd_scan_dir(p);
            } else if (lv_event_get_code(e) == LV_EVENT_DELETE) {
                char *p = (char *)lv_obj_get_user_data(lv_event_get_target(e));
                if (p) free(p);
            }
        }, LV_EVENT_ALL, nullptr);
    }

    // Read directory
    ESP_LOGI("SD", "Scanning: %s", path.c_str());
    DIR *dir = opendir(path.c_str());
    if (!dir) {
        ESP_LOGE("SD", "Failed to open: %s", path.c_str());
        lv_obj_t *el = lv_label_create(g_csd_list_cont);
        lv_label_set_text(el, "SD card not found or empty");
        lv_obj_set_style_text_color(el, lv_color_hex(0x666666), LV_STATE_DEFAULT);
        _lbl_bg(el, g_csd_list);
        return;
    }

    // Collect entries: dirs first, then files
    std::vector<std::string> dirs, files;
    struct dirent *ent;
    int count = 0;
    while ((ent = readdir(dir)) != NULL) {
        if (ent->d_name[0] == '.') continue;
        std::string full = path + "/" + ent->d_name;
        struct stat st; stat(full.c_str(), &st);
        if (S_ISDIR(st.st_mode)) dirs.push_back(ent->d_name);
        else files.push_back(ent->d_name);
        count++;
    }
    closedir(dir);
    ESP_LOGI("SD", "Found %d items", count);
    std::sort(dirs.begin(), dirs.end());
    std::sort(files.begin(), files.end());

    // Render rows
    auto make_row = [&](const std::string &name, bool is_dir) {
        lv_obj_t *row = lv_obj_create(g_csd_list_cont);
        lv_obj_set_size(row, lv_pct(100), 54);
        lv_obj_set_style_bg_color(row, lv_color_hex(g_csd_row), LV_STATE_DEFAULT);
        lv_obj_set_style_bg_opa(row, LV_OPA_COVER, LV_STATE_DEFAULT);
        lv_obj_set_style_radius(row, 6, LV_STATE_DEFAULT);
        _panel_reset(row);
        lv_obj_add_flag(row, LV_OBJ_FLAG_CLICKABLE);

        lv_obj_t *icon = lv_label_create(row);
        lv_label_set_text(icon, is_dir ? LV_SYMBOL_DIRECTORY : (_csd_is_image(name.c_str()) ? LV_SYMBOL_IMAGE : LV_SYMBOL_FILE));
        lv_obj_set_style_text_font(icon, &lv_font_montserrat_18, LV_STATE_DEFAULT);
        _lbl_bg(icon, g_csd_row);
        lv_obj_set_pos(icon, 10, 16);

        lv_obj_t *nl = lv_label_create(row);
        lv_label_set_text(nl, name.c_str());
        lv_obj_set_style_text_color(nl, lv_color_hex(g_csd_text), LV_STATE_DEFAULT);
        lv_obj_set_style_text_font(nl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
        _lbl_bg(nl, g_csd_row);
        lv_obj_set_pos(nl, 40, 18);
        lv_obj_set_width(nl, lv_obj_get_width(g_csd_list_cont) - 50);
        lv_label_set_long_mode(nl, LV_LABEL_LONG_DOT);

        std::string full_path = path + "/" + name;
        lv_obj_set_user_data(row, strdup(full_path.c_str()));
        
        lv_obj_add_event_cb(row, [](lv_event_t *e) {
            lv_event_code_t code = lv_event_get_code(e);
            lv_obj_t *target = lv_event_get_target(e);
            if (code == LV_EVENT_CLICKED) {
                const char *p = (const char*)lv_obj_get_user_data(target);
                if (!p) return;
                struct stat st; stat(p, &st);
                if (S_ISDIR(st.st_mode)) {
                    _csd_scan_dir(p);
                } else {
                    g_csd_sel_path = p;
                    if (g_csd_img_obj) lv_obj_add_flag(g_csd_img_obj, LV_OBJ_FLAG_HIDDEN);
                    if (_csd_is_image(p)) {
                        lv_label_set_text(g_csd_info_lbl, "Loading image...");
                        lv_refr_now(NULL);
                        _csd_show_image(p);
                    } else {
                        char buf[128]; 
                        snprintf(buf, sizeof(buf), "%s\n%d KB", p + strlen(CSDTAB_MOUNT), (int)(st.st_size/1024+1));
                        lv_label_set_text(g_csd_info_lbl, buf);
                    }
                }
            } else if (code == LV_EVENT_DELETE) {
                char *p = (char *)lv_obj_get_user_data(target);
                if (p) free(p);
            }
        }, LV_EVENT_ALL, nullptr);
    };

    for (auto &d : dirs)  make_row(d, true);
    for (auto &f : files) make_row(f, false);

    if (dirs.empty() && files.empty()) {
        lv_obj_t *el = lv_label_create(g_csd_list_cont);
        lv_label_set_text(el, "Empty folder or no SD");
        lv_obj_set_style_text_color(el, lv_color_hex(0x999999), LV_STATE_DEFAULT);
        _lbl_bg(el, g_csd_list);
    }
}

// ── F1-F13: Main embedded create ──────────────────────────────────────────────
void tab_sd_create_embedded(lv_obj_t *parent) {
    lv_obj_clear_flag(parent, LV_OBJ_FLAG_SCROLLABLE);
    
    // Dynamic theme detection
    lv_color_t bg_col = lv_obj_get_style_bg_color(parent, 0);
    g_csd_bg = lv_color_to32(bg_col);
    
    // Simple brightness check (R*0.299 + G*0.587 + B*0.114)
    uint8_t r = (g_csd_bg >> 16) & 0xFF;
    uint8_t g = (g_csd_bg >> 8) & 0xFF;
    uint8_t b = g_csd_bg & 0xFF;
    float brightness = r * 0.299f + g * 0.587f + b * 0.114f;
    
    if (brightness > 160) {
        // Light Theme
        g_csd_text = 0x111111;
        g_csd_list = 0xF0F0F0;
        g_csd_row  = 0xE0E0E0;
    } else {
        // Dark Theme
        g_csd_text = 0xFFFFFF;
        g_csd_list = 0x16161D;
        g_csd_row  = 0x1A1B26;
    }

    int pw = lv_obj_get_width(parent);
    int ph = lv_obj_get_height(parent);
    
    if (pw <= 0) pw = 640;
    if (ph <= 0) ph = 350;
    ESP_LOGI("SD", "Embedded create: %dx%d (BG: %06X)", pw, ph, g_csd_bg);

    int lw = (pw * 40) / 100;
    int rw = pw - lw - 1;

    // ── Left panel: F3 ─────────────────────────────────────────────────────────
    lv_obj_t *left = _make_panel(parent, 0, 0, lw, ph, g_csd_list);
    lv_obj_clear_flag(left, LV_OBJ_FLAG_SCROLLABLE);

    // Header: F3
    lv_obj_t *hdr = lv_label_create(left);
    lv_label_set_text(hdr, LV_SYMBOL_DIRECTORY " SD CARD BROWSER");
    lv_obj_set_style_text_color(hdr, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(hdr, &lv_font_montserrat_18, LV_STATE_DEFAULT);
    _lbl_bg(hdr, g_csd_list);
    lv_obj_set_pos(hdr, 10, 10);

    // Path breadcrumb bar: New header container
    lv_obj_t *pb_bg = lv_obj_create(left);
    lv_obj_set_pos(pb_bg, 4, 40);
    lv_obj_set_size(pb_bg, lw - 8, 40);
    lv_obj_set_style_bg_color(pb_bg, lv_color_hex(0x000000), 0);
    lv_obj_set_style_bg_opa(pb_bg, 150, 0);
    lv_obj_set_style_border_color(pb_bg, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_border_width(pb_bg, 2, 0);
    lv_obj_set_style_radius(pb_bg, 6, 0);
    _panel_reset(pb_bg);

    g_csd_path_lbl = lv_label_create(pb_bg);
    lv_label_set_text(g_csd_path_lbl, "/");
    lv_obj_set_style_text_color(g_csd_path_lbl, lv_color_hex(0x00CED1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_csd_path_lbl, &lv_font_montserrat_16, LV_STATE_DEFAULT);
    _lbl_bg(g_csd_path_lbl, 0x000000);
    lv_obj_align(g_csd_path_lbl, LV_ALIGN_LEFT_MID, 10, 0);
    lv_obj_set_width(g_csd_path_lbl, lw - 24);
    lv_label_set_long_mode(g_csd_path_lbl, LV_LABEL_LONG_DOT);

    // Scrollable file list: F3
    g_csd_list_cont = lv_obj_create(left);
    lv_obj_set_pos(g_csd_list_cont, 4, 85);
    lv_obj_set_size(g_csd_list_cont, lw - 8, ph - 89);
    lv_obj_set_style_bg_color(g_csd_list_cont, lv_color_hex(g_csd_list), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(g_csd_list_cont, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(g_csd_list_cont);
    lv_obj_set_flex_flow(g_csd_list_cont, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(g_csd_list_cont, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
    lv_obj_set_style_pad_gap(g_csd_list_cont, 8, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(g_csd_list_cont, 4, LV_STATE_DEFAULT);

    // ── Divider ───────────────────────────────────────────────────────────────
    lv_obj_t *div = lv_obj_create(parent);
    lv_obj_set_pos(div, lw, 0); lv_obj_set_size(div, 1, ph);
    lv_obj_set_style_bg_color(div, lv_color_hex(0x252525), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_opa(div, LV_OPA_COVER, LV_STATE_DEFAULT);
    _panel_reset(div);

    // ── Right panel: F5 ──────────────────────────────────────────────────────
    g_csd_right_panel = _make_panel(parent, lw + 1, 0, rw, ph, g_csd_bg);
    lv_obj_clear_flag(g_csd_right_panel, LV_OBJ_FLAG_SCROLLABLE);

    // File info/Preview label: F3
    g_csd_info_lbl = lv_label_create(g_csd_right_panel);
    lv_label_set_text(g_csd_info_lbl, LV_SYMBOL_DIRECTORY "\nPLEASE SELECT\nA FILE TO PREVIEW");
    lv_obj_set_style_text_color(g_csd_info_lbl, lv_color_hex(0x6366f1), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(g_csd_info_lbl, &lv_font_montserrat_20, LV_STATE_DEFAULT);
    lv_obj_set_style_text_align(g_csd_info_lbl, LV_TEXT_ALIGN_CENTER, LV_STATE_DEFAULT);
    lv_obj_set_width(g_csd_info_lbl, rw - 20);
    _lbl_bg(g_csd_info_lbl, g_csd_bg);
    lv_obj_align(g_csd_info_lbl, LV_ALIGN_CENTER, 0, -20);
    lv_label_set_long_mode(g_csd_info_lbl, LV_LABEL_LONG_WRAP);

    // Toolbar row at bottom: F7
    int tb_y = ph - 50;
    // Back button
    lv_obj_t *back_btn = lv_obj_create(g_csd_right_panel);
    lv_obj_set_pos(back_btn, 8, tb_y);
    lv_obj_set_size(back_btn, (rw - 24) / 2, 36);
    lv_obj_set_style_bg_color(back_btn, lv_color_hex(0x1a1a2e), LV_STATE_DEFAULT);
    lv_obj_set_style_radius(back_btn, 6, LV_STATE_DEFAULT);
    _panel_reset(back_btn);
    lv_obj_t *back_lbl = lv_label_create(back_btn);
    lv_label_set_text(back_lbl, LV_SYMBOL_LEFT " BACK");
    lv_obj_set_style_text_color(back_lbl, lv_color_hex(0xaaaaaa), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(back_lbl, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    _lbl_bg(back_lbl, 0x1a1a2e);
    lv_obj_center(back_lbl);
    lv_obj_add_event_cb(back_btn, [](lv_event_t*) {
        if (g_csd_img_obj) lv_obj_add_flag(g_csd_img_obj, LV_OBJ_FLAG_HIDDEN);
        g_csd_sel_path = "";
        if (g_csd_info_lbl) lv_label_set_text(g_csd_info_lbl, "Select a file to preview");
    }, LV_EVENT_CLICKED, nullptr);

    // Delete button: F12
    lv_obj_t *del_btn = lv_obj_create(g_csd_right_panel);
    lv_obj_set_pos(del_btn, 8 + (rw - 24) / 2 + 8, tb_y);
    lv_obj_set_size(del_btn, (rw - 24) / 2, 36);
    lv_obj_set_style_bg_color(del_btn, lv_color_hex(0x3a0a0a), LV_STATE_DEFAULT);
    lv_obj_set_style_radius(del_btn, 6, LV_STATE_DEFAULT);
    _panel_reset(del_btn);
    lv_obj_t *del_lbl = lv_label_create(del_btn);
    lv_label_set_text(del_lbl, LV_SYMBOL_TRASH " DELETE");
    lv_obj_set_style_text_color(del_lbl, lv_color_hex(0xf43f5e), LV_STATE_DEFAULT);
    lv_obj_set_style_text_font(del_lbl, &lv_font_montserrat_14, LV_STATE_DEFAULT);
    _lbl_bg(del_lbl, 0x3a0a0a);
    lv_obj_center(del_lbl);
    lv_obj_add_event_cb(del_btn, [](lv_event_t*) {
        if (g_csd_sel_path.empty()) return;
        static const char *btns[] = { "Delete", "Cancel", "" };
        lv_obj_t *mb = lv_msgbox_create(NULL, "Delete?",
            ("Delete " + g_csd_sel_path.substr(g_csd_sel_path.find_last_of('/')+1)).c_str(),
            btns, true);
        lv_obj_center(mb);
        lv_obj_add_event_cb(mb, [](lv_event_t *e) {
            lv_obj_t *m = lv_event_get_current_target(e);
            const char *txt = lv_msgbox_get_active_btn_text(m);
            if (strcmp(txt, "Delete") == 0) {
                _csd_do_delete(g_csd_sel_path);
                _csd_scan_dir(g_csd_cur_path); // refresh list
            }
            lv_msgbox_close(m);
        }, LV_EVENT_VALUE_CHANGED, NULL);
    }, LV_EVENT_CLICKED, nullptr);

    // F13: Initial scan
    if (esphome::sd_card_is_mounted()) {
        _csd_scan_dir(CSDTAB_MOUNT);
    } else {
        // Try mounting one last time
        if (esphome::sd_card_do_mount()) {
            _csd_scan_dir(CSDTAB_MOUNT);
        } else {
            lv_label_set_text(g_csd_path_lbl, "⚠️ NO SD CARD");
            lv_label_set_text(g_csd_info_lbl, "PLEASE INSERT SD CARD\nAND RESTART DEVICE");
        }
    }

    // Also add an event to the background to refresh if it was empty
    lv_obj_add_event_cb(parent, [](lv_event_t *e) {
        if (lv_event_get_code(e) == LV_EVENT_CLICKED) {
            if (g_csd_cur_path.empty() || g_csd_cur_path == "none") {
                if (esphome::sd_card_do_mount()) _csd_scan_dir(CSDTAB_MOUNT);
            }
        }
    }, LV_EVENT_CLICKED, nullptr);
}
