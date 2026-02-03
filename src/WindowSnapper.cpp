/**
 * WindowSnapper - Handles window drag detection and zone snapping
 */

#include "hyprzones.hpp"

namespace HyprZones {

class WindowSnapper {
public:
    WindowSnapper() = default;
    ~WindowSnapper() = default;

    /**
     * Called when window drag starts
     */
    void onDragStart(void* window, int startX, int startY) {
        m_dragging = true;
        m_dragWindow = window;
        m_dragStartX = startX;
        m_dragStartY = startY;
        m_zonesActive = false;

        // Store original window size for restore on unsnap
        // TODO: Get window size from Hyprland API
    }

    /**
     * Called during window drag
     */
    void onDragMove(int currentX, int currentY, bool modifierHeld) {
        if (!m_dragging) return;

        // Activate zones if modifier is held (or if snap_on_drag_start is enabled)
        if (modifierHeld && !m_zonesActive) {
            m_zonesActive = true;
            // TODO: Trigger zone overlay rendering
        }

        if (!modifierHeld && m_zonesActive) {
            m_zonesActive = false;
            m_highlightedZone = -1;
            // TODO: Hide zone overlay
        }

        if (m_zonesActive) {
            // Find zone under cursor
            // TODO: Use ZoneManager to find zone at currentX, currentY
            // m_highlightedZone = zoneManager->findZoneAtPoint(currentX, currentY);

            // Check for multi-zone selection (Ctrl held)
            // TODO: Handle multi-zone logic
        }
    }

    /**
     * Called when window drag ends
     */
    void onDragEnd(int endX, int endY) {
        if (!m_dragging) return;

        if (m_zonesActive && m_highlightedZone >= 0) {
            // Snap window to zone
            snapWindowToZone(m_dragWindow, m_highlightedZone);
        }

        m_dragging = false;
        m_dragWindow = nullptr;
        m_zonesActive = false;
        m_highlightedZone = -1;
        m_selectedZones.clear();
    }

    /**
     * Snap window to specific zone by index
     */
    void snapWindowToZone(void* window, int zoneIndex) {
        // TODO: Get zone bounds from ZoneManager
        // TODO: Use Hyprland API to resize and move window
        //
        // Pseudocode:
        // Zone zone = zoneManager->getZone(zoneIndex);
        // window->setPosition(zone.pixelX, zone.pixelY);
        // window->setSize(zone.pixelWidth, zone.pixelHeight);
    }

    /**
     * Snap window to multiple zones (span)
     */
    void snapWindowToZones(void* window, const std::vector<int>& zoneIndices) {
        // TODO: Get combined bounds from ZoneManager
        // TODO: Use Hyprland API to resize and move window
    }

    /**
     * Check if zones are currently active (being displayed)
     */
    bool areZonesActive() const {
        return m_zonesActive;
    }

    /**
     * Get currently highlighted zone index (-1 if none)
     */
    int getHighlightedZone() const {
        return m_highlightedZone;
    }

    /**
     * Get all selected zones (for multi-zone snapping)
     */
    const std::vector<int>& getSelectedZones() const {
        return m_selectedZones;
    }

    /**
     * Move active window to zone by keyboard command
     */
    void moveActiveWindowToZone(int zoneIndex) {
        // TODO: Get active window from Hyprland
        // TODO: Snap to zone
    }

private:
    bool m_dragging = false;
    void* m_dragWindow = nullptr;
    int m_dragStartX = 0;
    int m_dragStartY = 0;
    bool m_zonesActive = false;
    int m_highlightedZone = -1;
    std::vector<int> m_selectedZones;

    // Original window dimensions for restore
    int m_originalWidth = 0;
    int m_originalHeight = 0;
};

} // namespace HyprZones
