// Toolbar - Editor toolbar with config, reset, and close buttons

import { Gtk } from "ags/gtk4"
import { resetLayout } from "./ZoneOperations"

// Callbacks
let showLayoutPanelCallback: (() => void) | null = null
let closeEditorCallback: (() => void) | null = null
let updateDisplayCallback: (() => void) | null = null

export function setToolbarCallbacks(callbacks: {
    showLayoutPanel: () => void
    closeEditor: () => void
    updateDisplay: () => void
}) {
    showLayoutPanelCallback = callbacks.showLayoutPanel
    closeEditorCallback = callbacks.closeEditor
    updateDisplayCallback = callbacks.updateDisplay
}

// Create the toolbar
export function createToolbar(): Gtk.Box {
    const toolbar = new Gtk.Box({ spacing: 12 })
    toolbar.get_style_context().add_class("toolbar")
    toolbar.set_halign(Gtk.Align.CENTER)
    toolbar.set_valign(Gtk.Align.END)
    toolbar.set_margin_bottom(32)

    // Config button
    const configBtn = new Gtk.Button({ label: "Config" })
    configBtn.get_style_context().add_class("toolbar-button")
    configBtn.connect("clicked", () => {
        if (showLayoutPanelCallback) {
            showLayoutPanelCallback()
        }
    })

    // Reset button
    const resetBtn = new Gtk.Button({ label: "Reset" })
    resetBtn.get_style_context().add_class("toolbar-button")
    resetBtn.get_style_context().add_class("toolbar-reset")
    resetBtn.connect("clicked", () => {
        resetLayout()
        if (updateDisplayCallback) {
            updateDisplayCallback()
        }
    })

    // Close button
    const closeBtn = new Gtk.Button({ label: "Close" })
    closeBtn.get_style_context().add_class("toolbar-button")
    closeBtn.connect("clicked", () => {
        if (closeEditorCallback) {
            closeEditorCallback()
        }
    })

    toolbar.append(configBtn)
    toolbar.append(resetBtn)
    toolbar.append(closeBtn)

    return toolbar
}
