# hudhod

An extensible in-browser development environment with project version management,
Supabase Auth, Postgres, Row Level Security, and private Storage.

## Local development

```bash
pnpm install
pnpm supabase:start
pnpm dev
```

The local Supabase API runs at `http://127.0.0.1:54321`; Studio runs at `http://127.0.0.1:54323`. Copy the local API URL and publishable key printed by `pnpm supabase:start` into `.env.local` when developing against the local stack.

Schema, RLS policies, Storage bucket configuration, and Auth profile trigger live in `supabase/migrations/`. Apply them to the linked project with:

```bash
pnpm supabase:db:push
```

See [SUPABASE-DEVELOPMENT.md](SUPABASE-DEVELOPMENT.md) for the full migration, RLS testing, and deployment workflow.

## Linting and formatting

This project uses the [Oxc](https://oxc.rs) toolchain. ESLint and Prettier are not used.

| Command          | Purpose                           |
| ---------------- | --------------------------------- |
| `pnpm lint`      | Run `oxlint`                      |
| `pnpm lint:fix`  | Apply `oxlint` auto-fixes         |
| `pnpm fmt`       | Format in place with `oxfmt`      |
| `pnpm fmt:check` | Verify formatting without writing |
| `pnpm typecheck` | Type-check with `tsc --noEmit`    |

`oxlint` is configured in `.oxlintrc.json` with the `eslint`, `typescript`, `unicorn`, `oxc`, `react`, `nextjs`, `jsx-a11y`, and `import` plugins enabled. The `nextjs` plugin replaces the rules previously provided by `eslint-config-next`.

`oxfmt` is configured in `.oxfmtrc.json`. Beyond Prettier-compatible formatting it also:

- sorts imports into `builtin → external → @/internal → relative` groups, separated by blank lines
- sorts Tailwind class names in `className` and in `cn` / `clsx` / `cva` calls, using `app/globals.css` as the Tailwind v4 source
- sorts `package.json` keys

Do not reorder imports or Tailwind classes by hand; `oxfmt` owns both. Blank lines between logical blocks are preserved, so keep them where they aid readability.

Install the `oxc.oxc-vscode` extension for format-on-save and inline diagnostics. It is already listed in `.vscode/extensions.json`.

## Environments

Each development, test/UAT, and production environment should have a separate Supabase project. To move the schema to another project, authenticate with the Supabase CLI, then run:

```bash
pnpm exec supabase link --project-ref <new-project-ref>
pnpm supabase:db:push
```

Set that environment's `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`. No application code changes are needed.

## Revision deployments

Every project revision receives a unique deployment token. Supply it to the bootstrap image as `MCPUP_API_TOKEN`; it only authorizes retrieval of that exact revision.

```bash
docker run --rm -p 8080:8080 \
	-e MCPUP_PROJECT_ID=<project-uuid> \
	-e MCPUP_REVISION=1 \
	-e MCPUP_API_TOKEN=<revision-deployment-token> \
	osamanj93/mcpup-bootstrap
```
