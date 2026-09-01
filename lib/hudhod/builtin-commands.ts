"use client";

/** Registers the commands provided by the hudhod workbench itself. */

import {
  DisposableStore,
  KeybindingRegistry,
  type CommandRegistry,
} from "@hudhod/core";

import {
  openOrFocusPanel,
  resetLayout,
} from "@/components/dockview/panelRegistry";
import { useDockviewStore } from "@/store/useDockviewStore";

/**
 * Adds core workbench commands to a workspace registry.
 *
 * @param commands The command registry to register workbench commands in.
 * @param keybindings The keybinding registry to register workbench keybindings in.
 * @param openCommandPalette Callback to open the command palette.
 * @param refreshExplorer Callback to refresh the file explorer.
 *
 * The returned store unregisters every command when the workspace UI unmounts,
 * preventing duplicate registrations after a route transition.
 */
export function registerBuiltinCommands(
  commands: CommandRegistry,
  keybindings: KeybindingRegistry,
  openCommandPalette: () => void,
  refreshExplorer?: () => Promise<void>,
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

  registrations.add(
    commands.registerCommand(
      "hudhod.workbench.showCommandPalette",
      () => openCommandPalette(),
      { title: "Show Command Palette", category: "Workbench" },
    ),
  );

  if (refreshExplorer) {
    registrations.add(
      commands.registerCommand(
        "hudhod.workbench.refreshExplorer",
        async () => {
          await refreshExplorer();
        },
        { title: "Refresh Explorer", category: "Workbench" },
      ),
    );
  }

  // Register keybindings for built-in commands
  registrations.add(
    keybindings.registerKeybinding({
      command: "hudhod.workbench.showCommandPalette",
      key: "ctrl+shift+p",
      mac: "cmd+shift+p",
    }),
  );

  return registrations;
}
