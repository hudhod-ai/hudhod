/**
 * The file system service.
 *
 * Sits above a {@link FileSystemProvider} and adds everything the provider
 * contract deliberately leaves out: path normalisation, text encoding, implicit
 * parent creation, recursive copy, exclusion filtering, and debounced change
 * batching.
 *
 * @packageDocumentation
 */

import type {
  DeleteOptions,
  DirectoryEntry,
  Disposable,
  Event,
  FileChangeEvent,
  FileStat,
  FileSystemApi,
  MoveOptions,
  WatchOptions,
  WriteFileOptions,
} from "@hudhod/sdk";

import { DisposableStore, toDisposable } from "../base/disposable";
import { fileExists, fileNotFound } from "../base/errors";
import { Emitter } from "../base/event";
import { createMatcher } from "../base/glob";
import { ROOT, dirname, joinPath, normalizePath } from "../base/paths";
import type { WorkspaceConfig } from "../workspace/config";
import { createWorkspaceConfig } from "../workspace/config";
import type { FileSystemProvider } from "./provider";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

/** How long to collect change events before delivering a batch. */
const CHANGE_DEBOUNCE_MS = 20;

/** Options for {@link FileSystemService}. */
export interface FileSystemServiceOptions {
  /** Workspace policy, chiefly the exclusion patterns. */
  readonly config?: WorkspaceConfig;
  /**
   * Milliseconds to coalesce change events over. Set to `0` to deliver
   * synchronously, which makes tests deterministic.
   * @defaultValue 20
   */
  readonly debounceMs?: number;
}

/**
 * Reads and writes workspace files.
 *
 * @example
 * ```ts
 * const fs = new FileSystemService(new InMemoryFileSystemProvider());
 * await fs.writeTextFile("/src/a.ts", "export const a = 1;");
 * await fs.readTextFile("/src/a.ts");
 * ```
 */
export class FileSystemService implements FileSystemApi, Disposable {
  readonly #provider: FileSystemProvider;
  readonly #config: WorkspaceConfig;
  readonly #debounceMs: number;
  readonly #store = new DisposableStore();
  readonly #changeEmitter = new Emitter<readonly FileChangeEvent[]>();
  readonly #isWatcherExcluded: (path: string) => boolean;
  readonly #isFileExcluded: (path: string) => boolean;

  #pending: FileChangeEvent[] = [];
  #flushHandle: ReturnType<typeof setTimeout> | undefined;
  #rootWatch: Disposable | undefined;

  constructor(
    provider: FileSystemProvider,
    options: FileSystemServiceOptions = {},
  ) {
    this.#provider = provider;
    this.#config = options.config ?? createWorkspaceConfig();
    this.#debounceMs = options.debounceMs ?? CHANGE_DEBOUNCE_MS;
    this.#isWatcherExcluded = createMatcher(this.#config.watcherExclude);
    this.#isFileExcluded = createMatcher(this.#config.filesExclude);
    this.#store.add(this.#changeEmitter);
  }

  /** The workspace policy in force. */
  get config(): WorkspaceConfig {
    return this.#config;
  }

  /**
   * Fires for every change in the workspace, after exclusion filtering and
   * debouncing.
   *
   * The underlying provider watch is established lazily on first subscription
   * and torn down when the last listener leaves, so an idle workspace does no
   * watching at all.
   */
  readonly onDidChangeFile: Event<readonly FileChangeEvent[]> = (listener) => {
    this.#ensureRootWatch();
    const subscription = this.#changeEmitter.event(listener);
    return toDisposable(() => {
      subscription.dispose();
      if (this.#changeEmitter.listenerCount === 0) {
        this.#rootWatch?.dispose();
        this.#rootWatch = undefined;
      }
    });
  };

  async readFile(path: string): Promise<Uint8Array> {
    return this.#provider.readFile(normalizePath(path));
  }

  async readTextFile(path: string): Promise<string> {
    return decoder.decode(await this.readFile(path));
  }

  async writeFile(
    path: string,
    data: Uint8Array,
    options: WriteFileOptions = {},
  ): Promise<void> {
    const target = normalizePath(path);
    const exists = await this.exists(target);

    if (exists && options.overwrite === false) throw fileExists(target);
    if (!exists && options.create === false) throw fileNotFound(target);

    if (options.createParents !== false) {
      await this.createDirectory(dirname(target));
    }
    await this.#provider.writeFile(target, data);
  }

  async writeTextFile(
    path: string,
    content: string,
    options: WriteFileOptions = {},
  ): Promise<void> {
    await this.writeFile(path, encoder.encode(content), options);
  }

  async createFile(
    path: string,
    options: WriteFileOptions = {},
  ): Promise<void> {
    // Creating implies the file should not already be there.
    await this.writeFile(path, new Uint8Array(0), {
      overwrite: false,
      ...options,
    });
  }

  /** Creates a directory and every missing ancestor. Succeeds if it exists. */
  async createDirectory(path: string): Promise<void> {
    const target = normalizePath(path);
    if (target === ROOT) return;

    const missing: string[] = [];
    for (let current = target; current !== ROOT; current = dirname(current)) {
      if (await this.exists(current)) break;
      missing.push(current);
    }

    for (let index = missing.length - 1; index >= 0; index -= 1) {
      const directory = missing[index];
      if (!directory) continue;
      await this.#provider.createDirectory(directory);
    }
  }

  async delete(path: string, options: DeleteOptions = {}): Promise<void> {
    await this.#provider.delete(normalizePath(path), {
      recursive: options.recursive ?? false,
    });
  }

  async rename(
    from: string,
    to: string,
    options: MoveOptions = {},
  ): Promise<void> {
    const target = normalizePath(to);
    await this.createDirectory(dirname(target));
    await this.#provider.rename(normalizePath(from), target, {
      overwrite: options.overwrite ?? false,
    });
  }

  async copy(
    from: string,
    to: string,
    options: MoveOptions = {},
  ): Promise<void> {
    const source = normalizePath(from);
    const target = normalizePath(to);
    const overwrite = options.overwrite ?? false;

    if (!overwrite && (await this.exists(target))) throw fileExists(target);

    const stat = await this.stat(source);
    if (stat.type !== "directory") {
      await this.writeFile(target, await this.#provider.readFile(source), {
        overwrite: true,
      });
      return;
    }

    await this.createDirectory(target);
    for (const entry of await this.#provider.readDirectory(source)) {
      await this.copy(
        joinPath(source, entry.name),
        joinPath(target, entry.name),
        options,
      );
    }
  }

  async stat(path: string): Promise<FileStat> {
    return this.#provider.stat(normalizePath(path));
  }

  async exists(path: string): Promise<boolean> {
    try {
      await this.#provider.stat(normalizePath(path));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Lists a directory, hiding entries matched by `filesExclude` and sorting
   * directories first, then by name.
   */
  async readDirectory(path: string): Promise<DirectoryEntry[]> {
    return this.listDirectory(path, { applyExcludes: true });
  }

  /**
   * Lists a directory, optionally without applying `filesExclude`.
   *
   * `filesExclude` is a presentation policy — it governs what the file tree
   * shows. Search has its own `searchExclude`, so it must be able to walk the
   * unfiltered listing; otherwise a caller could never search `node_modules`
   * even by explicitly clearing the search exclusions.
   */
  async listDirectory(
    path: string,
    options: { applyExcludes: boolean },
  ): Promise<DirectoryEntry[]> {
    const target = normalizePath(path);
    const entries = await this.#provider.readDirectory(target);

    const visible = entries
      .map((entry) => ({
        name: entry.name,
        path: joinPath(target, entry.name),
        type: entry.type,
      }))
      .filter(
        (entry) => !options.applyExcludes || !this.#isFileExcluded(entry.path),
      );
    return sortedBy(visible, compareEntries);
  }

  watch(
    path: string,
    listener: (events: readonly FileChangeEvent[]) => unknown,
    options: WatchOptions = {},
  ): Disposable {
    const target = normalizePath(path);
    const isExcluded = options.excludes
      ? createMatcher(options.excludes)
      : this.#isWatcherExcluded;

    return this.#provider.watch(
      target,
      { recursive: options.recursive ?? true },
      (events) => {
        const relevant = events.filter((event) => !isExcluded(event.path));
        if (relevant.length > 0) listener(relevant);
      },
    );
  }

  /** Stops watching and releases listeners. */
  dispose(): void {
    if (this.#flushHandle !== undefined) clearTimeout(this.#flushHandle);
    this.#rootWatch?.dispose();
    this.#rootWatch = undefined;
    this.#store.dispose();
  }

  /** Starts the workspace-wide watch, if it is not already running. */
  #ensureRootWatch(): void {
    if (this.#rootWatch) return;
    this.#rootWatch = this.#provider.watch(
      this.#config.rootPath,
      { recursive: true },
      (events) => this.#queue(events),
    );
  }

  /** Buffers events, filtering exclusions, and schedules a batched delivery. */
  #queue(events: readonly FileChangeEvent[]): void {
    const relevant = events.filter(
      (event) => !this.#isWatcherExcluded(event.path),
    );
    if (relevant.length === 0) return;

    this.#pending.push(...relevant);

    if (this.#debounceMs <= 0) {
      this.#flush();
      return;
    }
    if (this.#flushHandle !== undefined) return;
    this.#flushHandle = setTimeout(() => this.#flush(), this.#debounceMs);
  }

  /** Delivers the buffered batch, collapsing repeats of the same path. */
  #flush(): void {
    if (this.#flushHandle !== undefined) {
      clearTimeout(this.#flushHandle);
      this.#flushHandle = undefined;
    }
    if (this.#pending.length === 0) return;

    const batch = dedupeChanges(this.#pending);
    this.#pending = [];
    this.#changeEmitter.fire(batch);
  }
}

/** Directories first, then case-insensitive name order. */
function compareEntries(a: DirectoryEntry, b: DirectoryEntry): number {
  if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function sortedBy<T>(
  values: readonly T[],
  compare: (left: T, right: T) => number,
): T[] {
  const result: T[] = [];
  for (const value of values) {
    const index = result.findIndex(
      (candidate) => compare(value, candidate) < 0,
    );
    if (index === -1) result.push(value);
    else result.splice(index, 0, value);
  }
  return result;
}

/**
 * Collapses repeated events for one path, keeping the last.
 *
 * A create followed by a delete within the same tick means the file is gone;
 * reporting both would force every consumer to reason about ordering.
 */
function dedupeChanges(
  events: readonly FileChangeEvent[],
): readonly FileChangeEvent[] {
  const latest = new Map<string, FileChangeEvent>();
  for (const event of events) {
    latest.set(event.path, event);
  }
  return [...latest.values()];
}
