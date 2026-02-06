// ZoneEditor - Main zone editor widget using GTK layer shell
// AGS v3 imperative GTK4 style with bounded splitter segments

import { Gtk, Gdk } from "ags/gtk4"
import Gtk4LayerShell from "gi://Gtk4LayerShell"
import { Zone, cloneLayout, getSplitterSegments } from "../models/Layout"
import { PixelRect, zoneToPixels, splitterToPixels, collectGridBoundaries } from "../utils/geometry"
import { loadLayoutFromConfig, loadLayoutByName, getActiveLayoutName } from "../services/LayoutService"
import { state, DEFAULT_LAYOUT, SPLITTER_THICKNESS } from "../state/EditorState"
import { getMonitorGeometry } from "../services/MonitorService"
import { createSplitterWidget, handleSplitterMotion, handleSplitterRelease } from "./Splitter"
import { splitZone, findMergeableNeighbor, mergeZones } from "./ZoneOperations"
import { createToolbar, setToolbarCallbacks } from "./Toolbar"
import { showLayoutPanel, hideLayoutPanel, setLayoutPanelCallbacks } from "./LayoutPanel"
import { setUpdateDisplayCallback as setSplitterUpdateCallback } from "./Splitter"
import { setUpdateDisplayCallback as setZoneOpsUpdateCallback } from "./ZoneOperations"

// Find the GDK monitor matching a Hyprland monitor connector name
function findGdkMonitor(connectorName: string): Gdk.Monitor | null {
    const display = Gdk.Display.get_default()
    if (!display) return null

    const monitors = display.get_monitors()
    for (let i = 0; i < monitors.get_n_items(); i++) {
        const mon = monitors.get_item(i) as Gdk.Monitor | null
        if (mon && mon.get_connector() === connectorName) {
            return mon
        }
    }
    return null
}

// Reload layout for current monitor/workspace (called when editor is shown)
export async function reloadCurrentLayout(): Promise<void> {
    const focusedMonitor = state.allMonitors.find(m => m.focused) || state.allMonitors[0]
    if (focusedMonitor) {
        state.monitor = await getMonitorGeometry()

        // Switch LayerShell to focused monitor - hide/show to force remap and resize
        if (state.editorWindow) {
            const gdkMonitor = findGdkMonitor(state.selectedMonitorName)
            if (gdkMonitor) {
                state.editorWindow.hide()
                Gtk4LayerShell.set_monitor(state.editorWindow, gdkMonitor)
                if (state.zoneContainer) {
                    state.zoneContainer.set_size_request(state.fullScreenWidth, state.fullScreenHeight)
                }
                state.editorWindow.show()
            }
        }

        const workspaceId = focusedMonitor.activeWorkspace?.id || 1
        const mappedLayoutName = getActiveLayoutName(state.selectedMonitorName, workspaceId)

        let loadedLayout = mappedLayoutName ? loadLayoutByName(mappedLayoutName) : null
        if (!loadedLayout) {
            loadedLayout = loadLayoutFromConfig()
        }
        state.currentLayout = cloneLayout(loadedLayout || state.currentLayout)
        state.originalLayout = cloneLayout(state.currentLayout)
        state.hasChanges = false
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
    if (!state.zoneContainer) return

    removeAllChildren(state.zoneContainer)

    const gridBounds = collectGridBoundaries(state.currentLayout.zones)
    const topOffset = state.monitor.y

    // Draw zones
    for (const zone of state.currentLayout.zones) {
        const rect = zoneToPixels(zone, state.monitor, state.currentLayout.spacingH, state.currentLayout.spacingV, gridBounds)
        const zoneWidget = createZoneWidget(zone, rect)
        state.zoneContainer.put(zoneWidget, state.monitor.x + rect.x, topOffset + rect.y)
    }

    // Draw bounded splitters
    const splitterSegments = getSplitterSegments(state.currentLayout.zones)
    for (const segment of splitterSegments) {
        const pixelSplitter = splitterToPixels(segment, state.monitor, state.currentLayout.spacingH, state.currentLayout.spacingV, gridBounds, SPLITTER_THICKNESS)
        const splitter = createSplitterWidget(pixelSplitter)
        state.zoneContainer.put(splitter, state.monitor.x + pixelSplitter.x, topOffset + pixelSplitter.y)
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

    // Vertical split button (split left/right)
    if (canSplitV) {
        const splitVBtn = new Gtk.Button({ label: "|" })
        splitVBtn.set_size_request(ZONE_BTN_SIZE, ZONE_BTN_SIZE)
        splitVBtn.get_style_context().add_class("zone-split-btn")
        splitVBtn.set_tooltip_text("Split vertically")
        splitVBtn.connect("clicked", () => splitZone(zone, 'vertical'))
        buttonBox.append(splitVBtn)
    }

    // Horizontal split button (split top/bottom)
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
    if (mergeTarget && state.currentLayout.zones.length > 1) {
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

export default async function ZoneEditor(): Promise<Gtk.Window> {
    // Get monitor info
    try {
        state.monitor = await getMonitorGeometry()
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

    // Load layout for current monitor/workspace
    const focusedMonitor = state.allMonitors.find(m => m.focused) || state.allMonitors[0]
    const workspaceId = focusedMonitor?.activeWorkspace?.id || 1
    const mappedLayoutName = getActiveLayoutName(state.selectedMonitorName, workspaceId)

    let loadedLayout = mappedLayoutName ? loadLayoutByName(mappedLayoutName) : null
    if (!loadedLayout) {
        loadedLayout = loadLayoutFromConfig()
    }
    state.currentLayout = cloneLayout(loadedLayout || DEFAULT_LAYOUT)
    state.originalLayout = cloneLayout(state.currentLayout)
    state.hasChanges = false

    // Set up callbacks for modules
    setSplitterUpdateCallback(updateZoneDisplay)
    setZoneOpsUpdateCallback(updateZoneDisplay)
    setToolbarCallbacks({
        showLayoutPanel,
        updateDisplay: updateZoneDisplay
    })
    setLayoutPanelCallbacks({
        updateDisplay: updateZoneDisplay,
        hide: hideLayoutPanel
    })

    // Create layer shell window (fullscreen)
    const win = new Gtk.Window({
        title: "HyprZones Editor",
        default_width: state.fullScreenWidth,
        default_height: state.fullScreenHeight,
        decorated: false,
        resizable: false,
    })

    win.get_style_context().add_class("zone-editor")
    state.editorWindow = win

    // Initialize layer shell
    try {
        Gtk4LayerShell.init_for_window(win)
        Gtk4LayerShell.set_layer(win, Gtk4LayerShell.Layer.OVERLAY)
        const gdkMonitor = findGdkMonitor(state.selectedMonitorName)
        if (gdkMonitor) {
            Gtk4LayerShell.set_monitor(win, gdkMonitor)
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

    // Keyboard handling (Escape to close)
    const keyController = new Gtk.EventControllerKey()
    keyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
    keyController.connect("key-pressed", (_controller: Gtk.EventControllerKey, keyval: number) => {
        if (keyval === Gdk.KEY_Escape) {
            // First close config panel if open AND VISIBLE
            if (state.layoutPanel && state.layoutPanel.get_visible()) {
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

    // Window-level drag handling for splitters
    const winMotionController = new Gtk.EventControllerMotion()
    winMotionController.connect("motion", (_controller: Gtk.EventControllerMotion, x: number, y: number) => {
        handleSplitterMotion(x, y)
    })
    win.add_controller(winMotionController)

    // Window-level button release handling
    const winClickGesture = new Gtk.GestureClick()
    winClickGesture.set_button(0)
    winClickGesture.connect("released", () => {
        handleSplitterRelease()
    })
    win.add_controller(winClickGesture)

    // Create main layout
    state.mainOverlay = new Gtk.Overlay()
    state.mainOverlay.get_style_context().add_class("editor-backdrop")

    // Zone container (fixed positioning for absolute placement - fullscreen)
    state.zoneContainer = new Gtk.Fixed()
    state.zoneContainer.set_size_request(state.fullScreenWidth, state.fullScreenHeight)
    state.mainOverlay.set_child(state.zoneContainer)

    // Toolbar at bottom - must be on top of zones
    const toolbarWrapper = new Gtk.Box({
        orientation: Gtk.Orientation.VERTICAL,
        valign: Gtk.Align.END,
        halign: Gtk.Align.CENTER,
        margin_bottom: 30,
    })
    toolbarWrapper.append(createToolbar())
    state.mainOverlay.add_overlay(toolbarWrapper)

    win.set_child(state.mainOverlay)

    // Initial zone display
    updateZoneDisplay()

    return win
}
