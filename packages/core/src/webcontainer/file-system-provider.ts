/**
 * The WebContainer-backed {@link FileSystemProvider}.
 *
 * Browser only. Imported from `@hudhod/core/webcontainer` so that the main
 * entry point stays loadable in Node.
 *
 * @packageDocumentation
 */

import type { WebContainer } from "@webcontainer/api";

import type { Disposable, FileChangeEvent, FileType } from "@hudhod/sdk";

import { toDisposable } from "../base/disposable";
import { directoryNotEmpty, fileExists, fileNotFound, notADirectory } from "../base/errors";
import { ROOT, basename, dirname, joinPath } from "../base/paths";
import type {
  FileSystemProvider,
  ProviderEntry,
  ProviderStat,
  ProviderWatchOptions,
} from "../fs/provider";

/**
 * Adapts WebContainer's file system to the provider contract.
 *
 * ## Known limitations
 *
 * WebContainer exposes no `stat` call, so {@link stat} is emulated by listing
 * the parent directory. Two consequences follow, and both are deliberate:
 *
 * - `mtime` is always `0`. No modification time is available, and inventing one
 *   from `Date.now()` would be worse than reporting an obvious sentinel.
 * - `size` requires reading the file. {@link FileSystemService} calls `stat`
 *   mainly through `exists()`, which discards the size, so this is acceptable —
 *   but avoid calling `stat` in a hot loop.
 */
export class WebContainerFileSystemProvider implements FileSystemProvider {
  readonly name = "webcontainer";

  readonly #container: WebContainer;

  constructor(container: WebContainer) {
    this.#container = container;
  }

  async readFile(path: string): Promise<Uint8Array> {
    try {
      return await this.#container.fs.readFile(path);
    } catch (error) {
      throw translate(error, path);
    }
  }

  async writeFile(path: string, data: Uint8Array): Promise<void> {
    try {
      await this.#container.fs.writeFile(path, data);
    } catch (error) {
      throw translate(error, path);
    }
  }

  async createDirectory(path: string): Promise<void> {
    try {
      await this.#container.fs.mkdir(path, { recursive: true });
    } catch (error) {
      // mkdir is idempotent for directories; only a file in the way is fatal.
      if (isErrno(error, "EEXIST")) {
        if ((await this.stat(path)).type === "directory") return;
        throw fileExists(path);
      }
      throw translate(error, path);
    }
  }

  async delete(path: string, options: { recursive: boolean }): Promise<void> {
    try {
      await this.#container.fs.rm(path, { recursive: options.recursive });
    } catch (error) {
      if (isErrno(error, "ENOTEMPTY")) throw directoryNotEmpty(path);
      throw translate(error, path);
    }
  }

  async rename(from: string, to: string, options: { overwrite: boolean }): Promise<void> {
    if (!options.overwrite && (await this.#exists(to))) throw fileExists(to);
    try {
      await this.#container.fs.rename(from, to);
    } catch (error) {
      throw translate(error, from);
    }
  }

  async stat(path: string): Promise<ProviderStat> {
    if (path === ROOT) return { type: "directory", size: 0, mtime: 0 };

    const name = basename(path);
    let entries: Awaited<ReturnType<typeof this.readDirectory>>;
    try {
      entries = await this.readDirectory(dirname(path));
    } catch {
      throw fileNotFound(path);
    }

    const entry = entries.find((candidate) => candidate.name === name);
    if (!entry) throw fileNotFound(path);
    if (entry.type === "directory") {
      return { type: "directory", size: 0, mtime: 0 };
    }

    const data = await this.readFile(path);
    return { type: "file", size: data.byteLength, mtime: 0 };
  }

  async readDirectory(path: string): Promise<ProviderEntry[]> {
    let entries;
    try {
      entries = await this.#container.fs.readdir(path, {
        withFileTypes: true,
      });
    } catch (error) {
      if (isErrno(error, "ENOTDIR")) throw notADirectory(path);
      throw translate(error, path);
    }

    return entries.map((entry) => ({
      name: entry.name,
      type: (entry.isDirectory() ? "directory" : "file") satisfies FileType,
    }));
  }

  /**
   * Watches a subtree.
   *
   * WebContainer reports a `rename` event for both creation and deletion, so
   * each one is resolved by probing for the path afterwards. The probe is why
   * the listener is async and why events arrive slightly after the change.
   */
  watch(
    path: string,
    options: ProviderWatchOptions,
    listener: (events: readonly FileChangeEvent[]) => void,
  ): Disposable {
    const watcher = this.#container.fs.watch(
      path,
      { recursive: options.recursive },
      (event, filename) => {
        if (typeof filename !== "string") return;
        const changed = joinPath(path, filename);

        if (event === "change") {
          listener([{ type: "changed", path: changed }]);
          return;
        }

        void this.#exists(changed).then((exists) => {
          listener([{ type: exists ? "created" : "deleted", path: changed }]);
        });
      },
    );

    return toDisposable(() => watcher.close());
  }

  /** Existence probe that never throws. */
  async #exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

/** Whether an unknown thrown value is a Node-style error with `code`. */
function isErrno(error: unknown, code: string): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === code;
}

/** Converts a WebContainer/Node error into a typed hudhod error. */
function translate(error: unknown, path: string): unknown {
  if (isErrno(error, "ENOENT")) return fileNotFound(path);
  if (isErrno(error, "ENOTDIR")) return notADirectory(path);
  if (isErrno(error, "EEXIST")) return fileExists(path);
  if (isErrno(error, "ENOTEMPTY")) return directoryNotEmpty(path);
  return error;
}
