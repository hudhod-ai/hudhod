import { create } from "zustand";

export interface FileTreeNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileTreeNode[];
}

export interface OpenTab {
  path: string;
  content: string;
  dirty: boolean;
}

interface FileSystemState {
  tree: FileTreeNode[];
  tabs: OpenTab[];
  activePath: string | null;
  setTree: (tree: FileTreeNode[]) => void;
  openFile: (path: string, content: string) => void;
  closeFile: (path: string) => void;
  setActivePath: (path: string | null) => void;
  updateContent: (path: string, content: string) => void;
  markSaved: (path: string) => void;
  renameOpenTab: (oldPath: string, newPath: string) => void;
  removeOpenTabsUnderPath: (path: string) => void;
}

export const useFileSystemStore = create<FileSystemState>((set, get) => ({
  tree: [],
  tabs: [],
  activePath: null,
  setTree: (tree) => set({ tree }),
  openFile: (path, content) => {
    const existing = get().tabs.find((tab) => tab.path === path);
    if (!existing) {
      set((state) => ({
        tabs: [...state.tabs, { path, content, dirty: false }],
      }));
    }
    set({ activePath: path });
  },
  closeFile: (path) => {
    const { tabs, activePath } = get();
    const remaining = tabs.filter((tab) => tab.path !== path);
    const nextActive =
      activePath === path ? (remaining[remaining.length - 1]?.path ?? null) : activePath;
    set({ tabs: remaining, activePath: nextActive });
  },
  setActivePath: (activePath) => set({ activePath }),
  updateContent: (path, content) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.path === path ? { ...tab, content, dirty: true } : tab)),
    })),
  markSaved: (path) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.path === path ? { ...tab, dirty: false } : tab)),
    })),
  renameOpenTab: (oldPath, newPath) =>
    set((state) => ({
      tabs: state.tabs.map((tab) => (tab.path === oldPath ? { ...tab, path: newPath } : tab)),
      activePath: state.activePath === oldPath ? newPath : state.activePath,
    })),
  removeOpenTabsUnderPath: (path) =>
    set((state) => {
      const remaining = state.tabs.filter(
        (tab) => tab.path !== path && !tab.path.startsWith(`${path}/`),
      );
      const activeStillOpen = remaining.some((tab) => tab.path === state.activePath);
      return {
        tabs: remaining,
        activePath: activeStillOpen
          ? state.activePath
          : (remaining[remaining.length - 1]?.path ?? null),
      };
    }),
}));
