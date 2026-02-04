# HyprZones Mapping System Architecture

## Overview

Mappings connect layouts to specific monitors and workspaces. When the zone overlay is triggered, the plugin determines which layout to display based on the current monitor and workspace.

## Data Flow

```
User triggers overlay (SHIFT+drag or hotkey)
            │
            ▼
┌───────────────────────────────────────┐
│  getLayoutForMonitor(config,          │
│                      monitorName,     │
│                      workspaceId)     │
└───────────────────┬───────────────────┘
                    │
                    ▼
┌───────────────────────────────────────┐
│  Iterate through config.mappings      │
│  (in order - first match wins)        │
└───────────────────┬───────────────────┘
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
   Match found?            No match
        │                       │
        ▼                       ▼
   Return mapped          Fall back to
   layout                 activeLayout
                               │
                               ▼
                          Still nothing?
                               │
                               ▼
                          Return first
                          layout
```

## Matching Logic

### Monitor Matching
```cpp
bool monitorMatch = mapping.monitor == "*" || mapping.monitor == monitorName;
```
- `*` matches any monitor
- Exact name match (e.g., `HDMI-A-1`)

### Workspace Matching
```cpp
bool wsMatch = workspaceMatchesPattern(workspace, mapping.workspaces);
```

Supported patterns:
- `*` - any workspace
- `5` - specific workspace
- `1-5` - range (inclusive)

### Combined Match
Both monitor AND workspace must match for a mapping to apply.

## Configuration Example

```toml
# Most specific first
[[mappings]]
monitor = "HDMI-A-1"
workspaces = "1"
layout = "workspace-1-layout"

[[mappings]]
monitor = "HDMI-A-1"
workspaces = "2-5"
layout = "workspace-2-to-5-layout"

# Fallback for this monitor
[[mappings]]
monitor = "HDMI-A-1"
workspaces = "*"
layout = "hdmi-default"

# Global fallback (last)
[[mappings]]
monitor = "*"
workspaces = "*"
layout = "default"
```

## Important: Order Matters

Mappings are processed **in order**. The first match wins.

**BAD** (wildcard before specific):
```toml
[[mappings]]
monitor = "*"
workspaces = "*"
layout = "default"     # This always matches!

[[mappings]]
monitor = "HDMI-A-1"
workspaces = "1"
layout = "specific"    # Never reached
```

**GOOD** (specific before wildcard):
```toml
[[mappings]]
monitor = "HDMI-A-1"
workspaces = "1"
layout = "specific"    # Checked first

[[mappings]]
monitor = "*"
workspaces = "*"
layout = "default"     # Fallback
```

## Editor Integration

The editor displays mapping status in the layout list:
- `▶` / `▷` - Active / Inactive layout (currently loaded)
- `●` / `○` - Mapped / Unmapped (used in at least one mapping)

When adding/editing mappings in the editor:
1. Editor saves to `hyprzones.toml`
2. Editor calls `hyprctl hyprzones:reload`
3. Plugin reloads config with new mappings
4. Next overlay trigger uses updated mappings
