#pragma once

#include <vector>

namespace HyprZones {

struct DragState {
    bool   isDragging     = false;
    bool   isZoneSnapping = false;
    bool   modifierHeld   = false;
    bool   ctrlHeld       = false;

    void*  draggedWindow  = nullptr;  // PHLWINDOW
    void*  currentMonitor = nullptr;  // CMonitor*

    double dragStartX = 0;
    double dragStartY = 0;
    double currentX   = 0;
    double currentY   = 0;

    int              startZone   = -1;
    int              currentZone = -1;
    std::vector<int> selectedZones;

    void reset() {
        isDragging     = false;
        isZoneSnapping = false;
        modifierHeld   = false;
        ctrlHeld       = false;
        draggedWindow  = nullptr;
        currentMonitor = nullptr;
        dragStartX     = 0;
        dragStartY     = 0;
        currentX       = 0;
        currentY       = 0;
        startZone      = -1;
        currentZone    = -1;
        selectedZones.clear();
    }
};

}  // namespace HyprZones
