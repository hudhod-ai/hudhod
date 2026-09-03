# Repository context for agents

This repository is a pnpm workspace for publishable Hudhod library packages and private example extensions.

## Top-level structure

- `packages/sdk/`: public extension API surface and serializable types.
- `packages/core/`: headless runtime for file-system, search, diff, process, command, panel, view, workspace, and extension-host services.
- `packages/react/`: React host and reusable workbench components.
- `packages/webcontainer/`: WebContainer adapters for browser-hosted runtimes.
- `examples/extensions/`: private example extensions used for local development and documentation.
- `docs/`: architecture and extension-development documentation.

## Extension development

See [docs/extension-development.md](./docs/extension-development.md) for extension naming conventions, lifecycle, manifests, contribution points, APIs, examples, and cleanup guidance.

## Composable IDE hosts

See [docs/composable-ide-development.md](./docs/composable-ide-development.md) when composing a new IDE from the packages or changing host/runtime boundaries.

- Put reusable React workbench components and React host code in `packages/react`.
- Put WebContainer-specific adapters in `packages/webcontainer`.
- Keep `packages/core` framework- and environment-agnostic.
- Keep product persistence, editor state, dialogs, extension catalogs, and visual policy in consuming applications.
- Compose runtimes through `createHudhodRuntime()` or `createHudhodReactHost()` instead of constructing application-specific service graphs directly.
- A consuming client application imports `@hudhod/react/styles.css` once for baseline workbench and Dockview styles.

## Package responsibilities

### `packages/core`

This package is the runtime engine. It is intentionally framework-free and testable in Node. It exposes the underlying services and primitives used by IDE hosts and extensions, including:

- file system and workspace config
- search and diff utilities
- process spawning and command registration
- extension host and manifest validation
- path validation and error primitives

Prefer changes here when fixing runtime behavior, low-level APIs, or cross-platform/in-memory IDE semantics.

### `packages/sdk`

This package is the public extension-facing contract. It defines the stable API surface that extensions and agent tools consume and should stay type-first, async, and serializable.

When changing extension or agent capabilities, update both the implementation in `packages/core` and the public contract in `packages/sdk` if the behavior is externally visible.

## Working rules for agents

- Do not add framework-specific assumptions to `packages/core`; it should remain environment-agnostic.
- If a change affects the public agent/extension API, update `packages/sdk` docs and types alongside runtime code.
- Keep example extensions private unless the user explicitly asks to publish them.
- Prefer small, targeted changes that respect existing package boundaries.
- When in doubt, follow the nearest existing pattern in the same package.

## Verification expectations

Before calling a task complete, validate relevant checks using the repo scripts, especially `pnpm packages:build`, `pnpm test`, and package-specific typechecks.
