/**
 * Workspace-wide configuration.
 *
 * These defaults were previously hardcoded inside the file system layer, which
 * meant a caller could not search `node_modules` even when they wanted to.
 * Hoisting them here makes the policy explicit and overridable — per workspace
 * and per call.
 *
 * @packageDocumentation
 */

/** Glob patterns excluded from directory listings and the file tree. */
export const DEFAULT_FILES_EXCLUDE: readonly string[] = [
  "**/.git/**",
  // "**/node_modules/**",
];

/** Glob patterns excluded from search. Broader than the tree exclusions. */
export const DEFAULT_SEARCH_EXCLUDE: readonly string[] = [
  "**/.git/**",
  // "**/node_modules/**",
  "**/dist/**",
  "**/build/**",
  "**/.next/**",
  "**/coverage/**",
  "**/*.lock",
  "**/pnpm-lock.yaml",
  "**/package-lock.json",
];

/** Glob patterns whose changes are ignored by watchers. */
export const DEFAULT_WATCHER_EXCLUDE: readonly string[] = [
  "**/.git/**",
  // "**/node_modules/**",
  "**/.next/**",
];

/**
 * Patterns omitted when snapshotting a workspace for storage.
 *
 * Everything here is either reproducible from `package.json` or machine-local.
 */
export const DEFAULT_SNAPSHOT_EXCLUDE: readonly string[] = [
  "**/.git/**",
  "**/node_modules/**",
  "**/dist/**",
  "**/.next/**",
  "**/package-lock.json",
];

/** Tunable workspace policy. */
export interface WorkspaceConfig {
  /** Absolute path of the workspace root. */
  readonly rootPath: string;
  /** Patterns hidden from directory listings and the file tree. */
  readonly filesExclude: readonly string[];
  /** Patterns skipped by search, unless a call overrides them. */
  readonly searchExclude: readonly string[];
  /** Patterns whose changes never reach watchers. */
  readonly watcherExclude: readonly string[];
  /** Patterns omitted from workspace snapshots. */
  readonly snapshotExclude: readonly string[];
  /** Largest file, in bytes, that search will read. */
  readonly maxSearchFileBytes: number;
}

/** Partial overrides accepted by {@link createWorkspaceConfig}. */
export type WorkspaceConfigOverrides = Partial<WorkspaceConfig>;

/**
 * Builds a {@link WorkspaceConfig}, filling in defaults.
 *
 * @example
 * ```ts
 * // Search node_modules too, but keep every other default.
 * const config = createWorkspaceConfig({ searchExclude: ["**\/.git/**"] });
 * ```
 */
export function createWorkspaceConfig(
  overrides: WorkspaceConfigOverrides = {},
): WorkspaceConfig {
  return {
    rootPath: overrides.rootPath ?? "/",
    filesExclude: overrides.filesExclude ?? DEFAULT_FILES_EXCLUDE,
    searchExclude: overrides.searchExclude ?? DEFAULT_SEARCH_EXCLUDE,
    watcherExclude: overrides.watcherExclude ?? DEFAULT_WATCHER_EXCLUDE,
    snapshotExclude: overrides.snapshotExclude ?? DEFAULT_SNAPSHOT_EXCLUDE,
    // 2 MiB. Larger files are almost always build artefacts or binaries.
    maxSearchFileBytes: overrides.maxSearchFileBytes ?? 2 * 1024 * 1024,
  };
}
