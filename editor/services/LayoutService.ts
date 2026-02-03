// Layout persistence - load/save layouts from config file

import { readFileAsync, writeFileAsync } from 'astal/file';
import { Layout, Zone } from '../models/Layout';
import { GLib } from 'astal';

const CONFIG_PATH = GLib.get_home_dir() + '/.config/hypr/hyprzones.toml';

export async function loadLayoutFromConfig(): Promise<Layout | null> {
    try {
        const content = await readFileAsync(CONFIG_PATH);
        return parseTomlLayout(content);
    } catch (e) {
        console.error('Failed to load config:', e);
        return null;
    }
}

export async function saveLayoutToConfig(layout: Layout): Promise<boolean> {
    try {
        const content = layoutToToml(layout);
        await writeFileAsync(CONFIG_PATH, content);
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

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        if (trimmed === '[[layouts]]') {
            continue;
        }

        if (trimmed === '[[layouts.zones]]') {
            if (currentZone && currentZone.name) {
                layout.zones.push(currentZone as Zone);
            }
            currentZone = { index: zoneIndex++ };
            continue;
        }

        const match = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (match) {
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
                    case 'name': layout.name = cleanValue; break;
                    case 'spacing': layout.spacing = parseInt(cleanValue); break;
                }
            }
        }
    }

    if (currentZone && currentZone.name) {
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
