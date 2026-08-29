import { create } from "zustand";

export type ColorMode = "light" | "dark";

interface ThemeState {
  mode: ColorMode;
  toggle: () => void;
}

export const useThemeStore = create<ThemeState>((set) => ({
  mode: "light",
  toggle: () => set((state) => ({ mode: state.mode === "light" ? "dark" : "light" })),
}));
