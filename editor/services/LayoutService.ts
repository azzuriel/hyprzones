// Layout persistence - load/save layouts from config file

import GLib from "gi://GLib"
import { Layout, Zone } from '../models/Layout';

const CONFIG_PATH = GLib.get_home_dir() + '/.config/hypr/hyprzones.toml';

export function loadLayoutFromConfig(): Layout | null {
    try {
        const [ok, contents] = GLib.file_get_contents(CONFIG_PATH);
        if (ok && contents) {
            const content = new TextDecoder().decode(contents);
            return parseTomlLayout(content);
        }
    } catch (e) {
        console.error('Failed to load config:', e);
    }
    return null;
}

export function saveLayoutToConfig(layout: Layout): boolean {
    try {
        const content = layoutToToml(layout);
        GLib.file_set_contents(CONFIG_PATH, content);
        return true;
    } catch (e) {
        console.error('Failed to save config:', e);
        return false;
    }
}

function parseTomlLayout(content: string): Layout | null {
    const layout: Layout = {
        name: 'default',
        spacing: 10,
        zones: []
    };

    const lines = content.split('\n');
    let currentZone: Partial<Zone> | null = null;
    let zoneIndex = 0;
    let inFirstLayout = false;
    let firstLayoutFound = false;

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        // New layout section
        if (trimmed === '[[layouts]]') {
            if (firstLayoutFound) {
                // We hit a second layout - save current zone and stop
                if (currentZone && currentZone.name) {
                    layout.zones.push(currentZone as Zone);
                    currentZone = null;
                }
                break;
            }
            firstLayoutFound = true;
            inFirstLayout = true;
            continue;
        }

        // Zone section within layout
        if (trimmed === '[[layouts.zones]]') {
            if (!inFirstLayout) continue;

            if (currentZone && currentZone.name) {
                layout.zones.push(currentZone as Zone);
            }
            currentZone = { index: zoneIndex++ };
            continue;
        }

        // Parse key=value
        const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (match) {
            const [, key, value] = match;
            const cleanValue = value.replace(/"/g, '').trim();

            if (currentZone && inFirstLayout) {
                switch (key) {
                    case 'name': currentZone.name = cleanValue; break;
                    case 'x': currentZone.x = parseFloat(cleanValue) / 100; break;
                    case 'y': currentZone.y = parseFloat(cleanValue) / 100; break;
                    case 'width': currentZone.width = parseFloat(cleanValue) / 100; break;
                    case 'height': currentZone.height = parseFloat(cleanValue) / 100; break;
                }
            } else if (inFirstLayout && !currentZone) {
                switch (key) {
                    case 'name': layout.name = cleanValue; break;
                    case 'spacing': layout.spacing = parseInt(cleanValue); break;
                }
            }
        }
    }

    // Don't forget the last zone if we didn't hit another [[layouts]]
    if (currentZone && currentZone.name && inFirstLayout) {
        layout.zones.push(currentZone as Zone);
    }

    return layout.zones.length > 0 ? layout : null;
}

function layoutToToml(layout: Layout): string {
    let content = '[[layouts]]\n';
    content += `name = "${layout.name}"\n`;
    content += `spacing = ${layout.spacing}\n`;

    for (const zone of layout.zones) {
        content += '\n[[layouts.zones]]\n';
        content += `name = "${zone.name}"\n`;
        content += `x = ${Math.round(zone.x * 100)}\n`;
        content += `y = ${Math.round(zone.y * 100)}\n`;
        content += `width = ${Math.round(zone.width * 100)}\n`;
        content += `height = ${Math.round(zone.height * 100)}\n`;
    }

    return content;
}
