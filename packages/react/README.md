# @hudhod/react

React bindings and a minimally styled Dockview workbench for Hudhod IDE hosts.

This package is optional. `@hudhod/core` remains the headless runtime; `@hudhod/react` provides React panel/view helpers, `HudhodReactHost`, and `HudhodWorkbench`.

## Install

Install the package with its peer dependencies:

```sh
pnpm add @hudhod/react @hudhod/core @hudhod/sdk react react-dom dockview-react lucide-react
```

Import the package stylesheet once from a client entry point or global stylesheet:

```ts
import "@hudhod/react/styles.css";
```

The stylesheet includes Dockview's required base CSS and small scoped `.hudhod-*` workbench defaults. It does not require Tailwind or impose an application theme, editor, or toolbar.

## Compose a workbench

```tsx
import { createHudhodReactHost, HudhodWorkbench } from "@hudhod/react";
import { FakeProcessSpawner, InMemoryFileSystemProvider } from "@hudhod/core";

const host = createHudhodReactHost({
  fileSystemProvider: new InMemoryFileSystemProvider(),
  processSpawner: new FakeProcessSpawner(),
  ui: myUiAdapter,
});

host.registerExtensions([myExtension]);

export function MyIde() {
  return <HudhodWorkbench host={host} editor={MyEditorPanel} />;
}
```

Create the host once for each runtime environment, then dispose it when the environment is permanently released.

## UI adapter

The `ui` adapter connects headless extension APIs to application UI and editor state:

```ts
const myUiAdapter = {
  showMessage: async (message) => toast(message),
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

## Customize the workbench

```tsx
<HudhodWorkbench
  host={host}
  editor={MyEditorPanel}
  initialPanels={["editor", "explorer"]}
  showPanelHeaders={false}
  activityBar={{
    position: "left",
    renderItem: ({ panel, isOpen, open }) => (
      <MyNavigationItem panel={panel} active={isOpen} onClick={open} />
    ),
  }}
  getPanelPosition={(panel) =>
    panel.id === "bookmarks" ? { referencePanel: "explorer", direction: "below" } : undefined
  }
  dockviewProps={{ disableFloatingGroups: true }}
/>
```

`dockviewProps` forwards Dockview React options except `components` and `onReady`, which are reserved for extension panel/view hosting. Use `nativeComponents` for native panel renderers and the top-level `onReady` callback for direct Dockview access.

Use `HudhodActivityBar` directly when a host needs a fully custom shell.

## React extensions

Use `registerReactPanel` for a panel and `registerReactView` for a view body. Both use an isolated React root and provide `useHudhod()` context.

```tsx
context.subscriptions.push(
  registerReactView(context.hudhod, "acme.outline", OutlineView, {
    title: "Outline",
  }),
);
```

See `COMPOSABLE-IDE-DEVELOPMENT.md` and `EXTENSION-DEVELOPMENT.md` in the repository for host and extension architecture.
