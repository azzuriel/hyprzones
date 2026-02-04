// LayoutPanel - Layout and Mapping management panel

import { Gtk, Gdk } from "ags/gtk4"
import { cloneLayout } from "../models/Layout"
import { loadLayoutByName, saveLayoutToConfig, getLayoutNames, deleteLayout, loadAllMappings, saveMappings, addMapping, removeMapping } from "../services/LayoutService"
import { reloadConfig } from "../services/HyprzonesIPC"
import { state } from "../state/EditorState"

// Callbacks
let updateDisplayCallback: (() => void) | null = null
let hideCallback: (() => void) | null = null

export function setLayoutPanelCallbacks(callbacks: {
    updateDisplay: () => void
    hide: () => void
}) {
    updateDisplayCallback = callbacks.updateDisplay
    hideCallback = callbacks.hide
}

// Helper to remove all children from a container
function removeAllChildren(container: Gtk.Widget) {
    let child = container.get_first_child()
    while (child) {
        const next = child.get_next_sibling()
        if ('remove' in container) {
            (container as any).remove(child)
        }
        child = next
    }
}

// Create the layout panel
export function createLayoutPanel(): Gtk.Box {
    const panel = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 16 })
    panel.get_style_context().add_class("layout-dialog")
    const panelWidth = Math.floor(state.monitor.width * 0.4)
    const panelHeight = Math.floor(state.monitor.height * 0.6)
    panel.set_size_request(panelWidth, panelHeight)
    panel.set_margin_start(24)
    panel.set_margin_end(24)
    panel.set_margin_top(20)
    panel.set_margin_bottom(20)

    // Close button at top
    const headerRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
    headerRow.set_halign(Gtk.Align.FILL)
    const titleLabel = new Gtk.Label({ label: "Config" })
    titleLabel.get_style_context().add_class("section-header")
    titleLabel.set_hexpand(true)
    titleLabel.set_halign(Gtk.Align.START)
    const closeBtn = new Gtk.Button({ label: "✕ Close (ESC)" })
    closeBtn.get_style_context().add_class("toolbar-button")
    closeBtn.get_style_context().add_class("toolbar-reset")
    closeBtn.connect("clicked", () => { if (hideCallback) hideCallback() })
    headerRow.append(titleLabel)
    headerRow.append(closeBtn)
    panel.append(headerRow)

    // === LAYOUTS SECTION ===
    const layoutsHeader = new Gtk.Label({ label: "Layouts" })
    layoutsHeader.get_style_context().add_class("section-header")
    layoutsHeader.set_halign(Gtk.Align.START)

    const topRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
    topRow.set_halign(Gtk.Align.FILL)
    state.layoutSearchEntry = new Gtk.SearchEntry()
    state.layoutSearchEntry.set_placeholder_text("Filter...")
    state.layoutSearchEntry.set_hexpand(true)
    const nameLabel = new Gtk.Label({ label: "Name:" })
    nameLabel.set_margin_start(16)
    state.layoutNameEntry = new Gtk.Entry()
    state.layoutNameEntry.set_hexpand(true)
    topRow.append(state.layoutSearchEntry)
    topRow.append(nameLabel)
    topRow.append(state.layoutNameEntry)

    const layoutScroll = new Gtk.ScrolledWindow()
    layoutScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
    layoutScroll.set_vexpand(true)
    layoutScroll.set_hexpand(true)

    state.layoutFlowBox = new Gtk.FlowBox()
    state.layoutFlowBox.set_valign(Gtk.Align.START)
    state.layoutFlowBox.set_max_children_per_line(20)
    state.layoutFlowBox.set_min_children_per_line(3)
    state.layoutFlowBox.set_selection_mode(Gtk.SelectionMode.SINGLE)
    state.layoutFlowBox.set_homogeneous(true)
    state.layoutFlowBox.set_column_spacing(8)
    state.layoutFlowBox.set_row_spacing(8)
    state.layoutFlowBox.get_style_context().add_class("layout-flow")

    state.layoutFlowBox.set_filter_func((child: Gtk.FlowBoxChild) => {
        if (!state.layoutSearchEntry) return true
        const searchText = state.layoutSearchEntry.get_text().toLowerCase()
        if (!searchText) return true
        const name = child.get_name()
        return name ? name.toLowerCase().includes(searchText) : true
    })

    state.layoutSearchEntry.connect("search-changed", () => {
        if (state.layoutFlowBox) state.layoutFlowBox.invalidate_filter()
    })

    layoutScroll.set_child(state.layoutFlowBox)

    // Layout buttons
    const layoutButtonBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 })
    layoutButtonBox.set_halign(Gtk.Align.CENTER)
    layoutButtonBox.set_margin_top(8)
    layoutButtonBox.set_margin_bottom(8)

    const loadBtn = new Gtk.Button({ label: "Load" })
    loadBtn.get_style_context().add_class("toolbar-button")
    loadBtn.get_style_context().add_class("toolbar-save")

    const saveBtn = new Gtk.Button({ label: "Save" })
    saveBtn.get_style_context().add_class("toolbar-button")
    saveBtn.get_style_context().add_class("toolbar-save")

    const renameBtn = new Gtk.Button({ label: "Rename" })
    renameBtn.get_style_context().add_class("toolbar-button")

    const deleteBtn = new Gtk.Button({ label: "Delete" })
    deleteBtn.get_style_context().add_class("toolbar-button")
    deleteBtn.get_style_context().add_class("toolbar-reset")

    const updateLayoutButtonStates = () => {
        const name = state.layoutNameEntry?.get_text() || ""
        const layoutNames = getLayoutNames()
        const layoutExists = layoutNames.includes(name)
        const hasName = name.length > 0
        const nameChanged = state.selectedOldName !== null && name !== state.selectedOldName
        const isDifferentLayout = name !== state.currentLayout.name

        loadBtn.set_sensitive(layoutExists && isDifferentLayout)
        saveBtn.set_sensitive(hasName)
        renameBtn.set_sensitive(state.selectedOldName !== null && nameChanged && hasName)
        deleteBtn.set_sensitive(layoutExists)
    }

    state.layoutNameEntry.connect("changed", updateLayoutButtonStates)

    state.layoutFlowBox.connect("child-activated", (_: Gtk.FlowBox, child: Gtk.FlowBoxChild) => {
        if (child && state.layoutNameEntry) {
            const name = child.get_name()
            if (name) {
                state.selectedOldName = name
                state.layoutNameEntry.set_text(name)
                updateLayoutButtonStates()
            }
        }
    })

    loadBtn.connect("clicked", () => {
        if (!state.layoutNameEntry) return
        const name = state.layoutNameEntry.get_text()
        if (!name) return
        const loaded = loadLayoutByName(name)
        if (loaded) {
            state.currentLayout = loaded
            state.originalLayout = cloneLayout(loaded)
            state.hasChanges = false
            if (updateDisplayCallback) updateDisplayCallback()
            refreshLayoutList()
            updateLayoutButtonStates()
        }
    })

    saveBtn.connect("clicked", async () => {
        if (!state.layoutNameEntry) return
        const name = state.layoutNameEntry.get_text()
        if (name) {
            state.currentLayout.name = name
            const success = saveLayoutToConfig(state.currentLayout, true)
            if (success) {
                await reloadConfig()
                state.hasChanges = false
                state.originalLayout = cloneLayout(state.currentLayout)
                refreshLayoutList()
                if (updateDisplayCallback) updateDisplayCallback()
                updateLayoutButtonStates()
            }
        }
    })

    renameBtn.connect("clicked", async () => {
        if (!state.layoutNameEntry || !state.selectedOldName) return
        const newName = state.layoutNameEntry.get_text()
        if (newName && newName !== state.selectedOldName) {
            const layout = loadLayoutByName(state.selectedOldName)
            if (layout) {
                deleteLayout(state.selectedOldName)
                layout.name = newName
                saveLayoutToConfig(layout, true)

                const mappings = loadAllMappings()
                const updatedMappings = mappings.map(m =>
                    m.layout === state.selectedOldName ? { ...m, layout: newName } : m
                )
                saveMappings(updatedMappings)

                if (state.currentLayout.name === state.selectedOldName) {
                    state.currentLayout.name = newName
                }
                await reloadConfig()
                refreshLayoutList()
                refreshMappingsList()
                state.selectedOldName = newName
                updateLayoutButtonStates()
            }
        }
    })

    deleteBtn.connect("clicked", async () => {
        if (!state.layoutNameEntry) return
        const name = state.layoutNameEntry.get_text()
        const layoutNames = getLayoutNames()
        if (name && layoutNames.includes(name)) {
            deleteLayout(name)
            await reloadConfig()
            refreshLayoutList()
            state.layoutNameEntry.set_text("")
            state.selectedOldName = null
            updateLayoutButtonStates()
        }
    })

    updateLayoutButtonStates()

    layoutButtonBox.append(loadBtn)
    layoutButtonBox.append(saveBtn)
    layoutButtonBox.append(renameBtn)
    layoutButtonBox.append(deleteBtn)

    // === MAPPINGS SECTION ===
    const mappingsHeader = new Gtk.Label({ label: "Mappings" })
    mappingsHeader.get_style_context().add_class("section-header")
    mappingsHeader.set_halign(Gtk.Align.START)

    state.mappingsSearchEntry = new Gtk.SearchEntry()
    state.mappingsSearchEntry.set_placeholder_text("Filter...")
    state.mappingsSearchEntry.set_hexpand(true)

    const mappingsScroll = new Gtk.ScrolledWindow()
    mappingsScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
    mappingsScroll.set_vexpand(true)
    mappingsScroll.set_hexpand(true)

    state.mappingsFlowBox = new Gtk.FlowBox()
    state.mappingsFlowBox.set_valign(Gtk.Align.START)
    state.mappingsFlowBox.set_max_children_per_line(10)
    state.mappingsFlowBox.set_min_children_per_line(2)
    state.mappingsFlowBox.set_selection_mode(Gtk.SelectionMode.NONE)
    state.mappingsFlowBox.set_homogeneous(false)
    state.mappingsFlowBox.set_column_spacing(8)
    state.mappingsFlowBox.set_row_spacing(8)
    state.mappingsFlowBox.get_style_context().add_class("mappings-flow")

    state.mappingsFlowBox.set_filter_func((child: Gtk.FlowBoxChild) => {
        if (!state.mappingsSearchEntry) return true
        const searchText = state.mappingsSearchEntry.get_text().toLowerCase()
        if (!searchText) return true
        const text = child.get_name()
        return text ? text.toLowerCase().includes(searchText) : true
    })

    state.mappingsSearchEntry.connect("search-changed", () => {
        if (state.mappingsFlowBox) state.mappingsFlowBox.invalidate_filter()
    })

    mappingsScroll.set_child(state.mappingsFlowBox)

    // Add mapping row
    const addMappingBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 12 })
    addMappingBox.set_halign(Gtk.Align.CENTER)
    addMappingBox.set_margin_top(8)

    const monitorCombo = new Gtk.ComboBoxText()
    monitorCombo.get_style_context().add_class("mapping-combo")
    monitorCombo.append("*", "All Monitors")
    for (const mon of state.allMonitors) {
        monitorCombo.append(mon.name, mon.name)
    }
    monitorCombo.set_active_id("*")

    const wsEntry = new Gtk.Entry()
    wsEntry.set_placeholder_text("1-5 or *")
    wsEntry.set_width_chars(10)
    wsEntry.set_text("*")

    // Searchable layout selector
    state.mappingLayoutButton = new Gtk.Button({ label: "Select Layout ▾" })
    state.mappingLayoutButton.get_style_context().add_class("toolbar-button")
    state.mappingLayoutButton.set_size_request(150, -1)

    const layoutPopover = new Gtk.Popover()
    layoutPopover.set_parent(state.mappingLayoutButton)
    layoutPopover.set_autohide(true)
    layoutPopover.set_has_arrow(false)
    layoutPopover.set_position(Gtk.PositionType.TOP)
    layoutPopover.get_style_context().add_class("layout-popover")

    const popoverKeyController = new Gtk.EventControllerKey()
    popoverKeyController.connect("key-pressed", (_controller: Gtk.EventControllerKey, keyval: number) => {
        if (keyval === Gdk.KEY_Escape) {
            layoutPopover.popdown()
            return true
        }
        return false
    })
    layoutPopover.add_controller(popoverKeyController)

    const popoverContent = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    popoverContent.set_size_request(300, 350)
    popoverContent.set_margin_start(12)
    popoverContent.set_margin_end(12)
    popoverContent.set_margin_top(12)
    popoverContent.set_margin_bottom(12)

    const layoutDropdownSearch = new Gtk.SearchEntry()
    layoutDropdownSearch.set_placeholder_text("Search...")
    layoutDropdownSearch.set_size_request(280, -1)

    const searchKeyController = new Gtk.EventControllerKey()
    searchKeyController.connect("key-pressed", (_controller: Gtk.EventControllerKey, keyval: number) => {
        if (keyval === Gdk.KEY_Escape) {
            layoutPopover.popdown()
            return true
        }
        return false
    })
    layoutDropdownSearch.add_controller(searchKeyController)

    const layoutDropdownScroll = new Gtk.ScrolledWindow()
    layoutDropdownScroll.set_policy(Gtk.PolicyType.AUTOMATIC, Gtk.PolicyType.AUTOMATIC)
    layoutDropdownScroll.set_size_request(280, 300)

    const layoutDropdownList = new Gtk.FlowBox()
    layoutDropdownList.set_valign(Gtk.Align.START)
    layoutDropdownList.set_max_children_per_line(1)
    layoutDropdownList.set_min_children_per_line(1)
    layoutDropdownList.set_selection_mode(Gtk.SelectionMode.SINGLE)
    layoutDropdownList.get_style_context().add_class("layout-dropdown-list")

    layoutDropdownList.set_filter_func((child: Gtk.FlowBoxChild) => {
        const searchText = layoutDropdownSearch.get_text().toLowerCase()
        if (!searchText) return true
        const name = child.get_name()
        return name ? name.toLowerCase().includes(searchText) : true
    })

    layoutDropdownSearch.connect("search-changed", () => {
        layoutDropdownList.invalidate_filter()
    })

    state.mappingLayoutButton.connect("clicked", () => {
        layoutDropdownSearch.set_text("")
        layoutDropdownList.invalidate_filter()
        layoutPopover.popup()
        layoutDropdownSearch.grab_focus()
    })

    layoutDropdownList.connect("child-activated", (_: Gtk.FlowBox, child: Gtk.FlowBoxChild) => {
        const name = child.get_name()
        if (name && state.mappingLayoutButton) {
            state.selectedMappingLayout = name
            state.mappingLayoutButton.set_label(name + " ▾")
            layoutPopover.popdown()
        }
    })

    layoutDropdownScroll.set_child(layoutDropdownList)
    popoverContent.append(layoutDropdownSearch)
    popoverContent.append(layoutDropdownScroll)
    layoutPopover.set_child(popoverContent)

    state.mappingLayoutDropdownList = layoutDropdownList

    const addMappingBtn = new Gtk.Button({ label: "+" })
    addMappingBtn.get_style_context().add_class("toolbar-button")
    addMappingBtn.get_style_context().add_class("toolbar-save")

    const updateAddButtonState = () => {
        const monitorId = monitorCombo.get_active_id() || "*"
        const workspaces = wsEntry.get_text() || "*"
        const mappings = loadAllMappings()

        let canAdd = true

        const hasGlobalWildcard = mappings.some(m => m.monitor === "*" && m.workspaces === "*")
        if (hasGlobalWildcard) canAdd = false

        if (canAdd && monitorId === "*" && workspaces === "*" && mappings.length > 0) canAdd = false

        if (canAdd && workspaces === "*") {
            const hasMonitorMappings = mappings.some(m =>
                m.monitor === monitorId || (monitorId !== "*" && m.monitor === "*")
            )
            if (hasMonitorMappings) canAdd = false
        }

        if (canAdd && workspaces !== "*") {
            const coveredByMonitorWildcard = mappings.some(m =>
                m.monitor === monitorId && m.workspaces === "*"
            )
            if (coveredByMonitorWildcard) canAdd = false
        }

        addMappingBtn.set_sensitive(canAdd)
    }

    monitorCombo.connect("changed", updateAddButtonState)
    wsEntry.connect("changed", updateAddButtonState)

    addMappingBtn.connect("clicked", async () => {
        const monitorId = monitorCombo.get_active_id() || "*"
        const workspaces = wsEntry.get_text() || "*"
        const layout = state.selectedMappingLayout
        if (layout) {
            const mappings = loadAllMappings()
            const existingIndex = mappings.findIndex(m =>
                m.monitor === monitorId && m.workspaces === workspaces
            )

            if (existingIndex >= 0) {
                mappings[existingIndex].layout = layout
                saveMappings(mappings)
            } else {
                addMapping({ monitor: monitorId, workspaces, layout })
            }
            await reloadConfig()
            refreshMappingsList()
            refreshLayoutList()
            updateAddButtonState()
        }
    })

    addMappingBox.append(monitorCombo)
    addMappingBox.append(wsEntry)
    addMappingBox.append(state.mappingLayoutButton)
    addMappingBox.append(addMappingBtn)

    // Assemble panel
    const paned = new Gtk.Paned({ orientation: Gtk.Orientation.VERTICAL })
    paned.set_vexpand(true)
    paned.set_hexpand(true)

    const layoutsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    layoutsBox.append(layoutsHeader)
    layoutsBox.append(topRow)
    layoutsBox.append(layoutScroll)
    layoutsBox.append(layoutButtonBox)

    const mappingsBox = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 8 })
    mappingsBox.set_margin_top(16)
    mappingsBox.append(mappingsHeader)
    mappingsBox.append(state.mappingsSearchEntry)
    mappingsBox.append(mappingsScroll)
    mappingsBox.append(addMappingBox)

    paned.set_start_child(layoutsBox)
    paned.set_end_child(mappingsBox)
    paned.set_resize_start_child(true)
    paned.set_resize_end_child(true)
    paned.set_shrink_start_child(false)
    paned.set_shrink_end_child(false)

    panel.append(paned)

    updateAddButtonState()
    populateMappingLayoutDropdown()

    return panel
}

// Populate the mapping layout dropdown
function populateMappingLayoutDropdown() {
    if (!state.mappingLayoutDropdownList) return

    removeAllChildren(state.mappingLayoutDropdownList)

    const layoutNames = getLayoutNames()
    for (const name of layoutNames) {
        const item = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
        item.get_style_context().add_class("layout-dropdown-item")
        item.set_hexpand(true)

        const label = new Gtk.Label({ label: name })
        label.set_halign(Gtk.Align.START)
        label.set_hexpand(true)
        item.append(label)

        const child = new Gtk.FlowBoxChild()
        child.set_name(name)
        child.set_child(item)
        state.mappingLayoutDropdownList.append(child)
    }

    if (layoutNames.length > 0 && !state.selectedMappingLayout) {
        state.selectedMappingLayout = layoutNames[0]
        if (state.mappingLayoutButton) {
            state.mappingLayoutButton.set_label(state.selectedMappingLayout + " ▾")
        }
    }
}

// Refresh the layout list
export function refreshLayoutList() {
    if (!state.layoutFlowBox) return

    removeAllChildren(state.layoutFlowBox)

    // Get all mapped layout names (layouts used in any mapping)
    const mappings = loadAllMappings()
    const mappedLayoutNames = new Set(mappings.map(m => m.layout))

    const layoutNames = getLayoutNames()
    for (const name of layoutNames) {
        // Box for hover detection (replaces EventBox)
        const hoverBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })

        const card = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 })
        card.get_style_context().add_class("layout-card")
        card.set_margin_start(4)
        card.set_margin_end(4)
        card.set_margin_top(4)
        card.set_margin_bottom(4)

        // Hover effects with EventControllerMotion
        const motionController = new Gtk.EventControllerMotion()
        motionController.connect("enter", () => {
            card.get_style_context().add_class("hover")
        })
        motionController.connect("leave", () => {
            card.get_style_context().remove_class("hover")
        })
        hoverBox.add_controller(motionController)

        // Status indicators with proper spacing
        const isActive = name === state.currentLayout.name
        const isMapped = mappedLayoutNames.has(name)

        // Active indicator (filled/outline arrow)
        const activeIndicator = new Gtk.Label()
        activeIndicator.set_use_markup(true)
        activeIndicator.set_label(isActive
            ? '<span foreground="#cc8844">▶</span>'
            : '<span foreground="#555555">▷</span>')
        activeIndicator.set_margin_end(6)

        // Mapped indicator (filled/outline circle)
        const mappedIndicator = new Gtk.Label()
        mappedIndicator.set_use_markup(true)
        mappedIndicator.set_label(isMapped
            ? '<span foreground="#00ff00">●</span>'
            : '<span foreground="#555555">○</span>')
        mappedIndicator.set_margin_end(8)

        const label = new Gtk.Label({ label: name })
        label.set_margin_top(6)
        label.set_margin_bottom(6)
        label.set_margin_end(8)

        card.append(activeIndicator)
        card.append(mappedIndicator)
        card.append(label)

        hoverBox.append(card)

        // Store name for selection and filtering
        const child = new Gtk.FlowBoxChild()
        child.set_name(name)
        child.set_child(hoverBox)
        state.layoutFlowBox.append(child)
    }

    // Update layout dropdown in add mapping row
    populateMappingLayoutDropdown()
}

// Refresh the mappings list
export function refreshMappingsList() {
    const flowBox = state.mappingsFlowBox
    if (!flowBox) return

    removeAllChildren(flowBox)

    const mappings = loadAllMappings()
    mappings.forEach((mapping, index) => {
        const card = new Gtk.Box({ orientation: Gtk.Orientation.VERTICAL, spacing: 4 })
        card.get_style_context().add_class("mapping-card")
        card.set_margin_start(4)
        card.set_margin_end(4)
        card.set_margin_top(4)
        card.set_margin_bottom(4)

        const motionController = new Gtk.EventControllerMotion()
        motionController.connect("enter", () => { card.get_style_context().add_class("hover") })
        motionController.connect("leave", () => { card.get_style_context().remove_class("hover") })
        card.add_controller(motionController)

        const headerRow = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL })
        headerRow.set_hexpand(true)

        const layoutLabel = new Gtk.Label({ label: mapping.layout })
        layoutLabel.get_style_context().add_class("mapping-card-title")
        layoutLabel.set_halign(Gtk.Align.START)
        layoutLabel.set_hexpand(true)

        const deleteBtn = new Gtk.Button({ label: "×" })
        deleteBtn.get_style_context().add_class("mapping-delete-btn")
        deleteBtn.connect("clicked", async () => {
            removeMapping(index)
            await reloadConfig()
            refreshMappingsList()
            refreshLayoutList()
        })

        headerRow.append(layoutLabel)
        headerRow.append(deleteBtn)

        const metaBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 16 })
        metaBox.get_style_context().add_class("mapping-card-meta")

        const monitorBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 })
        const monitorLabelKey = new Gtk.Label({ label: "Monitor:" })
        monitorLabelKey.get_style_context().add_class("mapping-card-key")
        const monitorLabelVal = new Gtk.Label({ label: mapping.monitor === "*" ? "All" : mapping.monitor })
        monitorLabelVal.get_style_context().add_class("mapping-card-value")
        monitorBox.append(monitorLabelKey)
        monitorBox.append(monitorLabelVal)

        const wsBox = new Gtk.Box({ orientation: Gtk.Orientation.HORIZONTAL, spacing: 4 })
        const wsLabelKey = new Gtk.Label({ label: "WS:" })
        wsLabelKey.get_style_context().add_class("mapping-card-key")
        const wsLabelVal = new Gtk.Label({ label: mapping.workspaces === "*" ? "All" : mapping.workspaces })
        wsLabelVal.get_style_context().add_class("mapping-card-value")
        wsBox.append(wsLabelKey)
        wsBox.append(wsLabelVal)

        metaBox.append(monitorBox)
        metaBox.append(wsBox)

        card.append(headerRow)
        card.append(metaBox)

        const searchText = `${mapping.monitor} ${mapping.workspaces} ${mapping.layout}`
        const child = new Gtk.FlowBoxChild()
        child.set_name(searchText)
        child.set_child(card)
        flowBox.append(child)
    })
}

// Show the layout panel
export async function showLayoutPanel() {
    if (state.layoutPanel && state.mainOverlay) {
        state.mainOverlay.remove_overlay(state.layoutPanel)
        state.layoutPanel = null
    }

    state.layoutPanel = createLayoutPanel()
    state.layoutPanel.set_halign(Gtk.Align.CENTER)
    state.layoutPanel.set_valign(Gtk.Align.CENTER)
    state.layoutPanel.set_can_focus(true)
    state.layoutPanel.set_focusable(true)

    // ESC key handler
    const panelKeyController = new Gtk.EventControllerKey()
    panelKeyController.set_propagation_phase(Gtk.PropagationPhase.CAPTURE)
    panelKeyController.connect("key-pressed", (_controller: Gtk.EventControllerKey, keyval: number) => {
        if (keyval === Gdk.KEY_Escape) {
            hideLayoutPanel()
            return true
        }
        return false
    })
    state.layoutPanel.add_controller(panelKeyController)

    state.layoutNameEntry?.set_text("")
    state.selectedOldName = null
    refreshLayoutList()
    refreshMappingsList()

    if (state.mainOverlay) {
        state.mainOverlay.add_overlay(state.layoutPanel)
        state.layoutPanel.grab_focus()
    }
}

// Hide the layout panel
export function hideLayoutPanel() {
    if (state.layoutPanel) {
        state.layoutPanel.set_visible(false)
    }
}
