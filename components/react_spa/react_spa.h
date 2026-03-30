#pragma once
#include "esphome.h"

// ─── Arduino path (ESP32 + ESP8266) ──────────────────────────────────────────
#ifdef ARDUINO

#ifdef ESP32
#include <AsyncTCP.h>
#elif defined(ESP8266)
#include <ESPAsyncTCP.h>
#endif
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>

namespace esphome {
namespace react_spa {

static const char *const TAG = "react_spa";
static const char *const APP_PATH = "/app.gz";

class ReactSPAComponent : public Component {
 public:
  void set_port(uint16_t port) { port_ = port; }

  void setup() override {
    if (!LittleFS.begin(true)) {
      ESP_LOGE(TAG, "LittleFS mount failed");
      return;
    }
    ESP_LOGI(TAG, "LittleFS mounted. Free: %u bytes", LittleFS.totalBytes() - LittleFS.usedBytes());

    server_ = new AsyncWebServer(port_);

    // Serve React SPA — all GETs return the gzip bundle
    server_->onNotFound([](AsyncWebServerRequest *req) {
      if (req->method() != HTTP_GET) {
        req->send(405, "text/plain", "Method Not Allowed");
        return;
      }
      if (!LittleFS.exists(APP_PATH)) {
        req->send(200, "text/html",
                  "<html><body><h2>No app uploaded yet.</h2>"
                  "<p>Run <code>scripts/upload.sh</code> to deploy.</p></body></html>");
        return;
      }
      AsyncWebServerResponse *resp =
          req->beginResponse(LittleFS, APP_PATH, "text/html");
      resp->addHeader("Content-Encoding", "gzip");
      resp->addHeader("Cache-Control", "no-cache, no-store");
      req->send(resp);
    });

    // Upload new webapp — POST /upload with raw gzip body
    server_->on(
        "/upload", HTTP_POST,
        [](AsyncWebServerRequest *req) {
          req->send(200, "application/json", "{\"status\":\"ok\"}");
        },
        nullptr,
        [](AsyncWebServerRequest *req, uint8_t *data, size_t len, size_t index, size_t total) {
          static File upload_file;
          if (index == 0) {
            ESP_LOGI(TAG, "Upload start, total=%u bytes", total);
            upload_file = LittleFS.open(APP_PATH, "w");
          }
          if (upload_file) {
            upload_file.write(data, len);
          }
          if (index + len >= total) {
            if (upload_file) {
              upload_file.close();
              ESP_LOGI(TAG, "Upload complete (%u bytes)", total);
            }
          }
        });

    // Health check
    server_->on("/api/health", HTTP_GET, [](AsyncWebServerRequest *req) {
      req->send(200, "application/json", "{\"status\":\"ok\"}");
    });

    server_->begin();
    ESP_LOGI(TAG, "HTTP server started on port %u", port_);
  }

  float get_setup_priority() const override { return setup_priority::AFTER_WIFI; }

 private:
  uint16_t port_{80};
  AsyncWebServer *server_{nullptr};
};

}  // namespace react_spa
}  // namespace esphome

// ─── ESP-IDF path (ESP32-S3 + esp-idf framework) ─────────────────────────────
#else

#include <algorithm>
#include <cstdio>
#include <cstring>
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_spiffs.h"
#include "esp_wifi.h"
#include "esp_netif.h"

namespace esphome {
namespace react_spa {

static const char *const TAG = "react_spa";
static const char *const APP_PATH = "/spiffs/app.gz";
static const char *const SPIFFS_BASE = "/spiffs";

// Extract a JSON string value — simple, no escape handling needed for SSIDs/passwords
static bool extract_json_string(const char *json, const char *key, char *out, size_t out_len) {
  char search[72];
  snprintf(search, sizeof(search), "\"%s\":\"", key);
  const char *p = strstr(json, search);
  if (!p) return false;
  p += strlen(search);
  const char *end = strchr(p, '"');
  if (!end) return false;
  size_t len = (size_t)(end - p);
  if (len >= out_len) len = out_len - 1;
  memcpy(out, p, len);
  out[len] = '\0';
  return true;
}

// Escape a string for JSON — handles " and backslash
static void json_escape(const char *in, char *out, size_t out_len) {
  size_t j = 0;
  for (size_t i = 0; in[i] && j + 2 < out_len; i++) {
    char c = in[i];
    if (c == '"' || c == '\\') out[j++] = '\\';
    out[j++] = c;
  }
  out[j] = '\0';
}

class ReactSPAComponent : public Component {
 public:
  void set_port(uint16_t port) { port_ = port; }

  void setup() override {
    esp_vfs_spiffs_conf_t conf = {
        .base_path = SPIFFS_BASE,
        .partition_label = nullptr,
        .max_files = 5,
        .format_if_mount_failed = true,
    };
    esp_err_t ret = esp_vfs_spiffs_register(&conf);
    if (ret != ESP_OK) {
      ESP_LOGE(TAG, "SPIFFS mount failed: %s", esp_err_to_name(ret));
      return;
    }

    size_t total = 0, used = 0;
    esp_spiffs_info(nullptr, &total, &used);
    ESP_LOGI(TAG, "SPIFFS mounted. Total: %u, Used: %u", total, used);

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = port_;
    config.uri_match_fn = httpd_uri_match_wildcard;
    config.max_open_sockets = 7;
    config.stack_size = 8192;
    config.max_uri_handlers = 12;

    if (httpd_start(&server_, &config) != ESP_OK) {
      ESP_LOGE(TAG, "Failed to start HTTP server");
      return;
    }

    httpd_uri_t upload_uri = {
        .uri = "/upload",
        .method = HTTP_POST,
        .handler = upload_handler,
        .user_ctx = nullptr,
    };
    httpd_register_uri_handler(server_, &upload_uri);

    httpd_uri_t health_uri = {
        .uri = "/api/health",
        .method = HTTP_GET,
        .handler = health_handler,
        .user_ctx = nullptr,
    };
    httpd_register_uri_handler(server_, &health_uri);

    httpd_uri_t wifi_status_uri = {
        .uri = "/api/wifi/status",
        .method = HTTP_GET,
        .handler = wifi_status_handler,
        .user_ctx = nullptr,
    };
    httpd_register_uri_handler(server_, &wifi_status_uri);

    httpd_uri_t wifi_scan_uri = {
        .uri = "/api/wifi/scan",
        .method = HTTP_GET,
        .handler = wifi_scan_handler,
        .user_ctx = nullptr,
    };
    httpd_register_uri_handler(server_, &wifi_scan_uri);

    httpd_uri_t wifi_connect_uri = {
        .uri = "/api/wifi/connect",
        .method = HTTP_POST,
        .handler = wifi_connect_handler,
        .user_ctx = nullptr,
    };
    httpd_register_uri_handler(server_, &wifi_connect_uri);

    httpd_uri_t root_uri = {
        .uri = "/*",
        .method = HTTP_GET,
        .handler = root_handler,
        .user_ctx = nullptr,
    };
    httpd_register_uri_handler(server_, &root_uri);

    ESP_LOGI(TAG, "HTTP server started on port %u", port_);
  }

  float get_setup_priority() const override { return setup_priority::AFTER_WIFI; }

 private:
  uint16_t port_{80};
  httpd_handle_t server_{nullptr};

  static esp_err_t root_handler(httpd_req_t *req) {
    FILE *f = fopen(APP_PATH, "r");
    if (!f) {
      const char *msg =
          "<html><body><h2>No app uploaded yet.</h2>"
          "<p>Run <code>scripts/upload.sh</code> to deploy.</p></body></html>";
      httpd_resp_set_type(req, "text/html");
      httpd_resp_sendstr(req, msg);
      return ESP_OK;
    }
    httpd_resp_set_type(req, "text/html");
    httpd_resp_set_hdr(req, "Content-Encoding", "gzip");
    httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store");

    char buf[1024];
    size_t n;
    while ((n = fread(buf, 1, sizeof(buf), f)) > 0) {
      httpd_resp_send_chunk(req, buf, (ssize_t) n);
    }
    fclose(f);
    httpd_resp_send_chunk(req, nullptr, 0);
    return ESP_OK;
  }

  static esp_err_t upload_handler(httpd_req_t *req) {
    FILE *f = fopen(APP_PATH, "w");
    if (!f) {
      httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Cannot open file");
      return ESP_FAIL;
    }
    char buf[1024];
    int remaining = (int) req->content_len;
    ESP_LOGI(TAG, "Upload start, total=%d bytes", remaining);
    while (remaining > 0) {
      int to_recv = std::min(remaining, (int) sizeof(buf));
      int received = httpd_req_recv(req, buf, to_recv);
      if (received <= 0) {
        fclose(f);
        remove(APP_PATH);
        httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Receive error");
        return ESP_FAIL;
      }
      fwrite(buf, 1, received, f);
      remaining -= received;
    }
    fclose(f);
    ESP_LOGI(TAG, "Upload complete (%d bytes)", (int) req->content_len);
    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
    return ESP_OK;
  }

  static esp_err_t health_handler(httpd_req_t *req) {
    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
    return ESP_OK;
  }

  // GET /api/wifi/status → {"connected":bool,"ip":"x.x.x.x","ssid":"..."}
  static esp_err_t wifi_status_handler(httpd_req_t *req) {
    wifi_ap_record_t ap_info = {};
    bool connected = (esp_wifi_sta_get_ap_info(&ap_info) == ESP_OK);

    char ip_str[16] = "";
    if (connected) {
      esp_netif_ip_info_t ip_info;
      esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
      if (netif && esp_netif_get_ip_info(netif, &ip_info) == ESP_OK)
        snprintf(ip_str, sizeof(ip_str), IPSTR, IP2STR(&ip_info.ip));
    }

    char ssid_esc[72] = "";
    if (connected) json_escape((char *)ap_info.ssid, ssid_esc, sizeof(ssid_esc));

    char json[256];
    snprintf(json, sizeof(json),
             "{\"connected\":%s,\"ip\":\"%s\",\"ssid\":\"%s\"}",
             connected ? "true" : "false", ip_str, ssid_esc);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr(req, json);
    return ESP_OK;
  }

  // GET /api/wifi/scan → {"networks":[{"ssid":"...","rssi":-55,"auth":3},...]}
  // Blocks ~2-3 s while scanning.
  static esp_err_t wifi_scan_handler(httpd_req_t *req) {
    wifi_scan_config_t cfg = {};
    cfg.show_hidden = 0;
    esp_wifi_scan_start(&cfg, true);

    uint16_t count = 0;
    esp_wifi_scan_get_ap_num(&count);
    if (count > 20) count = 20;

    httpd_resp_set_type(req, "application/json");

    if (count == 0) {
      httpd_resp_sendstr(req, "{\"networks\":[]}");
      return ESP_OK;
    }

    wifi_ap_record_t *recs = (wifi_ap_record_t *)malloc(count * sizeof(wifi_ap_record_t));
    if (!recs) {
      httpd_resp_sendstr(req, "{\"networks\":[]}");
      return ESP_OK;
    }
    esp_wifi_scan_get_ap_records(&count, recs);

    httpd_resp_sendstr_chunk(req, "{\"networks\":[");
    bool first = true;
    for (int i = 0; i < count; i++) {
      if (recs[i].ssid[0] == '\0') continue;

      char ssid_esc[72] = "";
      json_escape((char *)recs[i].ssid, ssid_esc, sizeof(ssid_esc));

      char entry[160];
      snprintf(entry, sizeof(entry),
               "%s{\"ssid\":\"%s\",\"rssi\":%d,\"auth\":%d}",
               first ? "" : ",",
               ssid_esc, (int)recs[i].rssi, (int)recs[i].authmode);
      httpd_resp_sendstr_chunk(req, entry);
      first = false;
    }
    free(recs);

    httpd_resp_sendstr_chunk(req, "]}");
    httpd_resp_send_chunk(req, nullptr, 0);
    return ESP_OK;
  }

  // POST /api/wifi/connect  body: {"ssid":"...","password":"..."}
  static esp_err_t wifi_connect_handler(httpd_req_t *req) {
    int total = (int)req->content_len;
    if (total <= 0 || total > 512) {
      httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Bad request");
      return ESP_FAIL;
    }

    char *body = (char *)malloc(total + 1);
    if (!body) {
      httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "OOM");
      return ESP_FAIL;
    }

    int received = httpd_req_recv(req, body, total);
    if (received != total) {
      free(body);
      httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Recv error");
      return ESP_FAIL;
    }
    body[total] = '\0';

    char ssid[64] = {};
    char pass[64] = {};
    extract_json_string(body, "ssid", ssid, sizeof(ssid));
    extract_json_string(body, "password", pass, sizeof(pass));
    free(body);

    if (ssid[0] == '\0') {
      httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "SSID required");
      return ESP_FAIL;
    }

    wifi_config_t cfg = {};
    strncpy((char *)cfg.sta.ssid, ssid, sizeof(cfg.sta.ssid) - 1);
    if (pass[0]) strncpy((char *)cfg.sta.password, pass, sizeof(cfg.sta.password) - 1);
    cfg.sta.threshold.authmode = pass[0] ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;

    esp_wifi_disconnect();
    esp_wifi_set_config(WIFI_IF_STA, &cfg);
    esp_wifi_connect();

    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr(req, "{\"status\":\"connecting\"}");
    return ESP_OK;
  }
};

}  // namespace react_spa
}  // namespace esphome

#endif  // ARDUINO / ESP-IDF
