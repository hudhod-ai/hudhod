/**
 * Typed error factories.
 *
 * Every failure the host raises carries a stable {@link HudhodErrorCode}, so
 * callers can branch on `error.code` rather than parsing message text.
 *
 * @packageDocumentation
 */

import type { HudhodError, HudhodErrorCode } from "@hudhod/sdk";

/** Extra context attached to a {@link HudhodError}. */
export interface HudhodErrorDetails {
  /** The path involved, for file system errors. */
  readonly path?: string;
  /** Output collected before the failure, for process errors. */
  readonly partialOutput?: string;
  /** The underlying failure, when this error wraps another. */
  readonly cause?: unknown;
}

/**
 * Builds a {@link HudhodError}.
 *
 * @example
 * ```ts
 * throw createError("FileNotFound", "No such file: /a.ts", { path: "/a.ts" });
 * ```
 */
export function createError(
  code: HudhodErrorCode,
  message: string,
  details: HudhodErrorDetails = {},
): HudhodError {
  const error = new Error(message, { cause: details.cause }) as Error & {
    code: HudhodErrorCode;
    path?: string;
    partialOutput?: string;
  };
  error.name = `HudhodError(${code})`;
  error.code = code;
  if (details.path !== undefined) error.path = details.path;
  if (details.partialOutput !== undefined) {
    error.partialOutput = details.partialOutput;
  }
  return error;
}

/** The path does not exist. */
export function fileNotFound(path: string): HudhodError {
  return createError("FileNotFound", `File not found: ${path}`, { path });
}

/** The path exists and overwriting was not permitted. */
export function fileExists(path: string): HudhodError {
  return createError("FileExists", `File already exists: ${path}`, { path });
}

/** A directory was required but the path is not one. */
export function notADirectory(path: string): HudhodError {
  return createError("NotADirectory", `Not a directory: ${path}`, { path });
}

/** A file was required but the path is not one. */
export function notAFile(path: string): HudhodError {
  return createError("NotAFile", `Not a file: ${path}`, { path });
}

/** The directory still has children and `recursive` was not set. */
export function directoryNotEmpty(path: string): HudhodError {
  return createError("DirectoryNotEmpty", `Directory not empty: ${path}`, {
    path,
  });
}

/** The path is malformed, relative, or escapes the workspace root. */
export function invalidPath(path: string, reason: string): HudhodError {
  return createError("InvalidPath", `Invalid path "${path}": ${reason}`, {
    path,
  });
}
