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

    // Text to render
    std::string text = std::to_string(number);

    // Font size scaled for HiDPI
    int fontSize = static_cast<int>(24 * monitor->m_scale);
    int padding = static_cast<int>(8 * monitor->m_scale);

    // Create Cairo surface for text rendering
    int texWidth = fontSize + padding * 2;
    int texHeight = fontSize + padding * 2;

    cairo_surface_t* surface = cairo_image_surface_create(CAIRO_FORMAT_ARGB32, texWidth, texHeight);
    cairo_t* cr = cairo_create(surface);

    // Clear with transparent background
    cairo_set_source_rgba(cr, 0, 0, 0, 0);
    cairo_paint(cr);

    // Draw circular background
    double radius = texWidth / 2.0;
    cairo_arc(cr, texWidth / 2.0, texHeight / 2.0, radius - 2, 0, 2 * M_PI);
    cairo_set_source_rgba(cr, 0.0, 0.0, 0.0, 0.7 * m_alpha);
    cairo_fill(cr);

    // Setup Pango for text
    PangoLayout* layout = pango_cairo_create_layout(cr);
    PangoFontDescription* fontDesc = pango_font_description_from_string("Sans Bold");
    pango_font_description_set_absolute_size(fontDesc, fontSize * PANGO_SCALE);
    pango_layout_set_font_description(layout, fontDesc);
    pango_layout_set_text(layout, text.c_str(), -1);
    pango_layout_set_alignment(layout, PANGO_ALIGN_CENTER);

    // Get text dimensions for centering
    int textW, textH;
    pango_layout_get_pixel_size(layout, &textW, &textH);

    // Draw text
    const Color& numCol = config.numberColor;
    cairo_set_source_rgba(cr, numCol.r, numCol.g, numCol.b, numCol.a * m_alpha);
    cairo_move_to(cr, (texWidth - textW) / 2.0, (texHeight - textH) / 2.0);
    pango_cairo_show_layout(cr, layout);

    // Cleanup Pango
    g_object_unref(layout);
    pango_font_description_free(fontDesc);
    cairo_destroy(cr);

    // Get Cairo surface data
    cairo_surface_flush(surface);
    unsigned char* data = cairo_image_surface_get_data(surface);
    int stride = cairo_image_surface_get_stride(surface);

    // Create texture from Cairo data (DRM_FORMAT_ARGB8888 matches Cairo's ARGB32)
    SP<CTexture> texture = makeShared<CTexture>(
        DRM_FORMAT_ARGB8888,
        data,
        stride,
        Vector2D(texWidth, texHeight)
    );

    cairo_surface_destroy(surface);

    // Calculate position (center of zone)
    double centerX = (zone.pixelX - monitor->m_position.x + zone.pixelW / 2) * monitor->m_scale;
    double centerY = (zone.pixelY - monitor->m_position.y + zone.pixelH / 2) * monitor->m_scale;

    CBox texBox = {
        centerX - texWidth / 2.0,
        centerY - texHeight / 2.0,
        static_cast<double>(texWidth),
        static_cast<double>(texHeight)
    };

    // Add texture to render pass
    CTexPassElement::SRenderData texData;
    texData.tex = texture;
    texData.box = texBox;
    texData.a = m_alpha;

    g_pHyprRenderer->m_renderPass.add(makeUnique<CTexPassElement>(texData));
}

}  // namespace HyprZones
