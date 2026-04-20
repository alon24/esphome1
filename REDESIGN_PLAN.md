# Dashboard Navigation & Native Screens Integration Plan

We need to seamlessly unify the new JSON-driven virtual UI (which includes our dynamic `nav-menu`) with the existing native C++ screens (`wifi`, `system`, `sd`, `tests`).

## 1. The Core Challenge
Currently, native screens (like `tab_wifi`) are full separate panels in `maindashboard.h`. The new `nav-menu` is a widget inside the virtual JSON screens (`tab_home`). If a menu item switches the dashboard to a native screen, the `nav-menu` will disappear, trapping the user. 

## 2. The Solution: Native Screens as Widgets (Or Virtual Overlays)
To fix this, we will expose the native screens as **Special Widgets** (or full-page widgets) in the designer. 
When a user wants a WiFi page, they create a new virtual Screen in the React Editor, place a `nav-menu` widget on the left, and a `native-wifi` widget on the right. 

This gives the user 100% control over the layout, and native screens simply render inside the bounds of this widget.

### A. Device C++ Changes:
1. In `tab_home.h` (`_home_render_item`), add support for new widget types: `native-wifi`, `native-system`, `native-sd`, `native-tests`.
2. When rendering these widgets, create an LVGL container at `(x,y,w,h)` and call their respective `tab_X_create(container)` functions inside it.
3. Update `menu-item` actions (`scr:<id>`) to trigger `grid_config_save("", "<id>")` which seamlessly loads the virtual screen containing the native widget.
4. Remove the hardcoded tab-switching logic (`g_dash_tabs`) from `maindashboard.h`, as all screens will now be driven by `tab_home` mapping out virtual screens.

### B. React Editor Changes:
1. **Toolbox Addition**: In the "WIDGET LIBRARY", add a new category or buttons for "NATIVE SCREENS" containing:
   - `SYSTEM`
   - `WIFI`
   - `SD CARD`
   - `TESTS`
2. **Widget Model**: When dragged or added to the canvas, these act like normal widgets (can be resized, positioned) but represent the native C++ modules.
3. **Menu Item Action Support**: In the property editor for `menu-item`, change the "ACTION" input into a dropdown (or a smart autocomplete input) that dynamically lists all valid targets (e.g., `scr:main`, `scr_2`, `scr_3`).

## 3. Action Plan Steps
1. **Step 1:** Implement the Native Screen widgets (`native-wifi`, `native-system`, etc.) in the React Editor so they can be placed on pages.
2. **Step 2:** Update the React Editor's `menu-item` action field to easily select the `id` of any created screen.
3. **Step 3:** Update `tab_home.h` on the C++ side to render `tab_wifi_create`, `tab_settings_create`, etc., inside the bounding box of these new widget types.
4. **Step 4:** Clean up `maindashboard.h` to fully rely on the JSON-driven renderer as the single source of truth for the entire dashboard UI.

