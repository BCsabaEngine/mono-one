import { eq } from 'drizzle-orm'
import { pushSchema } from 'drizzle-kit/api'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  silentLogger,
  startPostgres,
  testBaseConfig,
  testClient
} from '@lib/testing'
import { unsignedJwt } from '@lib/trpc'
import type { CallContext, createServiceClient } from '@lib/trpc'
import type { AppRouter } from '@api/system'
import { createApp } from './app'
import type { Config } from './config'
import { permission, user } from './db/schema'
import * as schema from './db/schema'
import { seed } from './db/seed'

const as = (permissions: string[]) => ({
  context: { jwt: unsignedJwt({ sub: '1', permissions }) } satisfies CallContext
})

const admin = as(['user.admin'])
const plain = as([])

describe('system-service (real Postgres)', () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>
  let app: ReturnType<typeof createApp>
  let client: ReturnType<typeof createServiceClient<AppRouter>>

  beforeAll(async () => {
    pg = await startPostgres()
    app = createApp(
      testBaseConfig('system-service', pg.url) as Config,
      silentLogger
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

  it('seeds the starter user and can log in with it', async () => {
    const { db } = app.container.cradle.database
    await seed(db)
    await seed(db) // wipes and restarts identities: still exactly one user with id 1
    expect(await db.select({ id: user.id }).from(user)).toEqual([{ id: 1 }])

    const hello = await client.users.auth.mutate({
      email: 'Hello@mono.hu',
      password: 'hello'
    })
    expect(hello).toMatchObject({
      id: 1,
      email: 'hello@mono.hu',
      name: 'Hello',
      deletedAt: null
    })
    expect(hello.permissions).toContain('user.admin')
    expect(hello).not.toHaveProperty('password')
    expect(await client.users.get.query({ id: 1 }, plain)).toEqual(hello)
  })

  it('rejects wrong password, unknown email and calls without identity or permission', async () => {
    await expect(
      client.users.auth.mutate({ email: 'hello@mono.hu', password: 'nope' })
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } })
    await expect(
      client.users.auth.mutate({ email: 'nobody@mono.hu', password: 'hello' })
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } })
    await expect(client.users.get.query({ id: 1 })).rejects.toMatchObject({
      data: { code: 'UNAUTHORIZED' }
    })
    await expect(
      client.users.delete.mutate({ id: 1 }, plain)
    ).rejects.toMatchObject({ data: { code: 'FORBIDDEN' } })
  })

  it('adds a user, rejects a duplicate email, updates fields and replaces permissions', async () => {
    const added = await client.users.add.mutate(
      {
        email: 'Ann@Mono.hu',
        name: 'Ann',
        password: 'p1',
        permissions: ['order.place', 'customer.read', 'order.place']
      },
      admin
    )
    expect(added).toMatchObject({
      email: 'ann@mono.hu',
      name: 'Ann',
      permissions: ['customer.read', 'order.place']
    })

    await expect(
      client.users.add.mutate(
        { email: 'ann@mono.hu', name: 'Other', password: 'x' },
        admin
      )
    ).rejects.toMatchObject({ data: { code: 'CONFLICT' } })

    const updated = await client.users.update.mutate(
      {
        id: added.id,
        name: 'Anna',
        permissions: ['document.read'],
        password: 'p2'
      },
      admin
    )
    expect(updated).toMatchObject({
      name: 'Anna',
      permissions: ['document.read']
    })
    expect(Date.parse(updated.updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(added.updatedAt)
    )

    await expect(
      client.users.auth.mutate({ email: 'ann@mono.hu', password: 'p1' })
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } })
    expect(
      (await client.users.auth.mutate({ email: 'ann@mono.hu', password: 'p2' }))
        .id
    ).toBe(added.id)

    const kept = await client.users.update.mutate(
      { id: added.id, name: 'Ann' },
      admin
    ) // permissions omitted: untouched
    expect(kept.permissions).toEqual(['document.read'])
  })

  it('getMany keeps the order of the ids, dedupes and omits unknown ids', async () => {
    const { id } = await client.users.add.mutate(
      { email: 'bob@mono.hu', name: 'Bob', password: 'b' },
      admin
    )

    const users = await client.users.getMany.query(
      { ids: [id, 1, 9999, id] },
      plain
    )
    expect(users.map(u => u.id)).toEqual([id, 1])
  })

  it('soft-deletes: the user is still returned, but cannot log in or be updated; delete is idempotent', async () => {
    const { id } = await client.users.add.mutate(
      {
        email: 'carl@mono.hu',
        name: 'Carl',
        password: 'c',
        permissions: ['order.place']
      },
      admin
    )
    expect(await client.users.delete.mutate({ id }, admin)).toEqual({ id })

    const first = await client.users.get.query({ id }, plain)
    expect(first.deletedAt).not.toBeNull()
    expect(first.permissions).toEqual(['order.place'])

    await client.users.delete.mutate({ id }, admin)
    expect((await client.users.get.query({ id }, plain)).deletedAt).toBe(
      first.deletedAt
    )
    expect(
      (await client.users.getMany.query({ ids: [id] }, plain))[0]?.deletedAt
    ).toBe(first.deletedAt)

    await expect(
      client.users.auth.mutate({ email: 'carl@mono.hu', password: 'c' })
    ).rejects.toMatchObject({ data: { code: 'UNAUTHORIZED' } })
    await expect(
      client.users.update.mutate({ id, name: 'Carlos' }, admin)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
    await expect(
      client.users.delete.mutate({ id: 9999 }, admin)
    ).rejects.toMatchObject({ data: { code: 'NOT_FOUND' } })
  })

  it('cascades permissions when a user row is removed', async () => {
    const { db } = app.container.cradle.database
    const { id } = await client.users.add.mutate(
      {
        email: 'dora@mono.hu',
        name: 'Dora',
        password: 'd',
        permissions: ['order.place']
      },
      admin
    )

    await db.delete(user).where(eq(user.id, id))
    expect(
      await db.select().from(permission).where(eq(permission.userId, id))
    ).toEqual([])
  })
})
