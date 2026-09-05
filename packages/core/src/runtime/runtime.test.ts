import { describe, expect, it, vi } from "vitest";

import { InMemoryFileSystemProvider } from "../fs/in-memory-provider";
import { FakeProcessSpawner } from "../process/fake-spawner";
import { createWorkspaceConfig } from "../workspace/config";
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

  it("passes the complete workspace policy to its services", async () => {
    const workspaceConfig = createWorkspaceConfig({
      rootPath: "/workspace",
      filesExclude: ["**/generated/**"],
      searchExclude: ["**/ignored/**"],
      watcherExclude: ["**/noisy/**"],
      snapshotExclude: ["**/cache/**"],
      maxSearchFileBytes: 4,
    });
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
      workspaceConfig,
    });

    await runtime.fs.writeTextFile("/workspace/src/index.ts", "TODO");
    await runtime.fs.writeTextFile("/workspace/generated/output.js", "compiled");
    await runtime.fs.writeTextFile("/workspace/ignored/index.ts", "TODO");
    await runtime.fs.writeTextFile("/workspace/large.ts", "TODO!");
    await runtime.fs.writeTextFile("/outside.ts", "TODO");

    expect(runtime.fs.config).toEqual(workspaceConfig);

    const names = (await runtime.fs.readDirectory("/workspace")).map((entry) => entry.name);

    expect(names).toContain("src");
    expect(names).not.toContain("generated");

    expect(await runtime.search.findFiles("**/*")).toEqual([
      "/workspace/generated/output.js",
      "/workspace/src/index.ts",
      "/workspace/large.ts",
    ]);

    const { matches } = await runtime.search.findInFiles("TODO");
    expect(matches.map((match) => match.path)).toEqual(["/workspace/src/index.ts"]);

    const watcher = vi.fn();
    runtime.fs.onDidChangeFile(watcher);
    await runtime.fs.writeTextFile("/workspace/noisy/changes.ts", "x");
    expect(watcher).not.toHaveBeenCalled();

    runtime.dispose();
  });
});
