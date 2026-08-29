FROM node:22-bookworm-slim

LABEL org.opencontainers.image.title="mcpup-bootstrap" \
    org.opencontainers.image.description="Restores an mcpup project revision from the mcpup API, installs, builds and runs it." \
    org.opencontainers.image.licenses="MIT"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates tini \
    && rm -rf /var/lib/apt/lists/*

RUN corepack enable

ENV MCPUP_APP_DIR=/home/node/app \
    MCPUP_API_URL=http://host.docker.internal:3000 \
    MCPUP_SKIP_BUILD=false \
    MCPUP_FETCH_RETRIES=5 \
    MCPUP_FETCH_TIMEOUT=300 \
    HOST=0.0.0.0 \
    PORT=8080

RUN mkdir -p "$MCPUP_APP_DIR" && chown node:node "$MCPUP_APP_DIR"

COPY bootstrap.mjs /opt/mcpup/bootstrap.mjs
COPY --chmod=0755 run.sh /opt/mcpup/run.sh

USER node
WORKDIR $MCPUP_APP_DIR

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
    CMD node -e "require('net').connect(process.env.PORT,'127.0.0.1').on('connect',()=>process.exit(0)).on('error',()=>process.exit(1))"

STOPSIGNAL SIGTERM

# tini reaps zombies and, with -g, signals the whole process group.
ENTRYPOINT ["/usr/bin/tini", "-g", "--", "/opt/mcpup/run.sh"]
CMD []
