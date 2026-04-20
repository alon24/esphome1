#pragma once
#include <string>
#include "esphome.h"
#include "esphome/components/lvgl/lvgl_esphome.h"

// POSIX filesystem headers
#include <sys/dirent.h>
#include <sys/stat.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

#define SD_MOUNT "/sdcard"

static std::string g_current_path = SD_MOUNT;
static lv_obj_t* g_container = nullptr;
static lv_obj_t* g_path_label = nullptr;
static lv_obj_t* g_touch_btn = nullptr;
static lv_obj_t* g_touch_lbl = nullptr;
static int g_touch_count = 0;

static const lv_color_t TOUCH_COLORS[] = {
    {.full = 0x07E0},  // green
    {.full = 0xF800},  // red
    {.full = 0x001F},  // blue
    {.full = 0xFFE0},  // yellow
    {.full = 0xF81F},  // magenta
};
static const int TOUCH_COLOR_COUNT = 5;

void ui_refresh_list();

static void touch_test_cb(lv_event_t * e) {
    g_touch_count++;
    lv_color_t c = TOUCH_COLORS[g_touch_count % TOUCH_COLOR_COUNT];
    lv_obj_set_style_bg_color(g_touch_btn, c, 0);
    lv_label_set_text_fmt(g_touch_lbl, "TOUCH OK  #%d", g_touch_count);
    ESP_LOGI("EXPLORER", "Touch test fired: count=%d", g_touch_count);
}

static void file_click_event_cb(lv_event_t * e) {
    const char * name = (const char*)lv_event_get_user_data(e);
    if (!name) return;
    if (strcmp(name, "..") == 0) {
        size_t pos = g_current_path.find_last_of('/');
        if (pos != std::string::npos && g_current_path != SD_MOUNT) {
            g_current_path = g_current_path.substr(0, pos);
            if (g_current_path.empty()) g_current_path = SD_MOUNT;
            ui_refresh_list();
        }
    } else {
        std::string new_path = g_current_path;
        if (new_path.back() != '/') new_path += "/";
        new_path += name;
        DIR *d = opendir(new_path.c_str());
        if (d) {
            closedir(d);
            g_current_path = new_path;
            ui_refresh_list();
        } else {
            ESP_LOGI("EXPLORER", "Selected file: %s", new_path.c_str());
        }
    }
}

void ui_refresh_list() {
    if (!g_container) return;
    lv_obj_clean(g_container);
    lv_obj_scroll_to_y(g_container, 0, LV_ANIM_OFF);
    lv_label_set_text(g_path_label, g_current_path.c_str());

    // Back button
    if (g_current_path != SD_MOUNT) {
        lv_obj_t* btn = lv_obj_create(g_container);
        lv_obj_set_size(btn, LV_PCT(100), 48);
        lv_obj_clear_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_t* lbl = lv_label_create(btn);
        lv_label_set_text(lbl, LV_SYMBOL_UP "  ..");
        lv_obj_align(lbl, LV_ALIGN_LEFT_MID, 10, 0);
        lv_obj_add_event_cb(btn, file_click_event_cb, LV_EVENT_CLICKED, (void*)"..");
    }

    DIR *d = opendir(g_current_path.c_str());
    if (!d) {
        lv_obj_t* lbl = lv_label_create(g_container);
        lv_label_set_text(lbl, "SD card not mounted or read error");
        lv_obj_center(lbl);
        return;
    }

    struct dirent *entry;
    while ((entry = readdir(d)) != NULL) {
        if (entry->d_name[0] == '.') continue;
        bool is_dir = (entry->d_type == DT_DIR);
        lv_obj_t* btn = lv_obj_create(g_container);
        lv_obj_set_size(btn, LV_PCT(100), 44);
        lv_obj_clear_flag(btn, LV_OBJ_FLAG_SCROLLABLE);
        lv_obj_t* lbl = lv_label_create(btn);
        lv_label_set_text_fmt(lbl, "%s  %s",
            is_dir ? LV_SYMBOL_DIRECTORY : LV_SYMBOL_FILE,
            entry->d_name);
        lv_obj_align(lbl, LV_ALIGN_LEFT_MID, 10, 0);
        lv_label_set_long_mode(lbl, LV_LABEL_LONG_CLIP);
        lv_obj_set_width(lbl, LV_PCT(90));
        lv_obj_add_event_cb(btn, file_click_event_cb, LV_EVENT_CLICKED,
                            (void*)strdup(entry->d_name));
    }
    closedir(d);
}

void ui_init_explorer() {
    lv_obj_t* screen = lv_screen_active();
    lv_obj_set_style_bg_color(screen, lv_palette_darken(LV_PALETTE_BLUE_GREY, 3), 0);

    // Path label at top
    g_path_label = lv_label_create(screen);
    lv_obj_set_style_text_color(g_path_label, lv_color_white(), 0);
    lv_label_set_text(g_path_label, g_current_path.c_str());
    lv_label_set_long_mode(g_path_label, LV_LABEL_LONG_SCROLL_CIRCULAR);
    lv_obj_set_width(g_path_label, 760);
    lv_obj_align(g_path_label, LV_ALIGN_TOP_LEFT, 20, 10);

    // Touch test button — fixed at bottom, always visible
    g_touch_btn = lv_button_create(screen);
    lv_obj_set_size(g_touch_btn, 800, 50);
    lv_obj_align(g_touch_btn, LV_ALIGN_BOTTOM_MID, 0, 0);
    lv_obj_set_style_bg_color(g_touch_btn, TOUCH_COLORS[0], 0);
    lv_obj_set_style_radius(g_touch_btn, 0, 0);
    lv_obj_add_event_cb(g_touch_btn, touch_test_cb, LV_EVENT_CLICKED, nullptr);
    g_touch_lbl = lv_label_create(g_touch_btn);
    lv_label_set_text(g_touch_lbl, "TAP HERE TO TEST TOUCH");
    lv_obj_center(g_touch_lbl);

    // Scrollable container for file list
    g_container = lv_obj_create(screen);
    lv_obj_set_size(g_container, 760, 370);
    lv_obj_align(g_container, LV_ALIGN_TOP_MID, 0, 42);

    // Flex column so items stack vertically and scroll works
    lv_obj_set_flex_flow(g_container, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(g_container, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
    lv_obj_set_scroll_dir(g_container, LV_DIR_VER);
    lv_obj_set_scrollbar_mode(g_container, LV_SCROLLBAR_MODE_AUTO);
    lv_obj_set_style_pad_row(g_container, 4, 0);
    lv_obj_set_style_pad_all(g_container, 6, 0);

    ui_refresh_list();
}
