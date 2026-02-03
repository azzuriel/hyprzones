// Geometry calculations for zone positioning

import { Zone, GridLine } from '../models/Layout';

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

export function zoneToPixels(
    zone: Zone,
    monitor: MonitorGeometry,
    spacing: number,
    gridLines: { x: number[]; y: number[] }
): PixelRect {
    const xSlots = gridLines.x.length;
    const ySlots = gridLines.y.length;

    const usableW = monitor.width - (spacing * xSlots);
    const usableH = monitor.height - (spacing * ySlots);

    const xStartIdx = gridLines.x.filter(v => v < zone.x + 0.001).length;
    const yStartIdx = gridLines.y.filter(v => v < zone.y + 0.001).length;
    const xEndIdx = gridLines.x.filter(v => v < zone.x + zone.width + 0.001).length;
    const yEndIdx = gridLines.y.filter(v => v < zone.y + zone.height + 0.001).length;

    const pixelX = (zone.x * usableW) + (spacing * (xStartIdx + 1));
    const pixelY = (zone.y * usableH) + (spacing * (yStartIdx + 1));
    const endX = ((zone.x + zone.width) * usableW) + (spacing * xEndIdx);
    const endY = ((zone.y + zone.height) * usableH) + (spacing * yEndIdx);

    return {
        x: pixelX,
        y: pixelY,
        width: endX - pixelX,
        height: endY - pixelY
    };
}

export function gridLineToPixel(
    line: GridLine,
    monitor: MonitorGeometry,
    spacing: number,
    gridLines: { x: number[]; y: number[] }
): number {
    if (line.orientation === 'vertical') {
        const xSlots = gridLines.x.length;
        const usableW = monitor.width - (spacing * xSlots);
        const idx = gridLines.x.filter(v => v < line.position + 0.001).length;
        return (line.position * usableW) + (spacing * idx);
    } else {
        const ySlots = gridLines.y.length;
        const usableH = monitor.height - (spacing * ySlots);
        const idx = gridLines.y.filter(v => v < line.position + 0.001).length;
        return (line.position * usableH) + (spacing * idx);
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
