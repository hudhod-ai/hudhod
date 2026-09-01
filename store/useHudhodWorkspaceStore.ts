import type { PanelInfo } from "@hudhod/core";
import { create } from "zustand";

import type { HudhodWorkspaceRuntime } from "@/lib/hudhod/workspace";

interface HudhodWorkspaceState {
  workspace: HudhodWorkspaceRuntime | null;
  panels: readonly PanelInfo[];
  setWorkspace: (workspace: HudhodWorkspaceRuntime | null) => void;
  setPanels: (panels: readonly PanelInfo[]) => void;
}

export const useHudhodWorkspaceStore = create<HudhodWorkspaceState>((set) => ({
  workspace: null,
  panels: [],
  setWorkspace: (workspace) => set({ workspace }),
  setPanels: (panels) => set({ panels }),
}));
