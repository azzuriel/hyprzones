/**
 * Renderer - Renders zone overlays and visual feedback
 */

#include "hyprzones.hpp"

namespace HyprZones {

class Renderer {
public:
    Renderer() = default;
    ~Renderer() = default;

    /**
     * Set visual configuration
     */
    void setConfig(const Config& config) {
        m_showNumbers = config.showZoneNumbers;
        m_borderWidth = config.zoneBorderWidth;
        m_margin = config.zoneMargin;

        // Parse colors
        parseColor(config.zoneHighlightColor, m_highlightColor);
        parseColor(config.zoneBorderColor, m_borderColor);
        parseColor(config.zoneInactiveColor, m_inactiveColor);
        parseColor(config.zoneNumberColor, m_numberColor);
    }

    /**
     * Render zone overlay
     * Called during Hyprland render pass when zones are active
     */
    void renderZones(const std::vector<Zone>& zones, int highlightedZone) {
        // TODO: Use Hyprland's render API to draw zone overlays

        for (size_t i = 0; i < zones.size(); ++i) {
            const auto& zone = zones[i];
            bool isHighlighted = (static_cast<int>(i) == highlightedZone);

            // Draw zone background
            if (isHighlighted) {
                drawRect(zone.pixelX, zone.pixelY,
                        zone.pixelWidth, zone.pixelHeight,
                        m_highlightColor);
            } else {
                drawRect(zone.pixelX, zone.pixelY,
                        zone.pixelWidth, zone.pixelHeight,
                        m_inactiveColor);
            }

            // Draw zone border
            drawRectBorder(zone.pixelX, zone.pixelY,
                          zone.pixelWidth, zone.pixelHeight,
                          m_borderWidth, m_borderColor);

            // Draw zone number
            if (m_showNumbers) {
                drawText(std::to_string(i + 1),
                        zone.pixelX + zone.pixelWidth / 2,
                        zone.pixelY + zone.pixelHeight / 2,
                        m_numberColor);
            }
        }
    }

    /**
     * Flash zones briefly (for layout change feedback)
     */
    void flashZones(const std::vector<Zone>& zones) {
        m_flashing = true;
        m_flashStartTime = getCurrentTime();
        m_flashZones = zones;
        // Flash will be rendered for ~200ms then automatically stop
    }

    /**
     * Check if currently flashing
     */
    bool isFlashing() const {
        return m_flashing;
    }

private:
    // Visual settings
    bool m_showNumbers = true;
    int m_borderWidth = 2;
    int m_margin = 5;

    // Colors (RGBA)
    float m_highlightColor[4] = {0.0f, 0.4f, 1.0f, 0.3f};
    float m_borderColor[4] = {0.0f, 0.4f, 1.0f, 0.8f};
    float m_inactiveColor[4] = {0.4f, 0.4f, 0.4f, 0.2f};
    float m_numberColor[4] = {1.0f, 1.0f, 1.0f, 0.9f};

    // Flash state
    bool m_flashing = false;
    double m_flashStartTime = 0;
    std::vector<Zone> m_flashZones;

    /**
     * Parse color string to RGBA array
     */
    void parseColor(const std::string& colorStr, float color[4]) {
        // TODO: Implement color parsing
        // For now, use default values
    }

    /**
     * Draw filled rectangle
     */
    void drawRect(int x, int y, int w, int h, const float color[4]) {
        // TODO: Use Hyprland's render API
        // Pseudocode:
        // CBox box = {x, y, w, h};
        // g_pHyprOpenGL->renderRect(&box, CColor(color[0], color[1], color[2], color[3]));
    }

    /**
     * Draw rectangle border
     */
    void drawRectBorder(int x, int y, int w, int h, int borderWidth, const float color[4]) {
        // TODO: Use Hyprland's render API
        // Draw 4 thin rectangles for border
    }

    /**
     * Draw centered text
     */
    void drawText(const std::string& text, int centerX, int centerY, const float color[4]) {
        // TODO: Use Pango/Cairo for text rendering
        // This requires integration with Hyprland's rendering pipeline
    }

    /**
     * Get current time in seconds
     */
    double getCurrentTime() const {
        // TODO: Use Hyprland's time utilities
        return 0.0;
    }
};

} // namespace HyprZones
