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
    monitor?: string;    // Monitor name (e.g. "HDMI-A-1"), empty = all monitors
    workspace?: number;  // Workspace ID, undefined = all workspaces
}

// A splitter segment - bounded line that separates adjacent zones
export interface SplitterSegment {
    orientation: 'horizontal' | 'vertical';
    position: number;       // x for vertical, y for horizontal (0.0 - 1.0)
    start: number;          // start bound (y for vertical, x for horizontal)
    end: number;            // end bound
    leftZones: number[];    // zone indices on left/top side
    rightZones: number[];   // zone indices on right/bottom side
}

export function cloneLayout(layout: Layout): Layout {
    return {
        name: layout.name,
        spacing: layout.spacing,
        monitor: layout.monitor,
        workspace: layout.workspace,
        zones: layout.zones.map(z => ({ ...z }))
    };
}

// Find splitter segments at shared zone boundaries
// Each splitter only controls the boundary between exactly two adjacent zones
export function getSplitterSegments(zones: Zone[]): SplitterSegment[] {
    const segments: SplitterSegment[] = [];
    const epsilon = 0.001;

    // For each pair of zones, check if they share an edge
    for (let i = 0; i < zones.length; i++) {
        for (let j = i + 1; j < zones.length; j++) {
            const a = zones[i];
            const b = zones[j];

            // Check for vertical edge (zones side by side)
            // A's right edge touches B's left edge
            if (Math.abs((a.x + a.width) - b.x) < epsilon) {
                const overlapStart = Math.max(a.y, b.y);
                const overlapEnd = Math.min(a.y + a.height, b.y + b.height);
                if (overlapEnd - overlapStart > epsilon) {
                    // Each pair gets its own splitter - no merging
                    segments.push({
                        orientation: 'vertical',
                        position: a.x + a.width,
                        start: overlapStart,
                        end: overlapEnd,
                        leftZones: [i],
                        rightZones: [j]
                    });
                }
            }
            // B's right edge touches A's left edge
            if (Math.abs((b.x + b.width) - a.x) < epsilon) {
                const overlapStart = Math.max(a.y, b.y);
                const overlapEnd = Math.min(a.y + a.height, b.y + b.height);
                if (overlapEnd - overlapStart > epsilon) {
                    segments.push({
                        orientation: 'vertical',
                        position: b.x + b.width,
                        start: overlapStart,
                        end: overlapEnd,
                        leftZones: [j],
                        rightZones: [i]
                    });
                }
            }

            // Check for horizontal edge (zones stacked)
            // A's bottom edge touches B's top edge
            if (Math.abs((a.y + a.height) - b.y) < epsilon) {
                const overlapStart = Math.max(a.x, b.x);
                const overlapEnd = Math.min(a.x + a.width, b.x + b.width);
                if (overlapEnd - overlapStart > epsilon) {
                    segments.push({
                        orientation: 'horizontal',
                        position: a.y + a.height,
                        start: overlapStart,
                        end: overlapEnd,
                        leftZones: [i],
                        rightZones: [j]
                    });
                }
            }
            // B's bottom edge touches A's top edge
            if (Math.abs((b.y + b.height) - a.y) < epsilon) {
                const overlapStart = Math.max(a.x, b.x);
                const overlapEnd = Math.min(a.x + a.width, b.x + b.width);
                if (overlapEnd - overlapStart > epsilon) {
                    segments.push({
                        orientation: 'horizontal',
                        position: b.y + b.height,
                        start: overlapStart,
                        end: overlapEnd,
                        leftZones: [j],
                        rightZones: [i]
                    });
                }
            }
        }
    }

    return segments;
}

