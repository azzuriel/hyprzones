#include "hyprzones/LayoutManager.hpp"
#include <fstream>

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

Layout* LayoutManager::getLayoutForMonitor(Config& config,
                                           const std::string& monitorName,
                                           int workspace) {
    for (auto& layout : config.layouts) {
        bool monitorMatch = layout.monitor.empty() || layout.monitor == monitorName;
        bool wsMatch      = layout.workspace < 0 || layout.workspace == workspace;

        if (monitorMatch && wsMatch) {
            return &layout;
        }
    }

    if (!config.activeLayout.empty()) {
        auto it = config.layoutIndex.find(config.activeLayout);
        if (it != config.layoutIndex.end() && it->second < config.layouts.size()) {
            return &config.layouts[it->second];
        }
    }

    if (!config.layouts.empty()) {
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

bool LayoutManager::saveLayouts(const std::string& path, const std::vector<Layout>& layouts) {
    std::ofstream file(path);
    if (!file.is_open()) {
        return false;
    }

    for (const auto& layout : layouts) {
        file << "[[layouts]]\n";
        file << "name = \"" << layout.name << "\"\n";

        if (!layout.hotkey.empty()) {
            file << "hotkey = \"" << layout.hotkey << "\"\n";
        }
        if (!layout.monitor.empty()) {
            file << "monitor = \"" << layout.monitor << "\"\n";
        }
        if (layout.workspace >= 0) {
            file << "workspace = " << layout.workspace << "\n";
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

    return true;
}

std::vector<Layout> LayoutManager::loadLayouts(const std::string& path) {
    // Layouts are loaded via ConfigParser, this is for standalone use
    std::vector<Layout> layouts;
    std::ifstream file(path);
    if (!file.is_open()) {
        return layouts;
    }

    // For now, delegate to the main config loading mechanism
    // This function exists for potential future standalone layout file support
    return layouts;
}

}  // namespace HyprZones
