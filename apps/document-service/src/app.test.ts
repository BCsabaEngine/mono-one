import { pushSchema } from 'drizzle-kit/api'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  listen,
  silentLogger,
  startPostgres,
  testBaseConfig
} from '@lib/testing'
import { createServiceClient, unsignedJwt } from '@lib/trpc'
import type { CallContext } from '@lib/trpc'
import type { EventsRouter } from '@events/contract'
import type { AppRouter } from '@api/document'
import { createApp } from './app'
import type { Config } from './config'
import * as schema from './db/schema'

const orderId = crypto.randomUUID()

const event = {
  id: crypto.randomUUID(),
  type: 'order.placed',
  version: 1,
  occurredAt: new Date().toISOString(),
  traceId: 'trace-0001',
  payload: { orderId, customerId: 1, totalCents: 500 }
}

describe('document-service (real Postgres)', () => {
  let pg: Awaited<ReturnType<typeof startPostgres>>
  let app: ReturnType<typeof createApp>
  let baseUrl: string

  beforeAll(async () => {
    pg = await startPostgres()
    app = createApp(
      testBaseConfig('document-service', pg.url) as Config,
      silentLogger
    )

    // no committed migrations during development (CLAUDE.md): create the tables from the schema, like `drizzle-kit push`
    await (
      await pushSchema(schema, app.container.cradle.database.db as never)
    ).apply()

    baseUrl = await listen(app.server)
  })

  afterAll(async () => {
    app.server.close()
    await app.container.dispose()
    await pg.stop()
  })

  const events = (serviceId: string) =>
    createServiceClient<EventsRouter>({
      url: `${baseUrl}/events`,
      serviceId,
      timeoutMs: 5000
    })

  it('generates a document when order-service delivers order.placed, readable through documents.get', async () => {
    await expect(
      events('order-service').events.deliver.mutate(event)
    ).resolves.toEqual({ ok: true })

    const docs = createServiceClient<AppRouter>({
      url: `${baseUrl}/trpc`,
      serviceId: 'test',
      timeoutMs: 5000
    })

    const doc = await docs.documents.get.query(
      { orderId },
      { context: { jwt: unsignedJwt({ sub: 'user-1' }) } satisfies CallContext }
    )
    expect(doc).toMatchObject({
      orderId,
      kind: 'order-confirmation',
      status: 'generated'
    })
  })

  it('rejects order.placed from a sender that is not the owner', async () => {
    await expect(
      events('customer-service').events.deliver.mutate(event)
    ).rejects.toMatchObject({
      data: { code: 'FORBIDDEN' }
    })
  })
})
