# mono-one

Nx + pnpm monorepo: a SvelteKit 3 frontend/BFF (`web`) in front of four tRPC services (`customer-service`, `order-service`, `document-service`, `system-service`). Technical docs: [CLAUDE.md](CLAUDE.md). Business docs: [docs/](docs/README.md).

```bash
corepack enable && pnpm install        # Node 24 (.nvmrc)
pnpm nx run-many -t lint typecheck test build
pnpm nx graph
```

## Run everything in Docker

```bash
pnpm nx run-many -t build              # bundles into dist/apps/*
docker compose up -d --build           # postgres, redis, 3 services, web on :3000
```

Open http://localhost:3000, press "Login as hello@mono.hu" (seed it first with `pnpm nx dev:seed system-service`), then call the endpoints. Only `web` is published to the host.

## Develop locally without Docker for the apps

```bash
pnpm dev:infra   # postgres + redis in Docker (docker-compose.dev.yml)
pnpm env:init    # creates missing .env files from .env.example (first run only)
pnpm dev:migrate # creates/updates the tables of all services with `drizzle-kit push` (no committed migrations during development)
pnpm dev:seed    # optional: wipes customer + order + system data and inserts demo data; log in as hello@mono.hu / hello
pnpm dev         # serves web + the 4 services with reload
```

Services restart on source changes (`tsx watch`, libs included); `web` uses Vite HMR. `web` is on http://localhost:3000, services on 3001-3004. To run a single app: `pnpm nx serve <app>`.

## Example endpoints

| App              | tRPC procedure                                                                         | Notes                                                                                            |
| ---------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| customer-service | `customers.get`                                                                        | query by id                                                                                      |
| order-service    | `orders.create/list/delete`, `orderDetails.add/delete`                                 | orders with details; `create` checks the customer and delivery address, publishes `order.placed` |
| document-service | `documents.get`                                                                        | the document is created by the `order.placed` event                                              |
| system-service   | `users.get`, `getMany`, `auth`, `add`, `update`, `delete`                              | users + permissions, soft delete                                                                 |
| web (browser)    | `customers.get`, `orders.create`, `documents.get`, `users.*`, `live.orderPlaced` (SSE) | proxies to the services                                                                          |

## Targets

`lint`, `typecheck`, `test` (Testcontainers needs Docker), `build`, `docker-build`; services also `serve`, `dev:migrate`, `dev:seed` (customer, order, system), `db-generate` (only when migrations are re-introduced; no service has committed migrations now, the `dev:migrate` target runs `drizzle-kit push`).
