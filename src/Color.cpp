#include "hyprzones/Color.hpp"
#include <cstdlib>

namespace HyprZones {

Color Color::fromHex(const std::string& hex) {
    Color c;
    std::string h = hex;

    // Remove # prefix if present
    if (!h.empty() && h[0] == '#') {
        h = h.substr(1);
    }

    // Parse based on length
    if (h.length() == 6) {
        // RGB: ff0000
        c.r = static_cast<float>(std::strtol(h.substr(0, 2).c_str(), nullptr, 16)) / 255.0f;
        c.g = static_cast<float>(std::strtol(h.substr(2, 2).c_str(), nullptr, 16)) / 255.0f;
        c.b = static_cast<float>(std::strtol(h.substr(4, 2).c_str(), nullptr, 16)) / 255.0f;
        c.a = 1.0f;
    } else if (h.length() == 8) {
        // RGBA: ff0000ff
        c.r = static_cast<float>(std::strtol(h.substr(0, 2).c_str(), nullptr, 16)) / 255.0f;
        c.g = static_cast<float>(std::strtol(h.substr(2, 2).c_str(), nullptr, 16)) / 255.0f;
        c.b = static_cast<float>(std::strtol(h.substr(4, 2).c_str(), nullptr, 16)) / 255.0f;
        c.a = static_cast<float>(std::strtol(h.substr(6, 2).c_str(), nullptr, 16)) / 255.0f;
    }

    return c;
}

}  // namespace HyprZones
