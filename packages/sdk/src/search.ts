/**
 * Search API types.
 *
 * @packageDocumentation
 */

import type { CancellationToken } from "./lifecycle";

/** Options for {@link SearchApi.findFiles}. */
export interface FindFilesOptions {
  /**
   * Glob patterns to exclude.
   * @defaultValue The workspace `search.exclude` setting.
   */
  readonly exclude?: readonly string[];
  /**
   * Stop after this many matches.
   * @defaultValue 1000
   */
  readonly maxResults?: number;
  /** Abort the walk early. */
  readonly token?: CancellationToken;
}

/** Options for {@link SearchApi.findInFiles}. */
export interface FindInFilesOptions extends FindFilesOptions {
  /**
   * Glob patterns to include.
   * @defaultValue All files.
   */
  readonly include?: readonly string[];
  /**
   * Treat `query` as a regular expression.
   * @defaultValue false
   */
  readonly isRegex?: boolean;
  /**
   * Match case exactly.
   * @defaultValue false
   */
  readonly caseSensitive?: boolean;
  /**
   * Only match whole words.
   * @defaultValue false
   */
  readonly wholeWord?: boolean;
}

/** A single match within a file. */
export interface SearchMatch {
  /** Absolute path of the containing file. */
  readonly path: string;
  /** One-based line number. */
  readonly line: number;
  /** Zero-based column offset of the match start, in UTF-16 code units. */
  readonly column: number;
  /** Length of the matched text, in UTF-16 code units. */
  readonly length: number;
  /** The full text of the matching line, for display. */
  readonly preview: string;
}

/** The outcome of a {@link SearchApi.findInFiles} call. */
export interface SearchResult {
  /** Every match found, in file then line order. */
  readonly matches: readonly SearchMatch[];
  /** Whether the search stopped early because `maxResults` was reached. */
  readonly limitHit: boolean;
}

/**
 * Find files by name and text within files.
 *
 * @example
 * ```ts
 * const paths = await hudhod.search.findFiles("src/**\/*.ts");
 * const { matches } = await hudhod.search.findInFiles("TODO", { include: ["**\/*.ts"] });
 * ```
 */
export interface SearchApi {
  /**
   * Returns absolute paths matching a glob pattern.
   * Honours the workspace exclude settings unless overridden.
   */
  findFiles(include: string, options?: FindFilesOptions): Promise<string[]>;

  /** Searches file contents for `query`. */
  findInFiles(query: string, options?: FindInFilesOptions): Promise<SearchResult>;

  /**
   * Replaces every match of `query` with `replacement`.
   * @returns The number of files modified.
   */
  replaceInFiles(query: string, replacement: string, options?: FindInFilesOptions): Promise<number>;
}
