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
docker compose up -d --build           # postgres, redis, 4 services, web on :3000
```

Open http://localhost:3000 and sign in as `hello@mono.hu` / `hello` (seed first: `pnpm nx dev:seed system-service`, plus `customer-service` and `order-service` for demo customers and orders). Only `web` is published to the host.

## Develop locally without Docker for the apps

```bash
pnpm dev:infra   # postgres + redis in Docker (docker-compose.dev.yml)
pnpm env:init    # creates the root .env from .env.example (first run only)
pnpm dev:migrate # creates/updates the tables of all services with `drizzle-kit push` (no committed migrations during development)
pnpm dev:seed    # optional: wipes customer + order + system data and inserts demo data; log in as hello@mono.hu / hello
pnpm dev         # serves web + the 4 services with reload
```

Services restart on source changes (`tsx watch`, libs included); `web` uses Vite HMR. `web` is on http://localhost:3000, services on 3001-3004. To run a single app: `pnpm nx serve <app>`.

## Web UI

The `web` app is the admin UI (English, flowbite-svelte, svstate forms): sign in, then use the menu for

- **Customers**: list with search; the selected customer opens in a right-hand drawer (details, addresses, contacts); create, edit and delete (with confirmation).
- **Orders**: list (newest first, updated live when an order is placed); the selected order opens in the drawer with its lines; create an order, add or delete lines, delete the order, and generate the markdown order document (view, download, copy).

Buttons follow the user's permissions (`customer.admin`, `order.place`, `document.read`); the services enforce them too. Architecture and conventions: the "Web UI" section of [CLAUDE.md](CLAUDE.md).

## Example endpoints

| App              | tRPC procedure                                                                                                                                             | Notes                                                                                                   |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| customer-service | `customers.get/list/add/update/delete`, `addresses.*`, `contacts.*`                                                                                        | customers with addresses and contacts; `list` takes 1..100 ids                                          |
| order-service    | `orders.create/get/list/delete`, `orderDetails.add/delete`                                                                                                 | orders with details; `create` checks the customer and delivery address, publishes `order.placed`        |
| document-service | `documents.generateOrderDocument`                                                                                                                          | renders the order + customer as a markdown file on demand; no database                                  |
| system-service   | `users.get`, `getMany`, `auth`, `add`, `update`, `delete`                                                                                                  | users + permissions, soft delete                                                                        |
| web (browser)    | `auth.*`, `customers.*`, `addresses.*`, `contacts.*`, `orders.*`, `orderDetails.*`, `documents.generateOrderDocument`, `users.*`, `live.orderPlaced` (SSE) | forwards to the services (plus the web-only helpers `customers.page`, `customers.byIds`, `auth.logout`) |

## Targets

`lint`, `typecheck`, `test` (Testcontainers needs Docker), `build`, `docker-build`; services also `serve`, `dev:migrate`, `dev:seed` (customer, order, system), `db-generate` (only when migrations are re-introduced; no service has committed migrations now, the `dev:migrate` target runs `drizzle-kit push`).
