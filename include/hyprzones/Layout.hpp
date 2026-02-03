#pragma once

#include "Zone.hpp"
#include <string>
#include <vector>

namespace HyprZones {

struct Layout {
    std::string       name;
    std::string       hotkey;     // e.g., "SUPER+CTRL+1"
    int               spacingH = 40;  // Horizontal gap between zones in pixels
    int               spacingV = 10;  // Vertical gap between zones in pixels
    std::vector<Zone> zones;

    // Template type: "columns", "rows", "grid", "priority-grid", "custom"
    std::string         templateType;
    int                 columns = 0;
    int                 rows    = 0;
    std::vector<double> columnPercents;
    std::vector<double> rowPercents;
};

}  // namespace HyprZones
