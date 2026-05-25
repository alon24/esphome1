# 🌌 GridOS Ultimate — Next-Gen UI Ecosystem for ESP32

[![Hardware Parity](https://img.shields.io/badge/Hardware-1:1_Pixel_Parity-blueviolet?style=for-the-badge&logo=espressif)](https://github.com/alon24/esphome1)
[![Powered by ESPHome](https://img.shields.io/badge/Engine-ESPHome_2026.4-green?style=for-the-badge&logo=esphome)](https://esphome.io)
[![UI Framework](https://img.shields.io/badge/UI-LVGL_9.5.0-orange?style=for-the-badge)](https://lvgl.io)

**GridOS** is a professional-grade, high-fidelity UI designer and media station ecosystem powered by the ESP32-S3. It bridges the gap between modern web design (React) and high-performance embedded graphics (LVGL), featuring a **Memory-Persistent Digital Twin Designer** that allows you to build, sync, and deploy industrial-grade interfaces in seconds.

---

## 🎯 The Vision
Most embedded UIs are hardcoded and brittle. **GridOS** flips the script:
1. **Pixel-Perfect Parity**: What you see in the web builder is exactly what you get on the hardware.
2. **Autonomous Persistence**: The device is its own master. It stores its Digital Twin state in a resilient SPIFFS/LittleFS partition and restores it on every boot.
3. **Smart Components**: Native C++ logic (WiFi Scanners, File Browsers) wrapped in easy-to-place designer widgets.
4. **Zero-Code Deployment**: Design in your browser, click **SYNC**, and watch the physical hardware update in real-time.

---

## 🎨 The Designer Interface

### 1. Canvas & Workspace
*   **Infinite Workspace**: Pan and zoom across multiple screens and master panels.
*   **World-Space Coordinates**: Drag widgets between pages or screens; the designer translates coordinates automatically.
*   **Lasso Selection**: Drag on the background to group-select multiple widgets.
*   **X-Ray Mode**: Toggle via the status bar to see hidden boundaries and widget IDs.

### ⌨️ Power User Shortcuts
| Key / Action | Result |
| :--- | :--- |
| **`L`** | Toggle **Alignment Mode** (shows alignment handles on selection). |
| **`Alt` (Hold)** | Disable **Smart Snapping** during drag. |
| **`Delete` / `Backspace`** | Delete selected widget(s). |
| **`Ctrl + C / V / X`** | Standard Copy, Paste, and Cut support for widgets. |
| **`Ctrl + Z / Y`** | Infinite Undo / Redo of all designer actions. |
| **`Shift + Click`** | Multi-select widgets. |
| **`Alt + Click`** | Open the Context Menu (Layer management). |
| **`Ctrl + Mouse Wheel`** | Zoom in/out relative to the cursor position. |

---

## 🏗️ Design Mechanics

### Smart Alignment & Snapping
*   **Intelligent Snapping**: Widgets automatically snap to the edges and centers of other widgets on the same page.
*   **Visual Guides**: Purple dashed lines appear during drag-and-drop to confirm pixel-perfect alignment.
*   **Alignment Tool ('L')**: Select multiple widgets and press `L` to show alignment handles. Click a handle to align all selected items to that boundary or center.
*   **Bulk Properties**: The Inspector panel dynamically updates to show alignment tools and group actions when multiple items are selected.

### 🏠 Home Assistant & MQTT
GridOS provides three ways to integrate with your smart home:

1.  **Native ESPHome API**: The device shows up in Home Assistant automatically. You can control any widget state via the `api` service.
2.  **MQTT Bi-directional Sync**: Bind any widget to an MQTT topic in the Properties panel.
    *   The widget **publishes** state updates when touched.
    *   The widget **subscribes** to updates from Home Assistant (e.g., a sensor value).
3.  **Action Strings**: Use `mqtt:topic:payload` in a widget's click action to fire one-off messages.

### 🐍 ESPHome Lambdas & Scripting
You can manipulate widgets directly from your `device.yaml` using C++ lambdas:
```cpp
// Set a label's text
grid_widget_set_text("my_label_id", "Hello World");

// Set a slider or arc value
grid_widget_set_value("dimmer_1", 75.0);

// Get a widget's current value
float current = grid_widget_get_value("switch_main");
```

---

## 🧬 Developer Guide: Creating Smart Components

Smart Components are native C++ "apps" embedded inside designer widgets.

1.  **Register**: Add to `SMART_COMPONENTS` in `webapp/src/types.ts`.
2.  **Mock**: Add a preview div in `webapp/src/components/editor/WidgetRenderer.tsx`.
3.  **Implement**: Dispatch to your C++ constructor in `custom/tab_home.h`.

---

## 🚀 Deployment Guide

GridOS uses a split-deployment model for maximum speed.

### 1. Firmware (C++ / ESPHome)
Use this when changing hardware pins, adding C++ components, or updating the core engine.
```bash
# Auto-detect (Prefers OTA if online, falls back to USB)
./scripts/flash.sh

# Force USB (Must be connected via USB-C)
USB=1 ./scripts/flash.sh

# Explicit IP for OTA
DEVICE_IP=192.168.1.42 ./scripts/flash.sh
```

### 2. Designer UI (React)
Use this when you've finished your UI design and want to "bake" it into the device's persistent storage. **This does not reboot the device.**
```bash
# Builds, gzips, and pushes to device filesystem
./scripts/upload.sh

# Explicit IP
DEVICE_IP=192.168.1.42 ./scripts/upload.sh
```

---

## 🛠 Project Structure

```text
.
├── device.yaml          # Main ESPHome config (Hardware + Engine)
├── webapp/              # React Designer Studio
├── custom/              # Native C++ Smart Components (WiFi, SD, etc)
├── scripts/             # Flash (Firmware), Upload (UI), and Dev utilities
└── version.txt          # Global firmware version tracker
```

## 🛠 Recent Updates (May 2026)
*   **MIPI RGB Stability**: Migrated to `mipi_rgb` driver with custom 800x480 timing porches for Sunton ESP32-S3 boards.
*   **1:1 Designer Parity**: Synchronized React `utils.ts` and C++ `tab_home.h` coordinate math for perfect layout alignment.
*   **Nested Interaction**: Fixed callback propagation and handle clipping in the designer studio, enabling WYSIWYG management of complex grid-panes.

---

*Built with ❤️ by the GridOS Team.*
