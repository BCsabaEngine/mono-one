# mono-one

Nx + pnpm monorepo: a SvelteKit 3 frontend/BFF (`web`) in front of three tRPC services (`customer-service`, `order-service`, `document-service`). Technical docs: [CLAUDE.md](CLAUDE.md). Business docs: [docs/](docs/README.md).

```bash
corepack enable && pnpm install        # Node 24 (.node-version)
pnpm nx run-many -t lint typecheck test build
pnpm nx graph
```

## Run everything in Docker

```bash
pnpm nx run-many -t build              # bundles into dist/apps/*
docker compose up -d --build           # postgres, redis, migrations, 3 services, web on :3000
```

Open http://localhost:3000, press "Dev login", then call the endpoints. Only `web` is published to the host.

## Develop locally without Docker for the apps

```bash
pnpm dev:infra   # postgres + redis in Docker
pnpm dev         # creates missing .env files, migrates, then serves web + the 3 services with reload
```

Services restart on source changes (`tsx watch`, libs included); `web` uses Vite HMR. `web` is on http://localhost:3000, services on 3001-3003. To run a single app: `pnpm nx serve <app>`.

## Example endpoints

| App              | tRPC procedure                                                             | Notes                                                                                  |
| ---------------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| customer-service | `customers.get`                                                            | query by id                                                                            |
| order-service    | `orders.place`                                                             | calls `customers.get` (forwarding the JWT), stores the order, publishes `order.placed` |
| document-service | `documents.get`                                                            | the document is created by the `order.placed` event                                    |
| web (browser)    | `customers.get`, `orders.place`, `documents.get`, `live.orderPlaced` (SSE) | proxies to the services                                                                |

## Targets

`lint`, `typecheck`, `test` (Testcontainers needs Docker), `build`, `docker-build`; services also `serve`, `migrate`, `db-generate` (after a schema change).
