// MonitorService - Monitor detection and geometry calculations

import { execAsync } from "ags/process"
import { MonitorGeometry } from "../utils/geometry"
import { state, HyprMonitor, MARGIN_TOP, MARGIN_BOTTOM, MARGIN_LEFT, MARGIN_RIGHT } from "../state/EditorState"

// Fetch all monitors from Hyprland
export async function fetchAllMonitors(): Promise<HyprMonitor[]> {
    try {
        const result = await execAsync(['hyprctl', 'monitors', '-j'])
        return JSON.parse(result)
    } catch (e) {
        console.error('Failed to fetch monitors:', e)
        return []
    }
}

// Get effective dimensions accounting for rotation
export function getEffectiveDimensions(mon: HyprMonitor): { width: number, height: number } {
    const isRotated = mon.transform === 1 || mon.transform === 3 ||
                      mon.transform === 5 || mon.transform === 7
    return isRotated
        ? { width: mon.height, height: mon.width }
        : { width: mon.width, height: mon.height }
}

// Select a monitor and calculate its geometry using fixed margins
export function selectMonitor(mon: HyprMonitor): MonitorGeometry {
    state.selectedMonitorName = mon.name

    const dims = getEffectiveDimensions(mon)
    // Use logical dimensions (physical / scale) for GTK4 Layer Shell
    const scale = mon.scale > 0 ? mon.scale : 1
    const logicalWidth = Math.round(dims.width / scale)
    const logicalHeight = Math.round(dims.height / scale)
    state.fullScreenWidth = logicalWidth
    state.fullScreenHeight = logicalHeight

    // Use fixed margins (waybar + gaps)
    return {
        x: MARGIN_LEFT,
        y: MARGIN_TOP,
        width: logicalWidth - MARGIN_LEFT - MARGIN_RIGHT,
        height: logicalHeight - MARGIN_TOP - MARGIN_BOTTOM
    }
}

// Get monitor geometry - use layout's monitor or focused one
export async function getMonitorGeometry(preferMonitor?: string): Promise<MonitorGeometry> {
    state.allMonitors = await fetchAllMonitors()

    if (state.allMonitors.length === 0) {
        throw new Error("Keine Monitore gefunden!\n\nBitte zuerst nwg-displays starten um die Monitor-Konfiguration einzurichten.")
    }

    // Priority: 1. preferMonitor, 2. focused, 3. first
    let target: HyprMonitor | undefined

    if (preferMonitor) {
        target = state.allMonitors.find(m => m.name === preferMonitor)
    }
    if (!target) {
        target = state.allMonitors.find(m => m.focused)
    }
    if (!target) {
        target = state.allMonitors[0]
    }

    return selectMonitor(target)
}
