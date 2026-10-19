# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## mono-one

Technical documentation (architecture, conventions, versions). Business documentation lives in `docs/`. Keep this file current when the architecture, a rule or a pinned version changes.

## Architecture

```
Browser ──tRPC──> web (SvelteKit 3: FE + BFF) ──tRPC/HTTP──> customer-service
                                              ──tRPC/HTTP──> order-service ──tRPC/HTTP──> customer-service
                                              ──tRPC/HTTP──> document-service ──tRPC/HTTP──> order-service, customer-service
                                              ──tRPC/HTTP──> system-service (users + permissions)
order-service ──events.deliver (tRPC, instant, parallel)──> web
customer/order/system-service ──> Postgres (one database each; document-service has none)        web ──> Redis (JWT storage only)
```

- The browser only talks to `web`. The core services have no browseraccess and must stay on the private network (see Auth).
- `web` hosts the browser-facing tRPC router (`/trpc`) and receives events on `/events`. It forwards events to browsers with an SSE tRPC subscription (`live.orderPlaced`).
- Core services expose plain request/response tRPC under `/trpc`, events under `/events`, plus `/healthz` and `/readyz`. No WebSockets or subscriptions on core services.
- tRPC is mandatory for every typed request/response between client and server and between services.
- Everything is one Nx monorepo. Each app has its own Docker image.

### Apps and example endpoints

| App                | Port | Procedure                                                                                                                                                  | Notes                                                                                                          |
| ------------------ | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `web`              | 3000 | `auth.*`, `customers.*`, `addresses.*`, `contacts.*`, `orders.*`, `orderDetails.*`, `documents.generateOrderDocument`, `users.*`, `live.orderPlaced` (SSE) | admin UI + BFF: forwards to the services (see Web UI); runs as exactly one instance                            |
| `customer-service` | 3001 | `customers.get/list/add/update/delete`, `addresses.*`, `contacts.*`                                                                                        | customers with addresses and contacts (see Customer service); `web` forwards all of it plus `byIds` and `page` |
| `order-service`    | 3002 | `orders.create/get/list/delete`, `orderDetails.add/delete`                                                                                                 | orders with details (see Order service); `web` forwards `create/get/list/delete` and `orderDetails.*`          |
| `document-service` | 3003 | `documents.generateOrderDocument`                                                                                                                          | renders an order document on demand, no database (see Document service)                                        |
| `system-service`   | 3004 | `users.get`, `users.getMany`, `users.auth`, `users.add`, `users.update`, `users.delete`                                                                    | users + flat permissions (see System service); later runtime configs, tasks, calendar                          |

Directions: `web` -> all four, `order-service` -> `customer-service`, `document-service` -> `order-service` and `customer-service`. Demo data: `pnpm nx dev:seed <svc>` (customer-service, order-service, system-service; see Data rules). The web `auth.login` tRPC mutation is the real login (`users.auth`, then an unsigned JWT with `sub`, `permissions`, `email`, `name` stored in Redis; it sets the `sid` cookie through `ctx.cookies`; `auth.logout` deletes the Redis entry and the cookie); seeded starter user `hello@mono.hu` / `hello` (`pnpm nx dev:seed system-service`).

## Stack

| Area                          | Choice                                                                                                    |
| ----------------------------- | --------------------------------------------------------------------------------------------------------- |
| Monorepo                      | Nx 23 + pnpm, one root `package.json` and lockfile                                                        |
| Frontend + BFF                | SvelteKit 3 (Svelte 5), adapter-node                                                                      |
| Web UI                        | flowbite-svelte 2 (components, props only), svstate (forms), Tailwind CSS only as flowbite's build engine |
| Core services                 | plain Node + tRPC (`createHTTPHandler` on `node:http`), Awilix DI                                         |
| DB                            | PostgreSQL 18 + Drizzle ORM; schema applied with `drizzle-kit push` (no committed migrations yet)         |
| Redis                         | `web` only, JWT storage (`jwt:<sid>`, TTL = token lifetime). Not used for events or queues                |
| Validation / config / logging | Zod 4, Zod-validated env (fail fast), pino                                                                |
| Tests                         | Vitest + Testcontainers (real Postgres)                                                                   |
| Lint / format                 | ESLint 10 flat config (one root file), Prettier; `apps/web` has its own Prettier config                   |

### Versions

Pinned exactly (`save-exact`, committed `pnpm-lock.yaml`, `.nvmrc`, Docker tags); upgrade only deliberately, in a dedicated change, and re-run `lint typecheck test build`. Never use `latest` or ranges.

| Item                                 | Version                            | Note                                                  |
| ------------------------------------ | ---------------------------------- | ----------------------------------------------------- |
| Node                                 | 24.21.0                            | `.nvmrc`, `engines`, `node:24.21.0-slim`              |
| pnpm                                 | 12.14.0                            | via Corepack (`packageManager`)                       |
| Nx and `@nx/*`                       | 23.3.0                             | all on one version (incl. `@nx/eslint`, `@nx/vitest`) |
| TypeScript                           | 6.0.3                              | not 7: SvelteKit 3 requires 6 and Nx needs the TS API |
| `@types/node`                        | 24.19.2                            | matches the Node 24 runtime                           |
| SvelteKit / Svelte / Vite            | 3.1.0 / 5.57.2 / 8.3.4             |                                                       |
| flowbite-svelte / flowbite           | 2.0.0-next.14 / 4.0.2              | v2 is a prerelease (`next` tag): bump deliberately    |
| Tailwind CSS (+ `@tailwindcss/vite`) | 4.3.3                              | engine for flowbite-svelte only, see Web UI           |
| flowbite-svelte-icons / svstate      | 3.1.0 / 2.1.0                      |                                                       |
| tRPC                                 | 11.19.0                            |                                                       |
| Zod / Vitest / ESLint / Drizzle ORM  | 4.6.7 / 5.0.5 / 10.13.0 / 0.45.4   |                                                       |
| Postgres / Redis images              | 18.6-alpine3.24 / 8.8.3-alpine3.23 | `docker-compose.yml`, `libs/testing.ts`               |

## Workspace layout

```
apps/web  apps/customer-service  apps/order-service  apps/document-service  apps/system-service
libs/
  customer-api  order-api  document-api  system-api                  contract.ts (Zod schemas, DTOs, service "port" interfaces) + server.ts (tRPC router, AppRouter type)
  config.ts logging.ts errors.ts db.ts seedIds.ts seeding.ts testing.ts  trpc/ migrations/   shared helpers, imported as @lib/<name>; not an Nx project
  events/   one Nx project, imported as @events/<file>: contract.ts (defineEvent, envelope, ServiceId, EventsRouter) registry.ts (EVENTS map) client.ts (publisher, events router) + one file per owning service (order.ts)
```

- Libs are source-consumed (not buildable); path mappings live in `tsconfig.base.json`; `apps/web/tsconfig.json` repeats them (relative to itself) because it extends `$app/tsconfig`, not the base, so a new alias goes into both files. No `baseUrl` (deprecated in TS 6); entries start with `./`. `@domain/*` maps to `libs/*-api/src/domain.ts`, the dependency-free code-only lists (only `customer-api` has one): the browser takes `ADDRESS_TYPES` etc. from there, because `@api/<svc>` also re-exports the service router (and `node:crypto`), which breaks the dev client.
- `*-api` libs hold the contract (`contract.ts`) and the router (`server.ts`) and have one entry point, `@api/<svc>` (`@api/*` maps to `libs/*-api/src/index.ts`; contract re-exports, `AppRouter` type, plus `appRouter` and the context type, which ESLint restricts to the owning service app). The router never imports from an app, so the Nx graph stays acyclic.
- Shared helpers (`@lib/*` maps to `./libs/*`; they sit directly in `libs/`, are not an Nx project (no tags, no targets) and import each other with relative paths): `constants` (import-free: service ids and ports `SERVICE_PORTS`, header names, paths, trace/call-chain patterns, `DEFAULT_DB_SCHEMA`, batch/page limits), `permissions` (import-free `PERMISSIONS` list, also loaded by the system schema), `zod` (`id`, `text`, `idInput`, `idsInput`, `deletedSchema` shared by the `*-api` contracts), `stamps` (`toStamps`, `inIdOrder`), `config` (Zod env, base schema, `serviceEnv(id)`, secret redaction), `logging` (pino, trace child logger), `errors` (`DomainError`), `db` (Drizzle + pg pool, query logging, slow-query warning, ping, close, `Db`, `Executor`, `withServiceDb` for migrate/seed scripts), `migrations` (advisory-locked runner, `defineDrizzleConfig`), `trpc` (context, JWT decode, error mapping + `notFoundOr`, client factory, server + shutdown helpers, and `service.ts`: `runService`, `scopedContext`, `applyOverrides`, `baseRegistrations`, `databaseRegistration`, `serviceClientRegistration`), `businessColumns` (`businessTimestampColumnsSoftDelete`: `createdAt` / `updatedAt` / `deletedAt` for every business table, `businessTimestampColumns` without `deletedAt` for hard-deleted tables; schemas import it by relative path because drizzle-kit ignores tsconfig paths), `seedIds` (shared seed-id scale 1..100 per entity), `databaseUrl` (import-free `databaseUrlEnv`: `DATABASE_URL` from `DATABASE_URL_<SERVICE_ID>`), `seeding` (seeder bootstrap), `testing` (Testcontainers helpers, tests only). `libs/tsconfig.json` (extends the base, includes `*.ts`, `trpc`, `migrations`) exists only so the editor resolves `@types/node` for them; no Nx target uses it.

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

- Bootstrap is shared, so the files above stay short: `main.ts` is `runService({ loadConfig, createApp })`, `config.ts` extends `baseEnvSchema` / `commonEnvSchema` with `serviceEnv('<svc>')` (id and port from `SERVICE_PORTS` in `libs/constants.ts`), `container.ts` spreads `baseRegistrations` and uses `databaseRegistration(schema)` / `serviceClientRegistration<Router>('X_SERVICE_URL')`, `trpc/context.ts` calls `scopedContext<Dependencies>(container, headers)`, `migrate.ts` is `migrateService('<svc>')` and `drizzle.config.ts` is `defineDrizzleConfig('<svc>')`. Constants (ports, header names, paths, limits) live in `libs/constants.ts`, never inline.
- Business logic in `services/` implements the ports from `<svc>-api` (`contract.ts`, imported type-only); routers (in `<svc>-api`) validate input with the contract schemas and delegate through `ctx.services`.
- **Awilix**: root container at startup, a scoped container per request in `createContext` (carries the trace logger). Services get dependencies from the container's `Dependencies` and never import the container: each dependency is a `private readonly` field assigned from the destructured constructor argument (`constructor({ database, log }: Pick<Dependencies, 'database' | 'log'>)`), no `deps` bag. The pg pool is disposed by `container.dispose()` on shutdown.
- **Errors**: throw `DomainError` (`@lib/errors`); mapped to `TRPCError` in one place (`createTRPC` in `libs/trpc`). Unknown errors are logged and masked. Downstream tRPC errors are re-raised with their code by `fromClientError`.
- **Logging**: one pino child logger per request (`withTrace`) with `traceId`, `callChain` (e.g. `web>order-service>customer-service`) and `userId` (JWT `sub`, when there is an identity). `traceId` is taken from the incoming `x-trace-id` header if it matches `^[\w-]{8,64}$`, else generated (web accepts it from the browser too); `x-call-chain` carries the services passed so far and each service appends its own `SERVICE_ID` in `baseContextFromHeaders`. Both are forwarded on every service call (`callContextOf(ctx)`). The `createTRPC` middleware logs one `rpc` line per procedure call (`path`, `ok`, `code`, `ms`): info for mutations (modifications are work), debug for queries. It also runs the call inside `runWithLog`, so the `sql` trace lines (set `LOG_LEVEL=trace` to see them) and slow-query warnings of `libs/db.ts` (`currentLog`) carry the same `traceId` / `callChain` / `userId`; `grep <traceId>` across the services shows the whole chain. With `NODE_ENV=development` `createLogger({ pretty: true })` prints `pino-pretty` lines without time, pid, hostname, service, version and userId (traceId shortened to 8 chars); images run with `NODE_ENV=production` and log JSON. The root `.env.example` sets `LOG_LEVEL=debug` for dev. Events carry no JWT: the envelope has `traceId` and an optional `userId` (log correlation only), the call chain travels in the header. Do not log another field called `userId` for a different user (use e.g. `targetUserId`).
- **Health**: `/healthz` (liveness), `/readyz` (Postgres ping). Graceful shutdown on SIGTERM/SIGINT: stop accepting, drain, close the pool.
- **Service clients** (`createServiceClient`) use `httpLink` with a per-call context `{ jwt, traceId, callChain }` and a timeout, not `httpBatchLink` (a batch would share one `authorization` header).

## Data rules

- Each service with data owns its database (`document-service` has none; separate `DATABASE_URL`, optional `DB_SCHEMA`); no service reads another's tables and there are no cross-service foreign keys. Cross-service data goes through tRPC. One pg pool per service with a deliberate size.
- Each service keeps its Drizzle schema, migrations and one-line `drizzle.config.ts` in its own app. `drizzle.config.ts` imports `defineDrizzleConfig` by relative path because drizzle-kit ignores tsconfig paths.
- No service has committed migrations during development: `pnpm dev:migrate` / `pnpm nx dev:migrate <svc>` (local only; not `nx migrate`, that is Nx's built-in upgrade command) runs `drizzle-kit push`. The migration runner stays for later (`libs/migrations`: advisory-locked, `__drizzle_migrations` in the same schema as the tables (`DB_SCHEMA`, default `public`); `node migrate.mjs` in the image, `pnpm nx db-generate <svc>`). When migrations come back: generate and commit the SQL per service, add a real `migrate` target running `src/migrate.ts` (`dev:migrate` stays the local push) and re-add the compose migrate jobs.
- **Seed data is code, never a migration.** `pnpm dev:seed` / `pnpm nx dev:seed <svc>` (tsx, not bundled into the images) wipes the service's tables and re-inserts deterministic demo rows; it refuses `NODE_ENV=production`. Seed ids come from `libs/seedIds.ts` (`seedId(entity, n)` / `seedIds(entity)`, n = 1..100, one UUID namespace per entity) for UUID-keyed entities; integer-identity services (system, customer, order) restart their identities at 1 and seed 1..100, so an order's `customerId` n refers to customer n without reading the other database. New entity: add its prefix there; new seeded service: `src/db/seed.ts` (`seed(db)`) + `src/seed.ts` (`seedService`) + a `dev:seed` target.

### Schema conventions (new schemas)

- Primary keys are autoincrement values, never UUIDs.
- Use foreign keys, with `ON DELETE CASCADE` where it makes sense; add proper indices and unique constraints.
- Table names are singular, never plural.
- Use `text` freely instead of `varchar(n)`.
- Enums: Drizzle enums on a text column (`text('col', { enum: [...] })`); never create Postgres enum types (`pgEnum`).
- Every business table has `created_at` and `updated_at` (timestamptz, not null, default now; `updated_at` refreshed on every update) and, only if it uses soft delete, a nullable `deleted_at` (null = active). Drizzle properties: `createdAt` / `updatedAt` / `deletedAt`; spread `businessTimestampColumnsSoftDelete` from `libs/businessColumns.ts` (`businessTimestampColumns` for tables that are hard deleted).
- The current schemas predate these rules (UUID ids, plural names). They will be dropped and recreated later, so do not retrofit them.

### Migration workflow (during development)

- Generate migrations (`pnpm nx db-generate <svc>`) only when explicitly asked, not after every schema change.
- Under development apply schema changes with `drizzle-kit push` only.

## System service

- `system-service` owns the `user` and `permission` tables (own database `mono_system`); `web` has no database and calls it over tRPC (`web` router `users.*` forwards the user's JWT). It is the home for later runtime-editable configs, user tasks and the calendar: keep one router namespace and one schema file per domain.
- `user`: `id`, `email` (unique, the login name, stored lowercase), `name` (not unique), `password` (unsalted SHA-256 hex via `services/password.ts`, one file to swap later), `created_at`, `updated_at`, `deleted_at` (null = active, soft delete; `businessTimestampColumnsSoftDelete`). `permission`: `user_id` (FK, cascade), `name` (text enum `PERMISSIONS` from `libs/permissions.ts`), unique `(user_id, name)`. Flat permissions only, no roles.
- `users.get` / `users.getMany` (1..100 ids, order kept, unknown ids omitted) also return soft-deleted users (the `deletedAt` date is in the DTO); `users.auth` and `users.update` reject them. DTOs never carry the password. `users.add` / `update` / `delete` need the `user.admin` permission (`requirePermission` in `libs/trpc`, from the JWT `permissions` claim); `users.auth` is the only call without an identity.
- Its seed uses integer identities (restarted at 1: the starter user has id 1 with every permission), not `libs/seedIds.ts`, which is UUID-based; add a `seedIds` mapping only when another service must reference seed users.
- The schema imports `PERMISSIONS` by relative path from a dependency-free file because drizzle-kit ignores tsconfig paths (same reason as `drizzle.config.ts`; the import carries an eslint-disable).
- No committed migrations yet (see Migration workflow): create the tables with `pnpm dev:migrate` (every service's `dev:migrate` target runs `drizzle-kit push`, after `pnpm dev:infra`; an existing Postgres volume needs `CREATE DATABASE mono_system;` once because the init script only runs on an empty volume), then `pnpm nx dev:seed system-service`. Tests create the tables with drizzle-kit's `pushSchema`. Compose has no migrate jobs; generate migrations and add them before deploying. `src/migrate.ts` (the image's `migrate.mjs`) exists only because the esbuild defaults bundle it; it needs generated migrations to be useful.

## Customer service

- `customer-service` owns `customer`, `address` and `contact` (database `mono_customer`); one service/router namespace per table (`customers`, `addresses`, `contacts`). All three have `created_at`, `updated_at`, `deleted_at` (soft delete); children cascade only on a hard delete; soft-deleting a customer leaves its addresses and contacts untouched.
- `customer`: `code` (unique among active customers, a soft-deleted one frees it), `name`, `comment`. `address`: `type` (`hq|site|mail`), optional `name`, `country` (EU member state ISO code), `zip`, `city`, `address`. `contact`: `type` (`stock|management|sales`), mandatory `name`, optional `phone`, `email`. Type and country lists are code-only (`libs/customer-api/src/domain.ts`, loaded by the Drizzle schema by relative path like `libs/permissions.ts`).
- `customers.get` / `customers.list` (1..100 ids, order kept, unknown ids omitted) need an identity and return soft-deleted customers too (`deletedAt` set; callers such as order-service treat them as missing) with their active addresses and contacts (also for a deleted customer). Adding an address or contact to a deleted customer is NOT_FOUND. All `add` / `update` / `delete` calls need the `customer.admin` permission. On `update`, omitted fields stay and `null` clears an optional column. Deletes are idempotent.
- Managed through the `web` admin UI (customers, addresses, contacts); the seed creates 100 customers (`C-0001`..) with an hq address and a sales contact.

## Order service

- `order-service` owns `order` and `order_detail` (database `mono_order`); router namespaces `orders` (`create`, `get`, `list`, `delete`) and `orderDetails` (`add`, `delete`), all needing an identity.
- `order`: `customer_id`, `title`, `comment`, `delivery_address_id` (an address of that customer in customer-service; no cross-service foreign key, so `orders.create` checks it against `customers.get` and answers BAD_REQUEST otherwise), soft delete (`deleted_at`). `order_detail`: `order_id` (FK, cascade), `product_code` and `product_name` (copied text, not a product reference), `quantity`, `unit_price`, `net_value` (= quantity * unit price, always set by the service); hard delete, so `businessTimestampColumns`. Money is in minor units (`bigint` in `mode: 'number'`); the contract caps quantity, unit price and the detail count so every sum stays a safe integer.
- `orders.create` stores the order and all its details in one transaction (at least one detail), then publishes `order.placed` with `orderId`, `customerId` and `totalCents` (sum of the net values). `orders.get` returns one active order with its details (NOT_FOUND when missing or soft-deleted). `orders.list` returns active orders newest first with their details in exactly two selects (orders page, then `order_id in (...)`), optional `customerId` filter, `limit` (default 50, max 100) / `offset`. `orders.delete` is a soft delete, idempotent (children stay). `orderDetails.add` / `delete` are NOT_FOUND when the order is missing or soft-deleted and touch the order's `updated_at`; deleting the last detail is allowed.
- Managed through the `web` admin UI (list, create, delete, add/delete lines; there is no order update call, so title/comment/customer/address cannot be edited). The seed creates 100 orders (order n for customer n, delivered to address n, which is customer-service's seeded hq address) with two details each.

## Document service

- `document-service` has no database, no schema, no migrations and no seed (config extends `commonEnvSchema`, `/readyz` is ready once it listens, its `build` target has no `migrate.ts` entry point or migration assets, its compose entry has no `depends_on` Postgres). It owns and subscribes to no events (empty `createEventsRouter`).
- `documents.generateOrderDocument` (query, needs the `document.read` permission): input `{ orderId }`, output `{ orderId, filename, contentType: 'text/markdown', content }`. It calls `orders.get` on order-service and `customers.get` on customer-service with the caller's JWT, trace id and call chain (`callContextOf`), then renders with the pure `renderOrderMarkdown` (`services/orderMarkdown.ts`). A downstream NOT_FOUND (order missing or soft-deleted, customer unknown) answers NOT_FOUND; other downstream errors keep their code (`fromClientError`). A soft-deleted customer and a delivery address that is no longer active still render (the address as "no longer available").
- Nothing is stored: every call renders again. PDF comes later as an additional `contentType` (with `content` as base64) on the same procedure; keep API changes additive. The admin UI calls it through `web` (order list and detail panel: view, download, copy).

## Events (no bus, no persistence, no retry)

- Each event type has exactly one owning service: it defines the schema in its own file in `libs/events` (e.g. `order.ts`, `defineEvent`; CODEOWNERS gives that file to the owning team), is the only sender, and never subscribes to its own events. `@events/registry` holds the `EVENTS` map (owner, schema, subscribers) and the derived types `EventsOwnedBy<S>` / `EventsFor<S>`; a type check fails if an owner subscribes to itself. Current event: `order.placed` (owner `order-service`; subscriber `web`). `system-service` and `document-service` are known `ServiceId`s but own and subscribe to nothing.
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

## Web UI

- Pages (`apps/web/src/routes`): `login`, and the `(app)` group (guarded by `(app)/+layout.server.ts`, which redirects to `/login` without a session): `customers`, `orders`; `/` redirects to `/customers`. `routes/+layout.server.ts` decodes the session JWT (claims, not verified) into `data.user` (`name`, `email`, `permissions`); buttons are hidden by permission (`customer.admin`, `order.place`, `document.read`, `lib/permissions.ts`), the services still enforce them.
- Every list opens its selected row in a right-hand drawer (`SidePanel`); create/edit are modals; deletes go through `ConfirmDialog`. Customers: add/edit/delete plus addresses and contacts in the drawer. Orders: list (newest first, "load more"), create (customer, one of its addresses, lines), add/delete lines, delete, generate the markdown document (view, download, copy). `live.orderPlaced` reloads the order list.
- The UI only uses the existing service calls; the `web` router just forwards them (`customers.page`, `customers.byIds`, `auth.logout` are web-only helpers). customer-service has no list-all call, so `customers.page` asks `customers.list` for a window of 100 consecutive ids (identity ids are contiguous) and `lib/customers.ts` walks the windows.
- Components: `lib/components/ui` holds the generic, reusable ones (`DataTable`, `SidePanel`, `FormModal` + `FormBody`, `ConfirmDialog`, `TextField`, `SelectField`, `InfoList`, `Section`, `ItemCard`, `IconButton`, `PageHeader`, `ErrorAlert`, `ToastHost`); `customers/` and `orders/` hold the feature components (`*Form` = one svstate form each, `*Detail` = drawer content). A thing used twice becomes a component.
- **Forms use svstate**: `createSvState(initial, { validator, action })`; errors are shown only after the first submit (`submitted` flag), `validate()` before `execute()`, the action's thrown error lands in `$actionError`. A form component is mounted only while its `FormModal` is open (flowbite's dialogs render nothing when closed), so each opening starts from fresh state. svstate's dist uses extensionless imports, hence `ssr.noExternal: ['svstate']` in `vite.config.ts`.
- **Styling: no Tailwind classes in our markup.** flowbite-svelte's components are built from Tailwind utilities, so `tailwindcss` + `@tailwindcss/vite` stay as their build engine (`src/app.css` with the flowbite theme, `@source` of the flowbite packages and the `--color-primary-*` palette, otherwise the brand colour is transparent). Our own layout is plain scoped CSS using flowbite's CSS variables (`var(--color-heading)`); never name a scoped class like a Tailwind utility (a `.table` class turned the wrapper into `display: table`). Light theme only (`color-scheme: light`).
- .svelte files do not get the tsconfig path aliases (the `include` covers no .svelte): value imports from `@api/*`, `@lib/*` there must go through a `.ts` file in `lib/`; type imports are fine.
- Dialogs, drawers and toasts live in the browser top layer, so `ToastHost` is a `popover="manual"` element re-shown on every toast.
- Favicons: `apps/web/static` (`favicon.ico`, `favicon-32.png`, `icon-192.png`, `apple-touch-icon.png`), all resized from the one source logo.

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
- Nx needs `@nx/js` to build project-graph edges from TS imports. `lint` and `test` are inferred by the `@nx/eslint/plugin` and `@nx/vitest` plugins in `nx.json` `plugins` (from the root `eslint.config.mjs` and each `vitest.config.ts`; a project without a vitest config has no `test` target, `apps/web` is excluded from the vitest plugin because loading its SvelteKit `vite.config.ts` from the workspace root fails; the `test` default only forces `vitest run` so it never enters watch mode; `test-ci` is deliberately off, since atomized per-file targets would start one Testcontainers Postgres per file). The other targets are `nx:run-commands` (and `@nx/esbuild:esbuild` for service `build`). The service targets (`typecheck`, `serve`, `dev:seed`, `dev:migrate`, `db-generate`, `docker-build`, the esbuild defaults) are defined once in `nx.json` `targetDefaults` with `{projectRoot}` / `{projectName}` tokens; a service's `project.json` only lists the ones it has (`"dev:seed": {}`). Nx drops a default when the project sets a different `options.command`, so `web` (own `typecheck`, `serve`, `build`) repeats `cache`, `dependsOn` and `continuous` itself. `docker-build` depends on `build`. Cache inputs: `sharedGlobals` holds only code that ends up in bundles or typechecking (`tsconfig.base.json`, `libs/*.ts`, `libs/trpc`, `libs/migrations`; not `package.json` or the ESLint config, since Nx hashes the lockfile and `lint` adds its own config input); `production` also excludes tests, seeds, `libs/testing.ts`, `libs/seeding.ts`, Dockerfiles and `.env.example`.
- `dev:migrate` is the only root script that passes `--output-style=static` (Nx prints task logs inline instead of the TUI); `dev` uses `stream`.
- One root ESLint flat config covers everything, including the Svelte rules scoped to `apps/web` (`eslint-plugin-svelte`). Prettier: root config for services and libs; `apps/web` has its own (`prettier-plugin-svelte`, tabs), the nearest config wins.
- Type-only imports are always top-level `import type { X }`, never `import { type X }` (`consistent-type-imports` with `separate-type-imports`, `no-import-type-side-effects`, and `no-restricted-syntax` banning inline `type` specifiers). `verbatimModuleSyntax` is on.
- Code style: compact, arrow functions, no boilerplate; services single quotes, no semicolons; `apps/web` uses tabs. Compact but loose: one blank line between logical blocks (setup, each multi-line query/call, multi-line `if`/`try` blocks, the final `return`; a log line and its `return` may stay together); a one-line guard stays glued to the statement it guards; tests separate arrange / act / assert; never a blank line right after `{` or before `}`.

## Commands

```bash
corepack enable && pnpm install
pnpm dev:infra          # postgres + redis only (docker-compose.dev.yml); the full stack is docker-compose.yml
pnpm env:init           # creates the root .env from .env.example (first run only)
pnpm dev:migrate        # nx run-many -t dev:migrate --parallel=4 (drizzle-kit push, local only) (run after dev:infra and after pulling schema changes)
pnpm dev:seed           # nx run-many -t dev:seed: wipes customer + order data and inserts demo rows (ids from libs/seedIds.ts); dev only
pnpm dev                # nx run-many -t serve: web + services with reload, prefixed output (no migrations)
pnpm all                # format + lint (both write/--fix) + typecheck + test + build (test needs Docker); use format:check/lint:check for a read-only run
pnpm lint               # eslint --fix on all projects + the @lib helpers (not an Nx project)
pnpm lint:check         # same without --fix (what CI runs)
pnpm format             # nx format:write (Prettier)
pnpm format:check       # nx format:check (what CI runs)
pnpm nx run-many -t typecheck test build   # before finishing any change, together with `pnpm format` and `pnpm lint` (test needs Docker)
pnpm nx test <project> -- <file-filter> -t "<test name>"   # single test file/case; args after `--` go to `vitest run` (service tests need Docker)
pnpm test               # nx run-many -t test with streamed output (cached runs replay their logs); pnpm test:force skips the Nx cache
pnpm nx affected -t lint typecheck test --base=main
pnpm nx graph
pnpm nx db-generate <svc>
pnpm nx run-many -t build && docker compose up -d --build   # full stack in Docker, web on :3000
```

- `pnpm test` / `pnpm test:force` use the same env var and `--output-style=stream` for the same reason. `pnpm dev` is `NX_NATIVE_COMMAND_RUNNER=false nx run-many -t serve --parallel=4 --output-style=stream` (`serve` is `continuous` in `nx.json`; `--output-style` keeps Nx out of the TUI and prefixes each line with the project). The env var is required: in a real terminal Nx otherwise runs each app in its own pseudo-terminal (raw mode, no carriage returns), which makes the interleaved output stair-step and garbled. `pnpm dev:migrate` is an `nx run-many -t dev:migrate`. `nx serve <app>` runs one app.
- Config is env-driven and Zod-validated at startup. Dev uses one root `.env` (copy of `.env.example`, loaded by `--env-file` in `serve` / `dev:seed` and `envFile` in `dev:migrate`); it holds each service database as `DATABASE_URL_<SERVICE_ID>` (e.g. `DATABASE_URL_ORDER_SERVICE`, resolved by `databaseUrlEnv` in `libs/databaseUrl.ts`), containers set `DATABASE_URL` directly and it wins. Core services except `document-service` need a database URL; service URLs default to `localhost:300x`.

## Docker and CI

- Every app is fully bundled (`@nx/esbuild:esbuild` for services, configured once in `nx.json` `targetDefaults` and emitting `main.mjs`/`migrate.mjs` plus `migrations/`; adapter-node for `web`), so images contain only the bundle (and migrations, once committed), no `node_modules`. Only `pg-native` (optional) stays external. Build context is the repo root after `nx build`; base image `node:24.21.0-slim`.
- `docker-compose.yml`: Postgres (one database per service, created by `docker/postgres-init.sql`), Redis, the four services and `web`.
- CI (`.github/workflows/ci.yml`, Node from `.nvmrc`): `pnpm format:check`, `pnpm lint:check` (nx lint + @lib helpers), `nx run-many -t typecheck test build`. A `docker-build` step is prepared but commented out (it would build everything on every run, not only affected projects). Pushing images to a registry is not set up yet. Deployment/Kubernetes is out of scope.

## Affected builds

Callers depend on `*-api`, not on service apps, so internal service changes do not ripple outward: a change inside `order-service` affects only it; `customer-api` affects `customer-service`, `order-service`, `web`; `events` affects every app that uses events; `libs/*.ts`, `libs/trpc` and `libs/migrations` affect everything (listed in `sharedGlobals` in `nx.json`). Keep API changes additive: services deploy independently and type safety is compile-time only.

## Not done yet

Registry push in CI, husky/lint-staged, OpenTelemetry tracing, web UI tests (only the services have tests), a UI for users/permissions (system-service has the calls, `web` forwards `users.*`), order editing (no update call in order-service), real service domains (customer, order and document services are examples; the order document is a minimal markdown rendering).
