"use client";

import "dockview-react/dist/styles/dockview.css";
import "./dockviewOverrides.css";
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview-react";

import { useColorMode } from "@/hooks/useColorMode";
import { useDockviewStore } from "@/store/useDockviewStore";

import {
  buildInitialLayout,
  EXTENSION_PANEL_HOST,
  PANEL_TAB_COMPONENT,
} from "./panelRegistry";
import { EditorPanel } from "./panels/EditorPanel";
import { ViewContainerHost } from "./panels/ViewContainerHost";
import { PanelTab } from "./panels/PanelTab";
import { dockviewThemeFor } from "./theme";

const components: Record<
  string,
  (props: IDockviewPanelProps) => React.ReactElement
> = {
  editor: EditorPanel,
  [EXTENSION_PANEL_HOST]: ViewContainerHost,
};

const tabComponents = {
  [PANEL_TAB_COMPONENT]: PanelTab,
};

function handleReady(event: DockviewReadyEvent) {
  const { api } = event;
  buildInitialLayout(api);

  const { setApi, syncOpenPanelIds } = useDockviewStore.getState();
  setApi(api);
  syncOpenPanelIds();
  api.onDidAddPanel(() => syncOpenPanelIds());
  api.onDidRemovePanel(() => syncOpenPanelIds());
}

export function DockviewLayout() {
  const { mode } = useColorMode();

  return (
    <DockviewReact
      className="h-full w-full"
      components={components}
      tabComponents={tabComponents}
      theme={dockviewThemeFor(mode)}
      onReady={handleReady}
    />
  );
}
