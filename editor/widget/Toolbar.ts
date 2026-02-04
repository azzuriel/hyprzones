// Toolbar - Editor toolbar with reset and config buttons

import { Gtk } from "ags/gtk4"
import { resetLayout } from "./ZoneOperations"

// Callbacks
let showLayoutPanelCallback: (() => void) | null = null
let updateDisplayCallback: (() => void) | null = null

export function setToolbarCallbacks(callbacks: {
    showLayoutPanel: () => void
    updateDisplay: () => void
}) {
    showLayoutPanelCallback = callbacks.showLayoutPanel
    updateDisplayCallback = callbacks.updateDisplay
}

// Create the toolbar
export function createToolbar(): Gtk.Box {
    const toolbar = new Gtk.Box({ spacing: 12 })
    toolbar.get_style_context().add_class("toolbar")
    toolbar.set_halign(Gtk.Align.CENTER)

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

    // Config button - opens layout management dialog
    const configBtn = new Gtk.Button({ label: "Config" })
    configBtn.get_style_context().add_class("toolbar-button")
    configBtn.get_style_context().add_class("toolbar-save")
    configBtn.connect("clicked", () => {
        if (showLayoutPanelCallback) {
            showLayoutPanelCallback()
        }
    })

    toolbar.append(resetBtn)
    toolbar.append(configBtn)

    return toolbar
}
