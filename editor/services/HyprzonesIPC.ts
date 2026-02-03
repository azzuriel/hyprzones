// IPC communication with hyprzones plugin via hyprctl

import { execAsync } from 'astal';
import { Layout, Zone } from '../models/Layout';

export async function getLayouts(): Promise<string[]> {
    try {
        const result = await execAsync(['hyprctl', 'hyprzones:layouts', '-j']);
        const data = JSON.parse(result);
        return data.map((l: { name: string }) => l.name);
    } catch (e) {
        console.error('Failed to get layouts:', e);
        return [];
    }
}

export async function reloadConfig(): Promise<boolean> {
    try {
        await execAsync(['hyprctl', 'hyprzones:reload']);
        return true;
    } catch (e) {
        console.error('Failed to reload config:', e);
        return false;
    }
}

export async function saveLayout(path: string): Promise<boolean> {
    try {
        await execAsync(['hyprctl', `hyprzones:save ${path}`]);
        return true;
    } catch (e) {
        console.error('Failed to save layout:', e);
        return false;
    }
}

export async function getCurrentMonitor(): Promise<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
} | null> {
    try {
        const result = await execAsync(['hyprctl', 'monitors', '-j']);
        const monitors = JSON.parse(result);
        const focused = monitors.find((m: any) => m.focused);
        if (focused) {
            return {
                name: focused.name,
                x: focused.x,
                y: focused.y,
                width: focused.width,
                height: focused.height
            };
        }
        return monitors[0] ? {
            name: monitors[0].name,
            x: monitors[0].x,
            y: monitors[0].y,
            width: monitors[0].width,
            height: monitors[0].height
        } : null;
    } catch (e) {
        console.error('Failed to get monitor:', e);
        return null;
    }
}

export async function showZones(): Promise<void> {
    try {
        await execAsync(['hyprctl', 'dispatch', 'hyprzones:show']);
    } catch (e) {
        console.error('Failed to show zones:', e);
    }
}

export async function hideZones(): Promise<void> {
    try {
        await execAsync(['hyprctl', 'dispatch', 'hyprzones:hide']);
    } catch (e) {
        console.error('Failed to hide zones:', e);
    }
}
