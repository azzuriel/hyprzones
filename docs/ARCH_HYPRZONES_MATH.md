# HyprZones Mathematical Architecture

## Coordinate System

```
+------------------------→ x (horizontal axis)
|
|  Monitor/Screen
|
↓
y (vertical axis)
```

- **x-axis**: Horizontal, increases left→right
- **y-axis**: Vertical, increases top→down (screen coordinates)

## Terminology

### Horizontal vs Vertical Spacing

| Term | Meaning | Direction | Affects |
|------|---------|-----------|---------|
| **Horizontal spacing** | Gap between horizontal PLANES | Y-direction (↕) | Rows (top/bottom) |
| **Vertical spacing** | Gap between vertical PLANES | X-direction (↔) | Columns (left/right) |

The naming refers to the PLANE orientation, NOT the measurement direction.

```
     Horizontal plane (───)
          ↕ horizontal spacing (Y-direction)
     Horizontal plane (───)

     │              │
     │← vertical  →│
     │   spacing    │
     │ (X-direction)│
   Vertical       Vertical
   plane          plane
```

## Configuration Values

| Variable | Default | Description |
|----------|---------|-------------|
| `spacing_h` | 40px | Gap between horizontal planes (rows) |
| `spacing_v` | 10px | Gap between vertical planes (columns) |
| `bar_height` | 25px | Window header/titlebar height (hyprbars) |

## Zone Pixel Calculation

### Half-Gap Values

```
halfGapH = spacing_h / 2 = 20px
halfGapV = spacing_v / 2 = 5px
```

### Inset Rules

| Edge | Condition | Inset Value |
|------|-----------|-------------|
| Left | `zone.x > 0.001` | `halfGapV` |
| Right | `zone.x + zone.width < 0.999` | `halfGapV` |
| Top | `zone.y > 0.001` | `halfGapH` |
| Bottom | `zone.y + zone.height < 0.999` | `halfGapH` |

Outer edges (at monitor boundary) receive NO inset.

### Pixel Position Formula

```
pixelX = monitorX + rawX + leftInset
pixelY = monitorY + rawY + topInset
pixelW = rawW - leftInset - rightInset
pixelH = rawH - topInset - bottomInset
```

## Gap Calculation Between Zones

### Adjacent Zones (Internal)

For two adjacent zones, the gap equals the sum of their insets:

**Horizontal gap (between rows):**
```
gap = bottomInset(upper) + topInset(lower)
    = halfGapH + halfGapH
    = spacing_h
    = 40px
```

**Vertical gap (between columns):**
```
gap = rightInset(left) + leftInset(right)
    = halfGapV + halfGapV
    = spacing_v
    = 10px
```

## Window Header Impact

The window header (titlebar) is part of the WINDOW, not the gap.

### Visual Layout (Two Windows Stacked)

```
+----------------------+
|    Content F1        |
+----------------------+
         ↕ VISIBLE GAP (15px)
+----------------------+
| Header F2 (25px)     |  ← Header belongs to F2
|    Content F2        |
+----------------------+
```

### Actual Gap Calculation

The header "intrudes" into the zone spacing:

```
Horizontal gap (visible) = spacing_h - header
                         = 40 - 25
                         = 15px
```

## Summary Formulas

| Measurement | Formula | Default Value |
|-------------|---------|---------------|
| Zone gap (horizontal) | `spacing_h` | 40px |
| Zone gap (vertical) | `spacing_v` | 10px |
| **Visible window gap (horizontal)** | `spacing_h - bar_height` | 15px |
| **Visible window gap (vertical)** | `spacing_v` | 10px |

## Code Reference

- Zone calculation: `src/ZoneManager.cpp:computeZonePixels()`
- Layout config: `include/hyprzones/Layout.hpp`
- User config: `~/.config/hypr/hyprzones.toml`
- Header config: `~/.config/hypr/hyprland.conf` → `plugin.hyprbars.bar_height`
