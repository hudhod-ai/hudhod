import { describe, expect, it } from "vitest";

import { isHudhodError } from "@hudhod/sdk";

import {
  createError,
  directoryNotEmpty,
  fileExists,
  fileNotFound,
  invalidPath,
  notADirectory,
  notAFile,
} from "./errors";

describe("createError", () => {
  it("produces a real Error carrying the code", () => {
    const error = createError("FileNotFound", "missing");

    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe("FileNotFound");
    expect(error.message).toBe("missing");
  });

  it("is recognised by the SDK type guard", () => {
    expect(isHudhodError(createError("Cancelled", "stopped"))).toBe(true);
  });

  it("names the error after its code, for readable stack traces", () => {
    expect(createError("PatchFailed", "nope").name).toBe("HudhodError(PatchFailed)");
  });

  it("attaches a path when given", () => {
    expect(createError("FileNotFound", "missing", { path: "/a.ts" }).path).toBe("/a.ts");
  });

  it("attaches partial output when given", () => {
    const error = createError("ProcessTimeout", "timed out", {
      partialOutput: "half done",
    });

    expect(error.partialOutput).toBe("half done");
  });

  it("omits absent details rather than setting them undefined", () => {
    const error = createError("Cancelled", "stopped");

    expect("path" in error).toBe(false);
    expect("partialOutput" in error).toBe(false);
  });

  it("preserves the underlying cause", () => {
    const cause = new Error("root cause");

    expect(createError("PatchFailed", "wrapped", { cause }).cause).toBe(cause);
  });
});

describe("file system error factories", () => {
  it.each([
    ["fileNotFound", fileNotFound, "FileNotFound"],
    ["fileExists", fileExists, "FileExists"],
    ["notADirectory", notADirectory, "NotADirectory"],
    ["notAFile", notAFile, "NotAFile"],
    ["directoryNotEmpty", directoryNotEmpty, "DirectoryNotEmpty"],
  ])("%s carries its code and path", (_name, factory, code) => {
    const error = factory("/src/a.ts");

    expect(error.code).toBe(code);
    expect(error.path).toBe("/src/a.ts");
    expect(error.message).toContain("/src/a.ts");
  });

  it("invalidPath explains the reason", () => {
    const error = invalidPath("relative", "path must be absolute");

    expect(error.code).toBe("InvalidPath");
    expect(error.message).toContain("path must be absolute");
    expect(error.path).toBe("relative");
  });
});
