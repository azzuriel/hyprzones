/**
 * LayoutManager - Manages layout persistence and switching
 */

#include "hyprzones.hpp"
#include <fstream>
#include <filesystem>

namespace HyprZones {

class LayoutManager {
public:
    LayoutManager() = default;
    ~LayoutManager() = default;

    /**
     * Load layouts from config
     */
    void loadLayouts(const std::vector<Layout>& layouts) {
        m_layouts = layouts;
        m_layoutMap.clear();
        for (size_t i = 0; i < m_layouts.size(); ++i) {
            m_layoutMap[m_layouts[i].name] = i;
        }
    }

    /**
     * Get layout by name
     */
    const Layout* getLayout(const std::string& name) const {
        auto it = m_layoutMap.find(name);
        if (it != m_layoutMap.end()) {
            return &m_layouts[it->second];
        }
        return nullptr;
    }

    /**
     * Get all layout names
     */
    std::vector<std::string> getLayoutNames() const {
        std::vector<std::string> names;
        names.reserve(m_layouts.size());
        for (const auto& layout : m_layouts) {
            names.push_back(layout.name);
        }
        return names;
    }

    /**
     * Set active layout
     */
    bool setActiveLayout(const std::string& name) {
        auto it = m_layoutMap.find(name);
        if (it != m_layoutMap.end()) {
            m_activeLayoutIndex = it->second;
            return true;
        }
        return false;
    }

    /**
     * Get active layout
     */
    const Layout* getActiveLayout() const {
        if (m_activeLayoutIndex >= 0 && m_activeLayoutIndex < static_cast<int>(m_layouts.size())) {
            return &m_layouts[m_activeLayoutIndex];
        }
        return nullptr;
    }

    /**
     * Create layout from template
     */
    static Layout createFromTemplate(const std::string& name,
                                     const std::string& templateType,
                                     int param1 = 0,
                                     int param2 = 0) {
        Layout layout;
        layout.name = name;
        layout.templateType = templateType;

        if (templateType == "columns") {
            int cols = param1 > 0 ? param1 : 3;
            double colWidth = 100.0 / cols;
            for (int i = 0; i < cols; ++i) {
                Zone zone;
                zone.name = "column-" + std::to_string(i + 1);
                zone.index = i;
                zone.x = i * colWidth;
                zone.y = 0;
                zone.width = colWidth;
                zone.height = 100;
                layout.zones.push_back(zone);
            }
        }
        else if (templateType == "rows") {
            int rows = param1 > 0 ? param1 : 3;
            double rowHeight = 100.0 / rows;
            for (int i = 0; i < rows; ++i) {
                Zone zone;
                zone.name = "row-" + std::to_string(i + 1);
                zone.index = i;
                zone.x = 0;
                zone.y = i * rowHeight;
                zone.width = 100;
                zone.height = rowHeight;
                layout.zones.push_back(zone);
            }
        }
        else if (templateType == "grid") {
            int cols = param1 > 0 ? param1 : 2;
            int rows = param2 > 0 ? param2 : 2;
            double colWidth = 100.0 / cols;
            double rowHeight = 100.0 / rows;
            int idx = 0;
            for (int r = 0; r < rows; ++r) {
                for (int c = 0; c < cols; ++c) {
                    Zone zone;
                    zone.name = "cell-" + std::to_string(r + 1) + "-" + std::to_string(c + 1);
                    zone.index = idx++;
                    zone.x = c * colWidth;
                    zone.y = r * rowHeight;
                    zone.width = colWidth;
                    zone.height = rowHeight;
                    layout.zones.push_back(zone);
                }
            }
        }
        else if (templateType == "main-side") {
            // Main area (60%) + sidebar (40%)
            Zone main;
            main.name = "main";
            main.index = 0;
            main.x = 0;
            main.y = 0;
            main.width = 60;
            main.height = 100;
            layout.zones.push_back(main);

            Zone side;
            side.name = "sidebar";
            side.index = 1;
            side.x = 60;
            side.y = 0;
            side.width = 40;
            side.height = 100;
            layout.zones.push_back(side);
        }

        return layout;
    }

    /**
     * Save custom layouts to JSON file
     */
    bool saveToFile(const std::string& path) const {
        // TODO: Implement JSON serialization
        return false;
    }

    /**
     * Load custom layouts from JSON file
     */
    bool loadFromFile(const std::string& path) {
        // TODO: Implement JSON deserialization
        return false;
    }

private:
    std::vector<Layout> m_layouts;
    std::unordered_map<std::string, size_t> m_layoutMap;
    int m_activeLayoutIndex = -1;
};

} // namespace HyprZones
