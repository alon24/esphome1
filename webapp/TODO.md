# GridOS UI Rework TODO

## Phase 1: Preparation & Component Splitting (COMPLETE)
- [x] Create `src/components/layout` directory for structural components.
- [x] Create `src/components/editor` directory for designer tools.
- [x] Extract `<Header />` from `App.tsx` into `src/components/layout/Header.tsx`.
- [x] Extract styling classes for the Header from `design-mockup.html` into `src/index.css`.
- [x] Ensure navigation tab state continues working with the extracted Header.

## Phase 2: Sidebar (Palette & Layers) (COMPLETE)
- [x] Extract `<Sidebar />` into `src/components/editor/Sidebar.tsx`.
- [x] Phase 2: Sidebar Evolution (Palette & Layers)
    - [x] Build Palette with categorization
    - [x] Implement Tree-based Layers view
    - [x] Enable bi-directional widget selection

## Phase 3: Properties Panel (COMPLETE)
- [x] Extract the editor properties sidebar into `src/components/editor/PropertiesPanel.tsx`.
- [x] Build the new header `.props-header` and `.props-entity` title section.
- [x] Implement standard `.prop-group` inputs for coordinates (X, Y) and sizing (W, H).
- [x] Add high-fidelity `.prop-color` swatches with hex display.
- [x] Migrate widget-specific settings (MQTT topic, Slider min/max, etc.).
- [x] Add functionality to neatly hide/close the panel (sliding it off-screen/collapsing width).

## Phase 4: Canvas & Device Frame Setup (COMPLETE)
- [x] Extract grid rendering logic from `App.tsx` into `src/components/editor/CanvasArea.tsx`.
- [x] Create a dedicated device frame `.device-frame` with `.device-status` for the canvas.
- [x] Implement the `renderWidget` loop in the new area (using `WidgetRenderer`).
- [x] Add zoom level indicator and controls (mockup has +/- buttons).
- [x] Integrate sidebar palette with GridContext
- [x] Implement selection sync (Canvas <-> Layers)
- [x] Implement Double-click to add widget
- [x] Implement Drag and Drop to add widget
- [x] Implement Delete key shortcut
- [x] Implement Canvas Zoom controls
- [x] Implement Resize handles
- [x] Implement Auto-expand layers tree
- [x] Implement Sidebar auto-switch to layers on selection
- [x] Wire click-to-select functionality bidirectionally with the Layers Tab.

## Phase 5: WiFi Manager (COMPLETE)
- [x] Replaced basic `WifiTab` with a high-fidelity `WifiManager` component.
- [x] Implemented background scanning and network list rendering with signal indicators.
- [x] Integrated connection modal for joining secure networks.
- [x] Modernized the Soft AP configuration interface to match the new design system.

## Phase 6: Accessibility & Advanced Properties (COMPLETE)
- [x] Implement **High Contrast Theme** as default for vision-impaired users (Pure black backgrounds, white text, 3px borders).
- [x] Add **Text Styling** properties (Font Size, Text Alignment) to all widgets.
- [x] Implement **Sub-item Management** for Rollers and Dropdowns (Newline separated options).
- [x] Support **Nested Elements** management in Nav Menus (Add/Remove children menu items).
- [x] Enhance **WidgetRenderer** to handle dynamic options and alignment.
- [x] Update **Selection Pulse** for high-visibility.
