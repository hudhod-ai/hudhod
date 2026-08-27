import { create } from "zustand";
import type { DockviewApi } from "dockview-react";

interface DockviewState {
  api: DockviewApi | null;
  openPanelIds: Set<string>;
  setApi: (api: DockviewApi | null) => void;
  syncOpenPanelIds: () => void;
}

export const useDockviewStore = create<DockviewState>((set, get) => ({
  api: null,
  openPanelIds: new Set(),
  setApi: (api) => set({ api }),
  syncOpenPanelIds: () => {
    const { api } = get();
    set({ openPanelIds: new Set(api?.panels.map((panel) => panel.id) ?? []) });
  },
}));
