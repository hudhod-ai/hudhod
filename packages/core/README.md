# @hudhod/core

The headless runtime behind [hudhod](../../README.md), an in-browser IDE built on
WebContainers.

This package implements the API described by
[`@hudhod/sdk`](../sdk/README.md): file system, search, diff, process, command,
and extension-host services. It contains **no UI and no framework code** — no
React, no state library — so it can be driven by any front end and unit tested in
plain Node.

## Install

```bash
pnpm add @hudhod/core @hudhod/sdk
```

Use `@hudhod/webcontainer` when a browser host needs WebContainer adapters.

## Entry points

| Import                 | Environment | Contents                                     |
| ---------------------- | ----------- | -------------------------------------------- |
| `@hudhod/core`         | Any         | Services, runtime factory, extension host    |
| `@hudhod/webcontainer` | Browser     | WebContainer filesystem and process adapters |

The split is deliberate. `@webcontainer/api` requires `SharedArrayBuffer` and
cross-origin isolation, so it cannot load in Node. Keeping those adapters in a
separate package means the main entry stays importable from tests, scripts, and
server code — which is what makes the runtime testable without a browser.

```ts
// Safe anywhere.
import { DisposableStore, Emitter } from "@hudhod/core";

// Browser only.
import { createWebContainerServices } from "@hudhod/webcontainer";
```

## Base primitives

### `Disposable` and `DisposableStore`

Every subscription returns a `Disposable`. `DisposableStore` collects them and
releases them together, newest-first:

```ts
import { DisposableStore, toDisposable } from "@hudhod/core";

const store = new DisposableStore();
store.add(emitter.event(handler));
store.add(toDisposable(() => socket.close()));
store.dispose();
```

Two behaviours are worth knowing:

- Adding to an already-disposed store **disposes the argument immediately**, so
  a late registration cannot leak.
- If one disposable throws, the rest still run; the failures are collected and
  rethrown together as an `AggregateError`.

### `Emitter`

The `Event<T>` producer:

```ts
import { Emitter } from "@hudhod/core";

const emitter = new Emitter<string>();
const sub = emitter.event((name) => console.log(name));
emitter.fire("world");
sub.dispose();
```

`fire()` iterates a snapshot of the listener set, so subscribing or
unsubscribing during dispatch cannot disturb the in-flight delivery. A throwing
listener is reported to `onListenerError` rather than propagating to whoever
called `fire()` — a producer usually cannot do anything useful about a
consumer's bug.

### `CancellationTokenSource`

```ts
import { CancellationTokenSource } from "@hudhod/core";

const source = new CancellationTokenSource();
const results = await search(query, source.token);
source.cancel();
```

Listeners registered _after_ cancellation are invoked immediately, so a late
subscriber cannot miss the signal. `tokenFromAbortSignal()` adapts a standard
`AbortSignal` if you already have one.

### Paths

hudhod paths are always absolute and POSIX-style, rooted at the workspace root.
These helpers are deliberately independent of Node's `path` so behaviour is
identical in the browser and free of platform separator quirks.

```ts
import { basename, dirname, isSubPath, joinPath, normalizePath } from "@hudhod/core";

normalizePath("/src//lib/../index.ts"); // "/src/index.ts"
joinPath("/src", "lib", "index.ts"); // "/src/lib/index.ts"
isSubPath("/src", "/src-old"); // false — whole segments only
```

`normalizePath()` throws `InvalidPath` for relative paths, null bytes, and any
path traversing above the root. Every service normalises its inputs, so path
traversal is rejected at the boundary rather than reaching the file system.

### Errors

```ts
import { fileNotFound } from "@hudhod/core";

throw fileNotFound("/missing.ts"); // code: "FileNotFound", path: "/missing.ts"
```

Consumers should branch on `error.code` via `isHudhodError()` from
`@hudhod/sdk`. Message text is not part of the contract.

## Extensions

`InProcessExtensionHost` loads the curated, first-party extension modules used
by hudhod. It validates each manifest with Zod before registration, supports
`onStartup`, `onCommand:*`, `onFileOpen:*`, and `onView:*` activation events,
and automatically disposes resources pushed onto `context.subscriptions` when
an extension deactivates.

```ts
import { createHudhodRuntime } from "@hudhod/core";

const runtime = createHudhodRuntime({
  fileSystemProvider,
  processSpawner,
  windowUiProvider,
});
runtime.extensions.register(extension);
await runtime.extensions.activateByEvent("onStartup");
```

Concurrent activation triggers are deduplicated, so an extension's `activate()`
hook runs once even if a view and command arrive together.

For a React/Dockview host, use `createHudhodReactHost()` and `HudhodWorkbench`
from `@hudhod/react`. See [COMPOSABLE-IDE-DEVELOPMENT.md](../../COMPOSABLE-IDE-DEVELOPMENT.md).

## Development

```bash
pnpm test          # run the suite
pnpm test:watch    # watch mode
pnpm test:coverage # coverage, enforced at 80%
pnpm typecheck
```

Tests run in Node against the in-memory file system provider — no browser and no
WebContainer required.

## License

MIT
