import { eq } from 'drizzle-orm'
import { pushSchema } from 'drizzle-kit/api'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SEED_SCALE } from '@lib/seedIds'
import {
  silentLogger,
  startPostgres,
  testBaseConfig,
  testClient
} from '@lib/testing'
import { unsignedJwt } from '@lib/trpc'
import type { CallContext, createServiceClient } from '@lib/trpc'
import type { AppRouter } from '@api/order'
import { createApp } from './app'
import type { Config } from './config'
import type { Dependencies } from './container'
import { order, orderDetail } from './db/schema'
import * as schema from './db/schema'
import { seed } from './db/seed'

const customer = {
  id: 7,
  code: 'C-0007',
  name: 'Test Customer',
  comment: null,
  addresses: [{ id: 3 }, { id: 4 }],
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

const details = [
  { productCode: 'P-1', productName: 'Widget', quantity: 2, unitPrice: 500 },
  { productCode: 'P-2', productName: 'Gadget', quantity: 1, unitPrice: 990 }
]

const input = {
  customerId: customer.id,
  title: 'Test order',
  deliveryAddressId: 3,
  details
}

const jwt = unsignedJwt({ sub: 'user-1' })
const authed = { context: { jwt } satisfies CallContext }

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

    client = await testClient<AppRouter>(app.server)
  })

  afterAll(async () => {
    app.server.close()
    await app.container.dispose()
    await pg.stop()
  })

  it('creates an order with its details, computes the net values and publishes order.placed', async () => {
    const context = {
      jwt,
      traceId: 'trace-abcdef',
      callChain: ['web']
    } satisfies CallContext

    const created = await client.orders.create.mutate(
      { ...input, comment: 'Ring twice' },
      { context }
    )
    expect(created).toMatchObject({
      customerId: customer.id,
      title: 'Test order',
      comment: 'Ring twice',
      deliveryAddressId: 3
    })
    expect(created.details).toMatchObject([
      {
        orderId: created.id,
        productCode: 'P-1',
        quantity: 2,
        unitPrice: 500,
        netValue: 1000
      },
      {
        orderId: created.id,
        productCode: 'P-2',
        quantity: 1,
        unitPrice: 990,
        netValue: 990
      }
    ])
    expect(published).toEqual([
      [
        'order.placed',
        { orderId: created.id, customerId: customer.id, totalCents: 1990 },
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

    await client.orders.create.mutate(input, {
      context: { jwt, traceId: 'x y!' } satisfies CallContext
    })
    await client.orders.create.mutate(input, { context: { jwt } })

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

  it('rejects a delivery address that is not an address of the customer, and stores nothing', async () => {
    const { db } = app.container.cradle.database
    const before = (await db.select().from(order)).length

    await expect(
      client.orders.create.mutate({ ...input, deliveryAddressId: 99 }, authed)
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } })

    expect((await db.select().from(order)).length).toBe(before)
  })

  it('rejects an order without details', async () => {
    await expect(
      client.orders.create.mutate({ ...input, details: [] }, authed)
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } })
  })

  it('gets an active order with its details, NOT_FOUND when unknown or deleted', async () => {
    const created = await client.orders.create.mutate(input, authed)

    expect(await client.orders.get.query({ id: created.id }, authed)).toEqual(
      created
    )

    await client.orders.delete.mutate({ id: created.id }, authed)

    await expect(
      client.orders.get.query({ id: created.id }, authed)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
    await expect(
      client.orders.get.query({ id: 999_999 }, authed)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
  })

  it('lists active orders newest first with their details, filtered and paged', async () => {
    const { db } = app.container.cradle.database
    await db.delete(order)

    const a = await client.orders.create.mutate(
      { ...input, title: 'A' },
      authed
    )
    const b = await client.orders.create.mutate(
      { ...input, title: 'B', details: details.slice(0, 1) },
      authed
    )
    const gone = await client.orders.create.mutate(
      { ...input, title: 'C' },
      authed
    )
    await client.orders.delete.mutate({ id: gone.id }, authed)

    const all = await client.orders.list.query({}, authed)
    expect(all.map(o => [o.title, o.details.length])).toEqual([
      ['B', 1],
      ['A', 2]
    ])
    expect(all[1]).toEqual(a)
    expect(all[0]).toEqual(b)

    expect(await client.orders.list.query({ customerId: 999 }, authed)).toEqual(
      []
    )
    expect(
      (await client.orders.list.query({ limit: 1, offset: 1 }, authed)).map(
        o => o.title
      )
    ).toEqual(['A'])
  })

  it('soft deletes an order (idempotent, row stays, details stay)', async () => {
    const { db } = app.container.cradle.database
    const created = await client.orders.create.mutate(input, authed)

    await client.orders.delete.mutate({ id: created.id }, authed)
    await expect(
      client.orders.delete.mutate({ id: created.id }, authed)
    ).resolves.toEqual({ id: created.id })

    const rows = await db.select().from(order)
    expect(rows.find(r => r.id === created.id)?.deletedAt).toBeInstanceOf(Date)
    expect(
      (await db.select().from(orderDetail)).filter(
        d => d.orderId === created.id
      )
    ).toHaveLength(2)

    await expect(
      client.orders.delete.mutate({ id: 999_999 }, authed)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
  })

  it('adds and hard deletes details', async () => {
    const { db } = app.container.cradle.database
    const created = await client.orders.create.mutate(input, authed)

    const added = await client.orderDetails.add.mutate(
      {
        orderId: created.id,
        productCode: 'P-3',
        productName: 'Thing',
        quantity: 3,
        unitPrice: 100
      },
      authed
    )
    expect(added).toMatchObject({ orderId: created.id, netValue: 300 })

    const [listed] = await client.orders.list.query({ limit: 1 }, authed)
    expect(listed!.details.map(d => d.productCode)).toEqual([
      'P-1',
      'P-2',
      'P-3'
    ])
    expect(listed!.updatedAt >= created.updatedAt).toBe(true)

    await client.orderDetails.delete.mutate({ id: added.id }, authed)
    expect(
      await db.select().from(orderDetail).where(eq(orderDetail.id, added.id))
    ).toEqual([])

    await expect(
      client.orderDetails.delete.mutate({ id: added.id }, authed)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
  })

  it('does not add or delete details of a deleted or unknown order', async () => {
    const created = await client.orders.create.mutate(input, authed)
    await client.orders.delete.mutate({ id: created.id }, authed)

    const add = (orderId: number) =>
      client.orderDetails.add.mutate(
        {
          orderId,
          productCode: 'P-9',
          productName: 'Nope',
          quantity: 1,
          unitPrice: 1
        },
        authed
      )

    await expect(add(created.id)).rejects.toMatchObject({
      data: { code: 'NOT_FOUND' }
    })
    await expect(add(999_999)).rejects.toMatchObject({
      data: { code: 'NOT_FOUND' }
    })
    await expect(
      client.orderDetails.delete.mutate({ id: created.details[0]!.id }, authed)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
  })

  it('seeds one order per n of the shared scale for the customer and hq address with the same n, two details each', async () => {
    const { db } = app.container.cradle.database
    await seed(db)

    const rows = await db.select().from(order).orderBy(order.id)
    expect(rows).toHaveLength(SEED_SCALE.max - SEED_SCALE.min + 1)
    rows.forEach((r, i) =>
      expect([r.id, r.customerId, r.deliveryAddressId]).toEqual([
        SEED_SCALE.min + i,
        SEED_SCALE.min + i,
        SEED_SCALE.min + i
      ])
    )

    expect(await db.select().from(orderDetail)).toHaveLength(rows.length * 2)
  })

  it('rejects calls without an identity', async () => {
    await expect(client.orders.create.mutate(input)).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' }
    })
    await expect(client.orders.list.query({})).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' }
    })
    await expect(client.orders.get.query({ id: 1 })).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' }
    })
  })

  it('treats a soft-deleted customer as not found', async () => {
    customer.deletedAt = new Date().toISOString()

    try {
      await expect(
        client.orders.create.mutate(input, authed)
      ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
    } finally {
      customer.deletedAt = null
    }
  })
})
