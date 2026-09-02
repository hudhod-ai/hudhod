import {
  directoryNotEmpty,
  fileExists,
  fileNotFound,
  notADirectory,
  ROOT,
  basename,
  dirname,
  joinPath,
  toDisposable,
} from "@hudhod/core";
import type { Disposable, FileChangeEvent, FileType } from "@hudhod/sdk";
import type { WebContainer } from "@webcontainer/api";
import type {
  FileSystemProvider,
  ProcessSpawner,
  ProviderEntry,
  ProviderStat,
  ProviderWatchOptions,
  SpawnedProcess,
  SpawnerOptions,
} from "@hudhod/core";

/** Adapts WebContainer's filesystem to Hudhod's provider contract. */
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

  async rename(
    from: string,
    to: string,
    options: { overwrite: boolean },
  ): Promise<void> {
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
    let entries: ProviderEntry[];
    try {
      entries = await this.readDirectory(dirname(path));
    } catch {
      throw fileNotFound(path);
    }
    const entry = entries.find((candidate) => candidate.name === name);
    if (!entry) throw fileNotFound(path);
    if (entry.type === "directory")
      return { type: "directory", size: 0, mtime: 0 };
    const data = await this.readFile(path);
    return { type: "file", size: data.byteLength, mtime: 0 };
  }

  async readDirectory(path: string): Promise<ProviderEntry[]> {
    try {
      const entries = await this.#container.fs.readdir(path, {
        withFileTypes: true,
      });
      return entries.map((entry) => ({
        name: entry.name,
        type: (entry.isDirectory() ? "directory" : "file") satisfies FileType,
      }));
    } catch (error) {
      if (isErrno(error, "ENOTDIR")) throw notADirectory(path);
      throw translate(error, path);
    }
  }

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
        void this.#exists(changed).then((exists) =>
          listener([{ type: exists ? "created" : "deleted", path: changed }]),
        );
      },
    );
    return toDisposable(() => watcher.close());
  }

  async #exists(path: string): Promise<boolean> {
    try {
      await this.stat(path);
      return true;
    } catch {
      return false;
    }
  }
}

/** Adapts WebContainer process spawning to Hudhod's process contract. */
export class WebContainerProcessSpawner implements ProcessSpawner {
  readonly name = "webcontainer";
  readonly #container: WebContainer;

  constructor(container: WebContainer) {
    this.#container = container;
  }

  async spawn(
    command: string,
    args: readonly string[],
    options: SpawnerOptions,
  ): Promise<SpawnedProcess> {
    const process = await this.#container.spawn(command, [...args], {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: { ...options.env } } : {}),
      ...(options.terminal ? { terminal: { ...options.terminal } } : {}),
    });
    let killed = false;
    return {
      output: process.output,
      input: process.input,
      exit: process.exit,
      kill() {
        if (killed) return;
        killed = true;
        process.kill();
      },
      resize(dimensions) {
        if (options.terminal) process.resize(dimensions);
      },
    };
  }
}

/** Creates the standard filesystem and process adapters for a WebContainer instance. */
export function createWebContainerServices(container: WebContainer): {
  fileSystemProvider: FileSystemProvider;
  processSpawner: ProcessSpawner;
} {
  return {
    fileSystemProvider: new WebContainerFileSystemProvider(container),
    processSpawner: new WebContainerProcessSpawner(container),
  };
}

function isErrno(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: unknown }).code === code
  );
}

function translate(error: unknown, path: string): unknown {
  if (isErrno(error, "ENOENT")) return fileNotFound(path);
  if (isErrno(error, "ENOTDIR")) return notADirectory(path);
  if (isErrno(error, "EEXIST")) return fileExists(path);
  if (isErrno(error, "ENOTEMPTY")) return directoryNotEmpty(path);
  return error;
}
