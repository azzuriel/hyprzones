# HyprZones Plugin Instructions

## Building

```bash
./build.sh
```

Output: `build/hyprzones.so`

For clean rebuild:
```bash
./build.sh clean
./build.sh
```

## Installation

The plugin is managed by `hyprpm`. After building, use hyprpm to reload.

**DO NOT manually copy to `/var/cache/hyprpm/`** - hyprpm manages this.

## Configuration

### Config File Location
`~/.config/hypr/hyprzones.toml`

### Config Structure
```toml
[[layouts]]
name = "my-layout"
spacing_h = 40
spacing_v = 10

[[layouts.zones]]
name = "Left"
x = 0
y = 0
width = 50
height = 100

[[layouts.zones]]
name = "Right"
x = 50
y = 0
width = 50
height = 100

[[mappings]]
monitor = "HDMI-A-1"
workspaces = "1"
layout = "my-layout"

[[mappings]]
monitor = "*"
workspaces = "*"
layout = "default"
```

### Zone Coordinates
- Values are percentages (0-100)
- `x`, `y` = top-left corner
- `width`, `height` = size

### Mapping Priority
- Mappings are checked in order (first match wins)
- Use specific mappings before wildcards
- `*` matches any monitor/workspace

## IPC Commands

### Reload Config
```bash
hyprctl hyprzones:reload
```
Call this after editing `hyprzones.toml` or after the editor saves changes.

### List Layouts
```bash
hyprctl hyprzones:layouts
hyprctl hyprzones:layouts -j  # JSON format
```

### Toggle Overlay
```bash
hyprctl dispatch hyprzones:show
```

### Move Window to Zone
```bash
hyprctl dispatch hyprzones:moveto <zone-index>
```

## Debugging

### Debug Log Location
When debug logging is enabled:
```bash
tail -f /tmp/hyprzones.log
```

### Log Contents
- Config reload events (layouts and mappings loaded)
- Layout selection per monitor/workspace
- Which mapping matched

### Example Log
```
[HyprZones] Config reloaded: 5 layouts, 4 mappings
[HyprZones]   Mapping: monitor=HDMI-A-1 ws=1 -> layout=clion-ase-dev
[HyprZones]   Mapping: monitor=HDMI-A-1 ws=2 -> layout=clion-plg-hyprzones
[HyprZones] getLayoutForMonitor: mon=HDMI-A-1 ws=2 -> matched mapping -> layout=clion-plg-hyprzones
```

### Pitfall: Logging Destination

**WRONG**: Using `std::cerr` in plugin code
- Does NOT go to Hyprland log
- Goes nowhere useful

**CORRECT**: Write to `/tmp/hyprzones.log` or use `Debug::log()` from Hyprland headers

## Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| Mapping not applied | Config not reloaded | Run `hyprctl hyprzones:reload` |
| Wrong layout shown | Mapping order wrong | Check mapping priority in TOML |
| Overlay doesn't appear | Plugin not loaded | Check `hyprctl plugins list` |
| Zones misaligned | Margin mismatch | Verify MARGIN_* constants match waybar |
