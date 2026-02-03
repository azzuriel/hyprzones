#include "hyprzones/Renderer.hpp"
#include "hyprzones/Globals.hpp"

#include <hyprland/src/Compositor.hpp>
#include <hyprland/src/render/Renderer.hpp>
#include <hyprland/src/render/OpenGL.hpp>
#include <hyprland/src/render/Texture.hpp>
#include <hyprland/src/render/pass/RectPassElement.hpp>
#include <hyprland/src/render/pass/BorderPassElement.hpp>
#include <hyprland/src/render/pass/TexPassElement.hpp>
#include <hyprland/src/helpers/Monitor.hpp>
#include <hyprland/src/config/ConfigDataValues.hpp>

#include <cairo/cairo.h>
#include <pango/pangocairo.h>
#include <drm_fourcc.h>
#include <algorithm>

namespace HyprZones {

Renderer::Renderer() : m_visible(false), m_alpha(0.8f) {}

Renderer::~Renderer() {
    clearCache();
}

void Renderer::show() {
    if (!m_visible) {
        m_visible = true;
        m_needsRedraw = true;
    }
}

void Renderer::hide() {
    if (m_visible) {
        m_visible = false;
        clearCache();
    }
}

void Renderer::clearCache() {
    m_cachedNumberTextures.clear();
    m_cachedLayoutName.clear();
}

void Renderer::invalidateCache() {
    m_needsRedraw = true;
}

SP<CTexture> Renderer::getOrCreateNumberTexture(int number, float scale) {
    std::string key = std::to_string(number) + "_" + std::to_string(static_cast<int>(scale * 100));

    auto it = m_cachedNumberTextures.find(key);
    if (it != m_cachedNumberTextures.end()) {
        return it->second;
    }

    // Create texture for this number
    std::string text = std::to_string(number);
    int fontSize = static_cast<int>(24 * scale);
    int padding = static_cast<int>(8 * scale);
    int texSize = fontSize + padding * 2;

    cairo_surface_t* surface = cairo_image_surface_create(CAIRO_FORMAT_ARGB32, texSize, texSize);
    cairo_t* cr = cairo_create(surface);

    // Clear
    cairo_set_source_rgba(cr, 0, 0, 0, 0);
    cairo_paint(cr);

    // Circle background
    double radius = texSize / 2.0;
    cairo_arc(cr, texSize / 2.0, texSize / 2.0, radius - 2, 0, 2 * M_PI);
    cairo_set_source_rgba(cr, 0.0, 0.0, 0.0, 0.7);
    cairo_fill(cr);

    // Text
    PangoLayout* layout = pango_cairo_create_layout(cr);
    PangoFontDescription* fontDesc = pango_font_description_from_string("Sans Bold");
    pango_font_description_set_absolute_size(fontDesc, fontSize * PANGO_SCALE);
    pango_layout_set_font_description(layout, fontDesc);
    pango_layout_set_text(layout, text.c_str(), -1);

    int textW, textH;
    pango_layout_get_pixel_size(layout, &textW, &textH);

    cairo_set_source_rgba(cr, 1.0, 1.0, 1.0, 1.0);
    cairo_move_to(cr, (texSize - textW) / 2.0, (texSize - textH) / 2.0);
    pango_cairo_show_layout(cr, layout);

    g_object_unref(layout);
    pango_font_description_free(fontDesc);
    cairo_destroy(cr);

    cairo_surface_flush(surface);
    unsigned char* data = cairo_image_surface_get_data(surface);
    int stride = cairo_image_surface_get_stride(surface);

    SP<CTexture> texture = makeShared<CTexture>(
        DRM_FORMAT_ARGB8888,
        data,
        stride,
        Vector2D(texSize, texSize),
        true
    );

    cairo_surface_destroy(surface);

    m_cachedNumberTextures[key] = texture;
    return texture;
}

void Renderer::renderOverlay(void* monitorPtr, const Layout& layout,
                             const std::vector<int>& highlightedZones,
                             const Config& config) {
    if (!m_visible || !monitorPtr) {
        return;
    }

    auto* monitor = static_cast<CMonitor*>(monitorPtr);

    // Check if layout changed - invalidate cache
    if (m_cachedLayoutName != layout.name) {
        m_cachedLayoutName = layout.name;
        m_needsRedraw = true;
    }

    // Draw zone rectangles
    for (size_t i = 0; i < layout.zones.size(); ++i) {
        bool highlighted = std::find(highlightedZones.begin(),
                                     highlightedZones.end(),
                                     static_cast<int>(i)) != highlightedZones.end();
        drawZone(monitor, layout.zones[i], highlighted, config);
    }

    // Draw cached zone numbers
    if (config.showZoneNumbers) {
        for (size_t i = 0; i < layout.zones.size(); ++i) {
            drawCachedNumber(monitor, layout.zones[i], static_cast<int>(i) + 1);
        }
    }

    m_needsRedraw = false;
}

void Renderer::drawZone(void* monitorPtr, const Zone& zone, bool highlighted, const Config& config) {
    auto* monitor = static_cast<CMonitor*>(monitorPtr);
    if (!monitor)
        return;

    CBox box = {
        zone.pixelX - monitor->m_position.x,
        zone.pixelY - monitor->m_position.y,
        zone.pixelW,
        zone.pixelH
    };
    box.scale(monitor->m_scale);

    const Color& col = highlighted ? config.highlightColor : config.inactiveColor;
    CHyprColor fillColor(col.r, col.g, col.b, col.a * m_alpha);

    CRectPassElement::SRectData rectData;
    rectData.box = box;
    rectData.color = fillColor;
    rectData.round = 0;
    g_pHyprRenderer->m_renderPass.add(makeUnique<CRectPassElement>(rectData));

    const Color& borderCol = config.borderColor;
    CHyprColor borderColor(borderCol.r, borderCol.g, borderCol.b, borderCol.a * m_alpha);

    CGradientValueData grad;
    grad.m_colors.push_back(borderColor);

    CBorderPassElement::SBorderData borderData;
    borderData.box = box;
    borderData.grad1 = grad;
    borderData.round = 0;
    borderData.borderSize = config.borderWidth;
    borderData.a = m_alpha;
    g_pHyprRenderer->m_renderPass.add(makeUnique<CBorderPassElement>(borderData));
}

void Renderer::drawCachedNumber(void* monitorPtr, const Zone& zone, int number) {
    auto* monitor = static_cast<CMonitor*>(monitorPtr);
    if (!monitor)
        return;

    SP<CTexture> texture = getOrCreateNumberTexture(number, monitor->m_scale);
    if (!texture)
        return;

    int texSize = static_cast<int>(40 * monitor->m_scale);

    double centerX = (zone.pixelX - monitor->m_position.x + zone.pixelW / 2) * monitor->m_scale;
    double centerY = (zone.pixelY - monitor->m_position.y + zone.pixelH / 2) * monitor->m_scale;

    CBox texBox = {
        centerX - texSize / 2.0,
        centerY - texSize / 2.0,
        static_cast<double>(texSize),
        static_cast<double>(texSize)
    };

    CTexPassElement::SRenderData texData;
    texData.tex = texture;
    texData.box = texBox;
    texData.a = m_alpha;
    g_pHyprRenderer->m_renderPass.add(makeUnique<CTexPassElement>(texData));
}

}  // namespace HyprZones
