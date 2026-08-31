/**
 * POSIX-style path utilities.
 *
 * hudhod paths are always absolute and rooted at the workspace root. Keeping a
 * dedicated implementation here — rather than reaching for Node's `path` —
 * means the core runs unchanged in the browser and stays free of platform
 * separator quirks.
 *
 * @packageDocumentation
 */

import { invalidPath } from "./errors";

/** The workspace root. */
export const ROOT = "/";

/**
 * Normalises a path: collapses duplicate slashes, resolves `.` and `..`, and
 * strips any trailing slash.
 *
 * @throws An `InvalidPath` error when the path is relative, empty, or traverses
 * above the workspace root.
 *
 * @example
 * ```ts
 * normalizePath("/src//lib/../index.ts"); // "/src/index.ts"
 * ```
 */
export function normalizePath(path: string): string {
  if (typeof path !== "string" || path.length === 0) {
    throw invalidPath(String(path), "path must be a non-empty string");
  }
  if (path.includes("\0")) {
    throw invalidPath(path, "path must not contain null bytes");
  }
  if (!path.startsWith("/")) {
    throw invalidPath(path, "path must be absolute");
  }

  const resolved: string[] = [];
  for (const segment of path.split("/")) {
    if (segment === "" || segment === ".") continue;
    if (segment === "..") {
      if (resolved.length === 0) {
        throw invalidPath(path, "path escapes the workspace root");
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return resolved.length === 0 ? ROOT : `/${resolved.join("/")}`;
}

/**
 * Joins segments onto a base path and normalises the result.
 *
 * @example
 * ```ts
 * joinPath("/src", "lib", "index.ts"); // "/src/lib/index.ts"
 * ```
 */
export function joinPath(base: string, ...segments: string[]): string {
  const suffix = segments.filter((segment) => segment.length > 0).join("/");
  return normalizePath(suffix.length === 0 ? base : `${base}/${suffix}`);
}

/**
 * Returns the parent directory. The root is its own parent.
 *
 * @example
 * ```ts
 * dirname("/src/index.ts"); // "/src"
 * dirname("/");             // "/"
 * ```
 */
export function dirname(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === ROOT) return ROOT;
  const index = normalized.lastIndexOf("/");
  return index <= 0 ? ROOT : normalized.slice(0, index);
}

/**
 * Returns the final segment. The root has an empty basename.
 *
 * @example
 * ```ts
 * basename("/src/index.ts"); // "index.ts"
 * ```
 */
export function basename(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === ROOT) return "";
  return normalized.slice(normalized.lastIndexOf("/") + 1);
}

/**
 * Returns the lowercased extension including the leading dot, or an empty
 * string when there is none.
 *
 * A leading dot marks a hidden file rather than an extension, so `.gitignore`
 * has no extension.
 *
 * @example
 * ```ts
 * extname("/src/App.TSX");  // ".tsx"
 * extname("/.gitignore");   // ""
 * ```
 */
export function extname(path: string): string {
  const name = basename(path);
  const index = name.lastIndexOf(".");
  if (index <= 0) return "";
  return name.slice(index).toLowerCase();
}

/**
 * Expresses `path` relative to `from`, without a leading slash.
 *
 * @example
 * ```ts
 * relativePath("/src", "/src/lib/a.ts"); // "lib/a.ts"
 * ```
 */
export function relativePath(from: string, path: string): string {
  const base = normalizePath(from);
  const target = normalizePath(path);
  if (base === ROOT) return target.slice(1);
  if (target === base) return "";
  if (target.startsWith(`${base}/`)) return target.slice(base.length + 1);
  return target.slice(1);
}

/**
 * Whether `path` is `parent` or sits underneath it.
 *
 * Compares whole segments, so `/src` does not contain `/src-old`.
 *
 * @example
 * ```ts
 * isSubPath("/src", "/src/a.ts");  // true
 * isSubPath("/src", "/src-old");   // false
 * ```
 */
export function isSubPath(parent: string, path: string): boolean {
  const base = normalizePath(parent);
  const target = normalizePath(path);
  if (base === target) return true;
  if (base === ROOT) return true;
  return target.startsWith(`${base}/`);
}

/**
 * Splits a path into its segments. The root yields an empty array.
 *
 * @example
 * ```ts
 * pathSegments("/src/lib/a.ts"); // ["src", "lib", "a.ts"]
 * ```
 */
export function pathSegments(path: string): string[] {
  const normalized = normalizePath(path);
  return normalized === ROOT ? [] : normalized.slice(1).split("/");
}
