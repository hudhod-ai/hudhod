import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FileChangeEvent } from "@hudhod/sdk";

import { createWorkspaceConfig } from "../workspace/config";
import { FileSystemService } from "./file-system-service";
import { InMemoryFileSystemProvider } from "./in-memory-provider";

/** Debounce of 0 makes change delivery synchronous, so tests stay deterministic. */
function createService(files: Record<string, string> = {}) {
  const provider = InMemoryFileSystemProvider.from(files);
  const service = new FileSystemService(provider, { debounceMs: 0 });
  return { provider, service };
}

describe("FileSystemService", () => {
  let service: FileSystemService;
  let provider: InMemoryFileSystemProvider;

  beforeEach(() => {
    ({ provider, service } = createService());
  });

  describe("text round-tripping", () => {
    it("writes and reads UTF-8 text", async () => {
      await service.writeTextFile("/a.txt", "hello");

      expect(await service.readTextFile("/a.txt")).toBe("hello");
    });

    it("preserves non-ASCII content", async () => {
      await service.writeTextFile("/a.txt", "héllo — 世界 🎉");

      expect(await service.readTextFile("/a.txt")).toBe("héllo — 世界 🎉");
    });
  });

  describe("path handling", () => {
    it("normalises paths before touching the provider", async () => {
      await service.writeTextFile("/src//lib/../a.txt", "x");

      expect(provider.snapshot()).toContain("/src/a.txt");
    });

    it("rejects relative paths", async () => {
      await expect(service.readTextFile("a.txt")).rejects.toThrowError(
        expect.objectContaining({ code: "InvalidPath" }),
      );
    });

    it("rejects traversal above the workspace root", async () => {
      await expect(service.writeTextFile("/../escape.txt", "x")).rejects.toThrowError(
        expect.objectContaining({ code: "InvalidPath" }),
      );
    });
  });

  describe("writeFile", () => {
    it("creates missing parent directories by default", async () => {
      await service.writeTextFile("/a/b/c/d.txt", "x");

      expect(await service.exists("/a/b/c")).toBe(true);
      expect(await service.readTextFile("/a/b/c/d.txt")).toBe("x");
    });

    it("does not create parents when createParents is false", async () => {
      await expect(
        service.writeTextFile("/a/b.txt", "x", { createParents: false }),
      ).rejects.toThrowError(expect.objectContaining({ code: "FileNotFound" }));
    });

    it("refuses to overwrite when overwrite is false", async () => {
      await service.writeTextFile("/a.txt", "first");

      await expect(
        service.writeTextFile("/a.txt", "second", { overwrite: false }),
      ).rejects.toThrowError(expect.objectContaining({ code: "FileExists" }));
    });

    it("refuses to create when create is false", async () => {
      await expect(service.writeTextFile("/a.txt", "x", { create: false })).rejects.toThrowError(
        expect.objectContaining({ code: "FileNotFound" }),
      );
    });
  });

  describe("createFile", () => {
    it("creates an empty file", async () => {
      await service.createFile("/a.txt");

      expect(await service.readTextFile("/a.txt")).toBe("");
    });

    it("refuses to clobber an existing file", async () => {
      await service.writeTextFile("/a.txt", "content");

      await expect(service.createFile("/a.txt")).rejects.toThrowError(
        expect.objectContaining({ code: "FileExists" }),
      );
    });
  });

  describe("createDirectory", () => {
    it("creates missing ancestors", async () => {
      await service.createDirectory("/a/b/c");

      expect(await service.exists("/a")).toBe(true);
      expect(await service.exists("/a/b")).toBe(true);
      expect(await service.exists("/a/b/c")).toBe(true);
    });

    it("is idempotent", async () => {
      await service.createDirectory("/a/b");

      await expect(service.createDirectory("/a/b")).resolves.toBeUndefined();
    });

    it("treats the root as always present", async () => {
      await expect(service.createDirectory("/")).resolves.toBeUndefined();
    });
  });

  describe("copy", () => {
    it("copies a file", async () => {
      await service.writeTextFile("/a.txt", "hello");

      await service.copy("/a.txt", "/b.txt");

      expect(await service.readTextFile("/b.txt")).toBe("hello");
      expect(await service.exists("/a.txt")).toBe(true);
    });

    it("copies a directory tree recursively", async () => {
      ({ service } = createService({
        "/src/a.ts": "a",
        "/src/lib/b.ts": "b",
      }));

      await service.copy("/src", "/app");

      expect(await service.readTextFile("/app/a.ts")).toBe("a");
      expect(await service.readTextFile("/app/lib/b.ts")).toBe("b");
    });

    it("creates missing parent directories at the destination", async () => {
      await service.writeTextFile("/a.txt", "hello");

      await service.copy("/a.txt", "/deep/nested/b.txt");

      expect(await service.readTextFile("/deep/nested/b.txt")).toBe("hello");
    });

    it("refuses an existing destination by default", async () => {
      await service.writeTextFile("/a.txt", "a");
      await service.writeTextFile("/b.txt", "b");

      await expect(service.copy("/a.txt", "/b.txt")).rejects.toThrowError(
        expect.objectContaining({ code: "FileExists" }),
      );
    });

    it("replaces the destination when overwrite is set", async () => {
      await service.writeTextFile("/a.txt", "a");
      await service.writeTextFile("/b.txt", "b");

      await service.copy("/a.txt", "/b.txt", { overwrite: true });

      expect(await service.readTextFile("/b.txt")).toBe("a");
    });
  });

  describe("rename", () => {
    it("moves a file", async () => {
      await service.writeTextFile("/a.txt", "hello");

      await service.rename("/a.txt", "/b.txt");

      expect(await service.readTextFile("/b.txt")).toBe("hello");
      expect(await service.exists("/a.txt")).toBe(false);
    });

    it("creates missing parent directories at the destination", async () => {
      await service.writeTextFile("/a.txt", "hello");

      await service.rename("/a.txt", "/deep/nested/b.txt");

      expect(await service.readTextFile("/deep/nested/b.txt")).toBe("hello");
    });
  });

  describe("exists", () => {
    it("reports presence without throwing", async () => {
      await service.writeTextFile("/a.txt", "x");

      expect(await service.exists("/a.txt")).toBe(true);
      expect(await service.exists("/missing.txt")).toBe(false);
    });
  });

  describe("readDirectory", () => {
    it("sorts directories first, then by name", async () => {
      ({ service } = createService({
        "/root/z.ts": "z",
        "/root/a.ts": "a",
        "/root/beta/x.ts": "x",
        "/root/alpha/y.ts": "y",
      }));

      const entries = await service.readDirectory("/root");

      expect(entries.map((entry) => entry.name)).toEqual(["alpha", "beta", "a.ts", "z.ts"]);
    });

    it("returns absolute paths", async () => {
      ({ service } = createService({ "/src/a.ts": "a" }));

      const entries = await service.readDirectory("/src");

      expect(entries[0]?.path).toBe("/src/a.ts");
    });

    it("hides entries matched by filesExclude", async () => {
      ({ service } = createService({
        "/src/a.ts": "a",
        "/node_modules/react/index": "x",
      }));

      const names = (await service.readDirectory("/")).map((entry) => entry.name);

      expect(names).toContain("src");
      expect(names).not.toContain("node_modules");
    });

    it("honours a custom exclusion policy", async () => {
      const provider = InMemoryFileSystemProvider.from({
        "/src/a.ts": "a",
        "/node_modules/react/index": "x",
      });
      const permissive = new FileSystemService(provider, {
        config: createWorkspaceConfig({ filesExclude: [] }),
        debounceMs: 0,
      });

      const names = (await permissive.readDirectory("/")).map((entry) => entry.name);

      expect(names).toContain("node_modules");
    });
  });

  describe("onDidChangeFile", () => {
    it("reports a write", async () => {
      const batches: (readonly FileChangeEvent[])[] = [];
      service.onDidChangeFile((batch) => batches.push(batch));

      await service.writeTextFile("/a.txt", "x");

      expect(batches).toEqual([[{ type: "created", path: "/a.txt" }]]);
    });

    it("suppresses changes matched by watcherExclude", async () => {
      const listener = vi.fn();
      service.onDidChangeFile(listener);

      await service.writeTextFile("/node_modules/react/index", "x");

      expect(listener).not.toHaveBeenCalled();
    });

    it("collapses repeated events for one path, keeping the last", async () => {
      const provider = InMemoryFileSystemProvider.from({});
      const batched = new FileSystemService(provider, { debounceMs: 5 });
      const batches: (readonly FileChangeEvent[])[] = [];
      batched.onDidChangeFile((batch) => batches.push(batch));

      await batched.writeTextFile("/a.txt", "one");
      await batched.writeTextFile("/a.txt", "two");
      await batched.writeTextFile("/a.txt", "three");
      await vi.waitFor(() => expect(batches.length).toBeGreaterThan(0));

      expect(batches).toHaveLength(1);
      expect(batches[0]).toEqual([{ type: "changed", path: "/a.txt" }]);
      batched.dispose();
    });

    it("delivers several distinct paths in one batch", async () => {
      const provider = InMemoryFileSystemProvider.from({});
      const batched = new FileSystemService(provider, { debounceMs: 5 });
      const batches: (readonly FileChangeEvent[])[] = [];
      batched.onDidChangeFile((batch) => batches.push(batch));

      await batched.writeTextFile("/a.txt", "a");
      await batched.writeTextFile("/b.txt", "b");
      await vi.waitFor(() => expect(batches.length).toBeGreaterThan(0));

      expect(batches).toHaveLength(1);
      expect(batches[0]).toHaveLength(2);
      batched.dispose();
    });

    it("stops delivering after the subscription is disposed", async () => {
      const listener = vi.fn();
      service.onDidChangeFile(listener).dispose();

      await service.writeTextFile("/a.txt", "x");

      expect(listener).not.toHaveBeenCalled();
    });

    it("observes writes made outside the service", async () => {
      const batches: (readonly FileChangeEvent[])[] = [];
      service.onDidChangeFile((batch) => batches.push(batch));

      // Simulates a process — npm install, git checkout — touching the disk.
      await provider.writeFile("/generated.ts", new TextEncoder().encode("x"));

      expect(batches).toEqual([[{ type: "created", path: "/generated.ts" }]]);
    });
  });

  describe("watch", () => {
    it("notifies for a matching path", async () => {
      const listener = vi.fn();
      service.watch("/src", listener);

      await service.writeTextFile("/src/a.ts", "x");

      expect(listener).toHaveBeenCalled();
    });

    it("ignores changes outside the watched subtree", async () => {
      const listener = vi.fn();
      service.watch("/src", listener);

      await service.writeTextFile("/outside.ts", "x");

      expect(listener).not.toHaveBeenCalled();
    });

    it("applies per-call exclusions", async () => {
      const listener = vi.fn();
      service.watch("/", listener, { excludes: ["**/*.log"] });

      await service.writeTextFile("/debug.log", "x");
      expect(listener).not.toHaveBeenCalled();

      await service.writeTextFile("/a.ts", "x");
      expect(listener).toHaveBeenCalledOnce();
    });
  });

  describe("dispose", () => {
    it("stops delivering change events", async () => {
      const listener = vi.fn();
      service.onDidChangeFile(listener);

      service.dispose();
      await provider.writeFile("/a.txt", new TextEncoder().encode("x"));

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
