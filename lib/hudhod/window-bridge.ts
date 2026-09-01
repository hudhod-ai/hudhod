"use client";

/**
 * Bridges extension window requests into the React UI layer via Zustand stores.
 *
 * The WindowService delegates to this provider, which coordinates with
 * useWindowUiStore (for dialogs/messages) and useFileSystemStore (for openFile).
 */

import type { WindowUiProvider } from "@hudhod/core";
import {
  buildExtensionPanelDefinition,
  closePanel as closeDockviewPanel,
  openOrFocusPanel,
  registerDynamicPanel,
  unregisterDynamicPanel,
} from "@/components/dockview/panelRegistry";
import { useFileSystemStore } from "@/store/useFileSystemStore";
import { useWindowUiStore } from "@/store/useWindowUiStore";
import { useDockviewStore } from "@/store/useDockviewStore";
import { useExtensionPanelStore } from "@/store/useExtensionPanelStore";
import { getWebContainer } from "@/lib/webcontainer/boot";
import { getHudhodWorkspace } from "./workspace";

/** Opens (or focuses) a panel, activating its owning extension first so a renderer exists to mount. */
async function openExtensionPanel(id: string): Promise<void> {
  const instance = await getWebContainer();
  const ws = getHudhodWorkspace(instance);
  await ws.extensions.activateByEvent(`onView:${id}`);

  const api = useDockviewStore.getState().api;
  if (!api) return;

  if (api.getPanel(id)) {
    openOrFocusPanel(api, id);
    return;
  }

  const entry = useExtensionPanelStore.getState().getRenderer(id);
  const panelInfo = ws.panels.getPanels().find((p) => p.id === id);
  const title = entry?.options.title ?? panelInfo?.title ?? id;
  const location = entry?.options.location ?? panelInfo?.location ?? "bottom";

  registerDynamicPanel(
    buildExtensionPanelDefinition(
      id,
      title,
      location,
      entry?.options.initialWidth,
      entry?.options.initialHeight,
    ),
  );
  openOrFocusPanel(api, id);
}

/**
 * Creates a WindowUiProvider backed by the app's Zustand stores.
 *
 * This is injected into the WindowService when the workspace is initialized,
 * allowing extensions to show dialogs and open files through the React UI layer.
 */
export function createWindowUiProvider(): WindowUiProvider {
  return {
    async showMessage(message, severity) {
      await useWindowUiStore.getState().requestMessage(message, severity);
    },

    async showInputBox(options) {
      return useWindowUiStore.getState().requestInputBox(options);
    },

    async showQuickPick(items, options) {
      return useWindowUiStore.getState().requestQuickPick(items, options);
    },

    registerPanel(id, render, options) {
      useExtensionPanelStore.getState().registerRenderer(id, render, options);
      if (options.openImmediately) void openExtensionPanel(id);

      let disposed = false;
      return {
        dispose: () => {
          if (disposed) return;
          disposed = true;
          useExtensionPanelStore.getState().unregisterRenderer(id);
          unregisterDynamicPanel(id);
          const api = useDockviewStore.getState().api;
          if (api) closeDockviewPanel(api, id);
        },
      };
    },

    async openPanel(id) {
      await openExtensionPanel(id);
    },

    async closePanel(id) {
      const api = useDockviewStore.getState().api;
      const panel = api?.getPanel(id);
      if (!panel) return false;
      panel.api.close();
      return true;
    },

    async openFile(path) {
      const instance = await getWebContainer();
      const workspace = getHudhodWorkspace(instance);
      const content = await workspace.fs.readTextFile(path);
      useFileSystemStore.getState().openFile(path, content);
    },

    get activeEditor() {
      const { activePath, tabs } = useFileSystemStore.getState();
      if (!activePath) return undefined;
      const tab = tabs.find((t) => t.path === activePath);
      if (!tab) return undefined;
      return {
        path: activePath,
        dirty: tab.dirty,
      };
    },

    onDidChangeActiveEditor(listener) {
      let prevActiveTab: { path: string; dirty: boolean } | undefined;
      const unsubscribe = (useFileSystemStore.subscribe as any)(
        (state: any) => {
          const activeTab = state.tabs.find(
            (t: any) => t.path === state.activePath,
          );
          return activeTab
            ? { path: state.activePath, dirty: activeTab.dirty }
            : undefined;
        },
        (activeTab: any) => {
          if (JSON.stringify(activeTab) !== JSON.stringify(prevActiveTab)) {
            prevActiveTab = activeTab;
            listener(activeTab);
          }
        },
      );
      return { dispose: unsubscribe };
    },
  };
}
