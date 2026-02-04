// ZoneEditor - Main zone editor widget using GTK layer shell
// AGS v3 imperative GTK4 style with bounded splitter segments

import { Gtk, Gdk } from "ags/gtk4"
import Gtk4LayerShell from "gi://Gtk4LayerShell"
import { execAsync } from "ags/process"
import GLib from "gi://GLib"
import { Layout, Zone, LayoutMapping, cloneLayout, getSplitterSegments, SplitterSegment } from "../models/Layout"
import { MonitorGeometry, PixelRect, PixelSplitter, zoneToPixels, splitterToPixels, collectGridBoundaries, clamp } from "../utils/geometry"
import { loadLayoutFromConfig, loadLayoutByName, saveLayoutToConfig, getLayoutNames, deleteLayout, loadAllMappings, saveMappings, addMapping, removeMapping, getActiveLayoutName } from "../services/LayoutService"
import { reloadConfig } from "../services/HyprzonesIPC"

const WINDOW_NAME = "hyprzones-editor"
const SPLITTER_THICKNESS = 4

// Default layout if none exists
const DEFAULT_LAYOUT: Layout = {
    name: 'default',
    spacingH: 10,
    spacingV: 40,
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
    activeWorkspace: { id: number, name: string }
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
let activeDragWidget: Gtk.Box | null = null
let dragStartMousePos = 0  // Mouse position when drag started (window coords)
let dragStartSplitterPos = 0  // Splitter position when drag started (percentage)
// Zones captured at drag start - these don't change during drag
let dragLeftZones: number[] = []
let dragRightZones: number[] = []
// Original zone sizes at drag start - for absolute positioning
let dragOriginalSizes: Map<number, number> = new Map()
// Usable size captured at drag start - prevents spacing drift
let dragUsableSize = 0

// UI elements that need updating
let zoneContainer: Gtk.Fixed
let mainOverlay: Gtk.Overlay

// Reload layout for current monitor/workspace (called when editor is shown)
export async function reloadCurrentLayout(): Promise<void> {
    allMonitors = await fetchAllMonitors()
    const focusedMonitor = allMonitors.find(m => m.focused) || allMonitors[0]
    if (focusedMonitor) {
        monitor = selectMonitor(focusedMonitor)
        const workspaceId = focusedMonitor.activeWorkspace?.id || 1
        const mappedLayoutName = getActiveLayoutName(selectedMonitorName, workspaceId)

        let loadedLayout: Layout | null = null
        if (mappedLayoutName) {
            loadedLayout = loadLayoutByName(mappedLayoutName)
        }
        if (!loadedLayout) {
            loadedLayout = loadLayoutFromConfig()
        }
        currentLayout = cloneLayout(loadedLayout || currentLayout)
        originalLayout = cloneLayout(currentLayout)
        hasChanges = false
        updateZoneDisplay()
    }
}

// GTK4 helper: remove all children from a container
function removeAllChildren(container: Gtk.Widget) {
    let child = container.get_first_child()
    while (child) {
        const next = child.get_next_sibling()
        if (container instanceof Gtk.Fixed) {
            (container as Gtk.Fixed).remove(child)
        } else if (container instanceof Gtk.FlowBox) {
            (container as Gtk.FlowBox).remove(child)
        } else if (container instanceof Gtk.Box) {
            (container as Gtk.Box).remove(child)
        }
        child = next
    }
}

// Update zone positions in the container
function updateZoneDisplay() {
    if (!zoneContainer) return

    // Note: layoutPanel is now in mainOverlay, not zoneContainer, so don't reset it here
    removeAllChildren(zoneContainer)

    const gridBounds = collectGridBoundaries(currentLayout.zones)

    // Draw zones (offset by monitor position for margins)
    const topOffset = monitor.y

    for (const zone of currentLayout.zones) {
        const rect = zoneToPixels(zone, monitor, currentLayout.spacingH, currentLayout.spacingV, gridBounds)
        const zoneWidget = createZoneWidget(zone, rect)
        zoneContainer.put(zoneWidget, monitor.x + rect.x, topOffset + rect.y)
    }

    // Draw bounded splitters (same offset as zones)
    const splitterSegments = getSplitterSegments(currentLayout.zones)
    for (const segment of splitterSegments) {
        const pixelSplitter = splitterToPixels(segment, monitor, currentLayout.spacingH, currentLayout.spacingV, gridBounds, SPLITTER_THICKNESS)
        const splitter = createSplitterWidget(pixelSplitter)
        zoneContainer.put(splitter, monitor.x + pixelSplitter.x, topOffset + pixelSplitter.y)
    }
}

// Create a zone rectangle widget with split buttons
function createZoneWidget(zone: Zone, rect: PixelRect): Gtk.Box {
    const container = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    container.set_size_request(rect.width, rect.height)

    const frame = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL })
    frame.get_style_context().add_class("zone")
    frame.set_halign(Gtk.Align.FILL)
    frame.set_valign(Gtk.Align.FILL)
    frame.set_hexpand(true)
    frame.set_vexpand(true)

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

    const ZONE_BTN_SIZE = 28

    // Vertical split button (split left/right) - only show if possible
    if (canSplitV) {
        const splitVBtn = new Gtk.Button({ label: "|" })
        splitVBtn.set_size_request(ZONE_BTN_SIZE, ZONE_BTN_SIZE)
        splitVBtn.get_style_context().add_class("zone-split-btn")
        splitVBtn.set_tooltip_text("Split vertically")
        splitVBtn.connect("clicked", () => splitZone(zone, 'vertical'))
        buttonBox.append(splitVBtn)
    }

    // Horizontal split button (split top/bottom) - only show if possible
    if (canSplitH) {
        const splitHBtn = new Gtk.Button({ label: "—" })
        splitHBtn.set_size_request(ZONE_BTN_SIZE, ZONE_BTN_SIZE)
        splitHBtn.get_style_context().add_class("zone-split-btn")
        splitHBtn.set_tooltip_text("Split horizontally")
        splitHBtn.connect("clicked", () => splitZone(zone, 'horizontal'))
        buttonBox.append(splitHBtn)
    }

    // Merge button - only show if there's a mergeable neighbor
    const mergeTarget = findMergeableNeighbor(zone)
    if (mergeTarget && currentLayout.zones.length > 1) {
        const mergeBtn = new Gtk.Button({ label: "×" })
        mergeBtn.set_size_request(ZONE_BTN_SIZE, ZONE_BTN_SIZE)
        mergeBtn.get_style_context().add_class("zone-split-btn")
        mergeBtn.get_style_context().add_class("zone-merge-btn")
        mergeBtn.set_tooltip_text("Merge with neighbor")
        mergeBtn.connect("clicked", () => mergeZones(zone, mergeTarget))
        buttonBox.append(mergeBtn)
    }

    // Center content
    const centerBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    centerBox.set_halign(Gtk.Align.CENTER)
    centerBox.set_valign(Gtk.Align.CENTER)
    centerBox.set_hexpand(true)
    centerBox.set_vexpand(true)
    centerBox.append(label)
    centerBox.append(buttonBox)

    frame.append(centerBox)
    container.append(frame)

    return container
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
function createSplitterWidget(pixelSplitter: PixelSplitter): Gtk.Box {
    const splitterBox = new Gtk.Box({})
    const segment = pixelSplitter.segment

    splitterBox.set_size_request(pixelSplitter.width, pixelSplitter.height)
    splitterBox.get_style_context().add_class("splitter")

    if (segment.orientation === 'vertical') {
        splitterBox.get_style_context().add_class("splitter-vertical")
    } else {
        splitterBox.get_style_context().add_class("splitter-horizontal")
    }

    const handle = new Gtk.Box({})
    handle.get_style_context().add_class("splitter-handle")
    if (segment.orientation === 'vertical') {
        handle.set_size_request(2, pixelSplitter.height)
    } else {
        handle.set_size_request(pixelSplitter.width, 2)
    }
    handle.set_halign(Gtk.Align.CENTER)
    handle.set_valign(Gtk.Align.CENTER)
    splitterBox.append(handle)

    // Get cursor types for resize
    const resizeCursor = segment.orientation === 'vertical'
        ? Gdk.Cursor.new_from_name("col-resize", null)
        : Gdk.Cursor.new_from_name("row-resize", null)
    const defaultCursor = Gdk.Cursor.new_from_name("default", null)

    // Cursor change on hover - GTK4 EventControllerMotion
    const motionController = new Gtk.EventControllerMotion()
    motionController.connect("enter", () => {
        if (!activeDragSegment) {
            splitterBox.set_cursor(resizeCursor)
            splitterBox.get_style_context().add_class("hover")
        }
    })
    motionController.connect("leave", () => {
        if (!activeDragSegment) {
            splitterBox.set_cursor(defaultCursor)
            splitterBox.get_style_context().remove_class("hover")
        }
    })
    splitterBox.add_controller(motionController)

    // Only handle button press - motion/release handled at window level
    const clickGesture = new Gtk.GestureClick()
    clickGesture.set_button(1)
    clickGesture.connect("pressed", (_gesture: Gtk.GestureClick, _n_press: number, x: number, y: number) => {
        // Get root coordinates
        const native = splitterBox.get_native()
        if (!native) return

        // In GTK4, we need to translate coordinates
        let rootX = x
        let rootY = y
        const surface = native.get_surface()
        if (surface) {
            const [wx, wy] = splitterBox.translate_coordinates(native as Gtk.Widget, x, y) || [x, y]
            rootX = wx
            rootY = wy
        }

        activeDragSegment = segment
        activeDragWidget = splitterBox
        dragStartMousePos = segment.orientation === 'vertical' ? rootX : rootY
        splitterBox.get_style_context().add_class("dragging")

        // Capture connected zones NOW while positions are still unique
        const refZone = currentLayout.zones[segment.leftZones[0]]
        const linePos = segment.orientation === 'vertical'
            ? refZone.x + refZone.width
            : refZone.y + refZone.height
        dragStartSplitterPos = linePos

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

        // Capture original zone sizes for absolute positioning
        dragOriginalSizes.clear()
        for (const i of [...dragLeftZones, ...dragRightZones]) {
            const zone = currentLayout.zones[i]
            const size = segment.orientation === 'vertical' ? zone.width : zone.height
            dragOriginalSizes.set(i, size)
        }
    })
    splitterBox.add_controller(clickGesture)

    return splitterBox
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

// Move splitter to absolute position based on delta from drag start
function moveSplitterAbsolute(segment: SplitterSegment, totalDelta: number) {
    const monitorSize = segment.orientation === 'vertical' ? monitor.width : monitor.height
    const MIN_SIZE = 200 / monitorSize

    // Calculate limits based on ORIGINAL sizes (not current)
    let minDelta = -Infinity
    let maxDelta = Infinity

    for (const i of dragLeftZones) {
        const originalSize = dragOriginalSizes.get(i) || 0
        minDelta = Math.max(minDelta, MIN_SIZE - originalSize)
    }

    for (const i of dragRightZones) {
        const originalSize = dragOriginalSizes.get(i) || 0
        maxDelta = Math.min(maxDelta, originalSize - MIN_SIZE)
    }

    const clampedDelta = Math.max(minDelta, Math.min(maxDelta, totalDelta))

    // Reset zones to original sizes and apply clamped delta
    for (const i of dragLeftZones) {
        const zone = currentLayout.zones[i]
        const originalSize = dragOriginalSizes.get(i) || 0
        if (segment.orientation === 'vertical') {
            zone.width = originalSize + clampedDelta
        } else {
            zone.height = originalSize + clampedDelta
        }
    }

    for (const i of dragRightZones) {
        const zone = currentLayout.zones[i]
        const originalSize = dragOriginalSizes.get(i) || 0
        if (segment.orientation === 'vertical') {
            zone.x = dragStartSplitterPos + clampedDelta
            zone.width = originalSize - clampedDelta
        } else {
            zone.y = dragStartSplitterPos + clampedDelta
            zone.height = originalSize - clampedDelta
        }
    }

    hasChanges = true
    updateZoneDisplay()
}

// Layout manager panel (embedded overlay, not separate window)
let layoutPanel: Gtk.Box | null = null
let layoutPanelOverlay: Gtk.Overlay | null = null
let layoutNameEntry: Gtk.Entry | null = null
let layoutFlowBox: Gtk.FlowBox | null = null
let layoutSearchEntry: Gtk.SearchEntry | null = null
let mappingsFlowBox: Gtk.FlowBox | null = null
let mappingsSearchEntry: Gtk.SearchEntry | null = null
let selectedOldName: string | null = null
let selectedMappingLayout: string = ""
let mappingLayoutButton: Gtk.Button | null = null
let mappingLayoutDropdownList: Gtk.FlowBox | null = null

function createLayoutPanel(): Gtk.Box {
    const panel = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16 })
    panel.get_style_context().add_class("layout-dialog")
    // Max 40% width, 60% height of usable monitor area, centered
    const panelWidth = Math.floor(monitor.width * 0.4)
    const panelHeight = Math.floor(monitor.height * 0.6)
    panel.set_size_request(panelWidth, panelHeight)
    // Inner padding
    panel.set_margin_start(24)
    panel.set_margin_end(24)
    panel.set_margin_top(20)
    panel.set_margin_bottom(20)

    // CRITICAL: Close button at top - always visible, always works
    const headerRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
    headerRow.set_halign(Gtk.Align.FILL)
    const titleLabel = new Gtk.Label({ label: "Config" })
    titleLabel.get_style_context().add_class("section-header")
    titleLabel.set_hexpand(true)
    titleLabel.set_halign(Gtk.Align.START)
    const closeBtn = new Gtk.Button({ label: "✕ Close (ESC)" })
    closeBtn.get_style_context().add_class("toolbar-button")
    closeBtn.get_style_context().add_class("toolbar-reset")
    closeBtn.connect("clicked", hideLayoutPanel)
    headerRow.append(titleLabel)
    headerRow.append(closeBtn)
    panel.append(headerRow)

    // === LAYOUTS SECTION ===
    const layoutsHeader = new Gtk.Label({ label: "Layouts" })
    layoutsHeader.get_style_context().add_class("section-header")
    layoutsHeader.set_halign(Gtk.Align.START)

    // Search + Name entry row
    const topRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
    topRow.set_halign(Gtk.Align.FILL)
    layoutSearchEntry = new Gtk.SearchEntry()
    layoutSearchEntry.set_placeholder_text("Filter...")
    layoutSearchEntry.set_hexpand(true)
    const nameLabel = new Gtk.Label({ label: "Name:" })
    nameLabel.set_margin_start(16)
    layoutNameEntry = new Gtk.Entry()
    layoutNameEntry.set_hexpand(true)
    topRow.append(layoutSearchEntry)
    topRow.append(nameLabel)
    topRow.append(layoutNameEntry)

    // FlowBox for layouts (grid layout - uses width intelligently)
    const layoutScroll = new Gtk.ScrolledWindow()
    layoutScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
    layoutScroll.set_vexpand(true)
    layoutScroll.set_hexpand(true)

    layoutFlowBox = new Gtk.FlowBox()
    layoutFlowBox.set_valign(Gtk.Align.START)
    layoutFlowBox.set_max_children_per_line(20)
    layoutFlowBox.set_min_children_per_line(3)
    layoutFlowBox.set_selection_mode(Gtk.SelectionMode.SINGLE)
    layoutFlowBox.set_homogeneous(true)
    layoutFlowBox.set_column_spacing(8)
    layoutFlowBox.set_row_spacing(8)
    layoutFlowBox.get_style_context().add_class("layout-flow")

    // Filter function for search
    layoutFlowBox.set_filter_func((child: Gtk.FlowBoxChild) => {
        if (!layoutSearchEntry) return true
        const searchText = layoutSearchEntry.get_text().toLowerCase()
        if (!searchText) return true
        const name = child.get_name()
        return name ? name.toLowerCase().includes(searchText) : true
    })

    layoutSearchEntry.connect("search-changed", () => {
        if (layoutFlowBox) layoutFlowBox.invalidate_filter()
    })

    layoutScroll.set_child(layoutFlowBox)

    // Layout buttons
    const layoutButtonBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 })
    layoutButtonBox.set_halign(Gtk.Align.CENTER)
    layoutButtonBox.set_margin_top(8)
    layoutButtonBox.set_margin_bottom(8)

    const loadBtn = new Gtk.Button({ label: "Load" })
    loadBtn.get_style_context().add_class("toolbar-button")
    loadBtn.get_style_context().add_class("toolbar-save")

    const saveBtn = new Gtk.Button({ label: "Save" })
    saveBtn.get_style_context().add_class("toolbar-button")
    saveBtn.get_style_context().add_class("toolbar-save")

    const renameBtn = new Gtk.Button({ label: "Rename" })
    renameBtn.get_style_context().add_class("toolbar-button")

    const deleteBtn = new Gtk.Button({ label: "Delete" })
    deleteBtn.get_style_context().add_class("toolbar-button")
    deleteBtn.get_style_context().add_class("toolbar-reset")

    // Update button states based on selection
    const updateLayoutButtonStates = () => {
        const name = layoutNameEntry?.get_text() || ""
        const layoutNames = getLayoutNames()
        const layoutExists = layoutNames.includes(name)
        const hasName = name.length > 0
        const nameChanged = selectedOldName !== null && name !== selectedOldName
        const isDifferentLayout = name !== currentLayout.name

        loadBtn.set_sensitive(layoutExists && isDifferentLayout)
        saveBtn.set_sensitive(hasName)
        renameBtn.set_sensitive(selectedOldName !== null && nameChanged && hasName)
        deleteBtn.set_sensitive(layoutExists)
    }

    // Update on name entry change
    layoutNameEntry.connect("changed", updateLayoutButtonStates)

    // Update on flow box selection
    layoutFlowBox.connect("child-activated", (_: Gtk.FlowBox, child: Gtk.FlowBoxChild) => {
        if (child && layoutNameEntry) {
            const name = child.get_name()
            if (name) {
                selectedOldName = name
                layoutNameEntry.set_text(name)
                updateLayoutButtonStates()
            }
        }
    })

    loadBtn.connect("clicked", () => {
        if (!layoutNameEntry) return
        const name = layoutNameEntry.get_text()
        if (!name) return
        const loaded = loadLayoutByName(name)
        if (loaded) {
            currentLayout = loaded
            originalLayout = cloneLayout(loaded)
            hasChanges = false
            updateZoneDisplay()
            refreshLayoutList()
            updateLayoutButtonStates()
        }
    })

    saveBtn.connect("clicked", async () => {
        if (!layoutNameEntry) return
        const name = layoutNameEntry.get_text()
        if (name) {
            currentLayout.name = name
            const success = saveLayoutToConfig(currentLayout, true)
            if (success) {
                await reloadConfig()
                hasChanges = false
                originalLayout = cloneLayout(currentLayout)
                refreshLayoutList()
                updateZoneDisplay()
                updateLayoutButtonStates()
            }
        }
    })

    renameBtn.connect("clicked", async () => {
        if (!layoutNameEntry || !selectedOldName) return
        const newName = layoutNameEntry.get_text()
        if (newName && newName !== selectedOldName) {
            const layout = loadLayoutByName(selectedOldName)
            if (layout) {
                deleteLayout(selectedOldName)
                layout.name = newName
                saveLayoutToConfig(layout, true)

                // Update all mappings that reference the old name
                const mappings = loadAllMappings()
                const updatedMappings = mappings.map(m =>
                    m.layout === selectedOldName ? { ...m, layout: newName } : m
                )
                saveMappings(updatedMappings)

                if (currentLayout.name === selectedOldName) {
                    currentLayout.name = newName
                }
                await reloadConfig()
                refreshLayoutList()
                refreshMappingsList()
                selectedOldName = newName
                updateLayoutButtonStates()
            }
        }
    })

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
            updateLayoutButtonStates()
        }
    })

    // Initial state
    updateLayoutButtonStates()

    layoutButtonBox.append(loadBtn)
    layoutButtonBox.append(saveBtn)
    layoutButtonBox.append(renameBtn)
    layoutButtonBox.append(deleteBtn)

    // === MAPPINGS SECTION ===
    const mappingsHeader = new Gtk.Label({ label: "Mappings" })
    mappingsHeader.get_style_context().add_class("section-header")
    mappingsHeader.set_halign(Gtk.Align.START)

    // Mappings search
    mappingsSearchEntry = new Gtk.SearchEntry()
    mappingsSearchEntry.set_placeholder_text("Filter...")
    mappingsSearchEntry.set_hexpand(true)

    // FlowBox for mappings (grid layout - uses width intelligently)
    const mappingsScroll = new Gtk.ScrolledWindow()
    mappingsScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
    mappingsScroll.set_vexpand(true)
    mappingsScroll.set_hexpand(true)

    mappingsFlowBox = new Gtk.FlowBox()
    mappingsFlowBox.set_valign(Gtk.Align.START)
    mappingsFlowBox.set_max_children_per_line(10)
    mappingsFlowBox.set_min_children_per_line(2)
    mappingsFlowBox.set_selection_mode(Gtk.SelectionMode.NONE)
    mappingsFlowBox.set_homogeneous(false)
    mappingsFlowBox.set_column_spacing(8)
    mappingsFlowBox.set_row_spacing(8)
    mappingsFlowBox.get_style_context().add_class("mappings-flow")

    // Filter function for search
    mappingsFlowBox.set_filter_func((child: Gtk.FlowBoxChild) => {
        if (!mappingsSearchEntry) return true
        const searchText = mappingsSearchEntry.get_text().toLowerCase()
        if (!searchText) return true
        const text = child.get_name()
        return text ? text.toLowerCase().includes(searchText) : true
    })

    mappingsSearchEntry.connect("search-changed", () => {
        if (mappingsFlowBox) mappingsFlowBox.invalidate_filter()
    })

    mappingsScroll.set_child(mappingsFlowBox)

    // Add mapping row
    const addMappingBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 })
    addMappingBox.set_halign(Gtk.Align.CENTER)
    addMappingBox.set_margin_top(8)

    const monitorCombo = new Gtk.ComboBoxText()
    monitorCombo.get_style_context().add_class("mapping-combo")
    monitorCombo.append("*", "All Monitors")
    for (const mon of allMonitors) {
        monitorCombo.append(mon.name, mon.name)
    }
    monitorCombo.set_active_id("*")

    const wsEntry = new Gtk.Entry()
    wsEntry.set_placeholder_text("1-5 or *")
    wsEntry.set_width_chars(10)
    wsEntry.set_text("*")

    // Searchable layout selector - button with floating popover
    mappingLayoutButton = new Gtk.Button({ label: "Select Layout ▾" })
    mappingLayoutButton.get_style_context().add_class("toolbar-button")
    mappingLayoutButton.set_size_request(150, -1)

    // Popover floats over content - no layout shift
    const layoutPopover = new Gtk.Popover()
    layoutPopover.set_parent(mappingLayoutButton)
    layoutPopover.set_autohide(true)
    layoutPopover.set_has_arrow(false)
    layoutPopover.set_position(Gtk.PositionType.TOP)  // Opens upward
    layoutPopover.get_style_context().add_class("layout-popover")

    // ESC to close popover
    const popoverKeyController = new Gtk.EventControllerKey()
    popoverKeyController.connect("key-pressed", (_controller: Gtk.EventControllerKey, keyval: number, _keycode: number, _state: Gdk.ModifierType) => {
        if (keyval === Gdk.KEY_Escape) {
            layoutPopover.popdown()
            return true
        }
        return false
    })
    layoutPopover.add_controller(popoverKeyController)

    const popoverContent = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    popoverContent.set_size_request(300, 350)  // Fixed size - no resizing
    popoverContent.set_margin_start(12)
    popoverContent.set_margin_end(12)
    popoverContent.set_margin_top(12)
    popoverContent.set_margin_bottom(12)

    const layoutDropdownSearch = new Gtk.SearchEntry()
    layoutDropdownSearch.set_placeholder_text("Search...")
    layoutDropdownSearch.set_size_request(280, -1)

    // ESC on search entry closes popover
    const searchKeyController = new Gtk.EventControllerKey()
    searchKeyController.connect("key-pressed", (_controller: Gtk.EventControllerKey, keyval: number, _keycode: number, _state: Gdk.ModifierType) => {
        if (keyval === Gdk.KEY_Escape) {
            layoutPopover.popdown()
            return true
        }
        return false
    })
    layoutDropdownSearch.add_controller(searchKeyController)

    const layoutDropdownScroll = new Gtk.ScrolledWindow()
    layoutDropdownScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
    layoutDropdownScroll.set_size_request(280, 300)

    const layoutDropdownList = new Gtk.FlowBox()
    layoutDropdownList.set_valign(Gtk.Align.START)
    layoutDropdownList.set_max_children_per_line(1)
    layoutDropdownList.set_min_children_per_line(1)
    layoutDropdownList.set_selection_mode(Gtk.SelectionMode.SINGLE)
    layoutDropdownList.get_style_context().add_class("layout-dropdown-list")

    // Filter function
    layoutDropdownList.set_filter_func((child: Gtk.FlowBoxChild) => {
        const searchText = layoutDropdownSearch.get_text().toLowerCase()
        if (!searchText) return true
        const name = child.get_name()
        return name ? name.toLowerCase().includes(searchText) : true
    })

    layoutDropdownSearch.connect("search-changed", () => {
        layoutDropdownList.invalidate_filter()
    })

    // Open popover on button click
    mappingLayoutButton.connect("clicked", () => {
        layoutDropdownSearch.set_text("")
        layoutDropdownList.invalidate_filter()
        layoutPopover.popup()
        layoutDropdownSearch.grab_focus()
    })

    // Select layout from list
    layoutDropdownList.connect("child-activated", (_: Gtk.FlowBox, child: Gtk.FlowBoxChild) => {
        const name = child.get_name()
        if (name && mappingLayoutButton) {
            selectedMappingLayout = name
            mappingLayoutButton.set_label(name + " ▾")
            layoutPopover.popdown()
        }
    })

    layoutDropdownScroll.set_child(layoutDropdownList)
    popoverContent.append(layoutDropdownSearch)
    popoverContent.append(layoutDropdownScroll)
    layoutPopover.set_child(popoverContent)

    // Store reference for refresh
    mappingLayoutDropdownList = layoutDropdownList

    const addMappingBtn = new Gtk.Button({ label: "+" })
    addMappingBtn.get_style_context().add_class("toolbar-button")
    addMappingBtn.get_style_context().add_class("toolbar-save")

    // Function to check if current mapping selection is valid
    const updateAddButtonState = () => {
        const monitorId = monitorCombo.get_active_id() || "*"
        const workspaces = wsEntry.get_text() || "*"
        const mappings = loadAllMappings()

        let canAdd = true

        // Check for exact duplicate (same monitor + same workspaces)
        const isDuplicate = mappings.some(m =>
            m.monitor === monitorId && m.workspaces === workspaces
        )
        // Duplicates are allowed - they replace the existing mapping
        // So we don't block duplicates

        // Block if a global wildcard (* + *) already exists
        const hasGlobalWildcard = mappings.some(m =>
            m.monitor === "*" && m.workspaces === "*"
        )
        if (hasGlobalWildcard) {
            canAdd = false
        }

        // Block (* + *) if any mappings exist
        if (canAdd && monitorId === "*" && workspaces === "*" && mappings.length > 0) {
            canAdd = false
        }

        // Block (monitor + *) if mappings for this monitor already exist
        if (canAdd && workspaces === "*") {
            const hasMonitorMappings = mappings.some(m =>
                m.monitor === monitorId || (monitorId !== "*" && m.monitor === "*")
            )
            if (hasMonitorMappings) {
                canAdd = false
            }
        }

        // Block if covered by (this monitor + *) wildcard
        if (canAdd && workspaces !== "*") {
            const coveredByMonitorWildcard = mappings.some(m =>
                m.monitor === monitorId && m.workspaces === "*"
            )
            if (coveredByMonitorWildcard) {
                canAdd = false
            }
        }

        addMappingBtn.set_sensitive(canAdd)
    }

    // Update button state when inputs change
    monitorCombo.connect("changed", updateAddButtonState)
    wsEntry.connect("changed", updateAddButtonState)

    addMappingBtn.connect("clicked", async () => {
        const monitorId = monitorCombo.get_active_id() || "*"
        const workspaces = wsEntry.get_text() || "*"
        const layout = selectedMappingLayout
        if (layout) {
            const mappings = loadAllMappings()

            // Exact duplicate - replace the layout
            const existingIndex = mappings.findIndex(m =>
                m.monitor === monitorId && m.workspaces === workspaces
            )

            if (existingIndex >= 0) {
                mappings[existingIndex].layout = layout
                saveMappings(mappings)
            } else {
                addMapping({ monitor: monitorId, workspaces, layout })
            }
            await reloadConfig()
            refreshMappingsList()
            refreshLayoutList()
            updateAddButtonState()
        }
    })

    addMappingBox.append(monitorCombo)
    addMappingBox.append(wsEntry)
    addMappingBox.append(mappingLayoutButton)
    addMappingBox.append(addMappingBtn)

    // Assemble panel with Paned for resizable split
    const paned = new Gtk.Paned({ orientation: Gtk.Orientation.VERTICAL })
    paned.set_vexpand(true)
    paned.set_hexpand(true)

    // Top section: Layouts
    const layoutsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    layoutsBox.append(layoutsHeader)
    layoutsBox.append(topRow)
    layoutsBox.append(layoutScroll)
    layoutsBox.append(layoutButtonBox)

    // Bottom section: Mappings
    const mappingsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    mappingsBox.set_margin_top(16)
    mappingsBox.append(mappingsHeader)
    mappingsBox.append(mappingsSearchEntry)
    mappingsBox.append(mappingsScroll)
    mappingsBox.append(addMappingBox)

    paned.set_start_child(layoutsBox)
    paned.set_end_child(mappingsBox)
    paned.set_resize_start_child(true)
    paned.set_resize_end_child(true)
    paned.set_shrink_start_child(false)
    paned.set_shrink_end_child(false)

    panel.append(paned)

    // Initial button state check
    updateAddButtonState()

    // Populate layout dropdown initially
    populateMappingLayoutDropdown()

    return panel
}

// Populate the mapping layout dropdown with layout names
function populateMappingLayoutDropdown() {
    if (!mappingLayoutDropdownList) return

    removeAllChildren(mappingLayoutDropdownList)

    const layoutNames = getLayoutNames()
    for (const name of layoutNames) {
        const item = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
        item.get_style_context().add_class("layout-dropdown-item")
        item.set_hexpand(true)

        const label = new Gtk.Label({ label: name })
        label.set_halign(Gtk.Align.START)
        label.set_hexpand(true)
        item.append(label)

        const child = new Gtk.FlowBoxChild()
        child.set_name(name)
        child.set_child(item)
        mappingLayoutDropdownList.append(child)
    }

    // Select first layout by default
    if (layoutNames.length > 0 && !selectedMappingLayout) {
        selectedMappingLayout = layoutNames[0]
        if (mappingLayoutButton) {
            mappingLayoutButton.set_label(selectedMappingLayout + " ▾")
        }
    }
}

function refreshLayoutList() {
    if (!layoutFlowBox) return

    // Clear existing children
    removeAllChildren(layoutFlowBox)

    // Get all mapped layout names (layouts used in any mapping)
    const mappings = loadAllMappings()
    const mappedLayoutNames = new Set(mappings.map(m => m.layout))

    // Add layouts as flow items (cards with hover)
    const layoutNames = getLayoutNames()
    for (const name of layoutNames) {
        // Box for hover detection (replaces EventBox)
        const hoverBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })

        const card = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 })
        card.get_style_context().add_class("layout-card")
        card.set_margin_start(4)
        card.set_margin_end(4)
        card.set_margin_top(4)
        card.set_margin_bottom(4)

        // Hover effects with EventControllerMotion
        const motionController = new Gtk.EventControllerMotion()
        motionController.connect("enter", () => {
            card.get_style_context().add_class("hover")
        })
        motionController.connect("leave", () => {
            card.get_style_context().remove_class("hover")
        })
        hoverBox.add_controller(motionController)

        // Status indicators with proper spacing
        const isActive = name === currentLayout.name
        const isMapped = mappedLayoutNames.has(name)

        // Active indicator (filled/outline arrow)
        const activeIndicator = new Gtk.Label()
        activeIndicator.set_use_markup(true)
        activeIndicator.set_label(isActive
            ? '<span foreground="#cc8844">▶</span>'
            : '<span foreground="#555555">▷</span>')
        activeIndicator.set_margin_end(6)

        // Mapped indicator (filled/outline circle)
        const mappedIndicator = new Gtk.Label()
        mappedIndicator.set_use_markup(true)
        mappedIndicator.set_label(isMapped
            ? '<span foreground="#00ff00">●</span>'
            : '<span foreground="#555555">○</span>')
        mappedIndicator.set_margin_end(8)

        const label = new Gtk.Label({ label: name })
        label.set_margin_top(6)
        label.set_margin_bottom(6)
        label.set_margin_end(8)

        card.append(activeIndicator)
        card.append(mappedIndicator)
        card.append(label)

        hoverBox.append(card)

        // Store name for selection and filtering
        const child = new Gtk.FlowBoxChild()
        child.set_name(name)
        child.set_child(hoverBox)
        layoutFlowBox.append(child)
    }

    // Update layout dropdown in add mapping row
    populateMappingLayoutDropdown()
}

function refreshMappingsList() {
    const flowBox = mappingsFlowBox
    if (!flowBox) return

    // Clear existing children
    removeAllChildren(flowBox)

    // Add mappings as professional cards
    const mappings = loadAllMappings()
    mappings.forEach((mapping, index) => {
        const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
        card.get_style_context().add_class("mapping-card")
        card.set_margin_start(4)
        card.set_margin_end(4)
        card.set_margin_top(4)
        card.set_margin_bottom(4)

        // Hover effects
        const motionController = new Gtk.EventControllerMotion()
        motionController.connect("enter", () => {
            card.get_style_context().add_class("hover")
        })
        motionController.connect("leave", () => {
            card.get_style_context().remove_class("hover")
        })
        card.add_controller(motionController)

        // Header row: Layout name + delete button
        const headerRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
        headerRow.set_hexpand(true)

        const layoutLabel = new Gtk.Label({ label: mapping.layout })
        layoutLabel.get_style_context().add_class("mapping-card-title")
        layoutLabel.set_halign(Gtk.Align.START)
        layoutLabel.set_hexpand(true)

        const deleteBtn = new Gtk.Button({ label: "×" })
        deleteBtn.get_style_context().add_class("mapping-delete-btn")
        deleteBtn.connect("clicked", async () => {
            removeMapping(index)
            await reloadConfig()
            refreshMappingsList()
            refreshLayoutList()
        })

        headerRow.append(layoutLabel)
        headerRow.append(deleteBtn)

        // Metadata rows
        const metaBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
        metaBox.get_style_context().add_class("mapping-card-meta")

        // Monitor info
        const monitorBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 })
        const monitorLabelKey = new Gtk.Label({ label: "Monitor:" })
        monitorLabelKey.get_style_context().add_class("mapping-card-key")
        const monitorLabelVal = new Gtk.Label({ label: mapping.monitor === "*" ? "All" : mapping.monitor })
        monitorLabelVal.get_style_context().add_class("mapping-card-value")
        monitorBox.append(monitorLabelKey)
        monitorBox.append(monitorLabelVal)

        // Workspaces info
        const wsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 })
        const wsLabelKey = new Gtk.Label({ label: "WS:" })
        wsLabelKey.get_style_context().add_class("mapping-card-key")
        const wsLabelVal = new Gtk.Label({ label: mapping.workspaces === "*" ? "All" : mapping.workspaces })
        wsLabelVal.get_style_context().add_class("mapping-card-value")
        wsBox.append(wsLabelKey)
        wsBox.append(wsLabelVal)

        metaBox.append(monitorBox)
        metaBox.append(wsBox)

        card.append(headerRow)
        card.append(metaBox)

        // Store search text for filtering
        const searchText = `${mapping.monitor} ${mapping.workspaces} ${mapping.layout}`
        const child = new Gtk.FlowBoxChild()
        child.set_name(searchText)
        child.set_child(card)
        flowBox.append(child)
    })
}

async function showLayoutPanel() {
    // Remove old panel and recreate (safer than toggling visibility)
    if (layoutPanel && mainOverlay) {
        mainOverlay.remove_overlay(layoutPanel)
        layoutPanel = null
    }

    // Create new panel - centered on screen
    layoutPanel = createLayoutPanel()
    layoutPanel.set_halign(Gtk.Align.CENTER)
    layoutPanel.set_valign(Gtk.Align.CENTER)
    layoutPanel.set_can_focus(true)
    layoutPanel.set_focusable(true)

    // CRITICAL: Add ESC key handler with CAPTURE phase - catches key BEFORE children
    const panelKeyController = new Gtk.EventControllerKey()
    panelKeyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
    panelKeyController.connect("key-pressed", (_controller: Gtk.EventControllerKey, keyval: number, _keycode: number, _state: Gdk.ModifierType) => {
        if (keyval === Gdk.KEY_Escape) {
            hideLayoutPanel()
            return true
        }
        return false
    })
    layoutPanel.add_controller(panelKeyController)

    // SAFETY: Also add Close button click handler redundantly
    // The close button in createLayoutPanel already calls hideLayoutPanel

    // Start with empty entry - user must select a layout first
    layoutNameEntry?.set_text("")
    selectedOldName = null
    refreshLayoutList()
    refreshMappingsList()

    // Add as overlay (on top of everything)
    if (mainOverlay) {
        mainOverlay.add_overlay(layoutPanel)
        // Grab focus so ESC works
        layoutPanel.grab_focus()
    }
}

function hideLayoutPanel() {
    if (layoutPanel) {
        layoutPanel.set_visible(false)
    }
}

// Handle reset - zurück zu einer einzelnen Kachel
function handleReset() {
    currentLayout = {
        name: currentLayout.name,
        spacingH: currentLayout.spacingH,
        spacingV: currentLayout.spacingV,
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
const MARGIN_TOP = 97
const MARGIN_BOTTOM = 22
const MARGIN_LEFT = 22
const MARGIN_RIGHT = 22
let HEADER_BAR_HEIGHT = 0  // Detected from hyprbars plugin

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

    // Use fixed margins (waybar + gaps) - HEADER_BAR_HEIGHT is per-window, not screen
    return {
        x: MARGIN_LEFT,
        y: MARGIN_TOP,
        width: dims.width - MARGIN_LEFT - MARGIN_RIGHT,
        height: dims.height - MARGIN_TOP - MARGIN_BOTTOM
    }
}

// Get monitor geometry - use layout's monitor or focused one
async function getMonitorGeometry(preferMonitor?: string): Promise<MonitorGeometry> {
    allMonitors = await fetchAllMonitors()

    if (allMonitors.length === 0) {
        throw new Error("Keine Monitore gefunden!\n\nBitte zuerst nwg-displays starten um die Monitor-Konfiguration einzurichten.")
    }

    // Priority: 1. preferMonitor, 2. focused, 3. first
    let target: HyprMonitor | undefined

    if (preferMonitor) {
        target = allMonitors.find(m => m.name === preferMonitor)
    }
    if (!target) {
        target = allMonitors.find(m => m.focused)
    }
    if (!target) {
        target = allMonitors[0]
    }

    return selectMonitor(target)
}

// Create toolbar with buttons (no monitor selector - mappings are in Config dialog)
function createToolbar(): Gtk.Box {
    const toolbar = new Gtk.Box({ spacing: 12 })
    toolbar.get_style_context().add_class("toolbar")
    toolbar.set_halign(Gtk.Align.CENTER)

    // Reset button
    const resetBtn = new Gtk.Button({ label: "Reset" })
    resetBtn.get_style_context().add_class("toolbar-button")
    resetBtn.get_style_context().add_class("toolbar-reset")
    resetBtn.connect("clicked", handleReset)

    // Config button - opens layout management dialog
    const configBtn = new Gtk.Button({ label: "Config" })
    configBtn.get_style_context().add_class("toolbar-button")
    configBtn.get_style_context().add_class("toolbar-save")
    configBtn.connect("clicked", showLayoutPanel)

    toolbar.append(resetBtn)
    toolbar.append(configBtn)

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

        errorBox.append(errorLabel)
        errorBox.append(okBtn)
        errorWin.set_child(errorBox)

        return errorWin
    }

    // Load layout for current monitor/workspace, or first layout, or default
    const focusedMonitor = allMonitors.find(m => m.focused) || allMonitors[0]
    const workspaceId = focusedMonitor?.activeWorkspace?.id || 1
    const mappedLayoutName = getActiveLayoutName(selectedMonitorName, workspaceId)

    let loadedLayout: Layout | null = null
    if (mappedLayoutName) {
        loadedLayout = loadLayoutByName(mappedLayoutName)
    }
    if (!loadedLayout) {
        loadedLayout = loadLayoutFromConfig()
    }
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

    win.get_style_context().add_class("zone-editor")
    editorWindow = win

    // Initialize layer shell
    try {
        Gtk4LayerShell.init_for_window(win)
        Gtk4LayerShell.set_layer(win, Gtk4LayerShell.Layer.OVERLAY)
        const display = Gdk.Display.get_default()
        if (display) {
            const monitors = display.get_monitors()
            const gdkMonitor = monitors.get_item(0) as Gdk.Monitor | null
            if (gdkMonitor) {
                Gtk4LayerShell.set_monitor(win, gdkMonitor)
            }
        }
        Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.TOP, true)
        Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.BOTTOM, true)
        Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.LEFT, true)
        Gtk4LayerShell.set_anchor(win, Gtk4LayerShell.Edge.RIGHT, true)
        Gtk4LayerShell.set_exclusive_zone(win, -1)
        Gtk4LayerShell.set_keyboard_mode(win, Gtk4LayerShell.KeyboardMode.ON_DEMAND)
    } catch (e) {
        console.error("Layer shell init failed:", e)
    }

    // Handle close
    win.connect("close-request", () => {
        win.hide()
        return true
    })

    // Keyboard handling (Escape to close) - GTK4 EventControllerKey
    // CRITICAL: ESC must ALWAYS work - use CAPTURE phase to catch before any child
    const keyController = new Gtk.EventControllerKey()
    keyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
    keyController.connect("key-pressed", (_controller: Gtk.EventControllerKey, keyval: number, _keycode: number, _state: Gdk.ModifierType) => {
        if (keyval === Gdk.KEY_Escape) {
            // First close config panel if open AND VISIBLE
            if (layoutPanel && layoutPanel.get_visible()) {
                hideLayoutPanel()
                return true
            }
            // Then hide window
            win.hide()
            return true
        }
        return false
    })
    win.add_controller(keyController)

    // Window-level drag handling for splitters - GTK4 EventControllerMotion
    const winMotionController = new Gtk.EventControllerMotion()
    winMotionController.connect("motion", (_controller: Gtk.EventControllerMotion, x: number, y: number) => {
        if (!activeDragSegment) return

        // Calculate mouse position as percentage of usable area
        // Mouse x/y are window coords, subtract monitor offset to get position in usable area
        const mouseInUsable = activeDragSegment.orientation === 'vertical'
            ? x - monitor.x
            : y - monitor.y
        const mousePercent = mouseInUsable / dragUsableSize

        // Delta from original splitter position to current mouse position
        const percentDelta = mousePercent - dragStartSplitterPos

        moveSplitterAbsolute(activeDragSegment, percentDelta)
    })
    win.add_controller(winMotionController)

    // Window-level button release handling - GTK4 GestureClick
    const winClickGesture = new Gtk.GestureClick()
    winClickGesture.set_button(0)
    winClickGesture.connect("released", () => {
        if (activeDragSegment) {
            if (activeDragWidget) {
                activeDragWidget.get_style_context().remove_class("dragging")
            }
            activeDragSegment = null
            activeDragWidget = null
            dragLeftZones = []
            dragRightZones = []
            dragUsableSize = 0
        }
    })
    win.add_controller(winClickGesture)

    // Create main layout
    mainOverlay = new Gtk.Overlay()
    mainOverlay.get_style_context().add_class("editor-backdrop")

    // Zone container (fixed positioning for absolute placement - fullscreen)
    zoneContainer = new Gtk.Fixed()
    zoneContainer.set_size_request(fullScreenWidth, fullScreenHeight)
    mainOverlay.set_child(zoneContainer)

    // Toolbar at bottom - must be on top of zones
    const toolbarWrapper = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        valign: Gtk.Align.END,
        halign: Gtk.Align.CENTER,
        margin_bottom: 30,
    })
    toolbarWrapper.append(createToolbar())
    mainOverlay.add_overlay(toolbarWrapper)

    win.set_child(mainOverlay)

    // Initial zone display
    updateZoneDisplay()

    return win
}
