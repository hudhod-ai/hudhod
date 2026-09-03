/**
 * The diff service.
 *
 * Wraps `jsdiff` so the rest of hudhod depends on hudhod types rather than a
 * third-party shape, which keeps the library swappable.
 *
 * @packageDocumentation
 */

import { applyPatch, createTwoFilesPatch, diffArrays, diffLines } from "diff";

import type { DiffApi, DiffChange, DiffOptions, DiffStat } from "@hudhod/sdk";

import { createError } from "../base/errors";
import type { FileSystemService } from "../fs/file-system-service";

/** Default lines of context in a unified patch. */
const DEFAULT_CONTEXT = 3;

/**
 * Compares text and applies patches.
 *
 * @example
 * ```ts
 * const diff = new DiffService(fs);
 * const patch = await diff.createPatch("/a.ts", before, after);
 * await diff.applyPatch("/a.ts", patch);
 * ```
 */
export class DiffService implements DiffApi {
  readonly #fs: FileSystemService;

  constructor(fileSystem: FileSystemService) {
    this.#fs = fileSystem;
  }

  async diffText(
    original: string,
    modified: string,
    options: DiffOptions = {},
  ): Promise<DiffChange[]> {
    const parts = options.ignoreCase
      ? diffArrays(splitLines(original), splitLines(modified), {
          comparator: (left, right) => left.toLowerCase() === right.toLowerCase(),
        })
      : diffLines(original, modified, {
          ignoreWhitespace: options.ignoreWhitespace ?? false,
        });

    const changes: DiffChange[] = [];
    for (const part of parts) {
      const lines = Array.isArray(part.value) ? part.value : splitLines(part.value);
      // jsdiff can emit an empty trailing part; it carries no information.
      if (lines.length === 0) continue;
      changes.push({
        type: part.added ? "added" : part.removed ? "removed" : "unchanged",
        lines,
      });
    }
    return changes;
  }

  async diffFiles(
    originalPath: string,
    modifiedPath: string,
    options: DiffOptions = {},
  ): Promise<DiffChange[]> {
    const [original, modified] = await Promise.all([
      this.#fs.readTextFile(originalPath),
      this.#fs.readTextFile(modifiedPath),
    ]);
    return this.diffText(original, modified, options);
  }

  async diffStat(original: string, modified: string, options: DiffOptions = {}): Promise<DiffStat> {
    const changes = await this.diffText(original, modified, options);

    let added = 0;
    let removed = 0;
    for (const change of changes) {
      if (change.type === "added") added += change.lines.length;
      if (change.type === "removed") removed += change.lines.length;
    }
    return { added, removed };
  }

  async createPatch(
    path: string,
    original: string,
    modified: string,
    options: DiffOptions = {},
  ): Promise<string> {
    return createTwoFilesPatch(path, path, original, modified, undefined, undefined, {
      context: options.context ?? DEFAULT_CONTEXT,
      ignoreWhitespace: options.ignoreWhitespace ?? false,
    });
  }

  /**
   * Applies a unified diff to a file.
   *
   * @throws A `PatchFailed` error when the patch does not apply cleanly, which
   * usually means the file changed after the patch was produced.
   */
  async applyPatch(path: string, patch: string): Promise<void> {
    const original = await this.#fs.readTextFile(path);
    const result = applyPatch(original, patch);

    if (result === false) {
      throw createError("PatchFailed", `Patch did not apply cleanly to ${path}`, { path });
    }

    await this.#fs.writeTextFile(path, result);
  }
}

/**
 * Splits a jsdiff chunk into lines, dropping the artefact empty string that a
 * trailing newline produces.
 */
function splitLines(value: string): string[] {
  if (value === "") return [];
  const lines = value.split("\n");
  if (lines.at(-1) === "") lines.pop();
  return lines;
}
