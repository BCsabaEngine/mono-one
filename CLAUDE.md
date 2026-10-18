# mono-one

Technical documentation (architecture, conventions, versions). Business documentation lives in `docs/`. Keep this file current when the architecture, a rule or a pinned version changes.

## Architecture

```
Browser ──tRPC──> web (SvelteKit 3: FE + BFF) ──tRPC/HTTP──> customer-service
                                              ──tRPC/HTTP──> order-service ──tRPC/HTTP──> customer-service
                                              ──tRPC/HTTP──> document-service
order-service ──events.deliver (tRPC, instant, parallel)──> document-service, web
core services ──> Postgres (one database each)        web ──> Redis (JWT storage only)
```

- The browser only talks to `web`. The core services have no browser access and must stay on the private network (see Auth).
- `web` hosts the browser-facing tRPC router (`/trpc`) and receives events on `/events`. It forwards events to browsers with an SSE tRPC subscription (`live.orderPlaced`).
- Core services expose plain request/response tRPC under `/trpc`, events under `/events`, plus `/healthz` and `/readyz`. No WebSockets or subscriptions on core services.
- tRPC is mandatory for every typed request/response between client and server and between services.
- Everything is one Nx monorepo. Each app has its own Docker image.

### Apps and example endpoints

| App                | Port | Procedure                                                                  | Notes                                                                                  |
| ------------------ | ---- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `web`              | 3000 | `customers.get`, `orders.place`, `documents.get`, `live.orderPlaced` (SSE) | proxies to the services; runs as exactly one instance                                  |
| `customer-service` | 3001 | `customers.get`                                                            |                                                                                        |
| `order-service`    | 3002 | `orders.place`                                                             | calls `customers.get` (forwarding the JWT), stores the order, publishes `order.placed` |
| `document-service` | 3003 | `documents.get`                                                            | the document is created by the `order.placed` event                                    |

Directions: `web` -> all three, `order-service` -> `customer-service`. Demo data: `customer-service` migration `0001_seed_demo_customer` (remove before real use). The web `/auth/dev-login` route (behind `ENABLE_DEV_LOGIN`) mints an unsigned demo JWT; replace it with the real login flow and keep the flag off in production.

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
| Lint / format                 | ESLint 10 flat config, Prettier; `apps/web` has its own configs                                               |

### Versions

Pinned exactly (`save-exact`, committed `pnpm-lock.yaml`, `.node-version`, Docker tags); upgrade only deliberately, in a dedicated change, and re-run `lint typecheck test build`. Never use `latest` or ranges.

| Item                                | Version                            | Note                                                  |
| ----------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| Node                                | 24.21.0                            | `.node-version`, `engines`, `node:24.21.0-slim`       |
| pnpm                                | 12.14.0                            | via Corepack (`packageManager`)                       |
| Nx and `@nx/*`                      | 23.3.0                             | all on one version                                    |
| TypeScript                          | 6.0.3                              | not 7: SvelteKit 3 requires 6 and Nx needs the TS API |
| `@types/node`                       | 24.19.2                            | matches the Node 24 runtime                           |
| SvelteKit / Svelte / Vite           | 3.1.0 / 5.57.2 / 8.3.4             |                                                       |
| tRPC                                | 11.19.0                            |                                                       |
| Zod / Vitest / ESLint / Drizzle ORM | 4.6.7 / 5.0.5 / 10.13.0 / 0.45.4   |                                                       |
| Postgres / Redis images             | 18.6-alpine3.24 / 8.8.3-alpine3.23 | `docker-compose.yml`, `libs/shared/testing`           |

## Workspace layout

```
apps/web  apps/customer-service  apps/order-service  apps/document-service
libs/
  customer-contract  order-contract  document-contract   Zod schemas, DTOs, service "port" interfaces (leaf)
  customer-api  order-api  document-api                  tRPC router + AppRouter type, delegates to ports via context
  shared/config logging errors db migrations trpc testing
  events-contract  order-events  events-registry  events-client
tools/   eslint/boundaries.mjs, build-app.mjs, dev.mjs
```

- Libs are source-consumed (not buildable); path mappings live in `tsconfig.paths.json` (shared by `tsconfig.base.json` and `apps/web/tsconfig.json`). No `baseUrl` (deprecated in TS 6); entries start with `./`.
- `*-api` libs have two entry points: `@mono/<svc>-api` (types only: `AppRouter` + contract re-exports) and `@mono/<svc>-api/server` (`appRouter`, context type; only for the owning service). The router never imports from an app, so the Nx graph stays acyclic.
- Shared libs: `config` (Zod env, base schema, secret redaction), `logging` (pino, request-ID child logger), `errors` (`DomainError`), `db` (Drizzle + pg pool, query logging, slow-query warning, ping, close), `migrations` (advisory-locked runner, `defineDrizzleConfig`), `trpc` (context, JWT decode, error mapping, client factory, server + shutdown helpers), `testing` (Testcontainers helpers, tests only).

### Boundaries (`tools/eslint/boundaries.mjs`)

- Tags: `type:app|api|contract|shared|registry|events-client` and `scope:web|customer|order|document|shared|registry`.
- apps may depend on api, contract, shared, registry, events-client; api and contract only on contract and shared; shared only on shared; the registry only on contract libs; nothing depends on an app.
- Other apps import `@mono/<svc>-api` types only (`consistent-type-imports`); `/server` is restricted to the owning app (`no-restricted-imports`). Callers never import another service's internals.
- Both ESLint configs import the same boundaries module, so `web` cannot escape the rules.
- `events-client` is tagged `type:events-client`, `scope:registry` because Nx applies every matching constraint.

## Per-service structure

```
apps/<svc>/src/  main.ts (start + shutdown)  app.ts (createApp: container + server, shared with tests)
  config.ts  container.ts  migrate.ts  trpc/context.ts  services/  events/  db/{schema,migrations,drizzle.config.ts}
```

- Business logic in `services/` implements the ports from `<svc>-contract`; routers (in `<svc>-api`) validate input with the contract schemas and delegate through `ctx.services`.
- **Awilix**: root container at startup, a scoped container per request in `createContext` (carries the request-ID logger). Services get dependencies from the cradle and never import the container. The pg pool is disposed by `container.dispose()` on shutdown.
- **Errors**: throw `DomainError` (`@mono/shared-errors`); mapped to `TRPCError` in one place (`createTRPC` in `shared/trpc`). Unknown errors are logged and masked. Downstream tRPC errors are re-raised with their code by `fromClientError`.
- **Logging**: one pino child logger per request with a request ID, forwarded in `x-request-id` on service calls. pino-pretty only in development.
- **Health**: `/healthz` (liveness), `/readyz` (Postgres ping). Graceful shutdown on SIGTERM/SIGINT: stop accepting, drain, close the pool.
- **Service clients** (`createServiceClient`) use `httpLink` with a per-call context `{ jwt, requestId }` and a timeout, not `httpBatchLink` (a batch would share one `authorization` header).

## Data rules

- Each service owns its database (separate `DATABASE_URL`, optional `DB_SCHEMA`); no service reads another's tables and there are no cross-service foreign keys. Cross-service data goes through tRPC. One pg pool per service with a deliberate size.
- Each service keeps its Drizzle schema, migrations and one-line `drizzle.config.ts` in its own app. `drizzle.config.ts` imports `defineDrizzleConfig` by relative path because drizzle-kit ignores tsconfig paths.
- Migrations run as a separate step (`nx migrate <svc>`, or `node migrate.js` in the image), under a Postgres advisory lock. Change the schema, then `pnpm nx db-generate <svc>` and commit the SQL.

## Events (no bus, no persistence, no retry)

- Each event type has exactly one owning service: it defines the schema in its own `<owner>-events` lib (`defineEvent`), is the only sender, and never subscribes to its own events. `events-registry` holds the `EVENTS` map (owner, schema, subscribers) and the derived types `EventsOwnedBy<S>` / `EventsFor<S>`; a type check fails if an owner subscribes to itself. Current event: `order.placed` (owner `order-service`; subscribers `document-service`, `web`).
- `createPublisher(serviceId)` accepts only events the service owns (compile error otherwise), validates against the owner's schema, then calls every subscriber's `events.deliver` instantly and in parallel with a short timeout. It returns `{ delivered, failed }` and logs failures; counters via `failedDeliveries()`.
- `createEventsRouter(serviceId, handlers)` mounts `events.deliver` on `/events`. The handler map is typed from the registry (exactly the subscribed events), every event is validated against the owner's schema, and `x-service-id` must equal the registered owner (a consistency check, not security).
- Guarantees: best effort, at most once, unordered. Events are signals; the owner's database is the source of truth. Publish after the DB commit. Anything that must not be lost is a direct tRPC call whose result the caller checks. Avoid event cycles.
- `web` owns no events. Its handler emits to an in-memory bus that feeds the SSE subscription, so `web` must run as exactly one instance.
- To add an event: schema in the owner's `*-events` lib (create the lib, CODEOWNERS entry, tags and path mapping if the service has none), register it in `events-registry`, add handlers in each subscriber's `createEventsRouter`, publish from the owner after commit.

## Auth

- End users authenticate in `web` only (`hooks.server.ts`); the JWT is stored in Redis and sent to the core services as `authorization: Bearer <jwt>` on calls that need the user's identity (service-only calls omit it). Events never carry the JWT.
- **Core services decode the JWT without verifying it** (no signature, `aud`, `exp` or revocation check) and use the claims for authorization only (`ctx.identity`, `requireIdentity`). `x-service-id` is informational.
- This is safe only while the core services are reachable solely from `web` and other services (private network, no public port). `docker-compose.yml` publishes only `web`. If that changes, add verification in the shared tRPC identity middleware (`shared/trpc`); nothing else depends on it.
- Not a public API: an external consumer would need a REST/OpenAPI layer on top.

## SvelteKit 3 specifics

- Config is passed to the `sveltekit({...})` Vite plugin in `vite.config.ts` (no `svelte.config.js`). `tsconfig.json` extends `$app/tsconfig` (generated into `apps/web/node_modules/$app` by `svelte-kit sync`) plus `../../tsconfig.paths.json`.
- **`apps/web/package.json` exists** (`name`, `type`, `imports` only, no dependencies; every dependency is in the root file). SvelteKit 3 has no `files` option so the app must run with `apps/web` as cwd, and `adapter-node` reads `package.json` from there. Run web tooling through root binaries (`nx`, or `PATH=$PWD/node_modules/.bin`), not `pnpm exec` inside `apps/web`.
- `#lib/*` maps to `apps/web/src/lib/*`; imports need the file extension (`#lib/server/session.ts`) because Node subpath patterns do no extension probing. `@nx/enforce-module-boundaries` allows `#lib`.
- v3 API: `Handle` comes from `@sveltejs/kit/hooks`; `$env/*` became `$app/env/*` (web reads `process.env` through the shared Zod config); `$lib` is gone. Remote functions are experimental and unused: tRPC is the client-server layer.
- Browser tRPC client: `splitLink` (SSE `httpSubscriptionLink` for subscriptions, `httpBatchLink` otherwise).

## Tooling

- One root `package.json`, one `pnpm-lock.yaml`, no pnpm workspaces. `pnpm-workspace.yaml` only holds `allowBuilds` (pnpm 12 no longer reads the `pnpm` field) and declares no packages. `.npmrc`: `save-exact=true`. The only other `package.json` is `apps/web/package.json`.
- Nx needs `@nx/js` to build project-graph edges from TS imports. Targets are plain `nx:run-commands` defined in `nx.json` `targetDefaults` (`typecheck`, `lint`, `test`) and per-project `project.json` (`serve`, `build`, `migrate`, `db-generate`, `docker-build`). `docker-build` depends on `build`.
- Root ESLint flat config and Prettier config cover services and libs; `apps/web` has its own (`eslint-plugin-svelte`, `prettier-plugin-svelte`, tabs). Prettier uses the nearest config.
- Code style: compact, arrow functions, no boilerplate; services single quotes, no semicolons; `apps/web` uses tabs.

## Commands

```bash
corepack enable && pnpm install
pnpm dev:infra          # postgres + redis in Docker
pnpm dev                # creates missing .env files, migrates, serves web + services with reload
pnpm nx run-many -t lint typecheck test build   # before finishing any change (test needs Docker)
pnpm nx affected -t lint typecheck test --base=main
pnpm nx format:check
pnpm nx graph
pnpm nx db-generate <svc>
pnpm nx run-many -t build && docker compose up -d --build   # full stack in Docker, web on :3000
```

- `pnpm dev` (`tools/dev.mjs`) starts the apps directly, not through `nx run-many`: every Nx task run switches the terminal to raw mode and garbles the interleaved output. It reads the `serve`/`migrate` commands from each `project.json`. `nx serve <app>` still works for one app.
- Config is env-driven and Zod-validated at startup (`.env.example` per app). Core services need `DATABASE_URL`; service URLs default to `localhost:300x`.

## Docker and CI

- Every app is fully bundled (esbuild via `tools/build-app.mjs` for services; adapter-node for `web`), so images contain only the bundle and migrations, no `node_modules`. Only `pg-native` (optional) and `pino-pretty` (dev only) stay external. Build context is the repo root after `nx build`; base image `node:24.21.0-slim`.
- `docker-compose.yml`: Postgres (one database per service, created by `docker/postgres-init.sql`), Redis, one-off migration jobs, the three services and `web`.
- CI (`.github/workflows/ci.yml`, Node from `.node-version`): `nx format:check`, `nx affected -t lint typecheck test`, `build`, `docker-build`. Pushing images to a registry is not set up yet. Deployment/Kubernetes is out of scope.

## Affected builds

Callers depend on `*-api`, not on service apps, so internal service changes do not ripple outward: a change inside `order-service` affects only it; `customer-api` affects `customer-service`, `order-service`, `web`; `events-contract`, `events-registry` or `order-events` affect every app that uses events; `shared/*` affects everything. Keep API changes additive: services deploy independently and type safety is compile-time only.

## Not done yet

Registry push in CI, husky/lint-staged, OpenTelemetry tracing, a real login flow, real service domains (the three services are examples).
