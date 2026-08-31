import { describe, expect, it } from "vitest";

import { DEFAULT_FILES_EXCLUDE, DEFAULT_SEARCH_EXCLUDE, createWorkspaceConfig } from "./config";

describe("createWorkspaceConfig", () => {
  it("defaults the root to the workspace root", () => {
    expect(createWorkspaceConfig().rootPath).toBe("/");
  });

  it("supplies the default exclusion sets", () => {
    const config = createWorkspaceConfig();

    expect(config.filesExclude).toEqual(DEFAULT_FILES_EXCLUDE);
    expect(config.searchExclude).toEqual(DEFAULT_SEARCH_EXCLUDE);
  });

  it("supplies a search file size cap", () => {
    expect(createWorkspaceConfig().maxSearchFileBytes).toBeGreaterThan(0);
  });

  it("applies a single override without disturbing the rest", () => {
    const config = createWorkspaceConfig({ searchExclude: [] });

    expect(config.searchExclude).toEqual([]);
    expect(config.filesExclude).toEqual(DEFAULT_FILES_EXCLUDE);
  });

  it("allows overriding the root", () => {
    expect(createWorkspaceConfig({ rootPath: "/app" }).rootPath).toBe("/app");
  });

  it("excludes node_modules and .git from the file tree by default", () => {
    expect(DEFAULT_FILES_EXCLUDE).toContain("**/node_modules/**");
    expect(DEFAULT_FILES_EXCLUDE).toContain("**/.git/**");
  });

  it("excludes build output from search by default", () => {
    expect(DEFAULT_SEARCH_EXCLUDE).toContain("**/dist/**");
    expect(DEFAULT_SEARCH_EXCLUDE).toContain("**/.next/**");
  });
});
