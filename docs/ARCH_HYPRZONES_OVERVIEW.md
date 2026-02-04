# HyprZones Architecture Overview

## Components

HyprZones consists of two separate applications:

### 1. Plugin (C++)
- **Location**: `src/`
- **Build**: CMake → `hyprzones.so`
- **Runtime**: Loaded by Hyprland via hyprpm
- **Purpose**: Zone overlay rendering, window snapping during drag

### 2. Editor (TypeScript/GTK4)
- **Location**: `editor/`
- **Build**: AGS v3 (ags run .)
- **Runtime**: Runs as separate `gjs` process
- **Purpose**: Visual zone layout editor, layout/mapping management

## Communication

```
┌─────────────────┐         ┌─────────────────┐
│   Editor (AGS)  │         │ Plugin (C++)    │
│   gjs process   │         │ hyprzones.so    │
└────────┬────────┘         └────────┬────────┘
         │                           │
         │  hyprctl hyprzones:*      │
         ├──────────────────────────►│
         │                           │
         │  ~/.config/hypr/          │
         │  hyprzones.toml           │
         ├───────────┬───────────────┤
         │           │               │
         ▼           ▼               ▼
    (IPC commands)  (Shared config file)
```

### IPC Commands (Editor → Plugin)
- `hyprctl hyprzones:reload` - Reload config from TOML
- `hyprctl hyprzones:layouts` - List available layouts
- `hyprctl hyprzones:show` - Toggle zone overlay

### Shared Config
- **File**: `~/.config/hypr/hyprzones.toml`
- **Contains**: Layouts (zones) and Mappings (monitor/workspace → layout)

## Plugin Architecture

```
src/
├── main.cpp           # Plugin entry, callbacks, IPC handlers
├── ConfigParser.cpp   # TOML config loading
├── LayoutManager.cpp  # Layout selection, mapping resolution
├── ZoneManager.cpp    # Zone pixel calculation
├── Renderer.cpp       # OpenGL zone overlay rendering
├── WindowSnapper.cpp  # Window snap logic
└── Globals.cpp        # Global state
```

### Key Data Flow (Drag & Drop)
1. `onMouseMove` detects window drag + modifier key
2. `getLayoutForMonitor()` resolves layout from mappings
3. `computeZonePixels()` calculates screen coordinates
4. `renderOverlay()` draws zones with OpenGL
5. `onMouseButton` (release) snaps window to selected zone

## Editor Architecture

```
editor/
├── app.ts                    # AGS entry point
├── style.scss                # GTK4 styling
├── widget/
│   ├── ZoneEditor.ts         # Main orchestrator
│   ├── LayoutPanel.ts        # Layout/mapping management UI
│   ├── Toolbar.ts            # Reset/Config buttons
│   ├── Splitter.ts           # Splitter drag handling
│   └── ZoneOperations.ts     # Split/merge logic
├── state/
│   └── EditorState.ts        # Central state (SSOT)
├── services/
│   ├── LayoutService.ts      # TOML read/write
│   ├── MonitorService.ts     # Monitor detection
│   └── HyprzonesIPC.ts       # hyprctl wrapper
├── models/
│   └── Layout.ts             # Type definitions
└── utils/
    └── geometry.ts           # Coordinate calculations
```

### Key Principles
- **SSOT**: All state in `EditorState.ts`
- **SOLID**: Single responsibility per module
- **DRY**: Shared utilities in `utils/` and `services/`
