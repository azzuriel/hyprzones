#define WLR_USE_UNSTABLE

#include <hyprland/src/plugins/PluginAPI.hpp>
#include <hyprland/src/Compositor.hpp>
#include <hyprland/src/desktop/view/Window.hpp>
#include <hyprland/src/desktop/Workspace.hpp>
#include <hyprland/src/render/Renderer.hpp>
#include <hyprland/src/render/OpenGL.hpp>
#include <hyprland/src/managers/input/InputManager.hpp>
#include <hyprland/src/devices/IPointer.hpp>
#include <hyprland/src/devices/IKeyboard.hpp>
#include <hyprland/src/helpers/Monitor.hpp>
#include <hyprland/src/managers/KeybindManager.hpp>
#include <hyprland/src/SharedDefs.hpp>

#include "hyprzones/Globals.hpp"
#include "hyprzones/Config.hpp"
#include "hyprzones/DragState.hpp"
#include "hyprzones/ZoneManager.hpp"
#include "hyprzones/LayoutManager.hpp"
#include "hyprzones/WindowSnapper.hpp"
#include "hyprzones/Renderer.hpp"

using namespace HyprZones;

// Callback handles
static SP<HOOK_CALLBACK_FN> g_pMouseMoveCallback;
static SP<HOOK_CALLBACK_FN> g_pMouseButtonCallback;
static SP<HOOK_CALLBACK_FN> g_pRenderCallback;
static SP<HOOK_CALLBACK_FN> g_pWindowOpenCallback;

// Helper: Get focused window
static PHLWINDOW getFocusedWindow() {
    auto monitor = g_pCompositor->getMonitorFromCursor();
    if (!monitor || !monitor->m_activeWorkspace)
        return nullptr;
    return monitor->m_activeWorkspace->getLastFocusedWindow();
}

// Helper: Get current monitor name
static std::string getCurrentMonitorName() {
    auto monitor = g_pCompositor->getMonitorFromCursor();
    return monitor ? monitor->m_name : "";
}

// Helper: Get current workspace ID
static int getCurrentWorkspaceID() {
    auto monitor = g_pCompositor->getMonitorFromCursor();
    if (!monitor || !monitor->m_activeWorkspace)
        return -1;
    return monitor->m_activeWorkspace->m_id;
}

// Callback: Mouse move
static void onMouseMove(void*, SCallbackInfo&, std::any data) {
    if (!g_dragState.isDragging)
        return;

    auto coords = std::any_cast<const Vector2D>(data);
    g_dragState.currentX = coords.x;
    g_dragState.currentY = coords.y;

    auto* layout = g_layoutManager->getLayoutForMonitor(
        g_config, getCurrentMonitorName(), getCurrentWorkspaceID()
    );

    if (!layout || !g_dragState.isZoneSnapping)
        return;

    // Compute zone pixels if not done
    auto monitor = g_pCompositor->getMonitorFromCursor();
    if (monitor) {
        g_zoneManager->computeZonePixels(*layout,
            monitor->m_position.x, monitor->m_position.y,
            monitor->m_size.x, monitor->m_size.y,
            g_config.zoneGap);
    }

    int zone = g_zoneManager->getSmallestZoneAtPoint(*layout,
        g_dragState.currentX, g_dragState.currentY);
    g_dragState.currentZone = zone;

    if (zone >= 0) {
        if (g_dragState.ctrlHeld && g_dragState.startZone >= 0) {
            // Multi-zone selection
            g_dragState.selectedZones = g_zoneManager->getZoneRange(
                *layout, g_dragState.startZone, zone);
        } else {
            g_dragState.selectedZones = {zone};
        }
    } else {
        g_dragState.selectedZones.clear();
    }
}

// Callback: Mouse button
static void onMouseButton(void*, SCallbackInfo& info, std::any data) {
    auto e = std::any_cast<IPointer::SButtonEvent>(data);

    // Only handle left mouse button
    if (e.button != BTN_LEFT)
        return;

    if (e.state == WL_POINTER_BUTTON_STATE_PRESSED) {
        auto window = getFocusedWindow();
        if (!window)
            return;

        // Check if floating (zone snapping only for floating windows)
        if (!window->m_isFloating)
            return;

        // Start drag tracking
        auto coords = g_pInputManager->getMouseCoordsInternal();
        g_dragState.isDragging = true;
        g_dragState.draggedWindow = window.get();
        g_dragState.dragStartX = coords.x;
        g_dragState.dragStartY = coords.y;
        g_dragState.currentX = coords.x;
        g_dragState.currentY = coords.y;

        // Check modifier key for zone snapping
        uint32_t mods = g_pInputManager->getModsFromAllKBs();
        bool modifierHeld = false;

        if (g_config.snapModifier == "SHIFT") {
            modifierHeld = mods & HL_MODIFIER_SHIFT;
        } else if (g_config.snapModifier == "CTRL" || g_config.snapModifier == "CONTROL") {
            modifierHeld = mods & HL_MODIFIER_CTRL;
        } else if (g_config.snapModifier == "ALT") {
            modifierHeld = mods & HL_MODIFIER_ALT;
        } else if (g_config.snapModifier == "SUPER" || g_config.snapModifier == "META") {
            modifierHeld = mods & HL_MODIFIER_META;
        }

        // Track Ctrl state for multi-zone selection
        g_dragState.ctrlHeld = mods & HL_MODIFIER_CTRL;

        bool shouldActivate = g_config.showOnDrag &&
            (!g_config.requireModifier || modifierHeld);

        if (shouldActivate) {
            g_dragState.isZoneSnapping = true;
            g_renderer->show();

            auto* layout = g_layoutManager->getLayoutForMonitor(
                g_config, getCurrentMonitorName(), getCurrentWorkspaceID());
            if (layout) {
                g_dragState.startZone = g_zoneManager->getSmallestZoneAtPoint(
                    *layout, coords.x, coords.y);
            }
        }
    } else {
        // Button released
        if (g_dragState.isDragging && g_dragState.isZoneSnapping) {
            if (!g_dragState.selectedZones.empty()) {
                auto* layout = g_layoutManager->getLayoutForMonitor(
                    g_config, getCurrentMonitorName(), getCurrentWorkspaceID());

                if (layout && g_dragState.draggedWindow) {
                    // Get combined zone box
                    double x, y, w, h;
                    g_zoneManager->getCombinedZoneBox(*layout,
                        g_dragState.selectedZones, x, y, w, h);

                    if (w > 0 && h > 0) {
                        auto window = reinterpret_cast<Desktop::View::CWindow*>(
                            g_dragState.draggedWindow);

                        // Remember original size
                        auto origBox = window->logicalBox();
                        if (origBox) {
                            g_windowSnapper->rememberWindow(
                                g_dragState.draggedWindow,
                                layout->name,
                                g_dragState.selectedZones,
                                origBox->x, origBox->y,
                                origBox->w, origBox->h);
                        }

                        // Move and resize window to zone
                        // Use dispatcher for proper animation
                        std::string moveArg = "exact " +
                            std::to_string(static_cast<int>(x)) + " " +
                            std::to_string(static_cast<int>(y));
                        std::string sizeArg = "exact " +
                            std::to_string(static_cast<int>(w)) + " " +
                            std::to_string(static_cast<int>(h));

                        g_pKeybindManager->m_dispatchers["movewindowpixel"](moveArg);
                        g_pKeybindManager->m_dispatchers["resizewindowpixel"](sizeArg);
                    }
                }
            }
        }

        g_dragState.reset();
        g_renderer->hide();
    }
}

// Callback: Render (for zone overlay)
static void onRender(void*, SCallbackInfo&, std::any data) {
    if (!g_renderer || !g_renderer->isVisible())
        return;

    // The render hook passes eRenderStage, not a monitor pointer
    eRenderStage stage;
    try {
        stage = std::any_cast<eRenderStage>(data);
    } catch (...) {
        return;
    }

    // Only render overlays after windows are drawn (on top of everything)
    if (stage != RENDER_POST_WINDOWS)
        return;

    // Get current monitor from OpenGL render context
    auto pMonitor = g_pHyprOpenGL->m_renderData.pMonitor.lock();
    if (!pMonitor)
        return;

    CMonitor* monitor = pMonitor.get();

    // Get layout for this monitor
    auto* layout = g_layoutManager->getLayoutForMonitor(
        g_config, monitor->m_name,
        monitor->m_activeWorkspace ? monitor->m_activeWorkspace->m_id : -1
    );

    if (!layout || layout->zones.empty())
        return;

    // Compute zone pixels if needed
    g_zoneManager->computeZonePixels(*layout,
        monitor->m_position.x, monitor->m_position.y,
        monitor->m_size.x, monitor->m_size.y,
        g_config.zoneGap);

    // Render the overlay
    g_renderer->renderOverlay(monitor, *layout, g_dragState.selectedZones, g_config);
}

// IPC: List layouts
static std::string cmdLayouts(eHyprCtlOutputFormat format, std::string) {
    std::string result;
    if (format == eHyprCtlOutputFormat::FORMAT_JSON) {
        result = "[";
        for (size_t i = 0; i < g_config.layouts.size(); ++i) {
            if (i > 0) result += ",";
            result += "{\"name\":\"" + g_config.layouts[i].name + "\"}";
        }
        result += "]";
    } else {
        result = "layouts:\n";
        for (const auto& layout : g_config.layouts) {
            result += "  - " + layout.name + "\n";
        }
    }
    return result;
}

// IPC: Move to zone
static std::string cmdMoveto(eHyprCtlOutputFormat, std::string args) {
    if (args.empty())
        return "error: zone index required";

    int zoneIndex;
    try {
        zoneIndex = std::stoi(args);
    } catch (...) {
        return "error: invalid zone index";
    }

    auto window = getFocusedWindow();
    if (!window)
        return "error: no focused window";

    auto* layout = g_layoutManager->getLayoutForMonitor(
        g_config, getCurrentMonitorName(), getCurrentWorkspaceID());

    if (!layout)
        return "error: no layout";

    if (zoneIndex < 0 || zoneIndex >= static_cast<int>(layout->zones.size()))
        return "error: zone index out of range";

    // Compute zone pixels
    auto monitor = g_pCompositor->getMonitorFromCursor();
    if (monitor) {
        g_zoneManager->computeZonePixels(*layout,
            monitor->m_position.x, monitor->m_position.y,
            monitor->m_size.x, monitor->m_size.y,
            g_config.zoneGap);
    }

    const auto& zone = layout->zones[zoneIndex];

    // Move and resize
    std::string moveArg = "exact " +
        std::to_string(static_cast<int>(zone.pixelX)) + " " +
        std::to_string(static_cast<int>(zone.pixelY));
    std::string sizeArg = "exact " +
        std::to_string(static_cast<int>(zone.pixelW)) + " " +
        std::to_string(static_cast<int>(zone.pixelH));

    g_pKeybindManager->m_dispatchers["movewindowpixel"](moveArg);
    g_pKeybindManager->m_dispatchers["resizewindowpixel"](sizeArg);

    return "ok";
}

// IPC: Reload config
static std::string cmdReload(eHyprCtlOutputFormat, std::string) {
    reloadConfig();
    return "reloaded";
}

// IPC: Save layouts to file
static std::string cmdSave(eHyprCtlOutputFormat, std::string args) {
    std::string path = args.empty() ? getConfigPath() + ".backup" : args;
    bool success = g_layoutManager->saveLayouts(path, g_config.layouts);
    return success ? "saved to " + path : "error: failed to save";
}

// IPC: Load layouts from file
static std::string cmdLoad(eHyprCtlOutputFormat, std::string args) {
    std::string path = args.empty() ? getConfigPath() : args;
    auto layouts = g_layoutManager->loadLayouts(path);
    if (layouts.empty()) {
        return "error: no layouts loaded from " + path;
    }
    g_config.layouts = layouts;
    g_config.layoutIndex.clear();
    for (size_t i = 0; i < g_config.layouts.size(); ++i) {
        g_config.layoutIndex[g_config.layouts[i].name] = i;
    }
    if (!g_config.layouts.empty()) {
        g_config.activeLayout = g_config.layouts[0].name;
    }
    return "loaded " + std::to_string(layouts.size()) + " layouts from " + path;
}

// Dispatcher: Move to zone
static SDispatchResult dispatchMoveto(std::string args) {
    SDispatchResult result;
    std::string out = cmdMoveto(eHyprCtlOutputFormat::FORMAT_NORMAL, args);
    result.success = (out == "ok");
    if (!result.success)
        result.error = out;
    return result;
}

// Dispatcher: Switch layout
static SDispatchResult dispatchLayout(std::string args) {
    SDispatchResult result;
    g_layoutManager->switchLayout(g_config, args);
    result.success = true;
    return result;
}

// Dispatcher: Cycle layout
static SDispatchResult dispatchCycleLayout(std::string args) {
    SDispatchResult result;
    int direction = 1;
    if (!args.empty()) {
        try {
            direction = std::stoi(args);
        } catch (...) {}
    }
    g_layoutManager->cycleLayout(g_config, direction);
    result.success = true;
    return result;
}

// Dispatcher: Show zones
static SDispatchResult dispatchShowZones(std::string) {
    SDispatchResult result;
    g_renderer->show();
    result.success = true;
    return result;
}

// Dispatcher: Hide zones
static SDispatchResult dispatchHideZones(std::string) {
    SDispatchResult result;
    g_renderer->hide();
    result.success = true;
    return result;
}

// Plugin initialization
APICALL EXPORT PLUGIN_DESCRIPTION_INFO PLUGIN_INIT(HANDLE handle) {
    g_handle = handle;

    HyprlandAPI::addNotification(
        g_handle,
        "[HyprZones] Initializing...",
        CHyprColor(0.2f, 0.8f, 0.2f, 1.0f),
        3000
    );

    // Initialize globals
    initGlobals();
    reloadConfig();

    // Register callbacks
    g_pMouseMoveCallback = HyprlandAPI::registerCallbackDynamic(
        g_handle, "mouseMove", onMouseMove);
    g_pMouseButtonCallback = HyprlandAPI::registerCallbackDynamic(
        g_handle, "mouseButton", onMouseButton);
    g_pRenderCallback = HyprlandAPI::registerCallbackDynamic(
        g_handle, "render", onRender);

    // Register config values
    HyprlandAPI::addConfigValue(g_handle, "plugin:hyprzones:enabled",
        Hyprlang::INT{1});
    HyprlandAPI::addConfigValue(g_handle, "plugin:hyprzones:snap_modifier",
        Hyprlang::STRING{"SHIFT"});
    HyprlandAPI::addConfigValue(g_handle, "plugin:hyprzones:show_on_drag",
        Hyprlang::INT{1});
    HyprlandAPI::addConfigValue(g_handle, "plugin:hyprzones:zone_gap",
        Hyprlang::INT{10});

    // Register hyprctl commands
    HyprlandAPI::registerHyprCtlCommand(g_handle,
        SHyprCtlCommand{"hyprzones:layouts", true, cmdLayouts});
    HyprlandAPI::registerHyprCtlCommand(g_handle,
        SHyprCtlCommand{"hyprzones:moveto", true, cmdMoveto});
    HyprlandAPI::registerHyprCtlCommand(g_handle,
        SHyprCtlCommand{"hyprzones:reload", true, cmdReload});
    HyprlandAPI::registerHyprCtlCommand(g_handle,
        SHyprCtlCommand{"hyprzones:save", true, cmdSave});
    HyprlandAPI::registerHyprCtlCommand(g_handle,
        SHyprCtlCommand{"hyprzones:load", true, cmdLoad});

    // Register dispatchers (using V2 API)
    HyprlandAPI::addDispatcherV2(g_handle, "hyprzones:moveto", dispatchMoveto);
    HyprlandAPI::addDispatcherV2(g_handle, "hyprzones:layout", dispatchLayout);
    HyprlandAPI::addDispatcherV2(g_handle, "hyprzones:cycle", dispatchCycleLayout);
    HyprlandAPI::addDispatcherV2(g_handle, "hyprzones:show", dispatchShowZones);
    HyprlandAPI::addDispatcherV2(g_handle, "hyprzones:hide", dispatchHideZones);

    HyprlandAPI::addNotification(
        g_handle,
        "[HyprZones] Loaded v0.1.0",
        CHyprColor(0.2f, 0.8f, 0.2f, 1.0f),
        3000
    );

    return {"hyprzones", "Zone-based window tiling for Hyprland", "HyprZones", "0.1.0"};
}

// Plugin exit
APICALL EXPORT void PLUGIN_EXIT() {
    HyprlandAPI::addNotification(
        g_handle,
        "[HyprZones] Unloading...",
        CHyprColor(0.8f, 0.8f, 0.2f, 1.0f),
        2000
    );
    cleanupGlobals();
}

// Plugin API version
APICALL EXPORT std::string PLUGIN_API_VERSION() {
    return HYPRLAND_API_VERSION;
}
