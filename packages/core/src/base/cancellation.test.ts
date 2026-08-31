import { describe, expect, it, vi } from "vitest";

import {
  CancellationTokenNone,
  CancellationTokenSource,
  tokenFromAbortSignal,
} from "./cancellation";

describe("CancellationTokenNone", () => {
  it("is never cancelled", () => {
    expect(CancellationTokenNone.isCancellationRequested).toBe(false);
  });

  it("never invokes a listener", () => {
    const listener = vi.fn();

    CancellationTokenNone.onCancellationRequested(listener);

    expect(listener).not.toHaveBeenCalled();
  });
});

describe("CancellationTokenSource", () => {
  it("starts uncancelled", () => {
    const source = new CancellationTokenSource();

    expect(source.token.isCancellationRequested).toBe(false);
    expect(source.isCancellationRequested).toBe(false);
  });

  it("flips the token when cancelled", () => {
    const source = new CancellationTokenSource();

    source.cancel();

    expect(source.token.isCancellationRequested).toBe(true);
    expect(source.isCancellationRequested).toBe(true);
  });

  it("notifies listeners registered before cancellation", () => {
    const source = new CancellationTokenSource();
    const listener = vi.fn();
    source.token.onCancellationRequested(listener);

    source.cancel();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("invokes listeners registered after cancellation immediately", () => {
    const source = new CancellationTokenSource();
    source.cancel();
    const listener = vi.fn();

    source.token.onCancellationRequested(listener);

    expect(listener).toHaveBeenCalledOnce();
  });

  it("fires only once no matter how often cancel is called", () => {
    const source = new CancellationTokenSource();
    const listener = vi.fn();
    source.token.onCancellationRequested(listener);

    source.cancel();
    source.cancel();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("stops notifying a disposed subscription", () => {
    const source = new CancellationTokenSource();
    const listener = vi.fn();
    source.token.onCancellationRequested(listener).dispose();

    source.cancel();

    expect(listener).not.toHaveBeenCalled();
  });

  it("does not cancel when merely disposed", () => {
    const source = new CancellationTokenSource();
    const listener = vi.fn();
    source.token.onCancellationRequested(listener);

    source.dispose();

    expect(source.token.isCancellationRequested).toBe(false);
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("tokenFromAbortSignal", () => {
  it("reflects an unaborted signal", () => {
    const controller = new AbortController();

    expect(tokenFromAbortSignal(controller.signal).isCancellationRequested).toBe(false);
  });

  it("reflects abort", () => {
    const controller = new AbortController();
    const token = tokenFromAbortSignal(controller.signal);

    controller.abort();

    expect(token.isCancellationRequested).toBe(true);
  });

  it("notifies on abort", () => {
    const controller = new AbortController();
    const listener = vi.fn();
    tokenFromAbortSignal(controller.signal).onCancellationRequested(listener);

    controller.abort();

    expect(listener).toHaveBeenCalledOnce();
  });

  it("invokes listeners immediately when already aborted", () => {
    const controller = new AbortController();
    controller.abort();
    const listener = vi.fn();

    tokenFromAbortSignal(controller.signal).onCancellationRequested(listener);

    expect(listener).toHaveBeenCalledOnce();
  });

  it("removes the abort listener when disposed", () => {
    const controller = new AbortController();
    const listener = vi.fn();
    tokenFromAbortSignal(controller.signal).onCancellationRequested(listener).dispose();

    controller.abort();

    expect(listener).not.toHaveBeenCalled();
  });
});
