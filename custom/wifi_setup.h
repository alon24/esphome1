#pragma once
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include "esp_wifi.h"

// Returns a color hex based on RSSI strength
static uint32_t _rssi_color(int8_t rssi) {
  if (rssi > -55) return 0x00cc44;  // excellent — green
  if (rssi > -65) return 0x88cc00;  // good — yellow-green
  if (rssi > -75) return 0xffaa00;  // fair — orange
  if (rssi > -85) return 0xff6600;  // weak — orange-red
  return 0xff2222;                   // very weak — red
}

// Returns 1-5 bars based on RSSI
static int _rssi_bars(int8_t rssi) {
  if (rssi > -55) return 5;
  if (rssi > -63) return 4;
  if (rssi > -71) return 3;
  if (rssi > -79) return 2;
  return 1;
}

// Scan for WiFi networks and populate a scrollable LVGL container.
// Tapping a network row copies its SSID into ssid_ta.
static void wifi_scan_and_populate(lv_obj_t *list_obj, lv_obj_t *ssid_ta) {
  wifi_scan_config_t cfg = {};
  cfg.show_hidden = 0;
  esp_wifi_scan_start(&cfg, true);  // blocking ~2-3 s

  uint16_t count = 0;
  esp_wifi_scan_get_ap_num(&count);
  if (count > 20) count = 20;
  if (count == 0) return;

  wifi_ap_record_t *recs = (wifi_ap_record_t *)malloc(count * sizeof(wifi_ap_record_t));
  if (!recs) return;
  esp_wifi_scan_get_ap_records(&count, recs);

  lv_obj_clean(list_obj);

  const lv_coord_t BTN_H = 48;
  const lv_coord_t GAP   = 4;
  lv_coord_t y = 0;

  for (int i = 0; i < count; i++) {
    if (recs[i].ssid[0] == '\0') continue;

    lv_obj_t *btn = lv_button_create(list_obj);
    lv_obj_set_pos(btn, 0, y);
    lv_obj_set_size(btn, LV_PCT(100), BTN_H);

    // ── Signal strength bar panel (child 0) ──────────────────────────────
    int bars = _rssi_bars(recs[i].rssi);
    uint32_t col = _rssi_color(recs[i].rssi);

    lv_obj_t *bar_panel = lv_obj_create(btn);
    lv_obj_set_size(bar_panel, 38, 36);
    lv_obj_align(bar_panel, LV_ALIGN_LEFT_MID, 4, 0);
    lv_obj_set_style_bg_color(bar_panel, lv_color_hex(0x111111), LV_STATE_DEFAULT);
    lv_obj_set_style_border_width(bar_panel, 0, LV_STATE_DEFAULT);
    lv_obj_set_style_pad_all(bar_panel, 0, LV_STATE_DEFAULT);
    lv_obj_clear_flag(bar_panel, LV_OBJ_FLAG_SCROLLABLE);
    lv_obj_clear_flag(bar_panel, LV_OBJ_FLAG_CLICKABLE);

    // 5 vertical bars of increasing height, left to right
    for (int b = 0; b < 5; b++) {
      lv_coord_t bh = 6 + b * 6;
      lv_obj_t *bar = lv_obj_create(bar_panel);
      lv_obj_set_size(bar, 5, bh);
      lv_obj_set_pos(bar, 1 + b * 7, 36 - bh);
      lv_obj_set_style_border_width(bar, 0, LV_STATE_DEFAULT);
      lv_obj_set_style_radius(bar, 1, LV_STATE_DEFAULT);
      lv_obj_set_style_bg_color(bar,
        b < bars ? lv_color_hex(col) : lv_color_hex(0x333333),
        LV_STATE_DEFAULT);
      lv_obj_clear_flag(bar, LV_OBJ_FLAG_CLICKABLE);
    }

    // ── SSID + dBm label (child 1) ───────────────────────────────────────
    lv_obj_t *lbl = lv_label_create(btn);
    char buf[80];
    snprintf(buf, sizeof(buf), "%s  %d dBm", (char *)recs[i].ssid, (int)recs[i].rssi);
    lv_label_set_text(lbl, buf);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_24, LV_STATE_DEFAULT);
    lv_obj_align(lbl, LV_ALIGN_LEFT_MID, 48, 0);

    // Pass ssid_ta via user_data so the callback can reach it
    lv_obj_set_user_data(btn, ssid_ta);
    lv_obj_add_event_cb(btn, [](lv_event_t *e) {
      lv_obj_t *b  = (lv_obj_t*)lv_event_get_target(e);
      lv_obj_t *ta = (lv_obj_t *)lv_obj_get_user_data(b);
      // child 0 = bar_panel, child 1 = ssid label
      lv_obj_t *l  = lv_obj_get_child(b, 1);
      if (!l || !ta) return;
      const char *text = lv_label_get_text(l);
      if (!text) return;
      // Text format: "SSID  -XX dBm" — split on double-space
      const char *sep = strstr(text, "  ");
      char ssid[64] = {0};
      size_t len = sep ? (size_t)(sep - text) : strlen(text);
      if (len >= sizeof(ssid)) len = sizeof(ssid) - 1;
      strncpy(ssid, text, len);
      lv_textarea_set_text(ta, ssid);
    }, LV_EVENT_CLICKED, nullptr);

    y += BTN_H + GAP;
  }

  free(recs);
}

// Connect using credentials entered in the LVGL textareas.
static void wifi_connect_from_ui(lv_obj_t *ssid_ta, lv_obj_t *pass_ta) {
  const char *ssid = lv_textarea_get_text(ssid_ta);
  const char *pass = lv_textarea_get_text(pass_ta);
  if (!ssid || ssid[0] == '\0') return;

  printf("\n--- WIFI CONNECT START ---\n");
  printf("Target SSID: [%s]\n", ssid);
  printf("Pass length: %d\n", pass ? (int)strlen(pass) : 0);
  
  wifi_config_t cfg;
  memset(&cfg, 0, sizeof(cfg));
  strncpy((char *)cfg.sta.ssid, ssid, sizeof(cfg.sta.ssid) - 1);
  if (pass) strncpy((char *)cfg.sta.password, pass, sizeof(cfg.sta.password) - 1);
  cfg.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;

  esp_wifi_disconnect();
  vTaskDelay(pdMS_TO_TICKS(100));
  
  esp_wifi_set_storage(WIFI_STORAGE_FLASH); // Persistence
  
  esp_err_t err = esp_wifi_set_config(WIFI_IF_STA, &cfg);
  if (err != ESP_OK) {
      printf("ERR: esp_wifi_set_config failed: %d\n", err);
  }
  
  err = esp_wifi_connect();
  if (err != ESP_OK) {
      printf("ERR: esp_wifi_connect failed: %d\n", err);
  } else {
      printf("SUCCESS: esp_wifi_connect command issued.\n");
  }
  printf("--- WIFI CONNECT PKT SENT ---\n");
}

inline void wifi_apply_ap_settings(bool active, const char* ssid, const char* pass) {
    ESP_LOGI("WIFI", "Applying AP Settings: active=%s, SSID=%s", active?"YES":"NO", ssid?ssid:"(null)");
    esp_wifi_set_storage(WIFI_STORAGE_FLASH);
    
    wifi_mode_t mode;
    esp_wifi_get_mode(&mode);
    
    wifi_config_t conf;
    memset(&conf, 0, sizeof(wifi_config_t)); // CRITICAL: Start clean to override defaults
    
    if (ssid) {
        strncpy((char*)conf.ap.ssid, ssid, 32);
        conf.ap.ssid[31] = '\0';
        conf.ap.ssid_len = strlen((char*)conf.ap.ssid);
    }
    if (pass) {
        strncpy((char*)conf.ap.password, pass, 64);
        conf.ap.password[63] = '\0';
        conf.ap.authmode = (strlen((char*)conf.ap.password) > 7) ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
    }
    conf.ap.max_connection = 4;
    conf.ap.channel = 1;
    
    // Mode toggle - MUST happen before or during config application on some IDF versions
    if (active) {
        if (mode == WIFI_MODE_STA) esp_wifi_set_mode(WIFI_MODE_APSTA);
        else if (mode == WIFI_MODE_NULL) esp_wifi_set_mode(WIFI_MODE_AP);
    } else {
        if (mode == WIFI_MODE_APSTA) esp_wifi_set_mode(WIFI_MODE_STA);
        else if (mode == WIFI_MODE_AP) esp_wifi_set_mode(WIFI_MODE_STA);
    }

    esp_err_t err = esp_wifi_set_config(WIFI_IF_AP, &conf);
    if (err != ESP_OK) {
        ESP_LOGE("WIFI", "FAILED to set AP config: %d", err);
    } else {
        ESP_LOGI("WIFI", "AP config set successfully: %s", (char*)conf.ap.ssid);
    }
    ESP_LOGI("WIFI", "AP Mode Applied. Current active state: %d", (int)active);
}
