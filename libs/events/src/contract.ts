import { initTRPC } from '@trpc/server'
import { z } from 'zod'

import type { ServiceId } from '@lib/constants'

export { SERVICE_IDS } from '@lib/constants'
export type { ServiceId }

/** Envelope of every event; `payload` is typed per event by defineEvent. */
export const baseEnvelope = z.object({
  id: z.uuid(),
  type: z.string(),
  version: z.number().int(),
  occurredAt: z.iso.datetime(),
  traceId: z.string(),
  /** Caller's user for log correlation only; events never carry the JWT. */
  userId: z.string().optional(),
  payload: z.unknown()
})
export type BaseEnvelope = z.infer<typeof baseEnvelope>

/** Schema of one event: the owner's lib calls this, nobody else may define or copy the schema. */
export const defineEvent = <
  const T extends string,
  const V extends number,
  P extends z.ZodType
>(
  type: T,
  version: V,
  payload: P
) =>
  baseEnvelope.extend({
    type: z.literal(type),
    version: z.literal(version),
    payload
  })

export interface EventDef {
  owner: ServiceId
  schema: z.ZodType<BaseEnvelope>
  subscribers: readonly ServiceId[]
}

export const deliverAck = z.object({ ok: z.literal(true) })

// generic router type of `events.deliver`, so owners never depend on a subscriber's api lib
const t = initTRPC.create()
/** Only its type is used (EventsRouter); never mounted. */
export const eventsRouterShape = t.router({
  events: t.router({
    deliver: t.procedure
      .input(baseEnvelope)
      .output(deliverAck)
      .mutation(() => ({ ok: true as const }))
  })
})
export type EventsRouter = typeof eventsRouterShape
