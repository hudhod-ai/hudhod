/**
 * The search service.
 *
 * Walks the workspace through {@link FileSystemService}, so it works against
 * any provider and needs no separate index. At the scale hudhod targets
 * (hundreds of files, not hundreds of thousands) a direct walk is faster than
 * maintaining an index, and it can never go stale.
 *
 * @packageDocumentation
 */

import type {
  FindFilesOptions,
  FindInFilesOptions,
  SearchApi,
  SearchMatch,
  SearchResult,
} from "@hudhod/sdk";

import { createIncludeMatcher, createMatcher } from "../base/glob";
import type { GlobMatcher } from "../base/glob";
import type { FileSystemService } from "../fs/file-system-service";

/** Default cap on results, matching the SDK documentation. */
const DEFAULT_MAX_RESULTS = 1000;

/** Characters with special meaning in a regular expression. */
const REGEX_SPECIAL = /[.*+?^${}()|[\]\\]/g;

/** Escapes a literal string for safe use inside a regular expression. */
function escapeRegExp(value: string): string {
  return value.replace(REGEX_SPECIAL, "\\$&");
}

/**
 * Builds the matcher used to scan file contents.
 *
 * Always global, so every match on a line is found rather than just the first.
 *
 * @throws A `TypeError` when `isRegex` is set and the pattern is malformed.
 */
function buildQueryRegExp(query: string, options: FindInFilesOptions): RegExp {
  const source = options.isRegex ? query : escapeRegExp(query);
  const pattern = options.wholeWord ? `\\b(?:${source})\\b` : source;
  const flags = options.caseSensitive ? "g" : "gi";
  return new RegExp(pattern, flags);
}

/**
 * Finds files and searches their contents.
 *
 * @example
 * ```ts
 * const search = new SearchService(fs);
 * const paths = await search.findFiles("src/**\/*.ts");
 * const { matches } = await search.findInFiles("TODO");
 * ```
 */
export class SearchService implements SearchApi {
  readonly #fs: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.#fs = fileSystem;
  }

  async findFiles(include: string, options: FindFilesOptions = {}): Promise<string[]> {
    const isIncluded = createMatcher([include]);
    const isExcluded = createMatcher(options.exclude ?? this.#fs.config.searchExclude);
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;

    const found: string[] = [];
    await this.#walk(this.#fs.config.rootPath, isExcluded, options, (path) => {
      if (!isIncluded(path)) return true;
      found.push(path);
      return found.length < maxResults;
    });
    return found;
  }

  async findInFiles(query: string, options: FindInFilesOptions = {}): Promise<SearchResult> {
    if (query.length === 0) return { matches: [], limitHit: false };

    const isIncluded = createIncludeMatcher(options.include);
    const isExcluded = createMatcher(options.exclude ?? this.#fs.config.searchExclude);
    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    const pattern = buildQueryRegExp(query, options);

    const matches: SearchMatch[] = [];
    let limitHit = false;

    await this.#walk(this.#fs.config.rootPath, isExcluded, options, async (path) => {
      if (!isIncluded(path)) return true;

      const contents = await this.#readSearchable(path);
      if (contents === undefined) return true;

      for (const match of matchesIn(path, contents, pattern)) {
        matches.push(match);
        if (matches.length >= maxResults) {
          limitHit = true;
          return false;
        }
      }
      return true;
    });

    return { matches, limitHit };
  }

  async replaceInFiles(
    query: string,
    replacement: string,
    options: FindInFilesOptions = {},
  ): Promise<number> {
    const { matches } = await this.findInFiles(query, options);
    const paths = [...new Set(matches.map((match) => match.path))];
    const pattern = buildQueryRegExp(query, options);

    for (const path of paths) {
      const contents = await this.#fs.readTextFile(path);
      // Reset between files; a global regex carries lastIndex across calls.
      pattern.lastIndex = 0;
      await this.#fs.writeTextFile(path, contents.replace(pattern, replacement));
    }

    return paths.length;
  }

  /**
   * Reads a file for searching, skipping anything unsuitable.
   *
   * Returns `undefined` for files that are too large or that appear to be
   * binary, so the caller can move on without special-casing either.
   */
  async #readSearchable(path: string): Promise<string | undefined> {
    const stat = await this.#fs.stat(path);
    if (stat.size > this.#fs.config.maxSearchFileBytes) return undefined;

    const contents = await this.#fs.readTextFile(path);
    // A null byte in the first block is the usual binary heuristic.
    if (contents.slice(0, 8000).includes("\0")) return undefined;
    return contents;
  }

  /**
   * Depth-first walk of every file beneath `directory`.
   *
   * `visit` returns `false` to stop the walk early. Directories matched by
   * `isExcluded` are skipped whole, so excluding `node_modules` costs one check
   * rather than a traversal of everything inside it.
   */
  async #walk(
    directory: string,
    isExcluded: GlobMatcher,
    options: FindFilesOptions,
    visit: (path: string) => boolean | Promise<boolean>,
  ): Promise<boolean> {
    if (options.token?.isCancellationRequested) return false;

    let entries;
    try {
      // Deliberately unfiltered: `filesExclude` governs the file tree, while
      // search obeys `searchExclude` and its own per-call overrides.
      entries = await this.#fs.listDirectory(directory, {
        applyExcludes: false,
      });
    } catch {
      // A directory removed mid-walk should not fail the whole search.
      return true;
    }

    for (const entry of entries) {
      if (options.token?.isCancellationRequested) return false;
      if (isExcluded(entry.path)) continue;

      if (entry.type === "directory") {
        const shouldContinue = await this.#walk(entry.path, isExcluded, options, visit);
        if (!shouldContinue) return false;
        continue;
      }

      if (!(await visit(entry.path))) return false;
    }

    return true;
  }
}

/** Yields every match of `pattern` in `contents`, with line and column. */
function* matchesIn(path: string, contents: string, pattern: RegExp): Generator<SearchMatch> {
  const lines = contents.split("\n");

  for (const [index, line] of lines.entries()) {
    // Each line gets a fresh scan; lastIndex must not leak between lines.
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(line)) !== null) {
      yield {
        path,
        line: index + 1,
        column: match.index,
        length: match[0].length,
        preview: line,
      };

      // A zero-width match would otherwise loop forever.
      if (match[0].length === 0) pattern.lastIndex += 1;
    }
  }
}
