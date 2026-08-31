import type { Extension, HudhodApi } from "@hudhod/sdk";
import { describe, expect, it, vi } from "vitest";

import { InProcessExtensionHost } from "./extension-host";

const hudhod = {} as HudhodApi;

function extension(overrides: Partial<Extension> = {}): Extension {
  return {
    manifest: {
      id: "acme.demo",
      name: "Demo",
      version: "1.0.0",
      activationEvents: ["onStartup"],
    },
    activate: () => {},
    ...overrides,
  };
}

describe("InProcessExtensionHost", () => {
  it("registers without activating", () => {
    const activate = vi.fn();
    const host = new InProcessExtensionHost(hudhod);

    host.register(extension({ activate }));

    expect(activate).not.toHaveBeenCalled();
    expect(host.getExtensions()).toMatchObject([{ status: "registered" }]);
  });

  it("activates extensions matching an event", async () => {
    const activate = vi.fn();
    const host = new InProcessExtensionHost(hudhod);
    host.register(extension({ activate }));

    await host.activateByEvent("onStartup");

    expect(activate).toHaveBeenCalledOnce();
    expect(host.getExtensions()).toMatchObject([{ status: "active" }]);
  });

  it("does not activate extensions for a different event", async () => {
    const activate = vi.fn();
    const host = new InProcessExtensionHost(hudhod);
    host.register(
      extension({
        manifest: {
          id: "acme.command",
          name: "Command",
          version: "1.0.0",
          activationEvents: ["onCommand:acme.command.run"],
        },
        activate,
      }),
    );

    await host.activateByEvent("onStartup");

    expect(activate).not.toHaveBeenCalled();
  });

  it("defaults a missing activationEvents array to onStartup", async () => {
    const activate = vi.fn();
    const host = new InProcessExtensionHost(hudhod);
    host.register(
      extension({
        manifest: { id: "acme.default", name: "Default", version: "1.0.0" },
        activate,
      }),
    );

    await host.activateByEvent("onStartup");

    expect(activate).toHaveBeenCalledOnce();
  });

  it("only calls activate once for repeated matching events", async () => {
    const activate = vi.fn();
    const host = new InProcessExtensionHost(hudhod);
    host.register(extension({ activate }));

    await host.activateByEvent("onStartup");
    await host.activateByEvent("onStartup");

    expect(activate).toHaveBeenCalledOnce();
  });

  it("deduplicates concurrent activations", async () => {
    let resolveActivation: () => void = () => {};
    const activate = vi.fn(
      () => new Promise<void>((resolve) => (resolveActivation = resolve)),
    );
    const host = new InProcessExtensionHost(hudhod);
    host.register(extension({ activate }));

    const first = host.activateByEvent("onStartup");
    const second = host.activate("acme.demo");
    resolveActivation();
    await Promise.all([first, second]);

    expect(activate).toHaveBeenCalledOnce();
  });

  it("passes the validated manifest and hudhod api to activate", async () => {
    const activate = vi.fn();
    const host = new InProcessExtensionHost(hudhod);
    host.register(extension({ activate }));

    await host.activate("acme.demo");

    expect(activate).toHaveBeenCalledWith(
      expect.objectContaining({
        hudhod,
        manifest: expect.objectContaining({ id: "acme.demo" }),
        subscriptions: expect.any(Array),
      }),
    );
  });

  it("cleans subscriptions during deactivation", async () => {
    const dispose = vi.fn();
    const host = new InProcessExtensionHost(hudhod);
    host.register(
      extension({
        activate: (context) => {
          context.subscriptions.push({ dispose });
        },
      }),
    );

    await host.activate("acme.demo");
    await host.deactivate("acme.demo");

    expect(dispose).toHaveBeenCalledOnce();
    expect(host.getExtensions()).toMatchObject([{ status: "registered" }]);
  });

  it("calls deactivate before subscriptions are disposed", async () => {
    const calls: string[] = [];
    const host = new InProcessExtensionHost(hudhod);
    host.register(
      extension({
        activate: (context) => {
          context.subscriptions.push({
            dispose: () => calls.push("subscription"),
          });
        },
        deactivate: () => {
          calls.push("extension");
        },
      }),
    );

    await host.activate("acme.demo");
    await host.deactivate("acme.demo");

    expect(calls).toEqual(["extension", "subscription"]);
  });

  it("reports false when deactivating an inactive or unknown extension", async () => {
    const host = new InProcessExtensionHost(hudhod);
    host.register(extension());

    await expect(host.deactivate("acme.demo")).resolves.toBe(false);
    await expect(host.deactivate("missing")).resolves.toBe(false);
  });

  it("unregisters a disposed registration", async () => {
    const host = new InProcessExtensionHost(hudhod);
    const registration = host.register(extension());

    registration.dispose();

    expect(host.getExtensions()).toEqual([]);
    await expect(host.activate("acme.demo")).rejects.toThrow("not registered");
  });

  it("rejects a duplicate extension id", () => {
    const host = new InProcessExtensionHost(hudhod);
    host.register(extension());

    expect(() => host.register(extension())).toThrow("already registered");
  });

  it("records a failed activation without losing the original error", async () => {
    const host = new InProcessExtensionHost(hudhod);
    host.register(
      extension({
        activate: () => {
          throw new Error("activation failed");
        },
      }),
    );

    await expect(host.activate("acme.demo")).rejects.toThrow(
      "activation failed",
    );
    expect(host.getExtensions()).toMatchObject([
      { status: "failed", error: "activation failed" },
    ]);
  });

  it("rejects activation of an unknown id", async () => {
    const host = new InProcessExtensionHost(hudhod);

    await expect(host.activate("missing")).rejects.toThrow("not registered");
  });

  it("blocks use after disposal", async () => {
    const host = new InProcessExtensionHost(hudhod);
    host.dispose();

    expect(() => host.register(extension())).toThrow("disposed");
    await expect(host.activateByEvent("onStartup")).rejects.toThrow("disposed");
  });
});
