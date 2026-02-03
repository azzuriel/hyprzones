#pragma once

#include <string>

namespace HyprZones {

struct Zone {
    std::string name;
    int         index = 0;

    // Position and size as percentages (0.0 - 1.0)
    double x      = 0.0;
    double y      = 0.0;
    double width  = 1.0;
    double height = 1.0;

    // Computed pixel values (set at runtime)
    double pixelX = 0;
    double pixelY = 0;
    double pixelW = 0;
    double pixelH = 0;

    bool containsPoint(double px, double py) const {
        return px >= pixelX && px < pixelX + pixelW &&
               py >= pixelY && py < pixelY + pixelH;
    }

    double area() const {
        return pixelW * pixelH;
    }

    double centerX() const { return pixelX + pixelW / 2.0; }
    double centerY() const { return pixelY + pixelH / 2.0; }
};

}  // namespace HyprZones
