import { describe, expect, it } from "vitest";

import { isHudhodError } from "./errors";

describe("isHudhodError", () => {
  it("accepts an Error carrying a string code", () => {
    const error = Object.assign(new Error("missing"), {
      code: "FileNotFound",
    });

    expect(isHudhodError(error)).toBe(true);
  });

  it("rejects an Error with no code", () => {
    expect(isHudhodError(new Error("plain"))).toBe(false);
  });

  it("rejects an Error whose code is not a string", () => {
    const error = Object.assign(new Error("odd"), { code: 404 });

    expect(isHudhodError(error)).toBe(false);
  });

  it("rejects plain objects that merely look like errors", () => {
    expect(isHudhodError({ code: "FileNotFound", message: "missing" })).toBe(false);
  });

  it("rejects nullish and primitive values", () => {
    expect(isHudhodError(null)).toBe(false);
    expect(isHudhodError(undefined)).toBe(false);
    expect(isHudhodError("FileNotFound")).toBe(false);
  });

  it("narrows the value so the code is readable", () => {
    const thrown: unknown = Object.assign(new Error("missing"), {
      code: "FileNotFound",
      path: "/missing.ts",
    });

    if (!isHudhodError(thrown)) {
      throw new Error("expected a hudhod error");
    }

    expect(thrown.code).toBe("FileNotFound");
    expect(thrown.path).toBe("/missing.ts");
  });
});
