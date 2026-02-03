// Splitter component - draggable divider between zones

import { Gtk, Gdk } from 'astal/gtk4';
import { Variable } from 'astal';
import { GridLine } from '../models/Layout';
import { MonitorGeometry } from '../utils/geometry';

interface SplitterProps {
    line: GridLine;
    position: number;  // pixel position
    monitor: MonitorGeometry;
    onDrag: (line: GridLine, delta: number) => void;
    onDragEnd: () => void;
}

export default function Splitter({ line, position, monitor, onDrag, onDragEnd }: SplitterProps) {
    const isDragging = Variable(false);
    const dragStart = Variable(0);

    const isVertical = line.orientation === 'vertical';
    const thickness = 8;

    const handleDragBegin = (_self: any, x: number, y: number) => {
        isDragging.set(true);
        dragStart.set(isVertical ? x : y);
    };

    const handleDragUpdate = (_self: any, offsetX: number, offsetY: number) => {
        if (!isDragging.get()) return;

        const delta = isVertical ? offsetX : offsetY;
        const totalSize = isVertical ? monitor.width : monitor.height;
        const percentDelta = delta / totalSize;

        onDrag(line, percentDelta);
    };

    const handleDragEnd = () => {
        isDragging.set(false);
        onDragEnd();
    };

    const style = isVertical
        ? `margin-left: ${position - thickness / 2}px; min-width: ${thickness}px; min-height: ${monitor.height}px;`
        : `margin-top: ${position - thickness / 2}px; min-height: ${thickness}px; min-width: ${monitor.width}px;`;

    const cursorName = isVertical ? 'col-resize' : 'row-resize';

    return (
        <eventbox
            className={`splitter splitter-${line.orientation}`}
            css={style}
            halign={isVertical ? Gtk.Align.START : Gtk.Align.FILL}
            valign={isVertical ? Gtk.Align.FILL : Gtk.Align.START}
            cursor={Gdk.Cursor.new_from_name(cursorName, null)}
            setup={(self) => {
                const drag = new Gtk.GestureDrag();
                drag.connect('drag-begin', handleDragBegin);
                drag.connect('drag-update', handleDragUpdate);
                drag.connect('drag-end', handleDragEnd);
                self.add_controller(drag);
            }}
        >
            <box className="splitter-handle" />
        </eventbox>
    );
}
