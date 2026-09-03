/**
 * Typed event emitter.
 *
 * @packageDocumentation
 */

import type { Disposable, Event } from "@hudhod/sdk";

import { toDisposable } from "./disposable";

/**
 * Produces an {@link Event} and the means to fire it.
 *
 * Listener errors are isolated: one throwing listener never prevents the others
 * from running. Errors are reported to `onListenerError` instead of
 * propagating to the caller of {@link fire}, because an emitter's producer
 * generally cannot do anything useful about a consumer's failure.
 *
 * @typeParam T - The payload delivered to listeners.
 *
 * @example
 * ```ts
 * const emitter = new Emitter<string>();
 * const sub = emitter.event((name) => console.log(name));
 * emitter.fire("world");
 * sub.dispose();
 * ```
 */
export class Emitter<T> implements Disposable {
  readonly #listeners = new Set<(event: T) => unknown>();
  readonly #onListenerError: (error: unknown) => void;
  #disposed = false;

  /**
   * @param options.onListenerError - Called when a listener throws.
   * Defaults to `console.error`.
   */
  constructor(options: { onListenerError?: (error: unknown) => void } = {}) {
    this.#onListenerError =
      options.onListenerError ??
      ((error) => {
        console.error("[hudhod] event listener threw", error);
      });
  }

  /** Number of listeners currently subscribed. */
  get listenerCount(): number {
    return this.#listeners.size;
  }

  /**
   * Subscribes to this emitter.
   *
   * Registering the same function twice yields a single subscription, matching
   * `Set` semantics; disposing either handle removes it.
   */
  readonly event: Event<T> = (listener) => {
    if (this.#disposed) return toDisposable(() => {});
    this.#listeners.add(listener);
    return toDisposable(() => {
      this.#listeners.delete(listener);
    });
  };

  /**
   * Delivers `value` to every current listener.
   *
   * Iterates a snapshot, so listeners added or removed during delivery do not
   * affect the in-flight dispatch.
   */
  fire(value: T): void {
    if (this.#disposed) return;
    for (const listener of Array.from(this.#listeners)) {
      try {
        listener(value);
      } catch (error) {
        this.#onListenerError(error);
      }
    }
  }

  /** Removes all listeners and blocks further subscription. */
  dispose(): void {
    this.#disposed = true;
    this.#listeners.clear();
  }
}
