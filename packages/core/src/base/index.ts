/**
 * Base primitives shared by every hudhod service.
 *
 * @packageDocumentation
 */

export {
  CancellationTokenNone,
  CancellationTokenSource,
  tokenFromAbortSignal,
} from "./cancellation";
export { DisposableStore, NO_OP_DISPOSABLE, toDisposable } from "./disposable";
export {
  createError,
  directoryNotEmpty,
  fileExists,
  fileNotFound,
  invalidPath,
  notADirectory,
  notAFile,
} from "./errors";
export type { HudhodErrorDetails } from "./errors";
export { Emitter } from "./event";
export {
  ROOT,
  basename,
  dirname,
  extname,
  isSubPath,
  joinPath,
  normalizePath,
  pathSegments,
  relativePath,
} from "./paths";
