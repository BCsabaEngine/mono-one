import { randomUUID } from 'node:crypto'
import type { CommonEnv } from '@mono/shared-config'
import { badRequest, forbidden } from '@mono/shared-errors'
import type { Logger } from '@mono/shared-logging'
import { baseEnvelope, deliverAck, type EventsRouter, type ServiceId } from '@mono/events-contract'
import { EVENTS, type EventOf, type EventsFor, type EventsOwnedBy } from '@mono/events-registry'
import { createServiceClient, createTRPC, type BaseContext, type CallContext } from '@mono/shared-trpc'

export type ServiceUrls = Record<ServiceId, string>

export const serviceUrls = (c: CommonEnv): ServiceUrls => ({
  web: c.WEB_URL,
  'customer-service': c.CUSTOMER_SERVICE_URL,
  'order-service': c.ORDER_SERVICE_URL,
  'document-service': c.DOCUMENT_SERVICE_URL
})

export interface PublishResult {
  delivered: ServiceId[]
  failed: { subscriber: ServiceId; error: string }[]
}

/**
 * Owner side. `publish` accepts only event types owned by `serviceId`, validates, then calls every subscriber's
 * `events.deliver` at once. Best effort: no queue, no retry. Call it after the database commit.
 */
export const createPublisher = <S extends ServiceId>({
  serviceId,
  urls,
  log,
  timeoutMs
}: {
  serviceId: S
  urls: ServiceUrls
  log: Logger
  timeoutMs: number
}) => {
  const clients = new Map<ServiceId, ReturnType<typeof createServiceClient<EventsRouter>>>()
  const client = (target: ServiceId) =>
    clients.get(target) ??
    clients
      .set(target, createServiceClient<EventsRouter>({ url: `${urls[target]}/events`, serviceId, timeoutMs }))
      .get(target)!
  const failures = new Map<string, number>() // `${type}:${subscriber}` -> failed delivery count

  const publish = async <T extends EventsOwnedBy<S>>(
    type: T,
    payload: EventOf<T>['payload'],
    opts: { requestId?: string } = {}
  ): Promise<PublishResult> => {
    const def = EVENTS[type]
    const requestId = opts.requestId ?? randomUUID()
    const event = def.schema.parse({
      id: randomUUID(),
      type,
      version: 1,
      occurredAt: new Date().toISOString(),
      requestId,
      payload
    })
    const started = performance.now()
    const subscribers = def.subscribers as readonly ServiceId[]
    const settled = await Promise.allSettled(
      subscribers.map(s =>
        client(s)
          .events.deliver.mutate(event, { context: { requestId } satisfies CallContext })
          .then(() => s)
      )
    )
    const result: PublishResult = { delivered: [], failed: [] }
    settled.forEach((r, i) => {
      const subscriber = subscribers[i]!
      if (r.status === 'fulfilled') return void result.delivered.push(subscriber)
      const error = r.reason instanceof Error ? r.reason.message : String(r.reason)
      result.failed.push({ subscriber, error })
      failures.set(`${type}:${subscriber}`, (failures.get(`${type}:${subscriber}`) ?? 0) + 1)
      log.warn({ eventType: type, subscriber, requestId, error }, 'event delivery failed')
    })
    log.info(
      { eventId: event.id, eventType: type, requestId, ...result, ms: Math.round(performance.now() - started) },
      'event published'
    )
    return result
  }

  return { publish, failedDeliveries: () => Object.fromEntries(failures) }
}

type Handlers<S extends ServiceId> = {
  [K in EventsFor<S>]: (event: EventOf<K>, ctx: BaseContext) => void | Promise<void>
}

/** Subscriber side: mounts `events.deliver`, with exactly one typed handler per subscribed event type. */
export const createEventsRouter = <S extends ServiceId>(serviceId: S, handlers: Handlers<S>) => {
  const { router, procedure } = createTRPC<BaseContext>()
  return router({
    events: router({
      deliver: procedure
        .input(baseEnvelope)
        .output(deliverAck)
        .mutation(async ({ input, ctx }) => {
          const def = (EVENTS as Record<string, (typeof EVENTS)[keyof typeof EVENTS] | undefined>)[input.type]
          if (!def || !(def.subscribers as readonly ServiceId[]).includes(serviceId))
            throw badRequest(`${serviceId} does not subscribe to ${input.type}`)
          // consistency check against bugs and misconfiguration, not a security control
          if (ctx.serviceId !== def.owner) throw forbidden(`${input.type} may only be sent by ${def.owner}`)
          const parsed = def.schema.safeParse(input)
          if (!parsed.success) throw badRequest(`invalid ${input.type} event`, parsed.error.issues)
          await (handlers as Record<string, (e: unknown, c: BaseContext) => void | Promise<void>>)[input.type]!(
            parsed.data,
            ctx
          )
          return { ok: true as const }
        })
    })
  })
}
