"use client";

/**
 * First-party panel extensions that ship with the workbench.
 *
 * These live in-tree rather than in `packages/extension-*` because their panel components
 * are coupled to the app's own stores and path aliases; the registration mechanism is
 * identical to any third-party extension.
 */

import { resetLayout } from "@/components/dockview/panelRegistry";
import { useDockviewStore, whenDockviewReady } from "@/store/useDockviewStore";

import type { HudhodWorkspaceRuntime } from "../workspace";
import explorerExtension from "./explorer";
import logsExtension from "./logs";
import previewExtension from "./preview";
import terminalExtension from "./terminal";

export {
  explorerExtension,
  logsExtension,
  previewExtension,
  terminalExtension,
};

/** Every first-party panel extension, in registration order. */
export const BUILTIN_PANEL_EXTENSIONS = [
  explorerExtension,
  previewExtension,
  logsExtension,
  terminalExtension,
] as const;

/**
 * The default on-load layout, in the order panels are added.
 *
 * `editor` is added by Dockview's own `buildInitialLayout`; the rest are opened through
 * their extensions. Order matters — later panels position themselves relative to earlier ones.
 */
export const DEFAULT_LAYOUT_PANEL_IDS = [
  "editor",
  "explorer",
  "preview",
  "logs",
  "terminal",
] as const;

/** Ids of the default-layout panels that are backed by extensions. */
export const DEFAULT_EXTENSION_PANEL_IDS = DEFAULT_LAYOUT_PANEL_IDS.filter(
  (id) => id !== "editor",
);

/** Registers the first-party panel extensions with a workspace runtime. */
export function registerBuiltinPanelExtensions(
  ws: HudhodWorkspaceRuntime,
): void {
  for (const extension of BUILTIN_PANEL_EXTENSIONS) {
    ws.extensions.register(extension);
  }
}

/**
 * Opens the default-layout extension panels, one at a time so the resulting arrangement
 * is deterministic. Waits for Dockview to publish its api first.
 */
export async function openDefaultLayoutPanels(
  ws: HudhodWorkspaceRuntime,
): Promise<void> {
  await whenDockviewReady();
  for (const id of DEFAULT_EXTENSION_PANEL_IDS) {
    await ws.api.window.openPanel(id);
  }
}

/** Resets Dockview to the built-in layout, then re-opens the default extension panels. */
export async function resetWorkspaceLayout(
  ws: HudhodWorkspaceRuntime,
): Promise<void> {
  const api = useDockviewStore.getState().api;
  if (!api) return;
  resetLayout(api);
  await openDefaultLayoutPanels(ws);
}
