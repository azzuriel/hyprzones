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
        GLib.file_set_contents(CONFIG_PATH, content);
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
        GLib.file_set_contents(CONFIG_PATH, content);
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
        GLib.file_set_contents(CONFIG_PATH, content);
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
            currentLayout = { name: 'unnamed', spacing: 10, zones: [] };
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
                    case 'spacing': currentLayout.spacing = parseInt(cleanValue); break;
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
// Snaps shared boundaries to identical values
function normalizeLayout(layout: Layout): Layout {
    const zones = layout.zones.map(z => ({ ...z }))
    const SNAP_THRESHOLD = 0.005 // 0.5% tolerance for snapping

    // Collect all unique boundary positions
    const xBoundaries: number[] = []
    const yBoundaries: number[] = []

    for (const zone of zones) {
        xBoundaries.push(zone.x, zone.x + zone.width)
        yBoundaries.push(zone.y, zone.y + zone.height)
    }

    // Snap boundaries that are close together to the same value
    function snapValue(value: number, boundaries: number[]): number {
        for (const boundary of boundaries) {
            if (Math.abs(value - boundary) < SNAP_THRESHOLD && Math.abs(value - boundary) > 0.0001) {
                return boundary
            }
        }
        return value
    }

    // Sort boundaries so we snap to the first occurrence
    xBoundaries.sort((a, b) => a - b)
    yBoundaries.sort((a, b) => a - b)

    // Remove near-duplicates from boundaries (keep first)
    function dedupBoundaries(arr: number[]): number[] {
        const result: number[] = []
        for (const val of arr) {
            if (result.length === 0 || Math.abs(val - result[result.length - 1]) >= SNAP_THRESHOLD) {
                result.push(val)
            }
        }
        return result
    }

    const uniqueX = dedupBoundaries(xBoundaries)
    const uniqueY = dedupBoundaries(yBoundaries)

    // Snap all zone boundaries to the unique values
    for (const zone of zones) {
        const oldRight = zone.x + zone.width
        const oldBottom = zone.y + zone.height

        zone.x = snapValue(zone.x, uniqueX)
        zone.y = snapValue(zone.y, uniqueY)

        const newRight = snapValue(oldRight, uniqueX)
        const newBottom = snapValue(oldBottom, uniqueY)

        zone.width = newRight - zone.x
        zone.height = newBottom - zone.y
    }

    // Round to integer percentages for clean config
    for (const zone of zones) {
        zone.x = Math.round(zone.x * 100) / 100
        zone.y = Math.round(zone.y * 100) / 100
        zone.width = Math.round(zone.width * 100) / 100
        zone.height = Math.round(zone.height * 100) / 100
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
        content += `spacing = ${normalized.spacing}\n`;

        for (const zone of normalized.zones) {
            content += '\n[[layouts.zones]]\n';
            content += `name = "${zone.name}"\n`;
            content += `x = ${Math.round(zone.x * 100)}\n`;
            content += `y = ${Math.round(zone.y * 100)}\n`;
            content += `width = ${Math.round(zone.width * 100)}\n`;
            content += `height = ${Math.round(zone.height * 100)}\n`;
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
