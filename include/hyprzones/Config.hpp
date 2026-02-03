#pragma once

#include "Layout.hpp"
#include "Color.hpp"
#include <string>
#include <vector>
#include <unordered_map>

namespace HyprZones {

// Mapping: which layout to use for a specific monitor/workspace combination
struct LayoutMapping {
    std::string monitor;      // Monitor name (e.g. "DP-1") or "*" for all
    std::string workspaces;   // Workspace range (e.g. "1-5", "1,3,5", "*" for all)
    std::string layout;       // Layout name to use
};

struct Config {
    // Activation
    std::string snapModifier    = "SHIFT";
    bool        showOnDrag      = true;
    bool        requireModifier = true;

    // Visual
    bool  showZoneNumbers = true;
    Color highlightColor  = {0.0f, 0.4f, 1.0f, 0.3f};
    Color borderColor     = {0.0f, 0.4f, 1.0f, 0.8f};
    Color inactiveColor   = {0.4f, 0.4f, 0.4f, 0.2f};
    Color numberColor     = {1.0f, 1.0f, 1.0f, 0.9f};
    int   borderWidth     = 3;

    // Behavior
    bool moveToLastKnownZone = true;
    bool restoreSizeOnUnsnap = true;
    bool allowMultiZone      = true;
    bool flashOnLayoutChange = true;
    int  sensitivityRadius   = 20;

    // Layouts
    std::vector<Layout>                     layouts;
    std::unordered_map<std::string, size_t> layoutIndex;  // name -> index in layouts
    std::string                             activeLayout;

    // Mappings: monitor/workspace -> layout
    std::vector<LayoutMapping> mappings;
};

std::string getConfigPath();
Config      loadConfig(const std::string& path);
void        reloadConfig();

}  // namespace HyprZones
