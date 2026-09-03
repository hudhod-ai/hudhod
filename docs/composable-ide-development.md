# Composable IDE Development Guide

Hudhod can be assembled into a React IDE from packages rather than by copying application workspace code. A host selects environment adapters, supplies product UI behavior, chooses extensions, and renders the reusable workbench.

## Packages

| Package                | Responsibility                                                         |
| ---------------------- | ---------------------------------------------------------------------- |
| `@hudhod/sdk`          | Public extension API and manifest types.                               |
| `@hudhod/core`         | Headless runtime, services, extension host, and panel/view registries. |
| `@hudhod/react`        | React host factory, React extension helpers, and Dockview workbench.   |
| `@hudhod/webcontainer` | Browser-only WebContainer filesystem and process adapters.             |

`@hudhod/core` must not import React, Dockview, Zustand, or WebContainer. React work belongs in `@hudhod/react`; WebContainer-specific work belongs in `@hudhod/webcontainer`.

## Compose A React IDE

Create the host once for an environment instance, register extensions before activation, and dispose the host when that environment is released.

```tsx
"use client";

import { createHudhodReactHost, HudhodWorkbench, type HudhodReactHost } from "@hudhod/react";
import { createWebContainerServices } from "@hudhod/webcontainer";
import type { WebContainer } from "@webcontainer/api";
import "@hudhod/react/styles.css";

function createIdeHost(container: WebContainer): HudhodReactHost {
  const host = createHudhodReactHost({
    ...createWebContainerServices(container),
    ui: myUiAdapter,
    platform: navigator.platform.includes("Mac") ? "mac" : "other",
  });

  host.registerExtensions([explorerExtension, outlineExtension]);
  void host.extensions.activateByEvent("onStartup");
  return host;
}

export function MyIde({ host }: { host: HudhodReactHost }) {
  return (
    <HudhodWorkbench
      host={host}
      editor={MyEditorPanel}
      initialPanels={["editor", "explorer"]}
      colorMode="light"
    />
  );
}
```

The workbench activates panels and contributed views through the normal `onView:<id>` flow. Registering an extension does not activate it.

Import `@hudhod/react/styles.css` once in the client entry point. It includes Dockview's base
stylesheet and small scoped `.hudhod-*` structural defaults. Tailwind is optional; host-provided
panels, custom activity items, and product UI remain responsible for their own styling.

## UI Adapter

The host receives a `HudhodReactHostUi` adapter. It connects headless extension APIs to product-specific dialogs and editor state.

```ts
const myUiAdapter = {
  showMessage: async (message, severity) => {
    toast(message, { severity });
  },
  showInputBox: (options) => dialogs.input(options),
  showQuickPick: (items, options) => dialogs.pick(items, options),
  openFile: async (path) => editorStore.openFile(path),
  get activeEditor() {
    return editorStore.activeEditor;
  },
  onDidChangeActiveEditor(listener) {
    return editorStore.subscribeActiveEditor(listener);
  },
};
```

The adapter owns product choices: dialogs, notifications, file tabs, and active-editor state. The host owns extension renderer registration and panel/view activation.

## Customize Dockview

`HudhodWorkbench` supplies the extension panel component and its ready lifecycle. Add native panel types through `nativeComponents`, and pass every other supported Dockview React option with `dockviewProps`.

```tsx
<HudhodWorkbench
  host={host}
  editor={MyEditorPanel}
  nativeComponents={{ inspector: InspectorPanel }}
  initialPanels={["editor", "explorer"]}
  getPanelPosition={(panel, api) =>
    panel.id === "inspector" ? { referencePanel: "explorer", direction: "above" } : undefined
  }
  colorMode="dark"
  showPanelHeaders={false}
  onReady={(api) => restoreMyLayout(api)}
  onPanelChange={(panelIds) => saveOpenPanels(panelIds)}
  dockviewProps={{
    disableFloatingGroups: true,
    onDidDrop: (event) => auditPanelDrop(event),
  }}
/>
```

`components` and `onReady` cannot be set inside `dockviewProps`: Hudhod reserves them to keep extension panels and view containers functional. Use the top-level `onReady` callback and `nativeComponents` instead.

Set `showPanelHeaders={false}` to remove Dockview's tab/header strip for that
workbench instance. It does not affect other workbenches or editors.

The host always provides the native `editor` panel. `initialPanels` defaults to `["editor"]`; other ids must be extension-contributed panels or view containers.

Initial panels open sequentially. When `getPanelPosition` references another panel, put that
reference panel earlier in `initialPanels`. Register a panel with `initialWidth` or
`initialHeight` to request its initial Dockview size in CSS pixels:

```tsx
registerReactPanel(context.hudhod, "explorer", ExplorerPanel, {
  title: "Explorer",
  location: "left",
  initialWidth: 280,
});
```

## Customize The Activity Bar

Use the `activityBar` option to control placement and styling without writing selectors that
affect another workbench instance.

```tsx
<HudhodWorkbench
  host={host}
  editor={MyEditorPanel}
  activityBar={{
    position: "right",
    className: "bg-zinc-950 text-zinc-100",
    itemClassName: "text-zinc-400 hover:text-white",
    activeItemClassName: "bg-zinc-800 text-white",
  }}
/>
```

`position` accepts `"left"`, `"right"`, `"top"`, `"bottom"`, and `"hidden"`. For a fully
custom activity item, provide `renderItem`; it receives the contributed panel, its open state, and
an `open()` function.

```tsx
activityBar={{
  renderItem: ({ panel, isOpen, open }) => (
    <MyNavigationItem active={isOpen} label={panel.title} onClick={open} />
  ),
}}
```

For a fully custom shell, render `HudhodActivityBar` directly beside `HudhodWorkbench` or use your
own navigation and call `host.api.window.openPanel(panelId)`.

## Non-WebContainer Hosts

WebContainer is optional. Supply any `FileSystemProvider` and `ProcessSpawner` accepted by `@hudhod/core`:

```ts
const host = createHudhodReactHost({
  fileSystemProvider: myFileSystemProvider,
  processSpawner: myProcessSpawner,
  ui: myUiAdapter,
});
```

This supports desktop, remote, test, or in-memory IDE environments without changing extensions or React workbench code.

## Extensions

Extensions use `@hudhod/sdk` and optionally `@hudhod/react`. See [EXTENSION-DEVELOPMENT.md](EXTENSION-DEVELOPMENT.md) for manifests, contribution points, views, and activation events.

A host owns its extension catalog:

```ts
host.registerExtensions([explorerExtension, outlineExtension, myExtension]);
```

Register every extension before opening default panels. This ensures panel/view metadata is available for the activity bar and lazy activation.

## Lifecycle

1. Create adapters for one runtime environment.
2. Create one `HudhodReactHost`.
3. Register the extension catalog.
4. Mount `HudhodWorkbench`.
5. Dispose the host when the environment is permanently released.

Do not recreate the host on normal React renders. A host may be shared by several React components, so React unmount does not dispose it automatically.
