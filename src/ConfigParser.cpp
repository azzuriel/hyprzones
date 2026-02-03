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

static Layout createClionAseDevLayout() {
    Layout layout;
    layout.name = "CLION_ASE_DEV";
    layout.templateType = "custom";

    // Monitor: 3840x2160
    // All positions from hyprctl clients on WS1

    int idx = 0;

    // CMake (x:22, y:97, w:947, h:227)
    Zone cmake;
    cmake.index = idx++;
    cmake.name = "CMake";
    cmake.x = 22.0 / 3840.0;
    cmake.y = 97.0 / 2160.0;
    cmake.width = 947.0 / 3840.0;
    cmake.height = 227.0 / 2160.0;
    layout.zones.push_back(cmake);

    // Client Web (x:983, y:97, w:1147, h:227)
    Zone clientWeb;
    clientWeb.index = idx++;
    clientWeb.name = "ClientWeb";
    clientWeb.x = 983.0 / 3840.0;
    clientWeb.y = 97.0 / 2160.0;
    clientWeb.width = 1147.0 / 3840.0;
    clientWeb.height = 227.0 / 2160.0;
    layout.zones.push_back(clientWeb);

    // Root (x:2145, y:97, w:1148, h:227)
    Zone root;
    root.index = idx++;
    root.name = "Root";
    root.x = 2145.0 / 3840.0;
    root.y = 97.0 / 2160.0;
    root.width = 1148.0 / 3840.0;
    root.height = 227.0 / 2160.0;
    layout.zones.push_back(root);

    // Compliance (x:3304, y:96, w:514, h:998)
    Zone compliance;
    compliance.index = idx++;
    compliance.name = "Compliance";
    compliance.x = 3304.0 / 3840.0;
    compliance.y = 96.0 / 2160.0;
    compliance.width = 514.0 / 3840.0;
    compliance.height = 998.0 / 2160.0;
    layout.zones.push_back(compliance);

    // Project (x:22, y:363, w:507, h:1480)
    Zone project;
    project.index = idx++;
    project.name = "Project";
    project.x = 22.0 / 3840.0;
    project.y = 363.0 / 2160.0;
    project.width = 507.0 / 3840.0;
    project.height = 1480.0 / 2160.0;
    layout.zones.push_back(project);

    // TODO (x:543, y:363, w:1587, h:240)
    Zone todo;
    todo.index = idx++;
    todo.name = "TODO";
    todo.x = 543.0 / 3840.0;
    todo.y = 363.0 / 2160.0;
    todo.width = 1587.0 / 3840.0;
    todo.height = 240.0 / 2160.0;
    layout.zones.push_back(todo);

    // Problems (x:2144, y:363, w:1146, h:240)
    Zone problems;
    problems.index = idx++;
    problems.name = "Problems";
    problems.x = 2144.0 / 3840.0;
    problems.y = 363.0 / 2160.0;
    problems.width = 1146.0 / 3840.0;
    problems.height = 240.0 / 2160.0;
    layout.zones.push_back(problems);

    // Terminal (x:543, y:642, w:1843, h:1201)
    Zone terminal;
    terminal.index = idx++;
    terminal.name = "Terminal";
    terminal.x = 543.0 / 3840.0;
    terminal.y = 642.0 / 2160.0;
    terminal.width = 1843.0 / 3840.0;
    terminal.height = 1201.0 / 2160.0;
    layout.zones.push_back(terminal);

    // ASE Main (x:2399, y:642, w:890, h:1200)
    Zone aseMain;
    aseMain.index = idx++;
    aseMain.name = "Main";
    aseMain.x = 2399.0 / 3840.0;
    aseMain.y = 642.0 / 2160.0;
    aseMain.width = 890.0 / 3840.0;
    aseMain.height = 1200.0 / 2160.0;
    layout.zones.push_back(aseMain);

    // Testrunner (x:3304, y:1140, w:514, h:998)
    Zone testrunner;
    testrunner.index = idx++;
    testrunner.name = "Testrunner";
    testrunner.x = 3304.0 / 3840.0;
    testrunner.y = 1140.0 / 2160.0;
    testrunner.width = 514.0 / 3840.0;
    testrunner.height = 998.0 / 2160.0;
    layout.zones.push_back(testrunner);

    // Notifications (x:22, y:1882, w:506, h:256)
    Zone notifications;
    notifications.index = idx++;
    notifications.name = "Notifications";
    notifications.x = 22.0 / 3840.0;
    notifications.y = 1882.0 / 2160.0;
    notifications.width = 506.0 / 3840.0;
    notifications.height = 256.0 / 2160.0;
    layout.zones.push_back(notifications);

    // Git (x:542, y:1882, w:1843, h:256)
    Zone git;
    git.index = idx++;
    git.name = "Git";
    git.x = 542.0 / 3840.0;
    git.y = 1882.0 / 2160.0;
    git.width = 1843.0 / 3840.0;
    git.height = 256.0 / 2160.0;
    layout.zones.push_back(git);

    // Commit (x:2399, y:1882, w:891, h:256)
    Zone commit;
    commit.index = idx++;
    commit.name = "Commit";
    commit.x = 2399.0 / 3840.0;
    commit.y = 1882.0 / 2160.0;
    commit.width = 891.0 / 3840.0;
    commit.height = 256.0 / 2160.0;
    layout.zones.push_back(commit);

    return layout;
}

Config loadConfig(const std::string& path) {
    Config config;

    // Always add CLION_ASE_DEV as default layout
    Layout clionLayout = createClionAseDevLayout();
    config.layouts.push_back(clionLayout);
    config.layoutIndex["CLION_ASE_DEV"] = 0;
    config.activeLayout = "CLION_ASE_DEV";

    std::ifstream file(path);
    if (!file.is_open()) {
        return config;
    }

    // Load additional layouts from file if present
    if (g_layoutManager) {
        auto fileLayouts = g_layoutManager->loadLayouts(path);
        for (auto& layout : fileLayouts) {
            config.layoutIndex[layout.name] = config.layouts.size();
            config.layouts.push_back(layout);
        }
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
