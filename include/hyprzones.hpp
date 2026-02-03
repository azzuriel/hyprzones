#pragma once

#include <string>
#include <vector>
#include <memory>
#include <optional>
#include <unordered_map>

namespace HyprZones {

// Forward declarations
class Zone;
class Layout;
class ZoneManager;
class LayoutManager;
class WindowSnapper;
class ConfigParser;
class Renderer;

/**
 * Represents a rectangular zone on a monitor
 */
struct Zone {
    std::string name;
    int index;

    // Position and size as percentages (0-100)
    double x;
    double y;
    double width;
    double height;

    // Computed pixel values (set at runtime)
    int pixelX = 0;
    int pixelY = 0;
    int pixelWidth = 0;
    int pixelHeight = 0;

    // Check if point is inside zone
    bool containsPoint(int px, int py) const {
        return px >= pixelX && px < pixelX + pixelWidth &&
               py >= pixelY && py < pixelY + pixelHeight;
    }
};

/**
 * A layout is a collection of zones for a specific monitor
 */
struct Layout {
    std::string name;
    std::string hotkey;
    std::string monitor;  // empty = all monitors
    std::vector<Zone> zones;

    // Template-based layouts
    std::string templateType;  // "columns", "rows", "grid", "custom"
    int columns = 0;
    int rows = 0;
};

/**
 * Configuration for HyprZones
 */
struct Config {
    // Activation
    std::string snapModifier = "SHIFT";  // Key to hold while dragging
    bool snapOnDragStart = false;        // Show zones immediately on drag

    // Visual
    bool showZoneNumbers = true;
    std::string zoneHighlightColor = "rgba(0, 100, 255, 0.3)";
    std::string zoneBorderColor = "rgba(0, 100, 255, 0.8)";
    std::string zoneInactiveColor = "rgba(100, 100, 100, 0.2)";
    std::string zoneNumberColor = "rgba(255, 255, 255, 0.9)";
    int zoneBorderWidth = 2;
    int zoneMargin = 5;  // Gap between zones

    // Behavior
    bool moveToLastKnownZone = true;     // Remember window zones
    bool restoreSizeOnUnsnap = true;     // Restore original size when leaving zone
    bool allowMultiZone = true;          // Allow spanning multiple zones
    bool flashOnLayoutChange = true;     // Visual feedback on layout switch

    // Layouts
    std::vector<Layout> layouts;
};

/**
 * Window zone memory entry
 */
struct WindowZoneMemory {
    std::string windowClass;
    std::string layoutName;
    int zoneIndex;
};

} // namespace HyprZones
