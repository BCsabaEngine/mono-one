import { createEventsRouter } from '@events/client'

/** order-service owns no events and subscribes to none: the handler map is empty (checked by the compiler). */
export const eventsRouter = createEventsRouter('order-service', {})
