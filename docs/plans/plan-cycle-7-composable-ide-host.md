# Cycle 7 of N: Composable IDE host packages

> Follow-on to `plans/plan-cycle-6-view-containers-and-views.md`.

## Goal

Make it practical to build a new Hudhod IDE without copying `components/ide/IdeWorkspace.tsx`.
A consuming app should compose a runtime, choose extensions, provide a file/process adapter, and
render the reusable React workbench. It must not need to know about `WindowService`, registry
subscriptions, dynamic Dockview panel definitions, renderer stores, or extension activation order.

This cycle packages existing architecture; it does not add a new extension contribution type or
replace the current application's product-specific features.

## Target developer experience

A new React host can be assembled from packages like this:

```tsx
import { HudhodWorkbench, createHudhodReactHost } from "@hudhod/react";
import { createWebContainerServices } from "@hudhod/webcontainer";

const host = createHudhodReactHost({
  services: createWebContainerServices(container),
  extensions: [explorerExtension, outlineExtension, myExtension],
  initialPanels: ["explorer"],
});

return <HudhodWorkbench host={host} editor={MyEditor} />;
```

The final API names are illustrative. The important contract is that a host chooses its adapters,
extensions, initial layout, and native editor component without reimplementing workbench plumbing.

## Package boundaries

### `@hudhod/sdk`

Remains the public contract for extension authors. No React, Dockview, WebContainer, or app state.

### `@hudhod/core`

Remains headless and environment-agnostic. It owns service implementations, `PanelRegistry`,
`ViewRegistry`, `InProcessExtensionHost`, and `WindowService`, but does not construct a browser UI
provider or import WebContainer types.

Add a small runtime composition factory only if it can accept all environment dependencies as
interfaces. It must not import React, Zustand, Dockview, or WebContainer.

### `@hudhod/react`

Owns all reusable React code:

- React context/hooks for a workspace host.
- Renderer registration stores for panels and views.
- The `WindowUiProvider` implementation supplied to `WindowService`.
- Dockview workbench components: activity bar, panel tab, extension renderer mount, and view
  container accordion host.
- Workspace lifecycle and registry synchronization hooks.

`dockview-react`, React, React DOM, and Zustand become peer dependencies or direct dependencies
according to package publishing policy. The package must not import application aliases (`@/`) or
project-specific UI components.

The existing `registerReactPanel` and `registerReactView` remain stable public APIs.

### `@hudhod/webcontainer` (new)

Owns `WebContainerFileSystemProvider`, `WebContainerProcessSpawner`, and the WebContainer boot /
mount helpers needed to connect the runtime to an in-browser container. This replaces the
`@hudhod/core/webcontainer` export over time.

It depends on `@hudhod/core` and has `@webcontainer/api` as a peer dependency. It contains no
React components or product UI.

### Application

Keeps product policy and product UI only:

- Supabase project/version persistence.
- Starter tree selection.
- project-specific editor, preview, logs, terminal, dialogs, and styling.
- extension catalog and initial layout decisions.
- product actions such as Save Version and Export Files.

`IdeWorkspace` should become a thin application shell that loads persistence state, creates an
adapter-backed host, passes configuration to `HudhodWorkbench`, and renders product toolbar items.

## Decisions to settle before implementation

1. **Workbench scope:** `@hudhod/react` owns the generic Dockview layout and activity bar. The host
   supplies native panel components such as the editor. This is the intended default because panel
   and view contribution rendering is already coupled to Dockview.
2. **UI primitives:** the reusable package receives component slots for dialogs, toolbar, icons, and
   native panels rather than depending on this app's shadcn components or Tailwind styles.
3. **Workspace lifetime:** callers create and dispose a `HudhodReactHost` explicitly. A React hook
   may assist, but React unmount must not implicitly dispose a shared workspace unless configured.
4. **Extension catalog:** the host accepts a readonly extension array. Registration happens exactly
   once before `onStartup`; no extension is hardcoded inside reusable components.
5. **Default layout:** configuration specifies initial panel ids. The workbench invokes the normal
   lazy activation/open flow rather than opening a panel directly.
6. **Migration compatibility:** retain `@hudhod/core/webcontainer` as a deprecated forwarding export
   for one release, then remove it in a breaking release.

## Implementation phases

### 1. Define headless runtime assembly in core

- Extract the current `HudhodWorkspaceRuntime` service construction into a framework-free factory
  that accepts a file-system provider, process spawner, and `WindowUiProvider`.
- Return the typed API, registries, services, extension host, and idempotent `dispose()`.
- Move app-specific `as any` stubs behind deliberate optional service interfaces or leave those
  services outside the factory until implemented.
- Unit test construction, disposal order, extension metadata registration, and no browser imports.

### 2. Extract WebContainer adapter package

- Create `packages/webcontainer` with package metadata, build configuration, and public exports.
- Move WebContainer filesystem/process adapters from `@hudhod/core/webcontainer`.
- Export a narrow adapter factory that returns the dependencies the core runtime factory accepts.
- Update the application to import this package.
- Keep a compatibility re-export from core during migration.

### 3. Build the React host in `@hudhod/react`

- Move renderer stores, `ExtensionRendererMount`, `ViewContainerHost`, and the generic Dockview
  panel registry out of app aliases into the package.
- Expose `HudhodReactHost`, `createHudhodReactHost`, `HudhodWorkbenchProvider`, and hooks for
  workspace/panel/view state.
- Make `createWindowUiProvider` configurable through callbacks or slots, so the package does not
  import toast/dialog/file stores from this app.
- Keep each renderer in a dedicated DOM node and preserve async cleanup protection.
- Add component tests for panel fallback, multi-view accordion behavior, collapse state, and lazy
  view activation.

### 4. Make the workbench configurable

- Export `HudhodWorkbench`, accepting component slots for native editor and window UI.
- Export optional building blocks (`ActivityBar`, `DockviewLayout`, `ViewContainerHost`) for hosts
  that want a custom shell.
- Use a configuration object for icons, initial layout, and dockview theme rather than importing
  this application's icon set or CSS.
- Document required CSS imports and peer dependencies.

### 5. Migrate this application

- Move built-in panel renderers/extensions into an explicit application extension catalog.
- Replace manual workspace store synchronization and `window-bridge.ts` with the React host.
- Reduce `IdeWorkspace` to project load/save/restore, WebContainer boot, host configuration, and
  product toolbar rendering.
- Preserve current URLs, project persistence, Reset Layout, and lazy extension behavior.

### 6. Documentation and example

- Add a minimal example app or fixture that composes an IDE using only package imports.
- Document adapter authoring and the distinction between native components, panel extensions, and
  view extensions.
- Provide a migration guide from direct `HudhodWorkspaceRuntime` construction.

## Verification

1. `pnpm typecheck`, `pnpm test`, and `pnpm packages:build` pass for all packages.
2. A package-only fixture creates a runtime, registers a panel and cross-extension view, and renders
   them without importing any app-layer file.
3. This application behaves identically after migration: explorer + outline accordion, lazy
   activation, sidebar exclusivity, editor, preview, logs, terminal, project load/save, and Reset
   Layout.
4. A second minimal host can use a fake filesystem/process adapter, proving WebContainer is optional.
5. `@hudhod/core` output contains no React, Dockview, Zustand, or WebContainer runtime dependency.

## Out of scope

- Marketplace extension loading, sandboxing, or remote extension hosts.
- Redesigning the current editor, persistence model, or visual theme.
- Persisted Dockview layout and view collapse state.
- Converting every application component into a package component.
