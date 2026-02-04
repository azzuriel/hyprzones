// Splitter - Splitter widget creation and drag handling

import { Gtk, Gdk } from "ags/gtk4"
import { SplitterSegment } from "../models/Layout"
import { PixelSplitter } from "../utils/geometry"
import { state, SPLITTER_THICKNESS } from "../state/EditorState"

// Callback for zone display update
let updateDisplayCallback: (() => void) | null = null

export function setUpdateDisplayCallback(callback: () => void) {
    updateDisplayCallback = callback
}

// Create a splitter widget
export function createSplitterWidget(pixelSplitter: PixelSplitter): Gtk.Box {
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

    // Cursor change on hover
    const motionController = new Gtk.EventControllerMotion()
    motionController.connect("enter", () => {
        if (!state.activeDragSegment) {
            splitterBox.set_cursor(resizeCursor)
            splitterBox.get_style_context().add_class("hover")
        }
    })
    motionController.connect("leave", () => {
        if (!state.activeDragSegment) {
            splitterBox.set_cursor(defaultCursor)
            splitterBox.get_style_context().remove_class("hover")
        }
    })
    splitterBox.add_controller(motionController)

    // Handle button press - motion/release handled at window level
    const clickGesture = new Gtk.GestureClick()
    clickGesture.set_button(1)
    clickGesture.connect("pressed", (_gesture: Gtk.GestureClick, _n_press: number, x: number, y: number) => {
        // Get root coordinates
        const native = splitterBox.get_native()
        if (!native) return

        // In GTK4, translate coordinates
        let rootX = x
        let rootY = y
        const surface = native.get_surface()
        if (surface) {
            const [wx, wy] = splitterBox.translate_coordinates(native as Gtk.Widget, x, y) || [x, y]
            rootX = wx
            rootY = wy
        }

        state.activeDragSegment = segment
        state.activeDragWidget = splitterBox
        state.dragStartMousePos = segment.orientation === 'vertical' ? rootX : rootY
        splitterBox.get_style_context().add_class("dragging")

        // Capture connected zones NOW while positions are still unique
        const refZone = state.currentLayout.zones[segment.leftZones[0]]
        const linePos = segment.orientation === 'vertical'
            ? refZone.x + refZone.width
            : refZone.y + refZone.height
        state.dragStartSplitterPos = linePos

        state.dragLeftZones = []
        state.dragRightZones = []
        for (const i of segment.leftZones) {
            for (const j of findZonesAlongLine(i, linePos, segment.orientation, 'left')) {
                if (!state.dragLeftZones.includes(j)) state.dragLeftZones.push(j)
            }
        }
        for (const i of segment.rightZones) {
            for (const j of findZonesAlongLine(i, linePos, segment.orientation, 'right')) {
                if (!state.dragRightZones.includes(j)) state.dragRightZones.push(j)
            }
        }

        // Capture usable size at drag start
        state.dragUsableSize = segment.orientation === 'vertical' ? state.monitor.width : state.monitor.height

        // Capture original zone sizes for absolute positioning
        state.dragOriginalSizes.clear()
        for (const i of [...state.dragLeftZones, ...state.dragRightZones]) {
            const zone = state.currentLayout.zones[i]
            const size = segment.orientation === 'vertical' ? zone.width : zone.height
            state.dragOriginalSizes.set(i, size)
        }
    })
    splitterBox.add_controller(clickGesture)

    return splitterBox
}

// Find zones connected along a line
function findZonesAlongLine(startIdx: number, linePos: number, orientation: 'vertical' | 'horizontal', side: 'left' | 'right'): number[] {
    const eps = 0.01
    const result = new Set<number>([startIdx])
    let changed = true

    while (changed) {
        changed = false
        for (let i = 0; i < state.currentLayout.zones.length; i++) {
            if (result.has(i)) continue
            const zone = state.currentLayout.zones[i]

            // Is this zone at the same line?
            const atLine = orientation === 'vertical'
                ? (side === 'left'
                    ? Math.abs((zone.x + zone.width) - linePos) < eps
                    : Math.abs(zone.x - linePos) < eps)
                : (side === 'left'
                    ? Math.abs((zone.y + zone.height) - linePos) < eps
                    : Math.abs(zone.y - linePos) < eps)

            if (!atLine) continue

            // Check if this zone touches a connected zone ALONG the line
            for (const ci of result) {
                const connected = state.currentLayout.zones[ci]
                if (orientation === 'vertical') {
                    const touch = Math.abs((zone.y + zone.height) - connected.y) < eps ||
                                  Math.abs((connected.y + connected.height) - zone.y) < eps
                    if (touch) {
                        result.add(i)
                        changed = true
                        break
                    }
                } else {
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

// Move splitter to absolute position based on delta from drag start
export function moveSplitterAbsolute(segment: SplitterSegment, totalDelta: number) {
    const monitorSize = segment.orientation === 'vertical' ? state.monitor.width : state.monitor.height
    const MIN_SIZE = 200 / monitorSize

    // Calculate limits based on ORIGINAL sizes (not current)
    let minDelta = -Infinity
    let maxDelta = Infinity

    for (const i of state.dragLeftZones) {
        const originalSize = state.dragOriginalSizes.get(i) || 0
        minDelta = Math.max(minDelta, MIN_SIZE - originalSize)
    }

    for (const i of state.dragRightZones) {
        const originalSize = state.dragOriginalSizes.get(i) || 0
        maxDelta = Math.min(maxDelta, originalSize - MIN_SIZE)
    }

    const clampedDelta = Math.max(minDelta, Math.min(maxDelta, totalDelta))

    // Reset zones to original sizes and apply clamped delta
    for (const i of state.dragLeftZones) {
        const zone = state.currentLayout.zones[i]
        const originalSize = state.dragOriginalSizes.get(i) || 0
        if (segment.orientation === 'vertical') {
            zone.width = originalSize + clampedDelta
        } else {
            zone.height = originalSize + clampedDelta
        }
    }

    for (const i of state.dragRightZones) {
        const zone = state.currentLayout.zones[i]
        const originalSize = state.dragOriginalSizes.get(i) || 0
        if (segment.orientation === 'vertical') {
            zone.x = state.dragStartSplitterPos + clampedDelta
            zone.width = originalSize - clampedDelta
        } else {
            zone.y = state.dragStartSplitterPos + clampedDelta
            zone.height = originalSize - clampedDelta
        }
    }

    state.markChanged()
    if (updateDisplayCallback) {
        updateDisplayCallback()
    }
}

// Handle window-level motion for splitter dragging
export function handleSplitterMotion(x: number, y: number) {
    if (!state.activeDragSegment) return

    // Calculate mouse position as percentage of usable area
    const mouseInUsable = state.activeDragSegment.orientation === 'vertical'
        ? x - state.monitor.x
        : y - state.monitor.y
    const mousePercent = mouseInUsable / state.dragUsableSize

    // Delta from original splitter position to current mouse position
    const percentDelta = mousePercent - state.dragStartSplitterPos

    moveSplitterAbsolute(state.activeDragSegment, percentDelta)
}

// Handle drag release
export function handleSplitterRelease() {
    if (state.activeDragSegment) {
        if (state.activeDragWidget) {
            state.activeDragWidget.get_style_context().remove_class("dragging")
        }
        state.resetDragState()
    }
}
