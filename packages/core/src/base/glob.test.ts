import { describe, expect, it } from "vitest";

import { createIncludeMatcher, createMatcher } from "./glob";

describe("createMatcher", () => {
  it("matches by extension anywhere in the tree", () => {
    const matches = createMatcher(["**/*.ts"]);

    expect(matches("/src/index.ts")).toBe(true);
    expect(matches("/src/lib/deep/a.ts")).toBe(true);
    expect(matches("/src/index")).toBe(false);
  });

  it("matches a top-level file", () => {
    const matches = createMatcher(["package.json"]);

    expect(matches("/package.json")).toBe(true);
    expect(matches("/nested/package.json")).toBe(false);
  });

  it("matches a directory prefix", () => {
    const matches = createMatcher(["src/**"]);

    expect(matches("/src/a.ts")).toBe(true);
    expect(matches("/src/lib/b.ts")).toBe(true);
    expect(matches("/other/a.ts")).toBe(false);
  });

  it("matches a nested directory anywhere", () => {
    const matches = createMatcher(["**/node_modules/**"]);

    expect(matches("/node_modules/react/index")).toBe(true);
    expect(matches("/packages/app/node_modules/react/index")).toBe(true);
    expect(matches("/src/index.ts")).toBe(false);
  });

  it("accepts several patterns", () => {
    const matches = createMatcher(["**/*.ts", "**/*.tsx"]);

    expect(matches("/a.ts")).toBe(true);
    expect(matches("/a.tsx")).toBe(true);
    expect(matches("/a")).toBe(false);
  });

  it("matches dotfiles, which shell globbing would hide", () => {
    const matches = createMatcher(["**/.env*"]);

    expect(matches("/.env")).toBe(true);
    expect(matches("/config/.env.local")).toBe(true);
  });

  it("never matches when given no patterns", () => {
    const matches = createMatcher([]);

    expect(matches("/anything.ts")).toBe(false);
  });

  it("never matches the root itself", () => {
    expect(createMatcher(["**"])("/")).toBe(false);
  });

  it("treats paths with and without a leading slash alike", () => {
    const matches = createMatcher(["src/**"]);

    expect(matches("/src/a.ts")).toBe(true);
    expect(matches("src/a.ts")).toBe(true);
  });
});

describe("createIncludeMatcher", () => {
  it("matches everything when no patterns are given", () => {
    expect(createIncludeMatcher(undefined)("/anything.ts")).toBe(true);
    expect(createIncludeMatcher([])("/anything.ts")).toBe(true);
  });

  it("filters when patterns are given", () => {
    const matches = createIncludeMatcher(["**/*.md"]);

    expect(matches("/README.md")).toBe(true);
    expect(matches("/index.ts")).toBe(false);
  });
});
