/**
 * Diff and patch API types.
 *
 * @packageDocumentation
 */

/** How two pieces of text differ, as a sequence of ordered hunks. */
export interface DiffChange {
  /** Whether this run of lines was added, removed, or left untouched. */
  readonly type: "added" | "removed" | "unchanged";
  /** The lines covered by this hunk, without trailing newlines. */
  readonly lines: readonly string[];
}

/** Options controlling how text is compared. */
export interface DiffOptions {
  /**
   * Ignore differences that consist only of whitespace.
   * @defaultValue false
   */
  readonly ignoreWhitespace?: boolean;
  /**
   * Ignore differences in letter casing.
   * @defaultValue false
   */
  readonly ignoreCase?: boolean;
  /**
   * Lines of unchanged context to keep around each hunk in a unified patch.
   * @defaultValue 3
   */
  readonly context?: number;
}

/** Aggregate statistics for a diff. */
export interface DiffStat {
  /** Number of added lines. */
  readonly added: number;
  /** Number of removed lines. */
  readonly removed: number;
}

/**
 * Compare text and files, and apply unified patches.
 *
 * @example
 * ```ts
 * const patch = await hudhod.diff.createPatch("/src/a.ts", oldText, newText);
 * await hudhod.diff.applyPatch("/src/a.ts", patch);
 * ```
 */
export interface DiffApi {
  /** Compares two strings line by line. */
  diffText(original: string, modified: string, options?: DiffOptions): Promise<DiffChange[]>;

  /** Reads both paths and compares their contents. */
  diffFiles(
    originalPath: string,
    modifiedPath: string,
    options?: DiffOptions,
  ): Promise<DiffChange[]>;

  /** Summarises how many lines a change adds and removes. */
  diffStat(original: string, modified: string, options?: DiffOptions): Promise<DiffStat>;

  /** Produces a unified diff, using `path` for the file headers. */
  createPatch(
    path: string,
    original: string,
    modified: string,
    options?: DiffOptions,
  ): Promise<string>;

  /**
   * Applies a unified diff to a file on disk.
   * @throws A `PatchFailed` error when the patch does not apply cleanly.
   */
  applyPatch(path: string, patch: string): Promise<void>;
}
