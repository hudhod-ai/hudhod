/**
 * Core lifecycle primitives shared by every hudhod API namespace.
 *
 * These are declared as *contracts* only — the runtime implementations live in
 * `@hudhod/core`. Keeping them here means extension authors never need to depend
 * on the host runtime just to type a subscription.
 *
 * @packageDocumentation
 */

/**
 * A resource that must be released when it is no longer needed.
 *
 * Every subscription and registration in the hudhod API returns a `Disposable`.
 * Push them onto {@link ExtensionContext.subscriptions} and the host will clean
 * them up automatically when your extension is deactivated.
 *
 * @example
 * ```ts
 * const sub = hudhod.fs.watch("/src", () => console.log("changed"));
 * context.subscriptions.push(sub);
 * ```
 */
export interface Disposable {
  /** Releases the underlying resource. Calling this more than once is a no-op. */
  dispose(): void;
}

/**
 * A function that registers a listener and returns a {@link Disposable} to
 * unregister it.
 *
 * @typeParam T - The payload delivered to listeners.
 *
 * @example
 * ```ts
 * const sub = hudhod.process.onDidExitProcess((info) => {
 *   console.log(`${info.command} exited with ${info.exitCode}`);
 * });
 * ```
 */
export type Event<T> = (listener: (event: T) => unknown) => Disposable;

/**
 * Signals that a long-running operation should be abandoned.
 *
 * Search and other potentially expensive operations accept one so callers can
 * bail out early.
 */
export interface CancellationToken {
  /** Whether cancellation has already been requested. */
  readonly isCancellationRequested: boolean;
  /** Fires once, when cancellation is first requested. */
  readonly onCancellationRequested: Event<void>;
}
