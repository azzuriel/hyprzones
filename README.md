# HyprZones

A Hyprland plugin for declarative zone-based window tiling, inspired by Microsoft PowerToys FancyZones.

## Vision

Unlike traditional tiling window managers that build layouts imperatively (move left, move up, create group), HyprZones uses **declarative zone definitions**. You define where zones are, and windows snap to them.

## Core Concept

```
┌─────────────────────────────────────────────────────────────┐
│                        Monitor                              │
│  ┌──────────┬──────────────────────┬──────────────────────┐ │
│  │          │                      │                      │ │
│  │  Zone 1  │       Zone 3         │       Zone 4         │ │
│  │  20%     │       40%            │       40%            │ │
│  ├──────────┤                      │                      │ │
│  │          │                      │                      │ │
│  │  Zone 2  │                      │                      │ │
│  │  20%     │                      │                      │ │
│  └──────────┴──────────────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Features (Planned)

### Zone Definition
- **Grid Layout**: Define zones as grid with splits and merges
- **Canvas Layout**: Define zones with exact pixel coordinates (supports overlapping)
- **Percentage-based**: Zones scale with monitor resolution
- **Multi-monitor**: Separate layouts per monitor

### Window Snapping
- **Drag + Modifier**: Hold key while dragging to show zones
- **Keyboard**: Keybinds to move window to specific zone
- **Multi-zone**: Span window across multiple adjacent zones
- **Zone memory**: Windows remember their last zone per application

### Layout Management
- **Save/Load**: Persist layouts to JSON
- **Hotkeys**: Quick-switch layouts with keybinds
- **Per-workspace**: Different layouts per workspace
- **Templates**: Built-in templates (columns, rows, grid, etc.)

### Visual Feedback
- **Zone preview**: Show zones while dragging
- **Zone numbers**: Display zone indices
- **Customizable colors**: Zone highlight, border, inactive colors

## Configuration Example

```toml
# ~/.config/hypr/hyprzones.toml

[general]
snap_modifier = "SHIFT"        # Hold while dragging
show_zone_numbers = true
zone_highlight_color = "rgba(0, 100, 255, 0.3)"
zone_border_color = "rgba(0, 100, 255, 0.8)"

# Layout: Development
[[layouts]]
name = "development"
hotkey = "SUPER+CTRL+1"

[[layouts.zones]]
name = "sidebar"
x = 0
y = 0
width = 20       # percentage
height = 100

[[layouts.zones]]
name = "main"
x = 20
y = 0
width = 50
height = 100

[[layouts.zones]]
name = "terminal"
x = 70
y = 0
width = 30
height = 60

[[layouts.zones]]
name = "output"
x = 70
y = 60
width = 30
height = 40

# Layout: Simple Columns
[[layouts]]
name = "columns-3"
hotkey = "SUPER+CTRL+2"
template = "columns"
columns = 3
```

## Comparison

| Feature | hy3 | dwindle | HyprZones |
|---------|-----|---------|-----------|
| Layout definition | Imperative (movewindow) | Automatic | Declarative (zones) |
| Layout persistence | No | No | Yes (JSON) |
| Predictable positions | No | No | Yes |
| Visual zone editor | No | No | Planned |
| Multi-zone spanning | Manual | No | Yes |
| Scale to 100 windows | Complex | Automatic | Simple |

## Technical Architecture

```
┌─────────────────────────────────────────────────────┐
│                    HyprZones Plugin                 │
├─────────────────────────────────────────────────────┤
│  ZoneManager        │  LayoutManager                │
│  - Zone definitions │  - Load/Save layouts          │
│  - Hit testing      │  - Layout switching           │
│  - Zone rendering   │  - Hotkey handling            │
├─────────────────────┼───────────────────────────────┤
│  WindowSnapper      │  ConfigParser                 │
│  - Drag detection   │  - TOML parsing               │
│  - Zone assignment  │  - Validation                 │
│  - Multi-zone logic │  - Hot reload                 │
├─────────────────────┴───────────────────────────────┤
│                 Hyprland Plugin API                 │
│  - Window events    - Render hooks                  │
│  - Input hooks      - IPC commands                  │
└─────────────────────────────────────────────────────┘
```

## IPC Commands (Planned)

```bash
# List layouts
hyprctl hyprzones layouts

# Apply layout
hyprctl hyprzones apply development

# Move window to zone
hyprctl hyprzones moveto 3

# Show zone editor
hyprctl hyprzones editor

# Save current window positions as new layout
hyprctl hyprzones save my-layout
```

## Requirements

- Hyprland (with development headers)
- CMake >= 3.19
- C++23 compiler (GCC 13+ or Clang 17+)
- pkg-config
- pango, cairo

### Arch Linux

```bash
sudo pacman -S hyprland cmake gcc pango cairo
```

## Building

```bash
# Configure
cmake -DCMAKE_BUILD_TYPE=Release -B build

# Build
cmake --build build

# The plugin will be at: build/hyprzones.so
```

## Installation

### Using hyprpm (Recommended)

```bash
hyprpm add https://github.com/azzuriel/hyprzones
hyprpm enable hyprzones
```

### Manual Installation

```bash
# Build first (see above)

# Copy plugin
mkdir -p ~/.local/share/hyprload/plugins
cp build/hyprzones.so ~/.local/share/hyprload/plugins/

# Or system-wide
sudo cp build/hyprzones.so /usr/lib/hyprland/plugins/
```

Add to `~/.config/hypr/hyprland.conf`:

```ini
plugin = ~/.local/share/hyprload/plugins/hyprzones.so
```

Or with hyprpm:

```ini
exec-once = hyprpm reload -n
```

## Configuration

Create `~/.config/hypr/hyprzones.toml` (see examples/hyprzones.toml)

## Usage

### Dispatchers

```ini
# Move focused window to zone 0
bind = $mainMod, 1, hyprzones:moveto, 0

# Switch layout
bind = $mainMod CTRL, 1, hyprzones:layout, development

# Show/hide zone overlay
bind = $mainMod, Z, hyprzones:show,
bind = $mainMod SHIFT, Z, hyprzones:hide,
```

### IPC Commands

```bash
# List layouts
hyprctl hyprzones:layouts

# Move window to zone
hyprctl hyprzones:moveto 0

# Reload config
hyprctl hyprzones:reload
```

## Project Structure

```
hyprzones/
├── include/hyprzones/
│   ├── Zone.hpp          # Zone data structure
│   ├── Layout.hpp        # Layout (collection of zones)
│   ├── Config.hpp        # Configuration
│   ├── DragState.hpp     # Drag tracking state
│   ├── ZoneManager.hpp   # Zone hit-testing
│   ├── LayoutManager.hpp # Layout switching
│   ├── WindowSnapper.hpp # Window snapping
│   ├── Renderer.hpp      # Zone overlay rendering
│   └── Globals.hpp       # Global instances
├── src/
│   ├── main.cpp          # Plugin entry point
│   ├── Globals.cpp       # Global definitions
│   └── *.cpp             # Implementations
├── examples/
│   └── hyprzones.toml    # Example configuration
└── CMakeLists.txt
```

## Status

**Early Development** - Core architecture implemented, rendering WIP.

## License

BSD 3-Clause (same as Hyprland)

## Inspiration

- [Microsoft PowerToys FancyZones](https://github.com/microsoft/PowerToys)
- [hy3](https://github.com/outfoxxed/hy3)
- [i3](https://i3wm.org/)
