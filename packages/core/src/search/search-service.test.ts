import { beforeEach, describe, expect, it } from "vitest";

import { FileSystemService } from "../fs/file-system-service";
import { InMemoryFileSystemProvider } from "../fs/in-memory-provider";
import { createWorkspaceConfig } from "../workspace/config";
import { SearchService } from "./search-service";

function createSearch(files: Record<string, string>, config = createWorkspaceConfig()) {
  const fs = new FileSystemService(InMemoryFileSystemProvider.from(files), {
    config,
    debounceMs: 0,
  });
  return { fs, search: new SearchService(fs) };
}

describe("SearchService", () => {
  describe("findFiles", () => {
    let search: SearchService;

    beforeEach(() => {
      ({ search } = createSearch({
        "/package.json": "{}",
        "/src/index.ts": "a",
        "/src/lib/util.ts": "b",
        "/src/lib/util.test.ts": "c",
        "/src/styles.css": "d",
        "/node_modules/react/index": "e",
      }));
    });

    it("matches by extension across directories", async () => {
      const found = await search.findFiles("**/*.ts");

      expect(found.toSorted()).toEqual([
        "/src/index.ts",
        "/src/lib/util.test.ts",
        "/src/lib/util.ts",
      ]);
    });

    it("matches within a directory prefix", async () => {
      const found = await search.findFiles("src/lib/**");

      expect(found.toSorted()).toEqual(["/src/lib/util.test.ts", "/src/lib/util.ts"]);
    });

    it("matches a specific file", async () => {
      expect(await search.findFiles("package.json")).toEqual(["/package.json"]);
    });

    it("skips excluded directories by default", async () => {
      const found = await search.findFiles("**/*");

      expect(found.toSorted()).toEqual([
        "/package.json",
        "/src/index.ts",
        "/src/lib/util.test.ts",
        "/src/lib/util.ts",
        "/src/styles.css",
      ]);
    });

    it("searches excluded directories when the exclusion is lifted", async () => {
      const found = await search.findFiles("**/*", { exclude: [] });

      expect(found.toSorted()).toEqual([
        "/node_modules/react/index",
        "/package.json",
        "/src/index.ts",
        "/src/lib/util.test.ts",
        "/src/lib/util.ts",
        "/src/styles.css",
      ]);
    });

    it("honours maxResults", async () => {
      const found = await search.findFiles("**/*.ts", { maxResults: 2 });

      expect(found).toHaveLength(2);
    });

    it("returns nothing when the pattern matches nothing", async () => {
      expect(await search.findFiles("**/*.rs")).toEqual([]);
    });
  });

  describe("findInFiles", () => {
    let search: SearchService;

    beforeEach(() => {
      ({ search } = createSearch({
        "/a.ts": "const first = 1;\n// TODO: fix this\nconst second = 2;\n",
        "/b.ts": "// todo: lowercase\nconst TODO_LIST = [];\n",
        "/nested/c.md": "# TODO\n",
        "/node_modules/d.ts": "// TODO in a dependency\n",
      }));
    });

    it("finds a literal string with line and column", async () => {
      const { matches } = await search.findInFiles("TODO", {
        include: ["a.ts"],
      });

      expect(matches).toEqual([
        {
          path: "/a.ts",
          line: 2,
          column: 3,
          length: 4,
          preview: "// TODO: fix this",
        },
      ]);
    });

    it("is case-insensitive by default", async () => {
      const { matches } = await search.findInFiles("todo", {
        include: ["b.ts"],
      });

      expect(matches).toHaveLength(2);
    });

    it("respects caseSensitive", async () => {
      const { matches } = await search.findInFiles("todo", {
        include: ["b.ts"],
        caseSensitive: true,
      });

      expect(matches).toHaveLength(1);
      expect(matches[0]?.line).toBe(1);
    });

    it("respects wholeWord", async () => {
      const { matches } = await search.findInFiles("TODO", {
        include: ["b.ts"],
        wholeWord: true,
        caseSensitive: true,
      });

      // TODO_LIST must not match; the underscore is a word character.
      expect(matches).toHaveLength(0);
    });

    it("treats the query literally unless isRegex is set", async () => {
      const { matches } = await search.findInFiles("c.n+st", {
        include: ["a.ts"],
      });

      expect(matches).toHaveLength(0);
    });

    it("supports regular expressions", async () => {
      const { matches } = await search.findInFiles("c.n+st", {
        include: ["a.ts"],
        isRegex: true,
      });

      expect(matches).toHaveLength(2);
    });

    it("finds every match on a single line", async () => {
      const { search: local } = createSearch({ "/x.ts": "aa aa aa\n" });

      const { matches } = await local.findInFiles("aa");

      expect(matches).toHaveLength(3);
      expect(matches.map((match) => match.column)).toEqual([0, 3, 6]);
    });

    it("terminates on a zero-width regex match", async () => {
      const { search: local } = createSearch({ "/x.ts": "ab\n" });

      const { matches } = await local.findInFiles("x*", { isRegex: true });

      expect(matches.length).toBeGreaterThan(0);
    });

    it("skips excluded directories by default", async () => {
      const { matches } = await search.findInFiles("TODO");

      expect(matches.every((match) => !match.path.includes("node_modules"))).toBe(true);
    });

    it("filters by include pattern", async () => {
      const { matches } = await search.findInFiles("TODO", {
        include: ["**/*.md"],
      });

      expect(matches).toHaveLength(1);
      expect(matches[0]?.path).toBe("/nested/c.md");
    });

    it("reports when the result cap is reached", async () => {
      const result = await search.findInFiles("TODO", { maxResults: 1 });

      expect(result.matches).toHaveLength(1);
      expect(result.limitHit).toBe(true);
    });

    it("does not flag limitHit for an unbounded search", async () => {
      expect((await search.findInFiles("TODO")).limitHit).toBe(false);
    });

    it("returns nothing for an empty query", async () => {
      expect(await search.findInFiles("")).toEqual({
        matches: [],
        limitHit: false,
      });
    });

    it("skips files that look binary", async () => {
      const { search: local } = createSearch({ "/bin.dat": "abc\0TODO" });

      expect((await local.findInFiles("TODO")).matches).toEqual([]);
    });

    it("skips files larger than the configured cap", async () => {
      const { search: local } = createSearch(
        { "/big.ts": "TODO ".repeat(100) },
        createWorkspaceConfig({ maxSearchFileBytes: 10 }),
      );

      expect((await local.findInFiles("TODO")).matches).toEqual([]);
    });

    it("stops early when the token is cancelled", async () => {
      const token = {
        isCancellationRequested: true,
        onCancellationRequested: () => ({ dispose() {} }),
      };

      const { matches } = await search.findInFiles("TODO", { token });

      expect(matches).toEqual([]);
    });
  });

  describe("replaceInFiles", () => {
    it("replaces matches and reports the file count", async () => {
      const { fs, search } = createSearch({
        "/a.ts": "const a = 1;\n",
        "/b.ts": "const a = 2;\n",
        "/c.ts": "const b = 3;\n",
      });

      const changed = await search.replaceInFiles("const a", "let a");

      expect(changed).toBe(2);
      expect(await fs.readTextFile("/a.ts")).toBe("let a = 1;\n");
      expect(await fs.readTextFile("/b.ts")).toBe("let a = 2;\n");
      expect(await fs.readTextFile("/c.ts")).toBe("const b = 3;\n");
    });

    it("replaces every occurrence within a file", async () => {
      const { fs, search } = createSearch({ "/a.ts": "x x x\n" });

      await search.replaceInFiles("x", "y");

      expect(await fs.readTextFile("/a.ts")).toBe("y y y\n");
    });

    it("supports regular expression replacement", async () => {
      const { fs, search } = createSearch({ "/a.ts": "foo1 foo2\n" });

      await search.replaceInFiles("foo(\\d)", "bar$1", { isRegex: true });

      expect(await fs.readTextFile("/a.ts")).toBe("bar1 bar2\n");
    });

    it("reports zero when nothing matches", async () => {
      const { search } = createSearch({ "/a.ts": "x\n" });

      expect(await search.replaceInFiles("zzz", "y")).toBe(0);
    });
  });
});
