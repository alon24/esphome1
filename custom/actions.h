#pragma once
#include <string>
#include "esp_log.h"
#include "widget_bindings.h"

// This file is for user-defined C++ handlers that can be triggered from the GridOS Designer
// using the "fn:function_name" action string.

inline void handle_custom_action(const std::string& name) {
    ESP_LOGI("GRID", "Handling custom C++ action: %s", name.c_str());

    if (name == "reboot") {
        ESP_LOGW("GRID", "Rebooting device...");
        esp_restart();
    }
    else if (name == "toggle_light") {
        // Example: logic to toggle a light
        ESP_LOGI("GRID", "Toggle light triggered!");
    }
    else if (name == "hello_world") {
        grid_widget_set_text("main_title", "Hello from C++!");
    }
    else {
        ESP_LOGW("GRID", "No handler defined for custom action: %s", name.c_str());
    }
}
