import { describe, expect, it } from "vitest";

import * as core from "./index";

describe("@hudhod/core public runtime API", () => {
  it("exposes the intentional headless service surface", () => {
    expect(Object.keys(core).sort()).toEqual([
      "CancellationTokenNone",
      "CancellationTokenSource",
      "CommandRegistry",
      "DEFAULT_EXEC_TIMEOUT_MS",
      "DEFAULT_FILES_EXCLUDE",
      "DEFAULT_MAX_OUTPUT_BYTES",
      "DEFAULT_SEARCH_EXCLUDE",
      "DEFAULT_SNAPSHOT_EXCLUDE",
      "DEFAULT_WATCHER_EXCLUDE",
      "DiffService",
      "DisposableStore",
      "Emitter",
      "FakeProcessSpawner",
      "FileSystemService",
      "InMemoryFileSystemProvider",
      "InProcessExtensionHost",
      "NO_OP_DISPOSABLE",
      "ProcessService",
      "ROOT",
      "SearchService",
      "ServiceRegistry",
      "basename",
      "createError",
      "createServiceIdentifier",
      "createWorkspaceConfig",
      "directoryNotEmpty",
      "dirname",
      "extensionManifestSchema",
      "extname",
      "fileExists",
      "fileNotFound",
      "invalidPath",
      "isSubPath",
      "joinPath",
      "normalizePath",
      "notADirectory",
      "notAFile",
      "parseExtensionManifest",
      "pathSegments",
      "relativePath",
      "toDisposable",
      "tokenFromAbortSignal",
    ]);
  });
});
