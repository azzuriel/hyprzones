#include "hyprzones/WindowSnapper.hpp"
#include "hyprzones/ZoneManager.hpp"
#include "hyprzones/Globals.hpp"

namespace HyprZones {

void WindowSnapper::snapToZones(void* window, const Layout& layout,
                                const std::vector<int>& zoneIndices) {
    if (!window || zoneIndices.empty() || !g_zoneManager) {
        return;
    }

    double x, y, w, h;
    g_zoneManager->getCombinedZoneBox(layout, zoneIndices, x, y, w, h);

    if (w <= 0 || h <= 0) {
        return;
    }

    auto* mem = getMemory(window);
    if (mem) {
        mem->layoutName  = layout.name;
        mem->zoneIndices = zoneIndices;
    }
}

void WindowSnapper::unsnap(void* window) {
    auto* mem = getMemory(window);
    if (!mem) {
        return;
    }

    forgetWindow(window);
}

void WindowSnapper::rememberWindow(void* window, const std::string& layoutName,
                                   const std::vector<int>& zoneIndices,
                                   double origX, double origY,
                                   double origW, double origH) {
    WindowMemory mem;
    mem.layoutName  = layoutName;
    mem.zoneIndices = zoneIndices;
    mem.originalX   = origX;
    mem.originalY   = origY;
    mem.originalW   = origW;
    mem.originalH   = origH;

    m_memory[window] = mem;
}

void WindowSnapper::forgetWindow(void* window) {
    m_memory.erase(window);
}

WindowMemory* WindowSnapper::getMemory(void* window) {
    auto it = m_memory.find(window);
    if (it != m_memory.end()) {
        return &it->second;
    }
    return nullptr;
}

void WindowSnapper::restoreAll(const Layout& layout) {
    for (auto& [window, mem] : m_memory) {
        if (mem.layoutName == layout.name) {
            snapToZones(window, layout, mem.zoneIndices);
        }
    }
}

}  // namespace HyprZones
