# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## mono-one

Technical documentation (architecture, conventions, versions). Business documentation lives in `docs/`. Keep this file current when the architecture, a rule or a pinned version changes.

## Architecture

```
Browser ──tRPC──> web (SvelteKit 3: FE + BFF) ──tRPC/HTTP──> customer-service
                                              ──tRPC/HTTP──> order-service ──tRPC/HTTP──> customer-service
                                              ──tRPC/HTTP──> document-service
                                              ──tRPC/HTTP──> system-service (users + permissions)
order-service ──events.deliver (tRPC, instant, parallel)──> document-service, web
core services ──> Postgres (one database each)        web ──> Redis (JWT storage only)
```

- The browser only talks to `web`. The core services have no browseraccess and must stay on the private network (see Auth).
- `web` hosts the browser-facing tRPC router (`/trpc`) and receives events on `/events`. It forwards events to browsers with an SSE tRPC subscription (`live.orderPlaced`).
- Core services expose plain request/response tRPC under `/trpc`, events under `/events`, plus `/healthz` and `/readyz`. No WebSockets or subscriptions on core services.
- tRPC is mandatory for every typed request/response between client and server and between services.
- Everything is one Nx monorepo. Each app has its own Docker image.

### Apps and example endpoints

| App                | Port | Procedure                                                                               | Notes                                                                                  |
| ------------------ | ---- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `web`              | 3000 | `customers.get`, `orders.place`, `documents.get`, `live.orderPlaced` (SSE)              | proxies to the services; runs as exactly one instance                                  |
| `customer-service` | 3001 | `customers.get`                                                                         |                                                                                        |
| `order-service`    | 3002 | `orders.place`                                                                          | calls `customers.get` (forwarding the JWT), stores the order, publishes `order.placed` |
| `document-service` | 3003 | `documents.get`                                                                         | the document is created by the `order.placed` event                                    |
| `system-service`   | 3004 | `users.get`, `users.getMany`, `users.auth`, `users.add`, `users.update`, `users.delete` | users + flat permissions (see System service); later runtime configs, tasks, calendar  |

Directions: `web` -> all four, `order-service` -> `customer-service`. Demo data: `pnpm nx seed <svc>` (customer-service, order-service, system-service; see Data rules). The web `auth.login` tRPC mutation is the real login (`users.auth`, then an unsigned JWT with `sub`, `permissions`, `email`, `name` stored in Redis; it sets the `sid` cookie through `ctx.cookies`); seeded starter user `hello@mono.hu` / `hello` (`pnpm nx seed system-service`).

## Stack

| Area                          | Choice                                                                                                        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Monorepo                      | Nx 23 + pnpm, one root `package.json` and lockfile                                                            |
| Frontend + BFF                | SvelteKit 3 (Svelte 5), adapter-node                                                                          |
| Core services                 | plain Node + tRPC (`createHTTPHandler` on `node:http`), Awilix DI                                             |
| DB                            | PostgreSQL 18 + Drizzle ORM; migrations via drizzle-kit (SQL committed), applied by a separate `migrate` step |
| Redis                         | `web` only, JWT storage (`jwt:<sid>`, TTL = token lifetime). Not used for events or queues                    |
| Validation / config / logging | Zod 4, Zod-validated env (fail fast), pino                                                                    |
| Tests                         | Vitest + Testcontainers (real Postgres)                                                                       |
| Lint / format                 | ESLint 10 flat config (one root file), Prettier; `apps/web` has its own Prettier config                       |

### Versions

Pinned exactly (`save-exact`, committed `pnpm-lock.yaml`, `.nvmrc`, Docker tags); upgrade only deliberately, in a dedicated change, and re-run `lint typecheck test build`. Never use `latest` or ranges.

| Item                                | Version                            | Note                                                  |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| Node                                | 24.21.0                            | `.nvmrc`, `engines`, `node:24.21.0-slim`              |
| pnpm                                | 12.14.0                            | via Corepack (`packageManager`)                       |
| Nx and `@nx/*`                      | 23.3.0                             | all on one version (incl. `@nx/eslint`, `@nx/vitest`) |
| TypeScript                          | 6.0.3                              | not 7: SvelteKit 3 requires 6 and Nx needs the TS API |
| `@types/node`                       | 24.19.2                            | matches the Node 24 runtime                           |
| SvelteKit / Svelte / Vite           | 3.1.0 / 5.57.2 / 8.3.4             |                                                       |
| tRPC                                | 11.19.0                            |                                                       |
| Zod / Vitest / ESLint / Drizzle ORM | 4.6.7 / 5.0.5 / 10.13.0 / 0.45.4   |                                                       |
| Postgres / Redis images             | 18.6-alpine3.24 / 8.8.3-alpine3.23 | `docker-compose.yml`, `libs/testing.ts`               |

## Workspace layout

```
apps/web  apps/customer-service  apps/order-service  apps/document-service  apps/system-service
libs/
  customer-api  order-api  document-api  system-api                  contract.ts (Zod schemas, DTOs, service "port" interfaces) + server.ts (tRPC router, AppRouter type)
  config.ts logging.ts errors.ts db.ts seedIds.ts seeding.ts testing.ts  trpc/ migrations/   shared helpers, imported as @lib/<name>; not an Nx project
  events/   one Nx project, imported as @events/<file>: contract.ts (defineEvent, envelope, ServiceId, EventsRouter) registry.ts (EVENTS map) client.ts (publisher, events router) + one file per owning service (order.ts)
```

- Libs are source-consumed (not buildable); path mappings live in `tsconfig.base.json`; `apps/web/tsconfig.json` repeats them (relative to itself) because it extends `$app/tsconfig`, not the base, so a new alias goes into both files. No `baseUrl` (deprecated in TS 6); entries start with `./`.
- `*-api` libs hold the contract (`contract.ts`) and the router (`server.ts`) and have one entry point, `@api/<svc>` (`@api/*` maps to `libs/*-api/src/index.ts`; contract re-exports, `AppRouter` type, plus `appRouter` and the context type, which ESLint restricts to the owning service app). The router never imports from an app, so the Nx graph stays acyclic.
- Shared helpers (`@lib/*` maps to `./libs/*`; they sit directly in `libs/`, are not an Nx project (no tags, no targets) and import each other with relative paths): `config` (Zod env, base schema, secret redaction), `logging` (pino, request-ID child logger), `errors` (`DomainError`), `db` (Drizzle + pg pool, query logging, slow-query warning, ping, close), `migrations` (advisory-locked runner, `defineDrizzleConfig`), `trpc` (context, JWT decode, error mapping, client factory, server + shutdown helpers), `seedIds` (shared seed-id scale 1..100 per entity), `seeding` (seeder bootstrap), `testing` (Testcontainers helpers, tests only).

### Boundaries (root `eslint.config.mjs`)

- Tags: `type:app|api|events` and `scope:web|customer|order|document|events`. The `@lib` helpers have no tags: they are not an Nx project, so the rules do not check them.
- apps may depend on api and events; api and events depend on no tagged lib (only on the untagged `@lib` helpers); nothing depends on an app.
- Other apps import `@api/<svc>` types only (`consistent-type-imports`); `appRouter` and the context type are restricted to the owning app (`no-restricted-imports` with `importNames`). Callers never import another service's internals.
- One ESLint config covers services, libs and `apps/web` (Svelte rules are scoped to `apps/web`), so `web` cannot escape the rules.

## Per-service structure

```
apps/<svc>/src/  main.ts (start + shutdown)  app.ts (createApp: container + server, shared with tests)
  config.ts  container.ts  migrate.ts  seed.ts (core services with demo data)  trpc/context.ts  services/  events/  db/{schema,seed.ts,migrations,drizzle.config.ts}
```

- Business logic in `services/` implements the ports from `<svc>-api` (`contract.ts`, imported type-only); routers (in `<svc>-api`) validate input with the contract schemas and delegate through `ctx.services`.
- **Awilix**: root container at startup, a scoped container per request in `createContext` (carries the request-ID logger). Services get dependencies from the cradle and never import the container. The pg pool is disposed by `container.dispose()` on shutdown.
- **Errors**: throw `DomainError` (`@lib/errors`); mapped to `TRPCError` in one place (`createTRPC` in `libs/trpc`). Unknown errors are logged and masked. Downstream tRPC errors are re-raised with their code by `fromClientError`.
- **Logging**: one pino child logger per request with a request ID, forwarded in `x-request-id` on service calls.
- **Health**: `/healthz` (liveness), `/readyz` (Postgres ping). Graceful shutdown on SIGTERM/SIGINT: stop accepting, drain, close the pool.
- **Service clients** (`createServiceClient`) use `httpLink` with a per-call context `{ jwt, requestId }` and a timeout, not `httpBatchLink` (a batch would share one `authorization` header).

## Data rules

- Each service owns its database (separate `DATABASE_URL`, optional `DB_SCHEMA`); no service reads another's tables and there are no cross-service foreign keys. Cross-service data goes through tRPC. One pg pool per service with a deliberate size.
- Each service keeps its Drizzle schema, migrations and one-line `drizzle.config.ts` in its own app. `drizzle.config.ts` imports `defineDrizzleConfig` by relative path because drizzle-kit ignores tsconfig paths.
- Migrations run as a separate step (`pnpm nx run <svc>:migrate` (not `nx migrate`, that is Nx's built-in upgrade command), or `node migrate.mjs` in the image), under a Postgres advisory lock; the `__drizzle_migrations` table lives in the same schema as the tables (`DB_SCHEMA`, default `public`), not in drizzle's own `drizzle` schema. Change the schema, then `pnpm nx db-generate <svc>` and commit the SQL.
- **Seed data is code, never a migration.** `pnpm seed` / `pnpm nx seed <svc>` (tsx, not bundled into the images) wipes the service's tables and re-inserts deterministic demo rows; it refuses `NODE_ENV=production`. All seed ids come from `libs/seedIds.ts` (`seedId(entity, n)` / `seedIds(entity)`, n = 1..100, one UUID namespace per entity), so services reference each other's seed rows (an order's `customerId`) without reading each other's databases. New entity: add its prefix there; new seeded service: `src/db/seed.ts` (`seed(db)`) + `src/seed.ts` (`seedService`) + a `seed` target.

### Schema conventions (new schemas)

- Primary keys are autoincrement values, never UUIDs.
- Use foreign keys, with `ON DELETE CASCADE` where it makes sense; add proper indices and unique constraints.
- Table names are singular, never plural.
- Use `text` freely instead of `varchar(n)`.
- Enums: Drizzle enums on a text column (`text('col', { enum: [...] })`); never create Postgres enum types (`pgEnum`).
- The current schemas predate these rules (UUID ids, plural names). They will be dropped and recreated later, so do not retrofit them.

### Migration workflow (during development)

- Generate migrations (`pnpm nx db-generate <svc>`) only when explicitly asked, not after every schema change.
- Under development apply schema changes with `drizzle-kit push` only.

## System service

- `system-service` owns the `user` and `permission` tables (own database `mono_system`); `web` has no database and calls it over tRPC (`web` router `users.*` forwards the user's JWT). It is the home for later runtime-editable configs, user tasks and the calendar: keep one router namespace and one schema file per domain.
- `user`: `id`, `email` (unique, the login name, stored lowercase), `name` (not unique), `password` (unsalted SHA-256 hex via `services/password.ts`, one file to swap later), `created`, `updated`, `deleted` (null = active, soft delete). `permission`: `user_id` (FK, cascade), `name` (text enum `PERMISSIONS` from `libs/system-api/src/permissions.ts`), unique `(user_id, name)`. Flat permissions only, no roles.
- `users.get` / `users.getMany` (1..100 ids, order kept, unknown ids omitted) also return soft-deleted users (the `deleted` date is in the DTO); `users.auth` and `users.update` reject them. DTOs never carry the password. `users.add` / `update` / `delete` need the `user.admin` permission (`requirePermission` in `libs/trpc`, from the JWT `permissions` claim); `users.auth` is the only call without an identity.
- Its seed uses integer identities (restarted at 1: the starter user has id 1 with every permission), not `libs/seedIds.ts`, which is UUID-based; add a `seedIds` mapping only when another service must reference seed users.
- The schema imports `PERMISSIONS` by relative path from a dependency-free file because drizzle-kit ignores tsconfig paths (same reason as `drizzle.config.ts`; the import carries an eslint-disable).
- No committed migrations yet (see Migration workflow): create the tables with `pnpm migrate` (its `system-service:migrate` target runs `drizzle-kit push`, after `pnpm dev:infra`; an existing Postgres volume needs `CREATE DATABASE mono_system;` once because the init script only runs on an empty volume), then `pnpm nx seed system-service`. Tests create the tables with drizzle-kit's `pushSchema`. Compose has no `system-migrate` job; generate migrations and add it before deploying. `src/migrate.ts` (the image's `migrate.mjs`) exists only because the esbuild defaults bundle it; it needs generated migrations to be useful.

## Events (no bus, no persistence, no retry)

- Each event type has exactly one owning service: it defines the schema in its own file in `libs/events` (e.g. `order.ts`, `defineEvent`; CODEOWNERS gives that file to the owning team), is the only sender, and never subscribes to its own events. `@events/registry` holds the `EVENTS` map (owner, schema, subscribers) and the derived types `EventsOwnedBy<S>` / `EventsFor<S>`; a type check fails if an owner subscribes to itself. Current event: `order.placed` (owner `order-service`; subscribers `document-service`, `web`). `system-service` is a known `ServiceId` but owns and subscribes to nothing yet.
- `createPublisher(serviceId)` accepts only events the service owns (compile error otherwise), validates against the owner's schema, then calls every subscriber's `events.deliver` instantly and in parallel with a short timeout. It returns `{ delivered, failed }` and logs failures; counters via `failedDeliveries()`.
- `createEventsRouter(serviceId, handlers)` mounts `events.deliver` on `/events`. The handler map is typed from the registry (exactly the subscribed events), every event is validated against the owner's schema, and `x-service-id` must equal the registered owner (a consistency check, not security).
- Guarantees: best effort, at most once, unordered. Events are signals; the owner's database is the source of truth. Publish after the DB commit. Anything that must not be lost is a direct tRPC call whose result the caller checks. Avoid event cycles.
- `web` owns no events. Its handler emits to an in-memory bus that feeds the SSE subscription, so `web` must run as exactly one instance.
- To add an event: schema in the owner's file `libs/events/<svc>.ts` (add a CODEOWNERS entry if the service has none), register it in `@events/registry`, add handlers in each subscriber's `createEventsRouter`, publish from the owner after commit.

## Auth

- End users authenticate in `web` only (`hooks.server.ts`); the JWT is stored in Redis and sent to the core services as `authorization: Bearer <jwt>` on calls that need the user's identity (service-only calls omit it). Events never carry the JWT.
- **Core services decode the JWT without verifying it** (no signature, `aud`, `exp` or revocation check) and use the claims for authorization only (`ctx.identity`, `requireIdentity`). `x-service-id` is informational.
- This is safe only while the core services are reachable solely from `web` and other services (private network, no public port). `docker-compose.yml` publishes only `web`. If that changes, add verification in the shared tRPC identity middleware (`libs/trpc`); nothing else depends on it.
- Not a public API: an external consumer would need a REST/OpenAPI layer on top.

## SvelteKit 3 specifics

- Config is passed to the `sveltekit({...})` Vite plugin in `vite.config.ts` (no `svelte.config.js`). `tsconfig.json` extends `$app/tsconfig` (generated into `apps/web/node_modules/$app` by `svelte-kit sync`) and declares the `paths` aliases itself.
- **`apps/web/package.json` exists** (`name`, `type`, `imports` only, no dependencies; every dependency is in the root file). SvelteKit 3 has no `files` option so the app must run with `apps/web` as cwd, and `adapter-node` reads `package.json` from there. Run web tooling through root binaries (`nx`, or `PATH=$PWD/node_modules/.bin`), not `pnpm exec` inside `apps/web`.
- `#lib/*` maps to `apps/web/src/lib/*`; imports need the file extension (`#lib/server/session.ts`) because Node subpath patterns do no extension probing. `@nx/enforce-module-boundaries` allows `#lib`.
- v3 API: `Handle` comes from `@sveltejs/kit/hooks`; `$env/*` became `$app/env/*` (web reads `process.env` through the shared Zod config); `$lib` is gone. Remote functions are experimental and unused: tRPC is the client-server layer.
- `apps/web/vite.config.ts` marks every `libs/*-api/src/server.ts` as side-effect free, so the services' routers (re-exported by `@api/<svc>`) are tree-shaken out of the `web` bundle; the bundle holds only the contract schemas and no service code or database access (check: `grep -r "#region" dist/apps/web` after `nx build web` lists no `apps/` or `*-api/src/server.ts`, and no `drizzle`/`pg`).
- Browser tRPC client: `splitLink` (SSE `httpSubscriptionLink` for subscriptions, `httpBatchLink` otherwise).

## Tooling

- Prefer Nx over custom scripts: use targets, executors, `targetDefaults` and `nx run-many` before writing a custom script (there is no `tools/` directory); a script needs a reason Nx cannot cover.
- One root `package.json`, one `pnpm-lock.yaml`, no pnpm workspaces. `pnpm-workspace.yaml` only holds `allowBuilds` (pnpm 12 no longer reads the `pnpm` field) and declares no packages. `.npmrc`: `save-exact=true`. The only other `package.json` is `apps/web/package.json`.
- Nx needs `@nx/js` to build project-graph edges from TS imports. `lint` and `test` are inferred by the `@nx/eslint/plugin` and `@nx/vitest` plugins in `nx.json` `plugins` (from the root `eslint.config.mjs` and each `vitest.config.ts`; a project without a vitest config has no `test` target, `apps/web` is excluded from the vitest plugin because loading its SvelteKit `vite.config.ts` from the workspace root fails; the `test` default only forces `vitest run` so it never enters watch mode; `test-ci` is deliberately off, since atomized per-file targets would start one Testcontainers Postgres per file). The other targets are `nx:run-commands` (and `@nx/esbuild:esbuild` for service `build`) defined in `nx.json` `targetDefaults` (`typecheck`, `serve`, the esbuild defaults) and per-project `project.json` (`serve`, `build`, `migrate`, `db-generate`, `docker-build`). `docker-build` depends on `build`.
- `migrate` is the only root script that passes `--output-style=static` (Nx prints task logs inline instead of the TUI); `dev` uses `stream`.
- One root ESLint flat config covers everything, including the Svelte rules scoped to `apps/web` (`eslint-plugin-svelte`). Prettier: root config for services and libs; `apps/web` has its own (`prettier-plugin-svelte`, tabs), the nearest config wins.
- Type-only imports are always top-level `import type { X }`, never `import { type X }` (`consistent-type-imports` with `separate-type-imports`, `no-import-type-side-effects`, and `no-restricted-syntax` banning inline `type` specifiers). `verbatimModuleSyntax` is on.
- Code style: compact, arrow functions, no boilerplate; services single quotes, no semicolons; `apps/web` uses tabs.

## Commands

```bash
corepack enable && pnpm install
pnpm dev:infra          # postgres + redis only (docker-compose.dev.yml); the full stack is docker-compose.yml
pnpm env:init           # creates missing apps/*/.env from .env.example (first run only)
pnpm migrate            # nx run-many -t migrate --parallel=4 (run after dev:infra and after pulling schema changes)
pnpm seed               # nx run-many -t seed: wipes customer + order data and inserts demo rows (ids from libs/seedIds.ts); dev only
pnpm dev                # nx run-many -t serve: web + services with reload, prefixed output (no migrations)
pnpm all                # format + lint (both write/--fix) + typecheck + build (no tests); use format:check/lint:check for a read-only run
pnpm lint               # eslint --fix on all projects + the @lib helpers (not an Nx project)
pnpm lint:check         # same without --fix (what CI runs)
pnpm format             # nx format:write (Prettier)
pnpm format:check       # nx format:check (what CI runs)
pnpm nx run-many -t typecheck test build   # before finishing any change, together with `pnpm format` and `pnpm lint` (test needs Docker)
pnpm nx test <project> -- <file-filter> -t "<test name>"   # single test file/case; args after `--` go to `vitest run` (service tests need Docker)
pnpm nx affected -t lint typecheck test --base=main
pnpm nx graph
pnpm nx db-generate <svc>
pnpm nx run-many -t build && docker compose up -d --build   # full stack in Docker, web on :3000
```

- `pnpm dev` is `NX_NATIVE_COMMAND_RUNNER=false nx run-many -t serve --parallel=4 --output-style=stream` (`serve` is `continuous` in `nx.json`; `--output-style` keeps Nx out of the TUI and prefixes each line with the project). The env var is required: in a real terminal Nx otherwise runs each app in its own pseudo-terminal (raw mode, no carriage returns), which makes the interleaved output stair-step and garbled. `pnpm migrate` is a sequential `nx run-many -t migrate`. `nx serve <app>` runs one app.
- Config is env-driven and Zod-validated at startup (`.env.example` per app). Core services need `DATABASE_URL`; service URLs default to `localhost:300x`.

## Docker and CI

- Every app is fully bundled (`@nx/esbuild:esbuild` for services, configured once in `nx.json` `targetDefaults` and emitting `main.mjs`/`migrate.mjs` plus `migrations/`; adapter-node for `web`), so images contain only the bundle and migrations, no `node_modules`. Only `pg-native` (optional) stays external. Build context is the repo root after `nx build`; base image `node:24.21.0-slim`.
- `docker-compose.yml`: Postgres (one database per service, created by `docker/postgres-init.sql`), Redis, one-off migration jobs, the three services and `web`.
- CI (`.github/workflows/ci.yml`, Node from `.nvmrc`): `pnpm format:check`, `pnpm lint:check` (nx lint + @lib helpers), `nx run-many -t typecheck test`, `build`, `docker-build` (everything on every run, not only affected projects). Pushing images to a registry is not set up yet. Deployment/Kubernetes is out of scope.

## Affected builds

Callers depend on `*-api`, not on service apps, so internal service changes do not ripple outward: a change inside `order-service` affects only it; `customer-api` affects `customer-service`, `order-service`, `web`; `events` affects every app that uses events; `libs/*.ts`, `libs/trpc` and `libs/migrations` affect everything (listed in `sharedGlobals` in `nx.json`). Keep API changes additive: services deploy independently and type safety is compile-time only.

## Not done yet

Registry push in CI, husky/lint-staged, OpenTelemetry tracing, real service domains (customer, order and document services are examples).
