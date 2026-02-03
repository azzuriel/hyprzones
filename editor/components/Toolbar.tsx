// Toolbar component - Save/Cancel/Reset buttons

import { Gtk } from 'astal/gtk4';

interface ToolbarProps {
    onSave: () => void;
    onCancel: () => void;
    onReset: () => void;
    hasChanges: boolean;
}

export default function Toolbar({ onSave, onCancel, onReset, hasChanges }: ToolbarProps) {
    return (
        <box
            className="toolbar"
            halign={Gtk.Align.CENTER}
            valign={Gtk.Align.END}
            spacing={12}
        >
            <button
                className="toolbar-button toolbar-reset"
                onClicked={onReset}
                sensitive={hasChanges}
            >
                <label label="Reset" />
            </button>

            <button
                className="toolbar-button toolbar-cancel"
                onClicked={onCancel}
            >
                <label label="Cancel" />
            </button>

            <button
                className="toolbar-button toolbar-save"
                onClicked={onSave}
                sensitive={hasChanges}
            >
                <label label="Save" />
            </button>
        </box>
    );
}
