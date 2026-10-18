import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from '@lib/migrations'
import { seedId, seedIds } from '@lib/seedIds'
import {
  listen,
  silentLogger,
  startPostgres,
  testBaseConfig
} from '@lib/testing'
import { createServiceClient, unsignedJwt } from '@lib/trpc'
import type { CallContext } from '@lib/trpc'
import type { AppRouter } from '@api/customer'
import { createApp } from './app'
import type { Config } from './config'
import { customers } from './db/schema'
import { seed } from './db/seed'

const DEMO_ID = seedId('customer', 1)
const authed = {
  context: { jwt: unsignedJwt({ sub: 'user-1' }) } satisfies CallContext
}

describe('customer-service (real Postgres)', () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>
  let app: ReturnType<typeof createApp>
  let client: ReturnType<typeof createServiceClient<AppRouter>>

  beforeAll(async () => {
    pg = await startPostgres()
    app = createApp(
      testBaseConfig('customer-service', pg.url) as Config,
      silentLogger
    )
    await runMigrations({
      pool: app.container.cradle.database.pool,
      migrationsFolder: `${import.meta.dirname}/db/migrations`,
      logger: silentLogger
    })
    await seed(app.container.cradle.database.db)
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
    expect(customer).toMatchObject({
      id: DEMO_ID,
      email: 'customer-1@example.com'
    })
  })

  it('seeds exactly the customers of the shared id scale and wipes other rows', async () => {
    const { db } = app.container.cradle.database
    await db
      .insert(customers)
      .values({ name: 'Extra', email: 'extra@example.com' })
    await seed(db)
    const rows = await db.select({ id: customers.id }).from(customers)
    expect(rows.map(r => r.id).sort()).toEqual(seedIds('customer'))
  })

  it('maps a missing customer to NOT_FOUND', async () => {
    await expect(
      client.customers.get.query({ id: crypto.randomUUID() }, authed)
    ).rejects.toMatchObject({
      data: { code: 'NOT_FOUND' }
    })
  })

  it('rejects calls without an identity', async () => {
    await expect(
      client.customers.get.query({ id: DEMO_ID })
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } })
  })
})
