# GRIDOS UI Redesign — Design Plan + Code Audit

> Target: A professional-grade embedded UI builder that feels like Figma or Framer, purpose-built for ESP32 display design. Every pixel of screen real estate serves the canvas. Everything else is contextual, discoverable, and stays out of the way.

---

## PART D — UX FLOW IMPROVEMENTS (Interaction Design Pass)

> This section supersedes and refines the interaction model described in Parts A–C. It addresses four problem areas: smart widget placement, inspector priority, grid-item parent navigation, and natural-feeling drag/resize.

---

### D1. Smart Widget Placement on Double-Click

**Current bug:** `addItem` always sets `x: 20, y: 0`. Every double-clicked widget stacks at top-left, requiring the user to drag it immediately after adding.

**Desired behavior:** Place the new widget at the most contextually useful position.

#### Decision Tree (evaluated in order):

```
1. A pane-grid or grid item IS selected in the sidebar/canvas
   → Place as child of that grid, first empty cell (scan col 0→N, row 0→M)

2. A non-container item IS selected
   → Place on the same page, below the selected item:
      newX = selectedItem.x
      newY = selectedItem.y + selectedItem.height + 12

3. A page IS selected (no item selected)
   → Place at center of the currently visible canvas viewport:
      newX = (viewportScrollLeft + viewportWidth/2) / scale - defaultW/2
      newY = (viewportScrollTop + viewportHeight/2) / scale - defaultH/2
      Then run `findFirstFreePosition()` to avoid overlap

4. Fallback
   → Cascade from (40,40) in 20px steps for each existing item on the page
```

#### `findFirstFreePosition(page, w, h, startX, startY)`:
```ts
// Scan in 20px steps starting from (startX, startY).
// Return first (x,y) where [x, x+w] × [y, y+h] does not
// intersect any existing top-level item's bounding box.
// Cap at 10 attempts; if all overlap, return (startX + attempts*24, startY).
```

**Files to change:**
- `src/App.tsx` → `addItem()`: replace `x: fx ?? 20, y: fy ?? 0` with call to `smartPlacement()`
- `src/utils.ts` → add `findFirstFreePosition()`
- `src/components/editor/Sidebar.tsx` → `handlePaletteClick`: pass canvas viewport rect to `addItem`

---

### D2. Inspector (Properties Panel) — Priority & Tab Order

**Goal:** Open immediately to the section most likely to be edited. Stop burying the most important controls below the fold.

#### Per-type default open section:

| Widget Type | Default Tab | First section open |
|---|---|---|
| `grid-item` | **Content** | Icon + Top/Bottom Text (most often customized) |
| `pane-grid` | **Grid** | Cols / Rows / Gap |
| `grid` | **Grid** | Cols / Rows / Gap |
| `label` | **Style** | Text + Font Size + Color |
| `btn` | **Style** | Text + Color |
| `switch` / `slider` / `arc` / `bar` | **Style** | then MQTT if mqttTopic set |
| `clock` | **Style** | Format string |
| `chart` | **Style** | then MQTT |
| `panel-ref` | **Layout** | Width / Height |
| Everything else | **Style** | top section |

#### Section ordering within tabs:

**For `grid-item` → Layout tab:**
```
1. CELL POSITION   ← TOP (col, row) — this is what matters in a grid
2. CELL SPAN       ← second (spanCols, spanRows) + mini preview
3. POSITION & SIZE ← shown as read-only / computed (grayed out inputs)
```

**For `pane-grid` → Grid tab (new tab, not "Layout"):**
```
1. COLUMNS [number input]   ROWS [number input]
2. GAP [slider 0–40px]
3. [ Mini grid preview — live CSS grid, click cell to inspect ]
```

**For standard items → Style tab:**
```
1. CONTENT (text/icon fields)   ← always first
2. COLORS (background, text)
3. FONT & ALIGNMENT
4. BORDER & RADIUS
5. OPACITY
```

#### Implementation:
- Add `defaultTab: string` computed from `selectedItem.type` via a lookup map
- Store the current open tab in component state; reset to `defaultTab` whenever `selectedItem.id` changes
- Auto-scroll the first section into view on tab switch (`useEffect` + `scrollIntoView({ behavior: 'smooth' })`)

---

### D3. Grid-Item → Parent Grid Navigation

**Goal:** When a `grid-item` or any child of a `pane-grid` is selected, make it obvious which grid it belongs to and allow one-click navigation to that grid's settings.

#### Inspector header breadcrumb:

```
┌──────────────────────────────────────────────────┐
│  ⊞ Dashboard Grid  ›  ⏹ Temperature Widget  [×]  │
│  [pane-grid]           [grid-item]               │
└──────────────────────────────────────────────────┘
```

- The parent name (`Dashboard Grid`) is a **clickable link** → selects the parent pane-grid, switches tab to "Grid"
- If nested deeper (grid inside pane inside page), show full path: `Page › pane-grid name › item name`
- The `›` chevrons are visual separators only, not clickable

#### Layout tab — "Parent Grid" section (for grid-items):

```
▼ PARENT GRID                           [Edit Grid ↗]
  Dashboard Grid  —  4 × 4 (16 cells)
  ┌──────────────────────────────────┐
  │  ·  ·  ·  ·  │                  │
  │  ·  ■  ·  ·  │  ← mini grid     │
  │  ·  ·  ·  ·  │    highlight     │
  │  ·  ·  ·  ·  │    this item     │
  └──────────────────────────────────┘
```

- [Edit Grid ↗] — selects the parent, opens its Grid tab in inspector
- Mini grid shows all cells; current item's cells are highlighted in indigo; occupied cells by others in slate; empty cells in transparent

#### Layers panel — indent + badge:

```
▼ ⊞ Dashboard Grid      [pane-grid]
      ⏹ Temperature     [grid-item]  col:1 row:1
      ⏹ Humidity        [grid-item]  col:2 row:1
```

- Grid-items show `col:N row:M` badge in the layers row so you can see layout at a glance without opening inspector

---

### D4. Drag-and-Drop — Natural Feel

**Problems today:**
1. The item snaps to its top-left on drag start (grab offset not consistently applied)
2. No visual feedback on where the item will land in a grid cell
3. No minimum drag threshold — tiny mouse twitches register as drags
4. Items dropped into a pane-grid at unknown position

#### Fixes:

**D4-a. Grab offset (fix the existing issue):**
```ts
// On mousedown on an item, record:
dragOffset = { x: mouseX - item.x * scale, y: mouseY - item.y * scale }

// On mousemove, compute new item position:
newX = (mouseX - dragOffset.x) / scale
newY = (mouseY - dragOffset.y) / scale
```
The item should move exactly where you grabbed it — no jump.

**D4-b. Drag threshold:**
```ts
// Don't commit to a drag until mouse has moved >5px from mousedown origin.
// In the 0–5px window: item stays put. After: drag begins.
// This eliminates accidental drags when clicking to select.
const DRAG_THRESHOLD = 5; // px in screen space
```

**D4-c. Ghost / live preview:**
- During drag: show a 50% opacity ghost of the item at the drag position (CSS `opacity: 0.5` on the dragging element)
- The original position: show a dim placeholder outline (1px dashed `#94a3b8`, 20% opacity background)
- NO complex shadow calculations — just opacity change, no new DOM nodes

**D4-d. Pane-grid cell highlight:**
- While dragging over a pane-grid: calculate target cell `(col, row)` from mouse position
- Highlight that cell with `background: rgba(99,102,241,0.25)` + `outline: 2px solid #6366f1`
- If cell is occupied: highlight in amber `rgba(245,158,11,0.25)` + amber outline
- Show a small tooltip `Drop: col 2, row 1` near cursor (absolutely positioned)

**D4-e. Drop animation:**
- When item is dropped: play a single CSS keyframe:
  ```css
  @keyframes drop-settle {
    0%   { transform: scale(1.03); }
    100% { transform: scale(1); }
  }
  ```
  Duration: 120ms — subtle, not flashy. No spring physics (ESP32 CPU is not the bottleneck here but keeping the browser lean is good practice).

---

### D5. Resize — Natural Feel

**D5-a. Handle placement:** 8 handles — 4 corners + 4 edge midpoints. Current implementation has corner handles only.

**D5-b. Fixed anchor:** The handle opposite to the dragged one stays fixed. Dragging the bottom-right handle grows width+height; top-left stays anchored. This must hold for all 8 handles.

**D5-c. Live size tooltip:**
```
┌─────────┐
│         │
│  item   │
│         │         ← while resizing:
└─────────┘ ► [192 × 88]   (appears 6px below cursor)
```
Small pill badge: `W × H` in current pixels. Updates every frame. Disappears on mouseup.

**D5-d. Minimum size:** 24px × 20px — enforced in `updateItem`.

**D5-e. Grid-item resize constraint:** If the item is a `grid-item`, resize is disabled (cell size is determined by the pane-grid's cols/rows/gap). Instead, show a tooltip: "Resize via parent grid cols/rows". The span controls (spanCols, spanRows) in the inspector are the resize mechanism for grid-items.

**D5-f. Shift key aspect ratio lock:**
```ts
if (e.shiftKey) {
    const ratio = item.width / item.height;
    newH = newW / ratio;
}
```

---

### D6. Visual Design — Embedded-Optimized Aesthetic

Since the app itself runs in a browser controlling an ESP32, the *builder* can use slightly richer CSS than the device renders — but we still keep it lean and purposeful.

#### Color palette (refined from A10):
```
--c-primary:    #5b5fe8;   /* deeper indigo — less purple */
--c-surface-0:  #0d1117;   /* near-black background */
--c-surface-1:  #161b22;   /* card background */
--c-surface-2:  #21262d;   /* input / nested background */
--c-border:     rgba(255,255,255,0.08);
--c-text-1:     #e6edf3;   /* primary text */
--c-text-2:     #8b949e;   /* secondary / labels */
--c-accent-g:   #3fb950;   /* online / success */
--c-accent-a:   #d29922;   /* warning / lock */
--c-accent-r:   #f85149;   /* danger — only in confirm contexts */
```

#### What NOT to use (embedded-optimized):
- No `backdrop-filter: blur()` on any element that updates more than once per second (kills mobile GPU)
- No `box-shadow` with blur > 20px on canvas elements (overdraw)
- No gradient mesh backgrounds — use single `radial-gradient` dot grid or solid color
- No `SVGAnimateElement` / SMIL animations
- CSS animations: max 3 concurrent per frame
- `will-change: transform` only on actively-dragging elements; remove it on drop

#### Typography (lean, no heavy font loading):
```
--font-ui:     'DM Sans', system-ui, sans-serif;   /* 2 weights: 400, 700 */
--font-mono:   'JetBrains Mono', monospace;          /* for IDs, coordinates */
```
Load only: DM Sans 400 + 700, JetBrains Mono 400. Total ≈ 80KB. No decorative display font needed — the UI is a tool, not a landing page.

#### Spacing & sizing (unchanged from A10 — already good):
- 8-point grid
- Component heights: inputs 32px, buttons 32–36px, icon rail 48px wide
- Inspector drawer 300px (reduced from 320px — saves 20px for canvas)
- Sidebar 260px collapsed (reduced from 280px)

---

### D7. Widget Palette — Double-Click UX Refinement

**Current:** Double-click adds widget at `(20, 20)`. Single-click selects the page.

**New behavior:**
- **Single click on palette item**: highlight the palette item, show a small toast: `"Double-click to add, or drag to canvas"` — disappears after 1.5s. Do NOT change page selection.
- **Double-click on palette item**: add widget using `smartPlacement()` (D1), immediately select the new item, open inspector to default tab (D2).
- **Drag from palette**: existing behavior (fine) — drop at cursor position.

**Palette card design (compact, no thumbnails):**
```
┌─────────────────────────────┐
│  Aa  Label              [+] │   ← 36px tall, no preview image
│  ⬡  Button             [+] │   ← icon + label + quick-add button
│  ⏱  Clock              [+] │
└─────────────────────────────┘
```
- `[+]` quick-add button on hover — same as double-click but immediately adds
- No `WidgetRenderer` thumbnail previews in the palette (too heavy: each card would instantiate a React render subtree)
- Keep icons as simple unicode/emoji — no SVG rendering per card

---

### D8. Inspector — Preference Visibility Rules Summary

A crisp rule for what shows ABOVE THE FOLD in the inspector (no scroll required):

| Selection type | Visible without scrolling |
|---|---|
| `grid-item` (in pane-grid) | Breadcrumb → Content (icon, text) → Cell Position (col/row) |
| `pane-grid` | Name → Cols/Rows/Gap → mini preview |
| `label` | Name → Text content → Font size → Color |
| `btn` | Name → Text → Color → Action |
| `switch` / `slider` | Name → MQTT topic → Value range |
| `panel-ref` | Name → "Go to panel →" link |
| Page (no item selected) | Page name → BG color → Page size (read-only) |
| Screen (name clicked) | Screen name → BG color |

Everything else is below a scroll — collapsed by default, expandable. This way an ESP32 display builder can tweak the 3 most common properties without touching scroll at all.

---

---

## PART A — DESIGN REDESIGN

---

### A1. Philosophy

| Principle | What it means |
|---|---|
| **Canvas is king** | The editor canvas gets the maximum possible horizontal and vertical space |
| **Contextual UI** | Properties, actions, and toolbars appear where and when they're needed |
| **Zero clutter at rest** | Panels collapse; toolbars hide; only the active context is visible |
| **Keyboard-first** | Shortcuts are visible everywhere; nothing requires a menu hunt |
| **Consistent polish** | One visual language end-to-end — same radius, spacing, shadow, motion |

---

### A2. New Shell Layout

**Before:**
```
[Header 60px]
[Sidebar 560px] | [Canvas flex] | [Properties 400px fixed]
```

**After:**
```
[Header 52px — leaner]
[Icon Rail 48px] | [Sidebar Panel 280px collapsible] | [Canvas flex] | [Inspector Drawer 320px slide-in]
```

The Properties panel becomes a **slide-in drawer** — only visible when something is selected, slides out when you click the canvas background. This returns ~400px to the canvas when nothing is selected.

---

### A3. Header Bar

**Current problems:**
- ERASE ALL at full red prominence with no confirm dialog
- 7 action buttons all at equal visual weight — no hierarchy
- Device IP input looks like an afterthought
- Theme toggle barely visible

**New design:**
```
[● GRIDOS]  [BUILDER · DASHBOARD · MIRROR · WIFI · CONSOLE · SETTINGS]    [● 192.168.4.1  ↑ SYNC]  [···]
```

- Logo: `● GRIDOS` — small purple dot glyph + 900-weight wordmark
- Nav tabs: text-only; active tab = 2px indigo underline + bold; no background box
- **Spacer** — real breathing room
- **Device connection chip**: single pill `● 192.168.4.1` + `↑ SYNC` button. Green dot = connected, red = offline. Click IP opens a small popover to change it
- **`···` overflow menu**: EXPORT, IMPORT, ERASE ALL (requires typing "ERASE" to confirm — no `window.confirm`), Keyboard Shortcuts reference
- Remove standalone EXPORT / IMPORT / ERASE buttons from the top bar

---

### A4. Left Icon Rail (new — 48px)

A narrow icon spine on the far left, like VS Code's activity bar.

```
┌────┐
│ 🗂  │  Layers        (default active)
│ 🧩  │  Widgets
│ 🔲  │  Master Panels
│ 📊  │  Grid Defs     (replaces Dashboard tab)
│ ⚙️  │  Settings
└────┘
```

- Active: 2px indigo left border, indigo tinted icon, subtle bg
- Clicking the active icon collapses the sidebar panel (rail stays)
- Keyboard: `L` = layers, `W` = widgets, `P` = panels, `D` = grid defs

---

### A5. Sidebar Panel (280px, collapsible)

**A5-a. Layers Panel:**

```
▼ 🖥  Main Screen                              [+ Page]
   ▼ 📄 Page (0,0)
      ● 🔲  New pane-grid  [pane-grid]  [👁][🔒][✕]
         ● ⏹  New grid-item [grid-item]  [👁][🔒][✕]
      ● Aa  New label       [label]      [👁][🔒][✕]
── MASTER PANELS ────────────────────── [+Sidebar][+Header]
▼ 🔲  Sidebar
▼ 🔲  Modern Header
```

Changes:
- Each row: `color-dot | type-icon | name | type-badge | [eye][lock][delete]`
- Color-coded left dot: indigo=container, blue=text, green=control, amber=nav
- Eye: toggles `item.hidden` — item dims on canvas
- Lock: toggles `item.locked` — locked items refuse drag/resize
- Double-click name to edit inline (keep existing behavior)
- Right-click context menu: Rename / Duplicate / Move to Page / Delete
- Drag rows to reorder within a page (sortable)
- `+ Page` at end of each screen row
- `+ Screen` at bottom of screens list — not in the panel header

**A5-b. Widget Palette:**

Keep collapsible sections. Improve:
- Section headers: sharper, count badge, smooth `max-height` animation
- Widget cards: 2-column, 90px tall, with mini `WidgetRenderer` thumbnail preview
- "Favorites" section at top — drag to pin (persisted to localStorage key `gridos-palette-pinned`)
- Search stays at top with instant filter
- Double-click to add at default position; drag for precise placement

**A5-c. Master Panels (🔲 icon active):**
- Shows panels as cards: name, dimensions, element count preview
- Click → canvas enters Panel Edit mode (already exists)
- New Panel button at top
- Drag a card onto canvas = instant `panel-ref` placement

**A5-d. Grid Definitions (📊 icon active — replaces Dashboard tab):**
- Move pane-grid editing from a separate tab into the sidebar rail
- List of pane-grid defs as cards with tile count
- Center canvas area shows visual tile grid for the selected def
- Inspector shows tile properties when a tile is selected

---

### A6. Canvas Area

**A6-a. Floating Canvas Toolbar (top-center, glassmorphic):**
```
[⟵ Undo] [⟶ Redo]  │  [↖ Select ▾] [✋ Pan]  │  [# Snap] [⊞ Grid]  │  [Fit] [−] [100%] [+]
```
- `Ctrl+Z/Y` shortcuts shown in tooltips
- Tools: Select (default), Pan (hold Space)
- Snap toggle: 8px grid alignment + item-edge snapping
- Zoom: `Ctrl+scroll` + buttons; click the `%` to type exact value

**A6-b. Canvas visual improvements:**
- Background: subtle dot-grid pattern (`radial-gradient`) — signals "this is a canvas"
- Page frames: solid thin border + drop shadow; page name in 9px uppercase label at bottom-left corner inside the frame
- Selection outline: 2px solid `#6366f1`, filled-square corner handles (8×8), edge-midpoint handles — Figma style
- Multi-select: dashed indigo bounding box
- Hover state: 1px dashed `rgba(99,102,241,0.4)` before click
- **Floating item toolbar** — appears 8px above selected item:
  ```
  [⧉ Dup] [↑ Fwd] [↓ Back] [🔒 Lock] [🗑 Del]
  ```
- **Right-click context menu:**
  ```
  Rename
  Duplicate          Ctrl+D
  ─────────────────────────
  Bring to Front     Ctrl+]
  Send to Back       Ctrl+[
  ─────────────────────────
  Move to Page ▶
  Group into Grid
  ─────────────────────────
  Delete             Del
  ```
- Drop zone highlight for pane-grid cells (already implemented — keep + polish border-radius and animation)
- Guides: 1px, brighter indigo, with position tooltip while dragging

**A6-c. Canvas Bottom Bar (floating pill, bottom-right):**
```
[📍 MAP] [🔬 X-RAY] [►► HEADER]      [−] [100%] [+]
```
- Glassmorphic pill with `backdrop-filter: blur(8px)`
- MAP/XRAY are toggle chips
- Navigator minimap: collapsible panel triggered by MAP, clean thumbnail
- Keyboard `N` toggles minimap

---

### A7. Inspector / Properties Drawer (right, 320px slide-in)

```
┌──────────────────────────────────────────┐
│  ⏹ New grid-item    [GRID-ITEM]     [×]  │  ← header
├──────────────────────────────────────────┤
│  [Style ▼] [Layout] [Events] [MQTT]      │  ← tabs
├──────────────────────────────────────────┤
│  ▼ IDENTITY                              │
│    Name  [New grid-item              ]   │
│    ID    grid-item_34zfy  [copy]         │
│                                          │
│  ▼ POSITION & SIZE                       │
│    ┌──────────┬──────────┐               │
│    │  X   0   │  Y   0   │               │
│    ├──────────┼──────────┤               │
│    │  W  190  │  H   90  │               │
│    └──────────┴──────────┘               │
│    Col [0-3 ▸]    Row [0-3 ▸]            │
│                                          │
│  ▼ APPEARANCE                            │
│    Background   ████ #FFFF00  SOLID      │
│    Text Color   ████ #000000             │
│    Font Size    [────────●──]  16        │
│    Align  [Left] [Center ✓] [Right]      │
│                                          │
│  ▼ BORDER                                │
│    Width [0]   Radius [10]               │
│    Color  ████ #000000                   │
│                                          │
│  ▼ CELL SPAN  — Grid 4×4                │
│    Span Cols [1]   Span Rows [1]         │
│    [  mini grid preview  ]               │
│                                          │
│  ▼ CONTENT                               │
│    Icon   💡 [────────────────────]      │
│    Top    [────────────────────────]     │
│    Bottom [────────────────────────]     │
│                                          │
└──────────────────────────────────────────┘
```

**Tabs:**
- **Style** — appearance (colors, font, border, radius, opacity)
- **Layout** — position, size, col/row/span, anchoring
- **Events** — onClick, onDoubleClick, onLongPress (dropdown of action types + target input)
- **MQTT** — stateTopic, commandTopic, haEntity with a "Test Publish" button

**Component improvements:**
- Collapsible groups with `▼/▶` and smooth `max-height` CSS animation (200ms)
- Position/Size: 2×2 grid of inputs instead of separate rows
- **Real color picker**: swatch click → `<input type=color>` + hex text + opacity slider (instead of just a hex string)
- **Slider inputs**: Font size, opacity, radius, border-width all get sliders
- **Multi-selection**: Shows shared props; mixed values shown as `—`; editing updates all

---

### A8. Mirror Tab (implement it)

```
┌─────────────────────────────────────────────────────┐
│  Page: [Main Screen – Page (0,0) ▼]  Scale: [75% ▼] │
│                                                     │
│  ┌──────────────────────────────────────────────┐   │
│  │  [ESP32 device bezel chrome]                 │   │
│  │  ┌────────────────────────────────────────┐  │   │
│  │  │                                        │  │   │
│  │  │   WidgetRenderer (full project render) │  │   │
│  │  │                                        │  │   │
│  │  └────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────┘   │
│                                                     │
│  [⟳ Refresh]   When connected: [● LIVE]             │
└─────────────────────────────────────────────────────┘
```

- Uses existing `WidgetRenderer` to render active page — zero new rendering code
- Wrapped in CSS device chrome (rounded bezel, dark body)
- Scale selector: 50% / 75% / 100% / Fit
- Page selector: dropdown of all screens and pages
- LIVE mode (when device IP set): polls `/api/state` every 2s to update live values

---

### A9. Settings Tab

Keep all functionality, visual refresh:
- Cards with proper shadows and radii
- Group: Network | Display | MQTT | Advanced
- Add "About" section pulling firmware version + uptime from device API when connected

---

### A10. Visual Language & Tokens

**Colors:**
```
Primary:      #6366f1   (selection, active, indigo-500)
Success:      #10b981   (online, sync — emerald)
Danger:       #ef4444   (delete — only in confirm contexts)
Warning:      #f59e0b   (lock, warning — amber)
Surface dark: #18181b / #27272a
Surface lite: #ffffff / #f4f4f5
Border dark:  rgba(255,255,255,0.07)
Border lite:  #e4e4e7
```

**Spacing:** 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48px (8-point grid)

**Radius:** 4px chip, 8px input/button, 12px card, 16px drawer

**Motion:**
```
Panel slide:     200ms ease-out
Drawer open:     250ms cubic-bezier(0.4, 0, 0.2, 1)
Group collapse:  200ms ease-in-out (max-height)
Hover:           100ms
```

**Shadows:**
```
Card:     0 1px 3px rgba(0,0,0,0.08)
Floating: 0 4px 16px rgba(0,0,0,0.12)
Drawer:  -4px 0 24px rgba(0,0,0,0.15)
```

---

### A11. Keyboard Shortcuts

| Key | Action |
|---|---|
| `V` | Select tool |
| `H` | Hand / pan |
| `G` | Toggle grid snap |
| `N` | Toggle navigator |
| `L` | Layers panel |
| `W` | Widgets panel |
| `Del / Backspace` | Delete selected |
| `Ctrl+D` | Duplicate |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `Ctrl+A` | Select all on page |
| `Ctrl+]` / `Ctrl+[` | Bring forward / Send back |
| `Ctrl+S` | Sync to device |
| `Escape` | Deselect / close drawer |
| `Space` (hold) | Temporary pan |
| `Ctrl+0` | Fit canvas to screen |
| `?` | Open shortcuts modal |

---

### A12. New Files (Phase Plan)

**New:**
- `src/components/layout/IconRail.tsx`
- `src/components/layout/SidebarPanel.tsx`
- `src/components/editor/CanvasToolbar.tsx`
- `src/components/editor/FloatingItemToolbar.tsx`
- `src/components/editor/ContextMenu.tsx`
- `src/components/inspector/InspectorDrawer.tsx`
- `src/components/inspector/tabs/StyleTab.tsx`
- `src/components/inspector/tabs/LayoutTab.tsx`
- `src/components/inspector/tabs/EventsTab.tsx`
- `src/components/inspector/tabs/MqttTab.tsx`
- `src/components/ui/ColorPicker.tsx`
- `src/components/ui/SliderInput.tsx`
- `src/components/ui/Tooltip.tsx`
- `src/components/mirror/MirrorTab.tsx`
- `src/components/ui/ConfirmModal.tsx`

**Refactored:**
- `src/App.tsx` — layout restructure, rail/drawer state
- `src/index.css` — new token system, remove dead rules
- `src/components/editor/Sidebar.tsx` → split to `LayersPanel.tsx` + `WidgetsPanel.tsx`
- `src/components/editor/PropertiesPanel.tsx` → replaced by `InspectorDrawer.tsx`
- `src/components/layout/Header.tsx` — lean new design
- `src/components/dashboard/DashboardTab.tsx` → merged into sidebar rail

---

### A13. Implementation Phases

| Phase | Work | Risk |
|---|---|---|
| 1 — Shell | New CSS tokens, leaner Header, Icon Rail, Sidebar host | Low — no logic changes |
| 2 — Canvas | Dot-grid bg, floating toolbar, Figma selection, item toolbar | Medium |
| 3 — Inspector | Tabbed drawer, collapsible groups, color picker, sliders | Medium |
| 4 — Panels & Mirror | Master Panels rail, Mirror tab with WidgetRenderer | Low |
| 5 — Polish | All transitions, dark theme audit, tooltip system, accessibility | Medium |

---

---

## PART B — CODE AUDIT (Critical Bugs & Flaws)

---

### B1. CRITICAL: `GridContext` has no TypeScript type

**File:** `src/context/GridContext.tsx`
```ts
export const GridContext = React.createContext<any>(null);  // ← any kills TS entirely
```
Every component that does `useContext(GridContext) as any` gets zero type checking. A typo like `context.remmoveItem` fails silently at runtime, not at compile time.

**Fix:** Define a `GridContextType` interface with all fields and use it:
```ts
export const GridContext = React.createContext<GridContextType | null>(null);
export const useGrid = () => {
    const ctx = useContext(GridContext);
    if (!ctx) throw new Error("useGrid used outside GridContext");
    return ctx;
};
```

---

### B2. CRITICAL: ERASE ALL has no real confirm

**File:** `src/components/layout/Header.tsx` line 86
```tsx
onClick={context?.resetProject}  // ← fires immediately, no confirm dialog
```
`window.confirm` is not called here — it's called inside `resetProject` in `App.tsx` (if at all). The button fires directly. An accidental mis-click wipes everything.

**Fix:** Use a `ConfirmModal` component that requires the user to type "ERASE" before proceeding. Move ERASE ALL behind the `···` overflow menu so it's not a single-click action on the main toolbar.

---

### B3. HIGH: Project migration silently deletes user data

**File:** `src/App.tsx` lines 101–118
```ts
const VERSION = "2026.4";
if (localStorage.getItem("ds_project_version") !== VERSION) {
    localStorage.setItem("ds_project_version", VERSION);
    data = { screens: [...], panels: [...], paneGrids: [] };  // ← overwrites!
}
```
If you change the `VERSION` string, every existing user's project is silently deleted and replaced with an empty default. There's no migration — just a wipe.

**Fix:** Implement schema migration instead of a reset. Bump version only when schema is incompatible, and run a migration transform on the loaded data before using it.

---

### B4. HIGH: `DashboardTab.addGrid` creates wrong-typed PaneGrid

**File:** `src/components/dashboard/DashboardTab.tsx` line 34–43
```ts
const newGrid: PaneGrid = {
    id,
    name: `New Dashboard ${paneGrids.length + 1}`,
    columns: 3,   // ← `PaneGrid` type has `cols`, not `columns`
    gap: 10,
    panes: []
    // missing: `cols`, `rows`
};
```
`PaneGrid` type (`types.ts` line 110) defines `cols: number` and `rows: number`, but `addGrid` creates an object with `columns: 3` (no `rows`, no `cols`). TypeScript only catches this because the context is typed `any`. On the device, `grids.json` parser reads `gObj["cols"] | gObj["columns"]` so it works by accident, but the JS object is malformed.

**Fix:** Use `cols: 3, rows: 3` to match the type. Add `rows: number` to the creation call.

---

### B5. HIGH: `setProject` called on every keystroke → expensive localStorage serialization

**File:** `src/App.tsx` line 162
```ts
useEffect(() => {
    localStorage.setItem("ds_project_v3", JSON.stringify(project));
}, [project]);
```
And `updateItem` is called on every `onChange` of every input field. So typing a name fires: setState → setHistory → re-render → JSON.stringify(fullProject) → localStorage.setItem. For a project with 50 widgets, this is 50KB+ serialized on every character.

**Fix:** Debounce the localStorage write with 500ms delay:
```ts
useEffect(() => {
    const t = setTimeout(() => localStorage.setItem("ds_project_v3", JSON.stringify(project)), 500);
    return () => clearTimeout(t);
}, [project]);
```

---

### B6. HIGH: Undo history fills up with single-keystroke changes

**File:** `src/App.tsx` lines 124–130
Every `updateItem` call pushes a new history entry. Typing a 10-character name pushes 10 entries, consuming 10 of the 50 undo slots. After renaming 5 things, undo is useless.

**Fix:** Debounce `setProject` calls from text inputs — commit to history only on blur or after 500ms of inactivity. Alternatively, add a `{ skipHistory: boolean }` option to `setProject`.

---

### B7. MEDIUM: `Math.random().toString(36).substr(2, 5)` for IDs

**File:** `src/App.tsx` and everywhere else IDs are created.
- `substr` is deprecated (use `substring`)
- 5 chars of base-36 = ~60M combinations. With 20 items in a project, collision probability is ~0.003% per add. Fine normally, but could cause subtle item-merge bugs in complex projects.

**Fix:** Use a crypto UUID or at minimum increase to 8 chars:
```ts
const uid = (n = 6) => Math.random().toString(36).substring(2, 2 + n);
```

---

### B8. MEDIUM: WiFi status polling uses mock data only

**File:** `src/App.tsx` lines 44–46
```ts
async getWifi(): Promise<WifiStatus> {
    const saved = localStorage.getItem("ds_mock_wifi");
    return saved ? JSON.parse(saved) : { connected: true, ... };  // ← always mock
}
```
`refreshWifi` runs every 5 seconds but only reads from localStorage, never from the actual device. The "ONLINE" badge in the header always shows mock data. Real device connectivity is never checked.

**Fix:** When `remoteIp` is set, fetch `/api/status` from the device. Fall back to mock if fetch fails.

---

### B9. MEDIUM: `removePage` uses blocking `alert()`

**File:** `src/App.tsx` line 280
```ts
alert("You cannot delete the base Page (0,0).");
```
Blocking `alert()` freezes the UI thread. On mobile browsers it looks terrible.

**Fix:** Use an inline toast/notification or a non-blocking error state.

---

### B10. MEDIUM: `normalizeGridChildren` not called on import

**File:** `src/App.tsx` `importProject` callback
When a user imports a JSON file, it's used directly with no validation or normalization. A corrupted file with out-of-bounds col/row values will load into the editor and appear broken on canvas.

**Fix:** Call `normalizeGridChildren` on all pages during import, and validate the schema before accepting.

---

### B11. MEDIUM: `selections` state has no type — phantom selection keys accumulate

**File:** `src/App.tsx` line 149
```ts
const [selections, setSelections] = useState<Record<string, any[]>>({});
```
`selections` is keyed by `screenId` (or `'panel'`). Old screen IDs that were deleted still exist as keys in this map. Over time, the object grows unboundedly. Also, selection entries have no defined shape.

**Fix:** Define a `Selection` type. Clear stale screen keys when a screen is removed.

---

### B12. LOW: Inline style objects created on every render prevent memoization

Almost every component uses `style={{ ... }}` with object literals. React compares these by reference, not value — so even unchanged styles trigger re-renders of children. For a canvas with 50 widgets, this causes cascade re-renders on every mouse move.

**Fix:** Move static styles to CSS classes (`index.css`). Only use inline styles for truly dynamic values (position, size, colors from data). Memoize components that receive style props with `React.memo`.

---

### B13. LOW: `window.innerWidth` read during SSR-unsafe `useState` init

**File:** `src/App.tsx` line 79
```ts
const [width, setWidth] = useState(window.innerWidth);
```
Fine for Vite SPA, but if this ever moves to SSR (Next.js, etc.), `window` is not defined. Minor now, worth noting.

---

### B14. LOW: `contextMenu` state declared but render logic not wired

**File:** `src/components/editor/CanvasArea.tsx` line 25
A `contextMenu` state is declared with position and type fields, suggesting a right-click menu was planned but the render block may be incomplete. Verify all state is consumed.

---

---

## PART C — TEST PLAN

---

### C1. Unit Tests (`vitest` — zero deps, fast)

**File: `src/utils.test.ts`**

```ts
describe('normalizeGridChildren', () => {
    it('clamps col > cols-1 to cols-1')
    it('clamps row > rows-1 to rows-1')
    it('clamps span that would overflow grid boundary')
    it('leaves valid children unchanged')
    it('works recursively on nested grids')
})

describe('findItemRecursive', () => {
    it('finds top-level item by id')
    it('finds deeply nested grid-item')
    it('returns undefined for missing id')
})

describe('applyRecursive', () => {
    it('transforms target item')
    it('removes item when transform returns null')
    it('does not mutate children of non-target items')
})

describe('getAbsoluteOffset', () => {
    it('returns item x,y for top-level item')
    it('adds parent pane-grid offset for nested item')
    it('uses gap-only formula for pane-grid (not gap+padding)')
})

describe('findGridAtPositionRecursive', () => {
    it('finds pane-grid at click coordinates')
    it('returns innermost nested grid')
    it('returns undefined when coordinates outside any grid')
})
```

**File: `src/undo.test.ts`**

```ts
describe('undo/redo', () => {
    it('undo restores previous state')
    it('redo re-applies undone state')
    it('new action after undo clears redo stack')
    it('undo at empty past does nothing')
    it('redo at empty future does nothing')
    it('past is capped at 50 entries')
})
```

**File: `src/gridLogic.test.ts`**

```ts
describe('updateItem — pane-grid resize clamping', () => {
    it('clamps children col when cols shrinks')
    it('clamps children span when span would overflow new cols')
    it('does not clamp when cols grows')
    it('updates paneGrids definition cols/rows to match item')
})

describe('reorderGridItem — span-aware overlap', () => {
    it('moves item to empty cell')
    it('swaps with blocking item (1x1)')
    it('swaps with blocking item that spans multiple cells')
    it('no-ops when source item not found')
})
```

---

### C2. Integration Tests (`playwright` — already configured)

**File: `tests/builder.spec.ts`**

```ts
describe('Widget palette', () => {
    it('palette sections persist open/closed on reload')
    it('expanding section near bottom auto-scrolls into view')
    it('search filters widgets across all sections')
    it('dragging widget from palette to canvas adds it')
    it('double-clicking widget adds it to active page')
})

describe('Canvas DnD', () => {
    it('drag item moves it to new position (natural grab offset)')
    it('drag does not snap item top-left to cursor origin')
    it('resize handle maintains top-left anchor')
    it('multi-select drag moves all selected items')
    it('dragging into pane-grid highlights target cell')
})

describe('Properties panel', () => {
    it('opens when item is selected')
    it('closes when canvas background is clicked')
    it('shows Column/Row bounds from parent grid')
    it('shows Span Cols/Rows for grid-item')
    it('mini grid preview updates on span change')
    it('overlap validation blocks invalid span')
})

describe('Grid operations', () => {
    it('changing pane-grid cols clamps out-of-bounds children')
    it('changing pane-grid cols syncs paneGrids definition')
    it('grid item at out-of-bounds col is clamped by normalizeGridChildren on sync')
})

describe('Undo / redo', () => {
    it('Ctrl+Z undoes last item add')
    it('Ctrl+Z undoes item move')
    it('Ctrl+Shift+Z redoes')
    it('undo chain through 3 operations')
})

describe('Export / Import', () => {
    it('exported JSON contains all screens, panels, paneGrids')
    it('importing JSON restores exact project state')
    it('importing file with out-of-bounds grid children normalizes them')
})

describe('Sync', () => {
    it('sync POST contains normalized items (no out-of-bounds col/row)')
    it('sync updates paneGrids definition cols/rows from item')
})
```

---

### C3. Snapshot Tests (storybook or vitest snapshots)

For `WidgetRenderer` — each widget type rendered at fixed size should match a stored snapshot. This catches accidental visual regressions when touching the renderer.

```ts
['label', 'btn', 'switch', 'slider', 'arc', 'clock', 'bar', 'checkbox',
 'dropdown', 'roller', 'circle', 'rounded_rect', 'pane-grid', 'grid', 'grid-item']
.forEach(type => {
    it(`renders ${type} without crashing`, () => {
        // render with WidgetRenderer stub, compare snapshot
    })
})
```

---

### C4. Test Infrastructure Setup

```bash
# Install
npm install -D vitest @testing-library/react @testing-library/jest-dom happy-dom

# vitest.config.ts
export default {
    test: {
        environment: 'happy-dom',
        setupFiles: ['./src/test-setup.ts'],
        coverage: { reporter: ['text', 'lcov'], include: ['src/**'] }
    }
}
```

Add to `package.json`:
```json
"test": "vitest run",
"test:watch": "vitest",
"test:coverage": "vitest run --coverage",
"test:e2e": "playwright test"
```

Target coverage: 80%+ on `utils.ts`, 60%+ on `App.tsx` state functions.
