#include "hyprzones/Renderer.hpp"
#include <algorithm>

namespace HyprZones {

void Renderer::renderOverlay(void* monitor, const Layout& layout,
                             const std::vector<int>& highlightedZones,
                             const Config& config) {
    if (!m_visible || !monitor) {
        return;
    }

    for (size_t i = 0; i < layout.zones.size(); ++i) {
        bool highlighted = std::find(highlightedZones.begin(),
                                     highlightedZones.end(),
                                     static_cast<int>(i)) != highlightedZones.end();

        drawZone(monitor, layout.zones[i], highlighted, config);

        if (config.showZoneNumbers) {
            drawNumber(monitor, layout.zones[i], static_cast<int>(i) + 1, config);
        }
    }
}

void Renderer::drawZone(void* monitor, const Zone& zone, bool highlighted, const Config& config) {
    (void)monitor;
    (void)zone;
    (void)highlighted;
    (void)config;
}

void Renderer::drawNumber(void* monitor, const Zone& zone, int number, const Config& config) {
    (void)monitor;
    (void)zone;
    (void)number;
    (void)config;
}

}  // namespace HyprZones
