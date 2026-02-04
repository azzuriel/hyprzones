# HyprZones Editor Instructions

## Starting the Editor

```bash
cd editor/
ags run .
```

Then toggle visibility:
```bash
ags request -i hyprzones-editor toggle
# or
ags request -i hyprzones-editor show
ags request -i hyprzones-editor hide
```

## Restarting the Editor (IMPORTANT)

### Pitfall: Wrong Process Kill

The editor runs as a `gjs` process, NOT as `ags run`. This command does NOT work:
```bash
# WRONG - won't kill anything
pkill -f "ags run.*hyprzones-editor"
```

### Correct Way to Restart

1. Find the correct process:
```bash
ps aux | grep gjs | grep -v grep
```

Output example:
```
dj  2156  9.0  0.5 ... gjs -m /run/user/1000/ags.js   # Main AGS (don't kill)
dj  182600 0.4  1.2 ... gjs -m /run/user/1000/ags.js  # Editor (kill this one)
```

2. Kill the editor's gjs process (the second one, NOT from tty1):
```bash
kill <PID>
```

3. Restart:
```bash
ags run . &
ags request -i hyprzones-editor show
```

### Why This Matters

- SCSS is compiled at startup
- CSS changes require full process restart
- If you don't kill the correct `gjs` process, old CSS remains active
- You'll think CSS changes "don't work"

## Modifying Styles

### File Location
`editor/style.scss`

### Key Variables
```scss
// Zone transparency (0.0 = invisible, 1.0 = opaque)
$zone-fill: rgba(45, 32, 20, 0.1);        // 10% opaque
$zone-fill-hover: rgba(60, 43, 28, 0.7);  // 70% on hover

// Config dialog transparency
.layout-dialog {
    background: rgba(18, 18, 18, 0.9);    // 90% opaque
}
```

### After Changing Styles
1. Save the file
2. Kill the editor's `gjs` process (see above)
3. Restart with `ags run .`

## Debugging

### Check if Editor is Running
```bash
ps aux | grep gjs
```

### View Editor Logs
AGS logs go to stdout of the `ags run` process. If started in background, logs may not be visible.

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| CSS changes don't apply | Old gjs process still running | Kill correct gjs process |
| Editor doesn't show | Wrong instance name | Use `-i hyprzones-editor` |
| Zones not visible | Transparency too high | Increase opacity value |
