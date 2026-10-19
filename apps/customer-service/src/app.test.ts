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
import type { AppRouter } from '@api/customer'
import { createApp } from './app'
import type { Config } from './config'
import { customer } from './db/schema'
import * as schema from './db/schema'
import { seed } from './db/seed'

const authed = {
  context: { jwt: unsignedJwt({ sub: '1' }) } satisfies CallContext
}

const admin = {
  context: {
    jwt: unsignedJwt({ sub: '1', permissions: ['customer.admin'] })
  } satisfies CallContext
}

const hq = {
  type: 'hq',
  country: 'HU',
  zip: '1051',
  city: 'Budapest',
  address: 'Fo utca 1'
} as const

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

    // no committed migrations during development (CLAUDE.md): create the tables from the schema, like `drizzle-kit push`
    await (
      await pushSchema(schema, app.container.cradle.database.db as never)
    ).apply()
    await seed(app.container.cradle.database.db)

    client = await testClient<AppRouter>(app.server)
  })

  afterAll(async () => {
    app.server.close()
    await app.container.dispose()
    await pg.stop()
  })

  it('seeds one customer per id of the shared scale with an hq address and a sales contact', async () => {
    const { db } = app.container.cradle.database
    await db.insert(customer).values({ code: 'EXTRA', name: 'Extra' })
    await seed(db)

    const rows = await db.select({ id: customer.id }).from(customer)
    expect(rows.map(r => r.id).sort((a, b) => a - b)).toEqual(
      Array.from({ length: SEED_SCALE.max }, (_, i) => SEED_SCALE.min + i)
    )

    const [first] = await client.customers.list.query({ ids: [1] }, authed)
    expect(first).toMatchObject({
      id: 1,
      code: 'C-0001',
      addresses: [{ type: 'hq', country: 'HU' }],
      contacts: [{ type: 'sales' }]
    })
  })

  it('lists customers with children in the order asked and omits unknown ids', async () => {
    const list = await client.customers.list.query(
      { ids: [3, 999, 1, 3] },
      authed
    )

    expect(list.map(c => c.id)).toEqual([3, 1])
    expect(list.every(c => c.addresses.length === 1)).toBe(true)
  })

  it('gets one customer and maps a missing one to NOT_FOUND', async () => {
    expect(await client.customers.get.query({ id: 2 }, authed)).toMatchObject({
      id: 2,
      deletedAt: null
    })

    await expect(
      client.customers.get.query({ id: 999 }, authed)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
  })

  it('rejects calls without an identity and writes without customer.admin', async () => {
    await expect(
      client.customers.list.query({ ids: [1] })
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } })

    await expect(
      client.customers.add.mutate({ code: 'X', name: 'X' }, authed)
    ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } })
  })

  it('adds, updates and soft-deletes a customer; the code is unique among active customers', async () => {
    const added = await client.customers.add.mutate(
      { code: 'ACME', name: 'Acme', comment: 'first' },
      admin
    )
    expect(added).toMatchObject({
      code: 'ACME',
      comment: 'first',
      addresses: [],
      contacts: [],
      deletedAt: null
    })

    await expect(
      client.customers.add.mutate({ code: 'ACME', name: 'Other' }, admin)
    ).rejects.toMatchObject({ data: { code: 'CONFLICT' } })

    const updated = await client.customers.update.mutate(
      { id: added.id, name: 'Acme Ltd', comment: null },
      admin
    )
    expect(updated).toMatchObject({
      code: 'ACME',
      name: 'Acme Ltd',
      comment: null
    })

    expect(
      await client.customers.delete.mutate({ id: added.id }, admin)
    ).toEqual({ id: added.id })
    expect(
      await client.customers.delete.mutate({ id: added.id }, admin) // idempotent
    ).toEqual({ id: added.id })
    expect(
      (await client.customers.get.query({ id: added.id }, authed)).deletedAt
    ).not.toBeNull()

    await expect(
      client.customers.update.mutate({ id: added.id, name: 'Nope' }, admin)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })

    const again = await client.customers.add.mutate(
      { code: 'ACME', name: 'Acme 2' },
      admin
    ) // a deleted customer frees its code
    expect(again.id).not.toBe(added.id)
  })

  it('adds, updates and soft-deletes addresses', async () => {
    const { id: customerId } = await client.customers.add.mutate(
      { code: 'ADDR', name: 'Addr' },
      admin
    )

    const added = await client.addresses.add.mutate(
      { customerId, ...hq, name: 'Head office' },
      admin
    )
    expect(added).toMatchObject({ customerId, type: 'hq', name: 'Head office' })

    const updated = await client.addresses.update.mutate(
      { id: added.id, city: 'Wien', country: 'AT', name: null },
      admin
    )
    expect(updated).toMatchObject({ city: 'Wien', country: 'AT', name: null })
    expect(
      (await client.customers.get.query({ id: customerId }, authed)).addresses
    ).toHaveLength(1)

    await client.addresses.delete.mutate({ id: added.id }, admin)
    await client.addresses.delete.mutate({ id: added.id }, admin) // idempotent
    expect(
      (await client.customers.get.query({ id: customerId }, authed)).addresses
    ).toEqual([])

    await expect(
      client.addresses.update.mutate({ id: added.id, city: 'X' }, admin)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
    await expect(
      client.addresses.delete.mutate({ id: 999999 }, admin)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
  })

  it('rejects non-EU countries, unknown types and empty mandatory fields', async () => {
    const bad = (input: object) =>
      client.addresses.add.mutate(
        { customerId: 1, ...hq, ...input } as never,
        admin
      )

    await expect(bad({ country: 'US' })).rejects.toMatchObject({
      data: { code: 'BAD_REQUEST' }
    })
    await expect(bad({ type: 'home' })).rejects.toMatchObject({
      data: { code: 'BAD_REQUEST' }
    })
    await expect(bad({ city: ' ' })).rejects.toMatchObject({
      data: { code: 'BAD_REQUEST' }
    })
    await expect(
      client.contacts.add.mutate(
        { customerId: 1, type: 'sales', name: '' },
        admin
      )
    ).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } })
  })

  it('adds, updates and soft-deletes contacts', async () => {
    const { id: customerId } = await client.customers.add.mutate(
      { code: 'CONT', name: 'Cont' },
      admin
    )

    const added = await client.contacts.add.mutate(
      { customerId, type: 'stock', name: 'Stock Guy', phone: '+36 1 234' },
      admin
    )
    expect(added).toMatchObject({
      type: 'stock',
      phone: '+36 1 234',
      email: null
    })

    const updated = await client.contacts.update.mutate(
      {
        id: added.id,
        type: 'management',
        email: 'boss@example.com',
        phone: null
      },
      admin
    )
    expect(updated).toMatchObject({
      type: 'management',
      email: 'boss@example.com',
      phone: null,
      name: 'Stock Guy'
    })

    await client.contacts.delete.mutate({ id: added.id }, admin)
    expect(
      (await client.customers.get.query({ id: customerId }, authed)).contacts
    ).toEqual([])
  })

  it('maps children of a missing or deleted customer to NOT_FOUND and keeps the children of a deleted customer', async () => {
    await expect(
      client.addresses.add.mutate({ customerId: 999999, ...hq }, admin)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })

    const { id: customerId } = await client.customers.add.mutate(
      { code: 'GONE', name: 'Gone' },
      admin
    )
    await client.addresses.add.mutate({ customerId, ...hq }, admin)
    await client.contacts.add.mutate(
      { customerId, type: 'sales', name: 'Sam' },
      admin
    )
    await client.customers.delete.mutate({ id: customerId }, admin)

    const deleted = await client.customers.get.query({ id: customerId }, authed)
    expect(deleted.deletedAt).not.toBeNull()
    expect(deleted.addresses).toHaveLength(1)
    expect(deleted.addresses[0]!.deletedAt).toBeNull()
    expect(deleted.contacts).toHaveLength(1)

    await expect(
      client.contacts.add.mutate(
        { customerId, type: 'sales', name: 'Late' },
        admin
      )
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
  })
})
