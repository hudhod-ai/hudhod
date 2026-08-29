# mcpup

Project version management with Supabase Auth, Postgres, Row Level Security, and private Storage.

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
