import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from '@mono/shared-migrations'
import { listen, silentLogger, startPostgres, testBaseConfig } from '@mono/shared-testing'
import { createServiceClient, unsignedJwt, type CallContext } from '@mono/shared-trpc'
import type { AppRouter } from '@mono/customer-api'
import { createApp } from './app'
import type { Config } from './config'

const DEMO_ID = '00000000-0000-4000-8000-000000000001' // seeded by the 0001 migration
const authed = { context: { jwt: unsignedJwt({ sub: 'user-1' }) } satisfies CallContext }

describe('customer-service (real Postgres)', () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>
  let app: ReturnType<typeof createApp>
  let client: ReturnType<typeof createServiceClient<AppRouter>>

  beforeAll(async () => {
    pg = await startPostgres()
    app = createApp(testBaseConfig('customer-service', pg.url) as Config, silentLogger)
    await runMigrations({
      pool: app.container.cradle.database.pool,
      migrationsFolder: `${import.meta.dirname}/db/migrations`,
      logger: silentLogger
    })
    client = createServiceClient<AppRouter>({
      url: `${await listen(app.server)}/trpc`,
      serviceId: 'test',
      timeoutMs: 5000
    })
  })
  afterAll(async () => {
    app.server.close()
    await app.container.dispose()
    await pg.stop()
  })

  it('returns a typed customer', async () => {
    const customer = await client.customers.get.query({ id: DEMO_ID }, authed)
    expect(customer).toMatchObject({ id: DEMO_ID, email: 'demo@example.com' })
  })

  it('maps a missing customer to NOT_FOUND', async () => {
    await expect(client.customers.get.query({ id: crypto.randomUUID() }, authed)).rejects.toMatchObject({
      data: { code: 'NOT_FOUND' }
    })
  })

  it('rejects calls without an identity', async () => {
    await expect(client.customers.get.query({ id: DEMO_ID })).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } })
  })
})
