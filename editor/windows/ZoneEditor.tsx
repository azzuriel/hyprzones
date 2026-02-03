// ZoneEditor window - main editor overlay

import { App, Astal, Gtk, Gdk } from 'astal/gtk4';
import { Variable } from 'astal';
import { Layout, Zone as ZoneModel, getGridLines, cloneLayout, GridLine } from '../models/Layout';
import { MonitorGeometry, zoneToPixels, gridLineToPixel, collectGridBoundaries, clamp } from '../utils/geometry';
import { saveLayoutToConfig } from '../services/LayoutService';
import { reloadConfig } from '../services/HyprzonesIPC';
import Zone from '../components/Zone';
import Splitter from '../components/Splitter';
import Toolbar from '../components/Toolbar';

interface ZoneEditorProps {
    initialLayout: Layout;
    monitor: MonitorGeometry;
    onClose: () => void;
}

export default function ZoneEditor({ initialLayout, monitor, onClose }: ZoneEditorProps) {
    const originalLayout = cloneLayout(initialLayout);
    const currentLayout = Variable(cloneLayout(initialLayout));
    const hasChanges = Variable(false);
    const highlightedZone = Variable<number | null>(null);

    const updateZonesForGridLine = (line: GridLine, delta: number) => {
        const layout = currentLayout.get();
        const minSize = 0.05; // minimum 5% size

        for (const zone of layout.zones) {
            if (line.orientation === 'vertical') {
                const zoneEnd = zone.x + zone.width;

                // Zone ends at this line - adjust width
                if (Math.abs(zoneEnd - line.position) < 0.001) {
                    const newWidth = clamp(zone.width + delta, minSize, 1 - zone.x - minSize);
                    zone.width = newWidth;
                }
                // Zone starts at this line - adjust x and width
                else if (Math.abs(zone.x - line.position) < 0.001) {
                    const newX = clamp(zone.x + delta, minSize, zone.x + zone.width - minSize);
                    zone.width = zone.width - (newX - zone.x);
                    zone.x = newX;
                }
            } else {
                const zoneEnd = zone.y + zone.height;

                // Zone ends at this line - adjust height
                if (Math.abs(zoneEnd - line.position) < 0.001) {
                    const newHeight = clamp(zone.height + delta, minSize, 1 - zone.y - minSize);
                    zone.height = newHeight;
                }
                // Zone starts at this line - adjust y and height
                else if (Math.abs(zone.y - line.position) < 0.001) {
                    const newY = clamp(zone.y + delta, minSize, zone.y + zone.height - minSize);
                    zone.height = zone.height - (newY - zone.y);
                    zone.y = newY;
                }
            }
        }

        // Update the grid line position
        line.position = clamp(line.position + delta, 0.05, 0.95);

        currentLayout.set({ ...layout });
        hasChanges.set(true);
    };

    const handleSave = async () => {
        const layout = currentLayout.get();
        const success = await saveLayoutToConfig(layout);
        if (success) {
            await reloadConfig();
            onClose();
        }
    };

    const handleCancel = () => {
        onClose();
    };

    const handleReset = () => {
        currentLayout.set(cloneLayout(originalLayout));
        hasChanges.set(false);
    };

    return (
        <window
            name="hyprzones-editor"
            namespace="hyprzones-editor"
            className="zone-editor"
            application={App}
            layer={Astal.Layer.OVERLAY}
            exclusivity={Astal.Exclusivity.IGNORE}
            anchor={Astal.WindowAnchor.TOP | Astal.WindowAnchor.BOTTOM | Astal.WindowAnchor.LEFT | Astal.WindowAnchor.RIGHT}
            keymode={Astal.Keymode.ON_DEMAND}
            visible
            setup={(self) => {
                self.connect('key-press-event', (_w, event) => {
                    if (event.get_keyval()[1] === Gdk.KEY_Escape) {
                        onClose();
                        return true;
                    }
                    return false;
                });
            }}
        >
            <overlay>
                {/* Background dimming */}
                <box className="editor-backdrop" hexpand vexpand />

                {/* Zones */}
                {currentLayout(layout => {
                    const gridBounds = collectGridBoundaries(layout.zones);
                    return layout.zones.map(zone => {
                        const rect = zoneToPixels(zone, monitor, layout.spacing, gridBounds);
                        return (
                            <Zone
                                key={zone.index}
                                zone={zone}
                                rect={rect}
                                isHighlighted={highlightedZone.get() === zone.index}
                            />
                        );
                    });
                })}

                {/* Splitters */}
                {currentLayout(layout => {
                    const gridLines = getGridLines(layout.zones);
                    const gridBounds = collectGridBoundaries(layout.zones);
                    return gridLines.map(line => {
                        const pos = gridLineToPixel(line, monitor, layout.spacing, gridBounds);
                        return (
                            <Splitter
                                key={`splitter-${line.orientation}-${line.index}`}
                                line={line}
                                position={pos}
                                monitor={monitor}
                                onDrag={updateZonesForGridLine}
                                onDragEnd={() => {}}
                            />
                        );
                    });
                })}

                {/* Toolbar */}
                <Toolbar
                    onSave={handleSave}
                    onCancel={handleCancel}
                    onReset={handleReset}
                    hasChanges={hasChanges.get()}
                />
            </overlay>
        </window>
    );
}
