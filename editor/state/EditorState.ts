// EditorState - Central state management for the zone editor
// Single Source of Truth for all editor state

import { Gtk } from "ags/gtk4"
import { Layout, Zone, SplitterSegment, cloneLayout } from "../models/Layout"
import { MonitorGeometry } from "../utils/geometry"

// Monitor info from Hyprland
export interface HyprMonitor {
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

// Default layout if none exists
export const DEFAULT_LAYOUT: Layout = {
    name: 'default',
    spacingH: 10,
    spacingV: 40,
    zones: [
        { index: 0, name: 'Left', x: 0, y: 0, width: 0.5, height: 1 },
        { index: 1, name: 'Right', x: 0.5, y: 0, width: 0.5, height: 1 }
    ]
}

// Constants
export const WINDOW_NAME = "hyprzones-editor"
export const SPLITTER_THICKNESS = 3

// Screen margins (waybar + gaps) - fixed offsets for ALL monitors
export const MARGIN_TOP = 97
export const MARGIN_BOTTOM = 22
export const MARGIN_LEFT = 22
export const MARGIN_RIGHT = 22

// Central state store
class EditorStateStore {
    // Window
    editorWindow: Gtk.Window | null = null

    // Layout state
    currentLayout: Layout = cloneLayout(DEFAULT_LAYOUT)
    originalLayout: Layout = cloneLayout(DEFAULT_LAYOUT)
    hasChanges: boolean = false

    // Monitor state
    allMonitors: HyprMonitor[] = []
    selectedMonitorName: string = ""
    monitor: MonitorGeometry = { x: 0, y: 0, width: 1920, height: 1080 }
    fullScreenWidth: number = 1920
    fullScreenHeight: number = 1080

    // Drag state
    activeDragSegment: SplitterSegment | null = null
    activeDragWidget: Gtk.Box | null = null
    dragStartMousePos: number = 0
    dragStartSplitterPos: number = 0
    dragLeftZones: number[] = []
    dragRightZones: number[] = []
    dragOriginalSizes: Map<number, number> = new Map()
    dragUsableSize: number = 0

    // UI elements
    zoneContainer: Gtk.Fixed | null = null
    mainOverlay: Gtk.Overlay | null = null

    // Layout panel state
    layoutPanel: Gtk.Box | null = null
    layoutNameEntry: Gtk.Entry | null = null
    layoutFlowBox: Gtk.FlowBox | null = null
    layoutSearchEntry: Gtk.SearchEntry | null = null
    mappingsFlowBox: Gtk.FlowBox | null = null
    mappingsSearchEntry: Gtk.SearchEntry | null = null
    selectedOldName: string | null = null
    selectedMappingLayout: string = ""
    mappingLayoutButton: Gtk.Button | null = null
    mappingLayoutDropdownList: Gtk.FlowBox | null = null

    // Callbacks for UI updates
    private updateCallbacks: (() => void)[] = []

    // Register a callback to be called when state changes
    onUpdate(callback: () => void) {
        this.updateCallbacks.push(callback)
    }

    // Notify all registered callbacks
    notifyUpdate() {
        for (const callback of this.updateCallbacks) {
            callback()
        }
    }

    // Mark layout as changed
    markChanged() {
        this.hasChanges = true
    }

    // Reset drag state
    resetDragState() {
        this.activeDragSegment = null
        this.activeDragWidget = null
        this.dragStartMousePos = 0
        this.dragStartSplitterPos = 0
        this.dragLeftZones = []
        this.dragRightZones = []
        this.dragOriginalSizes.clear()
        this.dragUsableSize = 0
    }

    // Set current layout
    setLayout(layout: Layout) {
        this.currentLayout = layout
        this.originalLayout = cloneLayout(layout)
        this.hasChanges = false
    }

    // Reset to original layout
    resetLayout() {
        this.currentLayout = cloneLayout(this.originalLayout)
        this.hasChanges = false
    }
}

// Singleton instance
export const state = new EditorStateStore()
