/**
 * `@hudhod/sdk` — the public API surface for hudhod extensions.
 *
 * This package is types-first and has no runtime dependencies. The only values
 * it exports are {@link defineExtension} and {@link isHudhodError}; everything
 * else is erased at build time.
 *
 * @packageDocumentation
 */

export type { HudhodApi } from "./api";
export type {
  CommandDescriptor,
  CommandsApi,
  RegisterCommandOptions,
} from "./commands";
export type {
  KeybindingContribution,
  KeybindingsApi,
  ResolvedKeybinding,
} from "./keybindings";
export type { DiffApi, DiffChange, DiffOptions, DiffStat } from "./diff";
export { isHudhodError } from "./errors";
export type { HudhodError, HudhodErrorCode } from "./errors";
export { defineExtension } from "./extension";
export type {
  ActivationEvent,
  CommandContribution,
  Contributions,
  Extension,
  ExtensionContext,
  ExtensionManifest,
  PanelContribution,
} from "./extension";
export type {
  DeleteOptions,
  DirectoryEntry,
  FileChangeEvent,
  FileChangeType,
  FileStat,
  FileSystemApi,
  FileType,
  MoveOptions,
  WatchOptions,
  WriteFileOptions,
} from "./fs";
export type { CancellationToken, Disposable, Event } from "./lifecycle";
export type {
  ExecOptions,
  ExecResult,
  ProcessApi,
  ProcessHandle,
  ProcessInfo,
  ProcessStatus,
  SpawnOptions,
} from "./process";
export type {
  FindFilesOptions,
  FindInFilesOptions,
  SearchApi,
  SearchMatch,
  SearchResult,
} from "./search";
export type { CreateTerminalOptions, Terminal, TerminalApi } from "./terminal";
export type {
  ActiveEditor,
  InputBoxOptions,
  MessageSeverity,
  PanelLocation,
  PanelRenderer,
  QuickPickItem,
  QuickPickOptions,
  RegisterPanelOptions,
  WindowApi,
} from "./window";
export type {
  ApplyEditOptions,
  ApplyEditResult,
  EditHistoryEntry,
  EditMode,
  FileEdit,
  Range,
  TextEdit,
  WorkspaceApi,
} from "./workspace";
