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
  ProcessService,
  SearchService,
} from "@hudhod/core";
import {
  WebContainerFileSystemProvider,
  WebContainerProcessSpawner,
} from "@hudhod/core/webcontainer";
import type { WebContainer } from "@webcontainer/api";

/** The headless services backing one mounted WebContainer workspace. */
export interface HudhodWorkspaceRuntime {
  /** File access and watcher events. */
  readonly fs: FileSystemService;
  /** Glob and content search. */
  readonly search: SearchService;
  /** Text and file comparison. */
  readonly diff: DiffService;
  /** Multi-process command execution. */
  readonly processes: ProcessService;
  /** Command catalog for UI and extensions. */
  readonly commands: CommandRegistry;
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
  const runtime: HudhodWorkspaceRuntime = {
    fs,
    search: new SearchService(fs),
    diff: new DiffService(fs),
    processes: new ProcessService(new WebContainerProcessSpawner(container)),
    commands: new CommandRegistry(),
    dispose() {
      fs.dispose();
      runtime.processes.dispose();
      runtime.commands.dispose();
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
