# GRIDOS — Migration Plan: ESPHome 2026.3 → 2026.4+
## Critical Code Review & Upgrade TODO

> **Reviewer posture: "Bad Cop"**
> This codebase was assembled quickly via AI pair-programming. The goal of this document is not
> to celebrate what works — it is to catalogue every fragile pattern, guaranteed bug, and latent
> time-bomb before they become production failures during or after the upgrade.
> **Every item here is a real problem.** Nothing is hypothetical.

---

## PHASE 0 — Before You Touch Anything: Fix These Bugs RIGHT NOW

These issues exist in the **current build** and will cause failures on long uptime or on the new version.

### 🔴 CRITICAL — Memory Leak + Dangling Pointer on Every Screen Navigation

**File:** `custom/tab_home.h` ~line 305

```cpp
GridItem *persist_it = new GridItem(it);         // heap alloc, NEVER FREED
lv_obj_set_user_data(obj, persist_it);
mqtt::global_mqtt_client->subscribe(it.mqttTopic, [obj, persist_it](...) {
    lv_slider_set_value(obj, ...);               // obj is DANGLING after lv_obj_del()
});
```

**Problems:**
- `new GridItem(it)` is never `delete`d. Every screen switch leaks one allocation per MQTT widget.
- The MQTT lambda captures `lv_obj_t *obj` by value. After `lv_obj_del()` (called on every nav), `obj` is a dangling pointer. The next MQTT message calling `lv_slider_set_value(obj, ...)` on a freed object **will crash or corrupt memory**.
- There is no `LV_EVENT_DELETE` handler to clean up the `GridItem*`.

**Fix:** Register an `LV_EVENT_DELETE` callback that `delete`s `persist_it` and unsubscribes the MQTT topic before the object is freed.

---

### 🔴 CRITICAL — `strdup()` and `lv_obj_set_user_data` Conflict → Heap Corruption

**File:** `custom/tab_home.h` ~lines 298–306

```cpp
char *persist_act = strdup(it.action.c_str());
lv_obj_add_event_cb(obj, _item_event_cb, LV_EVENT_CLICKED, persist_act);
// ...then later, for MQTT:
lv_obj_set_user_data(obj, persist_it);  // ← Overwrites nothing, but...
```

`_item_event_cb` frees the action string on `LV_EVENT_DELETE` by reading `lv_event_get_user_data(e)`. In LVGL 8+, event user_ctx and `lv_obj_set_user_data` are **different slots** — but the code reads the wrong one if refactored carelessly. The current code is fragile and one line away from `free()`-ing a `GridItem*` as if it were a `char*`. **Heap corruption, silent and intermittent.**

**Fix:** Audit every `lv_obj_get_user_data` call site to confirm which data it is actually reading.

---

### 🔴 CRITICAL — HTTP Body Not Fully Read (3 Locations)

**File:** `components/react_spa/react_spa.h` ~lines 192–197, 204–208

```cpp
int total = (int)req->content_len;
char *body = (char*)malloc(total + 1);
httpd_req_recv(req, body, total);  // ← Single call, NOT guaranteed to get all bytes
body[total] = '\0';
```

`httpd_req_recv()` is NOT a stream-complete guarantee on ESP-IDF. For payloads over ~1400 bytes (one TCP segment), it will return partial data. Saving a truncated JSON to SPIFFS corrupts the screen config. The device then fails to render the screen on next boot.

**Fix:** Loop until all bytes are received:
```cpp
int received = 0;
while (received < total) {
    int r = httpd_req_recv(req, body + received, total - received);
    if (r <= 0) break;
    received += r;
}
```

---

### 🔴 CRITICAL — MQTT Callback Writes to LVGL from Non-LVGL Task

**File:** `custom/tab_home.h` ~line 310

```cpp
mqtt::global_mqtt_client->subscribe(it.mqttTopic, [obj, persist_it](const std::string &topic, const std::string &payload) {
    lv_slider_set_value(obj, atoi(payload.c_str()), LV_ANIM_ON);  // ← NOT safe. LVGL is not thread-safe.
    lv_label_set_text(obj, payload.c_str());
});
```

LVGL is single-threaded. The MQTT callback runs on the network task. Calling LVGL APIs from there causes render tree corruption, graphical glitches, and occasional panics. It works sometimes only due to lucky task scheduling on a single lightly-loaded device.

**Fix:** Use `lv_async_call()` to defer the LVGL call back to the LVGL task:
```cpp
struct MqttLvglUpdate { lv_obj_t *obj; int val; };
lv_async_call([](void *arg) {
    auto *u = (MqttLvglUpdate*)arg;
    lv_slider_set_value(u->obj, u->val, LV_ANIM_ON);
    delete u;
}, new MqttLvglUpdate{obj, atoi(payload.c_str())});
```

---

### 🟠 HIGH — `grid_config_load()` Called from HTTP Task (Data Race)

**File:** `components/react_spa/react_spa.h` ~line 197

```cpp
::grid_config_save(body, name);
::ui_navigate_to(name);  // ← calls grid_config_load() from HTTP task
```

`grid_config_load()` modifies global `std::vector<GridItem> g_grid_items` from the HTTP task.
`ui_refresh_grid()` reads those vectors from the LVGL/main task via `grid_config_tick()`.
`g_grid_needs_refresh` is a plain `bool`, not `std::atomic<bool>`. **Data race — undefined behavior.**

**Fix:** HTTP handlers must only set a flag. The main loop calls `grid_config_load()` on the next tick.

---

### 🟠 HIGH — `g_grid_json_cache[8192]` — Buffer Too Small, Silently Truncates

**File:** `custom/grid_config.h` line 45

A screen with 10+ widgets easily exceeds 8KB. `strncpy` silently truncates. The `/api/grid/config` GET then returns corrupt JSON to the web UI. Items are silently lost when re-fetched from device. The `__attribute__((weak))` is also suspicious — if any other TU defines this symbol, the buffer silently disappears.

**Fix:** Increase to 65535 or allocate from PSRAM at runtime.

---

### 🟠 HIGH — `using namespace esphome;` in a Header File

**File:** `custom/tab_home.h` line 7

```cpp
using namespace esphome;
```

This pollutes every translation unit that includes `tab_home.h`. When ESPHome 2026.4 adds new symbols to its namespace, this **will** cause ambiguous name resolution errors at compile time. It makes the upgrade to every future version harder.

**Fix:** Remove. Use `esphome::mqtt::global_mqtt_client` explicitly.

---

## PHASE 1 — ESPHome 2026.4 Framework API Changes

### 1.1 — `CORE.using_esp_idf` Deprecated (Breaking in 2026.6)

**File:** `components/react_spa/__init__.py` line 37

```python
elif CORE.using_esp_idf:   # ← DEPRECATED since 2026.1
    include_builtin_idf_component("spiffs")
```

If not fixed before 2026.6, the SPIFFS IDF component won't be linked. SPIFFS won't mount. All screen configs and the SPA binary become inaccessible. **Device boots to blank screen.**

**Fix:**
```python
elif CORE.is_esp32:
    include_builtin_idf_component("spiffs")
```

---

### 1.2 — Hardcoded PlatformIO SPIFFS Include Path Will Rot

**File:** `components/react_spa/__init__.py` lines 41–45

```python
spiffs_includes = glob.glob(
    os.path.expanduser("~/.platformio/packages/framework-espidf/components/spiffs/include")
)
if spiffs_includes:
    cg.add_build_flag(f"-I{spiffs_includes[0]}")
```

The `if spiffs_includes:` silently swallows the failure if the path doesn't exist (e.g., when pioarduino updates its ESP-IDF version). Build then fails with `esp_spiffs.h: No such file or directory` — after a 2-minute compile wait.

**Fix:** Make the glob use a pattern with a version wildcard, or use `cg.add_platformio_option` instead.

---

### 1.3 — CORS Wildcard Registration Order: Wildcard `"/api/*"` Registered Before Specific Routes

**File:** `components/react_spa/react_spa.h` lines 140, 144

```cpp
reg("/api/*", HTTP_OPTIONS, cors_handler);     // Registered FIRST
// ...
httpd_register_uri_handler(server_, &uri_files); // "/api/files" registered AFTER
```

In ESP-IDF 5.5 (backing 2026.4), `httpd_uri_match_wildcard` gives first-registered routes priority. The `"/api/*"` OPTIONS handler registered first may consume `HTTP_GET /api/files` requests if the URI match function is misconfigured. Verify all routes resolve correctly after upgrade.

**TODO:** Test every API route with `curl -v` after the upgrade before flashing production.

---

### 1.4 — `esp_netif_get_handle_from_ifkey()` Keys May Change

**File:** `components/react_spa/react_spa.h` lines 264, 272

```cpp
esp_netif_get_handle_from_ifkey("WIFI_AP_DEF")
esp_netif_get_handle_from_ifkey("WIFI_STA_DEF")
```

These key strings are internal IDF constants that changed between IDF 5.2 and 5.4. If they return `nullptr` in 5.5.3, the captive portal silently falls back to `192.168.4.1`, breaking STA-mode redirects. Not logged, not detected.

**TODO:** Add error logging: `if (!ap_netif) ESP_LOGW(TAG, "AP netif not found");`

---

### 1.5 — `CONF_PORT` Local Definition Shadows ESPHome's Constant

**File:** `components/react_spa/__init__.py` line 16

```python
CONF_PORT = "port"   # ← Shadows esphome.const.CONF_PORT
```

**Fix:**
```python
from esphome.const import CONF_ID, CONF_PORT
# Remove the local definition
```

---

## PHASE 2 — WiFi Subsystem: A House of Cards

### 2.1 — Raw `esp_wifi_*` Watchdog Fights ESPHome's WiFi Manager

**File:** `device.yaml` lines 181–188

```yaml
esp_wifi_get_mode(&mode);
if (mode == WIFI_MODE_STA) {
    esp_wifi_set_mode(WIFI_MODE_APSTA);
    wifi_apply_ap_settings(true, g_ap_ssid, g_ap_password);
}
```

This 1-second polling watchdog directly conflicts with ESPHome's WiFi state machine. The warnings already visible in logs — `"wifi set Warning flag: scanning for networks"` — are caused by this. In 2026.4, ESPHome's WiFi component has more aggressive state management and will fight this watchdog more visibly.

**TODO:** Remove the raw `esp_wifi_*` calls from `device.yaml`. Use ESPHome's `wifi:` component's `ap:` configuration instead. Let ESPHome own the radio.

---

### 2.2 — `WIFI_STORAGE_FLASH` Persists Credentials ESPHome Doesn't Know About

**File:** `custom/wifi_setup.h` line 133

Credentials written to NVS Flash via the WiFi tab are invisible to ESPHome. On OTA firmware update, ESPHome reads `secrets.yaml` and overwrites. The user's saved network from the UI is silently abandoned on next flash.

**TODO:** Store WiFi credentials in `system.json` on SPIFFS and apply at boot via an ESPHome lambda. This keeps them independent from the firmware binary.

---

### 2.3 — `esp_wifi_connect()` Called While ESPHome Also Manages Connection

**File:** `custom/wifi_setup.h` ~line 140

Calling `esp_wifi_connect()` directly while ESPHome's background task also manages STA causes `ESP_ERR_WIFI_CONN (0x3003)`. The boot log error `FAILED to set AP config: 12289` is `ESP_ERR_WIFI_IF` — the interface isn't ready when AP config is applied during `setup()`. These are symptoms of dual-ownership of the WiFi driver.

---

## PHASE 3 — MQTT Integration: Wired Wrong

### 3.1 — `mqtt::global_mqtt_client` is a Private Internal Symbol

**File:** `custom/tab_home.h` lines 164, 308

```cpp
mqtt::global_mqtt_client->publish(...);
mqtt::global_mqtt_client->subscribe(...);
```

`global_mqtt_client` is not a stable public ESPHome API. In 2026.4, the MQTT component underwent a refactor due to the Arduino/IDF merge. The `subscribe()` lambda signature changed. This code may not compile after the upgrade.

**TODO:** Check the ESPHome 2026.4 changelog for `MQTTClientComponent` API. Add null-check: `if (!mqtt::global_mqtt_client) return;`

---

### 3.2 — MQTT `on_message` Lambda in `device.yaml` Calls LVGL-Adjacent Code

**File:** `device.yaml` lines 110–112

```yaml
- lambda: |-
    if (x == "home") ui_navigate_to("main");
    else ui_navigate_to(x.c_str());
```

This runs on the MQTT network task. `ui_navigate_to()` modifies `g_grid_items` and `g_current_screen`. **Same task-safety issue as Phase 0.** Only worse, because this is a YAML lambda — harder to audit.

**Fix:** The lambda should set only an atomic flag + target string. The main tick dispatches it.

---

### 3.3 — MQTT Has No `on_disconnect`, `will_message`, or `birth_message`

**File:** `device.yaml` lines 102–112

If the broker is unreachable on boot, ESPHome's MQTT component retries indefinitely. In 2026.4 this may delay other component initialization. There is no UI feedback to the user that MQTT is disconnected.

**TODO:** Add `on_connect`, `on_disconnect` handlers and surface MQTT status in the dashboard header.

---

## PHASE 4 — HTTP Server: Security & Stability

### 4.1 — CORS `*` on All Mutation Endpoints is a Security Risk

**File:** `components/react_spa/react_spa.h` ~lines 199, 210

```cpp
httpd_resp_set_hdr(req, "Access-Control-Allow-Origin", "*");
```

Applied to `/api/wifi/connect` and `/api/grid/config`. Any webpage can POST to these endpoints from the user's browser while on the same network. A malicious site could reconfigure the device's WiFi credentials.

**TODO:** Restrict CORS to the device's own IP, or add a bearer token header.

---

### 4.2 — `/upload` Has No Size Limit — OOM Crash Vector

**File:** `components/react_spa/react_spa.h` — `upload_handler`

No check on `req->content_len` before calling `malloc`. A 10MB POST crashes the device. A buggy `upload.sh` client with a large file will hard-fault the ESP32.

**TODO:** Early return if `content_len > 500000`.

---

### 4.3 — `g_spa_cache_dirty` is a Plain `bool` Shared Between Two Tasks

**File:** `components/react_spa/react_spa.h` line 63

```cpp
static bool g_spa_cache_dirty = true;
```

Written by the upload handler (HTTP task), read by `loop()` (main task). On dual-core ESP32-S3, this is a data race.

**Fix:** `static std::atomic<bool> g_spa_cache_dirty{true};`

---

## PHASE 5 — Data Architecture: Technical Debt

### 5.1 — `Panel` C++ Struct vs TypeScript Type Are Out of Sync

**File:** `custom/grid_config.h` line 33 vs `webapp/src/App.tsx`

| Field | C++ Struct | TypeScript Type | Result |
|---|---|---|---|
| Width | `int w` (read as `"w"`) | `width` (serialized as `"width"`) | **Width is silently ignored on device** |
| Height | `int h` | (not in TS type) | Ignored |
| Item Background | (not in struct) | `itemBg` | Serialized to JSON, never parsed by C++ |

The panel width you set in the web UI is non-functional on device. **The entire panel rendering size is always the default.**

**TODO:** Audit every GridItem and Panel field. Create a `schema.md` document as ground truth for both sides.

---

### 5.2 — `grid_list_screens()` Always Returns Only `["main"]`

**File:** `custom/grid_config.h` lines 256–261

```cpp
void grid_list_screens(char* out, size_t max_len) {
    arr.add("main");  // ← HARDCODED. Never reads SPIFFS.
}
```

The web UI relies on this endpoint to populate the screen selector when syncing. It will always show only `"main"`. All other screens (`scr_2`, `scr_3`, etc.) are invisible to the device-side API.

**Fix:** Scan `/spiffs/` for `*.json` files, strip the prefix/extension, and return the list.

---

### 5.3 — `get_screen_path()` Case Normalization is Inconsistent

**File:** `custom/grid_config.h` lines 50–56

```cpp
std::string n = name;
for (auto & c : n) c = tolower(c);
if (n == "main") return "/spiffs/grid.json";           // uses lowercased
if (name.compare(0, 4, "scr_") == 0) return ...;     // uses ORIGINAL case
return "/spiffs/scr_" + name + ".json";               // uses ORIGINAL case
```

A screen named `"SCR_3"` vs `"scr_3"` will generate different paths. Ghost screens accumulate on SPIFFS. The case check is applied only to the `"main"` shortcut.

**Fix:** Apply lowercase to `name` before all comparisons.

---

### 5.4 — `g_lv_screen_cache` Has No Size Limit

**File:** `custom/tab_home.h` line 26

```cpp
static std::map<std::string, lv_obj_t*> g_lv_screen_cache;
```

Every screen visited is cached indefinitely as a live LVGL widget tree. With the Phase 0 MQTT leak compounding on top, memory usage grows monotonically. A device left running for 24+ hours with active navigation will OOM.

The cache was partially disabled too — `ui_navigate_to()` now always forces `grid_config_load(true)` (disk read), but the LVGL widget tree is still cached. The benefit of the cache (avoiding LVGL rebuild time) exists, but the cost (unbounded memory) is unaddressed.

**Fix:** Implement LRU eviction. Keep max 2 cached widget trees.

---

## PHASE 6 — ESPHome 2026.4 YAML Breaking Changes

### 6.1 — `lvgl: buffer_size: 25%` Syntax — Verify After Upgrade

**File:** `device.yaml` line 161

In 2026.4 the LVGL component changed buffer size handling. Verify the compiled buffer is correct: `800 × 480 × 2 bytes × 0.25 = 192KB`. Check the ESPHome changelog.

---

### 6.2 — `reboot_timeout: 0s` Disables All Recovery Watchdogs

**File:** `device.yaml` line 90

With the race conditions in Phases 0, 2, and 3, the device can enter unrecoverable hung states. Disabling the reboot timeout removes the last safety net.

**Fix:** `reboot_timeout: 15min`

---

### 6.3 — `on_boot:` Inside `lvgl.pages` May Not Be Supported in 2026.4

**File:** `device.yaml` lines 165–168

```yaml
lvgl:
  pages:
    - id: dashboard_page
      on_boot:
        - lambda: maindashboard_create(id(dashboard_page).obj);
```

`on_boot` inside `lvgl.pages` is a non-standard LVGL extension. The LVGL component was significantly reworked in 2026.4. This hook may fire before LVGL finishes initializing, or be removed.

**Fix:**
```yaml
esphome:
  on_boot:
    priority: -100
    then:
      - delay: 500ms
      - lambda: maindashboard_create(id(dashboard_page).obj);
```

---

### 6.4 — Two `httpd` Instances May Hit Socket Limits

**File:** `device.yaml` line 97

`web_server: port: 81` + `react_spa: port: 80` = two separate `httpd` instances. Combined with MQTT and WiFi sockets, the system approaches `CONFIG_LWIP_MAX_SOCKETS: 16`. Under load (active WiFi scan + simultaneous API calls), connections are refused silently.

**TODO:** Remove `web_server:` entirely unless `/ota` or `/metrics` is required. The React SPA handles all UI at port 80.

---

## PHASE 7 — Frontend Technical Debt

### 7.1 — No Schema Version Guard on `localStorage` Load

**File:** `webapp/src/App.tsx` — `GridTab` initialization

The project data format has changed four times (`ds_project_v3` implies three prior formats). The next schema change will silently load old data with missing fields (`undefined` property access), crashing the React tree.

**Fix:**
```typescript
const raw = localStorage.getItem("ds_project_v3");
const saved = raw ? JSON.parse(raw) : null;
if (!saved?.schemaVersion || saved.schemaVersion < 3) {
    setProject(defaultProject);  // migrate or reset
} else {
    setProject(saved);
}
```

---

### 7.2 — `safeHex()` Accepts Raw Strings Without Validation

**File:** `webapp/src/App.tsx`

```typescript
if (typeof num === "string") return num;   // silently passes "#ff0000" → rendered as "##ff0000"
```

If any future import includes hex colors as strings with `#` prefix, all colors in the UI will break silently.

---

### 7.3 — `syncToDevice()` Has No Fetch Timeout

**File:** `webapp/src/App.tsx`

```typescript
await fetch(`http://${targetIp}/api/grid/config?name=${scr.id}`, { method: "POST", ... });
```

Default browser `fetch()` timeout is 60–90 seconds. If device is unreachable, the "SYNCING..." spinner freezes the UI for 90 seconds. Users will force-refresh, losing work.

**Fix:**
```typescript
const ac = new AbortController();
const t = setTimeout(() => ac.abort(), 5000);
try { await fetch(url, { signal: ac.signal, ... }); } finally { clearTimeout(t); }
```

---

## ORDERED MIGRATION CHECKLIST

```
PHASE 0 — Fix existing bugs (do before incrementing ESPHome version)
  [ ] Fix MQTT dangling pointer: add LV_EVENT_DELETE handler to delete GridItem* + unsubscribe
  [ ] Fix HTTP body loop: wrap all 3 httpd_req_recv calls in accumulation loop
  [ ] Fix LVGL thread-safety: use lv_async_call() in all MQTT callbacks
  [ ] Fix data race: grid_config_load must only be called from main task
  [ ] Remove: using namespace esphome from tab_home.h
  [ ] Add: null check for mqtt::global_mqtt_client before every use
  [ ] Fix: g_spa_cache_dirty → std::atomic<bool>
  [ ] Fix: upload handler — add content_len size limit guard

PHASE 1 — Bump ESPHome, fix component Python
  [ ] device.yaml: bump esphome version
  [ ] __init__.py: CORE.using_esp_idf → CORE.is_esp32
  [ ] __init__.py: from esphome.const import CONF_PORT (remove local def)
  [ ] __init__.py: fix hardcoded spiffs glob path
  [ ] Compile clean. Fix all warnings before proceeding.
  [ ] curl test every API endpoint on the running device

PHASE 2 — WiFi stabilization
  [ ] Remove raw esp_wifi_* watchdog from device.yaml interval
  [ ] Test AP+STA mode via ESPHome wifi: ap: config natively
  [ ] Add documentation for NVS vs secrets.yaml credential discrepancy

PHASE 3 — MQTT hardening
  [ ] Check MQTTClientComponent subscribe() signature in 2026.4 changelog
  [ ] Add on_connect / on_disconnect handlers in device.yaml
  [ ] Move device.yaml MQTT navigation lambda to main-task-safe flag pattern

PHASE 4 — HTTP security
  [ ] Restrict CORS to device IP range or add auth token
  [ ] Add upload size limit (500KB max)

PHASE 5 — Data architecture
  [ ] Create schema.md: ground truth for GridItem and Panel fields
  [ ] Sync Panel struct w/h ↔ TypeScript width|height
  [ ] Add itemBg to C++ Panel struct and parse it
  [ ] Implement real grid_list_screens() — scan SPIFFS directory
  [ ] Fix get_screen_path() to apply lowercase to full path

PHASE 6 — YAML audit
  [ ] Verify lvgl buffer_size: 25% generates correct buffer in 2026.4
  [ ] Change reboot_timeout: 0s → 15min
  [ ] Move maindashboard_create to esphome on_boot with priority -100
  [ ] Remove web_server: port: 81 (evaluate)

PHASE 7 — Frontend hardening
  [ ] Add schema version guard on localStorage.getItem("ds_project_v3")
  [ ] Fix safeHex() to validate and strip '#' from string inputs
  [ ] Add AbortController with 5s timeout to all fetch() calls in syncToDevice
  [ ] Implement LRU eviction (max 2) on g_lv_screen_cache

VALIDATION
  [ ] Long-uptime test: leave device running 24h, monitor for memory growth
  [ ] Navigate between 5 screens 20x rapidly — no crash
  [ ] Receive 50 consecutive MQTT messages — UI updates, no corruption
  [ ] Sync a 10-widget screen from web UI — verify device renders exactly
  [ ] Disconnect WiFi — 15min reboot_timeout fires correctly
```

---

## Verdict

**The device works right now because:**
1. MQTT is likely not connected (no active broker)
2. Single-user, single session, low navigation frequency
3. Lucky task scheduling timing on a lightly-loaded device

**The upgrade to 2026.4 will expose these issues because:**
- ESPHome's WiFi and MQTT internals are stricter in the unified framework
- IDF 5.5.3 has better task isolation that surfaces cross-task violations sooner
- The Arduino/IDF namespace merge will trigger compile errors from `using namespace esphome`

**Do Phase 0 first. Those are not migration tasks — they are bugs that exist today.**
