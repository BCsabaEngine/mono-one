import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { runMigrations } from '@mono/shared-migrations'
import { listen, silentLogger, startPostgres, testBaseConfig } from '@mono/shared-testing'
import { createServiceClient, unsignedJwt, type CallContext } from '@mono/shared-trpc'
import type { AppRouter } from '@mono/order-api'
import { createApp } from './app'
import type { Config } from './config'
import type { Cradle } from './container'

const customer = {
  id: crypto.randomUUID(),
  name: 'Test Customer',
  email: 'test@example.com',
  createdAt: new Date().toISOString()
}
const published: unknown[][] = []
// customer-service is faked at the client boundary; the real call is covered by its own contract/tests
const customerClient = { customers: { get: { query: async () => customer } } } as unknown as Cradle['customerClient']
const publisher = {
  publish: async (...args: unknown[]) => (published.push(args), { delivered: [], failed: [] }),
  failedDeliveries: () => ({})
} as unknown as Cradle['publisher']

describe('order-service (real Postgres)', () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>
  let app: ReturnType<typeof createApp>
  let client: ReturnType<typeof createServiceClient<AppRouter>>

  beforeAll(async () => {
    pg = await startPostgres()
    app = createApp(testBaseConfig('order-service', pg.url) as Config, silentLogger, { customerClient, publisher })
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

  it('places an order, stores it and publishes order.placed', async () => {
    const context = { jwt: unsignedJwt({ sub: 'user-1' }) } satisfies CallContext
    const order = await client.orders.place.mutate({ customerId: customer.id, totalCents: 1990 }, { context })
    expect(order).toMatchObject({
      customerId: customer.id,
      customerName: 'Test Customer',
      totalCents: 1990,
      status: 'placed'
    })
    expect(published).toEqual([
      ['order.placed', { orderId: order.id, customerId: customer.id, totalCents: 1990 }, expect.any(Object)]
    ])
  })

  it('rejects calls without an identity', async () => {
    await expect(client.orders.place.mutate({ customerId: customer.id, totalCents: 1 })).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' }
    })
  })
})
