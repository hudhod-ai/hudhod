"use client";

/** Registers the commands provided by the hudhod workbench itself. */

import { DisposableStore, type CommandRegistry } from "@hudhod/core";

import {
  openOrFocusPanel,
  resetLayout,
} from "@/components/dockview/panelRegistry";
import { useDockviewStore } from "@/store/useDockviewStore";

/**
 * Adds core workbench commands to a workspace registry.
 *
 * The returned store unregisters every command when the workspace UI unmounts,
 * preventing duplicate registrations after a route transition.
 */
export function registerBuiltinCommands(
  commands: CommandRegistry,
): DisposableStore {
  const registrations = new DisposableStore();

  for (const [id, title, panelId] of [
    ["hudhod.workbench.showExplorer", "Show Explorer", "explorer"],
    ["hudhod.workbench.showLogs", "Show Logs", "logs"],
    ["hudhod.workbench.showTerminal", "Show Terminal", "terminal"],
    ["hudhod.workbench.showPreview", "Show Preview", "preview"],
  ] as const) {
    registrations.add(
      commands.registerCommand(
        id,
        () => {
          const api = useDockviewStore.getState().api;
          if (api) openOrFocusPanel(api, panelId);
        },
        { title, category: "Workbench" },
      ),
    );
  }

  registrations.add(
    commands.registerCommand(
      "hudhod.workbench.resetLayout",
      () => {
        const api = useDockviewStore.getState().api;
        if (api) resetLayout(api);
      },
      { title: "Reset Layout", category: "Workbench" },
    ),
  );

  return registrations;
}