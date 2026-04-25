#pragma once
#include <map>
#include <string>
#include "lvgl.h"
#include "esphome/components/mqtt/mqtt_client.h"

struct LiveWidget {
    lv_obj_t *obj = nullptr;
    std::string type;
};

// The live registry: widget ID -> { obj pointer, type }
static std::map<std::string, LiveWidget> g_live_widgets;

// --- Public API ---
// Call these from lambdas in device.yaml or from action strings

inline void grid_widget_set_value(const char *id, float value) {
    auto it = g_live_widgets.find(id);
    if (it == g_live_widgets.end() || !lv_obj_is_valid(it->second.obj)) return;
    lv_obj_t *obj = it->second.obj;
    const std::string &type = it->second.type;

    if (type == "slider") {
        lv_slider_set_value(obj, (int)value, LV_ANIM_ON);
        lv_obj_send_event(obj, LV_EVENT_VALUE_CHANGED, nullptr);
    }
    else if (type == "bar") {
        lv_bar_set_value(obj, (int)value, LV_ANIM_ON);
    }
    else if (type == "arc") {
        lv_arc_set_value(obj, (int)value);
        lv_obj_send_event(obj, LV_EVENT_VALUE_CHANGED, nullptr);
    }
    else if (type == "switch" || type == "checkbox") {
        if (value > 0) lv_obj_add_state(obj, LV_STATE_CHECKED);
        else lv_obj_clear_state(obj, LV_STATE_CHECKED);
        lv_obj_send_event(obj, LV_EVENT_VALUE_CHANGED, nullptr);
    }
}

inline void grid_widget_set_text(const char *id, const char *text) {
    auto it = g_live_widgets.find(id);
    if (it == g_live_widgets.end() || !lv_obj_is_valid(it->second.obj)) return;
    if (it->second.type == "label") {
        lv_label_set_text(it->second.obj, text);
    }
}

inline float grid_widget_get_value(const char *id) {
    auto it = g_live_widgets.find(id);
    if (it == g_live_widgets.end() || !lv_obj_is_valid(it->second.obj)) return 0;
    lv_obj_t *obj = it->second.obj;
    const std::string &type = it->second.type;
    
    if (type == "slider") return lv_slider_get_value(obj);
    if (type == "bar")    return lv_bar_get_value(obj);
    if (type == "arc")    return lv_arc_get_value(obj);
    if (type == "switch" || type == "checkbox") return lv_obj_has_state(obj, LV_STATE_CHECKED) ? 1.0f : 0.0f;
    
    return 0;
}
