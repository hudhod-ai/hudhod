"use client";

/**
 * Bridges extension window requests into the React UI layer via Zustand stores.
 *
 * The WindowService delegates to this provider, which coordinates with
 * useWindowUiStore (for dialogs/messages) and useFileSystemStore (for openFile).
 */

import type { WindowUiProvider } from "@hudhod/core";
import { useFileSystemStore } from "@/store/useFileSystemStore";
import { useWindowUiStore } from "@/store/useWindowUiStore";
import { getWebContainer } from "@/lib/webcontainer/boot";
import { getHudhodWorkspace } from "./workspace";

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

    registerPanel() {
      throw new Error("Panel registration not yet implemented");
    },

    async openPanel() {
      throw new Error("Panel opening not yet implemented");
    },

    async closePanel() {
      throw new Error("Panel closing not yet implemented");
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
