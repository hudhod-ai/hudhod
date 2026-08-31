/**
 * Glob matching, wrapping picomatch with hudhod's path conventions.
 *
 * @packageDocumentation
 */

import picomatch from "picomatch";

/** Tests a path against a set of glob patterns. */
export type GlobMatcher = (path: string) => boolean;

/** Matches nothing. */
const MATCH_NONE: GlobMatcher = () => false;

/**
 * Compiles glob patterns into a matcher.
 *
 * Patterns are matched against the path **without its leading slash**, so
 * `src/**` and `**\/*.ts` behave the way authors expect. Matching is
 * case-insensitive on the basename only where picomatch defaults apply; dotfiles
 * are matched, unlike shell globbing, because hiding `.env` from a search would
 * be surprising.
 *
 * An empty pattern list yields a matcher that never matches, so callers can
 * treat "no excludes" as "exclude nothing" without a special case.
 *
 * @example
 * ```ts
 * const isExcluded = createMatcher(["**\/node_modules/**"]);
 * isExcluded("/node_modules/react/index"); // true
 * ```
 */
export function createMatcher(patterns: readonly string[]): GlobMatcher {
  if (patterns.length === 0) return MATCH_NONE;

  const isMatch = picomatch([...patterns], {
    dot: true,
  });

  return (path: string) => {
    const relative = path.startsWith("/") ? path.slice(1) : path;
    if (relative.length === 0) return false;
    return isMatch(relative);
  };
}

/**
 * Compiles patterns into a matcher that *inverts* an empty pattern list.
 *
 * Used for include patterns, where "no filter" means "everything".
 */
export function createIncludeMatcher(
  patterns: readonly string[] | undefined,
): GlobMatcher {
  if (!patterns || patterns.length === 0) return () => true;
  return createMatcher(patterns);
}
