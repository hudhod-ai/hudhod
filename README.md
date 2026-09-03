# hudhod

Composable packages for building an in-browser IDE runtime with extension APIs, a headless core, React workbench bindings, and WebContainer adapters.

## Packages

| Package                | Purpose                                                                                                  |
| ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `@hudhod/sdk`          | Public extension-facing API types and contracts.                                                         |
| `@hudhod/core`         | Headless runtime for file system, search, diff, process, commands, panels, views, and extension hosting. |
| `@hudhod/react`        | React host and workbench components for rendering contributed UI.                                        |
| `@hudhod/webcontainer` | Browser WebContainer adapters for the core runtime.                                                      |

Private example extensions live in `examples/extensions/`. They are part of the workspace for local development, but they are not published to npm.

## Development

```bash
pnpm install
pnpm packages:build
pnpm test
```

Useful commands:

| Command               | Purpose                                    |
| --------------------- | ------------------------------------------ |
| `pnpm build`          | Build all publishable packages.            |
| `pnpm packages:build` | Build packages under `packages/*`.         |
| `pnpm examples:build` | Build private example extensions.          |
| `pnpm typecheck`      | Type-check publishable packages.           |
| `pnpm test`           | Run package tests through Vitest projects. |
| `pnpm lint`           | Run `oxlint`.                              |
| `pnpm fmt:check`      | Check formatting with `oxfmt`.             |
| `pnpm changeset`      | Create a release changeset.                |

## Publishing

This repo uses Changesets with independent package versions. Runtime packages start at `0.1.0`; private examples are ignored by Changesets and are not published.

Release flow:

1. Make a package change.
2. Run `pnpm changeset` and describe the semver impact.
3. Merge the change to `main`.
4. The release workflow opens or updates a Version Packages pull request.
5. Merge that pull request to publish changed packages to npm.

The publish workflow requires an `NPM_TOKEN` repository secret unless npm trusted publishing is configured for the scope.

## Documentation

- [docs/composable-ide-development.md](docs/composable-ide-development.md)
- [docs/extension-development.md](docs/extension-development.md)
- [docs/release-workflows.md](docs/release-workflows.md)

## License

MIT. See [LICENSE](LICENSE).
