/**
 * Error codes shared between the host and extensions.
 *
 * The host throws `HudhodError` instances carrying one of these codes. Matching
 * on {@link HudhodErrorCode} is stable across versions; matching on message
 * text is not.
 *
 * @packageDocumentation
 */

/** Every error code the host can raise. */
export type HudhodErrorCode =
  /** The requested path does not exist. */
  | "FileNotFound"
  /** The path already exists and `overwrite` was not set. */
  | "FileExists"
  /** A directory was expected but the path is a file. */
  | "NotADirectory"
  /** A file was expected but the path is a directory. */
  | "NotAFile"
  /** The directory is not empty and `recursive` was not set. */
  | "DirectoryNotEmpty"
  /** The path is malformed, relative, or escapes the workspace root. */
  | "InvalidPath"
  /** A command id was invoked but never registered. */
  | "CommandNotFound"
  /** A command id was registered twice. */
  | "CommandExists"
  /** A process exceeded its configured timeout and was killed. */
  | "ProcessTimeout"
  /** A process produced more output than its configured cap allowed. */
  | "OutputLimitExceeded"
  /** A unified diff did not apply cleanly. */
  | "PatchFailed"
  /** The operation was cancelled by its caller. */
  | "Cancelled";

/** An error raised by the hudhod host. */
export interface HudhodError extends Error {
  /** Stable, machine-readable classification of the failure. */
  readonly code: HudhodErrorCode;
  /** The path involved, for file system errors. */
  readonly path?: string;
  /** Output collected before the failure, for process errors. */
  readonly partialOutput?: string;
}

/**
 * Narrows an unknown caught value to a {@link HudhodError}.
 *
 * @example
 * ```ts
 * try {
 *   await hudhod.fs.readTextFile("/missing.ts");
 * } catch (error) {
 *   if (isHudhodError(error) && error.code === "FileNotFound") {
 *     // handle it
 *   }
 * }
 * ```
 */
export function isHudhodError(value: unknown): value is HudhodError {
  return value instanceof Error && typeof (value as { code?: unknown }).code === "string";
}
