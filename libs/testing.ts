import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { pino } from 'pino'
import { baseEnvSchema, loadConfig } from './config'

export const silentLogger = pino({ level: 'silent' })

/** Real Postgres in a container; call `stop()` in afterAll. */
export const startPostgres = async () => {
  const container = await new PostgreSqlContainer(
    'postgres:18.6-alpine3.24'
  ).start()

  return { url: container.getConnectionUri(), stop: () => container.stop() }
}

/** Binds a server to an ephemeral port and returns its base URL. */
export const listen = (server: Server) =>
  new Promise<string>(resolve =>
    server.listen(0, '127.0.0.1', () =>
      resolve(`http://127.0.0.1:${(server.address() as AddressInfo).port}`)
    )
  )

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
