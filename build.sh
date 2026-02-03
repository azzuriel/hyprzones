#!/bin/bash
set -e

cd "$(dirname "$0")"

BUILD_TYPE="${1:-Release}"
BUILD_DIR="build"

echo "=== HyprZones Build ==="
echo "Build type: $BUILD_TYPE"

# Clean if requested
if [[ "$1" == "clean" ]]; then
    echo "Cleaning..."
    rm -rf "$BUILD_DIR"
    exit 0
fi

# Configure
if [[ ! -d "$BUILD_DIR" ]]; then
    echo "Configuring..."
    cmake -B "$BUILD_DIR" -DCMAKE_BUILD_TYPE="$BUILD_TYPE"
fi

# Build
echo "Building..."
cmake --build "$BUILD_DIR" -j$(nproc)

# Show result
if [[ -f "$BUILD_DIR/hyprzones.so" ]]; then
    echo ""
    echo "=== Success ==="
    ls -lh "$BUILD_DIR/hyprzones.so"
    echo ""
    echo "Install with:"
    echo "  cp $BUILD_DIR/hyprzones.so ~/.local/share/hyprload/plugins/"
else
    echo "Build failed!"
    exit 1
fi
