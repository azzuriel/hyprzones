#!/bin/bash
# Run HyprZones Editor with AGS

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Check if AGS is installed
if ! command -v ags &> /dev/null; then
    echo "Error: ags (aylurs-gtk-shell) is not installed"
    echo "Install with: yay -S aylurs-gtk-shell"
    exit 1
fi

# Kill any existing editor instance
ags quit -i hyprzones-editor 2>/dev/null || true

# Run the editor
exec ags run "$SCRIPT_DIR/app.ts"
