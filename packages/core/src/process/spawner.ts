/**
 * The process spawning abstraction.
 *
 * Mirrors the {@link FileSystemProvider} pattern: services depend on this
 * interface rather than on WebContainer directly, so process semantics —
 * timeouts, output caps, lifecycle tracking — can be tested in Node against a
 * fake.
 *
 * @packageDocumentation
 */

/** A process that has been started by a {@link ProcessSpawner}. */
export interface SpawnedProcess {
  /** Merged stdout and stderr, as decoded text chunks. */
  readonly output: ReadableStream<string>;
  /** Standard input. */
  readonly input: WritableStream<string>;
  /** Resolves with the exit code when the process finishes. */
  readonly exit: Promise<number>;
  /** Terminates the process. Must be safe to call after exit. */
  kill(): void;
  /** Resizes the pseudo-terminal, if the process has one. */
  resize(dimensions: { cols: number; rows: number }): void;
}

/** Options passed through to the backend. */
export interface SpawnerOptions {
  /** Working directory. */
  readonly cwd?: string;
  /** Environment variables to merge over the backend defaults. */
  readonly env?: Readonly<Record<string, string>>;
  /** Pseudo-terminal dimensions, when one is required. */
  readonly terminal?: { readonly cols: number; readonly rows: number };
}

/**
 * Starts processes.
 *
 * ## Implementer contract
 *
 * - `output` must close when the process exits, otherwise readers hang.
 * - `exit` must resolve exactly once, including when the process is killed.
 * - `kill()` must be idempotent.
 */
export interface ProcessSpawner {
  /** Human-readable backend name, used in diagnostics. */
  readonly name: string;

  /** Starts a process. */
  spawn(command: string, args: readonly string[], options: SpawnerOptions): Promise<SpawnedProcess>;
}
