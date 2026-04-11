#pragma once
#include "esphome.h"
#include <ArduinoJson.h>

#ifdef ARDUINO
#include <AsyncTCP.h>
#include <ESPAsyncWebServer.h>
#include <LittleFS.h>
namespace esphome { namespace react_spa {
    static const char *const TAG = "react_spa";
    class ReactSPAComponent : public Component {
        public: void setup() override { LittleFS.begin(); }
    };
}}
#else

#include <algorithm>
#include <cctype>
#include <cstdio>
#include <cstring>
#include <dirent.h>
#include <sys/stat.h>
#include "esp_http_server.h"
#include "esp_log.h"
#include "esp_spiffs.h"
#include "esp_wifi.h"
#include "esp_netif.h"

// Forward declarations for grid configuration
void grid_config_save(const char* json_str);
void grid_config_save(const char* json_str, const char* name);
void grid_config_load();
void grid_config_load(const char* name);
void grid_list_screens(char* out, size_t max_len);
void slideshow_start();
void slideshow_stop();
void grid_config_get_json(char* out, size_t max_len);
void grid_panels_save(const char* json_str);
void system_settings_save();
extern bool g_ap_always_on;
extern char g_ap_ssid[33];
extern char g_ap_password[64];

extern char g_grid_json_cache[8192];

namespace esphome {
extern bool sd_card_is_mounted();

namespace react_spa {
static const char *const TAG = "react_spa";
static char g_active_app_path[128] = "/spiffs/ultimate.gz";
static const char *const SPIFFS_BASE = "/spiffs";
static const char *const ACTIVE_META_PATH = "/spiffs/active_app.txt";

static void json_escape(const char *in, char *out, size_t out_len) {
  size_t j = 0;
  for (size_t i = 0; in[i] && j + 2 < out_len; i++) {
    char c = in[i];
    if (c == '"' || c == '\\') out[j++] = '\\';
    out[j++] = c;
  }
  out[j] = '\0';
}

static void url_decode(char *dst, const char *src) {
  char a, b;
  while (*src) {
    if ((*src == '%') && ((a = src[1]) && (b = src[2])) && (isxdigit(a) && isxdigit(b))) {
      if (a >= 'a') a -= 'a' - 'A';
      if (a >= 'A') a -= ('A' - 10); else a -= '0';
      if (b >= 'a') b -= 'a' - 'A';
      if (b >= 'A') b -= ('A' - 10); else b -= '0';
      *dst++ = 16 * a + b;
      src += 3;
    } else if (*src == '+') {
      *dst++ = ' ';
      src++;
    } else {
      *dst++ = *src++;
    }
  }
  *dst++ = '\0';
}

class ReactSPAComponent : public Component {
 public:
  void set_port(uint16_t port) { port_ = port; }

  void load_active_path() {
      FILE *f = fopen(ACTIVE_META_PATH, "r");
      if (f) {
          char buf[128];
          if (fgets(buf, sizeof(buf), f)) {
              size_t len = strlen(buf);
              while(len > 0 && (buf[len-1] == '\n' || buf[len-1] == '\r')) buf[--len] = 0;
              if (len > 5) {
                  strncpy(g_active_app_path, buf, sizeof(g_active_app_path)-1);
                  ESP_LOGI(TAG, "Dynamic SPA active: %s", g_active_app_path);
              }
          }
          fclose(f);
      }
  }

  void setup() override {
    load_active_path();

    httpd_config_t config = HTTPD_DEFAULT_CONFIG();
    config.server_port = port_;
    config.uri_match_fn = httpd_uri_match_wildcard;
    config.max_uri_handlers = 30;

    if (httpd_start(&server_, &config) != ESP_OK) return;

    // --- SYSTEM ENDPOINTS ---
    auto reg = [&](const char* uri, httpd_method_t method, esp_err_t (*handler)(httpd_req_t *)) {
        httpd_uri_t h = { .uri = uri, .method = method, .handler = handler, .user_ctx = this };
        httpd_register_uri_handler(server_, &h);
    };

    ESP_LOGI(TAG, "Starting HTTP server on port %d", port_);

    reg("/upload", HTTP_POST, upload_handler);
    reg("/api/health", HTTP_GET, [](httpd_req_t *req) { return httpd_resp_sendstr(req, "{\"status\":\"ok\"}"); });
    reg("/api/spa/info", HTTP_GET, [](httpd_req_t *req) {
        char json[256];
        snprintf(json, sizeof(json), "{\"file\":\"%s\"}", g_active_app_path);
        httpd_resp_set_type(req, "application/json");
        return httpd_resp_sendstr(req, json);
    });

    // --- WIFI ENDPOINTS ---
    reg("/api/wifi/status", HTTP_GET, wifi_status_handler);
    reg("/api/wifi/scan", HTTP_GET, wifi_scan_handler);
    reg("/api/wifi/connect", HTTP_POST, wifi_connect_handler);
    reg("/api/wifi/ap", HTTP_POST, wifi_ap_handler);

    reg("/api/grid/screens", HTTP_GET, [](httpd_req_t *req) {
        char* buf = (char*)malloc(2048);
        ::grid_list_screens(buf, 2048);
        httpd_resp_set_type(req, "application/json");
        esp_err_t res = httpd_resp_sendstr(req, buf);
        free(buf);
        return res;
    });

    reg("/api/grid/config", HTTP_GET, [](httpd_req_t *req) {
        char name[64] = "";
        char query[128];
        if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
            httpd_query_key_value(query, "name", name, sizeof(name));
        }
        if (strlen(name) > 0) {
           ::grid_config_load(name); // Immediate load from disk if switching
        }
        httpd_resp_set_type(req, "application/json");
        return httpd_resp_sendstr(req, g_grid_json_cache);
    });

    reg("/api/grid/config", HTTP_POST, [](httpd_req_t *req) {
        char name[64] = "";
        char query[128];
        if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
            httpd_query_key_value(query, "name", name, sizeof(name));
        }
        int total = (int)req->content_len;
        char *body = (char*)malloc(total + 1);
        httpd_req_recv(req, body, total);
        body[total] = '\0';
        ::grid_config_save(body, name);
        free(body);
        return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
    });

    reg("/api/grid/panels", HTTP_POST, [](httpd_req_t *req) {
        int total = (int)req->content_len;
        char *body = (char*)malloc(total + 1);
        httpd_req_recv(req, body, total);
        body[total] = '\0';
        grid_panels_save(body);
        free(body);
        return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
    });

    // --- SD ENDPOINTS ---
    reg("/api/sd/list", HTTP_GET, sd_list_handler);
    reg("/api/sd/file/*", HTTP_GET, sd_file_handler);
    reg("/api/sd/upload", HTTP_POST, sd_upload_handler);
    reg("/api/sd/delete", HTTP_POST, sd_delete_handler);

    reg("/api/slideshow/start", HTTP_POST, [](httpd_req_t *req) {
        slideshow_start();
        return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
    });

    reg("/api/slideshow/stop", HTTP_POST, [](httpd_req_t *req) {
        slideshow_stop();
        return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
    });

    reg("/*", HTTP_GET, root_handler);
  }

  static esp_err_t root_handler(httpd_req_t *req) {
    ESP_LOGI(TAG, "Root handler called for URI: %s", req->uri);
    FILE *f = fopen(g_active_app_path, "r");
    if (!f) {
        ESP_LOGW(TAG, "File not found: %s", g_active_app_path);
        return httpd_resp_sendstr(req, "<html><body><h2>No app discovered.</h2></body></html>");
    }
    httpd_resp_set_type(req, "text/html");
    httpd_resp_set_hdr(req, "Content-Encoding", "gzip");
    httpd_resp_set_hdr(req, "Cache-Control", "no-cache, no-store, must-revalidate");
    char buf[1024]; size_t n;
    while ((n = fread(buf, 1, sizeof(buf), f)) > 0) httpd_resp_send_chunk(req, buf, (ssize_t)n);
    fclose(f);
    return httpd_resp_send_chunk(req, nullptr, 0);
  }

  static esp_err_t upload_handler(httpd_req_t *req) {
    char target_path[128] = "/spiffs/ultimate.gz";
    char query[128];
    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        char name_val[128];
        if (httpd_query_key_value(query, "name", name_val, sizeof(name_val)) == ESP_OK) {
            snprintf(target_path, sizeof(target_path), "/spiffs/%s", name_val);
        }
    }
    FILE *f = fopen(target_path, "w");
    if (!f) return HTTPD_500_INTERNAL_SERVER_ERROR;
    char buf[1024]; int remaining = (int)req->content_len;
    while (remaining > 0) {
      int received = httpd_req_recv(req, buf, std::min(remaining, (int)sizeof(buf)));
      if (received <= 0) { fclose(f); remove(target_path); return ESP_FAIL; }
      fwrite(buf, 1, received, f);
      remaining -= received;
    }
    fclose(f);
    FILE *meta = fopen(ACTIVE_META_PATH, "w");
    if (meta) { fputs(target_path, meta); fclose(meta); }
    strncpy(g_active_app_path, target_path, sizeof(g_active_app_path)-1);
    return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
  }

  static esp_err_t wifi_status_handler(httpd_req_t *req) {
    esp_netif_ip_info_t ip_info;
    esp_netif_t *netif = esp_netif_get_handle_from_ifkey("WIFI_STA_DEF");
    char ip_str[16] = "0.0.0.0";
    bool connected = false;
    if (netif) { 
        esp_netif_get_ip_info(netif, &ip_info); 
        snprintf(ip_str, sizeof(ip_str), IPSTR, IP2STR(&ip_info.ip));
        connected = (ip_info.ip.addr != 0);
    }
    
    wifi_mode_t mode;
    esp_wifi_get_mode(&mode);
    bool ap_active = (mode == WIFI_MODE_AP || mode == WIFI_MODE_APSTA);
    
    char json[512]; 
    snprintf(json, sizeof(json), "{\"connected\":%s,\"ip\":\"%s\",\"ap_active\":%s,\"ap_always_on\":%s,\"ap_ssid\":\"%s\"}", 
             connected?"true":"false", ip_str, ap_active?"true":"false", ::g_ap_always_on?"true":"false", ::g_ap_ssid);
    httpd_resp_set_type(req, "application/json");
    return httpd_resp_sendstr(req, json);
  }

  static esp_err_t wifi_ap_handler(httpd_req_t *req) {
    int total = (int)req->content_len;
    if (total <= 0 || total > 1024) return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Invalid");
    char *body = (char*)malloc(total + 1);
    httpd_req_recv(req, body, total);
    body[total] = '\0';

    JsonDocument doc;
    deserializeJson(doc, body);
    
    if (doc.containsKey("always_on")) ::g_ap_always_on = doc["always_on"];
    if (doc.containsKey("ssid")) strncpy(::g_ap_ssid, doc["ssid"] | "GRIDOS_AP", 31);
    if (doc.containsKey("password")) strncpy(::g_ap_password, doc["password"] | "", 63);
    
    wifi_mode_t mode;
    esp_wifi_get_mode(&mode);
    
    // Apply SSID/Password to ESP-IDF
    wifi_config_t conf = {};
    esp_wifi_get_config(WIFI_IF_AP, &conf);
    strncpy((char*)conf.ap.ssid, ::g_ap_ssid, 32);
    strncpy((char*)conf.ap.password, ::g_ap_password, 64);
    conf.ap.ssid_len = strlen(::g_ap_ssid);
    conf.ap.authmode = (strlen(::g_ap_password) > 7) ? WIFI_AUTH_WPA2_PSK : WIFI_AUTH_OPEN;
    esp_wifi_set_config(WIFI_IF_AP, &conf);

    if (doc.containsKey("active")) {
        bool active = doc["active"];
        if (active) esp_wifi_set_mode((mode == WIFI_MODE_STA) ? WIFI_MODE_APSTA : mode);
        else esp_wifi_set_mode((mode == WIFI_MODE_APSTA) ? WIFI_MODE_STA : mode);
    }
    
    ::system_settings_save();
    free(body);
    return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
  }

  static esp_err_t wifi_connect_handler(httpd_req_t *req) {
    int total = (int)req->content_len;
    if (total <= 0 || total > 1024) return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Too big");
    char *body = (char*)malloc(total + 1);
    httpd_req_recv(req, body, total);
    body[total] = '\0';
    ESP_LOGI(TAG, "WiFi Connect requested: %s", body);
    free(body);
    return httpd_resp_sendstr(req, "{\"status\":\"pending\"}");
  }

  static esp_err_t wifi_scan_handler(httpd_req_t *req) {
    wifi_scan_config_t cfg = {}; esp_wifi_scan_start(&cfg, true);
    uint16_t count = 0; esp_wifi_scan_get_ap_num(&count);
    if (count > 10) count = 10;
    wifi_ap_record_t *recs = (wifi_ap_record_t *)malloc(count * sizeof(wifi_ap_record_t));
    esp_wifi_scan_get_ap_records(&count, recs);
    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr_chunk(req, "{\"networks\":[");
    for (int i = 0; i < count; i++) {
        char entry[128]; snprintf(entry, sizeof(entry), "%s{\"ssid\":\"%s\",\"rssi\":%d}", (i==0)?"":",", recs[i].ssid, recs[i].rssi);
        httpd_resp_sendstr_chunk(req, entry);
    }
    free(recs); httpd_resp_sendstr_chunk(req, "]}");
    return httpd_resp_send_chunk(req, nullptr, 0);
  }

  static esp_err_t sd_list_handler(httpd_req_t *req) {
    char query[256]; char rel_path[128] = "";
    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        char val[128];
        if (httpd_query_key_value(query, "path", val, sizeof(val)) == ESP_OK) {
            url_decode(rel_path, val);
        }
    }
    char full_path[160] = "/sdcard";
    if (strlen(rel_path) > 0) snprintf(full_path, sizeof(full_path), "/sdcard/%s", rel_path);

    httpd_resp_set_type(req, "application/json");
    httpd_resp_sendstr_chunk(req, "{\"files\":[");
    DIR *dir = opendir(full_path);
    if (dir) {
        struct dirent *e; bool first = true;
        while ((e = readdir(dir)) != NULL) {
            if (e->d_name[0] == '.') continue;
            char entry[256]; 
            bool is_dir = (e->d_type == DT_DIR);
            if (e->d_type == DT_UNKNOWN) {
                char check_path[300]; snprintf(check_path, sizeof(check_path), "%s/%s", full_path, e->d_name);
                struct stat st;
                if (stat(check_path, &st) == 0) is_dir = S_ISDIR(st.st_mode);
            }
            snprintf(entry, sizeof(entry), "%s{\"name\":\"%s\",\"isDir\":%s}", first?"":",", e->d_name, is_dir?"true":"false");
            httpd_resp_sendstr_chunk(req, entry); first = false;
        }
        closedir(dir);
    }
    httpd_resp_sendstr_chunk(req, "]}");
    return httpd_resp_send_chunk(req, nullptr, 0);
  }

  static esp_err_t sd_file_handler(httpd_req_t *req) {
    const char *uri_filename = req->uri + strlen("/api/sd/file/");
    char filename[128]; url_decode(filename, uri_filename);
    char path[160]; snprintf(path, sizeof(path), "/sdcard/%s", filename);
    FILE *f = fopen(path, "r");
    if (!f) return httpd_resp_send_err(req, HTTPD_404_NOT_FOUND, "File missing");
    httpd_resp_set_type(req, "application/octet-stream");
    char buf[4096]; size_t n;
    while ((n = fread(buf, 1, sizeof(buf), f)) > 0) httpd_resp_send_chunk(req, buf, (ssize_t)n);
    fclose(f);
    return httpd_resp_send_chunk(req, nullptr, 0);
  }

  static esp_err_t sd_upload_handler(httpd_req_t *req) {
    char query[256]; char rel_path[128] = "upload.tmp";
    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        char val[128];
        if (httpd_query_key_value(query, "path", val, sizeof(val)) == ESP_OK) {
            url_decode(rel_path, val);
        }
    }
    char full_path[160]; snprintf(full_path, sizeof(full_path), "/sdcard/%s", rel_path);
    ESP_LOGI(TAG, "SD Upload: %s", full_path);
    FILE *f = fopen(full_path, "w");
    if (!f) return httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "File open failed");
    char buf[4096]; int remaining = (int)req->content_len;
    while (remaining > 0) {
        int received = httpd_req_recv(req, buf, std::min(remaining, (int)sizeof(buf)));
        if (received <= 0) { fclose(f); remove(full_path); return ESP_FAIL; }
        fwrite(buf, 1, received, f);
        remaining -= received;
    }
    fclose(f);
    return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
  }

  static esp_err_t sd_delete_handler(httpd_req_t *req) {
    char query[256]; char rel_path[128] = "";
    if (httpd_req_get_url_query_str(req, query, sizeof(query)) == ESP_OK) {
        char val[128];
        if (httpd_query_key_value(query, "path", val, sizeof(val)) == ESP_OK) {
            url_decode(rel_path, val);
        }
    }
    if (strlen(rel_path) == 0) return httpd_resp_send_err(req, HTTPD_400_BAD_REQUEST, "Missing path");
    char full_path[160]; snprintf(full_path, sizeof(full_path), "/sdcard/%s", rel_path);
    ESP_LOGI(TAG, "SD Delete: %s", full_path);
    if (remove(full_path) == 0) return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
    if (rmdir(full_path) == 0) return httpd_resp_sendstr(req, "{\"status\":\"ok\"}");
    return httpd_resp_send_err(req, HTTPD_500_INTERNAL_SERVER_ERROR, "Delete failed");
  }

  float get_setup_priority() const override { return setup_priority::AFTER_WIFI; }
 private:
  uint16_t port_{80};
  httpd_handle_t server_{nullptr};
};
}}
#endif
