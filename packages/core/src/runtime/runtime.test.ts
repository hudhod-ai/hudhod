import { describe, expect, it } from "vitest";

import { InMemoryFileSystemProvider } from "../fs/in-memory-provider";
import { FakeProcessSpawner } from "../process/fake-spawner";
import { createHudhodRuntime } from "./runtime";

describe("createHudhodRuntime", () => {
  it("assembles an adapter-backed runtime and disposes it idempotently", async () => {
    const runtime = createHudhodRuntime({
      fileSystemProvider: new InMemoryFileSystemProvider(),
      processSpawner: new FakeProcessSpawner(),
      windowUiProvider: {
        showMessage: async () => {},
        showInputBox: async () => undefined,
        showQuickPick: async () => undefined,
        registerPanel: () => ({ dispose() {} }),
        registerView: () => ({ dispose() {} }),
        openPanel: async () => {},
        closePanel: async () => false,
        openFile: async () => {},
        activeEditor: undefined,
        onDidChangeActiveEditor: () => ({ dispose() {} }),
      },
    });

    await runtime.fs.writeTextFile("/hello.txt", "hello");
    expect(await runtime.fs.readTextFile("/hello.txt")).toBe("hello");
    expect(runtime.api.version).toBe("0.1.0");

    runtime.dispose();
    runtime.dispose();
  });
});
