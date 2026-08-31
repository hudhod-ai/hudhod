import { describe, expect, it, vi } from "vitest";

import { defineExtension } from "./extension";
import type { Extension, ExtensionContext } from "./extension";

function fakeContext(extension: Extension): ExtensionContext {
  return {
    manifest: extension.manifest,
    subscriptions: [],
    hudhod: {} as ExtensionContext["hudhod"],
  };
}

describe("defineExtension", () => {
  it("returns the same object it was given", () => {
    const extension: Extension = {
      manifest: { id: "acme.demo", name: "Demo", version: "1.0.0" },
      activate: () => {},
    };

    expect(defineExtension(extension)).toBe(extension);
  });

  it("preserves the manifest verbatim", () => {
    const defined = defineExtension({
      manifest: {
        id: "acme.demo",
        name: "Demo",
        version: "1.2.3",
        activationEvents: ["onCommand:acme.demo.run"],
        contributes: {
          commands: [{ id: "acme.demo.run", title: "Run Demo" }],
        },
      },
      activate: () => {},
    });

    expect(defined.manifest.version).toBe("1.2.3");
    expect(defined.manifest.activationEvents).toEqual(["onCommand:acme.demo.run"]);
    expect(defined.manifest.contributes?.commands?.[0]?.id).toBe("acme.demo.run");
  });

  it("keeps activate callable with a context", async () => {
    const activate = vi.fn();
    const defined = defineExtension({
      manifest: { id: "acme.demo", name: "Demo", version: "1.0.0" },
      activate,
    });

    await defined.activate(fakeContext(defined));

    expect(activate).toHaveBeenCalledOnce();
  });

  it("leaves deactivate optional", () => {
    const defined = defineExtension({
      manifest: { id: "acme.demo", name: "Demo", version: "1.0.0" },
      activate: () => {},
    });

    expect(defined.deactivate).toBeUndefined();
  });
});
