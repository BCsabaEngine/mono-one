import { pushSchema } from 'drizzle-kit/api'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SEED_SCALE, seedIds } from '@lib/seedIds'
import {
  listen,
  silentLogger,
  startPostgres,
  testBaseConfig
} from '@lib/testing'
import { createServiceClient, unsignedJwt } from '@lib/trpc'
import type { CallContext } from '@lib/trpc'
import type { AppRouter } from '@api/order'
import { createApp } from './app'
import type { Config } from './config'
import type { Dependencies } from './container'
import { orders } from './db/schema'
import * as schema from './db/schema'
import { seed } from './db/seed'

const customer = {
  id: 7,
  code: 'C-0007',
  name: 'Test Customer',
  comment: null,
  addresses: [],
  contacts: [],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  deletedAt: null as string | null
}

const published: unknown[][] = []

// customer-service is faked at the client boundary; the real call is covered by its own contract/tests
const customerClient = {
  customers: { get: { query: async () => customer } }
} as unknown as Dependencies['customerClient']

const publisher = {
  publish: async (...args: unknown[]) => (
    published.push(args),
    { delivered: [], failed: [] }
  ),
  failedDeliveries: () => ({})
} as unknown as Dependencies['publisher']

describe('order-service (real Postgres)', () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>
  let app: ReturnType<typeof createApp>
  let client: ReturnType<typeof createServiceClient<AppRouter>>

  beforeAll(async () => {
    pg = await startPostgres()
    app = createApp(
      testBaseConfig('order-service', pg.url) as Config,
      silentLogger,
      { customerClient, publisher }
    )

    // no committed migrations during development (CLAUDE.md): create the tables from the schema, like `drizzle-kit push`
    await (
      await pushSchema(schema, app.container.cradle.database.db as never)
    ).apply()

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
    const context = {
      jwt: unsignedJwt({ sub: 'user-1' }),
      traceId: 'trace-abcdef',
      callChain: ['web']
    } satisfies CallContext

    const order = await client.orders.place.mutate(
      { customerId: customer.id, totalCents: 1990 },
      { context }
    )
    expect(order).toMatchObject({
      customerId: customer.id,
      customerName: 'Test Customer',
      totalCents: 1990,
      status: 'placed'
    })
    expect(published).toEqual([
      [
        'order.placed',
        { orderId: order.id, customerId: customer.id, totalCents: 1990 },
        {
          traceId: 'trace-abcdef',
          callChain: ['web', 'order-service'],
          userId: 'user-1'
        }
      ]
    ])
  })

  it('generates a trace id when the caller sends none or a malformed one', async () => {
    published.length = 0
    const jwt = unsignedJwt({ sub: 'user-1' })

    await client.orders.place.mutate(
      { customerId: customer.id, totalCents: 5 },
      { context: { jwt, traceId: 'x y!' } satisfies CallContext }
    )
    await client.orders.place.mutate(
      { customerId: customer.id, totalCents: 5 },
      { context: { jwt } }
    )

    expect(published.map(([, , opts]) => opts)).toEqual([
      {
        traceId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        callChain: ['order-service'],
        userId: 'user-1'
      },
      {
        traceId: expect.stringMatching(/^[0-9a-f-]{36}$/),
        callChain: ['order-service'],
        userId: 'user-1'
      }
    ])
  })

  it('seeds one order per id of the shared scale, each for the customer with the same index', async () => {
    const { db } = app.container.cradle.database
    await seed(db)

    const rows = await db
      .select({ id: orders.id, customerId: orders.customerId })
      .from(orders)
    const byId = new Map(rows.map(r => [r.id, r.customerId]))

    expect(rows.map(r => r.id).sort()).toEqual(seedIds('order'))
    seedIds('order').forEach((id, i) =>
      expect(byId.get(id)).toBe(SEED_SCALE.min + i)
    )
  })

  it('rejects calls without an identity', async () => {
    await expect(
      client.orders.place.mutate({ customerId: customer.id, totalCents: 1 })
    ).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' }
    })
  })

  it('treats a soft-deleted customer as not found', async () => {
    customer.deletedAt = new Date().toISOString()

    try {
      await expect(
        client.orders.place.mutate(
          { customerId: customer.id, totalCents: 1 },
          { context: { jwt: unsignedJwt({ sub: 'user-1' }) } }
        )
      ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
    } finally {
      customer.deletedAt = null
    }
  })
})
