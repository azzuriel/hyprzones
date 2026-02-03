#pragma once

#include "Layout.hpp"
#include <vector>
#include <string>
#include <unordered_map>

namespace HyprZones {

struct WindowMemory {
    std::string      layoutName;
    std::vector<int> zoneIndices;
    double           originalX = 0;
    double           originalY = 0;
    double           originalW = 0;
    double           originalH = 0;
};

class WindowSnapper {
  public:
    // Snap window to zone(s)
    void snapToZones(void* window, const Layout& layout,
                     const std::vector<int>& zoneIndices);

    // Unsnap window (restore original size/position)
    void unsnap(void* window);

    // Memory management
    void        rememberWindow(void* window, const std::string& layoutName,
                               const std::vector<int>& zoneIndices,
                               double origX, double origY, double origW, double origH);
    void        forgetWindow(void* window);
    WindowMemory* getMemory(void* window);

    // Restore all windows to remembered zones
    void restoreAll(const Layout& layout);

  private:
    std::unordered_map<void*, WindowMemory> m_memory;
};

}  // namespace HyprZones
