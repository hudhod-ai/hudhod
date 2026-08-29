# mcpup-bootstrap

Base image that restores a saved mcpup project revision and runs it.

On start it downloads the revision's file tree (a JSON `FileSystemTree`) from the
mcpup API, writes it to disk recursively, runs `pnpm install`, `pnpm run build`,
then `pnpm run start`.

## Run

```bash
docker run --rm -p 8080:8080 \
  -e MCPUP_PROJECT_ID=<project-uuid> \
  -e MCPUP_REVISION=1 \
  -e MCPUP_API_TOKEN=<revision-deployment-token> \
  osamanj93/mcpup-bootstrap
```

The server is then available at http://localhost:8080.

`MCPUP_API_URL` defaults to `http://host.docker.internal:3000`, which resolves
automatically on Docker Desktop (Windows/macOS). On Linux, add
`--add-host=host.docker.internal:host-gateway` or point `MCPUP_API_URL` at a
reachable host.

## Environment variables

| Variable              | Required | Default                            | Description                                        |
| --------------------- | -------- | ---------------------------------- | -------------------------------------------------- |
| `MCPUP_PROJECT_ID`    | yes      | —                                  | Project UUID.                                      |
| `MCPUP_REVISION`      | yes      | —                                  | Revision number (integer, not the version's `id`). |
| `MCPUP_API_URL`       | no       | `http://host.docker.internal:3000` | Base URL of the mcpup app.                         |
| `MCPUP_API_TOKEN`     | yes      | —                                  | Per-revision token copied from the version page.   |
| `MCPUP_APP_DIR`       | no       | `/home/node/app`                   | Where the project is unpacked.                     |
| `PORT`                | no       | `8080`                             | Port the server listens on.                        |
| `HOST`                | no       | `0.0.0.0`                          | Bind address. Must not be `127.0.0.1` in Docker.   |
| `MCPUP_SKIP_BUILD`    | no       | `false`                            | Set to `true` to skip the build step.              |
| `MCPUP_FETCH_RETRIES` | no       | `5`                                | Download retry attempts.                           |
| `MCPUP_FETCH_TIMEOUT` | no       | `300`                              | Download timeout in seconds.                       |

### Changing the port

`EXPOSE 8080` is metadata only; it does not bind anything. Overriding `PORT`
also means changing the container side of `-p`:

```bash
docker run --rm -p 3000:3000 -e PORT=3000 \
  -e MCPUP_PROJECT_ID=<project-uuid> -e MCPUP_REVISION=1 \
  osamanj93/mcpup-bootstrap
```

## Extending

```dockerfile
FROM osamanj93/mcpup-bootstrap

ENV MCPUP_PROJECT_ID=<project-uuid> \
    MCPUP_REVISION=3
```

The entrypoint runs any command passed to the container instead of
`npm run start`, after the fetch/install/build steps:

```bash
docker run --rm osamanj93/mcpup-bootstrap pnpm run typecheck
```

## Publishing

```bash
docker login
docker buildx create --name mcpup --use --bootstrap   # one time
docker buildx build --platform linux/amd64,linux/arm64 \
  -t osamanj93/mcpup-bootstrap:latest \
  --push ./docker/bootstrap
```

`buildx --push` uploads the multi-arch manifest straight to the registry, so it
will not appear in `docker images`. Verify it with:

```bash
docker buildx imagetools inspect osamanj93/mcpup-bootstrap:latest
```
