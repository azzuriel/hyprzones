#include "hyprzones/LayoutManager.hpp"
#include <fstream>

// Debug log to file
static void logToFile(const std::string& msg) {
    std::ofstream f("/tmp/hyprzones.log", std::ios::app);
    if (f) f << msg << "\n";
}

namespace HyprZones {

Layout LayoutManager::generateFromTemplate(const std::string& templateType,
                                           int cols, int rows,
                                           const std::string& name) {
    Layout layout;
    layout.name         = name.empty() ? templateType : name;
    layout.templateType = templateType;
    layout.columns      = cols;
    layout.rows         = rows;

    int zoneIndex = 0;

    if (templateType == "columns") {
        double colWidth = 1.0 / cols;
        for (int c = 0; c < cols; ++c) {
            Zone zone;
            zone.index  = zoneIndex++;
            zone.name   = "Column " + std::to_string(c + 1);
            zone.x      = c * colWidth;
            zone.y      = 0.0;
            zone.width  = colWidth;
            zone.height = 1.0;
            layout.zones.push_back(zone);
        }
    } else if (templateType == "rows") {
        double rowHeight = 1.0 / rows;
        for (int r = 0; r < rows; ++r) {
            Zone zone;
            zone.index  = zoneIndex++;
            zone.name   = "Row " + std::to_string(r + 1);
            zone.x      = 0.0;
            zone.y      = r * rowHeight;
            zone.width  = 1.0;
            zone.height = rowHeight;
            layout.zones.push_back(zone);
        }
    } else if (templateType == "grid") {
        double colWidth  = 1.0 / cols;
        double rowHeight = 1.0 / rows;
        for (int r = 0; r < rows; ++r) {
            for (int c = 0; c < cols; ++c) {
                Zone zone;
                zone.index  = zoneIndex++;
                zone.name   = "Cell " + std::to_string(r + 1) + "x" + std::to_string(c + 1);
                zone.x      = c * colWidth;
                zone.y      = r * rowHeight;
                zone.width  = colWidth;
                zone.height = rowHeight;
                layout.zones.push_back(zone);
            }
        }
    } else if (templateType == "priority-grid") {
        // Main zone (60%) + side column (40%, 2 rows)
        Zone main;
        main.index  = zoneIndex++;
        main.name   = "Main";
        main.x      = 0.0;
        main.y      = 0.0;
        main.width  = 0.6;
        main.height = 1.0;
        layout.zones.push_back(main);

        Zone top;
        top.index  = zoneIndex++;
        top.name   = "Top Right";
        top.x      = 0.6;
        top.y      = 0.0;
        top.width  = 0.4;
        top.height = 0.5;
        layout.zones.push_back(top);

        Zone bottom;
        bottom.index  = zoneIndex++;
        bottom.name   = "Bottom Right";
        bottom.x      = 0.6;
        bottom.y      = 0.5;
        bottom.width  = 0.4;
        bottom.height = 0.5;
        layout.zones.push_back(bottom);
    }

    return layout;
}

bool LayoutManager::workspaceMatchesPattern(int workspace, const std::string& pattern) {
    if (pattern.empty() || pattern == "*") {
        return true;
    }

    // Handle comma-separated values: "1,3,5"
    if (pattern.find(',') != std::string::npos) {
        std::string p = pattern;
        size_t pos = 0;
        while ((pos = p.find(',')) != std::string::npos) {
            std::string token = p.substr(0, pos);
            if (!token.empty() && std::stoi(token) == workspace) {
                return true;
            }
            p.erase(0, pos + 1);
        }
        if (!p.empty() && std::stoi(p) == workspace) {
            return true;
        }
        return false;
    }

    // Handle range: "1-5"
    if (pattern.find('-') != std::string::npos) {
        size_t dashPos = pattern.find('-');
        int start = std::stoi(pattern.substr(0, dashPos));
        int end = std::stoi(pattern.substr(dashPos + 1));
        return workspace >= start && workspace <= end;
    }

    // Single number
    return std::stoi(pattern) == workspace;
}

Layout* LayoutManager::getLayoutForMonitor(Config& config,
                                           const std::string& monitorName,
                                           int workspace) {
    // Check mappings first (most specific match wins)
    for (const auto& mapping : config.mappings) {
        bool monitorMatch = mapping.monitor == "*" || mapping.monitor == monitorName;
        bool wsMatch = workspaceMatchesPattern(workspace, mapping.workspaces);

        if (monitorMatch && wsMatch) {
            auto it = config.layoutIndex.find(mapping.layout);
            if (it != config.layoutIndex.end() && it->second < config.layouts.size()) {
                logToFile("[HyprZones] getLayoutForMonitor: mon=" + monitorName +
                          " ws=" + std::to_string(workspace) + " -> matched mapping -> layout=" +
                          mapping.layout);
                return &config.layouts[it->second];
            }
        }
    }

    // Fall back to active layout
    if (!config.activeLayout.empty()) {
        auto it = config.layoutIndex.find(config.activeLayout);
        if (it != config.layoutIndex.end() && it->second < config.layouts.size()) {
            logToFile("[HyprZones] getLayoutForMonitor: mon=" + monitorName +
                      " ws=" + std::to_string(workspace) + " -> no mapping, using active=" +
                      config.activeLayout);
            return &config.layouts[it->second];
        }
    }

    // Last resort: first layout
    if (!config.layouts.empty()) {
        logToFile("[HyprZones] getLayoutForMonitor: mon=" + monitorName +
                  " ws=" + std::to_string(workspace) + " -> fallback to first layout=" +
                  config.layouts[0].name);
        return &config.layouts[0];
    }

    return nullptr;
}

void LayoutManager::switchLayout(Config& config, const std::string& layoutName) {
    auto it = config.layoutIndex.find(layoutName);
    if (it != config.layoutIndex.end()) {
        config.activeLayout = layoutName;
    }
}

void LayoutManager::cycleLayout(Config& config, int direction) {
    if (config.layouts.empty()) {
        return;
    }

    auto it = config.layoutIndex.find(config.activeLayout);
    size_t currentIdx = (it != config.layoutIndex.end()) ? it->second : 0;

    int newIdx = static_cast<int>(currentIdx) + direction;
    int count  = static_cast<int>(config.layouts.size());

    newIdx = ((newIdx % count) + count) % count;

    config.activeLayout = config.layouts[newIdx].name;
}

bool LayoutManager::saveLayouts(const std::string& path, const std::vector<Layout>& layouts,
                                 const std::vector<LayoutMapping>& mappings) {
    std::ofstream file(path);
    if (!file.is_open()) {
        return false;
    }

    // Write layouts
    for (const auto& layout : layouts) {
        file << "[[layouts]]\n";
        file << "name = \"" << layout.name << "\"\n";
        file << "spacing_h = " << layout.spacingH << "\n";
        file << "spacing_v = " << layout.spacingV << "\n";

        if (!layout.hotkey.empty()) {
            file << "hotkey = \"" << layout.hotkey << "\"\n";
        }
        if (!layout.templateType.empty()) {
            file << "template = \"" << layout.templateType << "\"\n";
            if (layout.columns > 0) file << "columns = " << layout.columns << "\n";
            if (layout.rows > 0) file << "rows = " << layout.rows << "\n";
        }

        for (const auto& zone : layout.zones) {
            file << "\n[[layouts.zones]]\n";
            file << "name = \"" << zone.name << "\"\n";
            file << "x = " << static_cast<int>(zone.x * 100) << "\n";
            file << "y = " << static_cast<int>(zone.y * 100) << "\n";
            file << "width = " << static_cast<int>(zone.width * 100) << "\n";
            file << "height = " << static_cast<int>(zone.height * 100) << "\n";
        }

        file << "\n";
    }

    // Write mappings
    if (!mappings.empty()) {
        file << "# Monitor/Workspace to Layout mappings\n";
        for (const auto& mapping : mappings) {
            file << "[[mappings]]\n";
            file << "monitor = \"" << mapping.monitor << "\"\n";
            file << "workspaces = \"" << mapping.workspaces << "\"\n";
            file << "layout = \"" << mapping.layout << "\"\n";
            file << "\n";
        }
    }

    return true;
}

std::vector<Layout> LayoutManager::loadLayouts(const std::string& path) {
    std::vector<Layout> layouts;
    std::ifstream file(path);
    if (!file.is_open()) {
        return layouts;
    }

    std::string line;
    Layout currentLayout;
    Zone currentZone;
    bool inLayout = false;
    bool inZone = false;

    auto trim = [](std::string& s) {
        s.erase(0, s.find_first_not_of(" \t\r\n"));
        s.erase(s.find_last_not_of(" \t\r\n") + 1);
    };

    auto parseString = [](const std::string& value) -> std::string {
        std::string result = value;
        if (result.front() == '"') result.erase(0, 1);
        if (result.back() == '"') result.pop_back();
        return result;
    };

    while (std::getline(file, line)) {
        trim(line);
        if (line.empty() || line[0] == '#') continue;

        if (line == "[[layouts]]") {
            if (inLayout && !currentLayout.name.empty()) {
                if (inZone && !currentZone.name.empty()) {
                    currentLayout.zones.push_back(currentZone);
                }
                layouts.push_back(currentLayout);
            }
            currentLayout = Layout();
            currentZone = Zone();
            inLayout = true;
            inZone = false;
            continue;
        }

        if (line == "[[layouts.zones]]") {
            if (inZone && !currentZone.name.empty()) {
                currentLayout.zones.push_back(currentZone);
            }
            currentZone = Zone();
            currentZone.index = static_cast<int>(currentLayout.zones.size());
            inZone = true;
            continue;
        }

        size_t eq = line.find('=');
        if (eq == std::string::npos) continue;

        std::string key = line.substr(0, eq);
        std::string value = line.substr(eq + 1);
        trim(key);
        trim(value);

        if (inZone) {
            if (key == "name") currentZone.name = parseString(value);
            else if (key == "x") currentZone.x = std::stod(value) / 100.0;
            else if (key == "y") currentZone.y = std::stod(value) / 100.0;
            else if (key == "width") currentZone.width = std::stod(value) / 100.0;
            else if (key == "height") currentZone.height = std::stod(value) / 100.0;
        } else if (inLayout) {
            if (key == "name") currentLayout.name = parseString(value);
            else if (key == "spacing_h") currentLayout.spacingH = std::stoi(value);
            else if (key == "spacing_v") currentLayout.spacingV = std::stoi(value);
            else if (key == "hotkey") currentLayout.hotkey = parseString(value);
            else if (key == "template") currentLayout.templateType = parseString(value);
            else if (key == "columns") currentLayout.columns = std::stoi(value);
            else if (key == "rows") currentLayout.rows = std::stoi(value);
        }
    }

    if (inLayout && !currentLayout.name.empty()) {
        if (inZone && !currentZone.name.empty()) {
            currentLayout.zones.push_back(currentZone);
        }
        layouts.push_back(currentLayout);
    }

    return layouts;
}

std::vector<LayoutMapping> LayoutManager::loadMappings(const std::string& path) {
    std::vector<LayoutMapping> mappings;
    std::ifstream file(path);
    if (!file.is_open()) {
        return mappings;
    }

    std::string line;
    LayoutMapping currentMapping;
    bool inMapping = false;

    auto trim = [](std::string& s) {
        s.erase(0, s.find_first_not_of(" \t\r\n"));
        s.erase(s.find_last_not_of(" \t\r\n") + 1);
    };

    auto parseString = [](const std::string& value) -> std::string {
        std::string result = value;
        if (result.front() == '"') result.erase(0, 1);
        if (result.back() == '"') result.pop_back();
        return result;
    };

    while (std::getline(file, line)) {
        trim(line);
        if (line.empty() || line[0] == '#') continue;

        if (line == "[[mappings]]") {
            if (inMapping && !currentMapping.layout.empty()) {
                mappings.push_back(currentMapping);
            }
            currentMapping = LayoutMapping();
            currentMapping.workspaces = "*";
            inMapping = true;
            continue;
        }

        // Skip other sections
        if (line.substr(0, 2) == "[[" && line != "[[mappings]]") {
            if (inMapping && !currentMapping.layout.empty()) {
                mappings.push_back(currentMapping);
            }
            inMapping = false;
            continue;
        }

        if (!inMapping) continue;

        size_t eq = line.find('=');
        if (eq == std::string::npos) continue;

        std::string key = line.substr(0, eq);
        std::string value = line.substr(eq + 1);
        trim(key);
        trim(value);

        if (key == "monitor") currentMapping.monitor = parseString(value);
        else if (key == "workspaces") currentMapping.workspaces = parseString(value);
        else if (key == "layout") currentMapping.layout = parseString(value);
    }

    if (inMapping && !currentMapping.layout.empty()) {
        mappings.push_back(currentMapping);
    }

    return mappings;
}

}  // namespace HyprZones
