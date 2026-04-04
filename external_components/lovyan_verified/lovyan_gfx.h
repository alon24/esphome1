#pragma once

#define LGFX_USE_V1
#include <lgfx_user/LGFX_ESP32S3_RGB_ESP32-8048S043.h>
#include "esphome/core/component.h"
#include "esphome/components/display/display_buffer.h"

namespace esphome {
namespace lovyan_gfx {

// Modern static accessors (Infallible pattern)
static auto& v_lcd() { static LGFX lcd; return lcd; }
static auto& v_p() { return v_lcd()._panel_instance; }
static auto& v_t() { return v_lcd()._touch_instance; }
static auto& v_w() { static int w = 800; return w; }
static auto& v_h() { static int h = 480; return h; }

class VerifiedLovyanDisplay : public display::DisplayBuffer {
 public:
  float get_setup_priority() const override { return setup_priority::PROCESSOR; }

  void set_width(int w) { v_w() = w; }
  void set_height(int h) { v_h() = h; }
  void set_swap_bytes(bool s) { /* Ignored for isolation test */ }

  void setup() override {
    ESP_LOGI("lovyan_gfx", "Setting up LovyanGFX (Handover to ESP-IDF driver_ng)...");
    
    // Explicitly DETACH the internal Lovyan touch driver 
    // This allows the official ESPHome 'gt911' component to handle it.
    v_lcd()._panel_instance.setTouch(nullptr);
    ESP_LOGI("lovyan_gfx", "Touch driver DETACHED for I2C driver_ng compatibility.");

    if (!v_lcd().init()) {
      ESP_LOGE("lovyan_gfx", "FAILED to initialize display!");
    } else {
      v_lcd().setSwapBytes(true); // Fix for Red/Blue swap and bit-shift
      v_lcd().setRotation(0);
      ESP_LOGI("lovyan_gfx", "LovyanGFX Display initialized with SwapBytes=ON.");
    }
  }

  void loop() override {
    static uint32_t last_loop_log = 0;
    if (millis() - last_loop_log > 10000) {
      ESP_LOGD("lovyan_gfx", "Isolation loop tick.");
      last_loop_log = millis();
    }
  }

  void update() override {
    this->do_update_();
  }

  void draw_absolute_pixel_internal(int x, int y, Color color) override {
    v_lcd().drawPixel(x, y, display::ColorUtil::color_to_565(color));
  }

  int get_width_internal() override { return v_w(); }
  int get_height_internal() override { return v_h(); }
  display::DisplayType get_display_type() override { return display::DISPLAY_TYPE_COLOR; }
};

}  // namespace lovyan_gfx
}  // namespace esphome
