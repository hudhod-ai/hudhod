/**
 * `@hudhod/core` — the headless runtime behind the hudhod IDE.
 *
 * This entry point is environment-agnostic and safe to import in Node, which
 * is what lets the whole runtime be unit tested without a browser. The
 * WebContainer-backed adapter lives behind the separate
 * `@hudhod/core/webcontainer` entry point.
 *
 * @packageDocumentation
 */

export * from "./base/index";
export { CommandRegistry } from "./commands/command-registry";
export { DiffService } from "./diff/diff-service";
export { InProcessExtensionHost } from "./extensions/extension-host";
export type {
  ExtensionInfo,
  ExtensionStatus,
} from "./extensions/extension-host";
export {
  extensionManifestSchema,
  parseExtensionManifest,
} from "./extensions/manifest";
export { FileSystemService } from "./fs/file-system-service";
export type { FileSystemServiceOptions } from "./fs/file-system-service";
export { InMemoryFileSystemProvider } from "./fs/in-memory-provider";
export type { InMemoryFileSystemProviderOptions } from "./fs/in-memory-provider";
export type {
  FileSystemProvider,
  ProviderEntry,
  ProviderStat,
  ProviderWatchOptions,
} from "./fs/provider";
export { FakeProcessSpawner } from "./process/fake-spawner";
export type {
  FakeCommandBehaviour,
  RecordedSpawn,
} from "./process/fake-spawner";
export {
  DEFAULT_EXEC_TIMEOUT_MS,
  DEFAULT_MAX_OUTPUT_BYTES,
  ProcessService,
} from "./process/process-service";
export type { ProcessServiceOptions } from "./process/process-service";
export type {
  ProcessSpawner,
  SpawnedProcess,
  SpawnerOptions,
} from "./process/spawner";
export { SearchService } from "./search/search-service";
export {
  ServiceRegistry,
  createServiceIdentifier,
} from "./services/service-registry";
export type { ServiceIdentifier } from "./services/service-registry";
export {
  DEFAULT_FILES_EXCLUDE,
  DEFAULT_SEARCH_EXCLUDE,
  DEFAULT_SNAPSHOT_EXCLUDE,
  DEFAULT_WATCHER_EXCLUDE,
  createWorkspaceConfig,
} from "./workspace/config";
export type {
  WorkspaceConfig,
  WorkspaceConfigOverrides,
} from "./workspace/config";
