import { themeGithubDarkSpaced, themeGithubLightSpaced } from "dockview-react";

import type { ColorMode } from "@/hooks/useColorMode";

export function dockviewThemeFor(mode: ColorMode) {
  return mode === "dark" ? themeGithubDarkSpaced : themeGithubLightSpaced;
}
