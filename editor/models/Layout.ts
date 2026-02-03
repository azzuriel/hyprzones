// Layout data model - Single Source of Truth for zone definitions

export interface Zone {
    index: number;
    name: string;
    x: number;      // 0.0 - 1.0 percentage
    y: number;
    width: number;
    height: number;
}

export interface Layout {
    name: string;
    zones: Zone[];
    spacing: number;
}

export interface GridLine {
    position: number;   // 0.0 - 1.0
    orientation: 'horizontal' | 'vertical';
    index: number;
}

export function cloneLayout(layout: Layout): Layout {
    return {
        name: layout.name,
        spacing: layout.spacing,
        zones: layout.zones.map(z => ({ ...z }))
    };
}

export function getGridLines(zones: Zone[]): GridLine[] {
    const xLines = new Set<number>();
    const yLines = new Set<number>();

    for (const zone of zones) {
        xLines.add(zone.x);
        xLines.add(zone.x + zone.width);
        yLines.add(zone.y);
        yLines.add(zone.y + zone.height);
    }

    const lines: GridLine[] = [];
    let idx = 0;

    // Vertical lines (x positions) - skip edges
    [...xLines].sort((a, b) => a - b).forEach(x => {
        if (x > 0.001 && x < 0.999) {
            lines.push({ position: x, orientation: 'vertical', index: idx++ });
        }
    });

    // Horizontal lines (y positions) - skip edges
    [...yLines].sort((a, b) => a - b).forEach(y => {
        if (y > 0.001 && y < 0.999) {
            lines.push({ position: y, orientation: 'horizontal', index: idx++ });
        }
    });

    return lines;
}
