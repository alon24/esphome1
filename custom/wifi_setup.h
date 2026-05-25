#pragma once
#include <cstring>
#include <cstdio>
#include <cstdlib>
#include "esp_wifi.h"

struct ScanResult {
  char ssid[33];
  int8_t rssi;
};

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

    lv_obj_t *btn = lv_btn_create(list_obj);
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

// Background task: scans for target SSID, then sets config with BSSID+channel
// and connects. Running off the LVGL thread so blocking is fine.
struct _WifiConnArgs { char ssid[33]; char pass[65]; };

static void _wifi_connect_task(void *arg) {
    auto *p = static_cast<_WifiConnArgs*>(arg);
    printf("\n--- WIFI CONNECT TASK ---\n");
    printf("Target SSID: [%s]\n", p->ssid);
    printf("Password:    [%s] (len=%d)\n", p->pass, (int)strlen(p->pass));

    // Ensure STA interface is active
    wifi_mode_t mode;
    esp_wifi_get_mode(&mode);
    if (mode == WIFI_MODE_AP)        esp_wifi_set_mode(WIFI_MODE_APSTA);
    else if (mode == WIFI_MODE_NULL) esp_wifi_set_mode(WIFI_MODE_STA);

    // STEP 1: Scan BEFORE disconnecting — radio is idle, no ESPHome reconnect
    // timer racing against us. Gives us BSSID+channel for a directed connect.
    uint8_t target_bssid[6] = {};
    uint8_t target_channel   = 0;
    bool    bssid_found      = false;

    wifi_scan_config_t scan_cfg = {};
    scan_cfg.show_hidden = 1;
    esp_err_t scan_err = esp_wifi_scan_start(&scan_cfg, true);
    if (scan_err == ESP_ERR_WIFI_CONN) {
        // Mid-connection — abort then retry scan
        esp_wifi_disconnect();
        vTaskDelay(pdMS_TO_TICKS(400));
        scan_err = esp_wifi_scan_start(&scan_cfg, true);
    }
    if (scan_err != ESP_OK) {
        printf("[WIFI] Scan failed: %d — aborting\n", scan_err);
        free(p); vTaskDelete(NULL); return;
    }

    uint16_t count = 0;
    esp_wifi_scan_get_ap_num(&count);
    printf("[WIFI] Scan found %d APs\n", count);
    if (count > 0) {
        wifi_ap_record_t *recs = (wifi_ap_record_t*)malloc(count * sizeof(wifi_ap_record_t));
        if (recs && esp_wifi_scan_get_ap_records(&count, recs) == ESP_OK) {
            for (int i = 0; i < (int)count; i++) {
                printf("[WIFI]  [%d] ssid='%s' rssi=%d\n", i, (char*)recs[i].ssid, recs[i].rssi);
                if (strcasecmp((char*)recs[i].ssid, p->ssid) == 0) {
                    memcpy(target_bssid, recs[i].bssid, 6);
                    target_channel = recs[i].primary;
                    bssid_found    = true;
                }
            }
        }
        free(recs);
    }

    if (bssid_found) {
        printf("[WIFI] Found '%s' at %02X:%02X:%02X:%02X:%02X:%02X ch=%d — directed connect\n",
               p->ssid,
               target_bssid[0], target_bssid[1], target_bssid[2],
               target_bssid[3], target_bssid[4], target_bssid[5], target_channel);
    } else {
        // Not seen in scan — may be hidden. ESP-IDF will probe all channels by SSID name.
        printf("[WIFI] '%s' not in scan — attempting directed probe (hidden network path)\n", p->ssid);
    }

    // STEP 2: Disconnect then connect
    esp_wifi_disconnect();
    vTaskDelay(pdMS_TO_TICKS(400));

    wifi_config_t cfg;
    memset(&cfg, 0, sizeof(cfg));
    strncpy((char*)cfg.sta.ssid, p->ssid, 32);
    strncpy((char*)cfg.sta.password, p->pass, 64);
    // WPA2/WPA3 transitional — works for phone hotspots (WPA3) and older routers
    cfg.sta.threshold.authmode = WIFI_AUTH_WPA2_PSK;
    cfg.sta.pmf_cfg.capable  = true;
    cfg.sta.pmf_cfg.required = false;
    // ALL_CHANNEL scan makes ESP-IDF send directed probe requests — hidden APs respond to these
    cfg.sta.scan_method = WIFI_ALL_CHANNEL_SCAN;

    if (bssid_found) {
        // Known BSSID+channel: skip scan, connect directly
        memcpy(cfg.sta.bssid, target_bssid, 6);
        cfg.sta.bssid_set = true;
        cfg.sta.channel   = target_channel;
    }
    // bssid_set = false (default) → ESP-IDF probes for the SSID across all channels

    esp_wifi_set_storage(WIFI_STORAGE_FLASH);

    esp_err_t err = ESP_FAIL;
    for (int i = 0; i < 20; i++) {
        err = esp_wifi_set_config(WIFI_IF_STA, &cfg);
        if (err == ESP_OK) { printf("[WIFI] set_config OK (attempt %d)\n", i + 1); break; }
        printf("[WIFI] set_config err=%d attempt %d, waiting...\n", err, i + 1);
        vTaskDelay(pdMS_TO_TICKS(150));
    }

    if (err == ESP_OK) {
        err = esp_wifi_connect();
        printf("[WIFI] esp_wifi_connect → %d\n", err);
    } else {
        printf("[WIFI] set_config never succeeded, aborting\n");
    }

    free(p);
    vTaskDelete(NULL);
}

// Connect using credentials entered in the LVGL textareas.
static void wifi_connect_from_ui(lv_obj_t *ssid_ta, lv_obj_t *pass_ta) {
    const char *ssid = lv_textarea_get_text(ssid_ta);
    const char *pass = lv_textarea_get_text(pass_ta);
    if (!ssid || ssid[0] == '\0') return;

    auto *args = static_cast<_WifiConnArgs*>(malloc(sizeof(_WifiConnArgs)));
    if (!args) return;
    strncpy(args->ssid, ssid, 32); args->ssid[32] = '\0';
    strncpy(args->pass, pass ? pass : "", 64); args->pass[64] = '\0';

    xTaskCreate(_wifi_connect_task, "wifi_conn", 4096, args, 5, nullptr);
}

inline void wifi_apply_ap_settings(bool active, const char* ssid, const char* pass) {
    ESP_LOGI("WIFI_AP", "=== apply_ap_settings: active=%s, ssid=%s ===", active?"YES":"NO", ssid?ssid:"(null)");

    wifi_mode_t mode;
    esp_err_t mode_err = esp_wifi_get_mode(&mode);
    // mode: 0=NULL 1=STA 2=AP 3=APSTA
    ESP_LOGI("WIFI_AP", "Current wifi mode: %d (get_mode err=%d/%s)", (int)mode, (int)mode_err, esp_err_to_name(mode_err));

    if (!active) {
        // Turning AP OFF — switch mode only, do NOT touch WIFI_IF_AP config after
        // the interface is gone (causes crash / serial disconnect).
        if (mode == WIFI_MODE_APSTA || mode == WIFI_MODE_AP) {
            ESP_LOGI("WIFI_AP", "Disabling AP: switching to STA mode...");
            wifi_mode_t target = (mode == WIFI_MODE_APSTA) ? WIFI_MODE_STA : WIFI_MODE_STA;
            esp_err_t err = esp_wifi_set_mode(target);
            ESP_LOGI("WIFI_AP", "set_mode(STA) → %d (%s)", (int)err, esp_err_to_name(err));
        } else {
            ESP_LOGI("WIFI_AP", "AP was not active (mode=%d), nothing to disable.", (int)mode);
        }
        ESP_LOGI("WIFI_AP", "=== AP OFF done ===");
        return;
    }

    // Turning AP ON — set mode first, then configure WIFI_IF_AP
    esp_wifi_set_storage(WIFI_STORAGE_FLASH);

    wifi_config_t conf;
    memset(&conf, 0, sizeof(wifi_config_t));

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

    ESP_LOGI("WIFI_AP", "AP config: ssid='%s' pass_len=%d authmode=%d",
             (char*)conf.ap.ssid, (int)strlen((char*)conf.ap.password), (int)conf.ap.authmode);

    if (mode == WIFI_MODE_STA) {
        ESP_LOGI("WIFI_AP", "Switching STA → APSTA");
        esp_err_t err = esp_wifi_set_mode(WIFI_MODE_APSTA);
        ESP_LOGI("WIFI_AP", "set_mode(APSTA) → %d (%s)", (int)err, esp_err_to_name(err));
    } else if (mode == WIFI_MODE_NULL) {
        ESP_LOGI("WIFI_AP", "Switching NULL → AP");
        esp_err_t err = esp_wifi_set_mode(WIFI_MODE_AP);
        ESP_LOGI("WIFI_AP", "set_mode(AP) → %d (%s)", (int)err, esp_err_to_name(err));
    } else {
        ESP_LOGI("WIFI_AP", "Mode already includes AP (%d), keeping it.", (int)mode);
    }

    esp_err_t err = esp_wifi_set_config(WIFI_IF_AP, &conf);
    if (err != ESP_OK) {
        ESP_LOGE("WIFI_AP", "FAILED to set AP config: %d (%s)", (int)err, esp_err_to_name(err));
    } else {
        ESP_LOGI("WIFI_AP", "AP config set OK: ssid='%s'", (char*)conf.ap.ssid);
    }
    ESP_LOGI("WIFI_AP", "=== AP ON done ===");
}
