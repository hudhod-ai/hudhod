# @hudhod/webcontainer

WebContainer adapters for the headless Hudhod runtime.

This package is browser-only. It provides `WebContainerFileSystemProvider`, `WebContainerProcessSpawner`, and `createWebContainerServices()` for use with `createHudhodRuntime()` or `createHudhodReactHost()`.

## Install

```sh
pnpm add @hudhod/webcontainer @hudhod/core @webcontainer/api
```

WebContainers require `SharedArrayBuffer` and cross-origin isolation. Do not import this package from Node or server-rendered code.

## Usage

```ts
import { createHudhodReactHost } from "@hudhod/react";
import { createWebContainerServices } from "@hudhod/webcontainer";

const host = createHudhodReactHost({
  ...createWebContainerServices(container),
  ui: myUiAdapter,
});
```

The package is optional. Desktop, remote, and test hosts can instead supply their own `FileSystemProvider` and `ProcessSpawner` implementations from `@hudhod/core`.
