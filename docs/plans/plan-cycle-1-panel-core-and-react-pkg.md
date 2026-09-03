# Cycle 1 of 3: Core PanelRegistry + @hudhod/react package (foundation)

> Part of the "Extension-Contributed React Panels" initiative. See also:
>
> - `/memories/repo/plan-cycle-2-runtime-panel-plumbing.md`
> - `/memories/repo/plan-cycle-3-example-extension-docs.md`
>   Full original research/context lives in `/memories/session/plan.md` (session-scoped, may expire — this file is self-contained).

## Goal of this cycle

Build the framework-agnostic foundation: a core `PanelRegistry` service (mirrors the existing `KeybindingRegistry`) and the new `@hudhod/react` package that lets extension authors mount real React components into contributed panels. **No app/Dockview wiring in this cycle** — that's Cycle 2. This cycle is done when `pnpm typecheck` and `pnpm packages:build` pass with the new service + package in place, independent of any visible IDE behavior change.

## Context you need

- `packages/sdk/src/extension.ts` already defines `PanelContribution { id, title, location? }` inside `Contributions.panels`. No changes needed here.
- `packages/sdk/src/window.ts` already defines `WindowApi.registerPanel(id, render: (container: HTMLElement) => void | (() => void) | Promise<...>, options: RegisterPanelOptions): Disposable`, plus `openPanel(id)`, `closePanel(id)`. No changes needed here — this cycle only _implements against_ these types, doesn't change them.
- `packages/core/src/keybindings/keybinding-registry.ts` — **use this as the direct template** for `PanelRegistry`. Read it first.
- `packages/core/src/extensions/extension-host.ts` — `InProcessExtensionHost.register(extension)` currently: validates manifest via Zod, then iterates `manifest.contributes?.keybindings` and calls `this.#hudhod.keybindings.registerKeybinding(kb)` for each, pushing the returned `Disposable` into `registered.subscriptions`. Read the full method before editing.
- `packages/core/src/extensions/manifest.ts` — Zod schema already validates `contributes.panels` (id/title/location, unique within one manifest). No changes needed.
- `lib/hudhod/workspace.ts` — composition root; instantiates `KeybindingRegistry`, `WindowService`, etc. and builds `HudhodApi` + `HudhodWorkspaceRuntime`. You will add a `PanelRegistry` instance here.
- Root `package.json` — dependencies list already has `@hudhod/core`, `@hudhod/sdk`, `@hudhod/extension-new-file` as `workspace:*`. Existing extension packages (`packages/extension-new-file/package.json`, `tsconfig.json`, `tsdown.config.ts`) are the exact template to copy for `packages/react`.
- React version in use: `react@19.2.8`, `react-dom@19.2.8` (root `package.json`).

## Steps

### 1. `PanelRegistry` core service

File: `packages/core/src/panels/panel-registry.ts` (new)

- Class `PanelRegistry` — constructor takes no special platform arg (unlike `KeybindingRegistry` which takes `platform`).
- `registerPanel(contribution: PanelContribution): Disposable` — stores contribution metadata keyed by `id` in an internal `Map<string, PanelContribution>`. If an id is already registered, decide: throw, or last-wins with disposal restoring previous (mirror `KeybindingRegistry`'s stack-based last-wins pattern for consistency — recommended: reuse the same stack-per-key approach so two extensions could theoretically coexist/override, and disposing restores prior state cleanly).
- `getPanels(): readonly PanelInfo[]` — returns sorted array of currently active panel metadata (id, title, location). Define `interface PanelInfo extends PanelContribution {}` or reuse `PanelContribution` directly if no extra fields needed — check whether core needs to attach an `extensionId` field to `PanelInfo` (recommended: yes, add `extensionId: string` so the UI layer can later show provenance/allow filtering — extension-host should pass its own id when registering).
- `onDidChangePanels: Event<readonly PanelInfo[]>` — using the same `Emitter`/`Event` primitive already used by `KeybindingRegistry` (from `packages/core/src/base/event.ts` — check exact import path/name via that file, already open in your editor context).
- `dispose(): void` — clears all panels, disposes internal emitter.

### 2. Wire into extension host

File: `packages/core/src/extensions/extension-host.ts`

- Constructor: `InProcessExtensionHost` currently takes `(hudhod: HudhodApi)` — check exact current signature. Add a second constructor param `panels: PanelRegistry` (do NOT put panel registry inside `HudhodApi`/SDK — it's a core-internal bookkeeping service, not part of the public extension-facing contract; extensions never call `panelRegistry.registerPanel()` directly, they only ever call `hudhod.window.registerPanel()` at activation time with an actual renderer).
- In `register(extension)`, after the existing keybindings loop, add: iterate `manifest.contributes?.panels ?? []`, call `this.#panels.registerPanel({ ...panelContribution, extensionId: manifest.id })`, push disposable into `registered.subscriptions` (same disposal-on-deactivate semantics as keybindings).
- Update every call site that constructs `new InProcessExtensionHost(...)` to pass the new `panels` arg (currently only `lib/hudhod/workspace.ts` — confirmed single call site from prior research, but grep to be sure before assuming).

### 3. Export from core

File: `packages/core/src/index.ts`

- Add exports: `export { PanelRegistry } from "./panels/panel-registry";` and any `PanelInfo` type export, following the exact existing pattern for `KeybindingRegistry` in this same file (copy the export block style, watch for the duplicate-export bug pattern that was previously fixed in this file — do not reintroduce duplicate export lines).

### 4. Compose into workspace runtime

File: `lib/hudhod/workspace.ts`

- Instantiate `const panels = new PanelRegistry();` alongside `keybindings`/`commands`.
- Pass `panels` into `new InProcessExtensionHost(api, panels)` (or whatever param order Step 2 settled on).
- Add `panels: PanelRegistry` to the `HudhodWorkspaceRuntime` interface and to the returned runtime object.
- Add `panels.dispose()` to the runtime's `dispose()` cleanup, alongside the existing `keybindings.dispose()`, `window.dispose()`, etc.

### 5. `@hudhod/react` package scaffold

Directory: `packages/react/` (new)

- `package.json`: name `@hudhod/react`, version `0.0.0`, `dependencies: { "@hudhod/sdk": "workspace:*" }`, `peerDependencies: { "react": "^19", "react-dom": "^19" }`, same `scripts.build: "tsdown"` as `packages/extension-new-file/package.json` — copy that file's structure/fields exactly except name/deps.
- `tsconfig.json`: copy from `packages/extension-new-file/tsconfig.json` verbatim (same compiler options), but this package will need `"jsx"` compiler option enabled (extension-new-file doesn't use JSX) — check `packages/sdk/tsconfig.json` or the root `tsconfig.json` for the project's standard JSX setting (`"jsx": "react-jsx"` most likely) and mirror that.
- `tsdown.config.ts`: copy from `packages/extension-new-file/tsdown.config.ts`; ensure `react`/`react-dom` are treated as external (not bundled) — check how other deps are externalized in this config format, likely automatic via peerDependencies detection in tsdown, but verify.
- `src/index.ts`:
  - `HudhodContext = createContext<HudhodApi | undefined>(undefined)`
  - `HudhodProvider({ value, children }: { value: HudhodApi; children: ReactNode })` — simple provider component.
  - `useHudhod(): HudhodApi` — reads context, throws descriptive error if `undefined` (used outside provider).
  - `registerReactPanel(hudhod: HudhodApi, id: string, Component: React.ComponentType, options: RegisterPanelOptions): Disposable` — calls `hudhod.window.registerPanel(id, (container) => { const root = createRoot(container); root.render(<HudhodProvider value={hudhod}><Component/></HudhodProvider>); return () => root.unmount(); }, options)`. Import `createRoot` from `"react-dom/client"`.

### 6. Root package.json

- Add `"@hudhod/react": "workspace:*"` to root `dependencies` (needed later for the example extension package in Cycle 3, but harmless/no-op to add now — confirm pnpm workspace resolves it once `packages/react` exists).

## Verification for this cycle

1. `pnpm typecheck` — 0 errors.
2. `pnpm packages:build` — must build `sdk`, `core`, `react`, `extension-new-file` all successfully (react package now included in the `packages/*` filter automatically).
3. No behavior change expected in the running app yet — this cycle is infra-only. Do NOT attempt to wire panels into Dockview/ActivityBar here (that's Cycle 2).
4. Sanity check: temporarily write a throwaway Node/vitest smoke test (or just a scratch `.ts` file, deleted after) that imports `PanelRegistry` from `@hudhod/core`, registers a panel contribution, asserts `getPanels()` returns it, disposes, asserts it's gone. Confirms the service works before building on top of it in Cycle 2. Delete the scratch file when done (or keep as a real vitest test under `packages/core/src/panels/panel-registry.test.ts` if the repo has an existing test convention for other registries — check `packages/core/src/keybindings/` for a sibling `.test.ts` file and mirror it if present).

## Explicit out-of-scope for this cycle

- No changes to `components/dockview/*`, `components/ide/ActivityBar.tsx`, `lib/hudhod/window-bridge.ts`, or any React panel actually rendering in the browser. Those are Cycle 2.
- No example extension yet (Cycle 3).
- No changes to `EXTENSION-DEVELOPMENT.md` yet (Cycle 3, once the feature is real).

## Handoff notes for whoever picks up Cycle 2

- Confirm final constructor signature of `InProcessExtensionHost` (exact param order/names) so Cycle 2's `window-bridge.ts` work can reference `ws.extensions` correctly if needed.
- Confirm final shape of `PanelInfo` (does it include `extensionId`?) since Cycle 2's `ActivityBar` merge logic needs to read panel metadata from `ws.panels.getPanels()` / `onDidChangePanels`.

# Cycle 1 of 3: Core PanelRegistry + @hudhod/react package (foundation)

> Part of the "Extension-Contributed React Panels" initiative. See also:
>
> - `/memories/repo/plan-cycle-2-runtime-panel-plumbing.md`
> - `/memories/repo/plan-cycle-3-example-extension-docs.md`
>   Full original research/context lives in `/memories/session/plan.md` (session-scoped, may expire — this file is self-contained).

## Goal of this cycle

Build the framework-agnostic foundation: a core `PanelRegistry` service (mirrors the existing `KeybindingRegistry`) and the new `@hudhod/react` package that lets extension authors mount real React components into contributed panels. **No app/Dockview wiring in this cycle** — that's Cycle 2. This cycle is done when `pnpm typecheck` and `pnpm packages:build` pass with the new service + package in place, independent of any visible IDE behavior change.

## Context you need

- `packages/sdk/src/extension.ts` already defines `PanelContribution { id, title, location? }` inside `Contributions.panels`. No changes needed here.
- `packages/sdk/src/window.ts` already defines `WindowApi.registerPanel(id, render: (container: HTMLElement) => void | (() => void) | Promise<...>, options: RegisterPanelOptions): Disposable`, plus `openPanel(id)`, `closePanel(id)`. No changes needed here — this cycle only _implements against_ these types, doesn't change them.
- `packages/core/src/keybindings/keybinding-registry.ts` — **use this as the direct template** for `PanelRegistry`. Read it first.
- `packages/core/src/extensions/extension-host.ts` — `InProcessExtensionHost.register(extension)` currently: validates manifest via Zod, then iterates `manifest.contributes?.keybindings` and calls `this.#hudhod.keybindings.registerKeybinding(kb)` for each, pushing the returned `Disposable` into `registered.subscriptions`. Read the full method before editing.
- `packages/core/src/extensions/manifest.ts` — Zod schema already validates `contributes.panels` (id/title/location, unique within one manifest). No changes needed.
- `lib/hudhod/workspace.ts` — composition root; instantiates `KeybindingRegistry`, `WindowService`, etc. and builds `HudhodApi` + `HudhodWorkspaceRuntime`. You will add a `PanelRegistry` instance here.
- Root `package.json` — dependencies list already has `@hudhod/core`, `@hudhod/sdk`, `@hudhod/extension-new-file` as `workspace:*`. Existing extension packages (`packages/extension-new-file/package.json`, `tsconfig.json`, `tsdown.config.ts`) are the exact template to copy for `packages/react`.
- React version in use: `react@19.2.8`, `react-dom@19.2.8` (root `package.json`).

## Steps

### 1. `PanelRegistry` core service

File: `packages/core/src/panels/panel-registry.ts` (new)

- Class `PanelRegistry` — constructor takes no special platform arg (unlike `KeybindingRegistry` which takes `platform`).
- `registerPanel(contribution: PanelContribution): Disposable` — stores contribution metadata keyed by `id` in an internal `Map<string, PanelContribution>`. If an id is already registered, decide: throw, or last-wins with disposal restoring previous (mirror `KeybindingRegistry`'s stack-based last-wins pattern for consistency — recommended: reuse the same stack-per-key approach so two extensions could theoretically coexist/override, and disposing restores prior state cleanly).
- `getPanels(): readonly PanelInfo[]` — returns sorted array of currently active panel metadata (id, title, location). Define `interface PanelInfo extends PanelContribution {}` or reuse `PanelContribution` directly if no extra fields needed — check whether core needs to attach an `extensionId` field to `PanelInfo` (recommended: yes, add `extensionId: string` so the UI layer can later show provenance/allow filtering — extension-host should pass its own id when registering).
- `onDidChangePanels: Event<readonly PanelInfo[]>` — using the same `Emitter`/`Event` primitive already used by `KeybindingRegistry` (from `packages/core/src/base/event.ts` — check exact import path/name via that file, already open in your editor context).
- `dispose(): void` — clears all panels, disposes internal emitter.

### 2. Wire into extension host

File: `packages/core/src/extensions/extension-host.ts`

- Constructor: `InProcessExtensionHost` currently takes `(hudhod: HudhodApi)` — check exact current signature. Add a second constructor param `panels: PanelRegistry` (do NOT put panel registry inside `HudhodApi`/SDK — it's a core-internal bookkeeping service, not part of the public extension-facing contract; extensions never call `panelRegistry.registerPanel()` directly, they only ever call `hudhod.window.registerPanel()` at activation time with an actual renderer).
- In `register(extension)`, after the existing keybindings loop, add: iterate `manifest.contributes?.panels ?? []`, call `this.#panels.registerPanel({ ...panelContribution, extensionId: manifest.id })`, push disposable into `registered.subscriptions` (same disposal-on-deactivate semantics as keybindings).
- Update every call site that constructs `new InProcessExtensionHost(...)` to pass the new `panels` arg (currently only `lib/hudhod/workspace.ts` — confirmed single call site from prior research, but grep to be sure before assuming).

### 3. Export from core

File: `packages/core/src/index.ts`

- Add exports: `export { PanelRegistry } from "./panels/panel-registry";` and any `PanelInfo` type export, following the exact existing pattern for `KeybindingRegistry` in this same file (copy the export block style, watch for the duplicate-export bug pattern that was previously fixed in this file — do not reintroduce duplicate export lines).

### 4. Compose into workspace runtime

File: `lib/hudhod/workspace.ts`

- Instantiate `const panels = new PanelRegistry();` alongside `keybindings`/`commands`.
- Pass `panels` into `new InProcessExtensionHost(api, panels)` (or whatever param order Step 2 settled on).
- Add `panels: PanelRegistry` to the `HudhodWorkspaceRuntime` interface and to the returned runtime object.
- Add `panels.dispose()` to the runtime's `dispose()` cleanup, alongside the existing `keybindings.dispose()`, `window.dispose()`, etc.

### 5. `@hudhod/react` package scaffold

Directory: `packages/react/` (new)

- `package.json`: name `@hudhod/react`, version `0.0.0`, `dependencies: { "@hudhod/sdk": "workspace:*" }`, `peerDependencies: { "react": "^19", "react-dom": "^19" }`, same `scripts.build: "tsdown"` as `packages/extension-new-file/package.json` — copy that file's structure/fields exactly except name/deps.
- `tsconfig.json`: copy from `packages/extension-new-file/tsconfig.json` verbatim (same compiler options), but this package will need `"jsx"` compiler option enabled (extension-new-file doesn't use JSX) — check `packages/sdk/tsconfig.json` or the root `tsconfig.json` for the project's standard JSX setting (`"jsx": "react-jsx"` most likely) and mirror that.
- `tsdown.config.ts`: copy from `packages/extension-new-file/tsdown.config.ts`; ensure `react`/`react-dom` are treated as external (not bundled) — check how other deps are externalized in this config format, likely automatic via peerDependencies detection in tsdown, but verify.
- `src/index.ts`:
  - `HudhodContext = createContext<HudhodApi | undefined>(undefined)`
  - `HudhodProvider({ value, children }: { value: HudhodApi; children: ReactNode })` — simple provider component.
  - `useHudhod(): HudhodApi` — reads context, throws descriptive error if `undefined` (used outside provider).
  - `registerReactPanel(hudhod: HudhodApi, id: string, Component: React.ComponentType, options: RegisterPanelOptions): Disposable` — calls `hudhod.window.registerPanel(id, (container) => { const root = createRoot(container); root.render(<HudhodProvider value={hudhod}><Component/></HudhodProvider>); return () => root.unmount(); }, options)`. Import `createRoot` from `"react-dom/client"`.

### 6. Root package.json

- Add `"@hudhod/react": "workspace:*"` to root `dependencies` (needed later for the example extension package in Cycle 3, but harmless/no-op to add now — confirm pnpm workspace resolves it once `packages/react` exists).

## Verification for this cycle

1. `pnpm typecheck` — 0 errors.
2. `pnpm packages:build` — must build `sdk`, `core`, `react`, `extension-new-file` all successfully (react package now included in the `packages/*` filter automatically).
3. No behavior change expected in the running app yet — this cycle is infra-only. Do NOT attempt to wire panels into Dockview/ActivityBar here (that's Cycle 2).
4. Sanity check: temporarily write a throwaway Node/vitest smoke test (or just a scratch `.ts` file, deleted after) that imports `PanelRegistry` from `@hudhod/core`, registers a panel contribution, asserts `getPanels()` returns it, disposes, asserts it's gone. Confirms the service works before building on top of it in Cycle 2. Delete the scratch file when done (or keep as a real vitest test under `packages/core/src/panels/panel-registry.test.ts` if the repo has an existing test convention for other registries — check `packages/core/src/keybindings/` for a sibling `.test.ts` file and mirror it if present).

## Explicit out-of-scope for this cycle

- No changes to `components/dockview/*`, `components/ide/ActivityBar.tsx`, `lib/hudhod/window-bridge.ts`, or any React panel actually rendering in the browser. Those are Cycle 2.
- No example extension yet (Cycle 3).
- No changes to `EXTENSION-DEVELOPMENT.md` yet (Cycle 3, once the feature is real).

## Handoff notes for whoever picks up Cycle 2

- Confirm final constructor signature of `InProcessExtensionHost` (exact param order/names) so Cycle 2's `window-bridge.ts` work can reference `ws.extensions` correctly if needed.
- Confirm final shape of `PanelInfo` (does it include `extensionId`?) since Cycle 2's `ActivityBar` merge logic needs to read panel metadata from `ws.panels.getPanels()` / `onDidChangePanels`.
