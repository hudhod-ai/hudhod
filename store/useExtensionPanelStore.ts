import type { PanelRenderer, RegisterPanelOptions } from "@hudhod/sdk";
import { create } from "zustand";

interface ExtensionPanelEntry {
  render: PanelRenderer;
  options: RegisterPanelOptions;
}

interface ExtensionPanelState {
  renderers: Map<string, ExtensionPanelEntry>;
  registerRenderer: (
    id: string,
    render: PanelRenderer,
    options: RegisterPanelOptions,
  ) => void;
  unregisterRenderer: (id: string) => void;
  getRenderer: (id: string) => ExtensionPanelEntry | undefined;
}

/** Dumb registry of extension panel renderers; orchestration lives in window-bridge.ts. */
export const useExtensionPanelStore = create<ExtensionPanelState>(
  (set, get) => ({
    renderers: new Map(),
    registerRenderer: (id, render, options) => {
      const renderers = new Map(get().renderers);
      renderers.set(id, { render, options });
      set({ renderers });
    },
    unregisterRenderer: (id) => {
      const renderers = new Map(get().renderers);
      renderers.delete(id);
      set({ renderers });
    },
    getRenderer: (id) => get().renderers.get(id),
  }),
);
