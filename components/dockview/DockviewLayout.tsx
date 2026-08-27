"use client";

import "dockview-react/dist/styles/dockview.css";
import "./dockviewOverrides.css";
import {
  DockviewReact,
  type DockviewReadyEvent,
  type IDockviewPanelProps,
} from "dockview-react";
import { useThemeStore } from "@/store/useThemeStore";
import { useDockviewStore } from "@/store/useDockviewStore";
import { dockviewThemeFor } from "./theme";
import { buildInitialLayout, PANEL_TAB_COMPONENT } from "./panelRegistry";
import { ExplorerPanel } from "./panels/ExplorerPanel";
import { EditorPanel } from "./panels/EditorPanel";
import { LogsPanel } from "./panels/LogsPanel";
import { TerminalPanel } from "./panels/TerminalPanel";
import { PreviewPanel } from "./panels/PreviewPanel";
import { PanelTab } from "./panels/PanelTab";

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
  const mode = useThemeStore((state) => state.mode);

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
