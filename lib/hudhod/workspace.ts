"use client";

/**
 * Client-side composition root for one WebContainer workspace.
 *
 * Runtime services are scoped to the WebContainer instance rather than React
 * component lifetimes, so panels can share them without recreating watchers or
 * process registries on every render.
 */

import {
  CommandRegistry,
  DiffService,
  FileSystemService,
  InProcessExtensionHost,
  KeybindingRegistry,
  ProcessService,
  SearchService,
  WindowService,
} from "@hudhod/core";
import type { HudhodApi } from "@hudhod/sdk";
import {
  WebContainerFileSystemProvider,
  WebContainerProcessSpawner,
} from "@hudhod/core/webcontainer";
import type { WebContainer } from "@webcontainer/api";
import { createWindowUiProvider } from "./window-bridge";

/** The headless services backing one mounted WebContainer workspace. */
export interface HudhodWorkspaceRuntime {
  /** File access and watcher events. */
  readonly fs: FileSystemService;
  /** Glob and content search. */
  readonly search: SearchService;
  /** Text and file comparison. */
  readonly diff: DiffService;
  /** Multi-process command execution. */
  readonly process: ProcessService;
  /** Command catalog for UI and extensions. */
  readonly commands: CommandRegistry;
  /** Keybinding registry. */
  readonly keybindings: KeybindingRegistry;
  /** Window and UI operations. */
  readonly window: WindowService;
  /** Extension host for lazy loading and activation. */
  readonly extensions: InProcessExtensionHost;
  /** Full API surface for extensions. */
  readonly api: HudhodApi;
  /** Releases every workspace-scoped service. */
  dispose(): void;
}

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

  const fs = new FileSystemService(
    new WebContainerFileSystemProvider(container),
  );

  // Detect platform for keybindings
  const platform =
    typeof navigator !== "undefined" &&
    /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      ? "mac"
      : "other";

  const keybindings = new KeybindingRegistry(platform);
  const window = new WindowService(createWindowUiProvider());
  const commands = new CommandRegistry();
  const search = new SearchService(fs);
  const diff = new DiffService(fs);
  const process = new ProcessService(new WebContainerProcessSpawner(container));

  const api: HudhodApi = {
    version: "0.1.0",
    fs,
    workspace: {
      // Stub: workspace not yet implemented
      roots: [],
      onDidChangeRoots: () => ({ dispose: () => {} }),
    } as any,
    search,
    diff,
    process,
    terminal: {
      // Stub: terminal not yet implemented
      create: async () => {
        throw new Error("Terminal API not yet implemented");
      },
      terminals: [],
      onDidOpenTerminal: () => ({ dispose: () => {} }),
      onDidCloseTerminal: () => ({ dispose: () => {} }),
    } as any,
    commands,
    keybindings,
    window,
  };

  const extensions = new InProcessExtensionHost(api);

  const runtime: HudhodWorkspaceRuntime = {
    fs,
    search,
    diff,
    process,
    commands,
    keybindings,
    window,
    extensions,
    api,
    dispose() {
      fs.dispose();
      process.dispose();
      commands.dispose();
      keybindings.dispose();
      window.dispose();
      extensions.dispose();
      runtimes.delete(container);
    },
  };
  runtimes.set(container, runtime);
  return runtime;
}

/** Releases the runtime associated with a WebContainer, if one exists. */
export function disposeHudhodWorkspace(container: WebContainer): void {
  runtimes.get(container)?.dispose();
}
