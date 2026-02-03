/**
 * HyprZones - Zone-based window tiling for Hyprland
 *
 * Inspired by Microsoft PowerToys FancyZones
 *
 * This plugin provides declarative zone-based window management:
 * - Define zones in a config file
 * - Windows snap to zones via drag or keybind
 * - Layouts can be saved, loaded, and switched via hotkeys
 */

#include <hyprland/src/plugins/PluginAPI.hpp>
#include <hyprland/src/Compositor.hpp>
#include <hyprland/src/desktop/Window.hpp>
#include <hyprland/src/managers/KeybindManager.hpp>
#include <hyprland/src/render/Renderer.hpp>

#include "hyprzones.hpp"

inline HANDLE PHANDLE = nullptr;

// Global managers
static std::unique_ptr<HyprZones::ZoneManager> g_zoneManager;
static std::unique_ptr<HyprZones::LayoutManager> g_layoutManager;
static std::unique_ptr<HyprZones::WindowSnapper> g_windowSnapper;
static std::unique_ptr<HyprZones::ConfigParser> g_configParser;
static std::unique_ptr<HyprZones::Renderer> g_renderer;
static HyprZones::Config g_config;

// Hook handles
static CFunctionHook* g_renderHook = nullptr;
static CFunctionHook* g_windowDragHook = nullptr;

/**
 * IPC command handler for hyprzones commands
 *
 * Commands:
 *   hyprzones layouts          - List all layouts
 *   hyprzones apply <name>     - Apply layout by name
 *   hyprzones moveto <zone>    - Move active window to zone
 *   hyprzones save <name>      - Save current positions as layout
 *   hyprzones reload           - Reload configuration
 */
static std::string handleHyprzonesCommand(std::string command) {
    // TODO: Implement IPC commands

    if (command == "layouts") {
        std::string result = "Available layouts:\n";
        for (const auto& layout : g_config.layouts) {
            result += "  - " + layout.name;
            if (!layout.hotkey.empty()) {
                result += " (" + layout.hotkey + ")";
            }
            result += "\n";
        }
        return result;
    }

    if (command.starts_with("apply ")) {
        std::string layoutName = command.substr(6);
        // TODO: Apply layout
        return "Applied layout: " + layoutName;
    }

    if (command.starts_with("moveto ")) {
        std::string zoneStr = command.substr(7);
        int zoneIndex = std::stoi(zoneStr);
        // TODO: Move window to zone
        return "Moved to zone: " + std::to_string(zoneIndex);
    }

    if (command == "reload") {
        // TODO: Reload config
        return "Configuration reloaded";
    }

    return "Unknown command: " + command;
}

/**
 * Dispatcher for zone movement
 * Usage: hyprzones:moveto, <zone_index>
 */
static void dispatchMoveToZone(std::string args) {
    // TODO: Implement
}

/**
 * Dispatcher for layout switching
 * Usage: hyprzones:layout, <layout_name>
 */
static void dispatchSwitchLayout(std::string args) {
    // TODO: Implement
}

/**
 * Dispatcher for showing zone overlay
 * Usage: hyprzones:showzones
 */
static void dispatchShowZones(std::string args) {
    // TODO: Implement
}

/**
 * Plugin initialization
 */
APICALL EXPORT PLUGIN_DESCRIPTION_INFO PLUGIN_INIT(HANDLE handle) {
    PHANDLE = handle;

    // Log startup
    HyprlandAPI::addNotification(
        PHANDLE,
        "[HyprZones] Plugin loaded",
        CColor(0.2f, 0.8f, 0.2f, 1.0f),
        3000
    );

    // Register IPC command
    HyprlandAPI::registerHyprCtlCommand(
        PHANDLE,
        SHyprCtlCommand{
            .name = "hyprzones",
            .handler = handleHyprzonesCommand,
            .exact = false
        }
    );

    // Register dispatchers
    HyprlandAPI::addDispatcher(PHANDLE, "hyprzones:moveto", dispatchMoveToZone);
    HyprlandAPI::addDispatcher(PHANDLE, "hyprzones:layout", dispatchSwitchLayout);
    HyprlandAPI::addDispatcher(PHANDLE, "hyprzones:showzones", dispatchShowZones);

    // TODO: Initialize managers
    // TODO: Load configuration
    // TODO: Set up hooks for window drag detection
    // TODO: Set up render hooks for zone visualization

    return {"HyprZones", "Zone-based window tiling", "Your Name", "0.1.0"};
}

/**
 * Plugin cleanup
 */
APICALL EXPORT void PLUGIN_EXIT() {
    // Cleanup
    HyprlandAPI::addNotification(
        PHANDLE,
        "[HyprZones] Plugin unloaded",
        CColor(0.8f, 0.2f, 0.2f, 1.0f),
        3000
    );
}

/**
 * Configuration reload handler
 */
APICALL EXPORT void PLUGIN_RELOAD() {
    // TODO: Reload configuration
}
