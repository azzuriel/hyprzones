// Type declarations for AGS v3 modules (GTK4)

// GTK4 namespace with common widget types
declare namespace Gtk {
    // Enums
    enum Orientation { HORIZONTAL = 0, VERTICAL = 1 }
    enum Align { FILL = 0, START = 1, END = 2, CENTER = 3, BASELINE = 4 }
    enum SelectionMode { NONE = 0, SINGLE = 1, BROWSE = 2, MULTIPLE = 3 }
    enum PolicyType { ALWAYS = 0, AUTOMATIC = 1, NEVER = 2, EXTERNAL = 3 }
    enum Justification { LEFT = 0, RIGHT = 1, CENTER = 2, FILL = 3 }
    enum PropagationPhase { NONE = 0, CAPTURE = 1, BUBBLE = 2, TARGET = 3 }

    // Base widget
    interface Widget {
        get_style_context(): StyleContext
        get_first_child(): Widget | null
        get_next_sibling(): Widget | null
        get_native(): Native | null
        translate_coordinates(dest: Widget, x: number, y: number): [number, number] | null
        set_halign(align: Align): void
        set_valign(align: Align): void
        set_hexpand(expand: boolean): void
        set_vexpand(expand: boolean): void
        set_margin_start(margin: number): void
        set_margin_end(margin: number): void
        set_margin_top(margin: number): void
        set_margin_bottom(margin: number): void
        set_size_request(width: number, height: number): void
        set_can_focus(can_focus: boolean): void
        set_focusable(focusable: boolean): void
        set_cursor(cursor: Gdk.Cursor | null): void
        set_tooltip_text(text: string): void
        add_controller(controller: EventController): void
        grab_focus(): void
        show(): void
        hide(): void
        destroy(): void
        set_visible(visible: boolean): void
        get_visible(): boolean
    }

    interface Native extends Widget {
        get_surface(): any
    }

    interface StyleContext {
        add_class(name: string): void
        remove_class(name: string): void
    }

    // Containers
    interface Box extends Widget {
        append(child: Widget): void
        remove(child: Widget): void
        set_spacing(spacing: number): void
    }
    interface BoxConstructorProps {
        orientation?: Orientation
        spacing?: number
        valign?: Align
        halign?: Align
        margin_bottom?: number
    }
    const Box: {
        new(props?: BoxConstructorProps): Box
    }

    interface Fixed extends Widget {
        put(child: Widget, x: number, y: number): void
        remove(child: Widget): void
    }
    const Fixed: {
        new(): Fixed
    }

    interface FlowBox extends Widget {
        append(child: FlowBoxChild): void
        remove(child: Widget): void
        set_valign(align: Align): void
        set_max_children_per_line(max: number): void
        set_min_children_per_line(min: number): void
        set_selection_mode(mode: SelectionMode): void
        set_homogeneous(homogeneous: boolean): void
        set_column_spacing(spacing: number): void
        set_row_spacing(spacing: number): void
        set_filter_func(func: (child: FlowBoxChild) => boolean): void
        invalidate_filter(): void
        connect(signal: string, callback: (...args: any[]) => void): number
    }
    const FlowBox: {
        new(): FlowBox
    }

    interface FlowBoxChild extends Widget {
        get_name(): string | null
        set_name(name: string): void
        set_child(child: Widget): void
    }
    const FlowBoxChild: {
        new(): FlowBoxChild
    }

    interface Overlay extends Widget {
        set_child(child: Widget): void
        add_overlay(child: Widget): void
        remove_overlay(child: Widget): void
    }
    const Overlay: {
        new(): Overlay
    }

    interface Paned extends Widget {
        set_start_child(child: Widget): void
        set_end_child(child: Widget): void
        set_resize_start_child(resize: boolean): void
        set_resize_end_child(resize: boolean): void
        set_shrink_start_child(shrink: boolean): void
        set_shrink_end_child(shrink: boolean): void
    }
    interface PanedConstructorProps {
        orientation?: Orientation
    }
    const Paned: {
        new(props?: PanedConstructorProps): Paned
    }

    interface ScrolledWindow extends Widget {
        set_child(child: Widget): void
        set_policy(hscroll: PolicyType, vscroll: PolicyType): void
    }
    const ScrolledWindow: {
        new(): ScrolledWindow
    }

    interface Popover extends Widget {
        set_child(child: Widget): void
        set_parent(parent: Widget): void
        popup(): void
        popdown(): void
        set_autohide(autohide: boolean): void
        set_has_arrow(has_arrow: boolean): void
        set_position(position: PositionType): void
    }
    const Popover: {
        new(): Popover
    }

    enum PositionType { LEFT = 0, RIGHT = 1, TOP = 2, BOTTOM = 3 }

    // Widgets
    interface Window extends Widget {
        set_child(child: Widget): void
        set_default_size(width: number, height: number): void
        connect(signal: string, callback: (...args: any[]) => any): number
    }
    interface WindowConstructorProps {
        title?: string
        default_width?: number
        default_height?: number
        decorated?: boolean
        resizable?: boolean
    }
    const Window: {
        new(props?: WindowConstructorProps): Window
    }

    interface Label extends Widget {
        set_label(label: string): void
        set_use_markup(use_markup: boolean): void
        set_justify(justify: Justification): void
    }
    interface LabelConstructorProps {
        label?: string
    }
    const Label: {
        new(props?: LabelConstructorProps): Label
    }

    interface Button extends Widget {
        set_label(label: string): void
        set_sensitive(sensitive: boolean): void
        connect(signal: string, callback: (...args: any[]) => void): number
    }
    interface ButtonConstructorProps {
        label?: string
    }
    const Button: {
        new(props?: ButtonConstructorProps): Button
    }

    interface Entry extends Widget {
        get_text(): string
        set_text(text: string): void
        set_placeholder_text(text: string): void
        set_width_chars(chars: number): void
        connect(signal: string, callback: (...args: any[]) => void): number
    }
    const Entry: {
        new(): Entry
    }

    interface SearchEntry extends Entry {}
    const SearchEntry: {
        new(): SearchEntry
    }

    interface ComboBoxText extends Widget {
        append(id: string, text: string): void
        get_active_id(): string | null
        set_active_id(id: string): void
        remove_all(): void
        connect(signal: string, callback: (...args: any[]) => void): number
    }
    const ComboBoxText: {
        new(): ComboBoxText
    }

    // Event controllers
    interface EventController {
        set_propagation_phase(phase: PropagationPhase): void
    }

    interface EventControllerKey extends EventController {
        connect(signal: string, callback: (controller: EventControllerKey, keyval: number, keycode: number, state: Gdk.ModifierType) => boolean): number
    }
    const EventControllerKey: {
        new(): EventControllerKey
    }

    interface EventControllerMotion extends EventController {
        connect(signal: string, callback: (controller: EventControllerMotion, x: number, y: number) => void): number
    }
    const EventControllerMotion: {
        new(): EventControllerMotion
    }

    interface GestureClick extends EventController {
        set_button(button: number): void
        connect(signal: string, callback: (gesture: GestureClick, n_press: number, x: number, y: number) => void): number
    }
    const GestureClick: {
        new(): GestureClick
    }
}

// GDK4 namespace
declare namespace Gdk {
    interface Display {
        get_monitors(): any
    }
    const Display: {
        get_default(): Display | null
    }

    interface Monitor {}

    interface Cursor {}
    const Cursor: {
        new_from_name(name: string, fallback: Cursor | null): Cursor
    }

    type ModifierType = number

    const KEY_Escape: number
}

declare module "ags/gtk4/app" {
    interface App {
        start(config: {
            css?: string
            instanceName?: string
            main?: () => void
            requestHandler?: (request: any, res: (response: any) => void) => void
        }): void
        quit(): void
    }
    const app: App
    export default app
}

declare module "ags/gtk4" {
    export { Gtk, Gdk }
}

declare module "ags/process" {
    export function execAsync(cmd: string[]): Promise<string>
    export function exec(cmd: string[]): string
}

declare module "gi://Gtk?version=4.0" {
    export = Gtk
}

declare module "gi://Gdk?version=4.0" {
    export = Gdk
}

declare module "gi://Gtk4LayerShell?version=1.0" {
    const Gtk4LayerShell: any
    export default Gtk4LayerShell
}

declare module "gi://Gtk4LayerShell" {
    const Gtk4LayerShell: any
    export default Gtk4LayerShell
}

declare module "gi://GLib?version=2.0" {
    const GLib: any
    export default GLib
}

declare module "gi://GLib" {
    const GLib: any
    export default GLib
}
