import { beforeEach, describe, expect, it, vi } from "vitest";

import type { FileChangeEvent } from "@hudhod/sdk";

import { InMemoryFileSystemProvider } from "./in-memory-provider";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("InMemoryFileSystemProvider", () => {
  let provider: InMemoryFileSystemProvider;

  beforeEach(() => {
    provider = new InMemoryFileSystemProvider();
  });

  describe("from", () => {
    it("seeds files and creates their parent directories", async () => {
      const seeded = InMemoryFileSystemProvider.from({
        "/package.json": "{}",
        "/src/lib/index.ts": "export const a = 1;",
      });

      expect(await seeded.stat("/src")).toMatchObject({ type: "directory" });
      expect(await seeded.stat("/src/lib")).toMatchObject({
        type: "directory",
      });
      expect(decoder.decode(await seeded.readFile("/src/lib/index.ts"))).toBe(
        "export const a = 1;",
      );
    });

    it("starts empty apart from the root", () => {
      expect(provider.snapshot()).toEqual(["/"]);
    });
  });

  describe("readFile", () => {
    it("returns the stored bytes", async () => {
      await provider.writeFile("/a.txt", encoder.encode("hello"));

      expect(decoder.decode(await provider.readFile("/a.txt"))).toBe("hello");
    });

    it("returns a copy, so mutating the result cannot corrupt the store", async () => {
      await provider.writeFile("/a.txt", encoder.encode("hello"));

      const first = await provider.readFile("/a.txt");
      first[0] = 0;

      expect(decoder.decode(await provider.readFile("/a.txt"))).toBe("hello");
    });

    it("throws FileNotFound for a missing path", async () => {
      await expect(provider.readFile("/missing.txt")).rejects.toThrowError(
        expect.objectContaining({ code: "FileNotFound" }),
      );
    });

    it("throws NotAFile for a directory", async () => {
      await provider.createDirectory("/src");

      await expect(provider.readFile("/src")).rejects.toThrowError(
        expect.objectContaining({ code: "NotAFile" }),
      );
    });
  });

  describe("writeFile", () => {
    it("stores a copy, so later mutation of the input is not observed", async () => {
      const data = encoder.encode("hello");
      await provider.writeFile("/a.txt", data);
      data[0] = 0;

      expect(decoder.decode(await provider.readFile("/a.txt"))).toBe("hello");
    });

    it("overwrites existing content", async () => {
      await provider.writeFile("/a.txt", encoder.encode("first"));
      await provider.writeFile("/a.txt", encoder.encode("second"));

      expect(decoder.decode(await provider.readFile("/a.txt"))).toBe("second");
    });

    it("throws when the parent directory does not exist", async () => {
      await expect(provider.writeFile("/nope/a.txt", encoder.encode("x"))).rejects.toThrowError(
        expect.objectContaining({ code: "FileNotFound" }),
      );
    });

    it("throws NotAFile when the path is a directory", async () => {
      await provider.createDirectory("/src");

      await expect(provider.writeFile("/src", encoder.encode("x"))).rejects.toThrowError(
        expect.objectContaining({ code: "NotAFile" }),
      );
    });
  });

  describe("createDirectory", () => {
    it("creates a directory", async () => {
      await provider.createDirectory("/src");

      expect(await provider.stat("/src")).toMatchObject({ type: "directory" });
    });

    it("is idempotent", async () => {
      await provider.createDirectory("/src");

      await expect(provider.createDirectory("/src")).resolves.toBeUndefined();
    });

    it("throws FileExists when a file occupies the path", async () => {
      await provider.writeFile("/src", encoder.encode("x"));

      await expect(provider.createDirectory("/src")).rejects.toThrowError(
        expect.objectContaining({ code: "FileExists" }),
      );
    });

    it("throws when the parent is missing", async () => {
      await expect(provider.createDirectory("/a/b")).rejects.toThrowError(
        expect.objectContaining({ code: "FileNotFound" }),
      );
    });
  });

  describe("delete", () => {
    it("removes a file", async () => {
      await provider.writeFile("/a.txt", encoder.encode("x"));

      await provider.delete("/a.txt", { recursive: false });

      expect(provider.snapshot()).toEqual(["/"]);
    });

    it("removes an empty directory without recursive", async () => {
      await provider.createDirectory("/src");

      await provider.delete("/src", { recursive: false });

      expect(provider.snapshot()).toEqual(["/"]);
    });

    it("refuses a non-empty directory without recursive", async () => {
      const seeded = InMemoryFileSystemProvider.from({ "/src/a.ts": "x" });

      await expect(seeded.delete("/src", { recursive: false })).rejects.toThrowError(
        expect.objectContaining({ code: "DirectoryNotEmpty" }),
      );
    });

    it("removes a directory tree when recursive", async () => {
      const seeded = InMemoryFileSystemProvider.from({
        "/src/a.ts": "x",
        "/src/lib/b.ts": "y",
      });

      await seeded.delete("/src", { recursive: true });

      expect(seeded.snapshot()).toEqual(["/"]);
    });

    it("throws FileNotFound for a missing path", async () => {
      await expect(provider.delete("/missing", { recursive: true })).rejects.toThrowError(
        expect.objectContaining({ code: "FileNotFound" }),
      );
    });
  });

  describe("rename", () => {
    it("moves a file", async () => {
      await provider.writeFile("/a.txt", encoder.encode("hello"));

      await provider.rename("/a.txt", "/b.txt", { overwrite: false });

      expect(decoder.decode(await provider.readFile("/b.txt"))).toBe("hello");
      expect(provider.snapshot()).not.toContain("/a.txt");
    });

    it("re-keys every descendant when moving a directory", async () => {
      const seeded = InMemoryFileSystemProvider.from({
        "/src/a.ts": "x",
        "/src/lib/b.ts": "y",
      });

      await seeded.rename("/src", "/app", { overwrite: false });

      expect(seeded.snapshot()).toEqual(["/", "/app", "/app/a.ts", "/app/lib", "/app/lib/b.ts"]);
      expect(decoder.decode(await seeded.readFile("/app/lib/b.ts"))).toBe("y");
    });

    it("refuses an existing destination without overwrite", async () => {
      await provider.writeFile("/a.txt", encoder.encode("a"));
      await provider.writeFile("/b.txt", encoder.encode("b"));

      await expect(provider.rename("/a.txt", "/b.txt", { overwrite: false })).rejects.toThrowError(
        expect.objectContaining({ code: "FileExists" }),
      );
    });

    it("replaces an existing destination with overwrite", async () => {
      await provider.writeFile("/a.txt", encoder.encode("a"));
      await provider.writeFile("/b.txt", encoder.encode("b"));

      await provider.rename("/a.txt", "/b.txt", { overwrite: true });

      expect(decoder.decode(await provider.readFile("/b.txt"))).toBe("a");
    });

    it("throws FileNotFound for a missing source", async () => {
      await expect(provider.rename("/missing", "/b", { overwrite: false })).rejects.toThrowError(
        expect.objectContaining({ code: "FileNotFound" }),
      );
    });
  });

  describe("stat", () => {
    it("reports file size and type", async () => {
      await provider.writeFile("/a.txt", encoder.encode("hello"));

      expect(await provider.stat("/a.txt")).toMatchObject({
        type: "file",
        size: 5,
      });
    });

    it("reports zero size for directories", async () => {
      await provider.createDirectory("/src");

      expect(await provider.stat("/src")).toMatchObject({
        type: "directory",
        size: 0,
      });
    });

    it("uses the injected clock", async () => {
      const fixed = new InMemoryFileSystemProvider({ now: () => 1234 });
      await fixed.writeFile("/a.txt", encoder.encode("x"));

      expect((await fixed.stat("/a.txt")).mtime).toBe(1234);
    });
  });

  describe("readDirectory", () => {
    it("lists immediate children only", async () => {
      const seeded = InMemoryFileSystemProvider.from({
        "/src/a.ts": "x",
        "/src/lib/b.ts": "y",
      });

      const names = (await seeded.readDirectory("/src")).map((entry) => entry.name).sort();

      expect(names).toEqual(["a.ts", "lib"]);
    });

    it("lists the root", async () => {
      const seeded = InMemoryFileSystemProvider.from({
        "/a.ts": "x",
        "/src/b.ts": "y",
      });

      const names = (await seeded.readDirectory("/")).map((entry) => entry.name).sort();

      expect(names).toEqual(["a.ts", "src"]);
    });

    it("throws NotADirectory for a file", async () => {
      await provider.writeFile("/a.txt", encoder.encode("x"));

      await expect(provider.readDirectory("/a.txt")).rejects.toThrowError(
        expect.objectContaining({ code: "NotADirectory" }),
      );
    });

    it("throws FileNotFound for a missing path", async () => {
      await expect(provider.readDirectory("/missing")).rejects.toThrowError(
        expect.objectContaining({ code: "FileNotFound" }),
      );
    });
  });

  describe("watch", () => {
    it("reports creation", async () => {
      const events: FileChangeEvent[] = [];
      provider.watch("/", { recursive: true }, (batch) => events.push(...batch));

      await provider.writeFile("/a.txt", encoder.encode("x"));

      expect(events).toEqual([{ type: "created", path: "/a.txt" }]);
    });

    it("distinguishes creation from modification", async () => {
      await provider.writeFile("/a.txt", encoder.encode("x"));
      const events: FileChangeEvent[] = [];
      provider.watch("/", { recursive: true }, (batch) => events.push(...batch));

      await provider.writeFile("/a.txt", encoder.encode("y"));

      expect(events).toEqual([{ type: "changed", path: "/a.txt" }]);
    });

    it("reports every path removed by a recursive delete", async () => {
      const seeded = InMemoryFileSystemProvider.from({ "/src/a.ts": "x" });
      const events: FileChangeEvent[] = [];
      seeded.watch("/", { recursive: true }, (batch) => events.push(...batch));

      await seeded.delete("/src", { recursive: true });

      expect(events).toEqual([
        { type: "deleted", path: "/src/a.ts" },
        { type: "deleted", path: "/src" },
      ]);
    });

    it("limits a non-recursive watch to direct children", async () => {
      const seeded = InMemoryFileSystemProvider.from({ "/src/lib/x.ts": "x" });
      const listener = vi.fn();
      seeded.watch("/src", { recursive: false }, listener);

      await seeded.writeFile("/src/lib/y.ts", encoder.encode("y"));
      expect(listener).not.toHaveBeenCalled();

      await seeded.writeFile("/src/direct.ts", encoder.encode("z"));
      expect(listener).toHaveBeenCalledOnce();
    });

    it("scopes a recursive watch to its subtree", async () => {
      const seeded = InMemoryFileSystemProvider.from({ "/src/a.ts": "x" });
      const listener = vi.fn();
      seeded.watch("/src", { recursive: true }, listener);

      await seeded.writeFile("/outside.ts", encoder.encode("x"));

      expect(listener).not.toHaveBeenCalled();
    });

    it("stops delivering once disposed", async () => {
      const listener = vi.fn();
      provider.watch("/", { recursive: true }, listener).dispose();

      await provider.writeFile("/a.txt", encoder.encode("x"));

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
