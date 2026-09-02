"use client";

/**
 * Client-side composition root for one WebContainer workspace.
 *
 * Runtime services are scoped to the WebContainer instance rather than React
 * component lifetimes, so panels can share them without recreating watchers or
 * process registries on every render.
 */

import { createHudhodRuntime, type HudhodRuntime } from "@hudhod/core";
import { createWebContainerServices } from "@hudhod/webcontainer";
import type { WebContainer } from "@webcontainer/api";
import { createWindowUiProvider } from "./window-bridge";

/** The headless services backing one mounted WebContainer workspace. */
export type HudhodWorkspaceRuntime = HudhodRuntime;

const runtimes = new WeakMap<WebContainer, HudhodWorkspaceRuntime>();

/**
 * Gets the singleton service runtime for a WebContainer instance.
 *
 * @example
 * ```ts
 * const workspace = getHudhodWorkspace(container);
 * await workspace.fs.writeTextFile("/src/index.ts", "export {};");
 * await workspace.extensions.register(myExtension);
 * ```
 */
export function getHudhodWorkspace(
  container: WebContainer,
): HudhodWorkspaceRuntime {
  const existing = runtimes.get(container);
  if (existing) return existing;

  const platform =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      ? "mac"
      : "other";

  const runtime = createHudhodRuntime({
    ...createWebContainerServices(container),
    windowUiProvider: createWindowUiProvider(),
    platform,
  });
  runtimes.set(container, runtime);
  return runtime;
}

/** Releases the runtime associated with a WebContainer, if one exists. */
export function disposeHudhodWorkspace(container: WebContainer): void {
  runtimes.get(container)?.dispose();
}
