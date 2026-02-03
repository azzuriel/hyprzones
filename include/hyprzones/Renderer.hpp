#pragma once

#include "Layout.hpp"
#include "Config.hpp"
#include <vector>

namespace HyprZones {

class Renderer {
  public:
    void renderOverlay(void* monitor, const Layout& layout,
                       const std::vector<int>& highlightedZones,
                       const Config& config);

    void show()  { m_visible = true; }
    void hide()  { m_visible = false; }
    bool isVisible() const { return m_visible; }

    void  setAlpha(float a) { m_alpha = a; }
    float getAlpha() const  { return m_alpha; }

  private:
    bool  m_visible = false;
    float m_alpha   = 1.0f;

    void drawZone(void* monitor, const Zone& zone, bool highlighted, const Config& config);
    void drawNumber(void* monitor, const Zone& zone, int number, const Config& config);
};

}  // namespace HyprZones
