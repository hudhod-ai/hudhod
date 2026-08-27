import type { AddPanelOptions, Direction, DockviewApi } from "dockview-react";

export type PanelId = "explorer" | "editor" | "preview" | "logs" | "terminal";

/** All panels use the same custom tab (title + "..." menu, no close X) registered in DockviewLayout. */
export const PANEL_TAB_COMPONENT = "panelTab";

export interface PanelDefinition {
  id: PanelId;
  title: string;
  component: string;
  getPosition: (api: DockviewApi) => AddPanelOptions["position"];
}

/**
 * Splits off of `preferredId` when it exists; otherwise falls back to splitting off
 * any remaining panel so a lone reopened panel never silently stacks as a tab.
 */
function splitFrom(
  api: DockviewApi,
  preferredId: PanelId,
  direction: Direction,
): AddPanelOptions["position"] {
  const referencePanel = api.getPanel(preferredId)?.id ?? api.panels[0]?.id;
  return referencePanel ? { referencePanel, direction } : undefined;
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
const INITIAL_SIZE: Partial<
  Record<PanelId, { initialWidth?: number; initialHeight?: number }>
> = {
  explorer: { initialWidth: 260 },
  preview: { initialWidth: 420 },
  logs: { initialHeight: 220 },
};

export function buildInitialLayout(api: DockviewApi) {
  for (const def of PANEL_DEFINITIONS) {
    api.addPanel({
      id: def.id,
      component: def.component,
      tabComponent: PANEL_TAB_COMPONENT,
      title: def.title,
      position: def.getPosition(api),
      ...INITIAL_SIZE[def.id],
    });
  }
}

export function openOrFocusPanel(api: DockviewApi, id: PanelId) {
  const existing = api.getPanel(id);
  if (existing) {
    existing.focus();
    return;
  }
  const def = PANEL_DEFINITIONS.find((d) => d.id === id);
  if (!def) return;
  api.addPanel({
    id: def.id,
    component: def.component,
    tabComponent: PANEL_TAB_COMPONENT,
    title: def.title,
    position: def.getPosition(api),
    ...INITIAL_SIZE[def.id],
  });
}

export function closePanel(api: DockviewApi, id: PanelId) {
  api.getPanel(id)?.api.close();
}

export function resetLayout(api: DockviewApi) {
  for (const panel of [...api.panels]) {
    api.removePanel(panel);
  }
  buildInitialLayout(api);
}
