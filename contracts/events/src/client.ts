import { randomUUID } from 'node:crypto'
import type { CommonEnv } from '@lib/config'
import { EVENTS_PATH } from '@lib/constants'
import { badRequest, forbidden } from '@lib/errors'
import type { Logger } from '@lib/logging'
import { baseEnvelope, deliverAck } from './contract'
import type { EventsRouter, ServiceId } from './contract'
import { EVENTS } from './registry'
import type { EventOf, EventsFor, EventsOwnedBy } from './registry'
import { createServiceClient, createTRPC } from '@lib/trpc'
import type { BaseContext, CallContext } from '@lib/trpc'

export type ServiceUrls = Record<ServiceId, string>

export const serviceUrls = (c: CommonEnv): ServiceUrls => ({
  web: c.WEB_URL,
  'customer-service': c.CUSTOMER_SERVICE_URL,
  'order-service': c.ORDER_SERVICE_URL,
  'document-service': c.DOCUMENT_SERVICE_URL,
  'system-service': c.SYSTEM_SERVICE_URL
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
  const clients = new Map<
    ServiceId,
    ReturnType<typeof createServiceClient<EventsRouter>>
  >()
  const client = (target: ServiceId) =>
    clients.get(target) ??
    clients
      .set(
        target,
        createServiceClient<EventsRouter>({
          url: `${urls[target]}${EVENTS_PATH}`,
          serviceId,
          timeoutMs
        })
      )
      .get(target)!

  const failures = new Map<string, number>() // `${type}:${subscriber}` -> failed delivery count
  const pending = new Set<Promise<unknown>>() // in-flight publishes, awaited by `drain` on shutdown

  const send = async <T extends EventsOwnedBy<S>>(
    type: T,
    payload: EventOf<T>['payload'],
    opts: { traceId?: string; callChain?: string[]; userId?: string } = {}
  ): Promise<PublishResult> => {
    const def = EVENTS[type]

    const traceId = opts.traceId ?? randomUUID()
    const event = def.schema.parse({
      id: randomUUID(),
      type,
      version: def.schema.shape.version.value,
      occurredAt: new Date().toISOString(),
      traceId,
      ...(opts.userId && { userId: opts.userId }),
      payload
    })

    const started = performance.now()
    const subscribers = def.subscribers as readonly ServiceId[]

    const settled = await Promise.allSettled(
      subscribers.map(s =>
        client(s)
          .events.deliver.mutate(event, {
            context: {
              traceId,
              callChain: opts.callChain
            } satisfies CallContext
          })
          .then(() => s)
      )
    )

    const result: PublishResult = { delivered: [], failed: [] }
    settled.forEach((r, i) => {
      const subscriber = subscribers[i]!

      if (r.status === 'fulfilled')
        return void result.delivered.push(subscriber)

      const error =
        r.reason instanceof Error ? r.reason.message : String(r.reason)
      result.failed.push({ subscriber, error })

      failures.set(
        `${type}:${subscriber}`,
        (failures.get(`${type}:${subscriber}`) ?? 0) + 1
      )

      log.warn(
        { eventType: type, subscriber, traceId, error },
        'event delivery failed'
      )
    })

    log.info(
      {
        eventId: event.id,
        eventType: type,
        traceId,
        ...result,
        ms: Math.round(performance.now() - started)
      },
      'event published'
    )

    return result
  }

  const publish = <T extends EventsOwnedBy<S>>(
    ...args: Parameters<typeof send<T>>
  ) => {
    const p = send<T>(...args)
    const done = p.catch(() => undefined)

    pending.add(done)
    void done.finally(() => pending.delete(done))

    return p
  }

  return {
    publish,
    /** Waits for in-flight publishes (they never reject here); call before the process exits. */
    drain: async () => void (await Promise.all(pending)),
    failedDeliveries: () => Object.fromEntries(failures)
  }
}

type Handlers<S extends ServiceId> = {
  [K in EventsFor<S>]: (
    event: EventOf<K>,
    ctx: BaseContext
  ) => void | Promise<void>
}

/** Subscriber side: mounts `events.deliver`, with exactly one typed handler per subscribed event type. */
export const createEventsRouter = <S extends ServiceId>(
  serviceId: S,
  handlers: Handlers<S>
) => {
  const { router, procedure } = createTRPC<BaseContext>()

  return router({
    events: router({
      deliver: procedure
        .input(baseEnvelope)
        .output(deliverAck)
        .mutation(async ({ input, ctx }) => {
          const def = (
            EVENTS as Record<
              string,
              (typeof EVENTS)[keyof typeof EVENTS] | undefined
            >
          )[input.type]

          if (
            !def ||
            !(def.subscribers as readonly ServiceId[]).includes(serviceId)
          )
            throw badRequest(`${serviceId} does not subscribe to ${input.type}`)

          // consistency check against bugs and misconfiguration, not a security control
          if (ctx.serviceId !== def.owner)
            throw forbidden(`${input.type} may only be sent by ${def.owner}`)

          const parsed = def.schema.safeParse(input)
          if (!parsed.success)
            throw badRequest(`invalid ${input.type} event`, parsed.error.issues)

          // events carry no JWT, so the envelope's userId is the only way to keep it in the handler's logs
          const handlerCtx = input.userId
            ? {
                ...ctx,
                userId: input.userId,
                log: ctx.log.child({ userId: input.userId })
              }
            : ctx

          await (
            handlers as Record<
              string,
              (e: unknown, c: BaseContext) => void | Promise<void>
            >
          )[input.type]!(parsed.data, handlerCtx)

          return { ok: true as const }
        })
    })
  })
}

/** For services that own no events and subscribe to none: the handler map is empty (checked by the compiler). */
export const emptyEventsRouter = <S extends ServiceId>(
  serviceId: S & ([EventsFor<S>] extends [never] ? S : never)
) => createEventsRouter(serviceId, {} as Handlers<S>)
