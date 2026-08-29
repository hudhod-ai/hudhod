import { themeGithubDarkSpaced, themeGithubLightSpaced } from "dockview-react";

import type { ColorMode } from "@/store/useThemeStore";

export function dockviewThemeFor(mode: ColorMode) {
  return mode === "dark" ? themeGithubDarkSpaced : themeGithubLightSpaced;
}
