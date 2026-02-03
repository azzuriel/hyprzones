/**
 * ZoneManager - Manages zone definitions and hit testing
 */

#include "hyprzones.hpp"

namespace HyprZones {

class ZoneManager {
public:
    ZoneManager() = default;
    ~ZoneManager() = default;

    /**
     * Set the current layout's zones
     */
    void setZones(const std::vector<Zone>& zones) {
        m_zones = zones;
    }

    /**
     * Get all zones
     */
    const std::vector<Zone>& getZones() const {
        return m_zones;
    }

    /**
     * Recalculate pixel positions for all zones based on monitor size
     */
    void recalculatePixelPositions(int monitorX, int monitorY, int monitorWidth, int monitorHeight) {
        for (auto& zone : m_zones) {
            zone.pixelX = monitorX + static_cast<int>(monitorWidth * zone.x / 100.0);
            zone.pixelY = monitorY + static_cast<int>(monitorHeight * zone.y / 100.0);
            zone.pixelWidth = static_cast<int>(monitorWidth * zone.width / 100.0);
            zone.pixelHeight = static_cast<int>(monitorHeight * zone.height / 100.0);
        }
    }

    /**
     * Find zone at given pixel coordinates
     * Returns zone index or -1 if no zone found
     */
    int findZoneAtPoint(int x, int y) const {
        for (size_t i = 0; i < m_zones.size(); ++i) {
            if (m_zones[i].containsPoint(x, y)) {
                return static_cast<int>(i);
            }
        }
        return -1;
    }

    /**
     * Find zones near a point (for multi-zone snapping)
     * Returns indices of zones whose edges are within threshold of the point
     */
    std::vector<int> findAdjacentZones(int x, int y, int threshold = 20) const {
        std::vector<int> result;

        for (size_t i = 0; i < m_zones.size(); ++i) {
            const auto& zone = m_zones[i];

            // Check if point is near any edge
            bool nearLeft = std::abs(x - zone.pixelX) < threshold;
            bool nearRight = std::abs(x - (zone.pixelX + zone.pixelWidth)) < threshold;
            bool nearTop = std::abs(y - zone.pixelY) < threshold;
            bool nearBottom = std::abs(y - (zone.pixelY + zone.pixelHeight)) < threshold;

            // Check if point is within vertical/horizontal range
            bool inVerticalRange = y >= zone.pixelY && y <= zone.pixelY + zone.pixelHeight;
            bool inHorizontalRange = x >= zone.pixelX && x <= zone.pixelX + zone.pixelWidth;

            if ((nearLeft || nearRight) && inVerticalRange) {
                result.push_back(static_cast<int>(i));
            } else if ((nearTop || nearBottom) && inHorizontalRange) {
                result.push_back(static_cast<int>(i));
            }
        }

        return result;
    }

    /**
     * Get combined bounds of multiple zones
     */
    void getCombinedBounds(const std::vector<int>& zoneIndices,
                           int& outX, int& outY, int& outWidth, int& outHeight) const {
        if (zoneIndices.empty()) {
            outX = outY = outWidth = outHeight = 0;
            return;
        }

        int minX = INT_MAX, minY = INT_MAX;
        int maxX = INT_MIN, maxY = INT_MIN;

        for (int idx : zoneIndices) {
            if (idx < 0 || idx >= static_cast<int>(m_zones.size())) continue;

            const auto& zone = m_zones[idx];
            minX = std::min(minX, zone.pixelX);
            minY = std::min(minY, zone.pixelY);
            maxX = std::max(maxX, zone.pixelX + zone.pixelWidth);
            maxY = std::max(maxY, zone.pixelY + zone.pixelHeight);
        }

        outX = minX;
        outY = minY;
        outWidth = maxX - minX;
        outHeight = maxY - minY;
    }

private:
    std::vector<Zone> m_zones;
};

} // namespace HyprZones
