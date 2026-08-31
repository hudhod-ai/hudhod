"use client";

import { useTheme } from "next-themes";

export type ColorMode = "light" | "dark";

/** Resolves "system" to a concrete mode for consumers that need a real color, e.g. Monaco and Dockview. */
export function useColorMode() {
  const { resolvedTheme, setTheme } = useTheme();

  // Undefined until next-themes reads storage on the client; light keeps SSR markup stable.
  const mode: ColorMode = resolvedTheme === "dark" ? "dark" : "light";

  return {
    mode,
    setMode: setTheme,
    toggle: () => setTheme(mode === "dark" ? "light" : "dark"),
  };
}
