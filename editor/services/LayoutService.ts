// Layout persistence - load/save layouts from config file

import GLib from "gi://GLib"
import { Layout, Zone, LayoutMapping } from '../models/Layout';

const CONFIG_PATH = GLib.get_home_dir() + '/.config/hypr/hyprzones.toml';

export function loadAllLayouts(): Layout[] {
    try {
        const [ok, contents] = GLib.file_get_contents(CONFIG_PATH);
        if (ok && contents) {
            const content = new TextDecoder().decode(contents);
            return parseAllTomlLayouts(content);
        }
    } catch (e) {
        console.error('Failed to load config:', e);
    }
    return [];
}

export function loadLayoutFromConfig(): Layout | null {
    const layouts = loadAllLayouts();
    return layouts.length > 0 ? layouts[0] : null;
}

export function loadLayoutByName(name: string): Layout | null {
    const layouts = loadAllLayouts();
    return layouts.find(l => l.name === name) || null;
}

export function getLayoutNames(): string[] {
    return loadAllLayouts().map(l => l.name);
}

export function saveLayoutToConfig(layout: Layout, overwrite: boolean = true): boolean {
    try {
        const layouts = loadAllLayouts();
        const existingIndex = layouts.findIndex(l => l.name === layout.name);

        if (existingIndex >= 0) {
            if (overwrite) {
                layouts[existingIndex] = layout;
            } else {
                return false;
            }
        } else {
            layouts.push(layout);
        }

        const mappings = loadAllMappings();
        const content = configToToml(layouts, mappings);
        const encoder = new TextEncoder();
        GLib.file_set_contents(CONFIG_PATH, encoder.encode(content));
        return true;
    } catch (e) {
        console.error('Failed to save config:', e);
        return false;
    }
}

export function deleteLayout(name: string): boolean {
    try {
        const layouts = loadAllLayouts();
        const filtered = layouts.filter(l => l.name !== name);
        if (filtered.length === layouts.length) return false;

        const mappings = loadAllMappings();
        const content = configToToml(filtered, mappings);
        const encoder = new TextEncoder();
        GLib.file_set_contents(CONFIG_PATH, encoder.encode(content));
        return true;
    } catch (e) {
        console.error('Failed to delete layout:', e);
        return false;
    }
}

// Mapping functions
export function loadAllMappings(): LayoutMapping[] {
    try {
        const [ok, contents] = GLib.file_get_contents(CONFIG_PATH);
        if (ok && contents) {
            const content = new TextDecoder().decode(contents);
            return parseAllTomlMappings(content);
        }
    } catch (e) {
        console.error('Failed to load mappings:', e);
    }
    return [];
}

export function saveMappings(mappings: LayoutMapping[]): boolean {
    try {
        const layouts = loadAllLayouts();
        const content = configToToml(layouts, mappings);
        const encoder = new TextEncoder();
        GLib.file_set_contents(CONFIG_PATH, encoder.encode(content));
        return true;
    } catch (e) {
        console.error('Failed to save mappings:', e);
        return false;
    }
}

export function addMapping(mapping: LayoutMapping): boolean {
    const mappings = loadAllMappings();
    mappings.push(mapping);
    return saveMappings(mappings);
}

export function removeMapping(index: number): boolean {
    const mappings = loadAllMappings();
    if (index < 0 || index >= mappings.length) return false;
    mappings.splice(index, 1);
    return saveMappings(mappings);
}

export function updateMapping(index: number, mapping: LayoutMapping): boolean {
    const mappings = loadAllMappings();
    if (index < 0 || index >= mappings.length) return false;
    mappings[index] = mapping;
    return saveMappings(mappings);
}

export function getActiveLayoutName(monitorName: string, workspaceId: number): string | null {
    const mappings = loadAllMappings();

    // First pass: look for specific workspace match
    for (const mapping of mappings) {
        if (mapping.monitor !== monitorName) continue;

        const ws = mapping.workspaces;
        if (ws === '*') continue;  // Skip wildcard in first pass

        // Check if workspace matches
        const wsNumbers = ws.split(',').map(s => s.trim());
        if (wsNumbers.includes(String(workspaceId))) {
            return mapping.layout;
        }
    }

    // Second pass: look for wildcard match
    for (const mapping of mappings) {
        if (mapping.monitor !== monitorName) continue;
        if (mapping.workspaces === '*') {
            return mapping.layout;
        }
    }

    return null;
}

function parseAllTomlLayouts(content: string): Layout[] {
    const layouts: Layout[] = [];
    let currentLayout: Layout | null = null;
    let currentZone: Partial<Zone> | null = null;
    let zoneIndex = 0;

    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // New layout section
        if (trimmed === '[[layouts]]') {
            // Save previous layout
            if (currentLayout) {
                if (currentZone && currentZone.name) {
                    currentLayout.zones.push(currentZone as Zone);
                }
                if (currentLayout.zones.length > 0) {
                    layouts.push(currentLayout);
                }
            }
            currentLayout = { name: 'unnamed', spacingH: 40, spacingV: 10, zones: [] };
            currentZone = null;
            zoneIndex = 0;
            continue;
        }

        // Zone section within layout
        if (trimmed === '[[layouts.zones]]') {
            if (!currentLayout) continue;

            if (currentZone && currentZone.name) {
                currentLayout.zones.push(currentZone as Zone);
            }
            currentZone = { index: zoneIndex++ };
            continue;
        }

        // Parse key=value
        const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (match && currentLayout) {
            const [, key, value] = match;
            const cleanValue = value.replace(/"/g, '').trim();

            if (currentZone) {
                switch (key) {
                    case 'name': currentZone.name = cleanValue; break;
                    case 'x': currentZone.x = parseFloat(cleanValue) / 100; break;
                    case 'y': currentZone.y = parseFloat(cleanValue) / 100; break;
                    case 'width': currentZone.width = parseFloat(cleanValue) / 100; break;
                    case 'height': currentZone.height = parseFloat(cleanValue) / 100; break;
                }
            } else {
                switch (key) {
                    case 'name': currentLayout.name = cleanValue; break;
                    case 'spacing_h': currentLayout.spacingH = parseInt(cleanValue); break;
                    case 'spacing_v': currentLayout.spacingV = parseInt(cleanValue); break;
                }
            }
        }
    }

    // Save last layout
    if (currentLayout) {
        if (currentZone && currentZone.name) {
            currentLayout.zones.push(currentZone as Zone);
        }
        if (currentLayout.zones.length > 0) {
            layouts.push(currentLayout);
        }
    }

    return layouts;
}

// Normalize layout boundaries to prevent floating point errors
// Uses 0.1% precision (1000 units) for pixel-accurate positioning
function normalizeLayout(layout: Layout): Layout {
    const zones = layout.zones.map(z => ({ ...z }))

    // Step 1: Round everything to 0.1% precision
    for (const zone of zones) {
        zone.x = Math.round(zone.x * 1000) / 1000
        zone.y = Math.round(zone.y * 1000) / 1000
        zone.width = Math.round(zone.width * 1000) / 1000
        zone.height = Math.round(zone.height * 1000) / 1000
    }

    // Step 2: Collect all boundary positions (0.1% precision = multiply by 1000)
    const xStarts = zones.map(z => Math.round(z.x * 1000))
    const xEnds = zones.map(z => Math.round((z.x + z.width) * 1000))
    const yStarts = zones.map(z => Math.round(z.y * 1000))
    const yEnds = zones.map(z => Math.round((z.y + z.height) * 1000))

    // Step 3: For each end boundary, find the CLOSEST start boundary within 0.5%
    // If so, adjust the width/height to match exactly
    const SNAP_THRESHOLD = 5  // 0.5% in 1000-units
    for (let i = 0; i < zones.length; i++) {
        const zone = zones[i]
        const xEnd = Math.round((zone.x + zone.width) * 1000)
        const yEnd = Math.round((zone.y + zone.height) * 1000)
        const zoneXStart = Math.round(zone.x * 1000)
        const zoneYStart = Math.round(zone.y * 1000)

        // Find closest x start boundary
        let closestX = xEnd
        let closestXDist = Infinity
        for (const xStart of xStarts) {
            if (xStart > zoneXStart && xStart !== xEnd) {
                const dist = Math.abs(xStart - xEnd)
                if (dist <= SNAP_THRESHOLD && dist < closestXDist) {
                    closestX = xStart
                    closestXDist = dist
                }
            }
        }
        if (closestXDist <= SNAP_THRESHOLD) {
            zone.width = (closestX - zoneXStart) / 1000
        }

        // Find closest y start boundary
        let closestY = yEnd
        let closestYDist = Infinity
        for (const yStart of yStarts) {
            if (yStart > zoneYStart && yStart !== yEnd) {
                const dist = Math.abs(yStart - yEnd)
                if (dist <= SNAP_THRESHOLD && dist < closestYDist) {
                    closestY = yStart
                    closestYDist = dist
                }
            }
        }
        if (closestYDist <= SNAP_THRESHOLD) {
            zone.height = (closestY - zoneYStart) / 1000
        }
    }

    // Step 4: Snap to edges (0 and 100%)
    for (const zone of zones) {
        if (zone.x <= 0.005) zone.x = 0
        if (zone.y <= 0.005) zone.y = 0

        const right = zone.x + zone.width
        const bottom = zone.y + zone.height
        if (right >= 0.995) zone.width = 1 - zone.x
        if (bottom >= 0.995) zone.height = 1 - zone.y
    }

    // Step 5: Final rounding to 0.1% precision
    for (const zone of zones) {
        zone.x = Math.round(zone.x * 1000) / 1000
        zone.y = Math.round(zone.y * 1000) / 1000
        zone.width = Math.round(zone.width * 1000) / 1000
        zone.height = Math.round(zone.height * 1000) / 1000
    }

    return { ...layout, zones }
}

function parseAllTomlMappings(content: string): LayoutMapping[] {
    const mappings: LayoutMapping[] = [];
    let currentMapping: Partial<LayoutMapping> | null = null;

    const lines = content.split('\n');

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // New mapping section
        if (trimmed === '[[mappings]]') {
            if (currentMapping && currentMapping.monitor && currentMapping.layout) {
                mappings.push(currentMapping as LayoutMapping);
            }
            currentMapping = { workspaces: '*' };
            continue;
        }

        // Skip non-mapping sections
        if (trimmed.startsWith('[[') && trimmed !== '[[mappings]]') {
            if (currentMapping && currentMapping.monitor && currentMapping.layout) {
                mappings.push(currentMapping as LayoutMapping);
            }
            currentMapping = null;
            continue;
        }

        // Parse key=value
        const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (match && currentMapping) {
            const [, key, value] = match;
            const cleanValue = value.replace(/"/g, '').trim();

            switch (key) {
                case 'monitor': currentMapping.monitor = cleanValue; break;
                case 'workspaces': currentMapping.workspaces = cleanValue; break;
                case 'layout': currentMapping.layout = cleanValue; break;
            }
        }
    }

    // Save last mapping
    if (currentMapping && currentMapping.monitor && currentMapping.layout) {
        mappings.push(currentMapping as LayoutMapping);
    }

    return mappings;
}

function configToToml(layouts: Layout[], mappings: LayoutMapping[]): string {
    let content = '';

    // Write layouts
    for (const layout of layouts) {
        const normalized = normalizeLayout(layout)

        content += '[[layouts]]\n';
        content += `name = "${normalized.name}"\n`;
        content += `spacing_h = ${normalized.spacingH}\n`;
        content += `spacing_v = ${normalized.spacingV}\n`;

        for (const zone of normalized.zones) {
            content += '\n[[layouts.zones]]\n';
            content += `name = "${zone.name}"\n`;
            // Use 1 decimal place (0.1% precision) for pixel-accurate positioning
            content += `x = ${Math.round(zone.x * 1000) / 10}\n`;
            content += `y = ${Math.round(zone.y * 1000) / 10}\n`;
            content += `width = ${Math.round(zone.width * 1000) / 10}\n`;
            content += `height = ${Math.round(zone.height * 1000) / 10}\n`;
        }
        content += '\n';
    }

    // Write mappings
    if (mappings.length > 0) {
        content += '# Monitor/Workspace to Layout mappings\n';
        for (const mapping of mappings) {
            content += '[[mappings]]\n';
            content += `monitor = "${mapping.monitor}"\n`;
            content += `workspaces = "${mapping.workspaces}"\n`;
            content += `layout = "${mapping.layout}"\n`;
            content += '\n';
        }
    }

    return content;
}

function layoutsToToml(layouts: Layout[]): string {
    return configToToml(layouts, []);
}
