#include "hyprzones/ZoneManager.hpp"
#include <algorithm>
#include <limits>
#include <set>

namespace HyprZones {

void ZoneManager::computeZonePixels(Layout& layout, double monitorX, double monitorY,
                                    double monitorW, double monitorH, int spacingH, int spacingV) {
    // Simple spacing: half-gap insets on internal edges only
    // - spacingH = horizontal gap line = between ROWS (affects top/bottom)
    // - spacingV = vertical gap line = between COLUMNS (affects left/right)
    // - NO spacing at outer edges (x=0, y=0, x+w=1, y+h=1)

    double halfGapH = spacingH / 2.0;
    double halfGapV = spacingV / 2.0;

    for (auto& zone : layout.zones) {
        double rawX = zone.x * monitorW;
        double rawY = zone.y * monitorH;
        double rawW = zone.width * monitorW;
        double rawH = zone.height * monitorH;

        // Inset by half-gap on internal edges only (not at 0 or 1)
        double leftInset = zone.x > 0.001 ? halfGapV : 0;
        double rightInset = (zone.x + zone.width) < 0.999 ? halfGapV : 0;
        double topInset = zone.y > 0.001 ? halfGapH : 0;
        double bottomInset = (zone.y + zone.height) < 0.999 ? halfGapH : 0;

        zone.pixelX = monitorX + rawX + leftInset;
        zone.pixelY = monitorY + rawY + topInset;
        zone.pixelW = rawW - leftInset - rightInset;
        zone.pixelH = rawH - topInset - bottomInset;
    }
}

std::vector<int> ZoneManager::getZonesAtPoint(const Layout& layout, double px, double py) {
    std::vector<int> result;

    for (size_t i = 0; i < layout.zones.size(); ++i) {
        if (layout.zones[i].containsPoint(px, py)) {
            result.push_back(static_cast<int>(i));
        }
    }

    return result;
}

int ZoneManager::getSmallestZoneAtPoint(const Layout& layout, double px, double py) {
    int    bestIndex = -1;
    double bestArea  = std::numeric_limits<double>::max();

    for (size_t i = 0; i < layout.zones.size(); ++i) {
        const auto& zone = layout.zones[i];
        if (zone.containsPoint(px, py)) {
            double area = zone.area();
            if (area < bestArea) {
                bestArea  = area;
                bestIndex = static_cast<int>(i);
            }
        }
    }

    return bestIndex;
}

std::vector<int> ZoneManager::getZoneRange(const Layout& layout, int startZone, int endZone) {
    std::vector<int> result;

    if (startZone < 0 || endZone < 0) {
        return result;
    }

    int minZ = std::min(startZone, endZone);
    int maxZ = std::max(startZone, endZone);

    for (int i = minZ; i <= maxZ && i < static_cast<int>(layout.zones.size()); ++i) {
        result.push_back(i);
    }

    return result;
}

void ZoneManager::getCombinedZoneBox(const Layout& layout, const std::vector<int>& indices,
                                     double& outX, double& outY, double& outW, double& outH) {
    if (indices.empty()) {
        outX = outY = outW = outH = 0;
        return;
    }

    double minX = std::numeric_limits<double>::max();
    double minY = std::numeric_limits<double>::max();
    double maxX = std::numeric_limits<double>::lowest();
    double maxY = std::numeric_limits<double>::lowest();

    for (int idx : indices) {
        if (idx < 0 || idx >= static_cast<int>(layout.zones.size())) {
            continue;
        }

        const auto& zone = layout.zones[idx];
        minX = std::min(minX, zone.pixelX);
        minY = std::min(minY, zone.pixelY);
        maxX = std::max(maxX, zone.pixelX + zone.pixelW);
        maxY = std::max(maxY, zone.pixelY + zone.pixelH);
    }

    outX = minX;
    outY = minY;
    outW = maxX - minX;
    outH = maxY - minY;
}

}  // namespace HyprZones
