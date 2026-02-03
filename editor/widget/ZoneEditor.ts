// ZoneEditor - Main zone editor widget using GTK layer shell
// AGS v3 imperative GTK style with bounded splitter segments

import { Gtk, Gdk } from "ags/gtk3"
import GtkLayerShell from "gi://GtkLayerShell"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { Layout, Zone, cloneLayout, getSplitterSegments, SplitterSegment } from "../models/Layout"
import { MonitorGeometry, PixelRect, PixelSplitter, zoneToPixels, splitterToPixels, collectGridBoundaries, clamp } from "../utils/geometry"
import { loadLayoutFromConfig, saveLayoutToConfig } from "../services/LayoutService"
import { reloadConfig } from "../services/HyprzonesIPC"

const WINDOW_NAME = "hyprzones-editor"
const SPLITTER_THICKNESS = 12

// Default layout if none exists
const DEFAULT_LAYOUT: Layout = {
    name: 'default',
    spacing: 10,
    zones: [
        { index: 0, name: 'Left', x: 0, y: 0, width: 0.5, height: 1 },
        { index: 1, name: 'Right', x: 0.5, y: 0, width: 0.5, height: 1 }
    ]
}

// State
let editorWindow: Gtk.Window | null = null
let currentLayout: Layout
let originalLayout: Layout
let hasChanges = false
let monitor: MonitorGeometry = { x: 0, y: 0, width: 1920, height: 1080 }
let fullScreenWidth = 3840
let fullScreenHeight = 2160

// Drag state - global for window-level event handling
let activeDragSegment: SplitterSegment | null = null
let activeDragWidget: Gtk.EventBox | null = null
let dragStartPos = 0
// Zones captured at drag start - these don't change during drag
let dragLeftZones: number[] = []
let dragRightZones: number[] = []
// Usable size captured at drag start - prevents spacing drift
let dragUsableSize = 0

// UI elements that need updating
let zoneContainer: Gtk.Fixed
let saveButton: Gtk.Button

// Update zone positions in the container
function updateZoneDisplay() {
    if (!zoneContainer) return

    zoneContainer.get_children().forEach(child => child.destroy())

    const gridBounds = collectGridBoundaries(currentLayout.zones)

    // Draw zones (offset by monitor position for margins, minus header bar to start higher)
    const topOffset = monitor.y - HEADER_BAR_HEIGHT

    for (const zone of currentLayout.zones) {
        const rect = zoneToPixels(zone, monitor, currentLayout.spacing, gridBounds)
        const zoneWidget = createZoneWidget(zone, rect)
        zoneContainer.put(zoneWidget, monitor.x + rect.x, topOffset + rect.y)
    }

    // Draw bounded splitters (same offset as zones)
    const splitterSegments = getSplitterSegments(currentLayout.zones)
    for (const segment of splitterSegments) {
        const pixelSplitter = splitterToPixels(segment, monitor, currentLayout.spacing, gridBounds, SPLITTER_THICKNESS)
        const splitter = createSplitterWidget(pixelSplitter)
        zoneContainer.put(splitter, monitor.x + pixelSplitter.x, topOffset + pixelSplitter.y)
    }

    zoneContainer.show_all()
    updateSaveButton()
}

// Create a zone rectangle widget with split buttons
function createZoneWidget(zone: Zone, rect: PixelRect): Gtk.EventBox {
    const eventBox = new Gtk.EventBox()
    eventBox.set_size_request(rect.width, rect.height)

    const frame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    frame.get_style_context().add_class("zone")
    frame.set_halign(Gtk.Align.FILL)
    frame.set_valign(Gtk.Align.FILL)

    // Zone label
    const label = new Gtk.Label({ label: zone.name })
    label.get_style_context().add_class("zone-label")
    label.set_halign(Gtk.Align.CENTER)
    label.set_valign(Gtk.Align.CENTER)
    label.set_hexpand(true)
    label.set_vexpand(true)

    // Split buttons container
    const buttonBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
    buttonBox.set_halign(Gtk.Align.CENTER)
    buttonBox.set_valign(Gtk.Align.CENTER)
    buttonBox.get_style_context().add_class("zone-buttons")

    // Vertical split button (split left/right)
    const splitVBtn = new Gtk.Button({ label: "⬍" })
    splitVBtn.get_style_context().add_class("zone-split-btn")
    splitVBtn.set_tooltip_text("Split vertically")
    splitVBtn.connect("clicked", () => splitZone(zone, 'vertical'))

    // Horizontal split button (split top/bottom)
    const splitHBtn = new Gtk.Button({ label: "⬌" })
    splitHBtn.get_style_context().add_class("zone-split-btn")
    splitHBtn.set_tooltip_text("Split horizontally")
    splitHBtn.connect("clicked", () => splitZone(zone, 'horizontal'))

    buttonBox.pack_start(splitVBtn, false, false, 0)
    buttonBox.pack_start(splitHBtn, false, false, 0)

    // Center content
    const centerBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    centerBox.set_halign(Gtk.Align.CENTER)
    centerBox.set_valign(Gtk.Align.CENTER)
    centerBox.set_hexpand(true)
    centerBox.set_vexpand(true)
    centerBox.pack_start(label, false, false, 0)
    centerBox.pack_start(buttonBox, false, false, 0)

    frame.pack_start(centerBox, true, true, 0)
    eventBox.add(frame)

    return eventBox
}

// Zone in zwei Teile splitten
function splitZone(zone: Zone, direction: 'horizontal' | 'vertical') {
    const zoneIndex = currentLayout.zones.findIndex(z => z.name === zone.name)
    if (zoneIndex === -1) return

    const newZone: Zone = {
        index: currentLayout.zones.length,
        name: `Zone ${currentLayout.zones.length + 1}`,
        x: zone.x,
        y: zone.y,
        width: zone.width,
        height: zone.height
    }

    if (direction === 'vertical') {
        // Split links/rechts
        const halfWidth = zone.width / 2
        zone.width = halfWidth
        newZone.x = zone.x + halfWidth
        newZone.width = halfWidth
    } else {
        // Split oben/unten
        const halfHeight = zone.height / 2
        zone.height = halfHeight
        newZone.y = zone.y + halfHeight
        newZone.height = halfHeight
    }

    currentLayout.zones.push(newZone)
    hasChanges = true
    updateZoneDisplay()
}

// Create a bounded splitter widget for resizing
function createSplitterWidget(pixelSplitter: PixelSplitter): Gtk.EventBox {
    const eventBox = new Gtk.EventBox()
    const segment = pixelSplitter.segment

    eventBox.set_size_request(pixelSplitter.width, pixelSplitter.height)
    eventBox.set_visible_window(true)
    eventBox.set_above_child(false)
    eventBox.get_style_context().add_class("splitter")

    if (segment.orientation === 'vertical') {
        eventBox.get_style_context().add_class("splitter-vertical")
    } else {
        eventBox.get_style_context().add_class("splitter-horizontal")
    }

    const handle = new Gtk.Box({})
    handle.get_style_context().add_class("splitter-handle")
    if (segment.orientation === 'vertical') {
        handle.set_size_request(4, pixelSplitter.height)
    } else {
        handle.set_size_request(pixelSplitter.width, 4)
    }
    handle.set_halign(Gtk.Align.CENTER)
    handle.set_valign(Gtk.Align.CENTER)
    eventBox.add(handle)

    // Enable events
    eventBox.set_events(
        Gdk.EventMask.BUTTON_PRESS_MASK |
        Gdk.EventMask.ENTER_NOTIFY_MASK |
        Gdk.EventMask.LEAVE_NOTIFY_MASK
    )

    // Get cursor types for resize
    const display = Gdk.Display.get_default()
    const resizeCursor = segment.orientation === 'vertical'
        ? Gdk.Cursor.new_from_name(display, "col-resize")
        : Gdk.Cursor.new_from_name(display, "row-resize")
    const defaultCursor = Gdk.Cursor.new_from_name(display, "default")

    // Cursor change on hover
    eventBox.connect("enter-notify-event", () => {
        if (!activeDragSegment) {
            const win = eventBox.get_window()
            if (win && resizeCursor) {
                win.set_cursor(resizeCursor)
            }
            eventBox.get_style_context().add_class("hover")
        }
        return false
    })

    eventBox.connect("leave-notify-event", () => {
        if (!activeDragSegment) {
            const win = eventBox.get_window()
            if (win) {
                win.set_cursor(defaultCursor)
            }
            eventBox.get_style_context().remove_class("hover")
        }
        return false
    })

    // Only handle button press - motion/release handled at window level
    eventBox.connect("button-press-event", (_: Gtk.EventBox, event: Gdk.Event) => {
        const [, button] = event.get_button()
        if (button !== 1) return false

        const [, rootX, rootY] = event.get_root_coords()
        activeDragSegment = segment
        activeDragWidget = eventBox
        dragStartPos = segment.orientation === 'vertical' ? rootX : rootY
        eventBox.get_style_context().add_class("dragging")

        // Capture connected zones NOW while positions are still unique
        const refZone = currentLayout.zones[segment.leftZones[0]]
        const linePos = segment.orientation === 'vertical'
            ? refZone.x + refZone.width
            : refZone.y + refZone.height

        dragLeftZones = []
        dragRightZones = []
        for (const i of segment.leftZones) {
            for (const j of findZonesAlongLine(i, linePos, segment.orientation, 'left')) {
                if (!dragLeftZones.includes(j)) dragLeftZones.push(j)
            }
        }
        for (const i of segment.rightZones) {
            for (const j of findZonesAlongLine(i, linePos, segment.orientation, 'right')) {
                if (!dragRightZones.includes(j)) dragRightZones.push(j)
            }
        }

        // Capture usable size at drag start - simple percentage-based
        dragUsableSize = segment.orientation === 'vertical' ? monitor.width : monitor.height

        return true
    })

    return eventBox
}

// Finde Zonen die entlang einer Linie verbunden sind
function findZonesAlongLine(startIdx: number, linePos: number, orientation: 'vertical' | 'horizontal', side: 'left' | 'right'): number[] {
    const eps = 0.01
    const result = new Set<number>([startIdx])
    let changed = true

    while (changed) {
        changed = false
        for (let i = 0; i < currentLayout.zones.length; i++) {
            if (result.has(i)) continue
            const zone = currentLayout.zones[i]

            // Ist diese Zone an der gleichen Linie?
            const atLine = orientation === 'vertical'
                ? (side === 'left'
                    ? Math.abs((zone.x + zone.width) - linePos) < eps
                    : Math.abs(zone.x - linePos) < eps)
                : (side === 'left'
                    ? Math.abs((zone.y + zone.height) - linePos) < eps
                    : Math.abs(zone.y - linePos) < eps)

            if (!atLine) continue

            // Prüfe ob diese Zone ENTLANG der Linie an eine verbundene Zone grenzt
            for (const ci of result) {
                const connected = currentLayout.zones[ci]
                if (orientation === 'vertical') {
                    // Vertikaler Splitter: Zonen müssen horizontal aneinander grenzen (übereinander)
                    const touch = Math.abs((zone.y + zone.height) - connected.y) < eps ||
                                  Math.abs((connected.y + connected.height) - zone.y) < eps
                    if (touch) {
                        result.add(i)
                        changed = true
                        break
                    }
                } else {
                    // Horizontaler Splitter: Zonen müssen vertikal aneinander grenzen (nebeneinander)
                    const touch = Math.abs((zone.x + zone.width) - connected.x) < eps ||
                                  Math.abs((connected.x + connected.width) - zone.x) < eps
                    if (touch) {
                        result.add(i)
                        changed = true
                        break
                    }
                }
            }
        }
    }
    return [...result]
}

// Splitter verschieben - use zones captured at drag start (not recalculated)
function moveSplitterSegment(segment: SplitterSegment, delta: number) {
    // Use the zones captured at drag start - these don't change during drag
    // This prevents unrelated splitters at the same position from snapping together
    for (const i of dragLeftZones) {
        const zone = currentLayout.zones[i]
        if (segment.orientation === 'vertical') {
            zone.width += delta
        } else {
            zone.height += delta
        }
    }
    for (const i of dragRightZones) {
        const zone = currentLayout.zones[i]
        if (segment.orientation === 'vertical') {
            zone.x += delta
            zone.width -= delta
        } else {
            zone.y += delta
            zone.height -= delta
        }
    }

    hasChanges = true
    updateZoneDisplay()
}

// Update save button state
function updateSaveButton() {
    if (saveButton) {
        saveButton.set_sensitive(hasChanges)
    }
}

// Handle save
async function handleSave() {
    const success = saveLayoutToConfig(currentLayout)
    if (success) {
        await reloadConfig()
        editorWindow?.hide()
    }
}

// Handle cancel
function handleCancel() {
    editorWindow?.hide()
}

// Handle reset
function handleReset() {
    currentLayout = cloneLayout(originalLayout)
    hasChanges = false
    updateZoneDisplay()
}

// Screen margins (waybar + gaps) - will be detected from actual windows
let MARGIN_TOP = 97
let MARGIN_BOTTOM = 22
let MARGIN_LEFT = 22
let MARGIN_RIGHT = 22
let HEADER_BAR_HEIGHT = 0  // Will be detected from hyprbars plugin

// Detect margins from actual window positions
async function detectMargins(): Promise<void> {
    try {
        // Detect hyprbars header bar height
        try {
            const barResult = await execAsync(['hyprctl', 'getoption', 'plugin:hyprbars:bar_height', '-j'])
            const barData = JSON.parse(barResult)
            if (barData.int) {
                HEADER_BAR_HEIGHT = barData.int
            }
        } catch {
            HEADER_BAR_HEIGHT = 0
        }

        const result = await execAsync(['hyprctl', 'clients', '-j'])
        const clients = JSON.parse(result)

        // Find windows that are likely tiled (not floating, reasonable size)
        const tiledWindows = clients.filter((c: any) =>
            !c.floating && c.size[0] > 100 && c.size[1] > 100
        )

        if (tiledWindows.length > 0) {
            // Use mode (most common value) for margins instead of min/max
            // This avoids outliers from special workspaces
            const xStarts: number[] = []
            const xEnds: number[] = []
            const yStarts: number[] = []
            const yEnds: number[] = []

            for (const w of tiledWindows) {
                xStarts.push(w.at[0])
                xEnds.push(w.at[0] + w.size[0])
                yStarts.push(w.at[1])
                yEnds.push(w.at[1] + w.size[1])
            }

            // Find most common values (mode)
            const mode = (arr: number[]) => {
                const counts = new Map<number, number>()
                for (const v of arr) {
                    counts.set(v, (counts.get(v) || 0) + 1)
                }
                let maxCount = 0, modeVal = arr[0]
                for (const [val, count] of counts) {
                    if (count > maxCount) {
                        maxCount = count
                        modeVal = val
                    }
                }
                return modeVal
            }

            // For left/top: use most common starting position
            // For right/bottom: use most common ending position
            const commonXStart = mode(xStarts)
            const commonXEnd = mode(xEnds)
            const commonYStart = mode(yStarts)
            const commonYEnd = mode(yEnds)

            MARGIN_LEFT = commonXStart
            MARGIN_RIGHT = fullScreenWidth - commonXEnd
            MARGIN_TOP = commonYStart
            MARGIN_BOTTOM = fullScreenHeight - commonYEnd
        }
    } catch (e) {
        console.error('Failed to detect margins:', e)
    }
}

// Get monitor geometry with margins applied
async function getMonitorGeometry(): Promise<MonitorGeometry> {
    try {
        const result = await execAsync(['hyprctl', 'monitors', '-j'])
        const monitors = JSON.parse(result)
        const focused = monitors.find((m: any) => m.focused) || monitors[0]
        if (focused) {
            fullScreenWidth = focused.width
            fullScreenHeight = focused.height

            // Detect actual margins from window positions
            await detectMargins()

            return {
                x: MARGIN_LEFT,
                y: MARGIN_TOP,
                width: focused.width - MARGIN_LEFT - MARGIN_RIGHT,
                height: focused.height - MARGIN_TOP - MARGIN_BOTTOM + HEADER_BAR_HEIGHT
            }
        }
    } catch (e) {
        console.error('Failed to get monitor:', e)
    }
    return {
        x: MARGIN_LEFT,
        y: MARGIN_TOP,
        width: 1920 - MARGIN_LEFT - MARGIN_RIGHT,
        height: 1080 - MARGIN_TOP - MARGIN_BOTTOM + HEADER_BAR_HEIGHT
    }
}

// Create toolbar with save/cancel/reset buttons
function createToolbar(): Gtk.Box {
    const toolbar = new Gtk.Box({ spacing: 12 })
    toolbar.get_style_context().add_class("toolbar")
    toolbar.set_halign(Gtk.Align.CENTER)

    // Reset button
    const resetBtn = new Gtk.Button({ label: "Reset" })
    resetBtn.get_style_context().add_class("toolbar-button")
    resetBtn.get_style_context().add_class("toolbar-reset")
    resetBtn.connect("clicked", handleReset)

    // Cancel button
    const cancelBtn = new Gtk.Button({ label: "Cancel" })
    cancelBtn.get_style_context().add_class("toolbar-button")
    cancelBtn.get_style_context().add_class("toolbar-cancel")
    cancelBtn.connect("clicked", handleCancel)

    // Save button
    saveButton = new Gtk.Button({ label: "Save" })
    saveButton.get_style_context().add_class("toolbar-button")
    saveButton.get_style_context().add_class("toolbar-save")
    saveButton.set_sensitive(false)
    saveButton.connect("clicked", handleSave)

    toolbar.pack_start(resetBtn, false, false, 0)
    toolbar.pack_start(cancelBtn, false, false, 0)
    toolbar.pack_start(saveButton, false, false, 0)

    return toolbar
}

export default async function ZoneEditor(): Promise<Gtk.Window> {
    // Get monitor info
    monitor = await getMonitorGeometry()

    // Load or use default layout
    const loadedLayout = loadLayoutFromConfig()
    currentLayout = cloneLayout(loadedLayout || DEFAULT_LAYOUT)
    originalLayout = cloneLayout(currentLayout)
    hasChanges = false

    // Create layer shell window (fullscreen)
    const win = new Gtk.Window({
        title: "HyprZones Editor",
        default_width: fullScreenWidth,
        default_height: fullScreenHeight,
        decorated: false,
        resizable: false,
    })

    win.set_wmclass(WINDOW_NAME, WINDOW_NAME)
    win.get_style_context().add_class("zone-editor")
    editorWindow = win

    // Initialize layer shell
    GtkLayerShell.init_for_window(win)
    GtkLayerShell.set_layer(win, GtkLayerShell.Layer.OVERLAY)
    GtkLayerShell.set_anchor(win, GtkLayerShell.Edge.TOP, true)
    GtkLayerShell.set_anchor(win, GtkLayerShell.Edge.BOTTOM, true)
    GtkLayerShell.set_anchor(win, GtkLayerShell.Edge.LEFT, true)
    GtkLayerShell.set_anchor(win, GtkLayerShell.Edge.RIGHT, true)
    GtkLayerShell.set_exclusive_zone(win, -1)
    GtkLayerShell.set_keyboard_mode(win, GtkLayerShell.KeyboardMode.ON_DEMAND)

    // Handle close
    win.connect("delete-event", () => {
        win.hide()
        return true
    })

    // Keyboard handling (Escape to close)
    win.connect("key-press-event", (_: Gtk.Window, event: Gdk.Event) => {
        const [, keyval] = event.get_keyval()
        if (keyval === Gdk.KEY_Escape) {
            win.hide()
            return true
        }
        return false
    })

    // Window-level drag handling for splitters
    win.add_events(
        Gdk.EventMask.POINTER_MOTION_MASK |
        Gdk.EventMask.BUTTON_RELEASE_MASK
    )

    win.connect("motion-notify-event", (_: Gtk.Window, event: Gdk.Event) => {
        if (!activeDragSegment) return false

        const [, rootX, rootY] = event.get_root_coords()
        const currentPos = activeDragSegment.orientation === 'vertical' ? rootX : rootY
        const pixelDelta = currentPos - dragStartPos

        // Use usable size captured at drag start to prevent spacing drift
        const percentDelta = pixelDelta / dragUsableSize

        if (Math.abs(percentDelta) > 0.001) {
            moveSplitterSegment(activeDragSegment, percentDelta)
            dragStartPos = currentPos
        }

        return true
    })

    win.connect("button-release-event", () => {
        if (activeDragSegment) {
            activeDragSegment = null
            activeDragWidget = null
            dragLeftZones = []
            dragRightZones = []
            dragUsableSize = 0
        }
        return false
    })

    // Create main layout
    const overlay = new Gtk.Overlay()
    overlay.get_style_context().add_class("editor-backdrop")

    // Zone container (fixed positioning for absolute placement - fullscreen)
    zoneContainer = new Gtk.Fixed()
    zoneContainer.set_size_request(fullScreenWidth, fullScreenHeight)
    overlay.add(zoneContainer)

    // Toolbar at bottom - must be on top of zones
    const toolbarWrapper = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        valign: Gtk.Align.END,
        halign: Gtk.Align.CENTER,
        margin_bottom: 30,
    })
    toolbarWrapper.pack_start(createToolbar(), false, false, 0)
    overlay.add_overlay(toolbarWrapper)
    overlay.set_overlay_pass_through(toolbarWrapper, false)

    win.add(overlay)

    // Initial zone display
    updateZoneDisplay()

    overlay.show_all()

    return win
}
