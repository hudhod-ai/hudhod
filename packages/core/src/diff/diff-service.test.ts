import { beforeEach, describe, expect, it } from "vitest";

import { FileSystemService } from "../fs/file-system-service";
import { InMemoryFileSystemProvider } from "../fs/in-memory-provider";
import { DiffService } from "./diff-service";

function createDiff(files: Record<string, string> = {}) {
  const fs = new FileSystemService(InMemoryFileSystemProvider.from(files), {
    debounceMs: 0,
  });
  return { fs, diff: new DiffService(fs) };
}

describe("DiffService", () => {
  let diff: DiffService;

  beforeEach(() => {
    ({ diff } = createDiff());
  });

  describe("diffText", () => {
    it("reports no changes for identical text", async () => {
      const changes = await diff.diffText("a\nb\n", "a\nb\n");

      expect(changes).toEqual([{ type: "unchanged", lines: ["a", "b"] }]);
    });

    it("reports an addition", async () => {
      const changes = await diff.diffText("a\n", "a\nb\n");

      expect(changes).toContainEqual({ type: "added", lines: ["b"] });
    });

    it("reports a removal", async () => {
      const changes = await diff.diffText("a\nb\n", "a\n");

      expect(changes).toContainEqual({ type: "removed", lines: ["b"] });
    });

    it("reports a replacement as a removal plus an addition", async () => {
      const changes = await diff.diffText("a\n", "b\n");

      expect(changes).toContainEqual({ type: "removed", lines: ["a"] });
      expect(changes).toContainEqual({ type: "added", lines: ["b"] });
    });

    it("handles empty input on both sides", async () => {
      expect(await diff.diffText("", "")).toEqual([]);
    });

    it("treats going from empty to content as an addition", async () => {
      expect(await diff.diffText("", "a\n")).toEqual([{ type: "added", lines: ["a"] }]);
    });

    it("can ignore whitespace-only differences", async () => {
      const changes = await diff.diffText("a\n", "a   \n", {
        ignoreWhitespace: true,
      });

      expect(changes.every((change) => change.type === "unchanged")).toBe(true);
    });

    it("can ignore case differences", async () => {
      const changes = await diff.diffText("Hello\n", "hello\n", {
        ignoreCase: true,
      });

      expect(changes.every((change) => change.type === "unchanged")).toBe(true);
    });

    it("never emits an empty hunk", async () => {
      const changes = await diff.diffText("a\nb\nc\n", "a\nx\nc\n");

      expect(changes.every((change) => change.lines.length > 0)).toBe(true);
    });
  });

  describe("diffStat", () => {
    it("counts added and removed lines", async () => {
      expect(await diff.diffStat("a\nb\n", "a\nx\ny\n")).toEqual({
        added: 2,
        removed: 1,
      });
    });

    it("reports zeroes for identical text", async () => {
      expect(await diff.diffStat("a\n", "a\n")).toEqual({
        added: 0,
        removed: 0,
      });
    });
  });

  describe("diffFiles", () => {
    it("compares two files on disk", async () => {
      const { diff: local } = createDiff({
        "/a.ts": "const a = 1;\n",
        "/b.ts": "const a = 2;\n",
      });

      const changes = await local.diffFiles("/a.ts", "/b.ts");

      expect(changes).toContainEqual({
        type: "removed",
        lines: ["const a = 1;"],
      });
      expect(changes).toContainEqual({
        type: "added",
        lines: ["const a = 2;"],
      });
    });

    it("propagates FileNotFound", async () => {
      const { diff: local } = createDiff({ "/a.ts": "x\n" });

      await expect(local.diffFiles("/a.ts", "/missing.ts")).rejects.toThrowError(
        expect.objectContaining({ code: "FileNotFound" }),
      );
    });
  });

  describe("createPatch", () => {
    it("produces a unified diff naming the file", async () => {
      const patch = await diff.createPatch("/src/a.ts", "a\n", "b\n");

      expect(patch).toContain("--- /src/a.ts");
      expect(patch).toContain("+++ /src/a.ts");
      expect(patch).toContain("-a");
      expect(patch).toContain("+b");
    });

    it("round-trips through applyPatch", async () => {
      const { fs, diff: local } = createDiff({ "/a.ts": "one\ntwo\n" });
      const patch = await local.createPatch("/a.ts", "one\ntwo\n", "one\nTWO\n");

      await local.applyPatch("/a.ts", patch);

      expect(await fs.readTextFile("/a.ts")).toBe("one\nTWO\n");
    });
  });

  describe("applyPatch", () => {
    it("throws PatchFailed when the file no longer matches", async () => {
      const { diff: local } = createDiff({ "/a.ts": "totally different\n" });
      const patch = await local.createPatch("/a.ts", "one\ntwo\n", "one\nTWO\n");

      await expect(local.applyPatch("/a.ts", patch)).rejects.toThrowError(
        expect.objectContaining({ code: "PatchFailed", path: "/a.ts" }),
      );
    });

    it("leaves the file untouched when the patch fails", async () => {
      const { fs, diff: local } = createDiff({ "/a.ts": "original\n" });
      const patch = await local.createPatch("/a.ts", "one\ntwo\n", "one\nTWO\n");

      await expect(local.applyPatch("/a.ts", patch)).rejects.toThrow();

      expect(await fs.readTextFile("/a.ts")).toBe("original\n");
    });
  });
});
