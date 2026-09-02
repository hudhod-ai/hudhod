"use client";

/** Registers the commands provided by the hudhod workbench itself. */

import {
  DisposableStore,
  KeybindingRegistry,
  type CommandRegistry,
} from "@hudhod/core";

import { resetWorkspaceLayout } from "@/lib/hudhod/builtin-extensions";
import type { HudhodWorkspaceRuntime } from "@/lib/hudhod/workspace";

/**
 * Adds core workbench commands to a workspace registry.
 *
 * @param ws The workspace runtime owning the command/keybinding registries and window API.
 * @param openCommandPalette Callback to open the command palette.
 * @param refreshExplorer Callback to refresh the file explorer.
 *
 * The returned store unregisters every command when the workspace UI unmounts,
 * preventing duplicate registrations after a route transition.
 */
export function registerBuiltinCommands(
  ws: HudhodWorkspaceRuntime,
  openCommandPalette: () => void,
  refreshExplorer?: () => Promise<void>,
): DisposableStore {
  const commands: CommandRegistry = ws.commands;
  const keybindings: KeybindingRegistry = ws.keybindings;
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
        async () => {
          await ws.api.window.openPanel(panelId);
        },
        { title, category: "Workbench" },
      ),
    );
  }

  registrations.add(
    commands.registerCommand(
      "hudhod.workbench.resetLayout",
      async () => {
        await resetWorkspaceLayout(ws);
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
