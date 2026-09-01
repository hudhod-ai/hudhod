import type { PanelLocation } from "@hudhod/sdk";
import type { AddPanelOptions, Direction, DockviewApi } from "dockview-react";

export type BuiltinPanelId =
  | "explorer"
  | "editor"
  | "preview"
  | "logs"
  | "terminal";

/** Extension panel ids are extension-defined strings; built-ins are the closed union above. */
export type PanelId = string;

/** All panels use the same custom tab (title + "..." menu, no close X) registered in DockviewLayout. */
export const PANEL_TAB_COMPONENT = "panelTab";

/** Single Dockview component every extension panel renders through, keyed by `props.api.id`. */
export const EXTENSION_PANEL_HOST = "extension-panel-host";

export interface PanelDefinition {
  id: PanelId;
  title: string;
  component: string;
  getPosition: (api: DockviewApi) => AddPanelOptions["position"];
  initialWidth?: number;
  initialHeight?: number;
}

/**
 * Splits off of `preferredId` when it exists; otherwise falls back to splitting off
 * any remaining panel so a lone reopened panel never silently stacks as a tab.
 */
function splitFrom(
  api: DockviewApi,
  preferredId: BuiltinPanelId,
  direction: Direction,
): AddPanelOptions["position"] {
  const referencePanel = api.getPanel(preferredId)?.id ?? api.panels[0]?.id;
  return referencePanel ? { referencePanel, direction } : undefined;
}

/** Maps a contributed panel's dock location to a Dockview split direction off the editor. */
function positionForLocation(
  api: DockviewApi,
  location: PanelLocation,
): AddPanelOptions["position"] {
  switch (location) {
    case "left":
      return splitFrom(api, "editor", "left");
    case "right":
      return splitFrom(api, "editor", "right");
    case "bottom":
      return splitFrom(api, "editor", "below");
    case "center": {
      const referencePanel = api.getPanel("editor")?.id ?? api.panels[0]?.id;
      return referencePanel ? { referencePanel, direction: "within" } : undefined;
    }
  }
}

export const PANEL_DEFINITIONS: PanelDefinition[] = [
  {
    id: "editor",
    title: "Editor",
    component: "editor",
    getPosition: () => undefined,
  },
  {
    id: "explorer",
    title: "Explorer",
    component: "explorer",
    getPosition: (api) => splitFrom(api, "editor", "left"),
  },
  {
    id: "preview",
    title: "Preview",
    component: "preview",
    getPosition: (api) => splitFrom(api, "editor", "right"),
  },
  {
    id: "logs",
    title: "Logs",
    component: "logs",
    getPosition: (api) => splitFrom(api, "editor", "below"),
  },
  {
    id: "terminal",
    title: "Terminal",
    component: "terminal",
    getPosition: (api) =>
      api.getPanel("logs")
        ? { referencePanel: "logs", direction: "within" }
        : splitFrom(api, "editor", "below"),
  },
];

/** Reference-panel widths only apply the first time a panel is added. */
const INITIAL_SIZE: Partial<Record<BuiltinPanelId, { initialWidth?: number; initialHeight?: number }>> = {
  explorer: { initialWidth: 260 },
  preview: { initialWidth: 420 },
  logs: { initialHeight: 220 },
};

/** Panels contributed by extensions, registered/unregistered as extensions (de)activate. */
const DYNAMIC_PANELS = new Map<string, PanelDefinition>();

export function registerDynamicPanel(def: PanelDefinition) {
  DYNAMIC_PANELS.set(def.id, def);
}

export function unregisterDynamicPanel(id: string) {
  DYNAMIC_PANELS.delete(id);
}

/** Builds a {@link PanelDefinition} for an extension panel from its registration options. */
export function buildExtensionPanelDefinition(
  id: string,
  title: string,
  location: PanelLocation,
  initialWidth?: number,
  initialHeight?: number,
): PanelDefinition {
  return {
    id,
    title,
    component: EXTENSION_PANEL_HOST,
    getPosition: (api) => positionForLocation(api, location),
    initialWidth,
    initialHeight,
  };
}

/** Iterates built-ins only — dynamic panels must never be force-opened by a layout reset. */
export function buildInitialLayout(api: DockviewApi) {
  for (const def of PANEL_DEFINITIONS) {
    api.addPanel({
      id: def.id,
      component: def.component,
      tabComponent: PANEL_TAB_COMPONENT,
      title: def.title,
      position: def.getPosition(api),
      ...INITIAL_SIZE[def.id as BuiltinPanelId],
    });
  }
}

export function openOrFocusPanel(api: DockviewApi, id: PanelId) {
  const existing = api.getPanel(id);
  if (existing) {
    existing.focus();
    return;
  }
  const def =
    PANEL_DEFINITIONS.find((d) => d.id === id) ?? DYNAMIC_PANELS.get(id);
  if (!def) return;
  api.addPanel({
    id: def.id,
    component: def.component,
    tabComponent: PANEL_TAB_COMPONENT,
    title: def.title,
    position: def.getPosition(api),
    ...(PANEL_DEFINITIONS.includes(def)
      ? INITIAL_SIZE[def.id as BuiltinPanelId]
      : { initialWidth: def.initialWidth, initialHeight: def.initialHeight }),
  });
}

export function closePanel(api: DockviewApi, id: PanelId) {
  api.getPanel(id)?.api.close();
}

export function resetLayout(api: DockviewApi) {
  // Snapshot first: removePanel mutates the live api.panels collection.
  const panels = Array.from(api.panels);

  for (const panel of panels) {
    api.removePanel(panel);
  }

  buildInitialLayout(api);
}
