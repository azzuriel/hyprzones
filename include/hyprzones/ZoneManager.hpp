#pragma once

#include "Layout.hpp"
#include <vector>

namespace HyprZones {

class ZoneManager {
  public:
    // Compute pixel coordinates for zones based on monitor geometry
    void computeZonePixels(Layout& layout, double monitorX, double monitorY,
                           double monitorW, double monitorH, int gap);

    // Find which zone(s) contain a point
    std::vector<int> getZonesAtPoint(const Layout& layout, double px, double py);

    // Get smallest zone at point (for overlapping zones)
    int getSmallestZoneAtPoint(const Layout& layout, double px, double py);

    // Get zone range between two zones (for multi-zone selection)
    std::vector<int> getZoneRange(const Layout& layout, int startZone, int endZone);

    // Get combined bounding box for multiple zones
    void getCombinedZoneBox(const Layout& layout, const std::vector<int>& indices,
                            double& outX, double& outY, double& outW, double& outH);
};

}  // namespace HyprZones
