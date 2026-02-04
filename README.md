# HyprZones

[![License](https://img.shields.io/badge/license-BSD--3--Clause-blue.svg)](LICENSE) &nbsp; [![Hyprland](https://img.shields.io/badge/Hyprland-0.53%2B-blue.svg)](https://hyprland.org) &nbsp; [![C++](https://img.shields.io/badge/C%2B%2B-23-blue.svg)](https://en.cppreference.com/w/cpp/23) &nbsp; [![Build](https://img.shields.io/badge/build-CMake-green.svg)](CMakeLists.txt)

A Hyprland plugin for **declarative zone-based window tiling**, inspired by Microsoft PowerToys FancyZones.

## Overview

Unlike traditional tiling window managers that build layouts imperatively, HyprZones uses **declarative zone definitions**. You define where zones are, and windows snap to them.

```
┌─────────────────────────────────────────────────────────────┐
│                        Monitor                              │
│  ┌──────────┬──────────────────────┬──────────────────────┐ │
│  │          │                      │                      │ │
│  │  Zone 1  │       Zone 3         │       Zone 4         │ │
│  │  25%     │       25%            │       50%            │ │
│  ├──────────┤                      ├──────────────────────┤ │
│  │          │                      │                      │ │
│  │  Zone 2  │                      │       Zone 5         │ │
│  │  25%     │                      │       50%            │ │
│  └──────────┴──────────────────────┴──────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Features

### Zone Definition
- **Percentage-based zones** - Zones scale with monitor resolution
- **Custom layouts** - Define any zone arrangement you need
- **Per-layout spacing** - Separate horizontal and vertical gap settings
- **Multi-monitor support** - Different layouts per monitor

### Window Snapping
- **Drag + Modifier** - Hold SHIFT while dragging to show zones and snap
- **Keyboard shortcuts** - Move windows to specific zones with keybinds
- **Multi-zone spanning** - Span windows across multiple adjacent zones with CTRL
- **Zone overlay** - Visual feedback showing available zones

### Layout Management
- **Data-driven** - All layouts defined in `hyprzones.toml`
- **Monitor/Workspace mappings** - Assign layouts to specific monitors and workspaces
- **Hot reload** - Changes apply immediately without restart
- **Multiple layouts** - Switch between layouts on the fly

### Visual Zone Editor
- **GTK-based editor** - Create and edit layouts visually
- **Live preview** - See changes in real-time
- **Split/Merge zones** - Easily divide or combine zones
- **Drag splitters** - Resize zones with pixel precision
- **Save/Load/Rename/Delete** - Full layout management
- **Mapping management** - Assign layouts to monitors/workspaces in the editor

## Installation

### Using hyprpm (Recommended)

```bash
hyprpm add https://github.com/azzuriel/hyprzones
hyprpm enable hyprzones
hyprpm reload
```

### Manual Build

#### Plugin Requirements

| Package | Arch Linux | Description |
|---------|------------|-------------|
| Hyprland 0.53+ | `hyprland` | Wayland compositor with headers |
| CMake 3.19+ | `cmake` | Build system |
| GCC 13+ / Clang 17+ | `gcc` | C++23 compiler |
| pkg-config | `pkgconf` | Dependency resolver |
| Pango | `pango` | Text rendering |
| Cairo | `cairo` | 2D graphics |
| libdrm | `libdrm` | DRM format headers |

#### Editor Requirements

| Package | Arch Linux | Description |
|---------|------------|-------------|
| AGS v3 | `aylurs-gtk-shell` (AUR) | GTK shell framework |
| GTK3 | `gtk3` | GUI toolkit |
| GtkLayerShell | `gtk-layer-shell` | Wayland layer shell |

#### Arch Linux

```bash
# Plugin dependencies
sudo pacman -S hyprland cmake gcc pkgconf pango cairo libdrm

# Editor dependencies
sudo pacman -S gtk3 gtk-layer-shell
paru -S aylurs-gtk-shell
```

#### Build

```bash
git clone https://github.com/azzuriel/hyprzones
cd hyprzones
cmake -DCMAKE_BUILD_TYPE=Release -B build
cmake --build build
```

#### Install

```bash
mkdir -p ~/.local/share/hyprload/plugins
cp build/hyprzones.so ~/.local/share/hyprload/plugins/
```

Add to `~/.config/hypr/hyprland.conf`:

```ini
plugin = ~/.local/share/hyprload/plugins/hyprzones.so
```

## Configuration

Create `~/.config/hypr/hyprzones.toml`:

```toml
# Layout definition
[[layouts]]
name = "development"
spacing_h = 40    # Horizontal gaps (between rows)
spacing_v = 10    # Vertical gaps (between columns)

[[layouts.zones]]
name = "sidebar"
x = 0
y = 0
width = 25
height = 100

[[layouts.zones]]
name = "main"
x = 25
y = 0
width = 50
height = 100

[[layouts.zones]]
name = "terminal"
x = 75
y = 0
width = 25
height = 50

[[layouts.zones]]
name = "output"
x = 75
y = 50
width = 25
height = 50

# Monitor/Workspace Mappings
[[mappings]]
monitor = "DP-1"
workspaces = "1-5"
layout = "development"

[[mappings]]
monitor = "*"
workspaces = "*"
layout = "development"
```

### Spacing

- `spacing_h` - Horizontal gap lines (between rows, affects top/bottom)
- `spacing_v` - Vertical gap lines (between columns, affects left/right)

Spacing only affects gaps **between** zones, never the outer edges.

## Usage

### Keybindings

Add to `~/.config/hypr/hyprland.conf`:

```ini
# Move window to specific zone
bind = $mainMod, 1, hyprzones:moveto, 0
bind = $mainMod, 2, hyprzones:moveto, 1
bind = $mainMod, 3, hyprzones:moveto, 2
bind = $mainMod, 4, hyprzones:moveto, 3

# Switch layout
bind = $mainMod CTRL, 1, hyprzones:layout, development
bind = $mainMod CTRL, 2, hyprzones:layout, simple

# Cycle through layouts
bind = $mainMod, Tab, hyprzones:cycle, 1
bind = $mainMod SHIFT, Tab, hyprzones:cycle, -1

# Show/hide zone overlay
bind = $mainMod, Z, hyprzones:show
bind = $mainMod SHIFT, Z, hyprzones:hide

# Open zone editor
bind = $mainMod, E, hyprzones:editor
```

### Drag & Drop

1. Start dragging a window
2. Hold **SHIFT** to show zone overlay
3. Drop on desired zone to snap
4. Hold **CTRL** while dragging to select multiple zones

### IPC Commands

```bash
# List all layouts
hyprctl hyprzones:layouts

# Move focused window to zone
hyprctl hyprzones:moveto 0

# Switch to layout
hyprctl dispatch hyprzones:layout development

# Reload configuration
hyprctl hyprzones:reload

# Toggle zone editor
hyprctl dispatch hyprzones:editor
```

## Zone Editor

The visual zone editor allows creating and editing layouts without manually editing TOML files.

### Features

- **Zone tiles** - Click zones to select, drag splitters to resize
- **Split buttons** - `|` splits vertically, `—` splits horizontally
- **Merge button** - `×` merges with adjacent zone
- **Layout list** - Load, save, rename, delete layouts
- **Mapping editor** - Assign layouts to monitor/workspace combinations

### Controls

| Key | Action |
|-----|--------|
| ESC | Close editor |
| Drag splitter | Resize zones |
| Click zone | Select zone |

## Comparison

| Feature | hy3 | dwindle | HyprZones |
|---------|-----|---------|-----------|
| Layout definition | Imperative | Automatic | Declarative |
| Layout persistence | No | No | Yes (TOML) |
| Predictable positions | No | No | Yes |
| Visual zone editor | No | No | Yes |
| Multi-zone spanning | Manual | No | Yes |
| Per-monitor layouts | Manual | No | Yes |
| Per-workspace layouts | No | No | Yes |

## Project Structure

```
hyprzones/
├── include/hyprzones/     # Header files
│   ├── Zone.hpp           # Zone data structure
│   ├── Layout.hpp         # Layout with zones + spacing
│   ├── Config.hpp         # Plugin configuration
│   ├── ZoneManager.hpp    # Zone calculations
│   ├── LayoutManager.hpp  # Layout loading/saving
│   ├── Renderer.hpp       # Zone overlay rendering
│   └── Globals.hpp        # Global instances
├── src/                   # Plugin source
│   ├── main.cpp           # Plugin entry, hooks, IPC
│   ├── ZoneManager.cpp    # Zone pixel calculations
│   ├── LayoutManager.cpp  # TOML parsing
│   ├── ConfigParser.cpp   # Config loading
│   └── Renderer.cpp       # OpenGL rendering
├── editor/                # Visual zone editor (AGS v3)
│   ├── app.ts             # Editor entry point
│   ├── widget/            # GTK widgets
│   ├── services/          # Layout service, IPC
│   ├── models/            # Data models
│   └── utils/             # Geometry calculations
└── examples/              # Example configurations
```

## Troubleshooting

### Zones don't appear

1. Check if plugin is loaded: `hyprctl plugins list`
2. Verify config exists: `~/.config/hypr/hyprzones.toml`
3. Check for TOML syntax errors
4. Ensure monitors are configured in `hyprland.conf`
5. Restart Hyprland if plugin was just installed

### Editor doesn't open

The editor requires AGS v3 and GTK Layer Shell:

```bash
# Arch Linux
sudo pacman -S gtk3 gtk-layer-shell
paru -S aylurs-gtk-shell
```

### Mappings not recognized

After creating new mappings in the editor, the plugin reloads automatically. Verify mappings exist in `~/.config/hypr/hyprzones.toml`.

## License

BSD 3-Clause License (same as Hyprland)

## Credits

- Inspired by [Microsoft PowerToys FancyZones](https://github.com/microsoft/PowerToys)
- Built for [Hyprland](https://hyprland.org)
- Editor built with [AGS](https://github.com/Aylur/ags)
