import type { PanelInfo, ViewInfo } from "@hudhod/core";
import { create } from "zustand";

import type { HudhodWorkspaceRuntime } from "@/lib/hudhod/workspace";

interface HudhodWorkspaceState {
  workspace: HudhodWorkspaceRuntime | null;
  panels: readonly PanelInfo[];
  views: readonly ViewInfo[];
  setWorkspace: (workspace: HudhodWorkspaceRuntime | null) => void;
  setPanels: (panels: readonly PanelInfo[]) => void;
  setViews: (views: readonly ViewInfo[]) => void;
}

export const useHudhodWorkspaceStore = create<HudhodWorkspaceState>((set) => ({
  workspace: null,
  panels: [],
  views: [],
  setWorkspace: (workspace) => set({ workspace }),
  setPanels: (panels) => set({ panels }),
  setViews: (views) => set({ views }),
}));
