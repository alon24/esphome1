# GridOS Component Developer Guide (For Dummies)

This guide explains how to add a new component (e.g., a "Light Toggle") to the GridOS ecosystem.

---

## 1. Add to the Designer (Web App)

### Step A: Define the Component Metadata
Open `webapp/src/types.ts` and add your component to the `SMART_COMPONENTS` list.

```typescript
export const SMART_COMPONENTS = [
    // ... existing components
    { 
        id: 'light_toggle', 
        label: 'Light Toggle', 
        icon: '💡', 
        defaultW: 160, 
        defaultH: 60 
    },
];
```

### Step B: (Optional) Custom Property Panel
If your component needs special settings (like "Bulb Color"), add a section to `webapp/src/components/editor/PropertiesPanel.tsx`.

---

## 2. Add to the Firmware (ESP32)

### Step A: Handle rendering
Open `custom/tab_home.h` and find the `_home_render_item` function. Add a case for your component ID.

```cpp
else if (it.component == "light_toggle") {
    lv_obj_t * btn = lv_btn_create(parent);
    lv_obj_set_size(btn, it.width, it.height);
    lv_obj_t * label = lv_label_create(btn);
    lv_label_set_text(label, "TOGGLE LIGHT");
    lv_obj_center(label);

    // Bind action
    if (!it.mqttTopic.empty()) {
        std::string act = "mqtt:" + it.mqttTopic + ":toggle";
        lv_obj_add_event_cb(btn, _item_event_cb, LV_EVENT_CLICKED, strdup(act.c_str()));
    }
}
```

### Step B: Handle updates (MQTT/State)
If your component should change state (e.g., turn green when ON), update `_mqtt_lvgl_update_async` in `tab_home.h`.

```cpp
else if (u->type == "light_toggle") {
    if (u->payload == "ON") {
        lv_obj_set_style_bg_color(u->obj, lv_color_hex(0x00FF00), 0);
    } else {
        lv_obj_set_style_bg_color(u->obj, lv_color_hex(0x808080), 0);
    }
}
```

---

## 3. Advanced: Modular Components
If your component is complex, don't clutter `tab_home.h`. Instead:

1.  **Create a new file**: `custom/comp_my_feature.h`
2.  **Define your logic**:
    ```cpp
    #pragma once
    #include <lvgl.h>
    #include "grid_config.h"

    void render_my_feature(lv_obj_t* parent, const GridItem& it) {
        // ... Your complex LVGL code ...
    }
    ```
3.  **Include it in `tab_home.h`**:
    ```cpp
    #include "comp_my_feature.h"
    ```
4.  **Call it in `_home_render_item`**:
    ```cpp
    else if (it.component == "my_feature") {
        render_my_feature(parent, it);
    }
    ```

---

## 4. Sync and Test
1. Save your code.
2. Build and Flash the ESP32 using `./scripts/flash.sh`.
3. Open the Designer at `http://[DEVICE_IP]:3009`.
4. Drag your new **Light Toggle** from the **SMART** section of the palette onto the canvas.
5. Set the **MQTT Topic** in the properties.
6. Click **SYNC** in the header.
7. Your new button should appear on the device!

---

## Pro Tip: Action Strings
You can use these strings in any `action`, `onClick`, `onDoubleClick`, or `onLongPress` property:
- `scr:Home`: Navigate to screen named "Home"
- `toast:Hello`: Show a popup message
- `reboot:`: Restart the device
- `mqtt:topic/path:payload`: Publish MQTT message
- `toggle:widgetId`: Toggle another widget's value
- `set:widgetId:value`: Set another widget's value
