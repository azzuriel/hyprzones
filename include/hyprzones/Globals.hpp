#pragma once

#define WLR_USE_UNSTABLE
#include <hyprland/src/plugins/PluginAPI.hpp>

#include "Forward.hpp"
#include <memory>

namespace HyprZones {

// Plugin handle - set in PLUGIN_INIT
extern HANDLE g_handle;

// Global instances
extern std::unique_ptr<ZoneManager>   g_zoneManager;
extern std::unique_ptr<LayoutManager> g_layoutManager;
extern std::unique_ptr<WindowSnapper> g_windowSnapper;
extern std::unique_ptr<Renderer>      g_renderer;
extern Config                         g_config;
extern DragState                      g_dragState;

// Initialize all globals
void initGlobals();

// Cleanup all globals
void cleanupGlobals();

}  // namespace HyprZones
