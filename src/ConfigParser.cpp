#include "hyprzones/Config.hpp"
#include "hyprzones/Globals.hpp"
#include "hyprzones/LayoutManager.hpp"
#include <fstream>
#include <cstdlib>

// Debug log to file
static void logToFile(const std::string& msg) {
    std::ofstream f("/tmp/hyprzones.log", std::ios::app);
    if (f) f << msg << "\n";
}

namespace HyprZones {

std::string getConfigPath() {
    const char* xdgConfig = std::getenv("XDG_CONFIG_HOME");
    std::string basePath;

    if (xdgConfig) {
        basePath = xdgConfig;
    } else {
        const char* home = std::getenv("HOME");
        basePath = home ? std::string(home) + "/.config" : "~/.config";
    }

    return basePath + "/hypr/hyprzones.toml";
}

Config loadConfig(const std::string& path) {
    Config config;

    if (g_layoutManager) {
        config.layouts = g_layoutManager->loadLayouts(path);
        for (size_t i = 0; i < config.layouts.size(); ++i) {
            config.layoutIndex[config.layouts[i].name] = i;
        }
        if (!config.layouts.empty()) {
            config.activeLayout = config.layouts[0].name;
        }

        config.mappings = g_layoutManager->loadMappings(path);
    }

    return config;
}

void reloadConfig() {
    g_config = loadConfig(getConfigPath());

    g_config.layoutIndex.clear();
    for (size_t i = 0; i < g_config.layouts.size(); ++i) {
        g_config.layoutIndex[g_config.layouts[i].name] = i;
    }

    // Debug: Log loaded mappings
    logToFile("[HyprZones] Config reloaded: " + std::to_string(g_config.layouts.size()) +
              " layouts, " + std::to_string(g_config.mappings.size()) + " mappings");
    for (const auto& m : g_config.mappings) {
        logToFile("[HyprZones]   Mapping: monitor=" + m.monitor +
                  " ws=" + m.workspaces + " -> layout=" + m.layout);
    }
}

}  // namespace HyprZones
