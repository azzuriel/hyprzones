#pragma once

#include "Zone.hpp"
#include <string>
#include <vector>

namespace HyprZones {

struct Layout {
    std::string       name;
    std::string       monitor;    // empty = all monitors
    int               workspace = -1;  // -1 = all workspaces
    std::vector<Zone> zones;

    // Template type: "columns", "rows", "grid", "priority-grid", "custom"
    std::string         templateType;
    int                 columns = 0;
    int                 rows    = 0;
    std::vector<double> columnPercents;
    std::vector<double> rowPercents;
};

}  // namespace HyprZones
