/**
 * The process service.
 *
 * Tracks every running process and enforces the guards that keep a runaway
 * command from hanging the browser tab.
 *
 * @packageDocumentation
 */

import type {
  Event,
  ExecOptions,
  ExecResult,
  ProcessApi,
  ProcessHandle,
  ProcessInfo,
  ProcessStatus,
  SpawnOptions,
} from "@hudhod/sdk";

import { DisposableStore } from "../base/disposable";
import { createError } from "../base/errors";
import { Emitter } from "../base/event";
import type { ProcessSpawner, SpawnedProcess } from "./spawner";

/** Default wall-clock limit for {@link ProcessService.exec}. */
export const DEFAULT_EXEC_TIMEOUT_MS = 60_000;

/** Default output cap for {@link ProcessService.exec}, in bytes. */
export const DEFAULT_MAX_OUTPUT_BYTES = 1024 * 1024;

/** Mutable bookkeeping for one tracked process. */
interface Tracked {
  info: {
    id: string;
    command: string;
    args: readonly string[];
    startedAt: number;
    status: ProcessStatus;
    exitCode?: number;
  };
  process: SpawnedProcess;
}

/** Options for {@link ProcessService}. */
export interface ProcessServiceOptions {
  /**
   * Clock used for `startedAt` and duration measurement.
   * @defaultValue `Date.now`
   */
  readonly now?: () => number;
}

/**
 * Spawns and supervises processes.
 *
 * @example
 * ```ts
 * const processes = new ProcessService(spawner);
 * const { exitCode, output } = await processes.exec("node", ["-v"]);
 * ```
 */
export class ProcessService implements ProcessApi {
  readonly #spawner: ProcessSpawner;
  readonly #now: () => number;
  readonly #tracked = new Map<string, Tracked>();
  readonly #store = new DisposableStore();
  readonly #startEmitter = new Emitter<ProcessInfo>();
  readonly #exitEmitter = new Emitter<ProcessInfo>();

  #nextId = 1;

  constructor(spawner: ProcessSpawner, options: ProcessServiceOptions = {}) {
    this.#spawner = spawner;
    this.#now = options.now ?? Date.now;
    this.#store.add(this.#startEmitter);
    this.#store.add(this.#exitEmitter);
  }

  /** Fires whenever a process starts. */
  readonly onDidStartProcess: Event<ProcessInfo> = (listener) => this.#startEmitter.event(listener);

  /** Fires whenever a process exits, for any reason. */
  readonly onDidExitProcess: Event<ProcessInfo> = (listener) => this.#exitEmitter.event(listener);

  async spawn(
    command: string,
    args: readonly string[] = [],
    options: SpawnOptions = {},
  ): Promise<ProcessHandle> {
    const process = await this.#spawner.spawn(command, args, options);
    const id = `p${this.#nextId++}`;

    const tracked: Tracked = {
      info: {
        id,
        command,
        args: [...args],
        startedAt: this.#now(),
        status: "running",
      },
      process,
    };
    this.#tracked.set(id, tracked);
    this.#startEmitter.fire({ ...tracked.info });

    // Settle bookkeeping exactly once, however the process ends.
    void process.exit.then(
      (exitCode) => this.#settle(id, exitCode),
      () => this.#settle(id, -1),
    );

    return this.#toHandle(tracked);
  }

  async exec(
    command: string,
    args: readonly string[] = [],
    options: ExecOptions = {},
  ): Promise<ExecResult> {
    const timeout = options.timeout ?? DEFAULT_EXEC_TIMEOUT_MS;
    const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_MAX_OUTPUT_BYTES;
    const startedAt = this.#now();

    const handle = await this.spawn(command, args, options);

    let output = "";
    let bytes = 0;
    let truncated = false;
    const encoder = new TextEncoder();

    let timedOut = false;
    const timer =
      timeout === false
        ? undefined
        : setTimeout(() => {
            timedOut = true;
            handle.kill();
          }, timeout);

    try {
      const reader = handle.output.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          if (value === undefined) continue;

          output += value;
          if (maxOutputBytes !== false) {
            bytes += encoder.encode(value).length;
            if (bytes > maxOutputBytes) {
              truncated = true;
              handle.kill();
              break;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }

      const exitCode = await handle.exit;

      if (timedOut) {
        throw createError(
          "ProcessTimeout",
          `Command "${describe(command, args)}" exceeded its ${String(timeout)}ms timeout and was killed`,
          { partialOutput: output },
        );
      }
      if (truncated) {
        throw createError(
          "OutputLimitExceeded",
          `Command "${describe(command, args)}" exceeded its ${String(maxOutputBytes)}-byte output limit and was killed`,
          { partialOutput: output },
        );
      }

      return {
        exitCode,
        output,
        truncated: false,
        durationMs: this.#now() - startedAt,
      };
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  async list(): Promise<ProcessInfo[]> {
    return [...this.#tracked.values()].map((tracked) => ({ ...tracked.info }));
  }

  async kill(id: string): Promise<boolean> {
    const tracked = this.#tracked.get(id);
    if (!tracked || tracked.info.status !== "running") return false;
    tracked.info.status = "killed";
    tracked.process.kill();
    return true;
  }

  /** Kills every running process and releases listeners. */
  dispose(): void {
    for (const tracked of this.#tracked.values()) {
      if (tracked.info.status === "running") tracked.process.kill();
    }
    this.#tracked.clear();
    this.#store.dispose();
  }

  /** Records the exit and notifies listeners, at most once per process. */
  #settle(id: string, exitCode: number): void {
    const tracked = this.#tracked.get(id);
    if (!tracked || tracked.info.status !== "running") {
      // Already settled — a kill beat the exit promise to it.
      if (tracked && tracked.info.exitCode === undefined) {
        tracked.info.exitCode = exitCode;
        this.#exitEmitter.fire({ ...tracked.info });
      }
      return;
    }
    tracked.info.status = "exited";
    tracked.info.exitCode = exitCode;
    this.#exitEmitter.fire({ ...tracked.info });
  }

  /** Projects internal bookkeeping into the public handle shape. */
  #toHandle(tracked: Tracked): ProcessHandle {
    const service = this;
    return {
      get id() {
        return tracked.info.id;
      },
      get command() {
        return tracked.info.command;
      },
      get args() {
        return tracked.info.args;
      },
      get startedAt() {
        return tracked.info.startedAt;
      },
      get status() {
        return tracked.info.status;
      },
      get exitCode() {
        return tracked.info.exitCode;
      },
      output: tracked.process.output,
      input: tracked.process.input,
      exit: tracked.process.exit,
      kill() {
        void service.kill(tracked.info.id);
      },
      resize(dimensions) {
        tracked.process.resize(dimensions);
      },
    };
  }
}

/** Renders a command and its arguments for error messages. */
function describe(command: string, args: readonly string[]): string {
  return [command, ...args].join(" ");
}
