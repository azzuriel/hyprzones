#pragma once

#include <string>

namespace HyprZones {

struct Color {
    float r = 0.0f;
    float g = 0.0f;
    float b = 0.0f;
    float a = 1.0f;

    static Color fromRGBA(float r, float g, float b, float a) {
        return {r, g, b, a};
    }

    static Color fromHex(const std::string& hex);
};

}  // namespace HyprZones
