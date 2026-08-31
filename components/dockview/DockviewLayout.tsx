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

import { buildInitialLayout, PANEL_TAB_COMPONENT } from "./panelRegistry";
import { EditorPanel } from "./panels/EditorPanel";
import { ExplorerPanel } from "./panels/ExplorerPanel";
import { LogsPanel } from "./panels/LogsPanel";
import { PanelTab } from "./panels/PanelTab";
import { PreviewPanel } from "./panels/PreviewPanel";
import { TerminalPanel } from "./panels/TerminalPanel";
import { dockviewThemeFor } from "./theme";

const components: Record<
  string,
  (props: IDockviewPanelProps) => React.ReactElement
> = {
  explorer: ExplorerPanel,
  editor: EditorPanel,
  logs: LogsPanel,
  terminal: TerminalPanel,
  preview: PreviewPanel,
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
