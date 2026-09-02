"use client";

/**
 * Bridges extension window requests into the React UI layer via Zustand stores.
 *
 * The WindowService delegates to this provider, which coordinates with
 * useWindowUiStore (for dialogs/messages) and useFileSystemStore (for openFile).
 */

import type { WindowUiProvider } from "@hudhod/core";
import type { ActiveEditor, PanelLocation } from "@hudhod/sdk";
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
import { useExtensionViewStore } from "@/store/useExtensionViewStore";
import { getWebContainer } from "@/lib/webcontainer/boot";
import { getHudhodWorkspace } from "./workspace";

/** Sidebar docks show one view at a time; the bottom dock tabs its panels together. */
const EXCLUSIVE_LOCATIONS = new Set<PanelLocation>(["left", "right"]);

function activeEditorFor(
  state: ReturnType<typeof useFileSystemStore.getState>,
): ActiveEditor | undefined {
  if (!state.activePath) return undefined;
  const tab = state.tabs.find(
    (candidate) => candidate.path === state.activePath,
  );
  return tab ? { path: tab.path, dirty: tab.dirty } : undefined;
}

/** Opens (or focuses) a panel, activating its owning extension first so a renderer exists to mount. */
async function openExtensionPanel(id: string): Promise<void> {
  const instance = await getWebContainer();
  const ws = getHudhodWorkspace(instance);
  await ws.extensions.activateByEvent(`onView:${id}`);
  const views = ws.views.getViewsForContainer(id);
  for (const view of views) {
    await ws.extensions.activateByEvent(`onView:${view.id}`);
  }

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

  // Added before evicting so the incoming panel joins the group and inherits its size.
  if (EXCLUSIVE_LOCATIONS.has(location)) {
    for (const panel of ws.panels.getPanels()) {
      if (panel.id === id || panel.location !== location) continue;
      api.getPanel(panel.id)?.api.close();
    }
  }
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

    registerView(id, render, options) {
      useExtensionViewStore.getState().registerRenderer(id, render, options);
      let disposed = false;
      return {
        dispose: () => {
          if (disposed) return;
          disposed = true;
          useExtensionViewStore.getState().unregisterRenderer(id);
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
      return activeEditorFor(useFileSystemStore.getState());
    },

    onDidChangeActiveEditor(listener) {
      let previous = activeEditorFor(useFileSystemStore.getState());
      const unsubscribe = useFileSystemStore.subscribe((state) => {
        const next = activeEditorFor(state);
        if (next?.path === previous?.path && next?.dirty === previous?.dirty)
          return;
        previous = next;
        listener(next);
      });
      return { dispose: unsubscribe };
    },
  };
}
