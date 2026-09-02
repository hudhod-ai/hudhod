<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Repository context for agents

This monorepo is a Next.js application with a small package-based runtime architecture.

## Top-level structure

- `app/`: Next.js App Router pages, route handlers, and server actions.
- `components/`: UI and IDE components rendered by the app.
- `lib/`: shared application utilities, client/server helpers, and WebContainer glue.
- `server/`: server-side business logic, auth context, storage access, and project/version services.
- `store/`: Zustand state stores.
- `packages/core/`: headless runtime for file-system, search, diff, process, command, and extension-host services.
- `packages/sdk/`: public extension API surface and types for agents/extensions.
- `supabase/`: schema, migrations, and local database configuration.

## Extension Development

See [EXTENSION-DEVELOPMENT.md](./EXTENSION-DEVELOPMENT.md) for comprehensive documentation on:

- Extension naming conventions (package names and extension IDs)
- Extension architecture and lifecycle
- Project structure and build configuration
- Manifest format and contribution points
- Available APIs (file system, commands, window, search, keybindings, processes)
- Complete example: the built-in "New File" extension
- Best practices for lazy activation, error handling, and cleanup

## Composable IDE Hosts

See [COMPOSABLE-IDE-DEVELOPMENT.md](./COMPOSABLE-IDE-DEVELOPMENT.md) when composing a new IDE
from the packages or changing host/runtime boundaries.

- Put reusable React workbench components and React host code in `packages/react`.
- Keep Dockview-specific workbench behavior and baseline styling in `packages/react`.
- Put WebContainer-specific adapters in `packages/webcontainer`.
- Keep `packages/core` framework- and environment-agnostic.
- Keep product persistence, editor state, dialogs, extension catalogs, and visual policy in the
  consuming application rather than copying `components/ide/IdeWorkspace.tsx`.
- Compose runtimes through `createHudhodRuntime()` or `createHudhodReactHost()` instead of
  constructing application-specific service graphs directly.
- A consuming client application imports `@hudhod/react/styles.css` once for baseline workbench
  and Dockview styles; see package READMEs for setup requirements, especially
  `packages/webcontainer/README.md` for browser-only WebContainer constraints.

## Package responsibilities

### `packages/core`

This package is the runtime engine. It is intentionally framework-free and testable in Node. It exposes the underlying services and primitives used by the IDE and extensions, such as:

- file system and workspace config
- search and diff utilities
- process spawning and command registration
- extension host and manifest validation
- path validation and error primitives

Prefer changes here when you are fixing runtime behavior, low-level APIs, or cross-platform/in-memory IDE semantics.

### `packages/sdk`

This package is the public extension-facing contract. It defines the stable API surface that extensions and agent tools consume and should stay type-first, async, and serializable.

When changing extension or agent capabilities, update both the implementation in `packages/core` and the public contract in `packages/sdk` if the behavior is externally visible.

## Working rules for agents

- Keep the Next.js App Router conventions in mind when editing `app/` routes, server actions, and route handlers.
- Use the existing app-level patterns for auth, form actions, and server-client boundaries.
- Do not add framework-specific assumptions to `packages/core`; it should remain environment-agnostic.
- If a change affects the public agent/extension API, update `packages/sdk` docs and types alongside runtime code.
- Prefer small, targeted changes that respect existing module boundaries.
- When in doubt, follow the nearest existing pattern in the same layer: app, component, server, or package.

## Verification expectations

Before calling a task complete, validate the relevant project checks using the repo scripts, especially for the package or feature you changed.
