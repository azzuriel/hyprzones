// Geometry calculations for zone positioning

import { Zone, SplitterSegment } from '../models/Layout';

export interface PixelRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface MonitorGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
}

// Splitter segment in pixel coordinates
export interface PixelSplitter {
    orientation: 'horizontal' | 'vertical';
    x: number;
    y: number;
    width: number;
    height: number;
    segment: SplitterSegment;  // Reference to original segment
}

export function collectGridBoundaries(zones: Zone[]): { x: number[]; y: number[] } {
    const xSet = new Set<number>();
    const ySet = new Set<number>();

    for (const zone of zones) {
        xSet.add(zone.x);
        xSet.add(zone.x + zone.width);
        ySet.add(zone.y);
        ySet.add(zone.y + zone.height);
    }

    return {
        x: [...xSet].sort((a, b) => a - b),
        y: [...ySet].sort((a, b) => a - b)
    };
}

export function zoneToPixels(
    zone: Zone,
    monitor: MonitorGeometry,
    spacingH: number,
    spacingV: number,
    _gridLines: { x: number[]; y: number[] }
): PixelRect {
    // Simple calculation: percentage of monitor size
    // Spacing is applied as inset on internal edges only
    // spacingH = horizontal gap line = between ROWS (affects top/bottom)
    // spacingV = vertical gap line = between COLUMNS (affects left/right)
    const halfGapH = spacingH / 2;
    const halfGapV = spacingV / 2;

    const rawX = zone.x * monitor.width;
    const rawY = zone.y * monitor.height;
    const rawW = zone.width * monitor.width;
    const rawH = zone.height * monitor.height;

    // Inset by half-gap on internal edges (not at 0 or 1)
    // V for left/right (vertical lines between columns), H for top/bottom (horizontal lines between rows)
    const leftInset = zone.x > 0.001 ? halfGapV : 0;
    const rightInset = (zone.x + zone.width) < 0.999 ? halfGapV : 0;
    const topInset = zone.y > 0.001 ? halfGapH : 0;
    const bottomInset = (zone.y + zone.height) < 0.999 ? halfGapH : 0;

    return {
        x: rawX + leftInset,
        y: rawY + topInset,
        width: rawW - leftInset - rightInset,
        height: rawH - topInset - bottomInset
    };
}

// Convert a bounded splitter segment to pixel coordinates
export function splitterToPixels(
    segment: SplitterSegment,
    monitor: MonitorGeometry,
    _spacingH: number,
    _spacingV: number,
    _gridLines: { x: number[]; y: number[] },
    handleThickness: number = 10
): PixelSplitter {
    // Simple calculation: percentage of monitor size
    if (segment.orientation === 'vertical') {
        const pixelX = segment.position * monitor.width - handleThickness / 2;
        const pixelYStart = segment.start * monitor.height;
        const pixelYEnd = segment.end * monitor.height;

        return {
            orientation: 'vertical',
            x: pixelX,
            y: pixelYStart,
            width: handleThickness,
            height: pixelYEnd - pixelYStart,
            segment
        };
    } else {
        const pixelY = segment.position * monitor.height - handleThickness / 2;
        const pixelXStart = segment.start * monitor.width;
        const pixelXEnd = segment.end * monitor.width;

        return {
            orientation: 'horizontal',
            x: pixelXStart,
            y: pixelY,
            width: pixelXEnd - pixelXStart,
            height: handleThickness,
            segment
        };
    }
}

export function pixelToPercent(
    pixel: number,
    totalSize: number,
    spacing: number,
    slots: number
): number {
    const usable = totalSize - (spacing * slots);
    return Math.max(0, Math.min(1, pixel / usable));
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}
