// ZoneEditor - Main zone editor widget using GTK layer shell
// AGS v3 imperative GTK style with bounded splitter segments

import { Gtk, Gdk } from "ags/gtk3"
import GtkLayerShell from "gi://GtkLayerShell"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { Layout, Zone, cloneLayout, getSplitterSegments, SplitterSegment } from "../models/Layout"
import { MonitorGeometry, PixelRect, PixelSplitter, zoneToPixels, splitterToPixels, collectGridBoundaries, clamp } from "../utils/geometry"
import { loadLayoutFromConfig, loadLayoutByName, saveLayoutToConfig, getLayoutNames, deleteLayout } from "../services/LayoutService"
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

// Monitor info from Hyprland
interface HyprMonitor {
    id: number
    name: string
    width: number
    height: number
    x: number
    y: number
    transform: number  // 0=normal, 1=90°, 2=180°, 3=270°, 4-7=flipped variants
    scale: number
    reserved: [number, number, number, number]  // left, top, right, bottom
    focused: boolean
}

// State
let editorWindow: Gtk.Window | null = null
let currentLayout: Layout
let originalLayout: Layout
let hasChanges = false
let allMonitors: HyprMonitor[] = []
let selectedMonitorName: string = ""
let monitor: MonitorGeometry = { x: 0, y: 0, width: 1920, height: 1080 }
let fullScreenWidth = 1920
let fullScreenHeight = 1080

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

    const MIN_SPLIT_SIZE = 300
    const canSplitV = rect.width >= MIN_SPLIT_SIZE
    const canSplitH = rect.height >= MIN_SPLIT_SIZE

    // Vertical split button (split left/right) - only show if possible
    if (canSplitV) {
        const splitVBtn = new Gtk.Button({ label: "⬍" })
        splitVBtn.get_style_context().add_class("zone-split-btn")
        splitVBtn.set_tooltip_text("Split vertically")
        splitVBtn.connect("clicked", () => splitZone(zone, 'vertical'))
        buttonBox.pack_start(splitVBtn, false, false, 0)
    }

    // Horizontal split button (split top/bottom) - only show if possible
    if (canSplitH) {
        const splitHBtn = new Gtk.Button({ label: "⬌" })
        splitHBtn.get_style_context().add_class("zone-split-btn")
        splitHBtn.set_tooltip_text("Split horizontally")
        splitHBtn.connect("clicked", () => splitZone(zone, 'horizontal'))
        buttonBox.pack_start(splitHBtn, false, false, 0)
    }

    // Merge button - only show if there's a mergeable neighbor
    const mergeTarget = findMergeableNeighbor(zone)
    if (mergeTarget && currentLayout.zones.length > 1) {
        const mergeBtn = new Gtk.Button({ label: "✕" })
        mergeBtn.get_style_context().add_class("zone-split-btn")
        mergeBtn.get_style_context().add_class("zone-merge-btn")
        mergeBtn.set_tooltip_text("Merge with neighbor")
        mergeBtn.connect("clicked", () => mergeZones(zone, mergeTarget))
        buttonBox.pack_start(mergeBtn, false, false, 0)
    }

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

    // Check if zone is large enough to split (minimum 300px in split direction)
    const MIN_SPLIT_SIZE = 300
    if (direction === 'vertical') {
        const pixelWidth = zone.width * monitor.width
        if (pixelWidth < MIN_SPLIT_SIZE) return
    } else {
        const pixelHeight = zone.height * monitor.height
        if (pixelHeight < MIN_SPLIT_SIZE) return
    }

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

// Finde einen Nachbarn mit dem diese Zone gemerged werden kann
// Gibt den Nachbarn zurück wenn sie eine komplette Kante teilen
function findMergeableNeighbor(zone: Zone): Zone | null {
    const eps = 0.001

    for (const other of currentLayout.zones) {
        if (other.name === zone.name) continue

        // Prüfe ob sie horizontal nebeneinander sind (gleiche Höhe, gleiche y-Position)
        if (Math.abs(zone.y - other.y) < eps && Math.abs(zone.height - other.height) < eps) {
            // Zone rechts von other?
            if (Math.abs(zone.x - (other.x + other.width)) < eps) return other
            // Zone links von other?
            if (Math.abs(other.x - (zone.x + zone.width)) < eps) return other
        }

        // Prüfe ob sie vertikal übereinander sind (gleiche Breite, gleiche x-Position)
        if (Math.abs(zone.x - other.x) < eps && Math.abs(zone.width - other.width) < eps) {
            // Zone unter other?
            if (Math.abs(zone.y - (other.y + other.height)) < eps) return other
            // Zone über other?
            if (Math.abs(other.y - (zone.y + zone.height)) < eps) return other
        }
    }

    return null
}

// Merge zwei Zonen zu einer
function mergeZones(zone: Zone, neighbor: Zone) {
    const eps = 0.001

    // Bestimme die neue Größe (Bounding Box beider Zonen)
    const minX = Math.min(zone.x, neighbor.x)
    const minY = Math.min(zone.y, neighbor.y)
    const maxX = Math.max(zone.x + zone.width, neighbor.x + neighbor.width)
    const maxY = Math.max(zone.y + zone.height, neighbor.y + neighbor.height)

    // Erweitere die Zone
    zone.x = minX
    zone.y = minY
    zone.width = maxX - minX
    zone.height = maxY - minY

    // Entferne den Nachbarn
    const neighborIndex = currentLayout.zones.findIndex(z => z.name === neighbor.name)
    if (neighborIndex !== -1) {
        currentLayout.zones.splice(neighborIndex, 1)
    }

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
    // Minimum zone size: 200px converted to percentage
    const monitorSize = segment.orientation === 'vertical' ? monitor.width : monitor.height
    const MIN_SIZE = 200 / monitorSize

    // Calculate limits - ALWAYS check both sides regardless of delta direction
    // Left zones shrink when moving left (delta < 0), so minDelta = -(size - MIN_SIZE)
    // Right zones shrink when moving right (delta > 0), so maxDelta = size - MIN_SIZE
    let minDelta = -Infinity
    let maxDelta = Infinity

    for (const i of dragLeftZones) {
        const zone = currentLayout.zones[i]
        const currentSize = segment.orientation === 'vertical' ? zone.width : zone.height
        // Left zone can shrink by at most (currentSize - MIN_SIZE)
        // delta >= -(currentSize - MIN_SIZE)
        minDelta = Math.max(minDelta, MIN_SIZE - currentSize)
    }

    for (const i of dragRightZones) {
        const zone = currentLayout.zones[i]
        const currentSize = segment.orientation === 'vertical' ? zone.width : zone.height
        // Right zone can shrink by at most (currentSize - MIN_SIZE)
        // delta <= currentSize - MIN_SIZE
        maxDelta = Math.min(maxDelta, currentSize - MIN_SIZE)
    }

    // Clamp delta to allowed range
    const clampedDelta = Math.max(minDelta, Math.min(maxDelta, delta))
    if (Math.abs(clampedDelta) < 0.001) return  // No movement possible

    // Apply clamped delta
    for (const i of dragLeftZones) {
        const zone = currentLayout.zones[i]
        if (segment.orientation === 'vertical') {
            zone.width += clampedDelta
        } else {
            zone.height += clampedDelta
        }
    }
    for (const i of dragRightZones) {
        const zone = currentLayout.zones[i]
        if (segment.orientation === 'vertical') {
            zone.x += clampedDelta
            zone.width -= clampedDelta
        } else {
            zone.y += clampedDelta
            zone.height -= clampedDelta
        }
    }

    hasChanges = true
    updateZoneDisplay()
}


// Layout manager panel (embedded overlay, not separate window)
let layoutPanel: Gtk.Box | null = null
let layoutPanelOverlay: Gtk.Overlay | null = null
let layoutNameEntry: Gtk.Entry | null = null
let layoutListBox: Gtk.ListBox | null = null

function createLayoutPanel(): Gtk.Box {
    const panel = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 12 })
    panel.get_style_context().add_class("layout-dialog")
    panel.set_halign(Gtk.Align.CENTER)
    panel.set_valign(Gtk.Align.CENTER)

    // Name entry
    const nameBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
    const nameLabel = new Gtk.Label({ label: "Name:" })
    nameLabel.set_width_chars(8)
    layoutNameEntry = new Gtk.Entry()
    layoutNameEntry.set_width_chars(30)
    nameBox.pack_start(nameLabel, false, false, 0)
    nameBox.pack_start(layoutNameEntry, false, false, 0)

    // Existing layouts list
    const listLabel = new Gtk.Label({ label: "Existing Layouts:" })
    listLabel.set_halign(Gtk.Align.START)

    const scrollWindow = new Gtk.ScrolledWindow()
    scrollWindow.set_policy(Gtk.PolicyType.NEVER, Gtk.PolicyType.AUTOMATIC)
    scrollWindow.set_min_content_height(150)
    scrollWindow.set_min_content_width(350)

    layoutListBox = new Gtk.ListBox()
    layoutListBox.set_selection_mode(Gtk.SelectionMode.SINGLE)
    layoutListBox.get_style_context().add_class("layout-list")

    scrollWindow.add(layoutListBox)

    // Buttons
    const buttonBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
    buttonBox.set_halign(Gtk.Align.CENTER)

    // Load - lädt ausgewähltes Layout
    const loadBtn = new Gtk.Button({ label: "Load" })
    loadBtn.get_style_context().add_class("toolbar-button")
    loadBtn.connect("clicked", () => {
        if (!layoutNameEntry) return
        const name = layoutNameEntry.get_text()
        if (name) {
            const loaded = loadLayoutByName(name)
            if (loaded) {
                currentLayout = loaded
                originalLayout = cloneLayout(loaded)
                hasChanges = false
                updateZoneDisplay()
                hideLayoutPanel()
            }
        }
    })

    // Save - speichert aktuelles Layout unter dem Namen
    const saveBtn = new Gtk.Button({ label: "Save" })
    saveBtn.get_style_context().add_class("toolbar-button")
    saveBtn.get_style_context().add_class("toolbar-save")
    saveBtn.connect("clicked", async () => {
        if (!layoutNameEntry) return
        const name = layoutNameEntry.get_text()
        if (name) {
            currentLayout.name = name
            const success = saveLayoutToConfig(currentLayout, true)
            if (success) {
                await reloadConfig()
                hasChanges = false
                refreshLayoutList()
            }
        }
    })

    // Rename - benennt das ausgewählte Layout um
    let selectedOldName: string | null = null
    layoutListBox.connect("row-selected", (_: Gtk.ListBox, row: Gtk.ListBoxRow | null) => {
        if (row && layoutNameEntry) {
            const label = row.get_child() as Gtk.Label
            selectedOldName = label.get_label()
            layoutNameEntry.set_text(selectedOldName)
        }
    })

    const renameBtn = new Gtk.Button({ label: "Rename" })
    renameBtn.get_style_context().add_class("toolbar-button")
    renameBtn.connect("clicked", async () => {
        if (!layoutNameEntry || !selectedOldName) return
        const newName = layoutNameEntry.get_text()
        if (newName && newName !== selectedOldName) {
            const layout = loadLayoutByName(selectedOldName)
            if (layout) {
                deleteLayout(selectedOldName)
                layout.name = newName
                saveLayoutToConfig(layout, true)
                if (currentLayout.name === selectedOldName) {
                    currentLayout.name = newName
                }
                await reloadConfig()
                refreshLayoutList()
                selectedOldName = newName
            }
        }
    })

    // Delete - löscht das ausgewählte Layout
    const deleteBtn = new Gtk.Button({ label: "Delete" })
    deleteBtn.get_style_context().add_class("toolbar-button")
    deleteBtn.get_style_context().add_class("toolbar-reset")
    deleteBtn.connect("clicked", async () => {
        if (!layoutNameEntry) return
        const name = layoutNameEntry.get_text()
        const layoutNames = getLayoutNames()
        if (name && layoutNames.includes(name)) {
            deleteLayout(name)
            await reloadConfig()
            refreshLayoutList()
            layoutNameEntry.set_text("")
            selectedOldName = null
        }
    })

    // Close - schließt den Dialog
    const closeBtn = new Gtk.Button({ label: "Close" })
    closeBtn.get_style_context().add_class("toolbar-button")
    closeBtn.connect("clicked", hideLayoutPanel)

    buttonBox.pack_start(loadBtn, false, false, 0)
    buttonBox.pack_start(saveBtn, false, false, 0)
    buttonBox.pack_start(renameBtn, false, false, 0)
    buttonBox.pack_start(deleteBtn, false, false, 0)
    buttonBox.pack_start(closeBtn, false, false, 0)

    panel.pack_start(nameBox, false, false, 0)
    panel.pack_start(listLabel, false, false, 0)
    panel.pack_start(scrollWindow, true, true, 0)
    panel.pack_start(buttonBox, false, false, 0)

    return panel
}

function refreshLayoutList() {
    if (!layoutListBox) return

    // Clear existing rows
    layoutListBox.foreach((child: Gtk.Widget) => layoutListBox!.remove(child))

    // Add layouts
    const layoutNames = getLayoutNames()
    for (const name of layoutNames) {
        const row = new Gtk.ListBoxRow()
        const rowLabel = new Gtk.Label({ label: name })
        rowLabel.set_halign(Gtk.Align.START)
        rowLabel.set_margin_top(8)
        rowLabel.set_margin_bottom(8)
        rowLabel.set_margin_start(12)
        row.add(rowLabel)
        layoutListBox.add(row)
    }
    layoutListBox.show_all()
}

function showLayoutPanel() {
    // Remove old panel if exists
    if (layoutPanel) {
        zoneContainer?.remove(layoutPanel)
        layoutPanel = null
    }

    // Create new panel
    layoutPanel = createLayoutPanel()
    layoutNameEntry?.set_text(currentLayout.name)
    refreshLayoutList()

    // Center it on screen
    const panelWidth = 400
    const panelHeight = 250
    const x = Math.round((fullScreenWidth - panelWidth) / 2)
    const y = Math.round((fullScreenHeight - panelHeight) / 2)

    zoneContainer?.put(layoutPanel, x, y)
    layoutPanel.show_all()
}

function hideLayoutPanel() {
    if (layoutPanel && zoneContainer) {
        zoneContainer.remove(layoutPanel)
        layoutPanel = null
    }
}

// Handle cancel
function handleCancel() {
    editorWindow?.hide()
}

// Handle reset - zurück zu einer einzelnen Kachel
function handleReset() {
    currentLayout = {
        name: currentLayout.name,
        spacing: currentLayout.spacing,
        zones: [{
            index: 0,
            name: "Zone 1",
            x: 0,
            y: 0,
            width: 1,
            height: 1
        }]
    }
    hasChanges = true
    updateZoneDisplay()
}

// Screen margins (waybar + gaps) - fixed offsets for ALL monitors
let MARGIN_TOP = 97
let MARGIN_BOTTOM = 22
let MARGIN_LEFT = 22
let MARGIN_RIGHT = 22
let HEADER_BAR_HEIGHT = 0  // Will be detected from hyprbars plugin

// Detect hyprbars header bar height
async function detectHeaderBarHeight(): Promise<void> {
    try {
        const barResult = await execAsync(['hyprctl', 'getoption', 'plugin:hyprbars:bar_height', '-j'])
        const barData = JSON.parse(barResult)
        if (barData.int) {
            HEADER_BAR_HEIGHT = barData.int
        }
    } catch {
        HEADER_BAR_HEIGHT = 0
    }
}

// Fetch all monitors from Hyprland
async function fetchAllMonitors(): Promise<HyprMonitor[]> {
    try {
        const result = await execAsync(['hyprctl', 'monitors', '-j'])
        return JSON.parse(result) as HyprMonitor[]
    } catch (e) {
        console.error('Failed to get monitors:', e)
        return []
    }
}

// Get effective dimensions considering transform (portrait mode)
function getEffectiveDimensions(mon: HyprMonitor): { width: number, height: number } {
    // Transform 1, 3, 5, 7 = 90° or 270° rotation (portrait)
    const isPortrait = mon.transform === 1 || mon.transform === 3 ||
                       mon.transform === 5 || mon.transform === 7
    return isPortrait
        ? { width: mon.height, height: mon.width }
        : { width: mon.width, height: mon.height }
}

// Select a monitor and calculate its geometry using fixed margins
function selectMonitor(mon: HyprMonitor): MonitorGeometry {
    selectedMonitorName = mon.name

    const dims = getEffectiveDimensions(mon)
    fullScreenWidth = dims.width
    fullScreenHeight = dims.height

    // Use fixed margins (waybar + gaps) - same for all monitors
    return {
        x: MARGIN_LEFT,
        y: MARGIN_TOP,
        width: dims.width - MARGIN_LEFT - MARGIN_RIGHT,
        height: dims.height - MARGIN_TOP - MARGIN_BOTTOM + HEADER_BAR_HEIGHT
    }
}

// Get monitor geometry - use layout's monitor or focused one
async function getMonitorGeometry(preferMonitor?: string): Promise<MonitorGeometry> {
    // Detect hyprbars header height
    await detectHeaderBarHeight()

    allMonitors = await fetchAllMonitors()

    if (allMonitors.length === 0) {
        throw new Error("Keine Monitore gefunden!\n\nBitte zuerst nwg-displays starten um die Monitor-Konfiguration einzurichten.")
    }

    // Priority: 1. preferMonitor, 2. layout.monitor, 3. focused, 4. first
    let target: HyprMonitor | undefined

    if (preferMonitor) {
        target = allMonitors.find(m => m.name === preferMonitor)
    }
    if (!target && currentLayout?.monitor) {
        target = allMonitors.find(m => m.name === currentLayout.monitor)
    }
    if (!target) {
        target = allMonitors.find(m => m.focused)
    }
    if (!target) {
        target = allMonitors[0]
    }

    return selectMonitor(target)
}

// Create toolbar with monitor selector and buttons
function createToolbar(): Gtk.Box {
    const toolbar = new Gtk.Box({ spacing: 12 })
    toolbar.get_style_context().add_class("toolbar")
    toolbar.set_halign(Gtk.Align.CENTER)

    // Monitor selector dropdown
    const monitorBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 8 })
    const monitorLabel = new Gtk.Label({ label: "Monitor:" })
    monitorLabel.get_style_context().add_class("toolbar-label")

    const monitorCombo = new Gtk.ComboBoxText()
    monitorCombo.get_style_context().add_class("toolbar-combo")

    // Populate with available monitors
    for (const mon of allMonitors) {
        const dims = getEffectiveDimensions(mon)
        const portrait = mon.transform === 1 || mon.transform === 3 ? " ↕" : ""
        monitorCombo.append(mon.name, `${mon.name} (${dims.width}x${dims.height}${portrait})`)
    }
    monitorCombo.set_active_id(selectedMonitorName)

    monitorCombo.connect("changed", async () => {
        const newMonitor = monitorCombo.get_active_id()
        if (newMonitor && newMonitor !== selectedMonitorName) {
            monitor = await getMonitorGeometry(newMonitor)
            currentLayout.monitor = newMonitor
            hasChanges = true
            updateZoneDisplay()
        }
    })

    monitorBox.pack_start(monitorLabel, false, false, 0)
    monitorBox.pack_start(monitorCombo, false, false, 0)

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

    // Config button - opens layout management dialog
    const configBtn = new Gtk.Button({ label: "Config" })
    configBtn.get_style_context().add_class("toolbar-button")
    configBtn.get_style_context().add_class("toolbar-save")
    configBtn.connect("clicked", showLayoutPanel)

    toolbar.pack_start(monitorBox, false, false, 0)
    toolbar.pack_start(resetBtn, false, false, 0)
    toolbar.pack_start(cancelBtn, false, false, 0)
    toolbar.pack_start(configBtn, false, false, 0)

    return toolbar
}

export default async function ZoneEditor(): Promise<Gtk.Window> {
    // Get monitor info
    try {
        monitor = await getMonitorGeometry()
    } catch (e) {
        // Show error dialog if no monitors found
        const errorWin = new Gtk.Window({ title: "Error" })
        const errorBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16 })
        errorBox.set_margin_top(24)
        errorBox.set_margin_bottom(24)
        errorBox.set_margin_start(24)
        errorBox.set_margin_end(24)

        const errorLabel = new Gtk.Label({
            label: "Keine Monitore gefunden!\n\nBitte zuerst nwg-displays starten\num die Monitor-Konfiguration einzurichten."
        })
        errorLabel.set_justify(Gtk.Justification.CENTER)

        const okBtn = new Gtk.Button({ label: "OK" })
        okBtn.connect("clicked", () => errorWin.destroy())

        errorBox.pack_start(errorLabel, false, false, 0)
        errorBox.pack_start(okBtn, false, false, 0)
        errorWin.add(errorBox)
        errorWin.show_all()

        return errorWin
    }

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
    GtkLayerShell.set_monitor(win, Gdk.Display.get_default()?.get_monitor(0) ?? null)
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
