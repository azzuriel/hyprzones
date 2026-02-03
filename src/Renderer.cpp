#include "hyprzones/Renderer.hpp"
#include "hyprzones/Globals.hpp"

#include <hyprland/src/Compositor.hpp>
#include <hyprland/src/render/Renderer.hpp>
#include <hyprland/src/render/OpenGL.hpp>
#include <hyprland/src/render/pass/RectPassElement.hpp>
#include <hyprland/src/render/pass/BorderPassElement.hpp>
#include <hyprland/src/helpers/Monitor.hpp>
#include <hyprland/src/config/ConfigDataValues.hpp>

#include <algorithm>

namespace HyprZones {

void Renderer::renderOverlay(void* monitorPtr, const Layout& layout,
                             const std::vector<int>& highlightedZones,
                             const Config& config) {
    if (!m_visible || !monitorPtr) {
        return;
    }

    auto* monitor = static_cast<CMonitor*>(monitorPtr);

    for (size_t i = 0; i < layout.zones.size(); ++i) {
        bool highlighted = std::find(highlightedZones.begin(),
                                     highlightedZones.end(),
                                     static_cast<int>(i)) != highlightedZones.end();

        drawZone(monitor, layout.zones[i], highlighted, config);
    }

    // Draw zone numbers in a second pass (on top)
    if (config.showZoneNumbers) {
        for (size_t i = 0; i < layout.zones.size(); ++i) {
            drawNumber(monitorPtr, layout.zones[i], static_cast<int>(i) + 1, config);
        }
    }
}

void Renderer::drawZone(void* monitorPtr, const Zone& zone, bool highlighted, const Config& config) {
    auto* monitor = static_cast<CMonitor*>(monitorPtr);
    if (!monitor)
        return;

    // Create box for the zone (in monitor-local coordinates)
    CBox box = {
        zone.pixelX - monitor->m_position.x,
        zone.pixelY - monitor->m_position.y,
        zone.pixelW,
        zone.pixelH
    };

    // Scale for HiDPI
    box.scale(monitor->m_scale);

    // Choose color based on highlight state
    const Color& col = highlighted ? config.highlightColor : config.inactiveColor;
    CHyprColor fillColor(col.r, col.g, col.b, col.a * m_alpha);

    // Create and add rect element for zone fill
    CRectPassElement::SRectData rectData;
    rectData.box = box;
    rectData.color = fillColor;
    rectData.round = 8;  // Slight rounding for aesthetics

    g_pHyprRenderer->m_renderPass.add(makeUnique<CRectPassElement>(rectData));

    // Create border
    const Color& borderCol = config.borderColor;
    CHyprColor borderColor(borderCol.r, borderCol.g, borderCol.b, borderCol.a * m_alpha);

    // CGradientValueData for border
    CGradientValueData grad;
    grad.m_colors.push_back(borderColor);

    CBorderPassElement::SBorderData borderData;
    borderData.box = box;
    borderData.grad1 = grad;
    borderData.round = 8;
    borderData.borderSize = config.borderWidth;
    borderData.a = m_alpha;

    g_pHyprRenderer->m_renderPass.add(makeUnique<CBorderPassElement>(borderData));
}

void Renderer::drawNumber(void* monitorPtr, const Zone& zone, int number, const Config& config) {
    auto* monitor = static_cast<CMonitor*>(monitorPtr);
    if (!monitor)
        return;

    // Calculate center position for the number
    double centerX = (zone.pixelX - monitor->m_position.x + zone.pixelW / 2) * monitor->m_scale;
    double centerY = (zone.pixelY - monitor->m_position.y + zone.pixelH / 2) * monitor->m_scale;

    // Draw a small background circle for the number
    double radius = 20 * monitor->m_scale;
    CBox numberBox = {
        centerX - radius,
        centerY - radius,
        radius * 2,
        radius * 2
    };

    // Dark semi-transparent background for number
    CHyprColor bgColor(0.0f, 0.0f, 0.0f, 0.7f * m_alpha);

    CRectPassElement::SRectData bgData;
    bgData.box = numberBox;
    bgData.color = bgColor;
    bgData.round = static_cast<int>(radius);  // Make it circular

    g_pHyprRenderer->m_renderPass.add(makeUnique<CRectPassElement>(bgData));

    // For text rendering, we'd need Cairo/Pango or Hyprland's text system
    // For now, we show the zone number via notification when entering a zone
    // TODO: Implement proper text rendering with Cairo/Pango
}

}  // namespace HyprZones
