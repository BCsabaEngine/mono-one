import { createServer } from 'node:http'
import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { createHTTPHandler } from '@trpc/server/adapters/standalone'
import { afterEach, describe, expect, it } from 'vitest'
import { pino } from 'pino'
import { baseContextFromHeaders, createServiceClient } from '@lib/trpc'
import type { EventsRouter, ServiceId } from './contract'
import { createEventsRouter, createPublisher } from './client'
import type { ServiceUrls } from './client'

const log = pino({ level: 'silent' })
const payload = { orderId: crypto.randomUUID(), customerId: crypto.randomUUID(), totalCents: 1200 }
const servers: Server[] = []

const subscriber = async (
  serviceId: 'document-service' | 'web',
  onEvent: (e: { type: string }) => void | Promise<void>
) => {
  const router = createEventsRouter(serviceId, { 'order.placed': onEvent })
  const handler = createHTTPHandler({
    basePath: '/events/',
    router,
    createContext: ({ req }) => baseContextFromHeaders(req.headers, log)
  })
  const server = createServer(handler)
  servers.push(server)
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`
}

const urls = (docs: string, web: string): ServiceUrls => ({
  'document-service': docs,
  web,
  'customer-service': 'http://127.0.0.1:1',
  'order-service': 'http://127.0.0.1:1'
})
const publisher = (u: ServiceUrls, timeoutMs = 1000) =>
  createPublisher({ serviceId: 'order-service', urls: u, log, timeoutMs })

afterEach(() => void servers.splice(0).forEach(s => s.close()))

describe('events-client', () => {
  it('delivers a typed event to every subscriber in parallel and reports the results', async () => {
    const got: string[] = []
    const docs = await subscriber(
      'document-service',
      async () => (await new Promise(r => setTimeout(r, 100)), void got.push('docs'))
    )
    const web = await subscriber('web', () => void got.push('web'))
    const started = Date.now()
    const result = await publisher(urls(docs, web)).publish('order.placed', payload)
    expect(result.delivered.sort()).toEqual(['document-service', 'web'])
    expect(result.failed).toEqual([])
    expect(got.sort()).toEqual(['docs', 'web'])
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('one failing subscriber does not affect the others, and the failure is counted', async () => {
    const received: string[] = []
    const web = await subscriber('web', e => void received.push(e.type))
    const pub = publisher(urls('http://127.0.0.1:1', web)) // document-service is down
    const result = await pub.publish('order.placed', payload)
    expect(result.delivered).toEqual(['web'])
    expect(result.failed).toMatchObject([{ subscriber: 'document-service' }])
    expect(received).toEqual(['order.placed'])
    expect(pub.failedDeliveries()).toEqual({ 'order.placed:document-service': 1 })
  })

  it('times out a slow subscriber without waiting for it', async () => {
    const docs = await subscriber('document-service', () => new Promise(r => setTimeout(r, 1500)))
    const web = await subscriber('web', () => undefined)
    const started = Date.now()
    const result = await publisher(urls(docs, web), 200).publish('order.placed', payload)
    expect(result.delivered).toEqual(['web'])
    expect(result.failed.map(f => f.subscriber)).toEqual(['document-service'])
    expect(Date.now() - started).toBeLessThan(1000)
  })

  it('validates the payload against the owner schema before sending', async () => {
    const docs = await subscriber('document-service', () => undefined)
    // @ts-expect-error totalCents must be a number
    await expect(publisher(urls(docs, docs)).publish('order.placed', { ...payload, totalCents: 'x' })).rejects.toThrow()
  })

  it('cannot publish an event the service does not own (compile-time)', () => {
    const notOwner = createPublisher({ serviceId: 'document-service', urls: urls('', ''), log, timeoutMs: 100 })
    // @ts-expect-error order.placed is owned by order-service
    void notOwner.publish('order.placed', payload).catch(() => undefined)
  })

  it('events.deliver rejects a sender that is not the owner', async () => {
    const docs = await subscriber('document-service', () => undefined)
    const client = (serviceId: ServiceId) =>
      createServiceClient<EventsRouter>({ url: `${docs}/events`, serviceId, timeoutMs: 1000 })
    const event = {
      id: crypto.randomUUID(),
      type: 'order.placed',
      version: 1,
      occurredAt: new Date().toISOString(),
      requestId: 'r',
      payload
    }
    await expect(client('customer-service').events.deliver.mutate(event)).rejects.toMatchObject({
      data: { code: 'FORBIDDEN' }
    })
    await expect(client('order-service').events.deliver.mutate(event)).resolves.toEqual({ ok: true })
  })

  it('events.deliver rejects an event that fails the owner schema', async () => {
    const docs = await subscriber('document-service', () => undefined)
    const client = createServiceClient<EventsRouter>({
      url: `${docs}/events`,
      serviceId: 'order-service',
      timeoutMs: 1000
    })
    const bad = {
      id: crypto.randomUUID(),
      type: 'order.placed',
      version: 1,
      occurredAt: new Date().toISOString(),
      requestId: 'r',
      payload: { orderId: 'nope' }
    }
    await expect(client.events.deliver.mutate(bad)).rejects.toMatchObject({ data: { code: 'BAD_REQUEST' } })
  })
})
