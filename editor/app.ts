// HyprZones Editor - AGS v3 application entry point

import app from "ags/gtk3/app"
import style from "./style.scss"
import ZoneEditor from "./widget/ZoneEditor"

let editorWindow: any = null

app.start({
    css: style,
    instanceName: "hyprzones-editor",
    async main() {
        try {
            editorWindow = await ZoneEditor()
            editorWindow.show()
            console.log("HyprZones Editor started")
        } catch (e) {
            console.error("Failed to create Zone Editor:", e)
        }
    },
    requestHandler(request: any, res: (response: any) => void) {
        const reqStr = Array.isArray(request) ? request.join(" ") : String(request)

        if (reqStr.includes("toggle") || reqStr.includes("show")) {
            if (editorWindow) {
                if (editorWindow.visible) {
                    editorWindow.hide()
                    res("hidden")
                } else {
                    editorWindow.show()
                    res("shown")
                }
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
