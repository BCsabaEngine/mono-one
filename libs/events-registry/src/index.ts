import type { z } from 'zod'
import type { EventDef, ServiceId } from '@mono/events-contract'
import { orderPlaced } from '@mono/order-events'

/** Single source of truth: who owns an event and who subscribes. An owner never subscribes to its own events. */
export const EVENTS = {
  'order.placed': { owner: 'order-service', schema: orderPlaced, subscribers: ['document-service', 'web'] }
} as const satisfies Record<string, EventDef>

export type EventType = keyof typeof EVENTS
export type EventsOwnedBy<S extends ServiceId> = {
  [K in EventType]: (typeof EVENTS)[K]['owner'] extends S ? K : never
}[EventType]
export type EventsFor<S extends ServiceId> = {
  [K in EventType]: S extends (typeof EVENTS)[K]['subscribers'][number] ? K : never
}[EventType]
export type EventOf<T extends EventType> = z.infer<(typeof EVENTS)[T]['schema']>

type OwnerAlsoSubscribed = {
  [K in EventType]: (typeof EVENTS)[K]['owner'] extends (typeof EVENTS)[K]['subscribers'][number] ? K : never
}[EventType]
/** Compile error if any owner appears in its own subscriber list. */
export const ownersDoNotSubscribe: [OwnerAlsoSubscribed] extends [never] ? true : never = true
