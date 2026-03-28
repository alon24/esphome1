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
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_spiffs.h"

namespace esphome {
namespace react_spa {

static const char *const TAG = "react_spa";
static const char *const APP_PATH = "/spiffs/app.gz";
static const char *const SPIFFS_BASE = "/spiffs";

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
};

}  // namespace react_spa
}  // namespace esphome

#endif  // ARDUINO / ESP-IDF
