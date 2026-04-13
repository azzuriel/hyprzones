// HyprZones Editor - AGS v3 application entry point

import GLib from "gi://GLib"
import app from "ags/gtk4/app"
import style from "./style.scss"
import ZoneEditor, { reloadCurrentLayout } from "./widget/ZoneEditor"

let editorWindow: any = null
let isVisible = false
let pendingOp = false

// Defer GTK work to next main loop iteration so the D-Bus reply is flushed
// before any potentially blocking GTK / wayland call runs.
function defer(fn: () => void) {
    GLib.idle_add(GLib.PRIORITY_DEFAULT_IDLE, () => {
        try { fn() } catch (e) { console.error("deferred op failed:", e) }
        return GLib.SOURCE_REMOVE
    })
}

function doShow() {
    if (pendingOp) return
    pendingOp = true
    reloadCurrentLayout()
        .catch((e) => console.error("reloadCurrentLayout failed:", e))
        .then(() => {
            try {
                editorWindow.show()
                isVisible = true
            } catch (e) {
                console.error("show failed:", e)
            }
            pendingOp = false
        })
}

function doHide() {
    try {
        editorWindow.hide()
        isVisible = false
    } catch (e) {
        console.error("hide failed:", e)
    }
}

app.start({
    css: style,
    instanceName: "hyprzones-editor",
    async main() {
        try {
            editorWindow = await ZoneEditor()
            editorWindow.show()
            isVisible = true

            editorWindow.connect("hide", () => { isVisible = false })
            editorWindow.connect("show", () => { isVisible = true })

            console.log("HyprZones Editor started")
        } catch (e) {
            console.error("Failed to create Zone Editor:", e)
        }
    },
    requestHandler(request: any, res: (response: any) => void) {
        // Always reply first, defer all GTK work. This guarantees `ags request`
        // never blocks on us, even if a GTK / wayland call later hangs.
        const reqStr = Array.isArray(request) ? request.join(" ") : String(request)

        if (!editorWindow) {
            res("window not ready")
            return
        }

        if (reqStr.includes("toggle")) {
            if (isVisible) {
                res("hidden")
                defer(doHide)
            } else {
                res("shown")
                defer(doShow)
            }
        } else if (reqStr.includes("show")) {
            res("shown")
            defer(doShow)
        } else if (reqStr.includes("hide")) {
            res("hidden")
            defer(doHide)
        } else if (reqStr.includes("quit") || reqStr.includes("exit")) {
            res("quit")
            defer(() => app.quit())
        } else {
            res("unknown request: " + reqStr)
        }
    },
})
