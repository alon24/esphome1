#pragma once
#include "lvgl.h"
#include "ui_helpers.h"
// Forward declarations from sd_card component (avoids include-path issues)
namespace esphome { namespace sd_card { extern volatile bool g_sd_newly_mounted; } }
extern bool sd_card_is_mounted();
extern bool sd_card_do_mount();
extern void sd_card_do_unmount();
#include <sys/dirent.h>
#include <sys/stat.h>
#include <stdio.h>
#include <string.h>
#include <vector>
#include <string>
#include <algorithm>
#include "esp_heap_caps.h"
#include "esp_log.h"

#define SD_TAB_MOUNT "/sdcard"
#define TAB_SD_BG    0x0e0e0e
#define SD_ROW_H     52
#define SD_ROW_GAP   6

// ── State ─────────────────────────────────────────────────────────────────────
static lv_obj_t    *g_sd_list_view  = nullptr;
static lv_obj_t    *g_sd_viewer     = nullptr;
static lv_obj_t    *g_sd_img_obj    = nullptr;
static lv_obj_t    *g_sd_status_lbl = nullptr;
static lv_obj_t    *g_sd_path_lbl   = nullptr;  // current directory path
static uint8_t     *g_sd_raw_buf    = nullptr;  // PSRAM: raw bytes or decoded pixels
static lv_img_dsc_t g_sd_img_dsc   = {};
static bool         g_sd_tab_visible = false;
static std::string  g_sd_cur_path   = SD_TAB_MOUNT;

// ── Dimension parsers ─────────────────────────────────────────────────────────
static bool _png_dims(const uint8_t *d, size_t sz, uint32_t *w, uint32_t *h) {
    if (sz < 24 || d[0]!=0x89||d[1]!='P'||d[2]!='N'||d[3]!='G') return false;
    *w = ((uint32_t)d[16]<<24)|((uint32_t)d[17]<<16)|((uint32_t)d[18]<<8)|d[19];
    *h = ((uint32_t)d[20]<<24)|((uint32_t)d[21]<<16)|((uint32_t)d[22]<<8)|d[23];
    return (*w>0 && *h>0 && *w<=4096 && *h<=4096);
}

static bool _jpg_dims(const uint8_t *d, size_t sz, uint32_t *w, uint32_t *h) {
    if (sz < 4 || d[0]!=0xFF || d[1]!=0xD8) return false;
    size_t i = 2;
    while (i + 3 < sz) {
        if (d[i] != 0xFF) return false;
        uint8_t mk = d[i+1];
        uint16_t len = ((uint16_t)d[i+2]<<8)|d[i+3];
        if (mk==0xC0||mk==0xC1||mk==0xC2) {
            if (i+8 >= sz) return false;
            *h = ((uint32_t)d[i+5]<<8)|d[i+6];
            *w = ((uint32_t)d[i+7]<<8)|d[i+8];
            return (*w>0 && *h>0 && *w<=4096 && *h<=4096);
        }
        if (len < 2) return false;
        i += 2 + len;
    }
    return false;
}

// ── Inline 24bpp BMP → RGB565 decoder ────────────────────────────────────────
static uint16_t *_bmp_to_rgb565(const uint8_t *d, size_t sz,
                                  uint32_t *out_w, uint32_t *out_h) {
    if (sz < 54 || d[0]!='B' || d[1]!='M') return nullptr;
    uint32_t px_off = d[10]|(d[11]<<8)|(d[12]<<16)|(d[13]<<24);
    int32_t  w      = (int32_t)(d[18]|(d[19]<<8)|(d[20]<<16)|(d[21]<<24));
    int32_t  h      = (int32_t)(d[22]|(d[23]<<8)|(d[24]<<16)|(d[25]<<24));
    uint16_t bpp    = d[28]|(d[29]<<8);
    uint32_t compr  = d[30]|(d[31]<<8)|(d[32]<<16)|(d[33]<<24);
    if (bpp!=24||compr!=0||w<=0||w>4096||h==0) return nullptr;
    bool bottom_up = (h>0);
    if (h<0) h=-h;
    if (h>4096) return nullptr;
    uint32_t stride = ((w*3+3)/4)*4;
    if (px_off+stride*(uint32_t)h > sz) return nullptr;
    uint16_t *buf = (uint16_t*)heap_caps_malloc((size_t)w*h*2,
                                                 MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
    if (!buf) { ESP_LOGE("SD_TAB","PSRAM alloc fail (%dx%d)",w,h); return nullptr; }
    for (int32_t y=0; y<h; y++) {
        int32_t src_y = bottom_up ? (h-1-y) : y;
        const uint8_t *row = d+px_off+src_y*stride;
        uint16_t *dst = buf+y*w;
        for (int32_t x=0; x<w; x++) {
            uint8_t b=row[x*3],g=row[x*3+1],r=row[x*3+2];
            uint16_t px=((uint16_t)(r>>3)<<11)|((uint16_t)(g>>2)<<5)|(b>>3);
            dst[x]=(px>>8)|(px<<8);  // big-endian swap
        }
    }
    *out_w=(uint32_t)w; *out_h=(uint32_t)h;
    return buf;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
static bool _sd_is_image(const char *name) {
    const char *ext = strrchr(name, '.');
    if (!ext) return false;
    return strcasecmp(ext,".bmp")==0 || strcasecmp(ext,".png")==0 ||
           strcasecmp(ext,".jpg")==0 || strcasecmp(ext,".jpeg")==0;
}

// ── Forward decls ─────────────────────────────────────────────────────────────
static void _sd_scan();
static void _sd_show_list();
static void _sd_show_image(const char *path);

// ── Callbacks ─────────────────────────────────────────────────────────────────
static void _sd_file_click_cb(lv_event_t *e) {
    _sd_show_image((const char*)lv_event_get_user_data(e));
}

static void _sd_dir_click_cb(lv_event_t *e) {
    const char *path = (const char*)lv_event_get_user_data(e);
    if (!path) return;
    g_sd_cur_path = path;
    _sd_scan();
}

static void _sd_up_click_cb(lv_event_t *) {
    size_t pos = g_sd_cur_path.find_last_of('/');
    if (pos != std::string::npos && g_sd_cur_path != SD_TAB_MOUNT) {
        g_sd_cur_path = g_sd_cur_path.substr(0, pos);
        if (g_sd_cur_path.empty()) g_sd_cur_path = SD_TAB_MOUNT;
    }
    _sd_scan();
}

static void _sd_back_cb(lv_event_t *) { _sd_show_list(); }

// ── View switching ────────────────────────────────────────────────────────────
static void _sd_show_list() {
    if (g_sd_raw_buf) { free(g_sd_raw_buf); g_sd_raw_buf = nullptr; }
    if (g_sd_img_obj) {
        lv_obj_set_style_bg_img_src(g_sd_img_obj, nullptr, 0);
        lv_obj_set_size(g_sd_img_obj, 0, 0);
    }
    if (g_sd_list_view) lv_obj_clear_flag(g_sd_list_view, LV_OBJ_FLAG_HIDDEN);
    if (g_sd_viewer)    lv_obj_add_flag(g_sd_viewer,    LV_OBJ_FLAG_HIDDEN);
}

static void _sd_show_image(const char *path) {
    if (!path || !g_sd_viewer || !g_sd_img_obj) return;

    FILE *f = fopen(path, "rb");
    if (!f) { ESP_LOGE("SD_TAB","open fail: %s",path); return; }
    fseek(f, 0, SEEK_END);
    long sz = ftell(f); rewind(f);
    if (sz<=0 || sz>8*1024*1024) { fclose(f); return; }

    uint8_t *file_buf = (uint8_t*)heap_caps_malloc(sz, MALLOC_CAP_SPIRAM|MALLOC_CAP_8BIT);
    if (!file_buf) { ESP_LOGE("SD_TAB","no mem %ld",sz); fclose(f); return; }
    if ((long)fread(file_buf,1,sz,f)!=sz) { free(file_buf); fclose(f); return; }
    fclose(f);

    if (g_sd_raw_buf) { free(g_sd_raw_buf); g_sd_raw_buf = nullptr; }

    const char *ext = strrchr(path,'.');
    uint32_t iw=0, ih=0;
    bool ok = false;

    if (ext && strcasecmp(ext,".bmp")==0) {
        uint16_t *px = _bmp_to_rgb565(file_buf, sz, &iw, &ih);
        free(file_buf);
        if (!px) { ESP_LOGE("SD_TAB","BMP decode fail"); return; }
        g_sd_raw_buf = (uint8_t*)px;
        g_sd_img_dsc = {};
        g_sd_img_dsc.header.cf = LV_IMG_CF_TRUE_COLOR;
        g_sd_img_dsc.header.w  = iw;
        g_sd_img_dsc.header.h  = ih;
        g_sd_img_dsc.data      = g_sd_raw_buf;
        g_sd_img_dsc.data_size = iw*ih*2;
        ok = true;

    } else if (ext && strcasecmp(ext,".png")==0) {
        if (!_png_dims(file_buf,sz,&iw,&ih)) { free(file_buf); return; }
        g_sd_raw_buf = file_buf;
        g_sd_img_dsc = {};
        g_sd_img_dsc.header.cf = LV_IMG_CF_RAW;
        g_sd_img_dsc.header.w  = iw;
        g_sd_img_dsc.header.h  = ih;
        g_sd_img_dsc.data      = g_sd_raw_buf;
        g_sd_img_dsc.data_size = (uint32_t)sz;
        ok = true;

    } else if (ext && (strcasecmp(ext,".jpg")==0||strcasecmp(ext,".jpeg")==0)) {
        if (!_jpg_dims(file_buf,sz,&iw,&ih)) { free(file_buf); return; }
        g_sd_raw_buf = file_buf;
        g_sd_img_dsc = {};
        g_sd_img_dsc.header.cf = LV_IMG_CF_RAW;
        g_sd_img_dsc.header.w  = iw;
        g_sd_img_dsc.header.h  = ih;
        g_sd_img_dsc.data      = g_sd_raw_buf;
        g_sd_img_dsc.data_size = (uint32_t)sz;
        ok = true;
    } else {
        free(file_buf);
    }

    if (!ok) return;

    lv_obj_set_size(g_sd_img_obj, (lv_coord_t)iw, (lv_coord_t)ih);
    lv_obj_set_style_bg_img_src(g_sd_img_obj, &g_sd_img_dsc, 0);
    lv_obj_set_style_bg_opa(g_sd_img_obj, LV_OPA_COVER, 0);
    lv_obj_set_pos(g_sd_img_obj, 0, 0);
    lv_obj_scroll_to(g_sd_viewer, 0, 0, LV_ANIM_OFF);
    lv_obj_add_flag(g_sd_list_view, LV_OBJ_FLAG_HIDDEN);
    lv_obj_clear_flag(g_sd_viewer,  LV_OBJ_FLAG_HIDDEN);
    ESP_LOGI("SD_TAB","Showing %s (%dx%d)",path,iw,ih);
}

// ── Make a single row in the list ─────────────────────────────────────────────
static lv_obj_t *_sd_make_row(lv_obj_t *parent, int y,
                               const char *icon_sym, uint32_t icon_color,
                               const char *label_text, uint32_t bg) {
    lv_obj_t *row = lv_obj_create(parent);
    lv_obj_set_pos(row, 0, y);
    lv_obj_set_size(row, 720, SD_ROW_H);
    lv_obj_clear_flag(row, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_set_style_bg_color(row, lv_color_hex(bg), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(row, lv_color_hex(0x1C2828), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(row, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(row, 6, 0);
    lv_obj_set_style_border_width(row, 0, 0);
    lv_obj_set_style_pad_all(row, 0, 0);
    lv_obj_set_style_shadow_width(row, 0, 0);
    lv_obj_set_style_outline_width(row, 0, 0);

    lv_obj_t *icon = lv_label_create(row);
    lv_label_set_text(icon, icon_sym);
    lv_obj_set_style_text_color(icon, lv_color_hex(icon_color), 0);
    lv_obj_set_style_text_font(icon, &lv_font_montserrat_20, 0);
    _lbl_bg(icon, bg);
    lv_obj_set_pos(icon, 14, 15);

    lv_obj_t *lbl = lv_label_create(row);
    lv_label_set_text(lbl, label_text);
    lv_obj_set_style_text_color(lbl, lv_color_hex(0xC8C5C4), 0);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_18, 0);
    _lbl_bg(lbl, bg);
    lv_label_set_long_mode(lbl, LV_LABEL_LONG_CLIP);
    lv_obj_set_size(lbl, 670, 30);
    lv_obj_set_pos(lbl, 50, 11);

    return row;
}

// ── Scan current directory and rebuild list ───────────────────────────────────
static void _sd_scan() {
    if (!g_sd_list_view) return;
    lv_obj_clean(g_sd_list_view);
    lv_obj_scroll_to_y(g_sd_list_view, 0, LV_ANIM_OFF);

    // Update path label
    if (g_sd_path_lbl) lv_label_set_text(g_sd_path_lbl, g_sd_cur_path.c_str());

    // Re-create status label
    g_sd_status_lbl = lv_label_create(g_sd_list_view);
    lv_obj_set_pos(g_sd_status_lbl, 0, 100);
    lv_obj_set_width(g_sd_status_lbl, 720);
    lv_obj_set_style_text_align(g_sd_status_lbl, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(g_sd_status_lbl, lv_color_hex(0x555555), 0);
    lv_obj_set_style_text_font(g_sd_status_lbl, &lv_font_montserrat_16, 0);
    _lbl_bg(g_sd_status_lbl, TAB_SD_BG);
    lv_label_set_text(g_sd_status_lbl, "Scanning...");

    if (!sd_card_is_mounted()) {
        lv_label_set_text(g_sd_status_lbl, "No SD card");
        return;
    }

    DIR *dir = opendir(g_sd_cur_path.c_str());
    if (!dir) {
        lv_label_set_text(g_sd_status_lbl, "Cannot open directory");
        return;
    }

    std::vector<std::string> dirs, files;
    struct dirent *e;
    while ((e = readdir(dir)) != NULL) {
        if (e->d_name[0] == '.') continue;
        std::string full = g_sd_cur_path + "/" + e->d_name;
        if (e->d_type == DT_DIR) {
            dirs.push_back(full);
        } else if (_sd_is_image(e->d_name)) {
            files.push_back(full);
        }
    }
    closedir(dir);

    std::sort(dirs.begin(),  dirs.end());
    std::sort(files.begin(), files.end());

    bool at_root = (g_sd_cur_path == SD_TAB_MOUNT);
    bool empty   = dirs.empty() && files.empty();

    if (at_root && empty) {
        lv_label_set_text(g_sd_status_lbl, "SD card empty");
        return;
    }
    lv_obj_add_flag(g_sd_status_lbl, LV_OBJ_FLAG_HIDDEN);

    int item_y = 0;

    // ".." row — go up one level
    if (!at_root) {
        lv_obj_t *row = _sd_make_row(g_sd_list_view, item_y,
                                      LV_SYMBOL_UP, 0x888888, "..", 0x141414);
        lv_obj_add_event_cb(row, _sd_up_click_cb, LV_EVENT_CLICKED, nullptr);
        item_y += SD_ROW_H + SD_ROW_GAP;
    }

    // Directories
    for (auto &p : dirs) {
        const char *name = strrchr(p.c_str(), '/');
        name = name ? name+1 : p.c_str();
        lv_obj_t *row = _sd_make_row(g_sd_list_view, item_y,
                                      LV_SYMBOL_DIRECTORY, 0xF0A030, name, 0x181818);
        lv_obj_add_event_cb(row, _sd_dir_click_cb, LV_EVENT_CLICKED,
                            (void*)strdup(p.c_str()));
        item_y += SD_ROW_H + SD_ROW_GAP;
    }

    // Image files
    for (auto &p : files) {
        const char *name = strrchr(p.c_str(), '/');
        name = name ? name+1 : p.c_str();
        lv_obj_t *row = _sd_make_row(g_sd_list_view, item_y,
                                      LV_SYMBOL_IMAGE, 0x00CED1, name, 0x1a1a1a);
        lv_obj_add_event_cb(row, _sd_file_click_cb, LV_EVENT_CLICKED,
                            (void*)strdup(p.c_str()));
        item_y += SD_ROW_H + SD_ROW_GAP;
    }
}

// ── Create tab ────────────────────────────────────────────────────────────────
static void tab_sd_create(lv_obj_t *parent) {

    // Current path label (scrolling, replaces static title)
    g_sd_path_lbl = lv_label_create(parent);
    lv_label_set_text(g_sd_path_lbl, SD_TAB_MOUNT);
    lv_obj_set_style_text_color(g_sd_path_lbl, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(g_sd_path_lbl, &lv_font_montserrat_14, 0);
    _lbl_bg(g_sd_path_lbl, TAB_SD_BG);
    lv_label_set_long_mode(g_sd_path_lbl, LV_LABEL_LONG_SCROLL_CIRCULAR);
    lv_obj_set_size(g_sd_path_lbl, 680, 24);
    lv_obj_set_pos(g_sd_path_lbl, 20, 14);

    // Refresh button — top right, compact
    lv_obj_t *rbtn = lv_btn_create(parent);
    lv_obj_set_size(rbtn, 90, 30);
    lv_obj_set_pos(rbtn, 700, 10);
    lv_obj_set_style_bg_color(rbtn, lv_color_hex(0x1C2828), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(rbtn, lv_color_hex(0x00CED1), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(rbtn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(rbtn, 6, 0);
    lv_obj_set_style_border_width(rbtn, 1, 0);
    lv_obj_set_style_border_color(rbtn, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_shadow_width(rbtn, 0, 0);
    lv_obj_t *rl = lv_label_create(rbtn);
    lv_label_set_text(rl, LV_SYMBOL_REFRESH);
    lv_obj_set_style_text_color(rl, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(rl, &lv_font_montserrat_16, 0);
    lv_obj_center(rl);
    lv_obj_add_event_cb(rbtn, [](lv_event_t *) {
        g_sd_cur_path = SD_TAB_MOUNT;
        sd_card_do_unmount();
        sd_card_do_mount();
        // Clear the poll-notify flag since we're handling the result directly
        esphome::sd_card::g_sd_newly_mounted = false;
        _sd_scan();
    }, LV_EVENT_CLICKED, nullptr);

    // Scrollable file/dir list (occupies most of the tab)
    g_sd_list_view = lv_obj_create(parent);
    lv_obj_set_size(g_sd_list_view, 760, 304);
    lv_obj_set_pos(g_sd_list_view, 20, 46);
    lv_obj_set_scroll_dir(g_sd_list_view, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(g_sd_list_view, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_style_bg_color(g_sd_list_view, lv_color_hex(TAB_SD_BG), 0);
    lv_obj_set_style_bg_opa(g_sd_list_view, LV_OPA_COVER, 0);
    lv_obj_set_style_border_width(g_sd_list_view, 1, 0);
    lv_obj_set_style_border_color(g_sd_list_view, lv_color_hex(0x2a2a2a), 0);
    lv_obj_set_style_radius(g_sd_list_view, 8, 0);
    lv_obj_set_style_pad_all(g_sd_list_view, 8, 0);
    lv_obj_set_style_shadow_width(g_sd_list_view, 0, 0);
    lv_obj_set_style_outline_width(g_sd_list_view, 0, 0);

    // Placeholder status label (recreated on each scan)
    g_sd_status_lbl = lv_label_create(g_sd_list_view);
    lv_obj_set_pos(g_sd_status_lbl, 0, 100);
    lv_obj_set_width(g_sd_status_lbl, 720);
    lv_obj_set_style_text_align(g_sd_status_lbl, LV_TEXT_ALIGN_CENTER, 0);
    lv_obj_set_style_text_color(g_sd_status_lbl, lv_color_hex(0x555555), 0);
    lv_obj_set_style_text_font(g_sd_status_lbl, &lv_font_montserrat_16, 0);
    _lbl_bg(g_sd_status_lbl, TAB_SD_BG);
    lv_label_set_text(g_sd_status_lbl, "Tap " LV_SYMBOL_REFRESH " to scan SD card");

    // ── Full-screen image viewer ───────────────────────────────────────────────
    g_sd_viewer = lv_obj_create(parent);
    lv_obj_set_size(g_sd_viewer, 800, 352);
    lv_obj_set_pos(g_sd_viewer, 0, 0);
    lv_obj_set_style_bg_color(g_sd_viewer, lv_color_hex(0x000000), 0);
    lv_obj_set_style_bg_opa(g_sd_viewer, LV_OPA_COVER, 0);
    lv_obj_set_style_pad_all(g_sd_viewer, 0, 0);
    lv_obj_set_style_radius(g_sd_viewer, 0, 0);
    _panel_reset(g_sd_viewer);
    lv_obj_set_scroll_dir(g_sd_viewer, LV_DIR_ALL);
    lv_obj_set_scrollbar_mode(g_sd_viewer, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_add_flag(g_sd_viewer, LV_OBJ_FLAG_HIDDEN);

    // Image display object (sized to image at load time)
    g_sd_img_obj = lv_obj_create(g_sd_viewer);
    lv_obj_set_size(g_sd_img_obj, 0, 0);
    lv_obj_set_pos(g_sd_img_obj, 0, 0);
    lv_obj_set_style_bg_opa(g_sd_img_obj, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(g_sd_img_obj, 0, 0);
    lv_obj_set_style_pad_all(g_sd_img_obj, 0, 0);
    lv_obj_set_style_radius(g_sd_img_obj, 0, 0);
    _panel_reset(g_sd_img_obj);

    // Back button (top-left overlay in viewer)
    lv_obj_t *bbtn = lv_btn_create(g_sd_viewer);
    lv_obj_set_size(bbtn, 100, 36);
    lv_obj_set_pos(bbtn, 8, 8);
    lv_obj_set_style_bg_color(bbtn, lv_color_hex(0x1C2828), LV_STATE_DEFAULT);
    lv_obj_set_style_bg_color(bbtn, lv_color_hex(0x00CED1), LV_STATE_PRESSED);
    lv_obj_set_style_bg_opa(bbtn, LV_OPA_COVER, LV_STATE_DEFAULT);
    lv_obj_set_style_radius(bbtn, 6, 0);
    lv_obj_set_style_border_width(bbtn, 1, 0);
    lv_obj_set_style_border_color(bbtn, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_shadow_width(bbtn, 0, 0);
    lv_obj_t *bl = lv_label_create(bbtn);
    lv_label_set_text(bl, LV_SYMBOL_LEFT "  BACK");
    lv_obj_set_style_text_color(bl, lv_color_hex(0x00CED1), 0);
    lv_obj_set_style_text_font(bl, &lv_font_montserrat_16, 0);
    lv_obj_center(bl);
    lv_obj_add_event_cb(bbtn, _sd_back_cb, LV_EVENT_CLICKED, nullptr);
}

// Called when the SD tab becomes active — scan every time
static void tab_sd_on_show() {
    g_sd_tab_visible = true;
    g_sd_cur_path = SD_TAB_MOUNT;
    esphome::sd_card::g_sd_newly_mounted = false;  // consume any pending flag
    _sd_show_list();
    _sd_scan();
}

// Called when leaving the SD tab
static void tab_sd_on_hide() {
    g_sd_tab_visible = false;
}

// Called periodically (e.g. from dashboard_tick) to react to card insertion
static void tab_sd_poll() {
    if (!esphome::sd_card::g_sd_newly_mounted) return;
    esphome::sd_card::g_sd_newly_mounted = false;
    if (!g_sd_tab_visible) return;
    g_sd_cur_path = SD_TAB_MOUNT;
    _sd_show_list();
    _sd_scan();
}
