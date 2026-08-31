/**
 * File system API types.
 *
 * All paths are absolute, POSIX-style, and rooted at the workspace root (`/`).
 * Relative paths are rejected rather than silently resolved, so that behaviour
 * never depends on ambient state.
 *
 * @packageDocumentation
 */

import type { Disposable, Event } from "./lifecycle";

/** The kind of entry a path points at. */
export type FileType = "file" | "directory" | "symlink";

/** Metadata describing a single file system entry. */
export interface FileStat {
  /** Whether the entry is a file, directory, or symlink. */
  readonly type: FileType;
  /** Size in bytes. Always `0` for directories. */
  readonly size: number;
  /** Last-modified time, in milliseconds since the Unix epoch. */
  readonly mtime: number;
}

/** A single child returned by {@link FileSystemApi.readDirectory}. */
export interface DirectoryEntry {
  /** Entry name, without any leading directory component. */
  readonly name: string;
  /** Absolute path to the entry. */
  readonly path: string;
  /** Whether the entry is a file, directory, or symlink. */
  readonly type: FileType;
}

/** How a watched path changed. */
export type FileChangeType = "created" | "changed" | "deleted";

/** A single file system change notification. */
export interface FileChangeEvent {
  /** What happened to the path. */
  readonly type: FileChangeType;
  /** Absolute path that changed. */
  readonly path: string;
}

/** Options for {@link FileSystemApi.writeFile} and {@link FileSystemApi.writeTextFile}. */
export interface WriteFileOptions {
  /**
   * Create the file when it does not exist.
   * @defaultValue true
   */
  readonly create?: boolean;
  /**
   * Overwrite the file when it already exists. When `false` and the file
   * exists, a `FileExists` error is thrown.
   * @defaultValue true
   */
  readonly overwrite?: boolean;
  /**
   * Create missing parent directories.
   * @defaultValue true
   */
  readonly createParents?: boolean;
}

/** Options for {@link FileSystemApi.delete}. */
export interface DeleteOptions {
  /**
   * Recursively delete directory contents. Deleting a non-empty directory
   * without this flag throws.
   * @defaultValue false
   */
  readonly recursive?: boolean;
}

/** Options for {@link FileSystemApi.rename} and {@link FileSystemApi.copy}. */
export interface MoveOptions {
  /**
   * Replace the destination when it already exists.
   * @defaultValue false
   */
  readonly overwrite?: boolean;
}

/** Options for {@link FileSystemApi.watch}. */
export interface WatchOptions {
  /**
   * Watch nested directories as well.
   * @defaultValue true
   */
  readonly recursive?: boolean;
  /**
   * Glob patterns to ignore. Defaults to the workspace `files.watcherExclude`
   * setting (`node_modules`, `.git`, `dist`, …).
   */
  readonly excludes?: readonly string[];
}

/**
 * Read and write the workspace file system.
 *
 * Every method is asynchronous and accepts/returns only structured-cloneable
 * values, so the whole namespace remains usable across a worker boundary.
 *
 * @example
 * ```ts
 * await hudhod.fs.writeTextFile("/src/greet.ts", "export const hi = () => 'hi';");
 * const source = await hudhod.fs.readTextFile("/src/greet.ts");
 * ```
 */
export interface FileSystemApi {
  /**
   * Reads a file as raw bytes.
   * @throws A `FileNotFound` error when `path` does not exist.
   * @throws A `NotAFile` error when `path` is a directory.
   */
  readFile(path: string): Promise<Uint8Array>;

  /**
   * Reads a file and decodes it as UTF-8 text.
   * @throws A `FileNotFound` error when `path` does not exist.
   */
  readTextFile(path: string): Promise<string>;

  /** Writes raw bytes, creating parent directories by default. */
  writeFile(path: string, data: Uint8Array, options?: WriteFileOptions): Promise<void>;

  /** Writes UTF-8 text, creating parent directories by default. */
  writeTextFile(path: string, content: string, options?: WriteFileOptions): Promise<void>;

  /**
   * Creates an empty file.
   * @throws A `FileExists` error when the file exists and `overwrite` is not set.
   */
  createFile(path: string, options?: WriteFileOptions): Promise<void>;

  /** Creates a directory, including any missing parents. Succeeds if it already exists. */
  createDirectory(path: string): Promise<void>;

  /**
   * Deletes a file or directory.
   * @throws A `FileNotFound` error when `path` does not exist.
   */
  delete(path: string, options?: DeleteOptions): Promise<void>;

  /** Moves or renames an entry. */
  rename(from: string, to: string, options?: MoveOptions): Promise<void>;

  /** Copies a file or directory tree. */
  copy(from: string, to: string, options?: MoveOptions): Promise<void>;

  /**
   * Retrieves metadata for a path.
   * @throws A `FileNotFound` error when `path` does not exist.
   */
  stat(path: string): Promise<FileStat>;

  /** Resolves to `true` when the path exists. Never throws for missing paths. */
  exists(path: string): Promise<boolean>;

  /** Lists the immediate children of a directory, sorted directories-first then by name. */
  readDirectory(path: string): Promise<DirectoryEntry[]>;

  /**
   * Watches a path for changes.
   *
   * Events are debounced and delivered in batches, so a single listener call
   * may describe several changes at once.
   *
   * @returns A {@link Disposable} that stops the watch.
   */
  watch(
    path: string,
    listener: (events: readonly FileChangeEvent[]) => unknown,
    options?: WatchOptions,
  ): Disposable;

  /** Fires for every change anywhere in the workspace, after exclusion filtering. */
  readonly onDidChangeFile: Event<readonly FileChangeEvent[]>;
}
