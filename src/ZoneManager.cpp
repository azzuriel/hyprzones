#include "hyprzones/ZoneManager.hpp"
#include <algorithm>
#include <limits>

namespace HyprZones {

void ZoneManager::computeZonePixels(Layout& layout, double monitorX, double monitorY,
                                    double monitorW, double monitorH, int gap) {
    for (auto& zone : layout.zones) {
        zone.pixelX = monitorX + (zone.x * monitorW) + gap;
        zone.pixelY = monitorY + (zone.y * monitorH) + gap;
        zone.pixelW = (zone.width * monitorW) - (2 * gap);
        zone.pixelH = (zone.height * monitorH) - (2 * gap);
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
