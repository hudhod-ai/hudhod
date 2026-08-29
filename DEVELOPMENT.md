# Development Workflow

This project uses Supabase for Auth, Postgres, Row Level Security (RLS), and private Storage. Database and policy changes are stored as SQL migrations in `supabase/migrations/` and applied consistently to local and hosted Supabase projects.

## Environment Model

Use a separate Supabase project for each hosted environment:

```text
local -> development -> UAT/test -> production
```

The application code and migrations are identical across environments. Only environment variables and the linked Supabase project change.

## First-Time Local Setup

Install dependencies and start the local Supabase stack:

```bash
pnpm install
pnpm supabase:start
```

View the local URLs and keys:

```bash
pnpm exec supabase status
```

Create `.env.development.local` with the values from `supabase status`:

```env
APP_ENV="development"
STORAGE_BUCKET="project-archives"
NEXT_PUBLIC_SUPABASE_URL="http://127.0.0.1:54321"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="<local publishable key>"
SUPABASE_SERVICE_ROLE_KEY="<local secret key>"
```

Start the Next.js application:

```bash
pnpm dev
```

Useful local services:

| Service           | URL                              |
| ----------------- | -------------------------------- |
| Application       | `http://127.0.0.1:3000`          |
| Supabase Studio   | `http://127.0.0.1:54323`         |
| Mailpit           | `http://127.0.0.1:54324`         |
| Supabase REST API | `http://127.0.0.1:54321/rest/v1` |

Stop local Supabase when finished:

```bash
pnpm supabase:stop
```

## Add a Feature Locally

### 1. Create a migration

Create a new migration for every schema, RLS policy, Storage policy, trigger, function, or database configuration change:

```bash
pnpm exec supabase migration new add_project_tags
```

Edit the generated SQL file in `supabase/migrations/`.

Do not change a migration that has already been applied. Create a new migration to modify existing tables or policies.

### 2. Apply the migration locally

```bash
pnpm exec supabase migration up
pnpm exec supabase migration list --local
```

For a clean verification of the entire migration history, reset only the local database:

```bash
pnpm exec supabase db reset
```

This recreates the local database and applies every migration from `supabase/migrations/` in order. It does not affect hosted Supabase projects.

### 3. Implement and test application code

Use the Supabase SDK according to the execution context:

- Browser code uses `@/lib/client` and is protected by RLS using the signed-in user's session.
- Server-rendered pages, Server Actions, and normal server services use `@/lib/server`, which carries the authenticated user's cookie session and is also RLS-protected.
- `@/lib/admin` uses the service-role key and bypasses RLS. Use it only for the archive endpoint's per-revision deployment-token path. Never import it into client code.

For a feature that changes user-owned data, verify with at least two users: User A must not be able to read, update, delete, or download User B's records or Storage objects.

Run code validation:

```bash
pnpm lint
pnpm exec tsc --noEmit
```

Use Studio to inspect data, policies, Storage objects, and Auth users. Use Mailpit to inspect local password-reset and confirmation emails.

## Deploy a Feature to a Hosted Supabase Project

### 1. Authenticate with Supabase

```bash
pnpm exec supabase login
```

### 2. Link the repository to the target project

```bash
pnpm exec supabase link --project-ref <project-ref>
```

The CLI asks for that project's database password. Enter it directly in the terminal; do not place it in source code or environment files.

Confirm migration state:

```bash
pnpm exec supabase migration list
```

### 3. Push migrations

```bash
pnpm supabase:db:push
```

This applies only migrations that have not yet been applied to the linked hosted project.

### 4. Configure the hosted application

Set these environment variables in the deployment platform:

```env
APP_ENV="production"
STORAGE_BUCKET="project-archives"
NEXT_PUBLIC_SUPABASE_URL="https://<project-ref>.supabase.co"
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="sb_publishable_..."
SUPABASE_SERVICE_ROLE_KEY="sb_secret_..."
```

`SUPABASE_SERVICE_ROLE_KEY` bypasses RLS. Keep it server-only, never prefix it with `NEXT_PUBLIC_`, and never commit it.

In Supabase Dashboard, configure Authentication redirect URLs:

```text
https://<app-domain>/auth/callback
```

Add a corresponding URL for each deployed environment.

### 5. Test the deployed feature

Repeat the relevant user flows against the hosted application. For changes to RLS or Storage, test with two accounts as in local development.

## Revision Deployment Tokens

Each saved project version has one unique deployment token. Supply it to the bootstrap container as `MCPUP_API_TOKEN`:

```bash
docker run --rm -p 8080:8080 \
  -e MCPUP_PROJECT_ID=<project-uuid> \
  -e MCPUP_REVISION=<revision-number> \
  -e MCPUP_API_TOKEN=<revision-deployment-token> \
  -e MCPUP_API_URL=https://<app-domain> \
  osamanj93/mcpup-bootstrap
```

The token only permits downloading the matching project revision. A token from another project or revision is rejected.

## Promote to Another Environment

To deploy the same schema to test/UAT or production, repeat the hosted workflow for the target project:

```bash
pnpm exec supabase link --project-ref <target-project-ref>
pnpm supabase:db:push
```

Then configure the target deployment with that project's URL, publishable key, and service-role key. No code changes are required.

## Before Committing

Commit the application change and its migration together:

```bash
git status
git add app components lib server supabase/migrations
git commit -m "Add project tags"
```

Never commit `.env*`, service-role keys, database passwords, deployment tokens, or Supabase access tokens.
