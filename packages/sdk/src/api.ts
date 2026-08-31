/**
 * The root hudhod API object.
 *
 * @packageDocumentation
 */

import type { CommandsApi } from "./commands";
import type { DiffApi } from "./diff";
import type { FileSystemApi } from "./fs";
import type { ProcessApi } from "./process";
import type { SearchApi } from "./search";
import type { TerminalApi } from "./terminal";
import type { WindowApi } from "./window";
import type { WorkspaceApi } from "./workspace";

/**
 * Everything an extension can reach.
 *
 * An instance is passed to {@link ExtensionContext.hudhod} on activation.
 * The same surface backs the AI agent tool layer, so anything an extension can
 * do, an agent can do.
 */
export interface HudhodApi {
  /** Semver version of the host runtime. */
  readonly version: string;
  /** Read and write files. */
  readonly fs: FileSystemApi;
  /** Workspace roots, edits, and edit history. */
  readonly workspace: WorkspaceApi;
  /** Find files and search their contents. */
  readonly search: SearchApi;
  /** Compare text and apply patches. */
  readonly diff: DiffApi;
  /** Spawn and manage processes. */
  readonly process: ProcessApi;
  /** Create and control interactive shells. */
  readonly terminal: TerminalApi;
  /** Register and invoke commands. */
  readonly commands: CommandsApi;
  /** Show UI and contribute panels. */
  readonly window: WindowApi;
}
