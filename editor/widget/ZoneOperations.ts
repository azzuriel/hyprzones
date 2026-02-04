// ZoneOperations - Zone split and merge operations

import { Zone } from "../models/Layout"
import { state } from "../state/EditorState"

// Callback for zone display update
let updateDisplayCallback: (() => void) | null = null

export function setUpdateDisplayCallback(callback: () => void) {
    updateDisplayCallback = callback
}

// Split a zone in half
export function splitZone(zone: Zone, direction: 'horizontal' | 'vertical') {
    const zones = state.currentLayout.zones
    const idx = zones.findIndex(z => z.index === zone.index)
    if (idx === -1) return

    // Create new zone in second half
    const newIndex = Math.max(...zones.map(z => z.index)) + 1

    if (direction === 'vertical') {
        // Split left/right
        const newWidth = zone.width / 2
        zone.width = newWidth

        zones.push({
            index: newIndex,
            name: `Zone ${newIndex + 1}`,
            x: zone.x + newWidth,
            y: zone.y,
            width: newWidth,
            height: zone.height
        })
    } else {
        // Split top/bottom
        const newHeight = zone.height / 2
        zone.height = newHeight

        zones.push({
            index: newIndex,
            name: `Zone ${newIndex + 1}`,
            x: zone.x,
            y: zone.y + newHeight,
            width: zone.width,
            height: newHeight
        })
    }

    state.markChanged()
    if (updateDisplayCallback) {
        updateDisplayCallback()
    }
}

// Find a zone that can be merged with this one
export function findMergeableNeighbor(zone: Zone): Zone | null {
    const zones = state.currentLayout.zones
    const eps = 0.01

    for (const other of zones) {
        if (other.index === zone.index) continue

        // Check if they share a full edge and can form a rectangle
        // Right edge of zone touches left edge of other (same height)
        if (Math.abs((zone.x + zone.width) - other.x) < eps &&
            Math.abs(zone.y - other.y) < eps &&
            Math.abs(zone.height - other.height) < eps) {
            return other
        }
        // Left edge of zone touches right edge of other
        if (Math.abs(zone.x - (other.x + other.width)) < eps &&
            Math.abs(zone.y - other.y) < eps &&
            Math.abs(zone.height - other.height) < eps) {
            return other
        }
        // Bottom edge of zone touches top edge of other (same width)
        if (Math.abs((zone.y + zone.height) - other.y) < eps &&
            Math.abs(zone.x - other.x) < eps &&
            Math.abs(zone.width - other.width) < eps) {
            return other
        }
        // Top edge of zone touches bottom edge of other
        if (Math.abs(zone.y - (other.y + other.height)) < eps &&
            Math.abs(zone.x - other.x) < eps &&
            Math.abs(zone.width - other.width) < eps) {
            return other
        }
    }
    return null
}

// Merge two zones into one
export function mergeZones(zone: Zone, neighbor: Zone) {
    const zones = state.currentLayout.zones
    const eps = 0.01

    // Determine merge direction and expand zone
    if (Math.abs((zone.x + zone.width) - neighbor.x) < eps ||
        Math.abs(zone.x - (neighbor.x + neighbor.width)) < eps) {
        // Horizontal merge
        zone.x = Math.min(zone.x, neighbor.x)
        zone.width = zone.width + neighbor.width
    } else {
        // Vertical merge
        zone.y = Math.min(zone.y, neighbor.y)
        zone.height = zone.height + neighbor.height
    }

    // Remove neighbor
    const neighborIdx = zones.findIndex(z => z.index === neighbor.index)
    if (neighborIdx !== -1) {
        zones.splice(neighborIdx, 1)
    }

    state.markChanged()
    if (updateDisplayCallback) {
        updateDisplayCallback()
    }
}

// Reset layout to single zone
export function resetLayout() {
    state.currentLayout = {
        name: state.currentLayout.name,
        spacingH: state.currentLayout.spacingH,
        spacingV: state.currentLayout.spacingV,
        zones: [{
            index: 0,
            name: 'Zone 1',
            x: 0,
            y: 0,
            width: 1,
            height: 1
        }]
    }
    state.markChanged()
    if (updateDisplayCallback) {
        updateDisplayCallback()
    }
}
