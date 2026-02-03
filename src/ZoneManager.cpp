#include "hyprzones/ZoneManager.hpp"
#include <algorithm>
#include <limits>
#include <set>

namespace HyprZones {

void ZoneManager::computeZonePixels(Layout& layout, double monitorX, double monitorY,
                                    double monitorW, double monitorH, int spacing) {
    // FancyZones-style spacing:
    // - spacing at monitor edges AND between adjacent zones
    // - For n grid lines: usable_space = total - spacing * n
    // - Zone positions account for accumulated spacing at each grid line

    // Collect unique X and Y boundaries (grid lines)
    std::set<double> xLines, yLines;
    for (const auto& zone : layout.zones) {
        xLines.insert(zone.x);
        xLines.insert(zone.x + zone.width);
        yLines.insert(zone.y);
        yLines.insert(zone.y + zone.height);
    }

    // Convert to sorted vectors for indexing
    std::vector<double> xVec(xLines.begin(), xLines.end());
    std::vector<double> yVec(yLines.begin(), yLines.end());

    // Number of spacing slots = number of grid lines
    int xSlots = static_cast<int>(xVec.size());
    int ySlots = static_cast<int>(yVec.size());

    // Usable space after all spacing is removed
    double usableW = monitorW - (spacing * xSlots);
    double usableH = monitorH - (spacing * ySlots);

    for (auto& zone : layout.zones) {
        // Find index of zone's start boundary in grid
        int xStartIdx = 0, yStartIdx = 0;
        int xEndIdx = 0, yEndIdx = 0;

        for (size_t i = 0; i < xVec.size(); ++i) {
            if (std::abs(xVec[i] - zone.x) < 0.001) xStartIdx = static_cast<int>(i);
            if (std::abs(xVec[i] - (zone.x + zone.width)) < 0.001) xEndIdx = static_cast<int>(i);
        }
        for (size_t i = 0; i < yVec.size(); ++i) {
            if (std::abs(yVec[i] - zone.y) < 0.001) yStartIdx = static_cast<int>(i);
            if (std::abs(yVec[i] - (zone.y + zone.height)) < 0.001) yEndIdx = static_cast<int>(i);
        }

        // Calculate pixel positions:
        // - Position = usable_space * percent + spacing * (grid_line_index + 1)
        // - The +1 accounts for the leading edge spacing
        zone.pixelX = monitorX + (zone.x * usableW) + (spacing * (xStartIdx + 1));
        zone.pixelY = monitorY + (zone.y * usableH) + (spacing * (yStartIdx + 1));

        // Width/Height spans from start to end grid line
        double endX = monitorX + ((zone.x + zone.width) * usableW) + (spacing * xEndIdx);
        double endY = monitorY + ((zone.y + zone.height) * usableH) + (spacing * yEndIdx);

        zone.pixelW = endX - zone.pixelX;
        zone.pixelH = endY - zone.pixelY;
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
