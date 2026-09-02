import type { DockviewApi } from "dockview-react";
import { create } from "zustand";

interface DockviewState {
  api: DockviewApi | null;
  openPanelIds: Set<string>;
  setApi: (api: DockviewApi | null) => void;
  syncOpenPanelIds: () => void;
}

let resolveReady: ((api: DockviewApi) => void) | undefined;
let readyPromise = new Promise<DockviewApi>((resolve) => {
  resolveReady = resolve;
});

/**
 * Resolves once Dockview has mounted and published its api.
 *
 * `DockviewLayout` mounts in a separate, client-only tree from `IdeWorkspace`'s bootstrap,
 * so anything opening panels during bootstrap must await this instead of relying on mount order.
 */
export function whenDockviewReady(): Promise<DockviewApi> {
  const { api } = useDockviewStore.getState();
  return api ? Promise.resolve(api) : readyPromise;
}

export const useDockviewStore = create<DockviewState>((set, get) => ({
  api: null,
  openPanelIds: new Set(),
  setApi: (api) => {
    if (api) {
      resolveReady?.(api);
      resolveReady = undefined;
    } else {
      readyPromise = new Promise<DockviewApi>((resolve) => {
        resolveReady = resolve;
      });
    }
    set({ api });
  },
  syncOpenPanelIds: () => {
    const { api } = get();
    set({ openPanelIds: new Set(api?.panels.map((panel) => panel.id) ?? []) });
  },
}));
