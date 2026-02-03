cmake_minimum_required(VERSION 3.19)
project(hyprzones
    VERSION 0.1.0
    DESCRIPTION "Zone-based window tiling for Hyprland"
    LANGUAGES CXX
)

set(CMAKE_CXX_STANDARD 23)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find Hyprland
find_package(PkgConfig REQUIRED)
pkg_check_modules(HYPRLAND REQUIRED hyprland)

# Find dependencies
pkg_check_modules(PANGO REQUIRED pango pangocairo)
pkg_check_modules(CAIRO REQUIRED cairo)

# Source files
set(SOURCES
    src/main.cpp
    src/Globals.cpp
    src/Color.cpp
    src/ZoneManager.cpp
    src/LayoutManager.cpp
    src/WindowSnapper.cpp
    src/ConfigParser.cpp
    src/Renderer.cpp
)

# Plugin library
add_library(hyprzones SHARED ${SOURCES})

target_include_directories(hyprzones PRIVATE
    ${CMAKE_SOURCE_DIR}/include
    ${HYPRLAND_INCLUDE_DIRS}
    ${PANGO_INCLUDE_DIRS}
    ${CAIRO_INCLUDE_DIRS}
)

target_link_libraries(hyprzones PRIVATE
    ${PANGO_LIBRARIES}
    ${CAIRO_LIBRARIES}
)

target_compile_options(hyprzones PRIVATE
    -Wall
    -Wextra
    -fPIC
)

set_target_properties(hyprzones PROPERTIES
    PREFIX ""
    LIBRARY_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}"
)

# Installation
install(TARGETS hyprzones
    LIBRARY DESTINATION lib/hyprland/plugins
)
