/**
 * WebContainer adapters for `@hudhod/core`.
 *
 * **Browser only.** `@webcontainer/api` requires `SharedArrayBuffer` and
 * cross-origin isolation, so it cannot be imported in Node. Keeping these
 * behind a dedicated entry point is what lets the main `@hudhod/core` module —
 * and therefore the whole test suite — run without a browser.
 *
 * @packageDocumentation
 */

export { WebContainerFileSystemProvider } from "./file-system-provider";
export { WebContainerProcessSpawner } from "./process-spawner";
