#pragma once

#include "Layout.hpp"
#include "Config.hpp"
#include <hyprland/src/render/Texture.hpp>
#include <vector>
#include <unordered_map>
#include <string>

namespace HyprZones {

class Renderer {
  public:
    Renderer();
    ~Renderer();

    void renderOverlay(void* monitor, const Layout& layout,
                       const std::vector<int>& highlightedZones,
                       const Config& config);

    void show(bool manual = false);
    void hide();
    bool isVisible() const { return m_visible; }
    bool isManuallyOpened() const { return m_manuallyOpened; }

    void setAlpha(float a) { m_alpha = a; }
    float getAlpha() const { return m_alpha; }

    void clearCache();
    void invalidateCache();

  private:
    bool  m_visible = false;
    bool  m_manuallyOpened = false;
    float m_alpha   = 0.8f;
    bool  m_needsRedraw = true;
    std::string m_cachedLayoutName;
    std::unordered_map<std::string, SP<CTexture>> m_cachedNumberTextures;

    void drawZone(void* monitor, const Zone& zone, bool highlighted, const Config& config);
    void drawCachedNumber(void* monitor, const Zone& zone, int number);
    SP<CTexture> getOrCreateNumberTexture(int number, float scale);
};

}  // namespace HyprZones
