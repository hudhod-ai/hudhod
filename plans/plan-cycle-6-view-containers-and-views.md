# Cycle 6 of N: View containers and views (the second contribution level)

> Starts the "Sidebar View Containers" initiative, a follow-on to the completed "Built-in Panels as
> First-Party Extensions" initiative — see `plans/plan-cycle-1-panel-core-and-react-pkg.md`,
> `plans/plan-cycle-2-runtime-panel-plumbing.md`, `plans/plan-cycle-3-example-extension-docs.md`,
> `plans/plan-cycle-4-panel-icons.md`, `plans/plan-cycle-5-convert-builtin-panels-to-extensions.md`.

## Prerequisite

Cycles 1–5 are done and verified. Specifically this cycle assumes: `PanelRegistry` +
`InProcessExtensionHost` exist and register manifest contributions before activation (Cycle 2);
`PanelContribution.icon` flows through to `ActivityBar` (Cycle 4); `explorer`/`logs`/`terminal`/
`preview` are extensions and `ActivityBar` is a single loop (Cycle 5).

## Goal of this cycle

Introduce the second level of VS Code's contribution model. Today hudhod has exactly one concept —
a panel — which is simultaneously an activity-bar entry, a dock slot, and a single renderer. VS Code
splits this in two:

- **View containers** — the activity bar icons (Explorer, Search, Source Control). Opening one
  replaces whatever else occupies that dock. This is what hudhod's `PanelContribution` already is.
- **Views** — the collapsible accordion sections *inside* a container. VS Code's Explorer container
  holds the file tree plus `Outline`, `Timeline`, `NPM Scripts`, and anything an extension
  contributes into it.

By the end of this cycle an extension can contribute a view **into an existing container it does not
own** — e.g. an `outline` view that stacks underneath the file tree inside the `explorer` container —
and the workbench renders the container as an accordion of its views.

This cycle does **not** convert the file tree, logs, terminal, or preview into views. They stay
single-view containers and must look and behave exactly as they do today (see decision 1).

## Current-state facts confirmed by review (re-check before editing)

- `PanelContribution` (`packages/sdk/src/extension.ts`) is `{ id, title, icon?: unknown, location? }`.
  There is no notion of one panel belonging to another, and no `order`.
- `PanelRegistry` (`packages/core/src/panels/panel-registry.ts`) keys a **stack** per id (last
  registration wins, disposing restores the previous) and `getPanels()` returns the top of each
  stack **sorted by `id.localeCompare`**. That sort is why Cycle 5 changed the `ActivityBar` order
  to alphabetical. Views must **not** inherit this sort — section order inside a container is
  author-visible and must be explicit (decision 6).
- `InProcessExtensionHost.register()` registers `contributes.panels` into `PanelRegistry` **before**
  activation, so the catalog is complete before any extension code runs. Any new contribution point
  must be registered in the same place, or lazy activation breaks.
- `WindowService` (`packages/core/src/window/window-service.ts`) is a pure delegator to
  `WindowUiProvider`. Adding one method to the window API therefore means editing **four** files:
  `WindowApi` (sdk), `WindowUiProvider` (core), `WindowService` (core), and
  `createWindowUiProvider` (`lib/hudhod/window-bridge.ts`). Budget for that; it is easy to miss one
  and get a confusing structural type error.
- `useExtensionPanelStore` (`store/useExtensionPanelStore.ts`) is a flat `Map<string, { render,
  options }>`; `unregisterRenderer` deletes with **no stack restore**, unlike `PanelRegistry`. A
  view store must decide deliberately whether to mirror the flat map or the stack.
- `ExtensionPanelHost` (`components/dockview/panels/ExtensionPanelHost.tsx`) mounts exactly **one**
  renderer, looked up by `props.api.id`, into a freshly created child `div` per mount. The child div
  exists because `registerReactPanel` defers `root.unmount()` via `queueMicrotask`, so StrictMode's
  double-effect would otherwise call `createRoot` twice on the same node. **Any multi-renderer host
  must keep one dedicated DOM node per renderer** or that bug returns, multiplied by the number of
  views.
- `openExtensionPanel` (`lib/hudhod/window-bridge.ts`) activates `onView:<id>`, builds and registers
  a dynamic panel definition, opens it, then — for `left`/`right`, per `EXCLUSIVE_LOCATIONS` —
  closes every other open panel at the same location. This eviction runs **after** the open so the
  incoming panel joins the outgoing one's Dockview group and inherits its width.
- `ActivityBar` (`components/ide/ActivityBar.tsx`) is a single loop over
  `useHudhodWorkspaceStore`'s `panels`, which is `PanelRegistry.getPanels()`.
- Activation events are `onView:<panelId>` (`packages/sdk/src/extension.ts`). Nothing fires them
  spontaneously; the host only checks them inside `openPanel`/`activateByEvent`.
- `packages/core/src/extensions/manifest.ts` validates `contributes.panels` with zod and has a
  `superRefine` enforcing unique panel ids. Extensions are first-party TS objects, so `z.unknown()`
  for opaque values is already the established precedent (Cycle 4's `icon`).
- Existing extensions: four in-tree at `lib/hudhod/builtin-extensions/*` plus the packaged
  `@hudhod/extension-outline`. The latter is currently a **container** (its own activity bar icon
  that replaces Explorer), which is the `Search` analogue, not VS Code's `Outline`.

## Decisions settled up front

1. **`contributes.panels` stays, as sugar for "a container holding one default view."** Do not
   migrate the four built-ins to the new contribution points in this cycle. A manifest declaring
   `panels: [{ id: "logs", ... }]` must keep producing exactly today's behavior. This keeps the
   cycle additive: nothing from Cycles 1–5 gets rewritten, and the risky part (accordion rendering)
   is exercised only by opt-in consumers. Revisit converting the built-ins in a later cycle, once
   the views layer has proven itself.
2. **Views get their own `ViewRegistry` in core, mirroring `PanelRegistry`.** Same stack-per-id
   semantics, same `onDidChange` emitter, same "metadata registered at `register()` time, renderers
   arrive on activation" split. Do not overload `PanelRegistry` with a nullable `container` field —
   the two have different sort rules (decision 6) and different lifetimes, and one registry serving
   both would make `getPanels()` ambiguous about whether it returns containers, views, or both.
3. **The host owns accordion chrome; extensions supply body renderers only.** A view's
   `PanelRenderer` receives a container element for its *body*. Section headers, twisties, collapse
   state, and ordering are workbench UI. Extensions must not be able to render their own header, or
   the sidebar stops looking uniform — this is the same reasoning that put the tab chrome in
   `PanelTab` rather than in each panel.
4. **Opening a container lazily activates every extension that contributes a view into it.** This is
   VS Code's behavior and it preserves lazy loading: an extension contributing an `outline` view into
   `explorer` is not activated on startup, only the first time `explorer` opens. Mechanically:
   `openExtensionPanel` resolves the container's view ids from `ViewRegistry` and fires
   `onView:<viewId>` for each, in addition to today's `onView:<containerId>`.
5. **One React root per view, each in its own DOM node.** Non-negotiable, per the current-state fact
   about `ExtensionPanelHost`. The accordion host creates one child element per view id and passes
   *that* to the renderer; it never reuses a node across views or across mounts.
6. **View order is explicit `order?: number` ascending, ties broken by registration order — never by
   id.** `PanelRegistry`'s id sort is acceptable for an activity bar (a flat icon strip nobody reads
   as a sequence) but wrong for stacked sections where the author intends "file tree first, outline
   second." Views without `order` sort after views with one.
7. **Collapse state is in-memory host UI state for this cycle.** A Zustand map of
   `${containerId}:${viewId}` → collapsed. No persistence to storage, no restoration across reloads —
   that is a separate concern from the contribution model and would drag in the layout-persistence
   question that Dockview state already raises. Out of scope (see below).
8. **`editor` remains a non-container.** Unchanged from Cycle 5 decision 1, permanently.

## Steps

### 1. SDK contribution types

File: `packages/sdk/src/extension.ts`

- Add `ViewContainerContribution` — `{ id, title, icon?: unknown, location?: PanelLocation }`.
  Structurally identical to `PanelContribution`; declare it separately rather than aliasing, so the
  two can diverge later.
- Add `ViewContribution` — `{ id, title, container: string, order?: number }`. No `icon`: views
  render as text headers, and an icon there would have nowhere to go.
- Extend `Contributions` with `viewContainers?` and `views?`. Keep `panels?` exactly as-is.
- Export both from `packages/sdk/src/index.ts`.

File: `packages/sdk/src/window.ts`

- Add `RegisterViewOptions` — `{ title: string }` for now; deliberately *not* `location`
  (the container decides) and *not* `initialWidth`/`initialHeight` (accordion sections size
  themselves).
- Add `registerView(id: string, render: PanelRenderer, options: RegisterViewOptions): Disposable`
  to `WindowApi`. Reuse `PanelRenderer` — the contract (get an element, optionally return cleanup)
  is identical; do not introduce a near-duplicate `ViewRenderer` type.

### 2. Core registry, manifest, and host wiring

New file: `packages/core/src/views/view-registry.ts`

- `ViewInfo` — `{ id, title, container, order?, source, extensionId? }`.
- `ViewRegistry` mirroring `PanelRegistry`: stack per id, `onDidChangeViews`, `dispose`.
- `getViews(): readonly ViewInfo[]` sorted per decision 6, and `getViewsForContainer(containerId)`.
- Unit tests alongside, matching `panel-registry.test.ts` in coverage: replace/restore, ordering
  (including the ties-by-registration-order case), container filtering, dispose semantics.

File: `packages/core/src/extensions/manifest.ts`

- `viewContainerContribution` and `viewContribution` zod schemas; `container` is a required non-empty
  string. Extend the `contributes` object.
- Extend the existing `superRefine` to enforce unique view ids and unique container ids, and to
  reject a view whose `container` matches no container **declared in the same manifest** — a
  cross-manifest reference (the `outline` → `explorer` case) is legal and must *not* be rejected
  here, since the target container may be contributed by an extension that registers later.

File: `packages/core/src/extensions/extension-host.ts`

- `InProcessExtensionHost` takes a `ViewRegistry` alongside `PanelRegistry`. Prefer widening the
  constructor to an options object over a third positional parameter.
- In `register()`, register `contributes.viewContainers` into `PanelRegistry` (a container *is* a
  panel as far as the activity bar is concerned) and `contributes.views` into `ViewRegistry`,
  next to the existing `contributes.panels` loop. Push both into `registered.subscriptions` so
  deactivation releases them.

File: `packages/core/src/window/window-service.ts`

- Add `registerView` to `WindowUiProvider` and delegate from `WindowService`.

File: `packages/core/src/index.ts` — export `ViewRegistry` and `ViewInfo`.

### 3. Workspace runtime

File: `lib/hudhod/workspace.ts`

- Construct a `ViewRegistry`, expose it as `views` on `HudhodWorkspaceRuntime`, pass it to
  `InProcessExtensionHost`, and dispose it in `dispose()`.

File: `store/useHudhodWorkspaceStore.ts`

- Add `views` alongside `panels`, fed from `ws.views.getViews()` and `onDidChangeViews`.

File: `components/ide/IdeWorkspace.tsx`

- Mirror the existing `setPanels` + `onDidChangePanels` bootstrap block for views, including the
  disposal in the effect cleanup.

### 4. The accordion host

New file: `store/useExtensionViewStore.ts`

- Flat `Map<string, { render, options }>` keyed by view id, mirroring `useExtensionPanelStore`.
  Plus the collapse-state map from decision 7.

New file: `components/dockview/panels/ViewContainerHost.tsx`

- Replaces `ExtensionPanelHost` as the `EXTENSION_PANEL_HOST` component, or sits beside it — decide
  once the code is in front of you, but **do not** end up with two divergent copies of the
  mount/cleanup logic. The safest shape is one `ExtensionViewMount` component owning a single
  renderer (essentially today's `ExtensionPanelHost` body, unchanged, including the per-mount child
  div) with `ViewContainerHost` rendering a header + `ExtensionViewMount` per view.
- Zero-view containers must fall back to the container's own renderer, which is how decision 1's
  sugar keeps working — `logs` registers a renderer for id `logs` and contributes no views.
- Single-view containers should render the view body **without** a header, so a container with one
  view is visually identical to today's single-renderer panel.

File: `lib/hudhod/window-bridge.ts`

- Implement `registerView`: store the renderer, and if the owning container is currently open, the
  accordion re-renders from the store automatically — no Dockview call needed.
- In `openExtensionPanel`, before opening, resolve `ws.views.getViewsForContainer(id)` and
  `await ws.extensions.activateByEvent(\`onView:${viewId}\`)` for each (decision 4). Sequential, for
  the same determinism reason as Cycle 5's default-layout loop.

### 5. ActivityBar

File: `components/ide/ActivityBar.tsx`

- No functional change is expected: containers are registered into `PanelRegistry`, so the existing
  single loop already renders them. Verify this holds rather than assuming it — if
  `viewContainers` needed its own loop, decision 2's "a container is a panel to the activity bar"
  assumption is wrong and the plan needs revisiting before proceeding.

### 6. Re-target the example extension

File: `packages/extension-outline/src/index.tsx`

- Change the manifest from `panels: [{ id: "outline", ... }]` to
  `views: [{ id: "outline", title: "Outline", container: "explorer", order: 100 }]`, drop the icon
  (views have no icon) and the `hudhod.outline.show` command, and swap `registerReactPanel` for the
  view equivalent.
- `@hudhod/react` needs a `registerReactView` mirroring `registerReactPanel`. Same root-per-mount
  handling; do not fork the implementation — factor the shared body if it reads cleanly.
- The `explorer` extension (`lib/hudhod/builtin-extensions/explorer.ts`) must **not** change. This
  is the proof that a view can target a container owned by a different extension.

### 7. Docs

File: `EXTENSION-DEVELOPMENT.md`

- Document the container/view distinction, when to contribute which, the `container` cross-manifest
  reference, ordering, and the lazy-activation rule from decision 4.

## Verification

1. `pnpm typecheck` — 0 errors.
2. `pnpm lint` — no new findings vs. a stashed baseline (repo-wide lint is noisy; diff, don't count).
3. `pnpm test` — new `ViewRegistry` tests pass, existing core tests unaffected.
4. `pnpm packages:build` — all five packages green.
5. Manual, in browser, from a clean load:
   - **Regression first**: explorer/editor/preview/logs/terminal appear exactly as before, activity
     bar icons unchanged, Reset Layout unchanged, sidebar exclusivity unchanged. Decision 1 means
     this cycle should be invisible until an extension opts in.
   - The `explorer` container renders the file tree **and** an `Outline` section beneath it, with
     headers, matching the VS Code screenshot that motivated this cycle.
   - Collapsing/expanding `Outline` leaves the file tree working; collapsing the file tree section
     leaves `Outline` working.
   - The outline view still reflects the active editor — i.e. `useHudhod()` and
     `onDidChangeActiveEditor` work identically through the view mount path.
   - No `createRoot()` console errors with two views mounted (decision 5's failure mode).
   - The outline extension is **not** activated on startup, and **is** activated the first time
     `explorer` opens (check via `window.__hudhod` / `ws.extensions.getExtensions()` statuses).
   - Switching to another container and back re-mounts both views cleanly, with no leaked roots.

## Explicit out-of-scope for this cycle

- Converting `explorer`/`logs`/`terminal`/`preview` into multi-view containers (decision 1).
- Persisting collapse state or view order across reloads (decision 7).
- Drag-to-reorder views, or dragging a view between containers.
- `when` clauses / context keys for conditional view visibility.
- View welcome content, view badges, per-view title-bar menus.
- A tree-data API (`TreeDataProvider` equivalent) — views render arbitrary DOM, as panels do today.
- The bottom dock. Views are a sidebar concept in this cycle; `logs`/`terminal` keep tabbing.

## Definition of done for this cycle

- An extension can contribute a view into a container owned by a different extension, declaratively,
  and it renders as an accordion section in the right order.
- Container-level exclusivity, activity bar icons, and the default layout are unchanged.
- Lazy activation still holds: contributing a view into a container does not force startup activation.
- `contributes.panels` continues to mean exactly what it meant in Cycle 5.
