import { describe, expect, it } from "vitest";

import {
  ROOT,
  basename,
  dirname,
  extname,
  isSubPath,
  joinPath,
  normalizePath,
  pathSegments,
  relativePath,
} from "./paths";

describe("normalizePath", () => {
  it("leaves an already-normal path untouched", () => {
    expect(normalizePath("/src/index.ts")).toBe("/src/index.ts");
  });

  it("collapses duplicate slashes", () => {
    expect(normalizePath("/src//lib///a.ts")).toBe("/src/lib/a.ts");
  });

  it("resolves . and .. segments", () => {
    expect(normalizePath("/src/lib/../index.ts")).toBe("/src/index.ts");
    expect(normalizePath("/src/./index.ts")).toBe("/src/index.ts");
  });

  it("strips a trailing slash", () => {
    expect(normalizePath("/src/lib/")).toBe("/src/lib");
  });

  it("normalises the root to a single slash", () => {
    expect(normalizePath("/")).toBe(ROOT);
    expect(normalizePath("///")).toBe(ROOT);
    expect(normalizePath("/src/..")).toBe(ROOT);
  });

  it("rejects relative paths", () => {
    expect(() => normalizePath("src/index.ts")).toThrow(/must be absolute/);
  });

  it("rejects empty and non-string input", () => {
    expect(() => normalizePath("")).toThrow(/non-empty string/);
    expect(() => normalizePath(undefined as unknown as string)).toThrow(/non-empty string/);
  });

  it("rejects null bytes", () => {
    expect(() => normalizePath("/src/\0evil")).toThrow(/null bytes/);
  });

  it("rejects traversal above the workspace root", () => {
    expect(() => normalizePath("/../etc/passwd")).toThrow(/escapes/);
    expect(() => normalizePath("/src/../../etc")).toThrow(/escapes/);
  });

  it("reports the offending path on the error", () => {
    expect(() => normalizePath("relative")).toThrowError(
      expect.objectContaining({ code: "InvalidPath", path: "relative" }),
    );
  });
});

describe("joinPath", () => {
  it("joins segments onto a base", () => {
    expect(joinPath("/src", "lib", "index.ts")).toBe("/src/lib/index.ts");
  });

  it("normalises the joined result", () => {
    expect(joinPath("/src", "lib", "..", "index.ts")).toBe("/src/index.ts");
  });

  it("ignores empty segments", () => {
    expect(joinPath("/src", "", "index.ts")).toBe("/src/index.ts");
  });

  it("returns the base when given no segments", () => {
    expect(joinPath("/src")).toBe("/src");
  });

  it("joins onto the root", () => {
    expect(joinPath("/", "src", "a.ts")).toBe("/src/a.ts");
  });
});

describe("dirname", () => {
  it("returns the parent directory", () => {
    expect(dirname("/src/lib/index.ts")).toBe("/src/lib");
  });

  it("returns the root for a top-level entry", () => {
    expect(dirname("/index.ts")).toBe(ROOT);
  });

  it("treats the root as its own parent", () => {
    expect(dirname("/")).toBe(ROOT);
  });
});

describe("basename", () => {
  it("returns the final segment", () => {
    expect(basename("/src/index.ts")).toBe("index.ts");
  });

  it("returns an empty string for the root", () => {
    expect(basename("/")).toBe("");
  });

  it("ignores a trailing slash", () => {
    expect(basename("/src/lib/")).toBe("lib");
  });
});

describe("extname", () => {
  it("returns the extension including the dot", () => {
    expect(extname("/src/index.ts")).toBe(".ts");
  });

  it("lowercases the extension", () => {
    expect(extname("/src/App.TSX")).toBe(".tsx");
  });

  it("returns the last extension only", () => {
    expect(extname("/src/types.d.ts")).toBe(".ts");
  });

  it("returns an empty string when there is no extension", () => {
    expect(extname("/src/README")).toBe("");
  });

  it("treats a leading dot as a hidden file, not an extension", () => {
    expect(extname("/.gitignore")).toBe("");
  });
});

describe("relativePath", () => {
  it("strips the base prefix", () => {
    expect(relativePath("/src", "/src/lib/a.ts")).toBe("lib/a.ts");
  });

  it("returns an empty string for the base itself", () => {
    expect(relativePath("/src", "/src")).toBe("");
  });

  it("drops the leading slash when the base is the root", () => {
    expect(relativePath("/", "/src/a.ts")).toBe("src/a.ts");
  });

  it("does not treat a name prefix as a directory prefix", () => {
    expect(relativePath("/src", "/src-old/a.ts")).toBe("src-old/a.ts");
  });
});

describe("isSubPath", () => {
  it("accepts a nested path", () => {
    expect(isSubPath("/src", "/src/lib/a.ts")).toBe(true);
  });

  it("accepts the path itself", () => {
    expect(isSubPath("/src", "/src")).toBe(true);
  });

  it("rejects a sibling", () => {
    expect(isSubPath("/src", "/lib/a.ts")).toBe(false);
  });

  it("compares whole segments, so /src does not contain /src-old", () => {
    expect(isSubPath("/src", "/src-old")).toBe(false);
    expect(isSubPath("/src", "/src-old/a.ts")).toBe(false);
  });

  it("treats the root as containing everything", () => {
    expect(isSubPath("/", "/src/a.ts")).toBe(true);
    expect(isSubPath("/", "/")).toBe(true);
  });
});

describe("pathSegments", () => {
  it("splits into segments", () => {
    expect(pathSegments("/src/lib/a.ts")).toEqual(["src", "lib", "a.ts"]);
  });

  it("returns an empty array for the root", () => {
    expect(pathSegments("/")).toEqual([]);
  });

  it("normalises before splitting", () => {
    expect(pathSegments("/src//lib/../a.ts")).toEqual(["src", "a.ts"]);
  });
});
