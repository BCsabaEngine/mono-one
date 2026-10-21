import { EventEmitter } from 'node:events'
import type { EventOf } from '@events/registry'

/** In-process fan-out to browsers connected to this instance. The BFF must therefore run as exactly one instance. */
export const bus = new EventEmitter<{ 'order.placed': [EventOf<'order.placed'>['payload']] }>()

// one listener per connected browser (SSE subscription)
bus.setMaxListeners(0)
