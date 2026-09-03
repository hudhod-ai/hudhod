/**
 * Cancellation primitives.
 *
 * @packageDocumentation
 */

import type { CancellationToken, Disposable } from "@hudhod/sdk";

import { NO_OP_DISPOSABLE } from "./disposable";
import { Emitter } from "./event";

/** A token that is never cancelled. Useful as a default parameter. */
export const CancellationTokenNone: CancellationToken = Object.freeze({
  isCancellationRequested: false,
  onCancellationRequested: () => NO_OP_DISPOSABLE,
});

/**
 * Creates a {@link CancellationToken} and controls when it fires.
 *
 * Listeners registered after cancellation are invoked immediately, so a late
 * subscriber cannot miss the signal.
 *
 * @example
 * ```ts
 * const source = new CancellationTokenSource();
 * const results = await search(query, source.token);
 * source.cancel();
 * ```
 */
export class CancellationTokenSource implements Disposable {
  readonly #emitter = new Emitter<void>();
  #cancelled = false;

  /** The token to hand to cancellable operations. */
  readonly token: CancellationToken;

  constructor() {
    const isCancelled = () => this.#cancelled;
    const onCancellationRequested = this.#emitter.event;
    this.token = {
      get isCancellationRequested(): boolean {
        return isCancelled();
      },
      onCancellationRequested: (listener) => {
        if (isCancelled()) {
          listener();
          return NO_OP_DISPOSABLE;
        }
        return onCancellationRequested(listener);
      },
    };
  }

  /** Whether cancellation has been requested. */
  get isCancellationRequested(): boolean {
    return this.#cancelled;
  }

  /** Requests cancellation. Subsequent calls are no-ops. */
  cancel(): void {
    if (this.#cancelled) return;
    this.#cancelled = true;
    this.#emitter.fire();
  }

  /** Releases listeners without cancelling. */
  dispose(): void {
    this.#emitter.dispose();
  }
}

/**
 * Adapts an {@link AbortSignal} into a {@link CancellationToken}.
 *
 * Lets callers pass the platform-standard signal to hudhod APIs.
 */
export function tokenFromAbortSignal(signal: AbortSignal): CancellationToken {
  return {
    get isCancellationRequested(): boolean {
      return signal.aborted;
    },
    onCancellationRequested: (listener) => {
      if (signal.aborted) {
        listener();
        return NO_OP_DISPOSABLE;
      }
      const onAbort = () => listener();
      signal.addEventListener("abort", onAbort, { once: true });
      return {
        dispose() {
          signal.removeEventListener("abort", onAbort);
        },
      };
    },
  };
}
