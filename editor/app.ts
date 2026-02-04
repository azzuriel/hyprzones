// HyprZones Editor - AGS v3 application entry point

import app from "ags/gtk4/app"
import style from "./style.scss"
import ZoneEditor, { reloadCurrentLayout } from "./widget/ZoneEditor"

let editorWindow: any = null
let isVisible = false

app.start({
    css: style,
    instanceName: "hyprzones-editor",
    async main() {
        try {
            editorWindow = await ZoneEditor()
            editorWindow.show()
            isVisible = true

            // Track visibility changes from window itself (e.g. Cancel button)
            editorWindow.connect("hide", () => {
                isVisible = false
            })
            editorWindow.connect("show", () => {
                isVisible = true
            })

            console.log("HyprZones Editor started")
        } catch (e) {
            console.error("Failed to create Zone Editor:", e)
        }
    },
    requestHandler(request: any, res: (response: any) => void) {
        const reqStr = Array.isArray(request) ? request.join(" ") : String(request)

        if (reqStr.includes("toggle")) {
            if (editorWindow) {
                if (isVisible) {
                    editorWindow.hide()
                    isVisible = false
                    res("hidden")
                } else {
                    reloadCurrentLayout().then(() => {
                        editorWindow.show()
                        isVisible = true
                        res("shown")
                    })
                }
            } else {
                res("window not ready")
            }
        } else if (reqStr.includes("show")) {
            if (editorWindow) {
                reloadCurrentLayout().then(() => {
                    editorWindow.show()
                    isVisible = true
                    res("shown")
                })
            } else {
                res("window not ready")
            }
        } else if (reqStr.includes("hide")) {
            if (editorWindow) {
                editorWindow.hide()
                isVisible = false
                res("hidden")
            } else {
                res("window not ready")
            }
        } else if (reqStr.includes("quit") || reqStr.includes("exit")) {
            app.quit()
            res("quit")
        } else {
            res("unknown request: " + reqStr)
        }
    },
})
