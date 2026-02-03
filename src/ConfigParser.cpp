#include "hyprzones/Config.hpp"
#include "hyprzones/Globals.hpp"
#include "hyprzones/LayoutManager.hpp"
#include <fstream>
#include <cstdlib>

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

    std::ifstream file(path);
    if (!file.is_open()) {
        if (g_layoutManager) {
            Layout defaultLayout = g_layoutManager->generateFromTemplate("columns", 3, 1, "default");
            config.layouts.push_back(defaultLayout);
            config.layoutIndex["default"] = 0;
            config.activeLayout = "default";
        }
        return config;
    }

    if (g_layoutManager) {
        Layout defaultLayout = g_layoutManager->generateFromTemplate("columns", 3, 1, "default");
        config.layouts.push_back(defaultLayout);
        config.layoutIndex["default"] = 0;
        config.activeLayout = "default";
    }

    return config;
}

void reloadConfig() {
    g_config = loadConfig(getConfigPath());

    g_config.layoutIndex.clear();
    for (size_t i = 0; i < g_config.layouts.size(); ++i) {
        g_config.layoutIndex[g_config.layouts[i].name] = i;
    }
}

}  // namespace HyprZones
