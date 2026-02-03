#define WLR_USE_UNSTABLE

#include <hyprland/src/plugins/PluginAPI.hpp>

#include "hyprzones/Globals.hpp"
#include "hyprzones/Config.hpp"
#include "hyprzones/DragState.hpp"
#include "hyprzones/ZoneManager.hpp"
#include "hyprzones/LayoutManager.hpp"
#include "hyprzones/WindowSnapper.hpp"
#include "hyprzones/Renderer.hpp"

namespace HyprZones {

HANDLE g_handle = nullptr;

std::unique_ptr<ZoneManager>   g_zoneManager;
std::unique_ptr<LayoutManager> g_layoutManager;
std::unique_ptr<WindowSnapper> g_windowSnapper;
std::unique_ptr<Renderer>      g_renderer;
Config                         g_config;
DragState                      g_dragState;

void initGlobals() {
    g_zoneManager   = std::make_unique<ZoneManager>();
    g_layoutManager = std::make_unique<LayoutManager>();
    g_windowSnapper = std::make_unique<WindowSnapper>();
    g_renderer      = std::make_unique<Renderer>();
    g_config        = Config{};
    g_dragState.reset();
}

void cleanupGlobals() {
    g_zoneManager.reset();
    g_layoutManager.reset();
    g_windowSnapper.reset();
    g_renderer.reset();
}

}  // namespace HyprZones
