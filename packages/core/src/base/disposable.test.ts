import { describe, expect, it, vi } from "vitest";

import { DisposableStore, NO_OP_DISPOSABLE, toDisposable } from "./disposable";

describe("toDisposable", () => {
  it("runs the callback on dispose", () => {
    const onDispose = vi.fn();

    toDisposable(onDispose).dispose();

    expect(onDispose).toHaveBeenCalledOnce();
  });

  it("runs the callback at most once", () => {
    const onDispose = vi.fn();
    const disposable = toDisposable(onDispose);

    disposable.dispose();
    disposable.dispose();
    disposable.dispose();

    expect(onDispose).toHaveBeenCalledOnce();
  });
});

describe("NO_OP_DISPOSABLE", () => {
  it("can be disposed without error", () => {
    expect(() => NO_OP_DISPOSABLE.dispose()).not.toThrow();
  });
});

describe("DisposableStore", () => {
  it("disposes everything it holds", () => {
    const store = new DisposableStore();
    const first = vi.fn();
    const second = vi.fn();
    store.add(toDisposable(first));
    store.add(toDisposable(second));

    store.dispose();

    expect(first).toHaveBeenCalledOnce();
    expect(second).toHaveBeenCalledOnce();
  });

  it("disposes in reverse insertion order", () => {
    const store = new DisposableStore();
    const order: string[] = [];
    store.add(toDisposable(() => order.push("first")));
    store.add(toDisposable(() => order.push("second")));
    store.add(toDisposable(() => order.push("third")));

    store.dispose();

    expect(order).toEqual(["third", "second", "first"]);
  });

  it("returns the disposable it was given, for chaining", () => {
    const store = new DisposableStore();
    const disposable = toDisposable(() => {});

    expect(store.add(disposable)).toBe(disposable);
  });

  it("reports its size", () => {
    const store = new DisposableStore();
    expect(store.size).toBe(0);

    store.add(toDisposable(() => {}));
    store.add(toDisposable(() => {}));

    expect(store.size).toBe(2);
  });

  it("disposes late registrations immediately so they cannot leak", () => {
    const store = new DisposableStore();
    store.dispose();
    const onDispose = vi.fn();

    store.add(toDisposable(onDispose));

    expect(onDispose).toHaveBeenCalledOnce();
    expect(store.size).toBe(0);
  });

  it("is idempotent", () => {
    const store = new DisposableStore();
    const onDispose = vi.fn();
    store.add(toDisposable(onDispose));

    store.dispose();
    store.dispose();

    expect(onDispose).toHaveBeenCalledOnce();
    expect(store.isDisposed).toBe(true);
  });

  it("deletes and disposes a single entry", () => {
    const store = new DisposableStore();
    const onDispose = vi.fn();
    const disposable = toDisposable(onDispose);
    store.add(disposable);

    expect(store.delete(disposable)).toBe(true);
    expect(onDispose).toHaveBeenCalledOnce();
    expect(store.size).toBe(0);
  });

  it("reports deletion of an entry it does not hold", () => {
    const store = new DisposableStore();

    expect(store.delete(toDisposable(() => {}))).toBe(false);
  });

  it("clears without marking itself disposed", () => {
    const store = new DisposableStore();
    const onDispose = vi.fn();
    store.add(toDisposable(onDispose));

    store.clear();

    expect(onDispose).toHaveBeenCalledOnce();
    expect(store.isDisposed).toBe(false);
    expect(store.size).toBe(0);
  });

  it("disposes every entry even when one throws, then reports all failures", () => {
    const store = new DisposableStore();
    const survivor = vi.fn();
    store.add(toDisposable(survivor));
    store.add(
      toDisposable(() => {
        throw new Error("boom");
      }),
    );

    expect(() => store.dispose()).toThrow(AggregateError);
    expect(survivor).toHaveBeenCalledOnce();
  });
});
