# Cycle 3 of 3: Example extension + documentation (validation)

> Part of the "Extension-Contributed React Panels" initiative. See also:
>
> - `/memories/repo/plan-cycle-1-panel-core-and-react-pkg.md`
> - `/memories/repo/plan-cycle-2-runtime-panel-plumbing.md` (must be complete before starting this cycle)
>   Full original research/context lives in `/memories/session/plan.md` (session-scoped, may expire — this file is self-contained).

## Prerequisite

Cycles 1 and 2 must be done and verified. Specifically confirm:

- `pnpm typecheck` and `pnpm packages:build` pass.
- The manual smoke test from Cycle 2's Verification step 3 works (a manually-registered panel renders and opens via `ws.api.window.openPanel(id)`).
- Read Cycle 2's "Handoff notes" section (filled in by whoever did Cycle 2) for the final shape of the Dockview integration (single static host component vs. dynamic map) and the exact `openPanel` activation-ordering behavior — this cycle's extension code depends on both being correct.

## Goal of this cycle

Prove the full pipeline works for a _real_ extension package (not a manual devtools test), using `@hudhod/react`'s `registerReactPanel`/`useHudhod`, wired into the app the same way `hudhod.new-file` is today. Then document the whole feature in `EXTENSION-DEVELOPMENT.md` so future extension authors (human or agent) can use it without re-deriving any of this.

## Context you need (re-read current state first — these files were touched in Cycles 1–2)

- `packages/extension-new-file/` — the exact structural template (package.json/tsconfig.json/tsdown.config.ts/src/index.ts) to copy for the new example extension package.
- `packages/react/src/index.ts` — confirm final exports: `HudhodProvider`, `useHudhod`, `registerReactPanel`. Read the actual signatures (may have shifted slightly during Cycle 1 implementation vs. what was planned).
- `components/ide/IdeWorkspace.tsx` — current bootstrap sequence: `ws.extensions.register(newFileExtension); await ws.extensions.activateByEvent("onStartup");`. You'll add a second `ws.extensions.register(examplePanelExtension);` call here (activation for this one happens lazily via `onView:...`, not `onStartup` — do NOT add it to the `onStartup` activation call).
- `EXTENSION-DEVELOPMENT.md` (repo root) — existing doc structure (Naming Conventions, Extension Architecture, Project Structure, Manifest Format, Extension Lifecycle, Available APIs, Example, Best Practices, Testing, Publishing, References). Add a new subsection for panel contributions + `@hudhod/react` following the same style/tone as the existing "New File Extension" example section.
- Root `package.json` — add the new extension package as a workspace dependency, same as `@hudhod/extension-new-file` is today.

## Steps

### 1. Scaffold the example extension package

Directory: `packages/extension-example-panel/` (new) — confirm final chosen name matches whatever was used in Cycle 2's manual test id conventions for consistency (e.g. if Cycle 2 used `"manual.test"`, this real one should use something like `"hudhod.example-panel"` per the existing `hudhod.new-file` naming convention: `{namespace}.{feature-name}`).

- `package.json`: name `@hudhod/extension-example-panel`, deps: `@hudhod/sdk: workspace:*`, `@hudhod/react: workspace:*`; devDependencies or peerDependencies for `react`/`react-dom` as needed to satisfy `@hudhod/react`'s peer deps during build (check how `tsdown` handles peer deps for a package two hops removed — may need `react`/`react-dom` explicitly listed as devDependencies here too so the build's type-checking succeeds, even though they're not bundled).
- `tsconfig.json` / `tsdown.config.ts`: copy from `packages/extension-new-file`, but this one needs JSX support (see Cycle 1's note about `packages/react`'s tsconfig JSX setting — mirror the same `"jsx"` compiler option here since this package's `src/` will contain a `.tsx` component file).

### 2. Extension manifest + activation

File: `packages/extension-example-panel/src/index.ts`

- Manifest: `id: "hudhod.example-panel"`, `name`, `version: "0.0.0"`, `description`, `activationEvents: ["onView:hudhod.example-panel"]` (activate ONLY when the panel is opened — proves the lazy-activation path end-to-end, unlike `hudhod.new-file` which activates `onCommand:...`).
- `contributes.panels: [{ id: "hudhod.example-panel", title: "Example Panel", location: "right" }]`.
- `activate(context)`: call `registerReactPanel(context.hudhod, "hudhod.example-panel", ExamplePanelComponent, { title: "Example Panel", location: "right" })`, push the returned `Disposable` into `context.subscriptions`.

### 3. The panel component

File: `packages/extension-example-panel/src/ExamplePanelComponent.tsx` (new, separate file from `index.ts` for clarity — confirm the package's tsdown entry point config only needs `src/index.ts` as the entry; a relatively-imported `.tsx` sibling file should bundle fine, but double check the `tsdown.config.ts` entry glob doesn't need updating).

- A component that calls `useHudhod()` from `@hudhod/react` and:
  - Displays `hudhod.window.activeEditor?.path` (reactively — subscribe via `hudhod.window.onDidChangeActiveEditor` in a `useEffect`, store in local `useState`; this proves the panel component can react to IDE state changes, not just read a static snapshot).
  - Has a button that calls `await hudhod.window.showMessage("Hello from the example panel!", "info")` — proves the panel can trigger other parts of the `HudhodApi` beyond what it was given at registration time.
  - Optionally lists files via `await hudhod.search.findFiles("**/*", {...})` on a button click, to prove broader API surface access (nice-to-have, skip if time-constrained — core proof points are the two above).

### 4. Register in the app

File: `components/ide/IdeWorkspace.tsx`

- Import `examplePanelExtension from "@hudhod/extension-example-panel"`.
- In the bootstrap function, alongside the existing `ws.extensions.register(newFileExtension);`, add `ws.extensions.register(examplePanelExtension);`. Do NOT call `activateByEvent("onView:hudhod.example-panel")` here — leave it to activate lazily when the user opens it via ActivityBar (per Cycle 2's wiring) or command palette.

### 5. Root package.json

- Add `"@hudhod/extension-example-panel": "workspace:*"` to `dependencies`, alongside the existing `@hudhod/extension-new-file` entry.

### 6. Documentation

File: `EXTENSION-DEVELOPMENT.md`

- Add a new section (after "Available APIs", before or after "Example: New File Extension" — pick whichever reads better once you see the current doc flow) titled something like "Custom React Panels with `@hudhod/react`". Cover:
  - When to use panels vs. commands/window dialogs.
  - The `contributes.panels` manifest field (id/title/location) and the `onView:<id>` activation event.
  - Why `@hudhod/sdk`'s `registerPanel` is DOM-imperative (keeps SDK/core framework-agnostic per this repo's architecture rules) and how `@hudhod/react` bridges that to real React via `registerReactPanel`/`HudhodProvider`/`useHudhod`.
  - A trimmed-down version of the example extension's manifest + component as the doc's code sample (reuse real, working code from Step 2/3 rather than inventing new snippets — keep docs and reality in sync).
  - Note the current limitation: extension panels currently share one fallback icon in the ActivityBar (no per-panel icon field yet) — set expectations for extension authors.
- Update the "References" section at the bottom to add links to `packages/react/src/index.ts` and `packages/extension-example-panel/src/index.ts`.

## Verification for this cycle

1. `pnpm typecheck` — 0 errors.
2. `pnpm packages:build` — all packages including `packages/extension-example-panel` build successfully.
3. Manual, in browser (`pnpm dev`):
   - Confirm "Example Panel" appears in the ActivityBar (fallback icon) without the extension being activated yet (check via whatever devtools/logging Cycle 2 set up, or add a temporary `console.log` in `activate()` to confirm it hasn't fired before you click).
   - Click it → panel opens on the right, extension activates (log fires once, not repeatedly), component renders.
   - Open a file in the editor → confirm the panel's active-editor display updates reactively.
   - Click the "show message" button → confirm a toast/message appears via the existing `WindowUiHost` message rendering.
   - Close the panel via its tab, reopen it → confirm no duplicate mounts, no console errors, extension does not re-run `activate()` a second time (check `InProcessExtensionHost`'s activation-tracking logic — activating an already-active extension should be a no-op; if it's not, that's a Cycle 1/2 bug to fix, not something to work around here).
4. Remove any temporary debug `console.log`s added for verification before considering this cycle done.

## Explicit out-of-scope for this cycle

- Per-panel custom icons (noted as a documented future fast-follow, not built here).
- Publishing `@hudhod/react`/`@hudhod/extension-example-panel` to a real npm registry — stays workspace-local.
- Any changes to `packages/core`/`packages/sdk` — if a gap is discovered requiring changes there, it means Cycles 1–2 need revisiting; flag it rather than patching silently in this cycle's scope.

## Definition of done for the whole 3-cycle initiative

- A real extension (not a manual devtools test) can contribute a panel, lazily activate on open, render arbitrary React UI, and call any part of `HudhodApi` from inside that UI.
- Built-in panels (explorer/editor/logs/terminal/preview) still work unchanged.
- `EXTENSION-DEVELOPMENT.md` documents the feature for future extension authors.
- `pnpm typecheck` and `pnpm packages:build` both pass cleanly at the repo root.
