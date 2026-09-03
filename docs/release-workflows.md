# Release workflows

This repository uses GitHub Actions for validation and Changesets for package versioning and npm publishing.

## Workflows

There are two workflows under `.github/workflows/`:

| Workflow      | Trigger                            | Purpose                                                                             |
| ------------- | ---------------------------------- | ----------------------------------------------------------------------------------- |
| `ci.yml`      | Pull requests and pushes to `main` | Validates code before merge and after merge.                                        |
| `release.yml` | Pushes to `main`                   | Validates code, then creates a Changesets version PR or publishes changed packages. |

## CI workflow

The CI workflow runs on every pull request and every push to `main`.

It performs these steps:

1. Checks out the repository.
2. Installs pnpm.
3. Sets up Node.js 22 with pnpm caching.
4. Installs dependencies with `pnpm install --frozen-lockfile`.
5. Runs `pnpm fmt:check`.
6. Runs `pnpm lint`.
7. Runs `pnpm typecheck`.
8. Runs `pnpm test`.
9. Runs `pnpm packages:build`.

The CI workflow has read-only repository permissions:

```yaml
permissions:
  contents: read
```

That means it can validate code, but it cannot push commits, create pull requests, or publish packages.

## Release workflow

The release workflow runs on every push to `main`.

It first runs the same validation checks as CI:

```bash
pnpm fmt:check
pnpm lint
pnpm typecheck
pnpm test
pnpm packages:build
```

After validation passes, it runs `changesets/action`:

```yaml
- name: Create release pull request or publish
  uses: changesets/action@v1
  with:
    version: pnpm version-packages
    publish: pnpm release
```

Those commands are defined in the root `package.json`:

```json
{
  "scripts": {
    "version-packages": "changeset version",
    "release": "pnpm packages:build && changeset publish"
  }
}
```

The release workflow has write permissions because Changesets needs to create or update the release pull request:

```yaml
permissions:
  contents: write
  pull-requests: write
```

## Changesets release flow

Changesets has two modes in this workflow.

### Mode 1: create or update the Version Packages PR

When a package change includes a changeset file, the release workflow does not publish immediately.

Instead, Changesets opens or updates a pull request commonly named `Version Packages`.

That pull request contains:

- package version bumps
- changelog updates
- removal of consumed `.changeset/*.md` files
- internal dependency version updates when needed

### Mode 2: publish packages to npm

When the `Version Packages` pull request is merged into `main`, the release workflow runs again.

At that point, there are no pending changeset files. The package versions and changelogs have already been updated, so Changesets publishes the changed public packages with:

```bash
pnpm release
```

That script rebuilds the publishable packages, then runs:

```bash
changeset publish
```

## What gets published

The Changesets config uses independent package versions:

```json
{
  "fixed": [],
  "linked": []
}
```

This means each package can release only when it changes.

The config also ignores the private root package and private example extensions:

```json
{
  "ignore": ["hudhod", "@hudhod/extension-new-file", "@hudhod/extension-outline"]
}
```

The intended public npm packages are:

- `@hudhod/sdk`
- `@hudhod/core`
- `@hudhod/react`
- `@hudhod/webcontainer`

The example extensions under `examples/extensions/` are private workspace packages. They are available for local development, but they are not published to npm.

## Required npm authentication

The release workflow needs npm credentials to publish packages.

Create this GitHub Actions repository secret:

```text
NPM_TOKEN
```

The workflow exposes it to npm publishing as both `NPM_TOKEN` and `NODE_AUTH_TOKEN`:

```yaml
env:
  NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
  NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

The `@hudhod` npm scope must exist and the token must have permission to publish packages under it.

## Developer release process

For changes that should be released:

```bash
pnpm changeset
```

Select the affected package, choose the semver bump, and write a short release note.

Then commit the generated changeset file with the code change. After the pull request is merged to `main`, the release workflow will create or update the `Version Packages` pull request.

For changes that should not release any package, do not create a changeset. CI will still run, but the release workflow will not publish anything.

## Semver guidance

Use semver per package:

| Bump  | Use when                                                                                                          |
| ----- | ----------------------------------------------------------------------------------------------------------------- |
| Patch | Bug fixes, internal improvements, documentation for a package, or small compatible behavior fixes.                |
| Minor | New backwards-compatible APIs, features, exports, or capabilities.                                                |
| Major | Breaking API changes, removed exports, changed required peer dependency ranges, or incompatible behavior changes. |

While packages are below `1.0.0`, consumers still expect extra caution. Treat minor bumps as meaningful API movement and patch bumps as compatible fixes.
