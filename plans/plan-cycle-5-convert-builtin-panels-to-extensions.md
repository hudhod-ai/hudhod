# Cycle 5 of N: Convert built-in panels to first-party extensions

> Part of the "Built-in Panels as First-Party Extensions" initiative. See also:
>
> - `plans/plan-cycle-4-panel-icons.md` (**must be complete before starting this cycle** — this
>   cycle's extensions set `PanelContribution.icon`, which doesn't exist until Cycle 4 lands)
> - `plans/plan-cycle-6-view-containers-and-views.md` (follow-on initiative, depends on this cycle)

## Goal of this cycle

Make `explorer`, `logs`, `terminal`, and `preview` real extensions — registered through
`ws.extensions.register()`, contributing `contributes.panels` with a title/location/icon, and
supplying their renderer via `registerReactPanel` — exactly like a third-party extension would,
instead of being hardcoded Dockview panels wired directly into `DockviewLayout`'s `components` map.
`editor` stays a true built-in (see decision 1) — this cycle does not touch it.

By the end of this cycle, `ActivityBar` is a single loop over `ws.panels.getPanels()` with no
special-cased built-in list, and the four converted panels open the same way an extension's panel
always has since Cycle 2: `activateByEvent("onView:<id>")` then mount via `registerPanel`.

## Current-state facts confirmed by review (re-check before editing — this cycle touches a lot)

- `components/dockview/panelRegistry.ts`'s `PANEL_DEFINITIONS` currently has 5 entries:
  `editor`, `explorer`, `preview`, `logs`, `terminal`. `buildInitialLayout` (used by both initial
  mount and `resetLayout`) adds **all 5** unconditionally and synchronously as soon as Dockview is
  ready — there is no activation/lazy-loading step for any of them today.
- `components/dockview/DockviewLayout.tsx`'s `components` map wires `explorer`/`editor`/`logs`/
  `terminal`/`preview` directly to `ExplorerPanel`/`EditorPanel`/`LogsPanel`/`TerminalPanel`/
  `PreviewPanel`, plus the one dynamic `EXTENSION_PANEL_HOST` entry from Cycle 2.
- The four panel components being converted are trivial wrappers with **no props** and read
  directly from their own Zustand stores: `ExplorerPanel` → `<FileTree />`, `LogsPanel` →
  `<LogsView />`, `PreviewPanel` → `<PreviewFrame />`, `TerminalPanel` → `<Terminal />`. None of
  them need anything passed in from `HudhodApi`/`ExtensionContext` at construction time — this is
  what makes them convertible with `registerReactPanel(hudhod, id, Component, options)` as-is, no
  component refactor required.
- `components/ide/ActivityBar.tsx` currently renders two separate collections: a hardcoded
  `ACTIVITY_ITEMS` array (built-ins, each with its own icon component from `components/ide/icons.tsx`)
  and a loop over `useHudhodWorkspaceStore`'s `panels` (extensions, using Cycle 4's icon-or-fallback
  rendering). Both loops render visually identical buttons already (same className logic
  duplicated) — merging them is a straightforward dedup, not a new pattern.
- `lib/hudhod/builtin-commands.ts`'s `registerBuiltinCommands` receives only `commands` and
  `keybindings`, and calls `openOrFocusPanel(dockviewApi, panelId)` directly for
  `hudhod.workbench.show{Explorer,Logs,Terminal,Preview}`. Once these panel ids are backed by
  extensions, opening them must go through activation (`ws.api.window.openPanel(id)`), not direct
  Dockview manipulation — otherwise a command invoked before the panel has ever opened once would
  add a Dockview panel with no renderer mounted (nothing ever called `registerPanel` for it).
- `lib/hudhod/builtin-commands.ts`'s `hudhod.workbench.resetLayout` command calls the synchronous
  `resetLayout(api)`, which removes every panel and calls `buildInitialLayout` — today that
  reopens all 5 built-ins unconditionally. Once 4 of the 5 are extensions, `resetLayout` must
  become async and re-open them via activation, not via direct `buildInitialLayout` inclusion (per
  Cycle 2's decision 2, extension panels must never be force-opened by `buildInitialLayout` itself).
- `components/ide/IdeWorkspace.tsx`'s bootstrap currently does: mount FS tree → `getHudhodWorkspace`
  → register `newFileExtension` → `activateByEvent("onStartup")` → wire file watcher → install/dev.
  Dockview's `onReady` (in `DockviewLayout.tsx`, a **separate** component tree, mounted via
  `next/dynamic` with `ssr: false`) independently calls `buildInitialLayout(api)` the moment
  Dockview itself becomes ready — these two mount sequences are not currently coordinated by any
  explicit ordering guarantee beyond React mount order. This matters for step 5 below.

## Decisions settled up front

1. **`editor` stays a true built-in, not an extension.** Matches VS Code's own model — the editor
   group is core workbench, not a contributed view; extensions dock _around_ a fixed editor area,
   they never _become_ it. It also has no self-contained renderer (it's driven by
   `useFileSystemStore` tabs/Monaco, not a mountable widget), and every other panel's position
   already anchors off `editor` by id (`positionForLocation`/`splitFrom` in `panelRegistry.ts`) —
   removing that anchor would need new fallback logic for zero benefit.
2. **These four extensions live in-tree, not as separate `packages/extension-*` workspace
   packages.** Unlike `hudhod.new-file` (pure logic) or Cycle 3's example extension (a
   self-contained demo component), `ExplorerPanel`/`LogsPanel`/`TerminalPanel`/`PreviewPanel` are
   deeply coupled to this app's own Zustand stores and `@/components/*` path aliases — they are
   not portable to an isolated `packages/*` workspace that builds independently via `tsdown`
   without Next.js path-alias resolution, and there's no reuse case that would justify extracting
   them. They are defined as `Extension` objects (via `defineExtension` from `@hudhod/sdk`) living
   at `lib/hudhod/builtin-extensions/*.ts`, registered in `IdeWorkspace.tsx` exactly like
   `newFileExtension`, and use `registerReactPanel` from `@hudhod/react` for their renderer. The
   _mechanism_ (manifest, activation event, `registerPanel`) is identical to a real third-party
   extension; only their physical location differs. If a genuine reuse case appears later, promote
   one to a real package then — don't do it speculatively here.
3. **New activation event: eager-but-deferred, not `onStartup` and not lazy `onView:` alone.**
   These four panels are part of the default layout (see decision 4) — they should be open the
   moment the IDE first renders, not lazily deferred until a user clicks their `ActivityBar` icon
   (that would blank the workbench on first load, a regression). So each still declares
   `activationEvents: ["onView:<id>"]` (for consistency and so the command-palette/`ActivityBar`
   click path works identically to any future user extension), but `IdeWorkspace.tsx`'s bootstrap
   explicitly calls `ws.api.window.openPanel(id)` for each of the four right after
   `activateByEvent("onStartup")` — this is what actually triggers their first activation+open, not
   the activation event itself firing spontaneously (nothing fires `onView:` events on its own; the
   host only checks them inside `openPanel`/`activateByEvent`).
4. **"Default layout" is an explicit, ordered list in app code, not an extension concept.** Add a
   single `DEFAULT_LAYOUT_PANEL_IDS = ["explorer", "editor", "preview", "logs", "terminal"]`-shaped
   constant (exact grouping order matters for `splitFrom`'s reference-panel fallback chain — keep
   `editor` opened before anything that splits off it) somewhere app-level (e.g.
   `lib/hudhod/builtin-extensions/index.ts` or `components/ide/IdeWorkspace.tsx` itself — pick
   whichever reads more naturally once you're editing that file). `editor` in that list is opened
   via the existing `buildInitialLayout`/Dockview-native path (decision 1), not via
   `openPanel` — only the four extension ids go through `openPanel`.
5. **`resetLayout` becomes two parts: a synchronous Dockview-only reset (`editor` only) plus an
   async re-open of the default extension panels.** Rename/restructure so
   `components/dockview/panelRegistry.ts`'s `resetLayout` still does the synchronous
   remove-everything + re-add-editor-only work, and a new async wrapper (co-located with the
   default-layout constant from decision 4, since it needs `ws`, which `panelRegistry.ts` must not
   import — see Cycle 2's note on `lib/hudhod/*` importing from `components/*` being fine, not the
   reverse) re-opens the four extension panels afterward. The `hudhod.workbench.resetLayout`
   command in `builtin-commands.ts` calls the new async wrapper instead of the raw `resetLayout`.

## Steps

### 1. Icons for the four panels

File: `components/ide/icons.tsx` — already has `ExplorerIcon`, `LogsIcon`, `TerminalIcon`,
`PreviewIcon`. No new icons needed; these get imported directly into the new extension manifests.

### 2. The four in-tree extensions

Directory: `lib/hudhod/builtin-extensions/` (new)

- One file per panel: `explorer.ts`, `logs.ts`, `terminal.ts`, `preview.ts`. Each:
  - `defineExtension({ manifest: { id: "hudhod.explorer", ... }, activate(context) { ... } })` —
    confirm final id convention matches existing `hudhod.new-file`-style namespacing (likely
    `hudhod.explorer`, `hudhod.logs`, `hudhod.terminal`, `hudhod.preview`; **do not** reuse the bare
    `"explorer"`/`"logs"`/`"terminal"`/`"preview"` panel ids as extension ids — panel id and
    extension id are different namespaces, e.g. `PanelRegistry`'s `extensionId` field vs.
    `PanelContribution.id`; keep the **panel id** as the existing short string so `builtin-commands.ts`
    and any saved layout state referencing `"explorer"` etc. don't need to change).
  - `activationEvents: ["onView:explorer"]` (panel id, not extension id, per the existing
    `onView:<panelId>` convention from `packages/sdk/src/extension.ts`).
  - `contributes.panels: [{ id: "explorer", title: "Explorer", location: "left", icon: ExplorerIcon }]`
    (per Cycle 4's `icon?: unknown` field — passing an actual component here is fine since these
    are first-party TS extension objects, not JSON).
  - `activate(context)`: `context.subscriptions.push(registerReactPanel(context.hudhod, "explorer", ExplorerPanel, { title: "Explorer", location: "left", initialWidth: 260 }))` — carry over the
    per-panel `INITIAL_SIZE` values from the old `panelRegistry.ts` table
    (`explorer: 260`, `preview: 420`, `logs: 220` height; `terminal` had no explicit size).
  - Import `ExplorerPanel` etc. from their existing `components/dockview/panels/*` files — no
    change needed to those component files themselves (per current-state fact: they take no props).
- `lib/hudhod/builtin-extensions/index.ts`: export all four extensions plus the
  `DEFAULT_LAYOUT_PANEL_IDS` constant (decision 4) and the async reset-layout wrapper (decision 5).

### 3. Remove built-ins from the Dockview-native path

File: `components/dockview/panelRegistry.ts`

- Remove `explorer`/`preview`/`logs`/`terminal` from `PANEL_DEFINITIONS`, leaving only `editor`.
- Remove their entries from `INITIAL_SIZE` (now empty/removable, or keep the table shape for future
  built-ins — pick based on whether `BuiltinPanelId` still has more than one member after this; if
  `editor` is the only built-in left, consider whether `BuiltinPanelId`/`INITIAL_SIZE` should
  collapse to something simpler, but don't over-refactor if the existing shape still reads fine
  with one entry).
- `splitFrom`'s `preferredId: BuiltinPanelId` parameter — confirm it still type-checks with the
  narrowed `BuiltinPanelId` (now effectively just `"editor"` for built-in callers, though extension
  panels' `positionForLocation` already splits off `"editor"` by string id regardless of the type).

### 4. Remove the direct component wiring

File: `components/dockview/DockviewLayout.tsx`

- Remove `explorer`/`logs`/`terminal`/`preview` from the `components` map — they now render
  exclusively through `EXTENSION_PANEL_HOST` like any other extension panel. Keep `editor` and
  `EXTENSION_PANEL_HOST`.
- Remove the now-unused imports (`ExplorerPanel`, `LogsPanel`, `TerminalPanel`, `PreviewPanel`) from
  this file specifically — they're still imported by the new extension files in step 2, just not
  here.

### 5. Bootstrap sequencing

File: `components/ide/IdeWorkspace.tsx`

- Register all four new extensions alongside `newFileExtension`:
  `ws.extensions.register(explorerExtension); ws.extensions.register(logsExtension); ...` (or a
  small loop over an array — either is fine).
- After `await ws.extensions.activateByEvent("onStartup")`, add the default-layout open step: for
  each id in `DEFAULT_LAYOUT_PANEL_IDS` that isn't `"editor"`, `await ws.api.window.openPanel(id)`
  (sequential `await` in a loop, not `Promise.all` — `splitFrom`'s reference-panel fallback logic
  means panel _order_ affects layout; opening explorer/preview/logs/terminal in the same fixed
  order every time keeps the initial layout deterministic, matching what `buildInitialLayout`'s
  array order used to guarantee for free).
- Watch out for the ordering fact from "Current-state facts" above: `DockviewLayout`'s `onReady`
  (which adds the `editor` panel via `buildInitialLayout`) runs on Dockview's own mount, independent
  of this bootstrap effect. `openPanel("explorer")` internally does
  `useDockviewStore.getState().api` — if that's `null` because Dockview hasn't mounted yet,
  `openExtensionPanel` in `lib/hudhod/window-bridge.ts` currently just returns early
  (`if (!api) return;`) without retrying. Confirm in practice whether `IdeWorkspace`'s effect or
  `DockviewLayout`'s `onReady` wins the race on first load; if `IdeWorkspace"`'s bootstrap can run
  first, this cycle needs either (a) a small wait/poll for `api` to become non-null before opening
  default-layout panels, or (b) moving the default-layout-open call to fire from `DockviewLayout`'s
  `onReady` handler instead of `IdeWorkspace`'s bootstrap. Determine which by testing, don't guess —
  this is the single highest-risk integration point in this cycle.

### 6. Built-in commands go through activation

File: `lib/hudhod/builtin-commands.ts`

- `registerBuiltinCommands` needs access to `ws.api.window.openPanel` now, not just
  `useDockviewStore`. Add a parameter (e.g. `windowApi: WindowApi` or the whole `ws`) and change
  the four `hudhod.workbench.show*` commands to `void windowApi.openPanel(panelId)` instead of the
  synchronous `openOrFocusPanel(dockviewApi, panelId)`. Check `IdeWorkspace.tsx`'s existing call
  site (`registerBuiltinCommands(ws.commands, ws.keybindings, ...)`) and update it to pass the new
  argument.
- `hudhod.workbench.resetLayout` calls the async wrapper from decision 5/step 2's
  `builtin-extensions/index.ts` instead of the raw synchronous `resetLayout` — this command handler
  becomes `async () => { ... }`; confirm `CommandRegistry.registerCommand`'s handler type already
  supports `() => Promise<void>` (check `packages/core/src/commands/command-registry.ts` — likely
  already does, since extensions' own command handlers are routinely async, e.g. `hudhod.new-file`).

### 7. ActivityBar: single loop

File: `components/ide/ActivityBar.tsx`

- Delete the hardcoded `ACTIVITY_ITEMS` array and its dedicated rendering block entirely.
- Render one loop over `ws.panels.getPanels()` (now containing `explorer`/`logs`/`terminal`/
  `preview` plus any real third-party extension panels, all uniformly), using Cycle 4's
  icon-or-fallback rendering for every entry — `editor` never appears here since it has no
  `PanelContribution` (decision 1), matching today's behavior where clicking a "show editor" icon
  was never a thing anyway.
- `onClick` for every entry becomes `workspace?.api.window.openPanel(id)` uniformly — no more
  `openOrFocusPanel(dockviewApi, id)` special case for built-ins.

## Verification

1. `pnpm typecheck` — 0 errors.
2. `pnpm lint` — no new findings (baseline diff, as in prior cycles).
3. `pnpm packages:build` — still green (this cycle shouldn't need `packages/*` changes beyond what
   Cycle 4 already made — if it does, that's a signal Cycle 4 wasn't fully finished).
4. Manual, in browser (`pnpm dev`), from a clean load:
   - Confirm explorer/editor/preview/logs/terminal all appear in the default layout exactly as
     before this cycle (no visual/positional regression) — this is the highest-value check, since
     the whole point of decision 4 is "looks unchanged, mechanism changed."
   - Confirm each `ActivityBar` icon still matches its panel (Explorer/Logs/Terminal/Preview icons,
     now sourced from `PanelInfo.icon` instead of the hardcoded `ACTIVITY_ITEMS` array).
   - Close a panel (e.g. Terminal) via its tab, then click its `ActivityBar` icon — confirm it
     reopens (activation is a no-op the second time per `InProcessExtensionHost`'s dedup; only the
     Dockview panel + renderer mount should be recreated).
   - Run "Reset Layout" from the command palette — confirm all four extension panels plus editor
     reappear in the same default arrangement, and confirm no extension panel from a _different,
     unrelated_ manifest (e.g. any leftover devtools test panel) gets force-opened by this — this is
     Cycle 2's original constraint, now being exercised for real for the first time.
   - Confirm `hudhod.workbench.show{Explorer,Logs,Terminal,Preview}` commands (command palette) all
     still work.
5. Regression-check file explorer refresh, terminal process spawning, live preview iframe, and log
   streaming still function — these components' internal behavior shouldn't change at all (no
   props were added), but this confirms nothing about the new mount path (via
   `ExtensionPanelHost`/`registerReactPanel` instead of a direct Dockview `components` map entry)
   broke their store subscriptions.

## Explicit out-of-scope for this cycle

- `packages/sdk`/`packages/core` changes beyond what Cycle 4 already delivered.
- Converting `editor` itself (decision 1 — permanent, not deferred).
- Promoting any of the four new in-tree extensions to real `packages/extension-*` workspace
  packages (decision 2 — only revisit given a concrete reuse need).
- Per-extension keybindings for these four panels — they didn't have any before this cycle and
  don't need any now; `hudhod.workbench.show*` commands remain the only entry point besides the
  `ActivityBar` click.

## Definition of done for the "Built-in Panels as First-Party Extensions" initiative

- `explorer`/`logs`/`terminal`/`preview` are real extensions activated the same way any third-party
  panel extension is (Cycle 2's mechanism), each with its own icon (Cycle 4).
- `ActivityBar` has exactly one rendering path for every panel, built-in or third-party.
- The default on-load layout is unchanged visually from before this initiative started.
- `editor` remains the one deliberate non-extension, matching VS Code's own architecture.
