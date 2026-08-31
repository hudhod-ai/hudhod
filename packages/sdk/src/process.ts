/**
 * Process and task API types.
 *
 * ## A note on stdout vs stderr
 *
 * The underlying WebContainer runtime exposes a **single merged output stream**
 * per process — there is no way to separate stdout from stderr. Rather than
 * inventing an `stderr` field that would always be empty, {@link ExecResult}
 * exposes one honest `output` string.
 *
 * @packageDocumentation
 */

import type { Event } from "./lifecycle";

/** Options shared by {@link ProcessApi.spawn} and {@link ProcessApi.exec}. */
export interface SpawnOptions {
  /**
   * Working directory for the process.
   * @defaultValue The workspace root.
   */
  readonly cwd?: string;
  /** Extra environment variables, merged over the runtime defaults. */
  readonly env?: Readonly<Record<string, string>>;
  /**
   * Allocate a pseudo-terminal with these dimensions. Required for programs
   * that render interactive UI or colourised output.
   */
  readonly terminal?: { readonly cols: number; readonly rows: number };
}

/** Options for {@link ProcessApi.exec}. */
export interface ExecOptions extends SpawnOptions {
  /**
   * Kill the process after this many milliseconds. Pass `false` to wait
   * indefinitely — only do this for processes you are certain will terminate.
   * @defaultValue 60000
   */
  readonly timeout?: number | false;
  /**
   * Stop buffering after this many bytes of output and kill the process. Pass
   * `false` to buffer without limit.
   * @defaultValue 1048576 (1 MiB)
   */
  readonly maxOutputBytes?: number | false;
}

/** The outcome of a completed {@link ProcessApi.exec} call. */
export interface ExecResult {
  /** Exit code. `0` conventionally means success. */
  readonly exitCode: number;
  /** Merged stdout and stderr, decoded as UTF-8. */
  readonly output: string;
  /** Whether `output` was cut short by `maxOutputBytes`. */
  readonly truncated: boolean;
  /** Wall-clock duration in milliseconds. */
  readonly durationMs: number;
}

/** Lifecycle state of a tracked process. */
export type ProcessStatus = "running" | "exited" | "killed";

/** A structured-cloneable snapshot of a process, safe to send across a worker boundary. */
export interface ProcessInfo {
  /** Host-assigned identifier, unique for the session. */
  readonly id: string;
  /** The executable that was spawned. */
  readonly command: string;
  /** Arguments passed to the executable. */
  readonly args: readonly string[];
  /** Start time in milliseconds since the Unix epoch. */
  readonly startedAt: number;
  /** Current lifecycle state. */
  readonly status: ProcessStatus;
  /** Exit code, present once the process has finished. */
  readonly exitCode?: number;
}

/**
 * A live handle to a running process.
 *
 * Unlike {@link ProcessInfo} this holds streams, so it cannot cross a worker
 * boundary and is only available to same-context callers.
 */
export interface ProcessHandle extends ProcessInfo {
  /** Merged stdout and stderr, as a stream of decoded text chunks. */
  readonly output: ReadableStream<string>;
  /** Standard input. Only writable when the process was spawned with a terminal. */
  readonly input: WritableStream<string>;
  /** Resolves with the exit code when the process finishes. */
  readonly exit: Promise<number>;
  /** Terminates the process. Safe to call after it has already exited. */
  kill(): void;
  /** Resizes the pseudo-terminal. No-op when the process has no terminal. */
  resize(dimensions: { cols: number; rows: number }): void;
}

/**
 * Spawn and manage processes inside the workspace container.
 *
 * @example Running a one-shot command
 * ```ts
 * const { exitCode, output } = await hudhod.process.exec("node", ["-v"]);
 * ```
 *
 * @example Streaming a long-running process
 * ```ts
 * const proc = await hudhod.process.spawn("npm", ["run", "build"]);
 * await proc.output.pipeTo(new WritableStream({ write: (c) => console.log(c) }));
 * ```
 */
export interface ProcessApi {
  /**
   * Starts a process and returns immediately with a live handle.
   * The caller owns the handle and is responsible for killing it.
   */
  spawn(command: string, args?: readonly string[], options?: SpawnOptions): Promise<ProcessHandle>;

  /**
   * Runs a command to completion and buffers its output.
   *
   * Guarded by a timeout and an output cap so a runaway command cannot hang
   * the browser tab. Both guards are overridable, including disabling them.
   *
   * @throws A `ProcessTimeout` error when `timeout` elapses. The error carries
   * the partial output collected so far.
   * @throws An `OutputLimitExceeded` error when `maxOutputBytes` is exceeded.
   */
  exec(command: string, args?: readonly string[], options?: ExecOptions): Promise<ExecResult>;

  /** Lists every process the host is currently tracking. */
  list(): Promise<ProcessInfo[]>;

  /** Kills a process by its {@link ProcessInfo.id}. Resolves `false` if unknown. */
  kill(id: string): Promise<boolean>;

  /** Fires whenever a process starts. */
  readonly onDidStartProcess: Event<ProcessInfo>;

  /** Fires whenever a process exits, for any reason. */
  readonly onDidExitProcess: Event<ProcessInfo>;
}
