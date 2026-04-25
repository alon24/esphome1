# GridOS — Implementation Plan

## What We're Building

Three interlocking features:

1. **Widget Registry** — every widget on-screen is addressable by ID from YAML lambdas
2. **Icon Support** — emoji or PNG image overlay on any widget
3. **Widget Palette Redesign** — categorized dark-theme card picker with on-device sensors

---

## A — Widget Registry (`custom/widget_bindings.h`)

New file. A global map `widgetId → LVGL object` that lets YAML lambdas drive any widget.

**Public API (call from `device.yaml` lambdas):**
```cpp
grid_widget_set_value("my_bar", 75.0f);   // updates bar/slider/arc/switch
grid_widget_set_text("my_label", "Hello"); // updates label text
float v = grid_widget_get_value("my_slider");
```

**Todos:**
- [ ] Create `custom/widget_bindings.h` with `LiveWidget` struct + the three functions above
- [ ] Add `#include "widget_bindings.h"` to `device.yaml` includes list
- [ ] In `tab_home.h → _home_render_item()`: register widget after creation: `g_live_widgets[it.id] = {obj, it.type}`
- [ ] In `tab_home.h → tab_home_create()`: clear registry: `g_live_widgets.clear()`

**YAML usage example:**
```yaml
mqtt:
  on_message:
    - topic: "home/temp"
      then:
        - lambda: grid_widget_set_value("bar_abc123", x.toFloat());
```

---

## B — Extended Action Strings (`tab_home.h`)

Action strings typed in the designer's "Action" field get dispatched by C++.

**New actions to add to `_item_event_cb`:**

| Action | Behavior |
|---|---|
| `wifi-scan:` | Calls `_cwifi_start_scan_bg()` |
| `set:widgetId:value` | Calls `grid_widget_set_value()` |
| `toggle:widgetId` | Reads current value, flips it |

**Todos:**
- [ ] Add `wifi-scan:` branch to action dispatcher
- [ ] Add `set:id:val` branch
- [ ] Add `toggle:id` branch

---

## C — Icon Support

Any widget can display an emoji or a PNG file from LittleFS on top of its content.

**New field:** `icon?: string` on `GridItem`
- Short string → rendered as text/emoji label (centered, non-clickable)
- Starts with `/` → loaded as image via `lv_image_create`

**Todos:**
- [ ] Add `std::string icon;` to `GridItem` struct in `grid_config.h`
- [ ] Add `it.icon = eObj["icon"] | "";` to `parse_grid_item()`
- [ ] Add `icon?: string` to `GridItem` TypeScript type in `types.ts`
- [ ] In `tab_home.h → _home_render_item()`: after creating obj, if `it.icon` not empty → create child label or image
- [ ] In `WidgetRenderer.tsx`: overlay icon div (absolute centered) on all widget types
- [ ] In `PropertiesPanel.tsx`: add icon picker section (emoji quick-picks + free text input)

---

## D — Widget Palette Redesign (`Sidebar.tsx`)

Replace the current flat widget list with a categorized, collapsible, dark-theme card grid.

**Categories:**

| Category | Widgets |
|---|---|
| BASIC | Label, Button, Frame, Clock |
| CONTROLS | Switch, Slider, Arc, Bar, Checkbox, Dropdown, Roller |
| NAVIGATION | Nav Menu, Nav Item, Menu Item |
| SMART COMPONENTS | WiFi Panel, SD Browser, System Settings |
| ON DEVICE SENSORS | Battery, WiFi Signal, Uptime + dynamic from device |
| ADVANCED | Panel Ref |

**On Device Sensors (built-in, always present):**
- 🔋 Battery — bound to `system/battery` topic
- 📶 WiFi Signal — bound to `system/wifi/rssi` topic  
- ⏱ Uptime — bound to `system/uptime` topic
- 🌡 Temperature — bound to `system/temp` topic (if sensor exists)

When dragged onto canvas, these auto-populate `mqttStateTopic` with the right topic.

**Todos:**
- [ ] Define `WIDGET_PALETTE` constant (categories + widgets array) in `Sidebar.tsx` or `types.ts`
- [ ] Build `PaletteCard` component — dark card, icon + label, hover highlight, draggable
- [ ] Build `PaletteSection` component — collapsible header with item count badge
- [ ] Replace current widget list in `Sidebar.tsx` with new palette sections
- [ ] Add search input at top of palette — filters cards across all categories
- [ ] Wire drag/click handlers to existing `handlePaletteClick` / drag logic
- [ ] Add "ON DEVICE SENSORS" section with static built-ins + fetch from `/api/sensors` if device online
- [ ] Add bottom bar: "LAYOUT — Save / Import"

---

## E — Properties Panel Updates (`PropertiesPanel.tsx`)

**Todos:**
- [ ] Move Widget ID to top of panel, styled as monospace code block + copy button
- [ ] Add collapsible "YAML Binding Snippet" section showing ready-to-paste lambda code
- [ ] Add "Icon / Emoji" section: emoji quick-picks + text input + clear button
- [ ] Make "Action" field always visible (not gated on widget type)

---

## F — Firmware: `tab_home.h` Action Registration

Already partially done. Needs:
- [ ] Include `widget_bindings.h` at top of `tab_home.h`
- [ ] Register each widget by ID (step A)
- [ ] Add new action strings (step B)
- [ ] Render icon child (step C)

---

## Order of Execution

```
A (widget_bindings.h)
  → F (tab_home.h wiring)
    → B (action strings)
      → C (icon: grid_config.h + tab_home.h)
        → C (icon: types.ts + WidgetRenderer.tsx)
          → D (palette redesign: Sidebar.tsx)
            → E (PropertiesPanel.tsx updates)
```

Flash firmware after A+B+C are done. Web changes (D+E) go via `upload.sh`.

---

## Out of Scope

- SVG on-device (LVGL doesn't support it — use PNG exported from SVG)
- Custom widget types (new LVGL widget classes) — future
- `on_widget_change` YAML hook — future (needs ESPHome custom component)

---

## G — Pane Grid System (Home Assistant Dashboard)

A dedicated widget type for building HA-style dashboard tiles. Each **Pane** is a card with a title, icon/widget, and event listeners (click, double-click, long-press). Panes are arranged in a **Pane Grid** — a configurable column/row grid layout.

This gets its own **page tab** in the designer, separate from the main canvas editor.

---

### G1 — Concepts

```
PaneGrid (container widget)
  ├── columns: 2         ← how many panes per row
  ├── gap: 10            ← spacing between panes
  ├── paneW: 180         ← pane width (auto if 0)
  ├── paneH: 150         ← pane height
  └── children: Pane[]

Pane (tile card)
  ├── title: "Humidity"       ← text shown at top
  ├── icon: "💧"              ← emoji/PNG shown in middle (optional)
  ├── bg: 0xf6c90e            ← tile background color (e.g. yellow)
  ├── textColor: 0x000000
  ├── childWidget?: GridItem  ← embedded widget (bar, switch, label, etc.)
  │
  ├── mqttStateTopic: "home/humidity/state"  ← auto-updates value display
  ├── mqttTopic: "home/humidity/set"         ← publishes on interaction
  ├── haEntity: "sensor.living_room_humidity"← HA entity ID (informational)
  │
  ├── onClick: "mqtt:home/light/set:ON"      ← action string
  ├── onDoubleClick: "scr:detail_screen"     ← action string
  └── onLongPress: "toast:Long pressed!"     ← action string
```

---

### G2 — TypeScript Types

Add to `types.ts`:
```ts
export type Pane = {
    id: string;
    title: string;
    icon?: string;
    bg?: number;
    textColor?: number;
    childWidget?: GridItem;      // embedded bar, switch, label, etc.
    mqttStateTopic?: string;
    mqttTopic?: string;
    haEntity?: string;           // informational — shown in properties
    onClick?: string;
    onDoubleClick?: string;
    onLongPress?: string;
    valueUnit?: string;          // e.g. "%" or "°C" shown after value
    valueFormat?: string;        // e.g. "%.1f" for 1 decimal
};

export type PaneGrid = {
    id: string;
    columns: number;
    gap: number;
    paneW?: number;
    paneH?: number;
    panes: Pane[];
};
```

`pane-grid` becomes a new `ElementType`. Its `children` in `GridItem` are the Pane definitions (serialized as JSON).

---

### G3 — Pane Designer Page (new tab in the app)

A separate route/tab: **"Panes"** (next to Screens and Panels in the sidebar).

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  PANE GRIDS          [+ New Grid]                   │  ← sidebar list
│  ─────────────                                      │
│  > Kitchen Grid (2×3)                               │
│  > Bedroom Grid (1×4)                               │
├──────────────────────────────────────────────────── │
│                   CANVAS (grid preview)             │
│   ┌──────────┐  ┌──────────┐                        │
│   │ 💧        │  │ 🌡       │                        │
│   │ Humidity  │  │  Temp   │                        │
│   │  ████    │  │  72%    │                         │
│   │ 65%      │  │         │                         │
│   └──────────┘  └──────────┘                        │
│   [+ Add Pane]                                      │
├─────────────────────────────────────────────────────│
│  PANE PROPERTIES (right panel when pane selected)  │
│  Title / Icon / BG color / Child Widget             │
│  MQTT / HA Entity / Click actions                   │
└─────────────────────────────────────────────────────┘
```

**Todos:**
- [ ] Add `PaneGrid[]` to `Project` type
- [ ] Add `pane-grid` to `ElementType`
- [ ] Create `webapp/src/components/panes/PaneEditor.tsx` — the full page
- [ ] Create `webapp/src/components/panes/PaneCard.tsx` — single tile preview
- [ ] Create `webapp/src/components/panes/PaneProperties.tsx` — right-side editor
- [ ] Add "Panes" tab to `Sidebar.tsx` top nav
- [ ] Pane grids can also be **placed on a canvas screen** as a `pane-grid` widget

---

### G4 — Pane Rendering in Web Designer (`PaneCard.tsx`)

```tsx
const PaneCard = ({ pane, selected, onClick, onDoubleClick }) => {
    const bg = `#${safeHex(pane.bg ?? 0x1e2433)}`;
    const tc = `#${safeHex(pane.textColor ?? 0xffffff)}`;
    return (
        <div
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            style={{
                background: bg,
                borderRadius: '14px',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                border: selected ? '2px solid #6366f1' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.15s',
                position: 'relative',
            }}
        >
            {/* Title bar */}
            <div style={{ color: tc, fontSize: '11px', fontWeight: 700, alignSelf: 'flex-start', opacity: 0.8 }}>
                {pane.title}
            </div>
            {/* Icon */}
            {pane.icon && (
                <div style={{ fontSize: '28px' }}>{pane.icon}</div>
            )}
            {/* Child widget preview or value label */}
            {pane.childWidget
                ? <WidgetRenderer it={pane.childWidget} panels={[]} pageId="" />
                : <div style={{ fontSize: '20px', fontWeight: 900, color: tc }}>—</div>
            }
            {/* HA entity badge */}
            {pane.haEntity && (
                <div style={{ position: 'absolute', top: 6, right: 8, fontSize: '9px', color: tc, opacity: 0.5 }}>
                    {pane.haEntity}
                </div>
            )}
        </div>
    );
};
```

---

### G5 — Firmware: Rendering Pane Grid (`tab_home.h`)

A `pane-grid` item renders as an LVGL flex container. Each child `pane` is rendered as an `lv_obj` with:
- Background color from `pane.bg`
- Title `lv_label` at top
- Icon label or image in center
- Child widget rendered inside (using existing `_home_render_item` recursively)
- Three event callbacks: `LV_EVENT_CLICKED`, `LV_EVENT_LONG_PRESSED`, and double-click via timestamp tracking

```cpp
// In _home_render_item, new branch:
if (it.type == "pane-grid") {
    lv_obj_t *grid = lv_obj_create(parent);
    _panel_reset(grid);
    lv_obj_set_size(grid, it.width, it.height);
    lv_obj_set_pos(grid, it.x + offsetX, it.y + offsetY);
    lv_obj_set_flex_flow(grid, LV_FLEX_FLOW_ROW_WRAP);
    lv_obj_set_style_pad_gap(grid, it.gap || 10, 0);

    for (auto &pane : it.children) {
        _home_render_pane(grid, pane);
    }
    return;
}
```

```cpp
void _home_render_pane(lv_obj_t *parent, const GridItem &pane) {
    lv_obj_t *card = lv_obj_create(parent);
    _panel_reset(card);
    lv_obj_set_size(card, pane.width, pane.height);
    lv_obj_set_style_bg_color(card, lv_color_hex(pane.color), 0);
    lv_obj_set_style_radius(card, 14, 0);
    lv_obj_clear_flag(card, LV_OBJ_FLAG_SCROLLABLE);

    // Title label
    lv_obj_t *title = lv_label_create(card);
    lv_label_set_text(title, pane.name.c_str());
    lv_obj_align(title, LV_ALIGN_TOP_LEFT, 8, 6);

    // Icon label (if set)
    if (!pane.icon.empty()) {
        lv_obj_t *icn = lv_label_create(card);
        lv_label_set_text(icn, pane.icon.c_str());
        lv_obj_align(icn, LV_ALIGN_CENTER, 0, -10);
    }

    // Child widget (if any)
    if (!pane.children.empty()) {
        _home_render_item(card, pane.children[0], 0, 30);
    }

    // Register for MQTT subscription
    if (!pane.id.empty()) g_live_widgets[pane.id] = {card, pane.type};

    // Event: click / long press / double-click
    GridItem *persist = new GridItem(pane);
    lv_obj_set_user_data(card, persist);
    lv_obj_add_event_cb(card, _pane_event_cb, LV_EVENT_ALL, nullptr);
}
```

**`_pane_event_cb`:**
```cpp
static uint32_t _last_click_time[32] = {0};
static int _pane_click_idx = 0;

static void _pane_event_cb(lv_event_t *e) {
    lv_event_code_t code = lv_event_get_code(e);
    GridItem *pane = (GridItem*)lv_obj_get_user_data(lv_event_get_target(e));
    if (!pane) return;

    if (code == LV_EVENT_CLICKED) {
        uint32_t now = lv_tick_get();
        // Detect double-click (< 300ms since last click)
        if (now - _last_click_ms < 300) {
            if (!pane->onDoubleClick.empty()) _dispatch_action(pane->onDoubleClick.c_str());
        } else {
            if (!pane->onClick.empty()) _dispatch_action(pane->onClick.c_str());
        }
        _last_click_ms = now;
    } else if (code == LV_EVENT_LONG_PRESSED) {
        if (!pane->onLongPress.empty()) _dispatch_action(pane->onLongPress.c_str());
    } else if (code == LV_EVENT_DELETE) {
        delete pane;
    }
}
```

**Todos:**
- [ ] Add `onClick`, `onDoubleClick`, `onLongPress` to `GridItem` C++ struct and parser
- [ ] Add `pane-grid` branch to `_home_render_item`
- [ ] Implement `_home_render_pane()` function
- [ ] Implement `_pane_event_cb()` with double-click timing
- [ ] Add MQTT subscription for `pane.mqttStateTopic` to update displayed value

---

### G6 — Home Assistant Connection Pattern

Each pane tile maps to one HA entity via MQTT. The recommended pattern:

```
HA Sensor (humidity)
    → publishes to MQTT: "homeassistant/sensor/humidity/state"
    → pane.mqttStateTopic = "homeassistant/sensor/humidity/state"
    → device subscribes, updates value label on tile

Pane click (light toggle)
    → pane.onClick = "mqtt:homeassistant/light/living/command:TOGGLE"
    → device publishes to HA
    → HA toggles light, publishes new state back
    → pane.mqttStateTopic receives "ON"/"OFF" → tile updates
```

**HA entity types supported:**

| HA Domain | Display | Command |
|---|---|---|
| `sensor` | Value label (with unit) | — (read only) |
| `binary_sensor` | Icon color (on/off) | — |
| `switch` | Switch widget | `ON`/`OFF` |
| `light` | Switch or slider | `ON`/`OFF`, brightness |
| `input_boolean` | Switch | `ON`/`OFF` |
| `input_number` | Slider or bar | numeric value |
| `climate` | Temp label + setpoint | `set_temperature` |

---

### G7 — Order of Implementation

```
G types.ts (Pane, PaneGrid types)
  → G PaneCard.tsx (visual preview)
    → G PaneEditor.tsx (full page)
      → G PaneProperties.tsx (right panel)
        → G Sidebar.tsx (add Panes tab)
          → G grid_config.h (onClick/onLongPress fields)
            → G tab_home.h (pane-grid renderer + event cb)
```

---

## Updated Order of Execution (All Phases)

```
A → F → B → C (firmware changes, flash once done)
D → E         (web changes, upload.sh)
G types       (web)
G pane UI     (web)
G firmware    (flash)
```

