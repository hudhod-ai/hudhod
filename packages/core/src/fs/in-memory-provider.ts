/**
 * An in-memory {@link FileSystemProvider}.
 *
 * This is the reference implementation of the provider contract. It is the
 * backend used by the test suite, so every service can be verified in Node with
 * no browser, no WebContainer, and no temporary directories on disk.
 *
 * @packageDocumentation
 */

import type { Disposable, FileChangeEvent, FileType } from "@hudhod/sdk";

import { toDisposable } from "../base/disposable";
import {
  directoryNotEmpty,
  fileExists,
  fileNotFound,
  notADirectory,
  notAFile,
} from "../base/errors";
import { ROOT, basename, dirname, isSubPath } from "../base/paths";
import type {
  FileSystemProvider,
  ProviderEntry,
  ProviderStat,
  ProviderWatchOptions,
} from "./provider";

/** A single node in the in-memory tree. */
interface Node {
  type: FileType;
  /** File contents. Always empty for directories. */
  data: Uint8Array;
  mtime: number;
}

interface Watcher {
  path: string;
  recursive: boolean;
  listener: (events: readonly FileChangeEvent[]) => void;
}

/** Options for {@link InMemoryFileSystemProvider}. */
export interface InMemoryFileSystemProviderOptions {
  /**
   * Clock used for `mtime` values. Inject a fake to make timestamps
   * deterministic in tests.
   * @defaultValue `Date.now`
   */
  readonly now?: () => number;
}

/**
 * A complete file system held in a `Map`.
 *
 * @example
 * ```ts
 * const provider = new InMemoryFileSystemProvider();
 * await provider.createDirectory("/src");
 * await provider.writeFile("/src/a.ts", new TextEncoder().encode("export {};"));
 * ```
 */
export class InMemoryFileSystemProvider implements FileSystemProvider {
  readonly name = "in-memory";

  readonly #nodes = new Map<string, Node>();
  readonly #watchers = new Set<Watcher>();
  readonly #now: () => number;

  constructor(options: InMemoryFileSystemProviderOptions = {}) {
    this.#now = options.now ?? Date.now;
    this.#nodes.set(ROOT, {
      type: "directory",
      data: new Uint8Array(0),
      mtime: this.#now(),
    });
  }

  /**
   * Seeds the provider from a plain object, for concise test fixtures.
   *
   * Parent directories are created automatically.
   *
   * @example
   * ```ts
   * const provider = InMemoryFileSystemProvider.from({
   *   "/package.json": "{}",
   *   "/src/index.ts": "export const a = 1;",
   * });
   * ```
   */
  static from(
    files: Readonly<Record<string, string>>,
    options: InMemoryFileSystemProviderOptions = {},
  ): InMemoryFileSystemProvider {
    const provider = new InMemoryFileSystemProvider(options);
    const encoder = new TextEncoder();
    for (const [path, contents] of Object.entries(files)) {
      provider.#ensureParents(path);
      provider.#nodes.set(path, {
        type: "file",
        data: encoder.encode(contents),
        mtime: provider.#now(),
      });
    }
    return provider;
  }

  /** Every path currently stored, sorted. Intended for test assertions. */
  snapshot(): string[] {
    return [...this.#nodes.keys()].sort();
  }

  async readFile(path: string): Promise<Uint8Array> {
    const node = this.#nodes.get(path);
    if (!node) throw fileNotFound(path);
    if (node.type === "directory") throw notAFile(path);
    return node.data.slice();
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    const existing = this.#nodes.get(path);
    if (existing?.type === "directory") throw notAFile(path);

    const parent = dirname(path);
    const parentNode = this.#nodes.get(parent);
    if (!parentNode) throw fileNotFound(parent);
    if (parentNode.type !== "directory") throw notADirectory(parent);

    this.#nodes.set(path, {
      type: "file",
      data: data.slice(),
      mtime: this.#now(),
    });
    this.#emit([{ type: existing ? "changed" : "created", path }]);
  }

  async createDirectory(path: string): Promise<void> {
    const existing = this.#nodes.get(path);
    if (existing) {
      if (existing.type === "directory") return;
      throw fileExists(path);
    }

    const parent = dirname(path);
    const parentNode = this.#nodes.get(parent);
    if (!parentNode) throw fileNotFound(parent);
    if (parentNode.type !== "directory") throw notADirectory(parent);

    this.#nodes.set(path, {
      type: "directory",
      data: new Uint8Array(0),
      mtime: this.#now(),
    });
    this.#emit([{ type: "created", path }]);
  }

  async delete(path: string, options: { recursive: boolean }): Promise<void> {
    const node = this.#nodes.get(path);
    if (!node) throw fileNotFound(path);

    if (node.type === "directory") {
      const descendants = this.#descendantsOf(path);
      if (descendants.length > 0 && !options.recursive) {
        throw directoryNotEmpty(path);
      }
      const removed: FileChangeEvent[] = [];
      for (const descendant of descendants) {
        this.#nodes.delete(descendant);
        removed.push({ type: "deleted", path: descendant });
      }
      this.#nodes.delete(path);
      removed.push({ type: "deleted", path });
      this.#emit(removed);
      return;
    }

    this.#nodes.delete(path);
    this.#emit([{ type: "deleted", path }]);
  }

  async rename(from: string, to: string, options: { overwrite: boolean }): Promise<void> {
    const node = this.#nodes.get(from);
    if (!node) throw fileNotFound(from);

    const destination = this.#nodes.get(to);
    if (destination && !options.overwrite) throw fileExists(to);

    const parent = dirname(to);
    const parentNode = this.#nodes.get(parent);
    if (!parentNode) throw fileNotFound(parent);
    if (parentNode.type !== "directory") throw notADirectory(parent);

    const events: FileChangeEvent[] = [];
    if (destination) {
      for (const descendant of this.#descendantsOf(to)) {
        this.#nodes.delete(descendant);
        events.push({ type: "deleted", path: descendant });
      }
    }

    // Move the node itself, then re-key every descendant beneath it.
    const moves: Array<[string, string]> = [[from, to]];
    for (const descendant of this.#descendantsOf(from)) {
      moves.push([descendant, to + descendant.slice(from.length)]);
    }
    for (const [source, target] of moves) {
      const moved = this.#nodes.get(source);
      if (!moved) continue;
      this.#nodes.delete(source);
      this.#nodes.set(target, { ...moved, mtime: this.#now() });
      events.push({ type: "deleted", path: source });
      events.push({ type: "created", path: target });
    }

    this.#emit(events);
  }

  async stat(path: string): Promise<ProviderStat> {
    const node = this.#nodes.get(path);
    if (!node) throw fileNotFound(path);
    return {
      type: node.type,
      size: node.type === "directory" ? 0 : node.data.byteLength,
      mtime: node.mtime,
    };
  }

  async readDirectory(path: string): Promise<ProviderEntry[]> {
    const node = this.#nodes.get(path);
    if (!node) throw fileNotFound(path);
    if (node.type !== "directory") throw notADirectory(path);

    const prefix = path === ROOT ? ROOT : `${path}/`;
    const entries: ProviderEntry[] = [];
    for (const [candidate, child] of this.#nodes) {
      if (candidate === path) continue;
      if (!candidate.startsWith(prefix)) continue;
      // Immediate children only.
      if (candidate.slice(prefix.length).includes("/")) continue;
      entries.push({ name: basename(candidate), type: child.type });
    }
    return entries;
  }

  watch(
    path: string,
    options: ProviderWatchOptions,
    listener: (events: readonly FileChangeEvent[]) => void,
  ): Disposable {
    const watcher: Watcher = {
      path,
      recursive: options.recursive,
      listener,
    };
    this.#watchers.add(watcher);
    return toDisposable(() => {
      this.#watchers.delete(watcher);
    });
  }

  /** Creates any missing ancestor directories of `path`. */
  #ensureParents(path: string): void {
    const parent = dirname(path);
    if (parent === ROOT || this.#nodes.has(parent)) return;
    this.#ensureParents(parent);
    this.#nodes.set(parent, {
      type: "directory",
      data: new Uint8Array(0),
      mtime: this.#now(),
    });
  }

  /** Every path strictly beneath `path`, deepest first so deletion is safe. */
  #descendantsOf(path: string): string[] {
    const prefix = path === ROOT ? ROOT : `${path}/`;
    return [...this.#nodes.keys()]
      .filter((candidate) => candidate !== path && candidate.startsWith(prefix))
      .sort((a, b) => b.length - a.length);
  }

  /** Delivers events to watchers whose scope covers them. */
  #emit(events: readonly FileChangeEvent[]): void {
    if (events.length === 0) return;
    for (const watcher of this.#watchers) {
      const relevant = events.filter((event) =>
        watcher.recursive
          ? isSubPath(watcher.path, event.path)
          : dirname(event.path) === watcher.path,
      );
      if (relevant.length > 0) watcher.listener(relevant);
    }
  }
}
