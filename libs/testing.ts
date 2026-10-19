import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { pino } from 'pino'
import type { AnyTRPCRouter } from '@trpc/server'
import { baseEnvSchema, loadConfig } from './config'
import { TRPC_PATH } from './constants'
import { createServiceClient } from './trpc'

const TEST_CLIENT_TIMEOUT_MS = 5000

export const silentLogger = pino({ level: 'silent' })

const POSTGRES_IMAGE = 'postgres:18.6-alpine3.24' // keep in line with docker-compose.yml

/** Real Postgres in a container; call `stop()` in afterAll. */
export const startPostgres = async () => {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start()

  return { url: container.getConnectionUri(), stop: () => container.stop() }
}

/** Binds a server to an ephemeral port and returns its base URL. */
export const listen = (server: Server) =>
  new Promise<string>(resolve =>
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    )
  )

/** Starts the server on an ephemeral port and returns a typed client for its tRPC router. */
export const testClient = async <R extends AnyTRPCRouter>(server: Server) =>
  createServiceClient<R>({
    url: `${await listen(server)}${TRPC_PATH}`,
    serviceId: 'test',
    timeoutMs: TEST_CLIENT_TIMEOUT_MS
  })

export const testBaseConfig = (
  serviceId: string,
  databaseUrl: string,
  extra: Record<string, string> = {}
) =>
  loadConfig(baseEnvSchema, {
    SERVICE_ID: serviceId,
    DATABASE_URL: databaseUrl,
    NODE_ENV: 'test',
    LOG_LEVEL: 'silent',
    ...extra
  })
