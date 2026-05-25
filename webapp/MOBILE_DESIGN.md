# GRIDOS — Mobile-First Redesign
## Design Document v2.0 · Samsung S26 Ultra · May 2026

---

## 0. The Honest Physics

| Fact | Number |
|---|---|
| Target device | Samsung Galaxy S26 Ultra |
| Physical resolution | ~1480 × 3200 px (est.) |
| PPI | ~511 ppi |
| Device pixel ratio | 3.75 |
| **CSS viewport** | **412 × 915 px** |
| Chrome address bar (Android) | 56px |
| App bottom bar | 64px |
| Android gesture bar | 28px |
| **Usable height (browser)** | **743px** |
| **Usable height (PWA/fullscreen)** | **799px** |
| Canvas at fit-width (800×480) | **412 × 247px** |
| Canvas % of usable height | **31%** |
| Tile tap target (6×5 grid) | **69 × 49px** ✓ (min 7mm = ~37px) |
| 44px touch target in mm | **8.2mm** ✓ |

**Core constraint:** The canvas (800×480, landscape) rendered on a portrait phone will
*always* be a 247px-tall stamp. Accept it. Design around it. Don't fight it.

**Recommendation:** Ship as a PWA (add `manifest.json` + install prompt).
Gains 56px (address bar gone) = 799px usable. Black AMOLED background + standalone
mode looks native and saves battery. This is worth doing before any UI work.

---

## 1. Core UX Thesis

**Navigate, don't panel.**

The v1 design tried to show canvas + inspector simultaneously via a bottom sheet.
The math kills it: canvas = 247px, inspector peek = 280px, sum = 527px, available = 743px.
That leaves only 216px for the canvas with the inspector open — a postage stamp.

The right model for mobile is the **navigation stack**:
- You are always in ONE mode at a time
- Each mode gets the full screen
- Going back is a single gesture (Android back swipe or ← button)
- No panels competing for space

**Three modes. One thing at a time.**

```
CANVAS MODE          EDITOR MODE          DEVICE SHEET
─────────────        ────────────         ────────────
Full-screen    ─tap→  Full-screen   ─back  Pull-down
canvas view    widget  widget editor  ────→ overlay from
               ────→   (no tabs,           any mode
                        flat scroll)
```

---

## 2. Information Architecture

```
┌─────────────────────────────────────────────────┐
│                  CANVAS MODE                    │ ← default view
│  Header: [≡ Screens] [Screen Name ▾] [+ Add]    │
│  Canvas: full-width, pinch-zoom, pan            │
│  Selection bar: appears on tap (not a sheet)    │
│  Device bar: [● STATUS] [⬇ PULL] [⬆ PUSH] [⋯]  │
└─────────┬───────────────────────────────────────┘
          │ tap widget → "Edit All"
          ▼
┌─────────────────────────────────────────────────┐
│                  EDITOR MODE                    │ ← push navigation
│  Header: [← Back] [Icon Type Name] [🗑 Delete]  │
│  Single scrollable column, NO TABS:             │
│    CONTENT (text, value, icon…)                 │
│    STYLE   (colors, radius, opacity…)           │
│    POSITION (x, y, w, h)                        │
│    EVENTS  (on tap, mqtt…)                      │
└─────────────────────────────────────────────────┘

          + tap [Screen Name ▾] in header
          ▼
┌─────────────────────────────────────────────────┐
│                 SCREEN LIST                     │ ← push navigation
│  List of all screens + master panels            │
│  Tap to switch active screen                    │
│  [+ New Screen] at bottom                       │
└─────────────────────────────────────────────────┘

          + tap [+ Add] in header
          ▼
┌─────────────────────────────────────────────────┐
│               WIDGET PICKER                     │ ← half-sheet overlay
│  Semi-transparent, canvas visible behind        │
│  [Recently Used: 4 items]                       │
│  [Categorized full list]                        │
│  Tap = add to canvas center, close picker       │
└─────────────────────────────────────────────────┘

          + swipe down from top OR tap status pill
          ▼
┌─────────────────────────────────────────────────┐
│                DEVICE SHEET                     │ ← pull-down overlay
│  ● ONLINE / OFFLINE + IP                        │
│  [⬇ PULL FROM DEVICE]  [⬆ PUSH TO DEVICE]      │
│  [📥 Import]  [📤 Export]  [🗑 Erase All]       │
│  WiFi accordion                                 │
│  Console (link out)                             │
│  Dismiss: swipe up or tap backdrop              │
└─────────────────────────────────────────────────┘
```

**What's gone vs v1:**
- No SCREENS tab in bottom nav (screen list is a push-nav view)
- No DASHBOARD tab (move to DEVICE sheet or cut entirely)
- No CONSOLE tab (link inside DEVICE sheet)
- No bottom sheet with 3 states (collapsed/peek/full)
- No 4-tab inspector (one scrollable column)
- Bottom nav reduced to 2 functional tabs: **BUILD | DEVICE | SETTINGS**

---

## 3. Screen Wireframes

---

### 3A. CANVAS MODE — Default (nothing selected)

```
 412px wide, 915px tall (S26 Ultra CSS)
┌────────────────────────────────────────────┐  ← status bar 24px (Android)
│ 9:41          ○  ◁  ■                      │
├────────────────────────────────────────────┤  ← app header 56px
│ ≡  Main Screen ▾                      + Add│
│    [screen switcher]              [add wgt]│
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │                                      │  │
│  │  ┌──────┐  ·  ·  ·  ·  ·            │  │  ← canvas 412×247px
│  │  │ 💡   │  ·  ·  ·  ·  ·            │  │    (800×480 at 0.515 scale)
│  │  └──────┘  ·  ·  ·  ·  ·            │  │
│  │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·      │  │
│  │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·      │  │
│  │  ·  ·  ·  ·  ·  ·  ·  ·  ·  ·      │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  [−]  51%  [+]         MAIN SCREEN  [⊞]   │  ← zoom row 44px
│                                            │
├────────────────────────────────────────────┤
│  LAYERS                                    │  ← mini layer tree ~180px
│  ▼ 📺 Main Screen                          │
│    ▼ 📄 Page (0,0)                         │
│      ⊞  Test Grid          tilesGrid ›    │
│        ●  My Tile              tile ›     │
│  ─ MASTER PANELS ────────────────────────  │
│     □  Sidebar                          ›  │
├────────────────────────────────────────────┤
│  ● ONLINE  192.168.1.100  [⬇ PULL] [⬆ PUSH]│  ← device bar 52px
├────────────────────────────────────────────┤
│  🔧 BUILD        📦 DEVICE        ⚙️      │  ← bottom nav 64px
└────────────────────────────────────────────┘
                                              ← gesture bar 28px
```

**Notes:**
- Layer tree fills the dead space below the canvas (currently wasted in v1)
- Zoom controls are a compact inline row, not the large pill buttons
- Device bar is persistent — PULL and PUSH are always ONE TAP AWAY
- Bottom nav is 3 items only (BUILD / DEVICE / SETTINGS)

---

### 3B. CANVAS MODE — Widget Selected

Tapping a widget shows a **selection bar** — NOT a bottom sheet. One row, compact.

```
├────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │  ┌──────┐ ←selected (glow border)   │  │
│  │  │ 💡   │                            │  │
│  │  └──────┘                            │  │
│  └──────────────────────────────────────┘  │
├────────────────────────────────────────────┤
│  Aa  My Tile · label    [✎ Edit] [⧉] [🗑] │  ← selection bar 52px
│      (type icon)(name)  (editor)(dup)(del) │
├────────────────────────────────────────────┤
│  LAYERS  (collapses when sel. bar is shown)│
├────────────────────────────────────────────┤
│  ● ONLINE  192.168.1.100  [⬇ PULL] [⬆ PUSH]│
├────────────────────────────────────────────┤
│  🔧 BUILD        📦 DEVICE        ⚙️      │
└────────────────────────────────────────────┘
```

**Selection bar is 52px. It:**
- Shows widget type icon + name (truncated)
- `✎ Edit` → pushes EDITOR MODE onto the navigation stack
- `⧉ Dup` → duplicates widget, selects the copy
- `🗑` → deletes (with a shake/vibrate confirm, no dialog for speed)

**No bottom sheet. No tabs. No mode-switching. One action per tap.**

---

### 3C. EDITOR MODE — Full Screen Inspector

Pushed onto navigation stack when "Edit" is tapped. Canvas is gone — you're editing.

```
┌────────────────────────────────────────────┐
│ ←  Aa  My Tile                         🗑  │  ← header 56px
├────────────────────────────────────────────┤
│                                            │
│  ── CONTENT ───────────────────────────    │  ← section header
│                                            │
│  Text                                      │
│  ┌──────────────────────────────────────┐  │
│  │ My Tile                              │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  Icon (emoji / char)    Font Size          │
│  ┌─────┐  [clear]       ┌────────┐        │
│  │ 💡  │                │ 16  ▲▼ │        │
│  └─────┘                └────────┘        │
│                                            │
│  Align                                     │
│  ┌──────┐  ┌──────┐  ┌──────┐            │
│  │  ◀   │  │  ≡   │  │  ▶   │            │
│  └──────┘  └──────┘  └──────┘            │
│                                            │
│  ── STYLE ────────────────────────────    │
│                                            │
│  Background          Text Color           │
│  ████ #1E1E2A  ›     ████ #FFFFFF  ›      │
│                                            │
│  Border Width        Border Color         │
│  ┌────────┐          ████ #2A2A3A  ›      │
│  │  0  ▲▼ │                              │
│  └────────┘                              │
│                                            │
│  Opacity             Radius               │
│  ████████░░ 100%     ┌────────┐          │
│                       │  8  ▲▼ │          │
│                       └────────┘          │
│                                            │
│  ── POSITION ─────────────────────────    │
│                                            │
│  X            Y            🔒 Aspect      │
│  ┌──────┐    ┌──────┐      ┌────┐        │
│  │  0 ▲▼│    │  0 ▲▼│      │    │        │
│  └──────┘    └──────┘      └────┘        │
│                                            │
│  W            H                           │
│  ┌──────┐    ┌──────┐                    │
│  │140 ▲▼│    │ 80 ▲▼│                    │
│  └──────┘    └──────┘                    │
│                                            │
│  ── EVENTS ───────────────────────────    │
│                                            │
│  On Tap                                    │
│  ┌──────────────────────────────────────┐ │
│  │  Go to Screen                      ▾ │ │
│  └──────────────────────────────────────┘ │
│  → Screen: Settings                       │
│  ┌──────────────────────────────────────┐ │
│  │  Settings Screen                   ▾ │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  On Long Press                             │
│  ┌──────────────────────────────────────┐ │
│  │  None                              ▾ │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  MQTT Topic (publish)                      │
│  ┌──────────────────────────────────────┐ │
│  │ home/light/set                       │ │
│  └──────────────────────────────────────┘ │
│                                            │
│  MQTT State Topic (subscribe)              │
│  ┌──────────────────────────────────────┐ │
│  │ home/light/state                     │ │
│  └──────────────────────────────────────┘ │
│                                            │
└────────────────────────────────────────────┘
← Android back gesture exits to canvas
```

**Critical design decisions:**
- **No tabs.** One flat scrollable list. Section headers are dividers, not tab buttons.
- **Color pickers** are a color swatch + hex value. Tap → full-screen color picker pushes in.
- **Number inputs** have ▲▼ stepper arrows. Tap the number to type directly.
- **Events** show only the relevant options for the widget type (switch shows MQTT, btn shows screen nav)
- **Back gesture** (or ← in header) exits to canvas with the widget still selected

---

### 3D. EDITOR MODE — Per-Type Content Sections

Only the CONTENT section changes per widget. Everything else (STYLE/POSITION/EVENTS) is the same layout.

| Widget | CONTENT fields shown |
|---|---|
| `label` | Text, Icon, Font Size, Align |
| `btn` | Label, Icon, Font Size |
| `switch` | (no text content — just MQTT in EVENTS) |
| `slider` | Min, Max, (MQTT in EVENTS) |
| `clock` | Format string |
| `arc` | Min, Max, Thickness |
| `bar` | Min, Max, Orientation |
| `chart` | Type (line/bar/area), Points, Color |
| `tilesGrid` | Cols, Rows, Gap + [Manage Tiles ▶] |
| `dropdown` | Options (textarea, one per line) |
| `roller` | Options (textarea, one per line) |
| `checkbox` | Label |
| `circle` | (no content, style-only) |
| `rounded_rect` | (no content, style-only) |
| `nav-menu` | [Manage Items ▶] |
| Component (wifi-panel etc.) | [No content — smart component] |

---

### 3E. WIDGET PICKER — Half-Screen Overlay

Triggered by [+ Add] in the canvas header. Canvas visible behind (semi-transparent backdrop).

```
┌────────────────────────────────────────────┐
│ ≡  Main Screen ▾                      + Add│  ← canvas header still visible
├────────────────────────────────────────────┤
│  ┌──────────────────────────────────────┐  │
│  │  (canvas preview at 50%)            │  │  ← canvas dimmed, visible
│  └──────────────────────────────────────┘  │
│░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│  ← scrim ~30% opacity
│──────────────── [ ▬ ] ────────────────────│  ← drag handle
│  ADD WIDGET                          [✕]   │
│  ┌──────────────────────────────────────┐  │
│  │ 🔍 Search widgets...                 │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  RECENT                                    │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐     │  ← last 4 used
│  │ Aa   │ │  ○   │ │  ⇌   │ │  ─   │     │
│  │Label │ │Button│ │Switch│ │Slider│     │
│  └──────┘ └──────┘ └──────┘ └──────┘     │
│                                            │
│  BASIC                              ─────  │
│  Aa  Label                                 │
│  ○   Button                                │
│  ⏰  Clock                                 │
│  □   Frame                                 │
│  ○   Circle                                │
│  ▢   Round Rect                            │
│                                            │
│  CONTROLS                           ─────  │
│  ⇌   Switch                                │
│  ─   Slider                                │
│  ◉   Arc                                   │
│  ▮   Bar                                   │
│  ☑   Checkbox                              │
│  ▾   Dropdown                              │
│  ⊙   Roller                                │
└────────────────────────────────────────────┘
```

**Tap = adds widget to canvas center, closes picker, canvas returns to focus, selection bar shows.**
No double-tap needed. One tap. Done.

**Canvas remains partially visible** — you can see the context of where it'll land.

---

### 3F. DEVICE SHEET — Pull-Down Overlay

Accessible from anywhere: swipe down from top of canvas, OR tap the status pill in the device bar.

```
┌────────────────────────────────────────────┐
│███████████████████████████████████████████ │  ← dimmed content behind
│███████ [canvas / current view] ████████████│
│████████████████████████████████████████████│
│                                            │
│══════════════════════════════════════════  │  ← sheet slides down from top
│  DEVICE                          [✕]       │
├────────────────────────────────────────────┤
│  ● ONLINE                                  │
│  esp32-display.local                       │
│  192.168.1.100          [Change IP]        │
├────────────────────────────────────────────┤
│                                            │
│  ┌──────────────────┐ ┌──────────────────┐ │
│  │  ⬇  PULL         │ │  ⬆  PUSH         │ │
│  │  Load from device│ │  Send to device  │ │
│  └──────────────────┘ └──────────────────┘ │
│  Last pulled: 3 min ago                    │
│                                            │
│  ┌────────────┐ ┌────────────┐ ┌─────────┐ │
│  │ 📥 Import  │ │ 📤 Export  │ │🗑 Erase │ │
│  └────────────┘ └────────────┘ └─────────┘ │
│                                            │
├────────────────────────────────────────────┤
│  WIFI ▾                                    │  ← accordion
│  STATION · 192.168.1.100                   │
│  [Disconnect]  [Forget Network]            │
│                                            │
│  HOTSPOT (AP MODE) ● OFF                   │
│  SSID: GridOS-AP  Pass: ──────────         │
│  [Save & Apply]                            │
│  [Scan Networks]                           │
├────────────────────────────────────────────┤
│  Console                          [Open ▶] │
└────────────────────────────────────────────┘
```

**Dismiss:** swipe up, tap backdrop, or [✕].

---

### 3G. SCREEN LIST — Push Navigation

Triggered by tapping the screen name in the canvas header.

```
┌────────────────────────────────────────────┐
│ ←   SCREENS                                │
├────────────────────────────────────────────┤
│                                            │
│  SCREENS                                   │
│  ┌──────────────────────────────────────┐  │
│  │ 📺  Main Screen              ● ACTIVE│  │
│  │     1 page · 12 items               │  │
│  │                         [Edit] [⋯]  │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ 📺  Settings Screen                  │  │
│  │     1 page · 4 items                │  │
│  │                         [Edit] [⋯]  │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ┌──────────────────────────────────────┐  │
│  │ +  Add New Screen                    │  │
│  └──────────────────────────────────────┘  │
│                                            │
├────────────────────────────────────────────┤
│  MASTER PANELS                             │
│  ┌──────────────────────────────────────┐  │
│  │ □  Sidebar                      [⋯]  │  │
│  └──────────────────────────────────────┘  │
│  ┌──────────────────────────────────────┐  │
│  │ +  Add Sidebar   +  Add Header       │  │
│  └──────────────────────────────────────┘  │
│                                            │
├────────────────────────────────────────────┤
│  PROJECT CONFIG                            │
│  Canvas: 800 × 480 px      [Edit]          │
│  Background: ████ #0E0E12                  │
└────────────────────────────────────────────┘
```

**[⋯] context menu per screen:** Rename / Duplicate / Set as Active / Delete.
No card previews — they'd show nothing useful at 150×80px. List is faster to scan.

---

### 3H. SETTINGS TAB (unchanged logic, new layout)

```
┌────────────────────────────────────────────┐
│ ≡  SETTINGS                                │
├────────────────────────────────────────────┤
│                                            │
│  FEATURES                                  │
│  ┌──────────────────────────────────────┐  │
│  │ MQTT Functionality                ●  │  │
│  │ Enable smart components & topics     │  │
│  ├──────────────────────────────────────┤  │
│  │ Screensaver                       ○  │  │
│  │ Dim display after inactivity         │  │
│  ├──────────────────────────────────────┤  │
│  │ AP Mode Always On                 ○  │  │
│  │ Keep setup WiFi active               │  │
│  └──────────────────────────────────────┘  │
│                                            │
│  ABOUT                                     │
│  ┌──────────────────────────────────────┐  │
│  │ Firmware  v1.2.3                     │  │
│  │ Build     2026-05-21                 │  │
│  │ Device    esp32-display.local        │  │
│  └──────────────────────────────────────┘  │
│                                            │
└────────────────────────────────────────────┘
```

---

## 4. Interaction Specifications

### 4.1 Canvas Interactions

| Gesture | Result |
|---|---|
| Tap widget | Select → selection bar appears |
| Tap empty canvas | Deselect → selection bar disappears |
| Double-tap empty canvas | Open Widget Picker |
| Long-press widget | Context menu (Edit / Duplicate / Delete / Bring Forward / Send Back) |
| Long-press + drag | Move widget |
| Drag widget edge/corner | Resize widget |
| Pinch | Zoom canvas |
| Two-finger drag | Pan canvas |
| Swipe down from top | Open Device Sheet |

### 4.2 Selection Bar (widget selected)

```
│  [TYPE ICON]  [widget name, truncated]   [✎ Edit] [⧉ Dup] [🗑]  │
```

- Appears instantly on tap (no animation delay)
- `✎ Edit` → pushes Editor Mode (slide in from right)
- `⧉ Dup` → duplicates, selects copy, vibrate (10ms)
- `🗑` → vibrate, then removes (no confirm dialog — Android back = undo)

### 4.3 Navigation Stack

```
Canvas Mode (root)
  └─ Editor Mode (push right)
       └─ Color Picker (push right)
  └─ Screen List (push right OR slide up as sheet)
Device Sheet (overlay, not stack)
Widget Picker (overlay, not stack)
```

Android back gesture always pops one level. Never exits the app from Canvas Mode (it's root).

### 4.4 Device Bar (persistent, Canvas Mode only)

```
│ ● ONLINE  192.168.1.100  │ ⬇ PULL │ ⬆ PUSH │
  status pill                pull btn   push btn
```

- Status pill: tap → opens Device Sheet
- PULL: fetches config from device, shows progress spinner in the pill, shows toast "Loaded 3 screens"
- PUSH: syncs to device, shows spinner, shows toast "Synced ✓"
- Dirty state indicator: PUSH button glows amber when local config differs from last-synced

### 4.5 Events — Available Action Types

All widget types share the same event slots. Show only relevant ones per type:

| Action | Widgets |
|---|---|
| `Go to Screen` | btn, label, tile, nav-item |
| `Go to Next Screen` | btn, label |
| `Go to Prev Screen` | btn, label |
| `Open Panel` | btn, label, nav-item |
| `Close Panel` | btn, label |
| `MQTT Publish` | btn, switch, slider, arc |
| `MQTT Toggle` | btn, switch |
| `None` | all |

---

## 5. Visual Design — Samsung AMOLED

### Theme Philosophy
True black AMOLED background. Every pixel not used is pitch black — saves battery,
looks stunning on the S26 Ultra display. Accent is electric violet. One brand color.

### Color Tokens
```css
/* AMOLED blacks */
--bg:           #000000;   /* true black — saves battery on AMOLED */
--surface:      #0D0D0D;   /* cards, panels */
--surface-2:    #161616;   /* elevated surfaces, inputs */
--surface-3:    #1E1E1E;   /* hover states */
--border:       #262626;   /* subtle dividers */

/* Accent */
--accent:       #7C5CFC;   /* electric violet, pops on true black */
--accent-dim:   #3D2F80;   /* muted accent for backgrounds */

/* Semantic */
--online:       #22C55E;   /* green: connected */
--offline:      #EF4444;   /* red: disconnected */
--dirty:        #F59E0B;   /* amber: unsaved changes */
--danger:       #EF4444;

/* Text */
--text:         #F1F5F9;   /* primary */
--text-muted:   #64748B;   /* secondary */
--text-dim:     #334155;   /* disabled / placeholder */
```

### Typography
```css
/* Headers, labels, nav */
font-family: 'Syne', sans-serif;
/* weight 600-800; geometric, technical, distinctive */

/* Body, inputs, descriptions */
font-family: 'DM Sans', sans-serif;
/* weight 400-500; clean, readable, not overused */

/* Numbers, coordinates, hex values, code */
font-family: 'IBM Plex Mono', monospace;
/* weight 400; technical without being cold */
```

Google Fonts: `Syne:wght@600;700;800`, `DM+Sans:wght@400;500`, `IBM+Plex+Mono:wght@400`

### Spacing (4px base)
```
4 · 8 · 12 · 16 · 20 · 24 · 32 · 48
```

### Component Heights
```
Status bar:        24px  (Android, no touch)
App header:        56px  (touch = 56px)
Section header:    32px  (label only, no touch)
Input row:         52px  (touch target inside)
Bottom nav:        64px  (icons 24px + labels 10px)
Device bar:        52px  (persistent, above bottom nav)
Selection bar:     52px  (above device bar when visible)
Android gesture:   28px  (safe-area-inset-bottom)
```

### Touch Targets
Minimum 44×44px CSS (= 8.2mm physical at S26 Ultra PPI). All interactive elements
use at least 44px height even if visually smaller (invisible padding).

### Motion
```css
/* Navigation push: slide from right */
transition: transform 280ms cubic-bezier(0.32, 0.72, 0, 1);

/* Sheet slide-in */
transition: transform 320ms cubic-bezier(0.16, 1, 0.3, 1);

/* Selection bar appear */
transition: transform 180ms cubic-bezier(0.34, 1.56, 0.64, 1); /* spring */

/* Fade overlay */
transition: opacity 200ms ease;
```

---

## 6. PWA Setup (do first — free 56px)

```json
// public/manifest.json
{
  "name": "GRIDOS",
  "short_name": "GRIDOS",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#000000",
  "theme_color": "#000000",
  "start_url": "/",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```html
<!-- index.html -->
<meta name="theme-color" content="#000000">
<meta name="mobile-web-app-capable" content="yes">
<link rel="manifest" href="/manifest.json">
```

In standalone mode: no Chrome address bar, no tab bar. Full 799px usable height.
**The single highest-ROI change. Do this in one hour.**

---

## 7. Implementation Plan

**Guiding principle: ship the most impactful thing first. Don't rewrite — adapt.**

### Phase 1 — Foundation (2–3 hours)

Goal: PWA + correct layout skeleton + device bar.

- [ ] `public/manifest.json` + icons → PWA install
- [ ] `src/index.css` — add AMOLED tokens (`--bg: #000000` etc.), Syne + DM Sans + IBM Plex Mono
- [ ] `MobileNav.tsx` — reduce from 5 to 3 tabs: BUILD / DEVICE / SETTINGS
- [ ] `App.tsx` — remove CANVAS/LAYERS/PROPS/WIDGETS sub-tabs in mobile layout
- [ ] Device bar component (`DeviceBar.tsx`) — status pill + PULL + PUSH, always visible in BUILD
- [ ] Canvas takes full available width, no side padding
- [ ] Zoom controls → compact inline row (not pill buttons)

**Deliverable:** opens on S26 Ultra, looks native, PULL/PUSH always visible.

---

### Phase 2 — Widget Editor (3–4 hours)

Goal: tap widget → full-screen editor → back to canvas.

- [ ] `SelectionBar.tsx` — type icon + name + Edit + Dup + Delete, appears on tap
- [ ] `MobileEditor.tsx` — full-screen push-nav, scrollable flat list
- [ ] `EditorSection.tsx` — section header component (CONTENT / STYLE / POSITION / EVENTS)
- [ ] Per-type content fields — label, btn, switch, slider, tilesGrid, clock, chart
- [ ] Style fields — color swatch (opens color picker), number steppers
- [ ] Position fields — x/y/w/h with steppers
- [ ] Events fields — action type dropdown + conditional sub-fields
- [ ] `ColorPickerScreen.tsx` — full-screen color picker pushed from editor
- [ ] Navigation stack (either React Router or simple `useState` stack)

**Deliverable:** can edit any widget's properties on the phone without fighting the UI.

---

### Phase 3 — Widget Picker + Screen List (2–3 hours)

Goal: add widgets, switch screens, manage project.

- [ ] `WidgetPicker.tsx` — half-screen sheet, semi-transparent backdrop, recently used row
- [ ] Single-tap adds widget to canvas center, closes picker, selection bar appears
- [ ] `ScreenList.tsx` — push-nav view from header screen name tap
- [ ] Screen cards (list style, not grid), `[⋯]` context menu
- [ ] "+ New Screen" entry at bottom of list
- [ ] Project config section (canvas size, bg color)
- [ ] Mini layer tree in canvas default state (replace current empty space below canvas)

**Deliverable:** full mobile workflow — add widget, configure, switch screens.

---

### Phase 4 — Device Sheet (1–2 hours)

Goal: pull-down device management.

- [ ] `DeviceSheet.tsx` — pull-down overlay (swipe-from-top gesture)
- [ ] WiFi section (reuse `WifiManager` logic, remove its own page layout)
- [ ] Import/Export using existing API functions
- [ ] Erase All with confirm dialog
- [ ] Console link (open in modal or new tab)
- [ ] Last-synced timestamp display

**Deliverable:** full device management from one gesture.

---

**Total estimate: 8–12 focused hours across 4 phases.**
Each phase is independently shippable. Phase 1 alone is a meaningful improvement.

---

## 8. What NOT to Build

Decisions made to keep scope tight:

| Cut | Reason |
|---|---|
| Screen card previews | 150×80px canvas render shows nothing. List with item counts is faster to scan |
| 3-state bottom sheet | Complex drag physics, fights the canvas. Navigation stack is simpler and better |
| SCREENS tab in bottom nav | Screen list as push-nav is one tap away from the header |
| DASHBOARD tab | Not needed for the build workflow. Can be a link in DEVICE if needed |
| CONSOLE tab | Rarely used during design. Link inside DEVICE sheet is enough |
| Undo/Redo on mobile | Hard, defer. Back gesture exits editor without saving as a safety net |
| Landscape mode editor | Design is portrait-first. Landscape = use the desktop layout |

---

## 9. Open Questions (5 max)

1. **Auto-sync or manual PUSH?** Should edits auto-push to device (with a 2s debounce), or require manual PUSH tap? Auto is smoother but risky if device is in use.

2. **Undo on delete?** Android back gesture after delete = undo? Or a brief "Undo" toast (5s) like Gmail? Toast is safer and more discoverable.

3. **Widget Picker — tap-to-add location.** Add to canvas center, or add to currently selected tilesGrid/pane if one is selected?

4. **tilesGrid editing on mobile.** Tiles are 69×49px tap targets (comfortable). But managing cols/rows/gap for the grid itself — does "Manage Tiles" push a dedicated tile editor, or is it inline in the editor?

5. **PWA install prompt timing.** Show the "Add to Home Screen" prompt on first visit, or after the user has used the app once (better UX)?

---

*GRIDOS Mobile Design v2.0 — Navigate, don't panel. One thing at a time. Always one tap from PULL/PUSH.*
