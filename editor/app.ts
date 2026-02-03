// HyprZones Editor - AGS application entry point

import { App } from 'astal/gtk4';
import { getCurrentMonitor } from './services/HyprzonesIPC';
import { loadLayoutFromConfig } from './services/LayoutService';
import ZoneEditor from './windows/ZoneEditor';
import { Layout } from './models/Layout';

// Default layout if none exists
const DEFAULT_LAYOUT: Layout = {
    name: 'default',
    spacing: 10,
    zones: [
        { index: 0, name: 'Left', x: 0, y: 0, width: 0.5, height: 1 },
        { index: 1, name: 'Right', x: 0.5, y: 0, width: 0.5, height: 1 }
    ]
};

async function main() {
    const monitor = await getCurrentMonitor();
    if (!monitor) {
        console.error('No monitor found');
        App.quit();
        return;
    }

    let layout = await loadLayoutFromConfig();
    if (!layout) {
        layout = DEFAULT_LAYOUT;
    }

    const closeEditor = () => {
        App.quit();
    };

    ZoneEditor({
        initialLayout: layout,
        monitor: {
            x: 0,
            y: 0,
            width: monitor.width,
            height: monitor.height
        },
        onClose: closeEditor
    });
}

App.start({
    instanceName: 'hyprzones-editor',
    css: `${SRC}/style.scss`,
    main: main
});
