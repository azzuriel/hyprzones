#pragma once

#include "Layout.hpp"
#include "Config.hpp"
#include <string>
#include <vector>

namespace HyprZones {

class LayoutManager {
  public:
    // Generate layout from template
    Layout generateFromTemplate(const std::string& templateType,
                                int cols, int rows,
                                const std::string& name = "");

    // Get layout for current context
    Layout* getLayoutForMonitor(Config& config,
                                const std::string& monitorName,
                                int workspace);

    // Layout switching
    void switchLayout(Config& config, const std::string& layoutName);
    void cycleLayout(Config& config, int direction);

    // Persistence
    bool saveLayouts(const std::string& path, const std::vector<Layout>& layouts,
                     const std::vector<LayoutMapping>& mappings);
    std::vector<Layout> loadLayouts(const std::string& path);
    std::vector<LayoutMapping> loadMappings(const std::string& path);

  private:
    // Check if workspace matches a workspace pattern (e.g. "1-5", "1,3,5", "*")
    bool workspaceMatchesPattern(int workspace, const std::string& pattern);
};

}  // namespace HyprZones
