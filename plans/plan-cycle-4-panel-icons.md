# Cycle 4 of N: Panel icons (SDK + core + ActivityBar)

> Part of the "Built-in Panels as First-Party Extensions" initiative (a follow-on to the
> completed "Extension-Contributed React Panels" initiative — see
> `plans/plan-cycle-1-panel-core-and-react-pkg.md`, `plans/plan-cycle-2-runtime-panel-plumbing.md`,
> `plans/plan-cycle-3-example-extension-docs.md`). This initiative's own next cycle:
>
> - `plans/plan-cycle-5-convert-builtin-panels-to-extensions.md`

## Prerequisite

Cycle 2 is done and verified (`PanelRegistry`, `InProcessExtensionHost`, the Dockview extension-panel
host, `ActivityBar`'s merge loop over `ws.panels.getPanels()` all exist and work — confirmed via
manual smoke test). Cycle 3 (throwaway example extension) is **not** a hard prerequisite for this
cycle; it can happen before, after, or never without blocking this work.

## Goal of this cycle

Give contributed panels a real per-panel icon instead of the one shared `ExtensionIcon` fallback,
so the `ActivityBar` can eventually look like VS Code's (distinct glyph per view). This cycle only
adds the plumbing and proves it with a temporary, hand-registered extension in devtools — it does
**not** convert any real built-in panel yet (that's Cycle 5, which depends on this).

## Current-state facts confirmed by review

- `PanelInfo` (`packages/core/src/panels/panel-registry.ts`) is populated **only** from an
  extension's manifest `contributes.panels` at `InProcessExtensionHost.register()` time — never
  from a runtime `hudhod.window.registerPanel(...)` call. `ActivityBar` renders from
  `ws.panels.getPanels()` (via `useHudhodWorkspaceStore`), so **only manifest-declared panels can
  ever show an ActivityBar icon** — a panel registered ad hoc at runtime with no matching
  `contributes.panels` entry (like Cycle 2's manual smoke-test panel) never appears there at all.
  This means icon must be carried on `PanelContribution` (manifest), not on
  `RegisterPanelOptions` (the runtime `registerPanel` call) — the two are already asymmetric this
  way for `title`/`location`, and icon should follow the same precedent.
- `@hudhod/sdk` is deliberately dependency-free (`packages/sdk/package.json` has no `react`
  dependency) and `packages/core` is explicitly framework-agnostic per `AGENTS.md` ("Do not add
  framework-specific assumptions to `packages/core`"). Icon therefore **cannot** be typed as a
  React `ComponentType` in either package — that would pull a React type dependency into two
  packages that currently have none.
- `components/ide/icons.tsx` already has the exact per-icon-component pattern the app wants
  (`ExplorerIcon`, `LogsIcon`, `TerminalIcon`, `PreviewIcon`, `ExtensionIcon`) — these are
  `(props: SVGProps<SVGSVGElement>) => JSX.Element` functions. The app-side type for icon is this
  shape; the SDK/core layers only need to move an opaque value through unchanged.
- `packages/core/src/extensions/manifest.ts` validates manifests with `zod` at `register()` time.
  Extensions are first-party, in-tree TS objects (not parsed JSON), so a `zod` schema field that
  accepts arbitrary values (`z.unknown()`) is fine — there's nothing to validate structurally.

## Decisions settled up front

1. **Icon lives on `PanelContribution` (manifest), not `RegisterPanelOptions`.** A runtime-only
   `registerPanel` call with no manifest entry never shows in `ws.panels`/`ActivityBar` regardless
   of what it passes, so an icon field there would be silently inert. Do not add it to
   `RegisterPanelOptions` in this cycle.
2. **SDK/core type the field as `icon?: unknown`.** No `react` dependency is added to
   `packages/sdk` or `packages/core`. The value is opaque cargo as far as those packages are
   concerned — identical in spirit to how `HudhodApi` itself is just handed through without the
   core packages knowing what's inside.
3. **The app narrows `unknown` back to a component at the render site.** `ActivityBar.tsx` gets a
   small local type guard, e.g. `isIconComponent(icon: unknown): icon is ComponentType<SVGProps<SVGSVGElement>>`
   (`typeof icon === "function"`), falling back to `ExtensionIcon` when absent or not a function.
   This is the one place in the whole feature that assumes "icon is a React component" — everywhere
   else it's just `unknown`.
4. **No changes to `@hudhod/react`.** `registerReactPanel` already forwards `options` verbatim to
   `hudhod.window.registerPanel`; since icon isn't part of `RegisterPanelOptions` (decision 1),
   there's nothing for it to do here.

## Steps

### 1. SDK: add the field

File: `packages/sdk/src/extension.ts`

- Add `readonly icon?: unknown;` to `PanelContribution`, with a doc comment pointing at the app's
  icon-component convention (can't reference `components/ide/icons.tsx` from the SDK package, so
  phrase it generically: "Opaque to the SDK; the host application defines what a valid icon value
  is.").

### 2. Core: validate and plumb through

File: `packages/core/src/extensions/manifest.ts`

- Add `icon: z.unknown().optional()` to the `panelContribution` zod object.

File: `packages/core/src/panels/panel-registry.ts`

- Add `readonly icon?: unknown;` to `PanelInfo`.
- In `registerPanel`, copy `contribution.icon` into the constructed `info` object alongside the
  existing `id`/`title`/`location` fields.

### 3. App: render the icon

File: `components/ide/ActivityBar.tsx`

- Add a local `isIconComponent` guard (per decision 3) and use it when rendering each extension
  `PanelInfo` entry: `isIconComponent(icon) ? <Icon /> : <ExtensionIcon />` instead of always
  rendering `<ExtensionIcon />`.
- No change to the built-in `ACTIVITY_ITEMS` rendering loop — those still use their own hardcoded
  `Icon` components directly, unaffected by this cycle.

## Verification

1. `pnpm typecheck` — 0 errors.
2. `pnpm lint` — no new findings (diff against a `git stash` baseline, per the established
   convention in this repo — see `/memories/repo/` if you need the baseline command).
3. `pnpm packages:build` — still green; this cycle touches `packages/sdk` and `packages/core`, so
   confirm both rebuild without type errors before moving to the app layer.
4. Manual, in browser (temporary devtools test — no new package needed):

   ```js
   const ws = __hudhod.getState().workspace; // requires the temporary window hook from Cycle 2's smoke test
   ws.extensions.register({
     manifest: {
       id: "manual.icon-test",
       name: "Icon Test",
       version: "0.0.0",
       activationEvents: ["onView:manual.icon-test"],
       contributes: {
         panels: [{ id: "manual.icon-test", title: "Icon Test", location: "right" }],
       },
     },
     activate(context) {
       context.hudhod.window.registerPanel(
         "manual.icon-test",
         (el) => {
           el.textContent = "hello";
         },
         { title: "Icon Test", location: "right" },
       );
     },
   });
   ```

   This registers the panel's manifest contribution (with no icon) up front — confirm the
   `ActivityBar` shows the `ExtensionIcon` fallback for it immediately (before activation), proving
   `PanelInfo` still flows correctly with the new optional field present but unset.

5. Re-run the same registration but add `icon: SomeComponent` (import any existing icon, e.g.
   `LogsIcon` from `components/ide/icons.tsx`, into the console via a temporary
   `window.__testIcon = LogsIcon` hook, or just verify with a `console.log`-driven unit-level check
   if wiring an arbitrary component into a devtools snippet is impractical) to confirm a custom
   icon renders instead of the fallback. If devtools ergonomics make this awkward, it's acceptable
   to verify this specific case in Cycle 5 instead, where real components are wired in from TS
   source rather than the console — note in the handoff which path you took.
6. Remove the temporary extension registration before considering this cycle done (it's a devtools
   snippet, not committed code — nothing to clean up in the repo either way).

## Explicit out-of-scope for this cycle

- Converting any real built-in panel (explorer/logs/terminal/preview) into an extension — Cycle 5.
- Any default-layout / startup-open mechanism for panels — Cycle 5.
- Adding icon to `RegisterPanelOptions` — decided against in this cycle (decision 1); revisit only
  if a concrete use case for a manifest-less panel needing an ActivityBar icon shows up.

## Handoff notes for Cycle 5

- Confirm the final `PanelContribution.icon`/`PanelInfo.icon` field name and optionality didn't
  change during implementation — Cycle 5's real extensions will set this field from actual
  `components/ide/icons.tsx` exports.
- Record which verification path you took for step 5 (devtools snippet vs. deferred to Cycle 5) so
  Cycle 5 knows whether "icon renders correctly" still needs first-time proof or is already shown.
