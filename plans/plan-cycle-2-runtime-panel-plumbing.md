# Cycle 2 of 3: Runtime panel plumbing (window-bridge, Dockview, ActivityBar)

> Part of the "Extension-Contributed React Panels" initiative. See also:
>
> - `plans/plan-cycle-1-panel-core-and-react-pkg.md` (**complete** — see "What Cycle 1 delivered" below)
> - `plans/plan-cycle-3-example-extension-docs.md`

## Goal of this cycle

Make `hudhod.window.registerPanel/openPanel/closePanel` actually work end-to-end in the browser: an extension's DOM renderer gets mounted into a real Dockview panel, panels can be opened/closed, and extension panels show up in the `ActivityBar`. **No example extension yet** (Cycle 3) — validate with the temporary dev hook described under Verification.

## What Cycle 1 delivered (verified, do not re-derive)

- `PanelRegistry` in `packages/core/src/panels/panel-registry.ts`, exported from `@hudhod/core` along with the `PanelInfo` type.
- `PanelInfo = { id: string; title: string; location: "left" | "right" | "bottom" | "center"; source: "extension" | "builtin"; extensionId?: string }`. `location` is **always** populated — the registry defaults it to `"bottom"` when the manifest omits it.
- `PanelRegistry` methods: `registerPanel(contribution, options?: { source?, extensionId? }): Disposable`, `getPanels(): readonly PanelInfo[]` (sorted by id), `onDidChangePanels: Event<readonly PanelInfo[]>`, `dispose()`.
- `InProcessExtensionHost(hudhod, panels)` registers `contributes.panels` into the registry at `register()` time — **before activation** — and releases them when the registration is disposed.
- `lib/hudhod/workspace.ts` exposes `ws.panels: PanelRegistry` on `HudhodWorkspaceRuntime` and disposes it.
- `@hudhod/react` exports `HudhodProvider`, `useHudhod`, `registerReactPanel`. **Its cleanup callback defers `root.unmount()` into a `queueMicrotask`** — see Step 4.

## Current-state facts confirmed by review

Re-read the files before editing, but these were verified and should save you a pass:

- `lib/hudhod/window-bridge.ts` — `registerPanel`/`openPanel`/`closePanel` throw `"not yet implemented"`. `openFile` already does `getHudhodWorkspace(await getWebContainer())` lazily inside the method body; **reuse that pattern** to reach `ws` — a top-level import would create a cycle, since `workspace.ts` imports `createWindowUiProvider` from this file. Leave `showMessage`/`showInputBox`/`showQuickPick`/`openFile`/`activeEditor`/`onDidChangeActiveEditor` untouched.
- `components/dockview/panelRegistry.ts` exports more than earlier drafts of this plan claimed: `PanelId`, `PANEL_TAB_COMPONENT`, `PanelDefinition`, `PANEL_DEFINITIONS`, `INITIAL_SIZE` (module-private), `buildInitialLayout`, `openOrFocusPanel`, **`closePanel(api, id)`**, `resetLayout`. Every `addPanel` call passes `tabComponent: PANEL_TAB_COMPONENT` and spreads `INITIAL_SIZE[id]`.
- `PanelId` is referenced in only three files: `panelRegistry.ts`, `components/ide/ActivityBar.tsx`, and `lib/hudhod/builtin-commands.ts`. `useDockviewStore` already types `openPanelIds` as `Set<string>`.
- `lib/hudhod/builtin-commands.ts` already imports `openOrFocusPanel` from `components/dockview/panelRegistry` — **`lib/hudhod/*` importing from `components/*` is an established convention, not a layering violation.**
- `onView:${string}` is valid in the SDK `ActivationEvent` union _and_ in the Zod schema (`/^onView:[^\s]+$/`). `activateByEvent` matches by exact string equality against `manifest.activationEvents`.
- `components/dockview/panels/` contains `EditorPanel`, `ExplorerPanel`, `LogsPanel`, `PanelTab`, `PreviewPanel`, `TerminalPanel`.
- `components/ide/IdeWorkspace.tsx` bootstrap effect: `const ws = getHudhodWorkspace(instance); workspaceRef.current = ws;` then registers `newFileExtension`, awaits `activateByEvent("onStartup")`, then wires `ws.fs.onDidChangeFile` into a `cleanupFileWatch` local. The effect's return disposes all `cleanup*` locals and `workspaceRef.current`.
- `store/useWindowUiStore.ts` is a one-shot request/response store (`pending` + `resolvePending`/`dismissPending`). Panels are persistent and mounted, so they get a **sibling** store rather than extending this one.

## Decisions settled up front

1. **No dynamic `components` map.** Exactly one static key — `"extension-panel-host"` — is added to `DockviewLayout`'s `components` prop. Every extension panel is a Dockview _panel_ using that one component, distinguished by `props.api.id`. Nothing about the `components` prop is dynamic, so **the dockview spike from the earlier draft of this plan is deleted; do not run it.**
2. **Built-ins and extension panels stay in separate collections.** See Step 3 — merging them breaks `resetLayout`.
3. **`location` precedence**: `PanelInfo.location` (from the manifest, known before activation) positions the panel; once the extension activates and calls `registerPanel`, `RegisterPanelOptions.location` wins if present. In practice `openPanel` activates first, so the `RegisterPanelOptions` value is normally the one used — the manifest value is the fallback for a panel opened before its renderer exists.
4. **`initialWidth`/`initialHeight`** for extension panels come from `RegisterPanelOptions`, not from the built-in `INITIAL_SIZE` table.

## Steps

### 1. Panel renderer store

File: `store/useExtensionPanelStore.ts` (new)

- Holds `Map<string, { render: PanelRenderer; options: RegisterPanelOptions }>` keyed by panel id.
- Actions: `registerRenderer(id, render, options)`, `unregisterRenderer(id)`, `getRenderer(id)`.
- Keep it dumb: no Dockview API calls, no lifecycle logic. Orchestration lives in `window-bridge.ts`; the mount/cleanup lifecycle lives in `ExtensionPanelHost` (Step 4).
- Note: nothing subscribes to this store reactively — `ExtensionPanelHost` reads it once inside a `useEffect`. A plain module-level `Map` would work identically; a zustand store is chosen only for consistency with the rest of `store/`.

### 2. Implement the window-bridge panel methods

File: `lib/hudhod/window-bridge.ts` — replace the three throwing methods only.

- Extract a shared local `async function openExtensionPanel(id: string): Promise<void>` used by both `openPanel` and the `openImmediately` path, so the open flow exists once.
- `openPanel(id)` ordering is **load-bearing**:
  1. `const ws = getHudhodWorkspace(await getWebContainer())` (lazy, per the note above).
  2. ``await ws.extensions.activateByEvent(`onView:${id}`)`` — the extension's `activate()` is what calls `registerPanel` with the real renderer, so skipping this leaves nothing to mount.
  3. Read `useDockviewStore.getState().api`. If a panel with that id already exists, focus it and return.
  4. Otherwise resolve placement: `useExtensionPanelStore.getState().getRenderer(id)?.options` first, falling back to `ws.panels.getPanels().find((p) => p.id === id)` for `location`/`title` (decision 3).
  5. `registerDynamicPanel(...)` (Step 3), then add the panel — passing `tabComponent: PANEL_TAB_COMPONENT` and `initialWidth`/`initialHeight` from the options.
- `registerPanel(id, render, options)`: write to `useExtensionPanelStore`; if `options.openImmediately`, call `void openExtensionPanel(id)`. Return a `Disposable` that unregisters the renderer, calls `unregisterDynamicPanel(id)`, and closes the Dockview panel if one is open.
- `closePanel(id)`: look up the panel via `useDockviewStore.getState().api?.getPanel(id)`; close it and return `true`, or `false` when absent (`WindowApi.closePanel` returns `Promise<boolean>`).
- Naming: `panelRegistry.ts` already exports a `closePanel(api, id)`. Import it aliased (e.g. `closeDockviewPanel`) or go through the api directly — do not shadow it confusingly.

### 3. Dynamic Dockview panel registry

File: `components/dockview/panelRegistry.ts`

- Rename the existing union to `BuiltinPanelId` and keep `PANEL_DEFINITIONS` typed against it. Introduce `type PanelId = string` for the public function signatures (`openOrFocusPanel`, `closePanel`, `PanelDefinition.id`). This keeps `INITIAL_SIZE: Partial<Record<BuiltinPanelId, ...>>` exhaustively typed while letting extension ids flow through.
- Add a separate `const DYNAMIC_PANELS = new Map<string, PanelDefinition>()` plus exported `registerDynamicPanel(def)` / `unregisterDynamicPanel(id)`.
- **`buildInitialLayout` must keep iterating `PANEL_DEFINITIONS` only.** `resetLayout` removes every panel and then calls `buildInitialLayout`; if extension panels lived in the same collection, resetting the layout would force-open every registered extension panel. This is the single most important constraint in this step — do **not** collapse built-ins and dynamic panels into one map.
- `openOrFocusPanel(api, id)` looks up `PANEL_DEFINITIONS` first, then `DYNAMIC_PANELS`. Extension definitions carry their own sizing, so only spread `INITIAL_SIZE[id]` for built-ins.
- Extension `PanelDefinition.component` is always the literal `"extension-panel-host"`. Export that string as a named constant next to `PANEL_TAB_COMPONENT`.
- `getPosition` for extension panels maps `location` → a `splitFrom(api, "editor", …)` direction: `left`/`right` → same, `bottom` → `below`, `center` → `within`.

### 4. Generic extension panel host component

File: `components/dockview/panels/ExtensionPanelHost.tsx` (new)

- `function ExtensionPanelHost(props: IDockviewPanelProps)`, with `const containerRef = useRef<HTMLDivElement>(null)`.
- `useEffect` keyed on `props.api.id`: look up the renderer, call `render(containerRef.current)`, await the possibly-async result, store the returned cleanup, and run it on unmount. Guard with a `cancelled` flag so a renderer that resolves after unmount is cleaned up immediately rather than leaking.
- **Do not clear or detach the container in the same tick as the cleanup call.** `registerReactPanel` returns a cleanup that defers `root.unmount()` into a `queueMicrotask`; wiping the container synchronously would unmount React from a node it no longer owns.
- Render `<div ref={containerRef} className="h-full w-full" />` — match `TerminalPanel.tsx`'s full-size mount div convention.

### 5. Register the host in DockviewLayout

File: `components/dockview/DockviewLayout.tsx`

- Add the single static entry `[EXTENSION_PANEL_HOST]: ExtensionPanelHost` to the existing `components` map. That is the entire change to this file.

### 6. Expose the workspace to the ActivityBar

File: `store/useHudhodWorkspaceStore.ts` (new, small)

- `{ workspace: HudhodWorkspaceRuntime | null; panels: readonly PanelInfo[]; setWorkspace(ws); setPanels(panels) }`.
- In `components/ide/IdeWorkspace.tsx`, `setWorkspace(ws)` immediately after `workspaceRef.current = ws;`, and subscribe there — mirroring the existing `ws.fs.onDidChangeFile` wiring:

  ```ts
  setPanels(ws.panels.getPanels());
  const panelWatch = ws.panels.onDidChangePanels((panels) => setPanels(panels));
  cleanupPanelWatch = () => panelWatch.dispose();
  ```

  Seed with `getPanels()` before subscribing: extensions are registered earlier in the same bootstrap, so their contributions have already fired. Clear the store (`setWorkspace(null)`, `setPanels([])`) in the effect's cleanup alongside the other `cleanup*` calls.

- The subscription belongs here, not inside `ActivityBar` — that matches how every other runtime event reaches the UI in this codebase.

### 7. ActivityBar: merge extension panels

File: `components/ide/ActivityBar.tsx`

- Read `workspace` and `panels` from `useHudhodWorkspaceStore`; keep reading `openPanelIds` from `useDockviewStore`.
- Render built-in `ACTIVITY_ITEMS` first, then one button per `PanelInfo`, using `id` as the key and `title` as the label, with the shared fallback icon from Step 8.
- `onClick` calls `workspace?.api.window.openPanel(id)` — through the public `HudhodApi`, **not** `openOrFocusPanel`, so the `onView:` activation in Step 2 runs.
- `isOpen` reuses `openPanelIds.has(id)`; Dockview does not distinguish built-in from extension panels once added.

### 8. Fallback icon

File: `components/ide/icons.tsx`

- Add one inline-SVG component in the existing style (e.g. `ExtensionIcon`), used for every extension panel button.

## Verification

1. `pnpm typecheck` — 0 errors.
2. `pnpm lint` — no new findings in the touched files. There are pre-existing errors elsewhere in `lib/hudhod/` and `components/ide/`; compare against a `git stash` baseline if unsure.
3. `pnpm packages:build` — still green. This cycle should not modify `packages/*` at all.
4. **Manual smoke test.** `ws` is only held in a `useRef` and is not reachable from devtools. After Step 6, temporarily add `(window as any).__hudhod = useHudhodWorkspaceStore;` in the `IdeWorkspace` bootstrap, then from the console:

   ```js
   const ws = __hudhod.getState().workspace;
   ws.api.window.registerPanel(
     "manual.test",
     (el) => {
       el.textContent = "hello";
       return () => console.log("cleanup ran");
     },
     { title: "Manual Test", location: "right" },
   );
   await ws.api.window.openPanel("manual.test");
   ```

   Expect a Dockview panel on the right titled "Manual Test" containing "hello". Remove the `window` hook before committing.

5. Closing that panel via its tab menu (or `ws.api.window.closePanel("manual.test")`) must log `cleanup ran`.
6. Regression: explorer/editor/logs/terminal/preview still open, close, and survive **reset layout** — and reset layout must **not** open `manual.test`. This is the specific failure mode decision 2 exists to prevent.

## Explicit out-of-scope for this cycle

- No `packages/extension-example-panel` yet (Cycle 3) — validate manually per Verification step 4.
- No `EXTENSION-DEVELOPMENT.md` updates yet (Cycle 3).
- Don't touch `packages/core`, `packages/sdk`, or `packages/react` in this cycle — if you find you need to, it likely means Cycle 1 wasn't fully finished; go back and check rather than patching around it here.

## Handoff notes for whoever picks up Cycle 3

- Record the final `getPosition` mapping from `PanelLocation` → Dockview direction, so the example extension's `location` produces the placement its docs claim.
- Confirm `openPanel(id)` shipped with the activate-then-mount ordering from Step 2; Cycle 3's example extension registers its renderer inside `activate()` and depends on it.
