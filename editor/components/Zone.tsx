// Zone component - renders a single zone rectangle

import { Gtk } from 'astal/gtk4';
import { Zone as ZoneModel } from '../models/Layout';
import { PixelRect } from '../utils/geometry';

interface ZoneProps {
    zone: ZoneModel;
    rect: PixelRect;
    isHighlighted: boolean;
}

export default function Zone({ zone, rect, isHighlighted }: ZoneProps) {
    const className = isHighlighted ? 'zone zone-highlighted' : 'zone';

    return (
        <box
            className={className}
            css={`
                margin-left: ${rect.x}px;
                margin-top: ${rect.y}px;
                min-width: ${rect.width}px;
                min-height: ${rect.height}px;
            `}
            halign={Gtk.Align.START}
            valign={Gtk.Align.START}
        >
            <label
                className="zone-label"
                label={zone.name}
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
                hexpand
                vexpand
            />
        </box>
    );
}
