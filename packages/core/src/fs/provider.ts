/**
 * The storage abstraction every file system service is built on.
 *
 * Two implementations ship with hudhod: an in-memory provider used by tests and
 * previews, and a WebContainer-backed provider used in the browser. Keeping the
 * services above this seam is what allows the entire runtime to be exercised in
 * Node without a browser.
 *
 * Providers deal in **raw bytes and normalised absolute paths**. Higher-level
 * concerns — text encoding, glob filtering, exclusion defaults, change
 * batching — belong to {@link FileSystemService}, not here. A provider is the
 * smallest surface that a new storage backend must implement.
 *
 * @packageDocumentation
 */

import type { Disposable, FileChangeEvent, FileType } from "@hudhod/sdk";

/** Metadata a provider reports for a path. */
export interface ProviderStat {
  /** Whether the entry is a file, directory, or symlink. */
  readonly type: FileType;
  /** Size in bytes. Providers may report `0` for directories. */
  readonly size: number;
  /** Last-modified time, in milliseconds since the Unix epoch. */
  readonly mtime: number;
}

/** A child entry reported by {@link FileSystemProvider.readDirectory}. */
export interface ProviderEntry {
  /** Entry name, with no directory component. */
  readonly name: string;
  /** Whether the entry is a file, directory, or symlink. */
  readonly type: FileType;
}

/** Options for {@link FileSystemProvider.watch}. */
export interface ProviderWatchOptions {
  /** Whether to watch nested directories. */
  readonly recursive: boolean;
}

/**
 * A storage backend.
 *
 * ## Implementer contract
 *
 * - Every `path` argument is already normalised: absolute, POSIX-style, no
 *   trailing slash, no `.` or `..` segments. Providers must not re-normalise.
 * - Throw the typed errors from `@hudhod/core` — `fileNotFound`,
 *   `notADirectory`, and friends — so callers can branch on `error.code`.
 * - Do not create parent directories implicitly; {@link FileSystemService}
 *   handles that so the behaviour is identical across backends.
 * - `watch` is best-effort. A provider that cannot watch may return a no-op
 *   disposable, at the cost of stale UI when files change outside the app.
 */
export interface FileSystemProvider {
  /** Human-readable backend name, used in diagnostics. */
  readonly name: string;

  /**
   * Reads a file's raw bytes.
   * @throws `FileNotFound` when the path does not exist.
   * @throws `NotAFile` when the path is a directory.
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Writes a file's raw bytes, replacing any existing content.
   * @throws `FileNotFound` when the parent directory does not exist.
   */
  writeFile(path: string, data: Uint8Array): Promise<void>;

  /**
   * Creates a directory. Implementations may assume the parent exists.
   * @throws `FileExists` when a *file* already occupies the path.
   */
  createDirectory(path: string): Promise<void>;

  /**
   * Removes a file or directory.
   * @throws `FileNotFound` when the path does not exist.
   * @throws `DirectoryNotEmpty` when removing a non-empty directory without `recursive`.
   */
  delete(path: string, options: { recursive: boolean }): Promise<void>;

  /**
   * Moves an entry.
   * @throws `FileNotFound` when the source does not exist.
   * @throws `FileExists` when the destination exists and `overwrite` is false.
   */
  rename(from: string, to: string, options: { overwrite: boolean }): Promise<void>;

  /**
   * Reads metadata.
   * @throws `FileNotFound` when the path does not exist.
   */
  stat(path: string): Promise<ProviderStat>;

  /**
   * Lists a directory's immediate children, in any order.
   * @throws `FileNotFound` when the path does not exist.
   * @throws `NotADirectory` when the path is a file.
   */
  readDirectory(path: string): Promise<ProviderEntry[]>;

  /**
   * Observes changes beneath a path.
   *
   * Events may be delivered individually or in batches; debouncing is the
   * service's job. Returns a {@link Disposable} that stops the watch.
   */
  watch(
    path: string,
    options: ProviderWatchOptions,
    listener: (events: readonly FileChangeEvent[]) => void,
  ): Disposable;
}
