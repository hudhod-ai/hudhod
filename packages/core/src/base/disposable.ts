/**
 * Disposable lifecycle helpers.
 *
 * @packageDocumentation
 */

import type { Disposable } from "@hudhod/sdk";

/**
 * Wraps a callback as a {@link Disposable} that runs at most once.
 *
 * @example
 * ```ts
 * const sub = toDisposable(() => clearInterval(timer));
 * sub.dispose();
 * sub.dispose(); // no-op
 * ```
 */
export function toDisposable(onDispose: () => void): Disposable {
  let disposed = false;
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      onDispose();
    },
  };
}

/** A {@link Disposable} that does nothing. Useful as a default return value. */
export const NO_OP_DISPOSABLE: Disposable = Object.freeze({
  dispose() {},
});

/**
 * Collects disposables and releases them together.
 *
 * Disposal runs in reverse insertion order, so resources are torn down in the
 * opposite order they were set up. A failure in one disposable does not
 * prevent the rest from running; all errors are collected and rethrown
 * together via {@link AggregateError}.
 *
 * @example
 * ```ts
 * const store = new DisposableStore();
 * store.add(emitter.event(handler));
 * store.add(toDisposable(() => socket.close()));
 * store.dispose();
 * ```
 */
export class DisposableStore implements Disposable {
  readonly #items = new Set<Disposable>();
  #disposed = false;

  /** Whether {@link dispose} has already run. */
  get isDisposed(): boolean {
    return this.#disposed;
  }

  /** Number of disposables currently held. */
  get size(): number {
    return this.#items.size;
  }

  /**
   * Registers a disposable.
   *
   * When the store is already disposed the argument is disposed immediately,
   * which keeps late registrations from leaking.
   *
   * @returns The same disposable, for convenient chaining.
   */
  add<T extends Disposable>(disposable: T): T {
    if (this.#disposed) {
      disposable.dispose();
      return disposable;
    }
    this.#items.add(disposable);
    return disposable;
  }

  /** Disposes and forgets a single entry. Returns `false` when not held. */
  delete(disposable: Disposable): boolean {
    if (!this.#items.delete(disposable)) return false;
    disposable.dispose();
    return true;
  }

  /** Disposes everything held without marking the store itself as disposed. */
  clear(): void {
    const errors = disposeAll(this.#items);
    this.#items.clear();
    if (errors.length > 0) {
      throw new AggregateError(errors, "Failed to dispose one or more items");
    }
  }

  /** Disposes everything held and blocks further use. Safe to call repeatedly. */
  dispose(): void {
    if (this.#disposed) return;
    this.#disposed = true;
    this.clear();
  }
}

/** Disposes items newest-first, collecting rather than propagating errors. */
function disposeAll(items: Iterable<Disposable>): unknown[] {
  const errors: unknown[] = [];
  for (const item of [...items].reverse()) {
    try {
      item.dispose();
    } catch (error) {
      errors.push(error);
    }
  }
  return errors;
}
