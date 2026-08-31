import { describe, expect, it, vi } from "vitest";

import { Emitter } from "./event";

describe("Emitter", () => {
  it("delivers the payload to a listener", () => {
    const emitter = new Emitter<string>();
    const listener = vi.fn();
    emitter.event(listener);

    emitter.fire("hello");

    expect(listener).toHaveBeenCalledExactlyOnceWith("hello");
  });

  it("delivers to every listener", () => {
    const emitter = new Emitter<number>();
    const first = vi.fn();
    const second = vi.fn();
    emitter.event(first);
    emitter.event(second);

    emitter.fire(42);

    expect(first).toHaveBeenCalledWith(42);
    expect(second).toHaveBeenCalledWith(42);
  });

  it("stops delivering after the subscription is disposed", () => {
    const emitter = new Emitter<void>();
    const listener = vi.fn();
    const subscription = emitter.event(listener);

    subscription.dispose();
    emitter.fire();

    expect(listener).not.toHaveBeenCalled();
  });

  it("tracks the listener count", () => {
    const emitter = new Emitter<void>();
    expect(emitter.listenerCount).toBe(0);

    const subscription = emitter.event(() => {});
    expect(emitter.listenerCount).toBe(1);

    subscription.dispose();
    expect(emitter.listenerCount).toBe(0);
  });

  it("isolates a throwing listener from the others", () => {
    const onListenerError = vi.fn();
    const emitter = new Emitter<void>({ onListenerError });
    const survivor = vi.fn();
    emitter.event(() => {
      throw new Error("boom");
    });
    emitter.event(survivor);

    expect(() => emitter.fire()).not.toThrow();
    expect(survivor).toHaveBeenCalledOnce();
    expect(onListenerError).toHaveBeenCalledOnce();
  });

  it("iterates a snapshot so listeners added during dispatch wait for the next fire", () => {
    const emitter = new Emitter<void>();
    const late = vi.fn();
    emitter.event(() => {
      emitter.event(late);
    });

    emitter.fire();
    expect(late).not.toHaveBeenCalled();

    emitter.fire();
    expect(late).toHaveBeenCalledOnce();
  });

  it("does not deliver to a listener removed during dispatch", () => {
    const emitter = new Emitter<void>();
    const removed = vi.fn();
    const subscription = emitter.event(removed);
    emitter.event(() => subscription.dispose());

    emitter.fire();

    // The removed listener runs first this time, then is gone for good.
    emitter.fire();
    expect(removed).toHaveBeenCalledOnce();
  });

  it("ignores fire and subscription once disposed", () => {
    const emitter = new Emitter<void>();
    const listener = vi.fn();
    emitter.event(listener);

    emitter.dispose();
    emitter.fire();
    emitter.event(listener);
    emitter.fire();

    expect(listener).not.toHaveBeenCalled();
    expect(emitter.listenerCount).toBe(0);
  });
});
