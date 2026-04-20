# 🎮 GridOS Widget & MQTT Guide

Welcome to the GridOS Designer ecosystem! This guide explains how to master the advanced widgets (Arc, Roller, Slider) and how to link them to your home automation via MQTT.

## 🏗️ Setting Widget Values

The Designer now includes a "DIGITAL TWIN" property panel on the right. When you select a widget, you can configure its behavior:

### 1. Roller & Dropdown
Used for choosing between multiple options.
- **Options**: In the "OPTIONS (NEW LINE SEP)" field, type each option on a new line.
  ```text
  Auto
  Heat
  Cool
  Off
  ```
- **Value**: This corresponds to the *index* of the selected item (0 for first, 1 for second, etc.).

### 2. Arc & Slider
Used for variable values (dimmers, temperature, etc.).
- **Min / Max**: Set the range of your widget (e.g., 0 to 100).
- **Value**: The current position of the arc/slider.
- **Visuals**: You can change the "BG COLOR" (background) and "TXT COLOR" independently.

### 3. Bar (Progress)
Used to display read-only state like battery, signal, or volume.
- Set the **Min/Max** and update the **Value** via MQTT or code.

---

## 📡 MQTT + ESPHome Integration

GridOS now supports **Bi-Directional MQTT Sync**. This means moving a slider on the screen will update a sensor in Home Assistant, and changing a value in Home Assistant will move the slider on the screen!

### ⚙️ Step 1: Configure MQTT
Ensure your `secrets.yaml` contains your broker details:
```yaml
mqtt_broker: "192.168.1.50"
mqtt_username: "user"
mqtt_password: "pass"
```

### ⚙️ Step 2: Bind in Designer
In the Builder tab, select a widget and look for the **MQTT TOPIC** field:
- **Topic**: `home/living_room/light_dimmer`
- **Behavior**: 
  - The widget will **Subscribe** to this topic. Any numerical message received will move the widget.
  - The widget will **Publish** to this topic whenever you touch it on the screen.

### ⚙️ Step 3: Example ESPHome Config
You can bridge these widgets to physical hardware in your `device.yaml`:

```yaml
# Example: Use an Arc to control a Light's brightness
mqtt:
  broker: !secret mqtt_broker
  on_message:
    - topic: "home/living_room/light_arc"
      then:
        - light.control:
            id: my_light
            brightness: !lambda "return parseFloat(x) / 100.0;"
```

---

## 🛠️ Accessing via Editor
1. Click **BUILDER** tab.
2. Drag an **ARC** onto the canvas.
3. Select it, and on the right side:
   - Set **MAX** to `100`.
   - Set **MQTT TOPIC** to `lounge/lamp/brightness`.
4. Click **SYNC TO DEVICE**.
5. Your screen now controls that topic!

> [!TIP]
> Use the **MIRROR** tab to see a real-time digital twin of your device layout as you design!
