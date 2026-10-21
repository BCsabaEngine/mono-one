# Build context: repo root (sources are compiled in the builder stage; the bundle is self-contained, no node_modules needed at runtime).
ARG NODE_IMAGE=node:24.22.0-alpine3.24


# ---- builder: install dependencies, compile the bundle ----
FROM ${NODE_IMAGE} AS builder

WORKDIR /app

ENV CI=true NX_DAEMON=false COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

# dependency manifests first, so source edits keep the install layer cached
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/package.json

RUN --mount=type=cache,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile

COPY . .

RUN --mount=type=cache,target=/app/.nx/cache pnpm nx build system-service


# ---- runner: the bundle only ----
FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production MIGRATIONS_DIR=/app/migrations PORT=3004

COPY --from=builder /app/dist/apps/system-service ./

USER node

EXPOSE 3004

CMD ["node", "main.mjs"]
