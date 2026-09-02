import type { PanelRenderer, RegisterViewOptions } from "@hudhod/sdk";
import { create } from "zustand";

interface ExtensionViewEntry {
  render: PanelRenderer;
  options: RegisterViewOptions;
}

interface ExtensionViewState {
  renderers: Map<string, ExtensionViewEntry>;
  collapsed: Map<string, boolean>;
  registerRenderer: (
    id: string,
    render: PanelRenderer,
    options: RegisterViewOptions,
  ) => void;
  unregisterRenderer: (id: string) => void;
  getRenderer: (id: string) => ExtensionViewEntry | undefined;
  setCollapsed: (
    containerId: string,
    viewId: string,
    collapsed: boolean,
  ) => void;
}

export const useExtensionViewStore = create<ExtensionViewState>((set, get) => ({
  renderers: new Map(),
  collapsed: new Map(),
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
  setCollapsed: (containerId, viewId, collapsed) => {
    const states = new Map(get().collapsed);
    states.set(`${containerId}:${viewId}`, collapsed);
    set({ collapsed: states });
  },
}));
